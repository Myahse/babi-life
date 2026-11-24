package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Les animaux (the update « animaux », game/animaux.go): the Sim's animals, read and cared for.
//   GET  /sims/{id}/animaux                    the kinds one can adopt, and its own (brought up to now)
//   POST /sims/{id}/animaux {kind, name}        adopt one (one of each kind, PetsMax in all)
//   POST /sims/{id}/animaux/{pet}/{act}         nourrir | chercher | oeufs | vendre | tabaski | a kind's act

var (
	errPetsClosed  = errors.New("bientôt dans le jeu")
	errPetKind     = errors.New("cet animal n'existe pas")
	errPetHave     = errors.New("tu as déjà cet animal")
	errPetsFull    = errors.New("tu as déjà assez d'animaux")
	errPetNone     = errors.New("cet animal n'est pas à toi")
	errPetAway     = errors.New("il est parti : cherche-le d'abord dans le quartier")
	errPetHome     = errors.New("il est à la maison")
	errPetAct      = errors.New("pas possible avec cet animal")
	errPetSoon     = errors.New("il en a eu assez pour l'instant : un peu plus tard")
	errPetFull     = errors.New("il n'a pas faim")
	errPetNoEggs   = errors.New("pas encore d'œufs : nourris-les bien, elles pondent toutes les 4 heures")
	errPetTabaski  = errors.New("ce n'est pas encore la Tabaski")
	errPetMinor    = errors.New("demande à tes parents d'abord")
	errPetNameLong = errors.New("un nom de 20 lettres au plus")
	errBroke       = errors.New("pas assez d'argent")
)

func animauxOpen(ctx context.Context) bool {
	return features.Default.BlocksKey(ctx, game.AnimauxKey) == ""
}

const petColumns = `id, kind, name, hunger, spirits, bond, away, hungry0, eggs, egg_at, fed_days, done, since, updated`

func scanPet(row pgx.Row) (game.Pet, error) {
	var p game.Pet
	var eggAt *time.Time
	var done []byte
	err := row.Scan(&p.ID, &p.Kind, &p.Name, &p.Hunger, &p.Spirits, &p.Bond, &p.Away, &p.Hungry0, &p.Eggs, &eggAt, &p.FedDays, &done, &p.Since, &p.Updated)
	if eggAt != nil {
		p.EggAt = *eggAt
	}
	_ = json.Unmarshal(done, &p.Done)
	return p, err
}

func savePet(ctx context.Context, tx pgx.Tx, p game.Pet) error {
	done, _ := json.Marshal(p.Done)
	var eggAt *time.Time
	if !p.EggAt.IsZero() {
		eggAt = &p.EggAt
	}
	_, err := tx.Exec(ctx, `UPDATE pets SET hunger = $2, spirits = $3, bond = $4, away = $5, hungry0 = $6, eggs = $7, egg_at = $8, fed_days = $9, done = $10, updated = $11 WHERE id = $1`,
		p.ID, p.Hunger, p.Spirits, p.Bond, p.Away, p.Hungry0, p.Eggs, eggAt, p.FedDays, done, p.Updated)
	return err
}

