package politics

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The president's week (game/civic.go): the inaugural speech and an address
// a day, sent to every player; the week's two measures (prices down for
// everyone, sims/civic.go); the Fête de la Nation at the stadium; the
// citizens' rating, a vote a day, which weighs on the president's next
// campaign. And the campaign in the street: the candidate's tour of a
// commune's places, the militants called by the candidate (paid from the
// candidate's purse), the meeting at the stadium.

/* ---------- the week, for the app ---------- */

// Week: the president in office and what they did with it.
type Week struct {
	Election int64       `json:"election"`
	Sim      string      `json:"sim"`
	Name     string      `json:"name"`
	Acronym  string      `json:"acronym,omitempty"`
	Color    string      `json:"color,omitempty"`
	Until    time.Time   `json:"until"`
	Words    []Word      `json:"words"`
	Measures []string    `json:"measures"`
	Rating   Rating      `json:"rating"`
	Fete     *StateEvent `json:"fete,omitempty"`
}

type Word struct {
	ID   int64     `json:"id"`
	Kind string    `json:"kind"` // discours | adresse
	Text string    `json:"text"`
	At   time.Time `json:"at"`
}

type Rating struct {
	Avg   float64 `json:"avg"`
	Count int     `json:"count"`
	// Mine: the score given today by the one asking (0: not yet).
	Mine int `json:"mine"`
}

// StateEvent: the Fête de la Nation, or a candidate's meeting, at a stadium.
type StateEvent struct {
	ID       int64     `json:"id"`
	Kind     string    `json:"kind"` // fete | meeting
	Sim      string    `json:"sim"`
	Name     string    `json:"name"`
	Acronym  string    `json:"acronym,omitempty"`
	Color    string    `json:"color,omitempty"`
	Place    string    `json:"place"`
	StartsAt time.Time `json:"startsAt"`
	EndsAt   time.Time `json:"endsAt"`
	Guests   int       `json:"guests"`
}

// MilitCall: a candidate's call to the party's militants.
type MilitCall struct {
	ID        int64  `json:"id"`
	Election  int64  `json:"election"`
	Candidate string `json:"candidate"`
	Name      string `json:"name"`
	Commune   string `json:"commune"`
	Pay       int    `json:"pay"`
	Slots     int    `json:"slots"`
	Taken     int    `json:"taken"`
	Done      bool   `json:"done,omitempty"`
}

// week: the president in office, with their words, measures, rating and fête; nil if none.
func (h *Handler) week(ctx context.Context, user string) (*Week, error) {
	var w Week
	err := h.DB.QueryRow(ctx, `SELECT o.election_id, o.sim_id, s.first_name || ' ' || s.last_name, COALESCE(p.acronym, ''), COALESCE(p.color, ''), o.until
		FROM offices o JOIN sims s ON s.id = o.sim_id LEFT JOIN party_members m ON m.sim_id = s.id LEFT JOIN parties p ON p.id = m.party_id
		WHERE o.office = 'president' AND o.until > now() AND o.election_id IS NOT NULL`).Scan(&w.Election, &w.Sim, &w.Name, &w.Acronym, &w.Color, &w.Until)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	w.Words, w.Measures = []Word{}, []string{}
	if rows, err := h.DB.Query(ctx, `SELECT id, kind, text, created_at FROM president_words WHERE election_id = $1 AND NOT hidden ORDER BY created_at DESC LIMIT 10`, w.Election); err == nil {
		for rows.Next() {
			var x Word
			if rows.Scan(&x.ID, &x.Kind, &x.Text, &x.At) == nil {
				w.Words = append(w.Words, x)
			}
		}
		rows.Close()
	}
	if rows, err := h.DB.Query(ctx, `SELECT measure FROM measures WHERE election_id = $1 ORDER BY created_at`, w.Election); err == nil {
		for rows.Next() {
			var m string
			if rows.Scan(&m) == nil {
				w.Measures = append(w.Measures, m)
			}
		}
		rows.Close()
	}
	_ = h.DB.QueryRow(ctx, `SELECT COALESCE(avg(score), 0), count(*), COALESCE(max(score) FILTER (WHERE user_id = $2 AND day = CURRENT_DATE), 0) FROM president_ratings WHERE election_id = $1`, w.Election, user).Scan(&w.Rating.Avg, &w.Rating.Count, &w.Rating.Mine)
	if list, err := h.stateEvents(ctx, `e.kind = 'fete' AND e.election_id = $1`, w.Election); err == nil && len(list) > 0 {
		w.Fete = &list[0]
	}
	return &w, nil
}

