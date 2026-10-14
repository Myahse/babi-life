// Package sims stores players' Sims and exposes the actions they can take.
package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
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

// HappeningPlaceID is whatever is going on in the Sim's commune right now.
const HappeningPlaceID = "happening"

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
	// Per-part colours; empty means the outfit's own colour.
	BottomColor    string `json:"bottomColor,omitempty"`
	ShoeColor      string `json:"shoeColor,omitempty"`
	AccessoryColor string `json:"accessoryColor,omitempty"`
	// Bumps and bruises: none, pansement, griffures, genou, bagarre.
	Marks string `json:"marks,omitempty"`
}

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// Heights the creator allows, in metres, and the model's height at scale 1.
const (
	MinHeight = 1.40
	MaxHeight = 2.50
)

func baseHeight(gender string) float64 {
	if gender == "homme" {
		return 1.76
	}
	return 1.65
}

func (l Look) validate(gender string) error {
	if m := l.Height * baseHeight(gender); l.Height != 0 && (m < MinHeight-0.005 || m > MaxHeight+0.005) {
		return errors.New("taille invalide : entre 1,40 m et 2,50 m")
	}
	for _, c := range []string{l.Skin, l.HairColor, l.OutfitColor, l.Eyes, l.BottomColor, l.ShoeColor, l.AccessoryColor} {
		if c != "" && !hexColor.MatchString(c) {
			return errors.New("couleur invalide")
		}
	}
	return nil
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
	// Activity is what the Sim is busy with right now; nil when free.
	Activity *game.Activity `json:"activity"`
	// Apps installed on the phone (world.PhoneApps).
	Apps []string `json:"apps"`
	// BornAt: game minute of birth (0 = an adult from before births).
	BornAt int64 `json:"bornAt"`
	// Family the Sim was born into (game.Families); "" for older Sims.
	Family string `json:"family"`
	// People the Sim knows; the street gang ("", invited, member, left); arrests.
	Friends   []game.Friend `json:"friends"`
	Gang      string        `json:"gang"`
	Record    int           `json:"record"`
	CreatedAt time.Time     `json:"createdAt"`
	lastTick  time.Time
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
	r.Post("/sims/{id}/stop", h.stopActivity)
	r.Post("/sims/{id}/apps", h.apps)
	r.Post("/sims/{id}/send", h.send)
	r.Post("/sims/{id}/order", h.order)
	r.Post("/sims/{id}/friend", h.friend)
	r.Post("/sims/{id}/gang", h.gang)
}

const simColumns = `id, first_name, last_name, gender, look, traits, aspiration,
	home_city, home_commune, city, commune, needs, money, game_minutes,
	origin, housing, loan, rent_arrears, career, career_level, performance, activity, apps, born_at, family, friends, gang, record, created_at, last_tick`

func scanSim(row pgx.Row) (Sim, error) {
	var s Sim
	err := row.Scan(&s.ID, &s.FirstName, &s.LastName, &s.Gender, &s.Look, &s.Traits, &s.Aspiration,
		&s.HomeCity, &s.HomeCommune, &s.City, &s.Commune, &s.Needs, &s.Money, &s.GameMinutes,
		&s.Origin, &s.Housing, &s.Loan, &s.RentArrears, &s.Career, &s.CareerLevel, &s.Performance, &s.Activity, &s.Apps, &s.BornAt, &s.Family, &s.Friends, &s.Gang, &s.Record, &s.CreatedAt, &s.lastTick)
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
		out[i].advance(now, newRand()) // preview only; saved on the next request for that Sim
	}
	httpx.JSON(w, http.StatusOK, out)
}

