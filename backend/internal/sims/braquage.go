package sims

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Les braquages (game/braquage.go): starting one (the day's limit, the bank's plan checked), its
// preparation kept (sim_braquages), and its end once its game is played (defi.go « braquage »):
// caught, prison, the fine and the record; got away, the loot and wanted for some hours.

// braquageHold: how long a robbery waits for its game to be played (game minutes).
const braquageHold = 3 * 60

// braquagePlan: a Sim's bank job in preparation, and how long it's wanted.
type braquagePlan struct {
	Bank        string `json:"bank,omitempty"`
	ScoutedDay  int64  `json:"scoutedDay"`
	Prepared    bool   `json:"prepared"`
	WantedUntil int64  `json:"wantedUntil,omitempty"`
}

func loadBraquage(ctx context.Context, tx pgx.Tx, simID string) (braquagePlan, error) {
	p := braquagePlan{ScoutedDay: -1}
	err := tx.QueryRow(ctx, `SELECT bank, scouted_day, prepared, wanted_until FROM sim_braquages WHERE sim_id = $1`, simID).Scan(&p.Bank, &p.ScoutedDay, &p.Prepared, &p.WantedUntil)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, nil
	}
	return p, err
}

func saveBraquage(ctx context.Context, tx pgx.Tx, simID string, p braquagePlan) error {
	_, err := tx.Exec(ctx, `INSERT INTO sim_braquages (sim_id, bank, scouted_day, prepared, wanted_until) VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (sim_id) DO UPDATE SET bank = EXCLUDED.bank, scouted_day = EXCLUDED.scouted_day, prepared = EXCLUDED.prepared, wanted_until = EXCLUDED.wanted_until`,
		simID, p.Bank, p.ScoutedDay, p.Prepared, p.WantedUntil)
	return err
}

// scouted: the bank scouted, recently enough (game.ScoutValidDays real days).
func (p braquagePlan) scouted(bank string, today int64) bool {
	return p.Bank == bank && p.ScoutedDay >= 0 && today-p.ScoutedDay < game.ScoutValidDays
}

// braquageStart: a robbery or its preparation begun at a place (sims.go interact, after the
// interaction is started in memory: an error here and nothing is kept). What's said about it.
func braquageStart(ctx context.Context, tx pgx.Tx, s *Sim, placeID string, it game.Interaction) (string, error) {
	plan, err := loadBraquage(ctx, tx, s.ID)
	if err != nil {
		return "", err
	}
	today := s.today()
	switch it.ID {
	case game.ReperageID:
		plan.Bank, plan.ScoutedDay, plan.Prepared = placeID, today, false
		return "Tu repères les lieux : les gardes, les caméras, l'heure où le coffre s'ouvre. Ensuite : préparer le matériel.", saveBraquage(ctx, tx, s.ID, plan)
	case game.PreparationID:
		if !plan.scouted(placeID, today) {
			return "", errors.New("repère d'abord les lieux de cette banque (en journée), le matériel se prépare pour un plan précis")
		}
		plan.Prepared = true
		return "Masques, sacs, la moto de la fuite : tout est prêt. Il te faut une équipe (des gars de ta bande, des amis proches), puis le jour J.", saveBraquage(ctx, tx, s.ID, plan)
	case game.BraquerBanque:
		switch {
		case !plan.scouted(placeID, today):
			return "", errors.New("le gros coup se prépare : repère d'abord les lieux de cette banque (il y a moins de 3 jours)")
		case !plan.Prepared:
			return "", errors.New("prépare d'abord le matériel : masques, sacs, la moto de la fuite")
		case game.CrewSize(s.Friends) < 2:
			return "", errors.New("pas de banque sans équipe : il te faut au moins deux complices (des gars de ta bande, ou des amis proches)")
		case !s.wallet().Can(today, game.FromBanque):
			return "", game.ErrFull(game.FromBanque)
		}
		s.wallet().Use(today, game.FromBanque)
		return "C'est le jour J. Le coffre d'abord, puis la fuite : joue bien, la police n'attend que ça.", nil
	default:
		if !strings.HasPrefix(it.ID, game.BraquerPrefix) {
			return "", nil
		}
		if !s.wallet().Can(today, game.FromBraquage) {
			return "", game.ErrFull(game.FromBraquage)
		}
		s.wallet().Use(today, game.FromBraquage)
		return "Cagoule, regard noir : c'est maintenant. Joue la fuite, et vite.", nil
	}
}

