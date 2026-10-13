// Package sims stores players' Sims and exposes the actions they can take.
package sims

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// HomePlaceID is the virtual "Chez toi" place in the Sim's home commune.
const HomePlaceID = "home"

type Look struct {
	Skin        string `json:"skin"`
	Hair        string `json:"hair"`
	HairColor   string `json:"hairColor"`
	Outfit      string `json:"outfit"`
	OutfitColor string `json:"outfitColor"`
	// Added with the new creator; older Sims fall back to defaults in the client.
	Body      string  `json:"body,omitempty"`
	Height    float64 `json:"height,omitempty"`
	Eyes      string  `json:"eyes,omitempty"`
	Beard     string  `json:"beard,omitempty"`
	Accessory string  `json:"accessory,omitempty"`
	Pattern   string  `json:"pattern,omitempty"`
}

type Sim struct {
	ID          string     `json:"id"`
	FirstName   string     `json:"firstName"`
	LastName    string     `json:"lastName"`
	Gender      string     `json:"gender"`
	Look        Look       `json:"look"`
	Traits      []string   `json:"traits"`
	Aspiration  string     `json:"aspiration"`
	HomeCity    string     `json:"homeCity"`
	HomeCommune string     `json:"homeCommune"`
	City        string     `json:"city"`
	Commune     string     `json:"commune"`
	Needs       game.Needs `json:"needs"`
	Money       int        `json:"money"`
	GameMinutes int64      `json:"gameMinutes"`
	Origin      string     `json:"origin"`
	Housing     string     `json:"housing"`
	Loan        int        `json:"loan"`
	RentArrears int        `json:"rentArrears"`
	Career      string     `json:"career"`
	CareerLevel int        `json:"careerLevel"`
	Performance int        `json:"performance"`
	CreatedAt   time.Time  `json:"createdAt"`
	lastTick    time.Time
}

type Event struct {
	ID       int64     `json:"id"`
	Kind     string    `json:"kind"`
	Text     string    `json:"text"`
	Money    int       `json:"money"`
	GameTime int64     `json:"gameTime"`
	At       time.Time `json:"at"`
}

func (s *Sim) state() game.State {
	return game.State{Needs: s.Needs, Money: s.Money, GameMinutes: s.GameMinutes}
}

func (s *Sim) setState(st game.State) {
	s.Needs, s.Money, s.GameMinutes = st.Needs, st.Money, st.GameMinutes
}

// tick lets game time pass since the last time the Sim was touched.
func (s *Sim) tick(now time.Time) {
	mins := game.Elapsed(s.lastTick, now)
	s.Needs = game.Decay(s.Needs, mins)
	s.GameMinutes += mins
	s.lastTick = now
}

// settle charges rent and loan installments for every Saturday passed since
// the given game minute, and returns the journal lines.
func (s *Sim) settle(from int64) []Event {
	var events []Event
	l := game.Ledger{Money: s.Money, Loan: s.Loan, RentArrears: s.RentArrears, Housing: s.Housing}
	for range game.Saturdays(from, s.GameMinutes) {
		var charges []game.Charge
		l, charges = game.WeekEnd(l)
		for _, c := range charges {
			events = append(events, Event{Kind: "bill", Text: c.Text, Money: c.Money, GameTime: s.GameMinutes})
		}
	}
	s.Money, s.Loan, s.RentArrears, s.Housing = l.Money, l.Loan, l.RentArrears, l.Housing
	return events
}

// preview lets time pass for display only; mutate persists it on the next action.
func (s *Sim) preview(now time.Time) {
	from := s.GameMinutes
	s.tick(now)
	s.settle(from)
}

func (s *Sim) housing() game.Housing {
	h, _ := game.FindHousing(s.Housing)
	return h
}

type Handler struct {
	DB *pgxpool.Pool
}

