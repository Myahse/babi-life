package sims

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Kinéo (game/cinema.go) in the app: the programme of a cinema for a day,
// the seats of a session (the town's, the same for everyone, and those
// players bought), the tickets bought, and a ticket shown at the door: the
// Sim goes in and watches the film from its seat. Tickets are on sale for
// the week ahead, until twenty minutes into the film; the doors open
// three quarters of an hour before.

const (
	ticketEarly = 45
	ticketLate  = 20
	maxSeats    = 6
)

var (
	errNoCinema  = errors.New("cinéma inconnu")
	errNoSession = errors.New("cette séance n'existe pas")
	errSeatTaken = errors.New("une des places vient d'être prise : choisis-en une autre")
	errSeats     = fmt.Errorf("choisis de 1 à %d places", maxSeats)
)

// CinemaTicket: a ticket as the app shows it.
type CinemaTicket struct {
	ID         int64    `json:"id"`
	Cinema     string   `json:"cinema"`
	CinemaName string   `json:"cinemaName"`
	Salle      int      `json:"salle"`
	SalleName  string   `json:"salleName"`
	Film       string   `json:"film"`
	Title      string   `json:"title"`
	At         int64    `json:"at"`
	Seats      []string `json:"seats"`
	Price      int      `json:"price"`
	Code       string   `json:"code"`
	Used       bool     `json:"used"`
	VIP        bool     `json:"vip,omitempty"`
}

// sold: the seats players bought for the sessions of a cinema between two game minutes, by screen and start.
func sold(ctx context.Context, q interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, cinema string, from, to int64) (map[[2]int64][]string, error) {
	rows, err := q.Query(ctx, `SELECT salle, starts, seats FROM cinema_tickets WHERE cinema = $1 AND starts >= $2 AND starts < $3`, cinema, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[[2]int64][]string{}
	for rows.Next() {
		var salle int
		var at int64
		var seats []string
		if err := rows.Scan(&salle, &at, &seats); err != nil {
			return nil, err
		}
		k := [2]int64{int64(salle), at}
		out[k] = append(out[k], seats...)
	}
	return out, rows.Err()
}

// taken: every seat of a session no longer free.
func taken(cinema string, sh game.Showing, s game.Salle, bought []string) []string {
	out := slices.Clone(bought)
	for r := 0; r < s.Rows; r++ {
		for c := 0; c < s.Cols; c++ {
			if game.SeatTaken(cinema, sh, r, c, s) {
				out = append(out, game.SeatName(r, c))
			}
		}
	}
	return out
}

// cinemaProgram: a cinema's sessions on a day (GET /cinema/{cinema}/program?day=, the game day; today by default).
func (h *Handler) cinemaProgram(w http.ResponseWriter, r *http.Request) {
	c, ok := game.Cinemas[chi.URLParam(r, "cinema")]
	if !ok {
		httpx.Error(w, http.StatusNotFound, errNoCinema.Error())
		return
	}
	now := game.MinuteOf(time.Now())
	today := now / 1440
	day := today
	if d, err := strconv.ParseInt(r.URL.Query().Get("day"), 10, 64); err == nil && d >= today && d <= today+6 {
		day = d
	}
	bought, err := sold(r.Context(), h.DB, c.ID, day*1440, (day+1)*1440)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	type session struct {
		game.Showing
		Left int `json:"left"`
	}
	out := []session{}
	for _, sh := range game.Program(c.ID, day) {
		// Over (twenty minutes in, no more selling): not in the list.
		if sh.At < now-ticketLate {
			continue
		}
		s, _ := game.FindSalle(c.ID, sh.Salle)
		out = append(out, session{sh, s.Rows*s.Cols - len(taken(c.ID, sh, s, bought[[2]int64{int64(sh.Salle), sh.At}]))})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"cinema": c, "day": day, "today": today, "now": now, "films": game.OnThisWeek(day), "sessions": out})
}

