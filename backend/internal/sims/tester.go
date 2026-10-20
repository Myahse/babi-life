package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/adminkey"
	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The testers' toolbox (web/src/components/TesterTools.tsx): before launch,
// the team plays everything without waiting. On a tester account (users.tester),
// or with the testers' code or the admin key, a Sim can jump to any age, get Djai, have
// its needs full, finish what it is doing now and get every phone app.

// TesterMaxMoney: the most Djai one tap gives.
const TesterMaxMoney = 10_000_000

var errNotTester = errors.New("réservé aux comptes testeurs : entre le code sur /testeur")

// TesterAction is a tap in the toolbox.
type TesterAction struct {
	Action string `json:"action"` // age, money, needs, finish, apps
	Stage  string `json:"stage"`  // for age: game.Stage* id
	Amount int    `json:"amount"` // for money
}

func (h *Handler) tester(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Pass string `json:"pass"`
		TesterAction
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	var tester, off bool
	_ = h.DB.QueryRow(r.Context(), `SELECT tester, tester_off FROM users WHERE id = $1`, auth.UserID(r.Context())).Scan(&tester, &off)
	if !tester && (off || !adminkey.Tester(req.Pass)) {
		httpx.Error(w, http.StatusForbidden, errNotTester.Error())
		return
	}
	// Marked: reset with the testers' accounts before launch (ResetTesters).
	_, _ = h.DB.Exec(r.Context(), `UPDATE sims SET tested = true WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context()))
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		events, err := s.testerDo(req.TesterAction)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		out := game.Outcome{}
		for _, e := range events {
			out.Money += e.Money
		}
		if len(events) > 0 {
			out.Text = events[len(events)-1].Text
		}
		return out, events, nil
	})
}

func (s *Sim) testerDo(a TesterAction) ([]Event, error) {
	switch a.Action {
	case "age":
		return s.testerAge(a.Stage)
	case "money":
		n := min(max(a.Amount, 1), TesterMaxMoney)
		s.Money += n
		return []Event{{Kind: "life", Text: fmt.Sprintf("Testeur : %s ajoutés.", game.FCFA(n)), Money: n, GameTime: s.GameMinutes}}, nil
	case "needs":
		s.Needs = game.Needs{Hunger: 100, Energy: 100, Hygiene: 100, Social: 100, Fun: 100}
		return []Event{{Kind: "life", Text: "Testeur : tous les besoins au maximum.", GameTime: s.GameMinutes}}, nil
	case "finish":
		a := s.Activity
		if a == nil {
			return nil, fmt.Errorf("ton perso ne fait rien")
		}
		s.Needs = a.Progress(s.Needs, s.GameMinutes, a.End)
		return s.finish(newRand()), nil
	case "apps":
		if !s.hasPhone() {
			return nil, errNoPhoneYet
		}
		for _, p := range world.PhoneApps {
			if !slices.Contains(s.Apps, p.ID) {
				s.Apps = append(s.Apps, p.ID)
			}
		}
		return []Event{{Kind: "life", Text: "Testeur : toutes les applis sont installées.", GameTime: s.GameMinutes}}, nil
	}
	return nil, fmt.Errorf("action testeur inconnue")
}

// testerAge: the Sim is now at the start of a stage. Growing up goes through
// what happens on the way (birthdays, the phone at 12, leaving home at 18),
// as if the time had passed; going back just changes the birth date.
func (s *Sim) testerAge(stage string) ([]Event, error) {
	i := slices.IndexFunc(game.Stages, func(st game.Stage) bool { return st.ID == stage })
	if i < 0 {
		return nil, fmt.Errorf("âge inconnu")
	}
	old := s.GameMinutes - s.BornAt
	if s.BornAt == 0 {
		old = game.MinutesToAge(game.AdultAge) // a Sim from before births is an adult
	}
	if s.Family == "" {
		s.Family = "poignon" // leaving home at 18 needs a family
	}
	to := game.MinutesToAge(float64(game.Stages[i].From))
	s.BornAt = s.GameMinutes - to
	if s.BornAt == 0 {
		s.BornAt = -1 // 0 means "no birth date"
	}
	var events []Event
	if to > old {
		events = s.growUp(s.BornAt+old, s.GameMinutes)
		if s.age() < game.AdultAge {
			events = append(events, s.pocketMoney(s.BornAt+old, s.GameMinutes)...)
		}
	}
	text := fmt.Sprintf("Testeur : %s est maintenant %s (%d ans).", s.FirstName, strings.ToLower(game.Stages[i].Label), s.age())
	if s.age() == 0 {
		text = fmt.Sprintf("Testeur : %s est de nouveau un bébé.", s.FirstName)
	}
	return append(events, Event{Kind: "life", Text: text, GameTime: s.GameMinutes}), nil
}

// ResetTesters puts every tester's Sim back as it was just created: the same
// person (name, look, traits, aspiration, family, where they were born), a
// newborn again with no money, an empty journal, no plot, no bets, posts,
// messages or friends (all of it goes with the Sim: ON DELETE CASCADE), the
// same id so the game finds it. Testers are the accounts that entered the
// code (users.tester) and the Sims the toolbox was used on (sims.tested);
// the accounts stop being testers. Returns how many Sims were reset.
func ResetTesters(ctx context.Context, db *pgxpool.Pool) (int, error) {
	tx, err := db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	type born struct {
		id, user, first, last, gender, aspiration, homeCity, homeCommune, family string
		look                                                                     []byte
		traits                                                                   []string
		created                                                                  time.Time
	}
	rows, err := tx.Query(ctx, `
		SELECT s.id, s.user_id, s.first_name, s.last_name, s.gender, s.aspiration, s.home_city, s.home_commune, s.family, s.look, s.traits, s.created_at
		FROM sims s JOIN users u ON u.id = s.user_id
		WHERE u.tester OR s.tested
		FOR UPDATE OF s`)
	if err != nil {
		return 0, err
	}
	var all []born
	for rows.Next() {
		var b born
		if err := rows.Scan(&b.id, &b.user, &b.first, &b.last, &b.gender, &b.aspiration, &b.homeCity, &b.homeCommune, &b.family, &b.look, &b.traits, &b.created); err != nil {
			rows.Close()
			return 0, err
		}
		all = append(all, b)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}
	ids := func(bs []born) []string {
		out := make([]string, len(bs))
		for i, b := range bs {
			out[i] = b.id
		}
		return out
	}
	now := game.MinuteOf(time.Now())
	for _, b := range all {
		fam, ok := game.FindFamily(b.family)
		if !ok {
			fam = game.Families[0]
		}
		if _, err := tx.Exec(ctx, `DELETE FROM sims WHERE id = $1`, b.id); err != nil {
			return 0, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO sims (id, user_id, first_name, last_name, gender, look, traits, aspiration,
			                  home_city, home_commune, city, commune, money, needs, game_minutes,
			                  origin, housing, loan, born_at, family, apps, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, $10, 0, $11, $12, '', $13, 0, $12, $14, '{}', $15)`,
			b.id, b.user, b.first, b.last, b.gender, b.look, b.traits, b.aspiration, b.homeCity, b.homeCommune,
			game.FreshNeeds(), now, fam.Housing, fam.ID, b.created); err != nil {
			return 0, err
		}
		where := b.homeCommune
		if city, ok := world.FindCity(b.homeCity); ok {
			if cm, ok := city.Commune(b.homeCommune); ok {
				where = cm.Name
			}
		}
		text := fmt.Sprintf("%s est %s %s, dans %s, d'une famille %s. %s", b.first, bornWord(b.gender, "né", "née"), inCommune(where), fam.Sector, strings.ToLower(fam.Label), fam.Hint)
		if _, err := tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) VALUES ($1, 'random', $2, 0, $3)`, b.id, text, now); err != nil {
			return 0, err
		}
	}
	// Ordinary players now: the code kept in their browser no longer makes them testers again.
	if _, err := tx.Exec(ctx, `UPDATE users SET tester = false, tester_off = true WHERE tester OR id IN (SELECT user_id FROM sims WHERE id = ANY($1))`, ids(all)); err != nil {
		return 0, err
	}
	return len(all), tx.Commit(ctx)
}