func (h *Handler) Routes(r chi.Router) {
	r.Get("/sims", h.list)
	r.Post("/sims", h.create)
	r.Get("/sims/{id}", h.get)
	r.Delete("/sims/{id}", h.delete)
	r.Post("/sims/{id}/interact", h.interact)
	r.Post("/sims/{id}/travel", h.travel)
	r.Post("/sims/{id}/career", h.career)
	r.Post("/sims/{id}/move", h.move)
	r.Post("/sims/{id}/repay", h.repay)
}

const simColumns = `id, first_name, last_name, gender, look, traits, aspiration,
	home_city, home_commune, city, commune, needs, money, game_minutes,
	origin, housing, loan, rent_arrears, career, career_level, performance, created_at, last_tick`

func scanSim(row pgx.Row) (Sim, error) {
	var s Sim
	err := row.Scan(&s.ID, &s.FirstName, &s.LastName, &s.Gender, &s.Look, &s.Traits, &s.Aspiration,
		&s.HomeCity, &s.HomeCommune, &s.City, &s.Commune, &s.Needs, &s.Money, &s.GameMinutes,
		&s.Origin, &s.Housing, &s.Loan, &s.RentArrears, &s.Career, &s.CareerLevel, &s.Performance, &s.CreatedAt, &s.lastTick)
	return s, err
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(),
		`SELECT `+simColumns+` FROM sims WHERE user_id = $1 ORDER BY created_at`, auth.UserID(r.Context()))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load sims")
		return
	}
	out, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Sim, error) { return scanSim(row) })
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load sims")
		return
	}
	now := time.Now()
	for i := range out {
		out[i].preview(now)
	}
	httpx.JSON(w, http.StatusOK, out)
}

type createRequest struct {
	FirstName   string   `json:"firstName"`
	LastName    string   `json:"lastName"`
	Gender      string   `json:"gender"`
	Look        Look     `json:"look"`
	Traits      []string `json:"traits"`
	Aspiration  string   `json:"aspiration"`
	HomeCity    string   `json:"homeCity"`
	HomeCommune string   `json:"homeCommune"`
}

func (req *createRequest) validate() error {
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	switch {
	case req.FirstName == "" || len(req.FirstName) > 40:
		return errors.New("prénom invalide")
	case req.LastName == "" || len(req.LastName) > 40:
		return errors.New("nom invalide")
	case req.Gender != "femme" && req.Gender != "homme":
		return errors.New("genre invalide")
	case req.Look.Skin == "" || req.Look.Hair == "" || req.Look.Outfit == "":
		return errors.New("apparence incomplète")
	case req.Look.Height != 0 && (req.Look.Height < 0.85 || req.Look.Height > 1.15):
		return errors.New("taille invalide")
	case len(req.Traits) == 0 || len(req.Traits) > game.MaxTraits:
		return fmt.Errorf("choisis entre 1 et %d traits", game.MaxTraits)
	case !game.ValidOption(game.Aspirations, req.Aspiration):
		return errors.New("aspiration invalide")
	}
	seen := map[string]bool{}
	for _, t := range req.Traits {
		if !game.ValidOption(game.Traits, t) || seen[t] {
			return errors.New("trait invalide")
		}
		seen[t] = true
	}
	city, ok := world.FindCity(req.HomeCity)
	if !ok {
		return errors.New("ville inconnue")
	}
	if _, ok := city.Commune(req.HomeCommune); !ok {
		return errors.New("commune inconnue")
	}
	return nil
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if err := req.validate(); err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	// Like in real life, nobody picks where they start.
	origin := game.Origins[rand.IntN(len(game.Origins))]
	s, err := scanSim(h.DB.QueryRow(r.Context(), `
		INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration,
		                  home_city, home_commune, city, commune, money, needs, game_minutes,
		                  origin, housing, loan)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING `+simColumns,
		auth.UserID(r.Context()), req.FirstName, req.LastName, req.Gender, req.Look, req.Traits, req.Aspiration,
		req.HomeCity, req.HomeCommune, origin.Money, game.FreshNeeds(), game.StartMinute,
		origin.ID, origin.Housing, origin.Loan,
	))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create sim")
		return
	}
	city, _ := world.FindCity(s.HomeCity)
	cm, _ := city.Commune(s.HomeCommune)
	_ = insertEvent(r.Context(), h.DB, s.ID, "random", fmt.Sprintf("%s s'installe à %s, %s. Bienvenue !", s.FirstName, cm.Name, city.Name), 0, s.GameMinutes)
	if origin.Loan > 0 {
		_ = insertEvent(r.Context(), h.DB, s.ID, "bill", fmt.Sprintf("Microcrédit accordé. Tu dois %s, remboursés chaque samedi.", game.FCFA(origin.Loan)), 0, s.GameMinutes)
	}
	httpx.JSON(w, http.StatusCreated, s)
}