const stateEventSQL = `SELECT e.id, e.kind, e.sim_id, s.first_name || ' ' || s.last_name, COALESCE(p.acronym, ''), COALESCE(p.color, ''), e.place_id, e.starts_at, e.ends_at,
		(SELECT count(*) FROM state_event_guests g WHERE g.event_id = e.id)
	FROM state_events e JOIN sims s ON s.id = e.sim_id LEFT JOIN party_members m ON m.sim_id = s.id LEFT JOIN parties p ON p.id = m.party_id WHERE `

// stateEvents: the stadium's big days matching a condition.
func (h *Handler) stateEvents(ctx context.Context, where string, args ...any) ([]StateEvent, error) {
	rows, err := h.DB.Query(ctx, stateEventSQL+where+` ORDER BY e.starts_at LIMIT 20`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []StateEvent{}
	for rows.Next() {
		var e StateEvent
		if err := rows.Scan(&e.ID, &e.Kind, &e.Sim, &e.Name, &e.Acronym, &e.Color, &e.Place, &e.StartsAt, &e.EndsAt, &e.Guests); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// events: GET /politics/events — the stadium's big days to come or going on.
func (h *Handler) events(w http.ResponseWriter, r *http.Request) {
	list, err := h.stateEvents(r.Context(), `e.ends_at > now()`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"events": list})
}

/* ---------- the president's words ---------- */

// presidentNow: the election of the Sim's presidency going on (the mandate), or an error to say.
func presidentNow(ctx context.Context, tx pgx.Tx, sim string) (int64, time.Time, error) {
	var election int64
	var until time.Time
	err := tx.QueryRow(ctx, `SELECT election_id, until FROM offices WHERE office = 'president' AND sim_id = $1 AND until > now() AND election_id IS NOT NULL`, sim).Scan(&election, &until)
	if err != nil {
		return 0, until, userError("Seul·e le·la président·e en exercice peut faire ça.")
	}
	return election, until, nil
}

// speak: POST /sims/{id}/politics/parole {kind, text} — the inaugural speech (once a week) or an address (once a day), to the whole nation.
func (h *Handler) speak(w http.ResponseWriter, r *http.Request) {
	var req struct{ Kind, Text string }
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	var msg push.Message
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		election, _, err := presidentNow(ctx, tx, s.ID)
		if err != nil {
			return nil, err
		}
		n := utf8.RuneCountInString(req.Text)
		var already bool
		var title, journal string
		switch req.Kind {
		case "discours":
			if n < 20 || n > 1500 {
				return nil, userError("Ton discours : de 20 à 1 500 lettres.")
			}
			_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM president_words WHERE election_id = $1 AND kind = 'discours')`, election).Scan(&already)
			if already {
				return nil, userError("Tu as déjà fait ton discours d'investiture : parle à la nation par une adresse.")
			}
			title, journal = "Discours du président·e "+s.First+" "+s.Last, "Discours d'investiture de "+s.First+" "+s.Last+" : « "+req.Text+" »"
		case "adresse":
			if n < 10 || n > 600 {
				return nil, userError("Ton adresse à la nation : de 10 à 600 lettres.")
			}
			_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM president_words WHERE election_id = $1 AND kind = 'adresse' AND created_at::date = CURRENT_DATE)`, election).Scan(&already)
			if already {
				return nil, userError("Une adresse à la nation par jour : reviens demain.")
			}
			title, journal = "Le·la président·e "+s.First+" s'adresse à la nation", "Adresse à la nation de "+s.First+" "+s.Last+" : « "+req.Text+" »"
		default:
			return nil, userError("discours ou adresse ?")
		}
		from, to, err := toNation(ctx, tx, journal)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO president_words (election_id, sim_id, kind, text, journal_from, journal_to) VALUES ($1, $2, $3, $4, $5, $6)`, election, s.ID, req.Kind, req.Text, from, to); err != nil {
			return nil, err
		}
		msg = push.Message{Title: title, Body: short(req.Text, 160), URL: "/jeu", Tag: "president-" + req.Kind}
		return map[string]any{"text": "La nation t'a entendu·e : tous les joueurs ont reçu tes mots."}, nil
	})
	if msg.Title != "" {
		h.Push.ToAll(msg)
	}
}

// toNation: a line in every Sim's journal.
// toNation: a line in every Sim's journal; from, to: the ids of those lines.
func toNation(ctx context.Context, tx pgx.Tx, text string) (from, to int64, err error) {
	err = tx.QueryRow(ctx, `WITH ins AS (INSERT INTO sim_events (sim_id, kind, text, money, game_time) SELECT id, 'politique', $1, 0, $2 FROM sims RETURNING id)
		SELECT COALESCE(min(id), 0), COALESCE(max(id), 0) FROM ins`, text, game.MinuteOf(time.Now())).Scan(&from, &to)
	return
}

// WordHideAt: reports from this many players take a speech or an address down, from
// the Présidence tab and from the journals (the notification sent then stays sent).
const WordHideAt = 5

// reportWord: POST /sims/{id}/politics/parole/{word}/signaler {reason} — a player
// flags the president's words; the team sees it with the other reports.
func (h *Handler) reportWord(w http.ResponseWriter, r *http.Request) {
	var req struct{ Reason string }
	if err := httpx.Decode(r, &req); err != nil || !slices.Contains(game.ReportReasons, req.Reason) {
		httpx.Error(w, http.StatusBadRequest, "Choisis pourquoi tu signales.")
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "word"), 10, 64)
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		var author, text string
		var from, to int64
		if err := tx.QueryRow(ctx, `SELECT sim_id, text, journal_from, journal_to FROM president_words WHERE id = $1 AND NOT hidden`, id).Scan(&author, &text, &from, &to); err != nil {
			return nil, userError("Ces mots ne sont plus là.")
		}
		if author == s.ID {
			return nil, userError("On ne signale pas ses propres mots.")
		}
		if _, err := tx.Exec(ctx, `INSERT INTO reports (reporter, reported, word_id, excerpt, reason) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`, s.ID, author, id, text, req.Reason); err != nil {
			return nil, err
		}
		// Players, not Sims: one account's Sims count once.
		var n int
		if err := tx.QueryRow(ctx, `SELECT count(DISTINCT s.user_id) FROM reports r JOIN sims s ON s.id = r.reporter WHERE r.word_id = $1`, id).Scan(&n); err != nil {
			return nil, err
		}
		if n < WordHideAt {
			return map[string]any{"text": "Merci. C'est signalé : l'équipe va regarder."}, nil
		}
		if _, err := tx.Exec(ctx, `UPDATE president_words SET hidden = true WHERE id = $1`, id); err != nil {
			return nil, err
		}
		if to > 0 {
			if _, err := tx.Exec(ctx, `DELETE FROM sim_events WHERE id BETWEEN $1 AND $2 AND kind = 'politique'`, from, to); err != nil {
				return nil, err
			}
		}
		return map[string]any{"text": "Merci. Assez de joueurs l'ont signalé : ces mots sont retirés.", "hidden": true}, nil
	})
}

// short: a text cut to n letters, with an ellipsis.
func short(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return strings.TrimSpace(string(r[:n-1])) + "…"
}

/* ---------- the measures ---------- */

// decree: POST /sims/{id}/politics/mesure {measure} — one of the week's measures, in force till the next results.
func (h *Handler) decree(w http.ResponseWriter, r *http.Request) {
	var req struct{ Measure string }
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	var msg push.Message
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		election, until, err := presidentNow(ctx, tx, s.ID)
		if err != nil {
			return nil, err
		}
		m, ok := game.FindMeasure(req.Measure)
		if !ok {
			return nil, userError("mesure inconnue")
		}
		var n int
		var dup bool
		_ = tx.QueryRow(ctx, `SELECT count(*), COALESCE(bool_or(measure = $2), false) FROM measures WHERE election_id = $1`, election, m.ID).Scan(&n, &dup)
		switch {
		case dup:
			return nil, userError("Cette mesure est déjà en vigueur.")
		case n >= game.MeasuresAMandate:
			return nil, userError(fmt.Sprintf("%d mesures par semaine : les tiennes sont prises.", game.MeasuresAMandate))
		}
		if _, err := tx.Exec(ctx, `INSERT INTO measures (election_id, measure, until) VALUES ($1, $2, $3)`, election, m.ID, until); err != nil {
			return nil, err
		}
		text := fmt.Sprintf("Le·la président·e %s %s décrète : %s. %s Jusqu'à lundi 9 h.", s.First, s.Last, m.Label, m.About)
		if _, _, err := toNation(ctx, tx, text); err != nil {
			return nil, err
		}
		msg = push.Message{Title: "Mesure : " + m.Label, Body: m.About + " Jusqu'à lundi 9 h.", URL: "/jeu", Tag: "mesure-" + m.ID}
		return map[string]any{"text": m.Label + " : c'est décrété, pour toute la semaine."}, nil
	})
	if msg.Title != "" {
		h.Push.ToAll(msg)
	}
}

// ActiveMeasures: the measures in force now (sims/civic.go applies them to the prices).
func ActiveMeasures(ctx context.Context, q interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT measure FROM measures WHERE until > now()`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var m string
		if err := rows.Scan(&m); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

/* ---------- the rating ---------- */

// rate: POST /sims/{id}/politics/note {score} — the citizen's word on the president, 1 to 5 stars, once a day.
func (h *Handler) rate(w http.ResponseWriter, r *http.Request) {
	var req struct{ Score int }
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		if !s.Adult {
			return nil, userError("On note le·la président·e à partir de 18 ans.")
		}
		if req.Score < 1 || req.Score > 5 {
			return nil, userError("De 1 à 5 étoiles.")
		}
		var election int64
		var president, owner string
		err := tx.QueryRow(ctx, `SELECT o.election_id, o.sim_id, s.user_id FROM offices o JOIN sims s ON s.id = o.sim_id WHERE o.office = 'president' AND o.until > now() AND o.election_id IS NOT NULL`).Scan(&election, &president, &owner)
		if err != nil {
			return nil, userError("Pas de président·e cette semaine.")
		}
		user := auth.UserID(ctx)
		if owner == user {
			return nil, userError("On ne se note pas soi-même.")
		}
		tag, err := tx.Exec(ctx, `INSERT INTO president_ratings (election_id, user_id, day, score) VALUES ($1, $2, CURRENT_DATE, $3) ON CONFLICT DO NOTHING`, election, user, req.Score)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, userError("Tu as déjà noté le·la président·e aujourd'hui : reviens demain.")
		}
		return map[string]any{"text": "Ta note est comptée. Elle pèsera si le·la président·e se représente."}, nil
	})
}