// readPets: a Sim's animals, brought up to now (and saved so, the ones that ran off told in its journal).
func readPets(ctx context.Context, db interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, simID string) ([]game.Pet, error) {
	rows, err := db.Query(ctx, `SELECT `+petColumns+` FROM pets WHERE sim_id = $1 ORDER BY since`, simID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []game.Pet
	for rows.Next() {
		p, err := scanPet(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// petView: an animal as the phone shows it.
type petView struct {
	game.Pet
	Mood string `json:"mood"`
	// Next: when each act can be done again (game minutes are real minutes: unix ms).
	Next map[string]int64 `json:"next,omitempty"`
}

func viewPet(p game.Pet, now time.Time) petView {
	v := petView{Pet: p, Mood: p.Mood(), Next: map[string]int64{}}
	if p.Kind == "mouton" {
		v.Worth = game.SheepWorth(p)
	}
	if k, ok := game.FindPetKind(p.Kind); ok {
		for _, a := range k.Acts {
			if at, ok := p.Done[a.ID]; ok && a.Every > 0 {
				if next := at.Add(time.Duration(a.Every) * time.Minute); next.After(now) {
					v.Next[a.ID] = next.UnixMilli()
				}
			}
		}
	}
	return v
}

// animauxGet: GET /sims/{id}/animaux.
func (h *Handler) animauxGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !animauxOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, errPetsClosed.Error())
		return
	}
	id := chi.URLParam(r, "id")
	var ok bool
	if err := h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sims WHERE id = $1 AND user_id = $2)`, id, auth.UserID(ctx)).Scan(&ok); err != nil || !ok {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	pets, err := readPets(ctx, tx, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	now := time.Now()
	views := make([]petView, 0, len(pets))
	for _, p := range pets {
		if p.Decay(now) {
			k, _ := game.FindPetKind(p.Kind)
			_ = insertEvent(ctx, tx, id, "social", fmt.Sprintf("%s (%s) a fugué : trop longtemps le ventre vide. Cherche-le dans le quartier.", p.Name, lowerFirst(k.Label)), 0, game.MinuteOf(now))
		}
		if err := savePet(ctx, tx, p); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		views = append(views, viewPet(p, now))
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	hol, isHoliday := game.HolidayOn(game.MinuteOf(now))
	httpx.JSON(w, http.StatusOK, map[string]any{"kinds": game.PetKinds, "pets": views, "max": game.PetsMax, "tabaski": isHoliday && hol.ID == "tabaski"})
}

// animauxAdopt: POST /sims/{id}/animaux {kind, name}.
func (h *Handler) animauxAdopt(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind string `json:"kind"`
		Name string `json:"name"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if !animauxOpen(ctx) {
			return game.Outcome{}, nil, errPetsClosed
		}
		k, ok := game.FindPetKind(req.Kind)
		if !ok {
			return game.Outcome{}, nil, errPetKind
		}
		if s.stage().ID == game.StageBebe {
			return game.Outcome{}, nil, errPetMinor
		}
		name := strings.TrimSpace(req.Name)
		if name == "" {
			name = k.Names[0]
		}
		if utf8.RuneCountInString(name) > 20 {
			return game.Outcome{}, nil, errPetNameLong
		}
		var n int
		var have bool
		if err := tx.QueryRow(ctx, `SELECT count(*), COALESCE(bool_or(kind = $2), false) FROM pets WHERE sim_id = $1`, s.ID, k.ID).Scan(&n, &have); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return game.Outcome{}, nil, err
		}
		if have {
			return game.Outcome{}, nil, errPetHave
		}
		if n >= game.PetsMax {
			return game.Outcome{}, nil, errPetsFull
		}
		if s.Money < k.Price {
			return game.Outcome{}, nil, errBroke
		}
		s.Money -= k.Price
		if _, err := tx.Exec(ctx, `INSERT INTO pets (sim_id, kind, name, egg_at) VALUES ($1, $2, $3, now())`, s.ID, k.ID, name); err != nil {
			return game.Outcome{}, nil, err
		}
		s.Needs = s.Needs.Add(game.Needs{Fun: 15, Social: 5})
		text := fmt.Sprintf("Bienvenue à %s dans ta cour (%s) ! Un repas et un peu d'attention chaque jour, et vous serez inséparables.", name, lowerFirst(k.Label))
		return game.Outcome{Text: text, Money: -k.Price}, []Event{{Kind: "social", Text: text, Money: -k.Price, GameTime: s.GameMinutes}}, nil
	})
}

// animauxAct: POST /sims/{id}/animaux/{pet}/{act}.
func (h *Handler) animauxAct(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	petID, err := strconv.ParseInt(chi.URLParam(r, "pet"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	act := chi.URLParam(r, "act")
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if !animauxOpen(ctx) {
			return game.Outcome{}, nil, errPetsClosed
		}
		p, err := scanPet(tx.QueryRow(ctx, `SELECT `+petColumns+` FROM pets WHERE id = $1 AND sim_id = $2 FOR UPDATE`, petID, s.ID))
		if errors.Is(err, pgx.ErrNoRows) {
			return game.Outcome{}, nil, errPetNone
		}
		if err != nil {
			return game.Outcome{}, nil, err
		}
		now := time.Now()
		p.Decay(now)
		text, money, gone, err := s.petAct(&p, act, now, newRand().Float64())
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if gone {
			if _, err := tx.Exec(ctx, `DELETE FROM pets WHERE id = $1`, p.ID); err != nil {
				return game.Outcome{}, nil, err
			}
		} else if err := savePet(ctx, tx, p); err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: text, Money: money}, []Event{{Kind: "social", Text: text, Money: money, GameTime: s.GameMinutes}}, nil
	})
}