type simWithJournal struct {
	Sim
	Journal []Event `json:"journal"`
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	s, err := scanSim(h.DB.QueryRow(r.Context(),
		`SELECT `+simColumns+` FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	s.preview(time.Now())
	journal, err := h.journal(r.Context(), s.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load journal")
		return
	}
	httpx.JSON(w, http.StatusOK, simWithJournal{Sim: s, Journal: journal})
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	tag, err := h.DB.Exec(r.Context(), `DELETE FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context()))
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// actionResult is returned by interact and travel.
type actionResult struct {
	Sim     Sim          `json:"sim"`
	Outcome game.Outcome `json:"outcome"`
	Journal []Event      `json:"journal"`
}

func (h *Handler) interact(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PlaceID       string `json:"placeId"`
		InteractionID string `json:"interactionId"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}

	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		var kind game.PlaceKind
		home := req.PlaceID == HomePlaceID
		if home {
			if s.City != s.HomeCity || s.Commune != s.HomeCommune {
				return game.Outcome{}, nil, errors.New("rentre d'abord chez toi")
			}
			kind = game.Kinds["home"]
		} else {
			city, cm, place, ok := world.FindPlace(req.PlaceID)
			if !ok {
				return game.Outcome{}, nil, errors.New("lieu inconnu")
			}
			if city.ID != s.City || cm.ID != s.Commune {
				return game.Outcome{}, nil, fmt.Errorf("va d'abord à %s", cm.Name)
			}
			kind = game.Kinds[place.Kind]
		}
		var it game.Interaction
		var job game.Career
		if req.InteractionID == game.WorkInteractionID {
			c, ok := game.FindCareer(s.Career)
			if !ok {
				return game.Outcome{}, nil, errors.New("tu n'as pas de travail. Ouvre l'appli Boulot")
			}
			if c.Kind != kind.ID {
				return game.Outcome{}, nil, errors.New("ce n'est pas ton lieu de travail")
			}
			job, it = c, c.Shift(s.CareerLevel)
		} else {
			var ok bool
			if it, ok = kind.Interaction(req.InteractionID); !ok {
				return game.Outcome{}, nil, errors.New("action inconnue")
			}
			if home {
				it = s.housing().AtHome(it)
			}
		}

		before := s.GameMinutes
		mood := s.Needs.Mood()
		st, out, err := game.Perform(s.state(), kind, it, rand.New(rand.NewPCG(uint64(time.Now().UnixNano()), 0)))
		if err != nil {
			return game.Outcome{}, nil, err
		}
		s.setState(st)
		events := []Event{{Kind: "interaction", Text: out.Text, Money: out.Money, GameTime: before}}
		if job.ID != "" {
			if promo := s.work(job, mood); promo != "" {
				out.Promotion = promo
				events = append(events, Event{Kind: "career", Text: promo, GameTime: s.GameMinutes})
			}
		}
		if out.Random != nil {
			events = append(events, Event{Kind: "random", Text: out.Random.Text, Money: out.Random.Money, GameTime: s.GameMinutes})
		}
		return out, events, nil
	})
}

func (h *Handler) travel(w http.ResponseWriter, r *http.Request) {
	var req struct {
		City    string `json:"city"`
		Commune string `json:"commune"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	toCity, ok := world.FindCity(req.City)
	if !ok {
		httpx.Error(w, http.StatusUnprocessableEntity, "ville inconnue")
		return
	}
	toCommune, ok := toCity.Commune(req.Commune)
	if !ok {
		httpx.Error(w, http.StatusUnprocessableEntity, "commune inconnue")
		return
	}

	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		fromCity, _ := world.FindCity(s.City)
		fromCommune, _ := fromCity.Commune(s.Commune)
		minutes, fare := world.Trip(fromCity, fromCommune, toCity, toCommune)
		if minutes == 0 {
			return game.Outcome{}, nil, errors.New("tu y es déjà")
		}
		before := s.GameMinutes
		st, err := game.Travel(s.state(), minutes, fare)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		s.setState(st)
		s.City, s.Commune = toCity.ID, toCommune.ID

		how := "en woro-woro"
		if fromCity.ID != toCity.ID {
			how = "en car"
		}
		text := fmt.Sprintf("Trajet %s → %s %s", fromCommune.Name, toCommune.Name, how)
		if fromCity.ID != toCity.ID {
			text = fmt.Sprintf("Trajet %s → %s %s", fromCity.Name, toCity.Name, how)
		}
		out := game.Outcome{Text: text, Money: -fare}
		return out, []Event{{Kind: "travel", Text: text, Money: -fare, GameTime: before}}, nil
	})
}