/* ---------- the stadium's big days ---------- */

// stadiumFree: a stadium, free from start to end (no other big day there), or why not.
func stadiumFree(ctx context.Context, tx pgx.Tx, place string, start, end time.Time) error {
	if _, _, p, ok := world.FindPlace(place); !ok || p.Kind != game.StadiumKind {
		return userError("Choisis un stade.")
	}
	var busy bool
	_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM state_events WHERE place_id = $1 AND starts_at < $3 AND ends_at > $2)`, place, start, end).Scan(&busy)
	if busy {
		return userError("Le stade est déjà pris à cette heure-là : choisis-en une autre.")
	}
	return nil
}

// fete: POST /sims/{id}/politics/fete {place, at} — the Fête de la Nation, once a week, free for all.
func (h *Handler) fete(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Place string    `json:"place"`
		At    time.Time `json:"at"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	var msg push.Message
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		election, until, err := presidentNow(ctx, tx, s.ID)
		if err != nil {
			return nil, err
		}
		var done bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM state_events WHERE election_id = $1 AND kind = 'fete')`, election).Scan(&done)
		if done {
			return nil, userError("Une Fête de la Nation par semaine : la tienne est déjà prévue.")
		}
		start := req.At.UTC().Truncate(time.Minute)
		end := start.Add(game.FeteHours * time.Hour)
		if start.Before(time.Now().Add(15*time.Minute)) || end.After(until) {
			return nil, userError("La fête : dans un quart d'heure au plus tôt, et finie avant lundi 9 h.")
		}
		if err := stadiumFree(ctx, tx, req.Place, start, end); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO state_events (kind, election_id, sim_id, place_id, starts_at, ends_at) VALUES ('fete', $1, $2, $3, $4, $5)`, election, s.ID, req.Place, start, end); err != nil {
			return nil, err
		}
		_, _, p, _ := world.FindPlace(req.Place)
		text := fmt.Sprintf("Fête de la Nation %s, au %s, offerte par le·la président·e %s %s : musique, artistes, entrée libre pour tous !", frenchDate(start), p.Name, s.First, s.Last)
		if _, _, err := toNation(ctx, tx, text); err != nil {
			return nil, err
		}
		msg = push.Message{Title: "Fête de la Nation " + frenchDate(start), Body: "Au " + p.Name + ", entrée libre : le·la président·e vous invite.", URL: "/jeu", Tag: "fete-nation"}
		return map[string]any{"text": "La fête est annoncée à toute la nation."}, nil
	})
	if msg.Title != "" {
		h.Push.ToAll(msg)
	}
}