// cinemaSeats: the plan of a session's screen and the seats taken (GET /cinema/{cinema}/seats?salle=&at=).
func (h *Handler) cinemaSeats(w http.ResponseWriter, r *http.Request) {
	cinema := chi.URLParam(r, "cinema")
	salle, _ := strconv.Atoi(r.URL.Query().Get("salle"))
	at, _ := strconv.ParseInt(r.URL.Query().Get("at"), 10, 64)
	sh, ok := game.FindShowing(cinema, salle, at)
	if !ok {
		httpx.Error(w, http.StatusNotFound, errNoSession.Error())
		return
	}
	s, _ := game.FindSalle(cinema, salle)
	bought, err := sold(r.Context(), h.DB, cinema, at, at+1)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	f, _ := game.FindFilm(sh.Film)
	httpx.JSON(w, http.StatusOK, map[string]any{"salle": s, "session": sh, "film": f, "taken": taken(cinema, sh, s, bought[[2]int64{int64(salle), at}])})
}

// cinemaBuy: tickets for a session, paid from the Sim's money (POST /sims/{id}/cinema/tickets).
func (h *Handler) cinemaBuy(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Cinema string   `json:"cinema"`
		Salle  int      `json:"salle"`
		At     int64    `json:"at"`
		Seats  []string `json:"seats"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := needApp(s, "kineo"); err != nil {
			return game.Outcome{}, nil, err
		}
		c, ok := game.Cinemas[req.Cinema]
		if !ok {
			return game.Outcome{}, nil, errNoCinema
		}
		sh, ok := game.FindShowing(c.ID, req.Salle, req.At)
		now := game.MinuteOf(time.Now())
		if !ok || sh.At < now-ticketLate || sh.At > now+7*1440 {
			return game.Outcome{}, nil, errNoSession
		}
		salle, _ := game.FindSalle(c.ID, req.Salle)
		if len(req.Seats) == 0 || len(req.Seats) > maxSeats {
			return game.Outcome{}, nil, errSeats
		}
		for i, seat := range req.Seats {
			if _, _, ok := game.ParseSeat(salle, seat); !ok || slices.Contains(req.Seats[:i], seat) {
				return game.Outcome{}, nil, errors.New("place invalide")
			}
		}
		// One buyer at a time for a session: the seats checked and taken together.
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, fmt.Sprintf("kineo/%s/%d/%d", c.ID, sh.Salle, sh.At)); err != nil {
			return game.Outcome{}, nil, err
		}
		bought, err := sold(ctx, tx, c.ID, sh.At, sh.At+1)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		gone := taken(c.ID, sh, salle, bought[[2]int64{int64(sh.Salle), sh.At}])
		for _, seat := range req.Seats {
			if slices.Contains(gone, seat) {
				return game.Outcome{}, nil, errSeatTaken
			}
		}
		total := sh.Price * len(req.Seats)
		if s.Money < total {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		s.Money -= total
		code := ticketCode()
		if _, err := tx.Exec(ctx, `INSERT INTO cinema_tickets (sim_id, cinema, salle, film, starts, seats, price, code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			s.ID, c.ID, sh.Salle, sh.Film, sh.At, req.Seats, total, code); err != nil {
			return game.Outcome{}, nil, err
		}
		f, _ := game.FindFilm(sh.Film)
		places := "place " + req.Seats[0]
		if len(req.Seats) > 1 {
			places = fmt.Sprintf("%d places (%s)", len(req.Seats), joinSeats(req.Seats))
		}
		text := fmt.Sprintf("Billet Kinéo : « %s », %s, %s à %s, %s.", f.Title, salle.Name, dayName(sh.At, now), clockOf(sh.At), places)
		return game.Outcome{Text: text, Money: -total}, []Event{{Kind: "kineo", Text: text, Money: -total, GameTime: s.GameMinutes}}, nil
	})
}

// cinemaTickets: the Sim's tickets, coming and just used (GET /sims/{id}/cinema/tickets).
func (h *Handler) cinemaTickets(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	now := game.MinuteOf(time.Now())
	rows, err := h.DB.Query(r.Context(), `SELECT id, cinema, salle, film, starts, seats, price, code, used FROM cinema_tickets WHERE sim_id = $1 AND starts > $2 ORDER BY starts LIMIT 20`, id, now-4*60)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	out := []CinemaTicket{}
	for rows.Next() {
		var t CinemaTicket
		if err := rows.Scan(&t.ID, &t.Cinema, &t.Salle, &t.Film, &t.At, &t.Seats, &t.Price, &t.Code, &t.Used); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		s, _ := game.FindSalle(t.Cinema, t.Salle)
		f, _ := game.FindFilm(t.Film)
		t.CinemaName, t.SalleName, t.VIP, t.Title = game.Cinemas[t.Cinema].Name, s.Name, s.VIP, f.Title
		out = append(out, t)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"tickets": out, "now": now})
}

