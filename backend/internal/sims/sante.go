package sims

import (
	"context"
	"errors"
	"math"
	"net/http"
	"slices"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// La santé (the update « cycle-vie », game/sante.go): the Sim's illness, brought up to date with every
// action (santeAfter, in mutate's flow), read by the phone (GET /sims/{id}/sante).

func cycleVieOpen(ctx context.Context) bool {
	return features.Default != nil && features.Default.BlocksKey(ctx, game.CycleVieKey) == ""
}

// health: what the sante row holds.
type health struct {
	Kind    string     `json:"kind"`
	Stage   int        `json:"stage"`
	Since   *time.Time `json:"since,omitempty"`
	Net     bool       `json:"net"`
	checked time.Time
}

func readHealth(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, simID string, now time.Time) (health, error) {
	var h health
	err := q.QueryRow(ctx, `SELECT kind, stage, since, net, checked FROM sante WHERE sim_id = $1`, simID).Scan(&h.Kind, &h.Stage, &h.Since, &h.Net, &h.checked)
	if errors.Is(err, pgx.ErrNoRows) {
		return health{checked: now}, nil
	}
	return h, err
}

func saveHealth(ctx context.Context, tx pgx.Tx, simID string, h health) error {
	_, err := tx.Exec(ctx, `INSERT INTO sante (sim_id, kind, stage, since, net, checked) VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (sim_id) DO UPDATE SET kind = $2, stage = $3, since = $4, net = $5, checked = $6`, simID, h.Kind, h.Stage, h.Since, h.Net, h.checked)
	return err
}

// santeAfter: the illness brought up to now, from the actions just finished (`fresh`): a cure, the net
// bought, a sprain at the sport; else, ill, worse with the days (or gone by itself, a light one), and what it
// takes; well, the risk of catching something since the last time. Returns the journal's lines.
func (s *Sim) santeAfter(ctx context.Context, tx pgx.Tx, fresh []Event, now time.Time, roll func() float64) ([]Event, error) {
	h, err := readHealth(ctx, tx, s.ID, now)
	if err != nil {
		return nil, err
	}
	var events []Event
	say := func(text string) { events = append(events, Event{Kind: "health", Text: text, GameTime: s.GameMinutes}) }
	hours := math.Max(0, now.Sub(h.checked).Hours())
	var ended []string
	for _, ev := range fresh {
		if ev.done != nil && ev.done.ended {
			ended = append(ended, ev.done.id)
		}
	}
	if slices.Contains(ended, game.MoustiquaireID) && !h.Net {
		h.Net = true
		say("La moustiquaire est tendue au-dessus du lit : les moustiques peuvent toujours essayer.")
	}
	if h.Kind != "" {
		sk, _ := game.FindSickness(h.Kind)
		// Treated: the pharmacy's medicines a light one, the consultation any.
		for _, id := range ended {
			if lvl, ok := game.Cures[id]; ok && lvl >= h.Stage {
				say("Te voilà soigné·e : " + lowerFirst(sk.Label) + ", c'est fini. Tu reprends des forces.")
				s.Needs = s.Needs.Add(game.Needs{Fun: 10, Energy: 10})
				h = health{Net: h.Net, checked: now}
				return events, saveHealth(ctx, tx, s.ID, h)
			} else if ok {
				say("Les médicaments de la pharmacie ne suffisent plus : " + lowerFirst(sk.Label) + " est trop avancé. Va au centre de santé te faire consulter.")
			}
		}
		age := now.Sub(*h.Since).Hours()
		// A light flu or stomach goes away by itself after a day and a half.
		if (h.Kind == "grippe" || h.Kind == "ventre") && h.Stage == game.SickLight && age >= game.SickHealsAfter {
			say(sk.Label + " est passé tout seul. Ça va mieux !")
			h = health{Net: h.Net, checked: now}
			return events, saveHealth(ctx, tx, s.ID, h)
		}
		// Worse with each day untreated (a flu or a stomach no further than « sérieux »).
		most := game.SickGrave
		if h.Kind == "grippe" || h.Kind == "ventre" {
			most = game.SickSerious
		}
		if stage := min(most, 1+int(age/game.SickWorseAfter)); stage > h.Stage {
			h.Stage = stage
			if stage == game.SickGrave {
				say(sk.Label + " est devenu grave : tu dois aller au centre de santé, tout de suite.")
			} else {
				say(sk.Worse)
			}
		}
		s.Needs = s.Needs.Add(game.SickDrain(sk, h.Stage, math.Min(hours, 12)))
		h.checked = now
		return events, saveHealth(ctx, tx, s.ID, h)
	}
	// Well: a sprain at the sport, or what's caught since the last time.
	caught := ""
	for _, id := range ended {
		if slices.Contains(game.SportIDs, id) && roll() < game.SprainChance {
			caught = "entorse"
		}
	}
	if caught == "" && hours > 0 {
		night := game.HourOf(s.GameMinutes) >= 19 || game.HourOf(s.GameMinutes) < 6
		risk := game.SickRisk(s.Needs, s.age() >= 60, h.Net, night)
		// No palu nor typhoid in New York or Montréal (world/west.go): the cold catches you there instead.
		if world.InAmerica(s.City) {
			risk["palu"], risk["typhoide"] = 0, 0
			risk["grippe"] *= 2
		}
		caught = game.SickRoll(risk, hours, roll)
	}
	if caught != "" {
		sk, _ := game.FindSickness(caught)
		t := now
		h.Kind, h.Stage, h.Since = caught, game.SickLight, &t
		say(sk.Feel)
	}
	h.checked = now
	return events, saveHealth(ctx, tx, s.ID, h)
}

// santeGet: GET /sims/{id}/sante: the illness (or none), the net.
func (h *Handler) santeGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !cycleVieOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, errLifeClosed.Error())
		return
	}
	id := chi.URLParam(r, "id")
	var ok bool
	if err := h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sims WHERE id = $1 AND user_id = $2)`, id, auth.UserID(ctx)).Scan(&ok); err != nil || !ok {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	st, err := readHealth(ctx, h.DB, id, time.Now())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	out := map[string]any{"kind": st.Kind, "stage": st.Stage, "net": st.Net}
	if sk, ok := game.FindSickness(st.Kind); ok {
		out["label"], out["feel"], out["since"] = sk.Label, sk.Feel, st.Since
	}
	// The ways of giving a funeral (funerailles.go), with what the Sim pays of each.
	type funeral struct {
		game.Funeral
		Pays int `json:"pays"`
	}
	fs := make([]funeral, 0, len(game.Funerals))
	for _, f := range game.Funerals {
		fs = append(fs, funeral{f, game.FuneralPays(f)})
	}
	out["funerals"], out["funeralDays"] = fs, game.FuneralDays
	httpx.JSON(w, http.StatusOK, out)
}