// meeting: POST /sims/{id}/politics/meeting {election, place, at} — the candidate's meeting at a stadium, during the campaign.
func (h *Handler) meeting(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Election int64     `json:"election"`
		Place    string    `json:"place"`
		At       time.Time `json:"at"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	var msg push.Message
	commune := ""
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		var kind string
		var opens, votes time.Time
		if err := tx.QueryRow(ctx, `SELECT e.kind, e.commune, e.campaign_at, e.votes_at FROM candidates c JOIN elections e ON e.id = c.election_id WHERE c.election_id = $1 AND c.sim_id = $2 AND NOT e.settled`, req.Election, s.ID).Scan(&kind, &commune, &opens, &votes); err != nil {
			return nil, userError("Tu n'es pas candidat·e à cette élection.")
		}
		var done bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM state_events WHERE election_id = $1 AND sim_id = $2 AND kind = 'meeting')`, req.Election, s.ID).Scan(&done)
		if done {
			return nil, userError("Un meeting par campagne : le tien est déjà prévu.")
		}
		start := req.At.UTC().Truncate(time.Minute)
		end := start.Add(game.MeetingHours * time.Hour)
		if start.Before(opens) || end.After(votes) || start.Before(time.Now().Add(15*time.Minute)) {
			return nil, userError("Le meeting se tient pendant la campagne (" + frenchDate(opens) + " – " + frenchDate(votes) + "), dans un quart d'heure au plus tôt.")
		}
		if err := stadiumFree(ctx, tx, req.Place, start, end); err != nil {
			return nil, err
		}
		if err := charge(ctx, tx, s.ID, game.MeetingCost, "Campagne : ton meeting au stade (la sono, les artistes, les bus)."); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO state_events (kind, election_id, sim_id, place_id, starts_at, ends_at) VALUES ('meeting', $1, $2, $3, $4, $5)`, req.Election, s.ID, req.Place, start, end); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO campaign_acts (election_id, sim_id, kind, commune, cost, points) VALUES ($1, $2, 'meeting', $3, $4, $5)`, req.Election, s.ID, commune, game.MeetingCost, game.MeetingPoints); err != nil {
			return nil, err
		}
		_, _, p, _ := world.FindPlace(req.Place)
		text := fmt.Sprintf("Meeting de %s %s %s au %s : venez nombreux !", s.First, s.Last, frenchDate(start), p.Name)
		var err error
		if kind == "president" {
			_, _, err = toNation(ctx, tx, text)
		} else {
			_, err = tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) SELECT id, 'politique', $1, 0, $2 FROM sims WHERE home_commune = $3`, text, game.MinuteOf(time.Now()), commune)
		}
		if err != nil {
			return nil, err
		}
		msg = push.Message{Title: "Meeting de " + s.First + " " + s.Last, Body: frenchDate(start) + " au " + p.Name + ". Chaque personne venue compte !", URL: "/jeu", Tag: "meeting-" + s.ID}
		return map[string]any{"text": "Ton meeting est annoncé. Chaque personne qui vient te rapporte des voix."}, nil
	})
	if msg.Title == "" {
		return
	}
	if commune == "" {
		h.Push.ToAll(msg)
	} else {
		h.Push.ToCommune(commune, msg)
	}
}

// Attend: a Sim come to the stadium's big day going on (sims/civic.go): its guest
// counted, a candidate's meeting earning its points (each guest, up to a cap). The
// event's title and end, or why not.
func Attend(ctx context.Context, tx pgx.Tx, simID, placeID, interaction string) (string, time.Time, error) {
	kind := map[string]string{game.FeteID: "fete", game.MeetingID: "meeting"}[interaction]
	var id, election int64
	var host, name, commune string
	var end time.Time
	err := tx.QueryRow(ctx, `SELECT e.id, e.election_id, e.sim_id, s.first_name || ' ' || s.last_name, el.commune, e.ends_at FROM state_events e JOIN sims s ON s.id = e.sim_id JOIN elections el ON el.id = e.election_id
		WHERE e.place_id = $1 AND e.kind = $2 AND e.starts_at <= now() + interval '30 minutes' AND e.ends_at > now() ORDER BY e.starts_at LIMIT 1`, placeID, kind).Scan(&id, &election, &host, &name, &commune, &end)
	if errors.Is(err, pgx.ErrNoRows) {
		if kind == "fete" {
			return "", end, errors.New("pas de Fête de la Nation ici en ce moment")
		}
		return "", end, errors.New("pas de meeting ici en ce moment")
	}
	if err != nil {
		return "", end, err
	}
	tag, err := tx.Exec(ctx, `INSERT INTO state_event_guests (event_id, sim_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, simID)
	if err != nil {
		return "", end, err
	}
	title := "la Fête de la Nation"
	if kind == "meeting" {
		title = "le meeting de " + name
		// A new face in the crowd: points for the candidate, up to the cap (never one's own).
		var guests int
		_ = tx.QueryRow(ctx, `SELECT count(*) FROM state_event_guests WHERE event_id = $1`, id).Scan(&guests)
		if tag.RowsAffected() == 1 && simID != host && guests <= game.MeetingGuests {
			if _, err := tx.Exec(ctx, `INSERT INTO campaign_acts (election_id, sim_id, kind, commune, cost, points) VALUES ($1, $2, 'public', $3, 0, $4)`, election, host, commune, game.MeetingGuest); err != nil {
				return "", end, err
			}
		}
	}
	return title, end, nil
}