// cinemaUse: the ticket shown at the door: the Sim goes in and sits for the film (POST /sims/{id}/cinema/tickets/{ticket}/use).
func (h *Handler) cinemaUse(w http.ResponseWriter, r *http.Request) {
	ticket, err := strconv.ParseInt(chi.URLParam(r, "ticket"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		var t CinemaTicket
		err := tx.QueryRow(ctx, `SELECT cinema, salle, film, starts, seats, used FROM cinema_tickets WHERE id = $1 AND sim_id = $2 FOR UPDATE`, ticket, s.ID).
			Scan(&t.Cinema, &t.Salle, &t.Film, &t.At, &t.Seats, &t.Used)
		if errors.Is(err, pgx.ErrNoRows) {
			return game.Outcome{}, nil, errors.New("billet introuvable")
		}
		if err != nil {
			return game.Outcome{}, nil, err
		}
		now := game.MinuteOf(time.Now())
		switch {
		case t.Used:
			return game.Outcome{}, nil, errors.New("ce billet a déjà servi")
		case now < t.At-ticketEarly:
			return game.Outcome{}, nil, fmt.Errorf("les portes ouvrent à %s", clockOf(t.At-ticketEarly))
		case now > t.At+ticketLate:
			return game.Outcome{}, nil, errors.New("trop tard : le film a commencé depuis plus de vingt minutes")
		}
		city, cm, place, ok := world.FindPlace(t.Cinema)
		if !ok {
			return game.Outcome{}, nil, errNoCinema
		}
		if city.ID != s.City || cm.ID != s.Commune {
			return game.Outcome{}, nil, fmt.Errorf("va d'abord %s", inCommune(cm.Name))
		}
		f, _ := game.FindFilm(t.Film)
		salle, _ := game.FindSalle(t.Cinema, t.Salle)
		// The film from the Sim's seat (its length, as every activity's, shortened by the game's clock).
		it := game.Interaction{ID: "seance", Label: fmt.Sprintf("« %s », %s", f.Title, salle.Name), Icon: "clapperboard", Minutes: int64(f.Minutes), Effect: game.Needs{Fun: 45, Social: 5, Energy: -5}}
		if salle.VIP {
			it.Effect = game.Needs{Fun: 55, Social: 5, Energy: 5}
		}
		if err := s.start(it, place.ID, place.Kind, place.Name, game.Kinds["cinema"].Events, ""); err != nil {
			return game.Outcome{}, nil, err
		}
		s.Activity.Seance = &game.Seance{Film: f.ID, Salle: salle.N, Seats: t.Seats, VIP: salle.VIP}
		if _, err := tx.Exec(ctx, `UPDATE cinema_tickets SET used = true WHERE id = $1`, ticket); err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: fmt.Sprintf("Billet scanné : %s, place %s. « %s » va commencer.", salle.Name, t.Seats[0], f.Title)}, nil, nil
	})
}

// ticketCode: the code under the QR, as on a real ticket.
func ticketCode() string {
	const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = letters[rand.IntN(len(letters))]
	}
	return "KN-" + string(b)
}

func joinSeats(seats []string) string {
	out := ""
	for i, s := range seats {
		if i > 0 {
			out += ", "
		}
		out += s
	}
	return out
}

// clockOf: « 21 h 00 » for a game minute.
func clockOf(m int64) string { return fmt.Sprintf("%d h %02d", (m%1440)/60, m%60) }

// dayName: « aujourd'hui », « demain » or the day of the week, for a game minute.
func dayName(m, now int64) string {
	switch m/1440 - now/1440 {
	case 0:
		return "aujourd'hui"
	case 1:
		return "demain"
	}
	return [...]string{"lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"}[(m/1440)%7]
}