type createRequest struct {
	FirstName  string   `json:"firstName"`
	LastName   string   `json:"lastName"`
	Gender     string   `json:"gender"`
	Look       Look     `json:"look"`
	Traits     []string `json:"traits"`
	Aspiration string   `json:"aspiration"`
	// Ignored: the family a Sim is born into decides where they grow up.
	HomeCity    string `json:"homeCity,omitempty"`
	HomeCommune string `json:"homeCommune,omitempty"`
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
	case req.Look.validate(req.Gender) != nil:
		return req.Look.validate(req.Gender)
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
	// Like in real life, nobody picks where they start: a baby, born into a
	// family drawn at random, somewhere in Abidjan.
	rng := newRand()
	fam := game.BornInto(rng)
	// Any commune: each has its villas and its precarious quarters.
	abj, _ := world.FindCity("abidjan")
	commune := abj.Communes[rng.IntN(len(abj.Communes))].ID
	now := game.MinuteOf(time.Now())
	s, err := scanSim(h.DB.QueryRow(r.Context(), `
		INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration,
		                  home_city, home_commune, city, commune, money, needs, game_minutes,
		                  origin, housing, loan, born_at, family, apps)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'abidjan', $8, 'abidjan', $8, 0, $9, $10, '', $11, 0, $10, $12, '{}')
		RETURNING `+simColumns,
		auth.UserID(r.Context()), req.FirstName, req.LastName, req.Gender, req.Look, req.Traits, req.Aspiration,
		commune, game.FreshNeeds(), now, fam.Housing, fam.ID,
	))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create sim")
		return
	}
	city, _ := world.FindCity(s.HomeCity)
	cm, _ := city.Commune(s.HomeCommune)
	_ = insertEvent(r.Context(), h.DB, s.ID, "random", fmt.Sprintf("%s est né·e à %s, dans %s, d'une famille %s. %s", s.FirstName, cm.Name, fam.Sector, strings.ToLower(fam.Label), fam.Hint), 0, s.GameMinutes)
	httpx.JSON(w, http.StatusCreated, s)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	// Reading a Sim lets real time pass for it, so it is saved like an action.
	h.mutate(w, r, nil)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	tag, err := h.DB.Exec(r.Context(), `DELETE FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context()))
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// actionResult is returned by every read and action on a Sim.
type actionResult struct {
	Sim     Sim          `json:"sim"`
	Outcome game.Outcome `json:"outcome"`
	Journal []Event      `json:"journal"`
	// Fresh are the journal lines produced by this request: activities that
	// ended, surprises, Saturday bills. The client announces them.
	Fresh []Event `json:"fresh"`
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
		if req.PlaceID == HappeningPlaceID {
			h, _, ok := game.HappeningAt(s.City, s.Commune, s.GameMinutes)
			if !ok || h.Join == nil || req.InteractionID != game.JoinHappeningID {
				return game.Outcome{}, nil, errors.New("c'est fini, il n'y a plus rien ici")
			}
			kind = h.Kind()
			kind.Interactions = []game.Interaction{*h.Join}
		} else if home {
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
			if !c.WorksAt(kind.ID) {
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

		// Old enough? Then: residents only, enough money, the right trait or job.
		if err := it.AllowedFor(s.stage().ID); err != nil {
			return game.Outcome{}, nil, err
		}
		// Who may do it: residents only, enough money, the right trait or job.
		if err := it.Requires.Check(game.Who{Resident: s.City == s.HomeCity && s.Commune == s.HomeCommune, Money: s.Money, Traits: s.Traits, Career: s.Career}); err != nil {
			return game.Outcome{}, nil, err
		}

		placeName := kind.Label
		switch {
		case home:
			placeName = "Chez toi"
		case req.PlaceID == HappeningPlaceID:
			placeName = kind.Label
		default:
			if _, _, place, ok := world.FindPlace(req.PlaceID); ok {
				placeName = place.Name
			}
		}
		if err := s.start(it, req.PlaceID, kind.ID, placeName, kind.Events, job.ID); err != nil {
			return game.Outcome{}, nil, err
		}
		s.restyle(it.ID)
		text := fmt.Sprintf("%s : %s (%s)", s.FirstName, it.Label, humanMinutes(it.Minutes))
		return game.Outcome{Text: text, Money: -max(it.Cost, 0)}, nil, nil
	})
}

// restyle: a visit to the barbier or the salon changes the Sim's hair.
func (s *Sim) restyle(interaction string) {
	h, ok := game.Hairdos[interaction]
	if !ok {
		return
	}
	if h.Hair != "" {
		s.Look.Hair = h.Hair
	}
	if h.Beard != "" {
		s.Look.Beard = h.Beard
	}
}

func humanMinutes(m int64) string {
	switch {
	case m < 60:
		return fmt.Sprintf("%d min", m)
	case m%60 == 0:
		return fmt.Sprintf("%d h", m/60)
	default:
		return fmt.Sprintf("%d h %02d", m/60, m%60)
	}
}

func (h *Handler) stopActivity(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		ev, err := s.stop()
		if err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: ev.Text, Money: ev.Money}, []Event{ev}, nil
	})
}

func (h *Handler) travel(w http.ResponseWriter, r *http.Request) {
	var req struct {
		City    string `json:"city"`
		Commune string `json:"commune"`
		// App: "woro", "compteur" or a ride app ("gnango", "idrive"); empty = the
		// usual street taxi, or the car between cities.
		App   string `json:"app,omitempty"`
		Offer int    `json:"offer,omitempty"`
		Party int    `json:"party,omitempty"` // the Sim plus friends riding along
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
		if app, ok := world.FindRideApp(req.App); ok && !s.hasApp(app.ID) {
			return game.Outcome{}, nil, fmt.Errorf("installe d'abord %s depuis le Store", app.Name)
		}
		if err := s.leaveWith(toCity, toCommune, Ride{App: req.App, Offer: req.Offer, Party: req.Party}, newRand()); err != nil {
			return game.Outcome{}, nil, err
		}
		t := s.Activity.Trip
		text := fmt.Sprintf("%s (%s)", t.Label, humanMinutes(s.Activity.Interaction.Minutes))
		if t.Incident != "" {
			text += " · " + t.Incident
		}
		return game.Outcome{Text: text, Money: -t.Fare}, nil, nil
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
	// Real time passes first, so the action sees the real state.
	fresh := s.advance(time.Now(), newRand())
	var out game.Outcome
	if fn != nil {
		var events []Event
		var err error
		if out, events, err = fn(&s); err != nil {
			httpx.Error(w, http.StatusUnprocessableEntity, err.Error())
			return
		}
		fresh = append(fresh, events...)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE sims SET city = $2, commune = $3, needs = $4, money = $5, game_minutes = $6, last_tick = $7,
		       home_city = $8, home_commune = $9, housing = $10, loan = $11, rent_arrears = $12,
		       career = $13, career_level = $14, performance = $15, activity = $16, apps = $17,
		       friends = $18, gang = $19, record = $20, look = $21
		WHERE id = $1`, s.ID, s.City, s.Commune, s.Needs, s.Money, s.GameMinutes, s.lastTick,
		s.HomeCity, s.HomeCommune, s.Housing, s.Loan, s.RentArrears, s.Career, s.CareerLevel, s.Performance, s.Activity, s.Apps,
		friendsOrEmpty(s.Friends), s.Gang, s.Record, s.Look); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save sim")
		return
	}
	for i, ev := range fresh {
		if err := tx.QueryRow(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
			s.ID, ev.Kind, ev.Text, ev.Money, ev.GameTime).Scan(&fresh[i].ID, &fresh[i].At); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not save journal")
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save sim")
		return
	}

	journal, _ := h.journal(ctx, s.ID)
	if fresh == nil {
		fresh = []Event{}
	}
	httpx.JSON(w, http.StatusOK, actionResult{Sim: s, Outcome: out, Journal: journal, Fresh: fresh})
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