/* ---------- the campaign in the street ---------- */

// Tour: a candidate's tour of a place (sims/civic.go): its points in the place's
// commune, for each election the Sim stands in there while the campaign is on, once
// a place an election; or why not.
func Tour(ctx context.Context, tx pgx.Tx, simID, placeID string) error {
	_, cm, _, ok := world.FindPlace(placeID)
	if !ok {
		return errors.New("lieu inconnu")
	}
	rows, err := tx.Query(ctx, `SELECT e.id, e.kind, e.commune, e.campaign_at, e.votes_at FROM candidates c JOIN elections e ON e.id = c.election_id WHERE c.sim_id = $1 AND NOT e.settled`, simID)
	if err != nil {
		return err
	}
	type stand struct {
		id             int64
		kind, commune  string
		opens, closing time.Time
	}
	var stands []stand
	for rows.Next() {
		var x stand
		if err := rows.Scan(&x.id, &x.kind, &x.commune, &x.opens, &x.closing); err != nil {
			rows.Close()
			return err
		}
		stands = append(stands, x)
	}
	rows.Close()
	if len(stands) == 0 {
		return errors.New("il faut être candidat·e pour faire campagne")
	}
	now := time.Now()
	counted := 0
	var why error = errors.New("ici, ta campagne ne compte pas : fais-la dans ta commune")
	for _, x := range stands {
		if err := campaignOpen(x.opens, x.closing, now); err != nil {
			why = err
			continue
		}
		if x.kind == "maire" && x.commune != cm.ID {
			continue
		}
		var done bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM campaign_acts WHERE election_id = $1 AND sim_id = $2 AND kind = 'terrain' AND place_id = $3)`, x.id, simID, placeID).Scan(&done)
		if done {
			why = errors.New("tu as déjà fait campagne ici : va voir les gens ailleurs")
			continue
		}
		if _, err := tx.Exec(ctx, `INSERT INTO campaign_acts (election_id, sim_id, kind, commune, cost, points, place_id) VALUES ($1, $2, 'terrain', $3, $4, $5, $6)`, x.id, simID, cm.ID, game.TourCost, game.TourPoints, placeID); err != nil {
			return err
		}
		counted++
	}
	if counted == 0 {
		return why
	}
	return nil
}

// callMilitants: POST /sims/{id}/politics/militants {election, commune, pay, slots} — the candidate
// calls the party's militants to a commune; their pay held now, what's left given back at the results.
func (h *Handler) callMilitants(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Election int64  `json:"election"`
		Commune  string `json:"commune"`
		Pay      int    `json:"pay"`
		Slots    int    `json:"slots"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	var members []string
	var msg push.Message
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		var kind, commune string
		var party *int64
		var votes time.Time
		if err := tx.QueryRow(ctx, `SELECT e.kind, e.commune, c.party_id, e.votes_at FROM candidates c JOIN elections e ON e.id = c.election_id WHERE c.election_id = $1 AND c.sim_id = $2 AND NOT e.settled`, req.Election, s.ID).Scan(&kind, &commune, &party, &votes); err != nil {
			return nil, userError("Tu n'es pas candidat·e à cette élection.")
		}
		if party == nil {
			return nil, userError("Il faut un parti pour avoir des militants.")
		}
		if !time.Now().Before(votes) {
			return nil, userError("La campagne est close : place au vote.")
		}
		if kind == "maire" {
			req.Commune = commune
		}
		if !slices.ContainsFunc(mayoralCommunes(), func(m world.Commune) bool { return m.ID == req.Commune }) {
			return nil, userError("Choisis la commune.")
		}
		if req.Pay < game.MilitantPayMin || req.Pay > game.MilitantPayMax || req.Slots < 1 || req.Slots > game.MilitantSlotMax {
			return nil, userError(fmt.Sprintf("De %s à %s Djai par militant, %d militants au plus.", thousands(game.MilitantPayMin), thousands(game.MilitantPayMax), game.MilitantSlotMax))
		}
		held := req.Pay * req.Slots
		if err := charge(ctx, tx, s.ID, held, fmt.Sprintf("Campagne : %d militants appelés %s (%s Djai chacun, le reste te revient aux résultats).", req.Slots, communeDe(req.Commune), thousands(req.Pay))); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO militant_calls (election_id, sim_id, party_id, commune, pay, slots, held) VALUES ($1, $2, $3, $4, $5, $6, $7)`, req.Election, s.ID, *party, req.Commune, req.Pay, req.Slots, held); err != nil {
			return nil, err
		}
		text := fmt.Sprintf("Ton parti a besoin de toi : %s %s appelle %d militants %s, %s Djai chacun. Va dans la commune (mairie, marché, maquis) et « Milite pour ton parti » pendant la campagne.", s.First, s.Last, req.Slots, communeDe(req.Commune), thousands(req.Pay))
		rows, err := tx.Query(ctx, `SELECT sim_id FROM party_members WHERE party_id = $1 AND sim_id <> $2`, *party, s.ID)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var m string
			if rows.Scan(&m) == nil {
				members = append(members, m)
			}
		}
		rows.Close()
		for _, m := range members {
			if err := note(ctx, tx, m, text, 0); err != nil {
				return nil, err
			}
		}
		msg = push.Message{Title: "Appel aux militants", Body: text, URL: "/jeu", Tag: "militants"}
		return map[string]any{"text": fmt.Sprintf("%d militants du parti sont prévenus.", len(members))}, nil
	})
	for _, m := range members {
		h.Push.ToSim(m, msg)
	}
}

// Militate: a party member campaigning in a commune on a call of the party's candidate
// (sims/civic.go), during the campaign: the candidate's points, the militant's pay (take:
// what the militant may receive of it today; the rest stays with the call). The
// candidate's name and what was paid, or why not.
func Militate(ctx context.Context, tx pgx.Tx, simID, commune string, take func(pay int) int) (string, int, error) {
	var id, election int64
	var candidate, name string
	var pay int
	var opens, votes time.Time
	err := tx.QueryRow(ctx, `SELECT c.id, c.election_id, c.sim_id, s.first_name || ' ' || s.last_name, c.pay, e.campaign_at, e.votes_at
		FROM militant_calls c JOIN party_members m ON m.party_id = c.party_id JOIN sims s ON s.id = c.sim_id JOIN elections e ON e.id = c.election_id
		WHERE m.sim_id = $1 AND c.commune = $2 AND NOT c.settled AND c.taken < c.slots AND c.sim_id <> $1
			AND NOT EXISTS (SELECT 1 FROM militant_runs r WHERE r.call_id = c.id AND r.sim_id = $1)
		ORDER BY c.pay DESC, c.id LIMIT 1 FOR UPDATE OF c`, simID, commune).Scan(&id, &election, &candidate, &name, &pay, &opens, &votes)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", 0, errors.New("pas d'appel de ton parti ici : ton·ta candidat·e doit appeler des militants dans cette commune")
	}
	if err != nil {
		return "", 0, err
	}
	if err := campaignOpen(opens, votes, time.Now()); err != nil {
		return "", 0, err
	}
	paid := take(pay)
	if _, err := tx.Exec(ctx, `INSERT INTO militant_runs (call_id, sim_id, paid) VALUES ($1, $2, $3)`, id, simID, paid); err != nil {
		return "", 0, err
	}
	if _, err := tx.Exec(ctx, `UPDATE militant_calls SET taken = taken + 1, held = held - $2 WHERE id = $1`, id, paid); err != nil {
		return "", 0, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO campaign_acts (election_id, sim_id, kind, commune, cost, points) VALUES ($1, $2, 'militants', $3, $4, $5)`, election, candidate, commune, paid, game.MilitantPoints); err != nil {
		return "", 0, err
	}
	return name, paid, nil
}