// petAct: what's done with the animal (at `now`; roll for the search): the line said, the money (spent <0,
// earned >0), whether the animal is no longer the Sim's (sold, the Tabaski feast).
func (s *Sim) petAct(p *game.Pet, act string, now time.Time, roll float64) (string, int, bool, error) {
	k, ok := game.FindPetKind(p.Kind)
	if !ok {
		return "", 0, false, errPetKind
	}
	if p.Away != nil && act != "chercher" {
		return "", 0, false, errPetAway
	}
	if p.Done == nil {
		p.Done = map[string]time.Time{}
	}
	switch act {
	case "nourrir":
		if p.Hunger >= 90 {
			return "", 0, false, errPetFull
		}
		if s.Money < k.Food {
			return "", 0, false, errBroke
		}
		s.Money -= k.Food
		p.Hunger = 100
		p.Hungry0 = nil
		p.Bond = min(100, p.Bond+2)
		// A day fed counts (the sheep puts weight on).
		day := now.Format("2006-01-02")
		if last, ok := p.Done["nourrir"]; !ok || last.Format("2006-01-02") != day {
			p.FedDays++
		}
		p.Done["nourrir"] = now
		return fmt.Sprintf("%s : %s. %s se régale.", k.Label, strings.ToLower(k.FoodLabel), p.Name), -k.Food, false, nil
	case "chercher":
		if p.Away == nil {
			return "", 0, false, errPetHome
		}
		if at, ok := p.Done["chercher"]; ok && now.Sub(at) < 20*time.Minute {
			return "", 0, false, errPetSoon
		}
		p.Done["chercher"] = now
		s.Needs = s.Needs.Add(game.Needs{Energy: -5})
		if roll < game.PetFindChance {
			p.Away = nil
			p.Hungry0 = nil
			p.Hunger = 40
			p.Updated = now
			return fmt.Sprintf("Tu as retrouvé %s derrière le maquis ! Il rentre avec toi, la tête basse. Donne-lui à manger.", p.Name), 0, false, nil
		}
		return fmt.Sprintf("Tu as fait tout le quartier : pas de %s. Les enfants disent l'avoir vu vers le marché… Réessaie plus tard.", p.Name), 0, false, nil
	case "oeufs":
		if p.Kind != "poules" {
			return "", 0, false, errPetAct
		}
		if p.Eggs <= 0 {
			return "", 0, false, errPetNoEggs
		}
		n := p.Eggs
		p.Eggs = 0
		got := s.earn(game.FromAnimaux, n*game.EggPrice)
		s.Needs = s.Needs.Add(game.Needs{Fun: 3})
		return fmt.Sprintf("%d œufs ramassés et vendus au marché : %s.", n, game.FCFA(got)), got, false, nil
	case "vendre":
		if p.Kind != "mouton" {
			return "", 0, false, errPetAct
		}
		worth := game.SheepWorth(*p)
		got := s.earn(game.FromAnimaux, worth)
		// What the day's cap held back goes straight to the Sim all the same: it's the sheep's price, not a gain.
		if got < worth {
			s.Money += worth - got
			got = worth
		}
		return fmt.Sprintf("Tu as vendu %s au marché à bétail pour %s.", p.Name, game.FCFA(got)), got, true, nil
	case "tabaski":
		if p.Kind != "mouton" {
			return "", 0, false, errPetAct
		}
		if h, ok := game.HolidayOn(game.MinuteOf(now)); !ok || h.ID != "tabaski" {
			return "", 0, false, errPetTabaski
		}
		s.Needs = s.Needs.Add(game.Needs{Hunger: 100, Social: 50, Fun: 40})
		return fmt.Sprintf("Bonne fête de Tabaski ! %s a nourri toute la famille, et tu as porté leur part aux voisins. La cour est en fête.", p.Name), 0, true, nil
	}
	for _, a := range k.Acts {
		if a.ID != act {
			continue
		}
		if a.ID == "oeufs" {
			break
		}
		if at, ok := p.Done[a.ID]; ok && a.Every > 0 && now.Sub(at) < time.Duration(a.Every)*time.Minute {
			return "", 0, false, errPetSoon
		}
		p.Done[a.ID] = now
		p.Spirits = min(100, p.Spirits+a.Spirits)
		p.Bond = min(100, p.Bond+a.Bond)
		s.Needs = s.Needs.Add(a.Sim)
		return petLine(p, a), 0, false, nil
	}
	return "", 0, false, errPetAct
}

// petLine: what doing it with the animal looks like.
func petLine(p *game.Pet, a game.PetAct) string {
	switch a.ID {
	case "promener":
		return fmt.Sprintf("Tour du quartier avec %s : il renifle chaque poteau et salue tous les chiens. Vous rentrez contents.", p.Name)
	case "jouer":
		return fmt.Sprintf("%s court après, revient, recommence. Il ne se fatigue jamais !", p.Name)
	case "caresser":
		return fmt.Sprintf("%s ferme les yeux de bonheur.", p.Name)
	case "brosser":
		return fmt.Sprintf("%s a la laine toute propre : le plus beau mouton de la cour.", p.Name)
	}
	return fmt.Sprintf("%s est content.", p.Name)
}