// mutate loads the Sim under a row lock, lets time pass, applies fn and saves
// the result together with the journal entries it produced.
func (h *Handler) mutate(w http.ResponseWriter, r *http.Request, fn func(*Sim) (game.Outcome, []Event, error)) {
	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)

	s, err := scanSim(tx.QueryRow(ctx,
		`SELECT `+simColumns+` FROM sims WHERE id = $1 AND user_id = $2 FOR UPDATE`, chi.URLParam(r, "id"), auth.UserID(ctx)))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	from := s.GameMinutes
	s.tick(time.Now())
	// Saturdays that passed while the player was away are settled before the
	// action, so the action sees the real balance.
	bills := s.settle(from)

	from = s.GameMinutes
	out, events, err := fn(&s)
	if err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	after := s.settle(from)
	for _, b := range append(bills, after...) {
		out.Bills = append(out.Bills, game.Bill{Text: b.Text, Money: b.Money})
	}
	events = append(append(bills, events...), after...)

	if _, err := tx.Exec(ctx, `
		UPDATE sims SET city = $2, commune = $3, needs = $4, money = $5, game_minutes = $6, last_tick = $7,
		       home_city = $8, home_commune = $9, housing = $10, loan = $11, rent_arrears = $12,
		       career = $13, career_level = $14, performance = $15
		WHERE id = $1`, s.ID, s.City, s.Commune, s.Needs, s.Money, s.GameMinutes, s.lastTick,
		s.HomeCity, s.HomeCommune, s.Housing, s.Loan, s.RentArrears, s.Career, s.CareerLevel, s.Performance); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save sim")
		return
	}
	for _, ev := range events {
		if err := insertEvent(ctx, tx, s.ID, ev.Kind, ev.Text, ev.Money, ev.GameTime); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not save journal")
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save sim")
		return
	}

	journal, _ := h.journal(ctx, s.ID)
	httpx.JSON(w, http.StatusOK, actionResult{Sim: s, Outcome: out, Journal: journal})
}

type execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

func insertEvent(ctx context.Context, db execer, simID, kind, text string, money int, gameTime int64) error {
	_, err := db.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) VALUES ($1, $2, $3, $4, $5)`,
		simID, kind, text, money, gameTime)
	return err
}

func (h *Handler) journal(ctx context.Context, simID string) ([]Event, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT id, kind, text, money, game_time, created_at FROM sim_events
		WHERE sim_id = $1 ORDER BY id DESC LIMIT 30`, simID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Event, error) {
		var e Event
		err := row.Scan(&e.ID, &e.Kind, &e.Text, &e.Money, &e.GameTime, &e.At)
		return e, err
	})
}