// refundCalls: at an election's results, what its calls still hold goes back to the candidates.
func refundCalls(ctx context.Context, tx pgx.Tx, election int64) error {
	rows, err := tx.Query(ctx, `UPDATE militant_calls SET settled = true WHERE election_id = $1 AND NOT settled RETURNING sim_id, held, slots - taken`, election)
	if err != nil {
		return err
	}
	type back struct {
		sim        string
		held, left int
	}
	var list []back
	for rows.Next() {
		var b back
		if err := rows.Scan(&b.sim, &b.held, &b.left); err != nil {
			rows.Close()
			return err
		}
		list = append(list, b)
	}
	rows.Close()
	for _, b := range list {
		if b.held > 0 {
			if err := pay(ctx, tx, b.sim, b.held, fmt.Sprintf("Campagne : l'argent des militants non venus te revient (%d places libres).", b.left)); err != nil {
				return err
			}
		}
	}
	return nil
}

/* ---------- what one can do in the street, the posters ---------- */

// terrain: GET /sims/{id}/politics/terrain — what the Sim may do in the street now: the
// elections it stands in with the campaign on, the places toured, its party's calls, the stadium's big days.
func (h *Handler) terrain(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var simID string
	if err := h.DB.QueryRow(ctx, `SELECT id FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(ctx)).Scan(&simID); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	type stand struct {
		Election int64  `json:"election"`
		Kind     string `json:"kind"`
		Commune  string `json:"commune,omitempty"`
	}
	stands := []stand{}
	toured := []string{}
	if rows, err := h.DB.Query(ctx, `SELECT e.id, e.kind, e.commune FROM candidates c JOIN elections e ON e.id = c.election_id WHERE c.sim_id = $1 AND NOT e.settled AND e.campaign_at <= now() AND e.votes_at > now()`, simID); err == nil {
		for rows.Next() {
			var x stand
			if rows.Scan(&x.Election, &x.Kind, &x.Commune) == nil {
				stands = append(stands, x)
			}
		}
		rows.Close()
	}
	if rows, err := h.DB.Query(ctx, `SELECT DISTINCT a.place_id FROM campaign_acts a JOIN elections e ON e.id = a.election_id WHERE a.sim_id = $1 AND a.kind = 'terrain' AND NOT e.settled`, simID); err == nil {
		for rows.Next() {
			var p string
			if rows.Scan(&p) == nil {
				toured = append(toured, p)
			}
		}
		rows.Close()
	}
	calls, _ := h.calls(ctx, `c.party_id = (SELECT party_id FROM party_members WHERE sim_id = $1) AND c.sim_id <> $1 AND NOT c.settled AND e.campaign_at <= now() AND e.votes_at > now()`, simID)
	events, _ := h.stateEvents(ctx, `e.ends_at > now()`)
	httpx.JSON(w, http.StatusOK, map[string]any{"stands": stands, "toured": toured, "calls": calls, "events": events})
}

// calls: militants' calls matching a condition ($1: the Sim asking, whose runs are told).
func (h *Handler) calls(ctx context.Context, where string, sim string) ([]MilitCall, error) {
	rows, err := h.DB.Query(ctx, `SELECT c.id, c.election_id, c.sim_id, s.first_name || ' ' || s.last_name, c.commune, c.pay, c.slots, c.taken,
			EXISTS (SELECT 1 FROM militant_runs r WHERE r.call_id = c.id AND r.sim_id = $1)
		FROM militant_calls c JOIN sims s ON s.id = c.sim_id JOIN elections e ON e.id = c.election_id WHERE `+where+` ORDER BY c.id DESC LIMIT 20`, sim)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MilitCall{}
	for rows.Next() {
		var c MilitCall
		if err := rows.Scan(&c.ID, &c.Election, &c.Candidate, &c.Name, &c.Commune, &c.Pay, &c.Slots, &c.Taken, &c.Done); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// Posters: GET /politics/affiches?commune= (public, like the ads) — the candidates whose posters
// are up in a commune (from the campaign's opening to the results): their colours on the walls, the most seen first.
func (h *Handler) Posters(w http.ResponseWriter, r *http.Request) {
	commune := r.URL.Query().Get("commune")
	rows, err := h.DB.Query(r.Context(), `SELECT s.first_name || ' ' || s.last_name, COALESCE(p.acronym, ''), COALESCE(p.color, '#ff7a00'), COALESCE(p.slogan, ''), e.kind, sum(a.points)
		FROM campaign_acts a JOIN elections e ON e.id = a.election_id JOIN sims s ON s.id = a.sim_id
		LEFT JOIN party_members m ON m.sim_id = s.id LEFT JOIN parties p ON p.id = m.party_id
		WHERE NOT e.settled AND e.campaign_at <= now() AND (a.commune = $1 OR a.commune = '') AND a.kind IN ('affiches', 'tshirts', 'tournee', 'terrain', 'militants', 'meeting', 'radio')
		GROUP BY 1, 2, 3, 4, 5 ORDER BY 6 DESC LIMIT 6`, commune)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	type poster struct {
		Name    string `json:"name"`
		Acronym string `json:"acronym,omitempty"`
		Color   string `json:"color"`
		Slogan  string `json:"slogan,omitempty"`
		Kind    string `json:"kind"`
		Points  int    `json:"points"`
	}
	out := []poster{}
	for rows.Next() {
		var p poster
		if rows.Scan(&p.Name, &p.Acronym, &p.Color, &p.Slogan, &p.Kind, &p.Points) == nil {
			out = append(out, p)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"posters": out})
}