// policeMetres: how far the place is from the nearest commissariat of its commune (0: none known).
func policeMetres(commune string, lat, lng float64) float64 {
	best := 0.0
	for _, c := range world.Commissariats(commune) {
		if d := metres(lat, lng, c.Lat, c.Lng); best == 0 || d < best {
			best = d
		}
	}
	return best
}

// braquageDone: the robbery's game played (defi.go): caught or got away. What's said, the money (the
// loot, or the fine as a negative).
func braquageDone(ctx context.Context, tx pgx.Tx, s *Sim, a *game.Activity, score int) (string, int, error) {
	plan, err := loadBraquage(ctx, tx, s.ID)
	if err != nil {
		return "", 0, err
	}
	bank := a.Interaction.ID == game.BraquerBanque
	_, cm, place, ok := world.FindPlace(a.PlaceID)
	if !ok {
		return "", 0, errors.New("lieu inconnu")
	}
	odds := game.BraquageOdds{
		Kind: place.Kind, Hour: game.HourOf(s.GameMinutes), Score: score, Record: s.Record,
		Wanted: plan.WantedUntil > s.GameMinutes, PoliceMetres: policeMetres(cm.ID, place.Lat, place.Lng),
	}
	if bank {
		odds.Scouted, odds.Prepared, odds.Crew = plan.scouted(a.PlaceID, s.today()), plan.Prepared, game.CrewSize(s.Friends)
	}
	// The job is over either way: the bank's plan is spent.
	if bank {
		plan.Bank, plan.ScoutedDay, plan.Prepared = "", -1, false
	}
	a.End = min(a.End, s.GameMinutes)
	chance := game.CaughtChance(odds)
	if rand.Float64() < chance {
		// Caught: the record, the fine, prison (one can't leave it: the commissariat's activity, social.go).
		s.Record++
		fine := game.Fine(s.Money, bank)
		s.Money -= fine
		plan.WantedUntil = 0
		if err := saveBraquage(ctx, tx, s.ID, plan); err != nil {
			return "", 0, err
		}
		// To the MACA (prison.go): its étapes to live before the sortie.
		s.jail(bank)
		return fmt.Sprintf("La police t'attendait ! Arrêté·e après le braquage (%s). Amende : %s. Direction la MACA : %d étapes à faire avant de sortir. Et c'est sur ton casier.", place.Name, game.FCFA(fine), len(s.Prison.Steps)), -fine, nil
	}
	// Got away: the loot (within the day's limits), wanted for some hours.
	loot := game.BraquageLoot(odds, rand.New(rand.NewPCG(uint64(s.GameMinutes), uint64(len(s.ID)))))
	src := game.FromBraquage
	if bank {
		src = game.FromBanque
	}
	got := s.earn(src, loot)
	plan.WantedUntil = s.GameMinutes + game.WantedMinutes
	if err := saveBraquage(ctx, tx, s.ID, plan); err != nil {
		return "", 0, err
	}
	text := fmt.Sprintf("Ça a marché ! %s pour toi", game.FCFA(got))
	if bank && odds.Crew > 0 {
		text += " (l'équipe a pris sa part)"
	}
	text += fmt.Sprintf(". Tu es recherché·e pendant %d h : fais-toi discret·e.", game.WantedMinutes/60)
	if got < loot {
		text += " (Le reste, tu ne peux pas le dépenser aujourd'hui.)"
	}
	return text, got, nil
}

// braquageView: GET /sims/{id}/braquage: where the bank job stands, and how long the Sim stays wanted
// (the phone shows it in the bank's menu and on the screen).
func (h *Handler) braquageView(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	ctx := r.Context()
	var record int
	var friends []game.Friend
	var plan braquagePlan
	err = pgx.BeginFunc(ctx, h.DB, func(tx pgx.Tx) error {
		if e := tx.QueryRow(ctx, `SELECT record, friends FROM sims WHERE id = $1`, id).Scan(&record, &friends); e != nil {
			return e
		}
		var e error
		plan, e = loadBraquage(ctx, tx, id)
		return e
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	now := game.MinuteOf(time.Now())
	out := map[string]any{"record": record, "crew": game.CrewSize(friends)}
	if plan.WantedUntil > now {
		out["wantedUntil"] = plan.WantedUntil
	}
	if plan.Bank != "" && plan.scouted(plan.Bank, game.DayOf(now)) {
		out["bank"], out["prepared"] = plan.Bank, plan.Prepared
	}
	httpx.JSON(w, http.StatusOK, out)
}
