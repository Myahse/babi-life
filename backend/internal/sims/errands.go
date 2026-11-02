package sims

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The quartier's demandes (game/errands.go, the update « demandes »): drawn
// for each real day the first time they're asked for (the phone's app, or an
// activity finished), kept in sim_errands, and moved on as the Sim finishes the
// activities they ask for (errandsAfter, from mutateWith, in the same
// transaction as the Sim). The last step done, the one who asked pays.

// errandView: a demande as the phone shows it: what it is, the step it's at, whether it's done.
type errandView struct {
	game.Errand
	Step int  `json:"step"`
	Done bool `json:"done"`
}

type errandDB interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// errandDay: the real day the demandes are of (Abidjan's, from midnight).
func errandDay(now time.Time) int64 { return game.DayOf(game.MinuteOf(now)) }

// errandsOpen: whether the update is open.
func errandsOpen(ctx context.Context) bool {
	return features.Default.BlocksKey(ctx, game.ErrandsKey) == ""
}

// errandStage: a Sim's stage of life now (an adult from before births: born 0).
func errandStage(born int64, now time.Time) string {
	return game.StageOf(game.AgeAt(born, game.MinuteOf(now))).ID
}

// todaysErrands: the Sim's demandes of the day, drawn and written down the first time.
func todaysErrands(ctx context.Context, db errandDB, sim, commune, stage string, day int64) ([]errandView, error) {
	rows, err := db.Query(ctx, `SELECT errand_id, step, done_at IS NOT NULL FROM sim_errands WHERE sim_id = $1 AND day = $2 ORDER BY slot`, sim, day)
	if err != nil {
		return nil, err
	}
	var out []errandView
	for rows.Next() {
		var id string
		var v errandView
		if err := rows.Scan(&id, &v.Step, &v.Done); err != nil {
			rows.Close()
			return nil, err
		}
		// A demande taken out of the game since: no longer shown.
		if e, ok := game.FindErrand(id); ok {
			v.Errand = e
			out = append(out, v)
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil || out != nil {
		return out, err
	}
	ids := game.ErrandsOfDay(sim, day, stage, world.KindsIn(commune))
	for i, id := range ids {
		if _, err := db.Exec(ctx, `INSERT INTO sim_errands (sim_id, day, errand_id, slot) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, sim, day, id, i); err != nil {
			return nil, err
		}
		e, _ := game.FindErrand(id)
		out = append(out, errandView{Errand: e})
	}
	// The days gone by: a week kept, no more.
	if _, err := db.Exec(ctx, `DELETE FROM sim_errands WHERE sim_id = $1 AND day < $2`, sim, day-7); err != nil {
		return nil, err
	}
	return out, nil
}

// errandsOf: GET /sims/{id}/demandes: today's demandes, and the story under way.
func (h *Handler) errandsOf(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !errandsOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	var born int64
	var commune string
	id := chi.URLParam(r, "id")
	if err := h.DB.QueryRow(ctx, `SELECT born_at, home_commune FROM sims WHERE id = $1 AND user_id = $2`, id, auth.UserID(ctx)).Scan(&born, &commune); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	now := time.Now()
	list, err := todaysErrands(ctx, h.DB, id, commune, errandStage(born, now), errandDay(now))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if list == nil {
		list = []errandView{}
	}
	// The story under way, if the update « histoires » is open too (histoires.go).
	var story *storyView
	if storiesOpen(ctx) {
		r, err := storyNow(ctx, h.DB, id, commune, errandStage(born, now), errandDay(now))
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		if r != nil {
			v := r.view(errandDay(now))
			story = &v
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"errands": list, "story": story})
}

// errandsAfter: the activities just finished move today's demandes on; a
// demande done pays (within the day's FromErrand) and says thanks in the journal.
func (s *Sim) errandsAfter(ctx context.Context, tx pgx.Tx, fresh []Event) ([]Event, error) {
	var ended []*tally
	for _, ev := range fresh {
		if ev.done != nil && ev.done.ended {
			ended = append(ended, ev.done)
		}
	}
	if len(ended) == 0 || !errandsOpen(ctx) {
		return nil, nil
	}
	now := time.Now()
	day := errandDay(now)
	list, err := todaysErrands(ctx, tx, s.ID, s.HomeCommune, s.stage().ID, day)
	if err != nil {
		return nil, err
	}
	var events []Event
	for _, v := range list {
		step := v.Step
		for _, d := range ended {
			if step < len(v.Steps) && v.Steps[step].Counts(d.kind, d.id, d.city) {
				step++
			}
		}
		if v.Done || step == v.Step {
			continue
		}
		done := step == len(v.Steps)
		if _, err := tx.Exec(ctx, `UPDATE sim_errands SET step = $4, done_at = CASE WHEN $5 THEN now() END WHERE sim_id = $1 AND day = $2 AND errand_id = $3`, s.ID, day, v.ID, step, done); err != nil {
			return nil, err
		}
		if !done {
			events = append(events, Event{Kind: "errand", Text: fmt.Sprintf("%s : étape faite. Ensuite : %s.", v.Giver, v.Steps[step].Text), GameTime: s.GameMinutes})
			continue
		}
		s.Needs = s.Needs.Add(v.Effect)
		got := s.earn(game.FromErrand, v.Reward)
		text := fmt.Sprintf("%s : « %s »", v.Giver, v.Thanks)
		if got < v.Reward {
			text = capNote(text, game.FromErrand, got, v.Reward)
		}
		events = append(events, Event{Kind: "errand", Text: text, Money: got, GameTime: s.GameMinutes})
	}
	// The story under way (histoires.go), moved on by the same activities.
	if storiesOpen(ctx) {
		told, err := s.storyAfter(ctx, tx, ended, day)
		if err != nil {
			return nil, err
		}
		events = append(events, told...)
	}
	return events, nil
}
