// Package politics is the city's political life (the phone's Politique app,
// web/src/screens/PolitiqueApp.tsx): the parties the players found and join,
// the elections (the president of the game's republic, and a mayor for each
// commune), the candidates with their programme and their paid campaign, the
// players' ballots cast at a town hall, the results (the players' votes and
// the crowds the campaign won over), the offices held (the president names
// the ministers and the deputies, who sit with them at the Présidence; the
// mayors sit at their mairie), and their daily pay. Also the players' gangs
// (crews: the Sim's gang column is the street's nouchis) and the sects joined.
//
// Everything is on the real clock (the game's clock is the real one), the
// week's (game.ElectionWeek): one stands from the Monday, the campaign runs
// from Friday at 18 h to Saturday night, the vote on Sunday, and the results
// fall on Monday at 9 h, for everyone (journal and notification): a new
// president every week, three mandates a month at most. The president speaks
// to the nation, decrees the week's measures, gives the Fête de la Nation,
// and the citizens rate them every day (presidency.go).
package politics

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
	"github.com/myahse/babi-life/backend/internal/world"
)

const (
	// What it costs, in Djai.
	PartyFee         = 50_000
	DepositPresident = 200_000
	DepositMayor     = 50_000
	CrewFee          = 30_000
	// A player's vote weighs this many of the crowd's (a player is a whole neighbourhood).
	PlayerWeight = 50
	// The crowd voting, per election (split between the candidates by their campaign).
	CrowdPresident = 20_000
	CrowdMayor     = 2_000
	// A day's pay, by office: an honour more than a living (game/money.go,
	// docs/economie.md): the deposit and the campaign cost more than a mandate pays.
	PayPresident = 20_000
	PayMinister  = 8_000
	PayDeputy    = 5_000
	PayMayor     = 6_000
	// How many ministers a president names.
	MaxMinisters = 8
)

// Portfolios: the ministries, in the order they sit.
var Portfolios = []struct{ ID, Label string }{
	{"economie", "Ministre de l'Économie"}, {"sante", "Ministre de la Santé"}, {"education", "Ministre de l'Éducation"}, {"securite", "Ministre de la Sécurité"},
	{"transports", "Ministre des Transports"}, {"sport", "Ministre des Sports"}, {"culture", "Ministre de la Culture"}, {"jeunesse", "Ministre de la Jeunesse"},
}

// CampaignAct: what a candidate can buy. Scope "commune": points there; "all": points everywhere.
type CampaignAct struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Cost   int    `json:"cost"`
	Points int    `json:"points"`
	Scope  string `json:"scope"`
	Blurb  string `json:"blurb"`
}

var CampaignActs = []CampaignAct{
	{"affiches", "Des affiches dans la commune", 20_000, 10, "commune", "Ton visage sur les murs, les poteaux, les gbakas."},
	{"tshirts", "Des t-shirts et des pagnes", 30_000, 15, "commune", "Distribués au marché : tout le quartier porte tes couleurs."},
	{"tournee", "Une tournée dans la commune", 50_000, 30, "commune", "De cour en cour, de maquis en maquis, tu serres les mains."},
	{"radio", "Un spot à la radio", 80_000, 25, "all", "Ton slogan entre deux coupés-décalés, dans toute la ville."},
}

// Sect: a secret society. Fee to be initiated, dues each Monday; the perk is read by the Sim (sims).
type Sect struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Motto string `json:"motto"`
	Fee   int    `json:"fee"`
	Dues  int    `json:"dues"`
	Perk  string `json:"perk"`
	Risk  string `json:"risk,omitempty"`
}

var Sects = []Sect{
	{"baobab", "La Confrérie du Baobab", "Les racines tiennent l'arbre.", 20_000, 5_000, "Les frères placent les leurs : +5 % sur ta paie au travail.", ""},
	{"sept", "Le Cercle des Sept", "Sept portes, une clé.", 30_000, 7_000, "Les nouchis des couloirs te laissent passer, et +5 % sur tes gains de défis et de paris.", ""},
	{"lumiere", "Les Enfants de la Lumière", "Ce qui brille se partage.", 10_000, 2_000, "+5 % sur tout ce que tu gagnes.", "Mais la loge fait parler : un lundi sur dix, un scandale te coûte 10 000 F."},
}

func sectOf(id string) *Sect {
	for i := range Sects {
		if Sects[i].ID == id {
			return &Sects[i]
		}
	}
	return nil
}

type Handler struct {
	DB *pgxpool.Pool
	// Changed: a Sim's devices told (its money, its titles changed).
	Changed func(simID string)
	// Push: the phones told (the results on Monday, the president's words); nil: none.
	Push *push.Service
}

var (
	errMoney    = errors.New("pas assez de Djai")
	errNotYours = errors.New("ce perso n'est pas à toi")
	errMinor    = errors.New("il faut être adulte")
)

// Routes: the players' side (signed in).
func (h *Handler) Routes(r chi.Router) {
	r.Get("/politics/parties", h.parties)
	r.Get("/politics/government", h.government)
	r.Get("/politics/crews", h.crews)
	r.Get("/politics/search", h.search)
	r.Get("/sims/{id}/politics", h.summary)
	r.Post("/sims/{id}/politics/party", h.foundParty)
	r.Post("/sims/{id}/politics/party/leave", h.leaveParty)
	r.Post("/sims/{id}/politics/party/{party}/join", h.joinParty)
	r.Post("/sims/{id}/politics/candidacy", h.declare)
	r.Post("/sims/{id}/politics/campaign", h.campaign)
	r.Post("/sims/{id}/politics/vote", h.vote)
	r.Post("/sims/{id}/politics/name", h.name)
	r.Post("/sims/{id}/politics/communique", h.communique)
	r.Post("/sims/{id}/politics/crew", h.foundCrew)
	r.Post("/sims/{id}/politics/crew/leave", h.leaveCrew)
	r.Post("/sims/{id}/politics/crew/accept", h.acceptCrew)
	r.Post("/sims/{id}/politics/crew/kick", h.kickCrew)
	r.Post("/sims/{id}/politics/crew/fund", h.fundCrew)
	r.Post("/sims/{id}/politics/crew/{crew}/ask", h.askCrew)
	r.Post("/sims/{id}/politics/sect", h.setSect)
	// The president's week and the campaign in the street (presidency.go).
	r.Get("/politics/events", h.events)
	r.Get("/sims/{id}/politics/terrain", h.terrain)
	r.Post("/sims/{id}/politics/parole", h.speak)
	r.Post("/sims/{id}/politics/parole/{word}/signaler", h.reportWord)
	r.Post("/sims/{id}/politics/mesure", h.decree)
	r.Post("/sims/{id}/politics/note", h.rate)
	r.Post("/sims/{id}/politics/fete", h.fete)
	r.Post("/sims/{id}/politics/meeting", h.meeting)
	r.Post("/sims/{id}/politics/militants", h.callMilitants)
}

/* ---------- the Sim, its money, its journal ---------- */

type sim struct {
	ID, First, Last, Gender, HomeCity, HomeCommune, City string
	Money                                                int
	Adult                                                bool
	Sect                                                 string
}

// mine: the player's Sim, or an error for the answer.
func (h *Handler) mine(ctx context.Context, q pgx.Tx, r *http.Request) (sim, error) {
	var s sim
	var born, minutes int64
	err := q.QueryRow(ctx, `SELECT id, first_name, last_name, gender, home_city, home_commune, city, money, born_at, game_minutes, sect FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(ctx)).
		Scan(&s.ID, &s.First, &s.Last, &s.Gender, &s.HomeCity, &s.HomeCommune, &s.City, &s.Money, &born, &minutes, &s.Sect)
	if err != nil {
		return s, errNotYours
	}
	s.Adult = game.StageOf(game.AgeAt(born, minutes)).ID == game.StageAdulte
	return s, nil
}

// charge takes Djai from the Sim (a journal line says what for), or errMoney.
func charge(ctx context.Context, tx pgx.Tx, simID string, amount int, text string) error {
	if amount <= 0 {
		return nil
	}
	tag, err := tx.Exec(ctx, `UPDATE sims SET money = money - $1 WHERE id = $2 AND money >= $1`, amount, simID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errMoney
	}
	return note(ctx, tx, simID, text, -amount)
}

// pay gives Djai to the Sim, with its line.
func pay(ctx context.Context, tx pgx.Tx, simID string, amount int, text string) error {
	if _, err := tx.Exec(ctx, `UPDATE sims SET money = money + $1 WHERE id = $2`, amount, simID); err != nil {
		return err
	}
	return note(ctx, tx, simID, text, amount)
}

// note: a line in the Sim's journal (the phone's Messages).
func note(ctx context.Context, tx pgx.Tx, simID, text string, money int) error {
	_, err := tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) VALUES ($1, 'politique', $2, $3, $4)`, simID, text, money, game.MinuteOf(time.Now()))
	return err
}

func (h *Handler) changed(id string) {
	if h.Changed != nil && id != "" {
		h.Changed(id)
	}
}

// fail answers a handler's error.
func fail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errNotYours):
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
	case errors.Is(err, errMoney):
		httpx.Error(w, http.StatusBadRequest, "Pas assez de Djai pour ça.")
	case errors.Is(err, pgx.ErrNoRows):
		httpx.Error(w, http.StatusNotFound, "introuvable")
	default:
		var u userError
		if errors.As(err, &u) {
			httpx.Error(w, http.StatusBadRequest, u.Error())
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
	}
}

// userError: something the player did wrong, said as it is.
type userError string

func (e userError) Error() string { return string(e) }

// inTx runs fn in a transaction with the player's Sim, answering the outcome.
func (h *Handler) inTx(w http.ResponseWriter, r *http.Request, fn func(ctx context.Context, tx pgx.Tx, s sim) (any, error)) {
	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	s, err := h.mine(ctx, tx, r)
	if err != nil {
		fail(w, err)
		return
	}
	out, err := fn(ctx, tx, s)
	if err != nil {
		fail(w, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	h.changed(s.ID)
	if out == nil {
		out = map[string]any{"ok": true}
	}
	httpx.JSON(w, http.StatusOK, out)
}

/* ---------- parties ---------- */

type Party struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Acronym  string `json:"acronym"`
	Color    string `json:"color"`
	Slogan   string `json:"slogan"`
	Leader   string `json:"leader"`
	LeaderNm string `json:"leaderName"`
	Members  int    `json:"members"`
}

const partiesSQL = `SELECT p.id, p.name, p.acronym, p.color, p.slogan, p.leader, s.first_name || ' ' || s.last_name, (SELECT count(*) FROM party_members m WHERE m.party_id = p.id)
	FROM parties p JOIN sims s ON s.id = p.leader`

func scanParties(rows pgx.Rows) ([]Party, error) {
	defer rows.Close()
	out := []Party{}
	for rows.Next() {
		var p Party
		if err := rows.Scan(&p.ID, &p.Name, &p.Acronym, &p.Color, &p.Slogan, &p.Leader, &p.LeaderNm, &p.Members); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (h *Handler) parties(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), partiesSQL+` ORDER BY 8 DESC, p.created_at LIMIT 100`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	out, err := scanParties(rows)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"parties": out, "fee": PartyFee})
}

var colorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func (h *Handler) foundParty(w http.ResponseWriter, r *http.Request) {
	var req struct{ Name, Acronym, Color, Slogan string }
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	req.Name, req.Acronym, req.Slogan = strings.TrimSpace(req.Name), strings.ToUpper(strings.TrimSpace(req.Acronym)), strings.TrimSpace(req.Slogan)
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		if !s.Adult {
			return nil, userError("Il faut être adulte pour fonder un parti.")
		}
		if n := utf8.RuneCountInString(req.Name); n < 4 || n > 40 {
			return nil, userError("Le nom du parti : de 4 à 40 lettres.")
		}
		if n := utf8.RuneCountInString(req.Acronym); n < 2 || n > 6 {
			return nil, userError("Le sigle : de 2 à 6 lettres (RIF, PDCB…).")
		}
		if utf8.RuneCountInString(req.Slogan) > 80 {
			return nil, userError("Le slogan : 80 lettres au plus.")
		}
		if !colorRe.MatchString(req.Color) {
			req.Color = "#ff7a00"
		}
		var in bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM party_members WHERE sim_id = $1)`, s.ID).Scan(&in)
		if in {
			return nil, userError("Tu es déjà dans un parti : quitte-le d'abord.")
		}
		if err := charge(ctx, tx, s.ID, PartyFee, "Politique : tu fondes le parti "+req.Name+" ("+req.Acronym+")."); err != nil {
			return nil, err
		}
		var id int64
		if err := tx.QueryRow(ctx, `INSERT INTO parties (name, acronym, color, slogan, leader) VALUES ($1, $2, $3, $4, $5) RETURNING id`, req.Name, req.Acronym, req.Color, req.Slogan, s.ID).Scan(&id); err != nil {
			return nil, userError("Un parti porte déjà ce nom.")
		}
		if _, err := tx.Exec(ctx, `INSERT INTO party_members (sim_id, party_id) VALUES ($1, $2)`, s.ID, id); err != nil {
			return nil, err
		}
		return map[string]any{"id": id, "text": "Le " + req.Acronym + " est né ! Trouve des membres, puis présente-toi aux élections."}, nil
	})
}

func (h *Handler) joinParty(w http.ResponseWriter, r *http.Request) {
	party, _ := strconv.ParseInt(chi.URLParam(r, "party"), 10, 64)
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		if !s.Adult {
			return nil, userError("Il faut être adulte pour entrer dans un parti.")
		}
		var name string
		if err := tx.QueryRow(ctx, `SELECT acronym FROM parties WHERE id = $1`, party).Scan(&name); err != nil {
			return nil, userError("Ce parti n'existe plus.")
		}
		var in bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM party_members WHERE sim_id = $1)`, s.ID).Scan(&in)
		if in {
			return nil, userError("Tu es déjà dans un parti : quitte-le d'abord.")
		}
		if _, err := tx.Exec(ctx, `INSERT INTO party_members (sim_id, party_id) VALUES ($1, $2)`, s.ID, party); err != nil {
			return nil, err
		}
		_ = note(ctx, tx, s.ID, "Politique : tu prends ta carte du "+name+".", 0)
		return map[string]any{"text": "Bienvenue au " + name + " !"}, nil
	})
}

func (h *Handler) leaveParty(w http.ResponseWriter, r *http.Request) {
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		var party int64
		var leader string
		if err := tx.QueryRow(ctx, `SELECT p.id, p.leader FROM party_members m JOIN parties p ON p.id = m.party_id WHERE m.sim_id = $1`, s.ID).Scan(&party, &leader); err != nil {
			return nil, userError("Tu n'es dans aucun parti.")
		}
		// A candidate stays with the party till the vote is over.
		var running bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM candidates c JOIN elections e ON e.id = c.election_id WHERE c.sim_id = $1 AND NOT e.settled)`, s.ID).Scan(&running)
		if running {
			return nil, userError("Tu es candidat·e : le parti te garde jusqu'aux résultats.")
		}
		if _, err := tx.Exec(ctx, `DELETE FROM party_members WHERE sim_id = $1`, s.ID); err != nil {
			return nil, err
		}
		if leader == s.ID {
			// The founder leaving: the oldest member takes the lead; nobody left, the party is dissolved.
			var next string
			if err := tx.QueryRow(ctx, `SELECT sim_id FROM party_members WHERE party_id = $1 ORDER BY joined_at LIMIT 1`, party).Scan(&next); err == nil {
				_, _ = tx.Exec(ctx, `UPDATE parties SET leader = $1 WHERE id = $2`, next, party)
				_ = note(ctx, tx, next, "Politique : tu prends la tête du parti, son fondateur est parti.", 0)
				h.changed(next)
			} else {
				_, _ = tx.Exec(ctx, `DELETE FROM parties WHERE id = $1`, party)
			}
		}
		_ = note(ctx, tx, s.ID, "Politique : tu rends ta carte du parti.", 0)
		return nil, nil
	})
}

/* ---------- elections ---------- */

type Candidate struct {
	Sim       string          `json:"sim"`
	Name      string          `json:"name"`
	Username  string          `json:"username,omitempty"`
	Look      json.RawMessage `json:"look"`
	Gender    string          `json:"gender"`
	Party     *int64          `json:"party,omitempty"`
	Acronym   string          `json:"acronym,omitempty"`
	Color     string          `json:"color,omitempty"`
	Programme string          `json:"programme"`
	// The campaign's points here (the commune asked for, or everywhere), and the votes once settled.
	Points   int `json:"points"`
	Votes    int `json:"votes"`
	NpcVotes int `json:"npcVotes"`
}

type Election struct {
	ID      int64     `json:"id"`
	Kind    string    `json:"kind"`
	Commune string    `json:"commune,omitempty"`
	OpensAt time.Time `json:"opensAt"`
	// The campaign from CampaignAt to VotesAt, the vote to ClosesAt, the results (and the mandate) at ResultsAt.
	CampaignAt time.Time   `json:"campaignAt"`
	VotesAt    time.Time   `json:"votesAt"`
	ClosesAt   time.Time   `json:"closesAt"`
	ResultsAt  time.Time   `json:"resultsAt"`
	Settled    bool        `json:"settled"`
	Winner     *string     `json:"winner,omitempty"`
	Turnout    int         `json:"turnout"`
	Cands      []Candidate `json:"candidates"`
	// For the player asking: whom they voted for ("" not yet), whether they're a candidate.
	MyVote string `json:"myVote,omitempty"`
}

// mayoralCommunes: the communes with a town hall (a mayor each).
func mayoralCommunes() []world.Commune {
	var out []world.Commune
	for _, c := range world.Cities {
		for _, m := range c.Communes {
			if m.Admin.Mairie != "" {
				out = append(out, m)
			}
		}
	}
	return out
}

// ensure opens the elections to come: the presidential one, and a mayoral one
// per commune, on the same dates (game.ElectionWeek): one may stand from now.
func (h *Handler) ensure(ctx context.Context) error {
	var opens, campaign, votes, closes, results time.Time
	err := h.DB.QueryRow(ctx, `SELECT opens_at, campaign_at, votes_at, closes_at, results_at FROM elections WHERE kind = 'president' AND NOT settled ORDER BY results_at LIMIT 1`).Scan(&opens, &campaign, &votes, &closes, &results)
	if errors.Is(err, pgx.ErrNoRows) {
		opens = time.Now()
		campaign, votes, closes, results = game.ElectionWeek(opens)
		if _, err := h.DB.Exec(ctx, `INSERT INTO elections (kind, commune, opens_at, campaign_at, votes_at, closes_at, results_at) VALUES ('president', '', $1, $2, $3, $4, $5)`, opens, campaign, votes, closes, results); err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	for _, m := range mayoralCommunes() {
		_, err := h.DB.Exec(ctx, `INSERT INTO elections (kind, commune, opens_at, campaign_at, votes_at, closes_at, results_at)
			SELECT 'maire', $1, $2, $3, $4, $5, $6 WHERE NOT EXISTS (SELECT 1 FROM elections WHERE kind = 'maire' AND commune = $1 AND NOT settled)`, m.ID, opens, campaign, votes, closes, results)
		if err != nil {
			return err
		}
	}
	return nil
}

// candidatesOf: an election's candidates, their points counted for a commune ("": all of them, everywhere).
func (h *Handler) candidatesOf(ctx context.Context, q interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, election int64, commune string) ([]Candidate, error) {
	rows, err := q.Query(ctx, `SELECT c.sim_id, s.first_name || ' ' || s.last_name, COALESCE(u.username, ''), s.look, s.gender, c.party_id, COALESCE(p.acronym, ''), COALESCE(p.color, ''), c.programme,
			COALESCE((SELECT sum(a.points) FROM campaign_acts a WHERE a.election_id = c.election_id AND a.sim_id = c.sim_id AND ($2 = '' OR a.commune = '' OR a.commune = $2)), 0), c.votes, c.npc_votes
		FROM candidates c JOIN sims s ON s.id = c.sim_id JOIN users u ON u.id = s.user_id LEFT JOIN parties p ON p.id = c.party_id
		WHERE c.election_id = $1 ORDER BY c.votes + c.npc_votes DESC, c.declared_at`, election, commune)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Candidate{}
	for rows.Next() {
		var c Candidate
		var pts int64
		if err := rows.Scan(&c.Sim, &c.Name, &c.Username, &c.Look, &c.Gender, &c.Party, &c.Acronym, &c.Color, &c.Programme, &pts, &c.Votes, &c.NpcVotes); err != nil {
			return nil, err
		}
		c.Points = int(pts)
		out = append(out, c)
	}
	return out, rows.Err()
}

const electionColumns = `id, kind, commune, opens_at, campaign_at, votes_at, closes_at, results_at, settled, winner, turnout`

// current: the election to come (or running) of a kind, with its candidates.
func (h *Handler) current(ctx context.Context, kind, commune, user string) (*Election, error) {
	var e Election
	err := h.DB.QueryRow(ctx, `SELECT `+electionColumns+` FROM elections WHERE kind = $1 AND commune = $2 AND NOT settled ORDER BY results_at LIMIT 1`, kind, commune).
		Scan(&e.ID, &e.Kind, &e.Commune, &e.OpensAt, &e.CampaignAt, &e.VotesAt, &e.ClosesAt, &e.ResultsAt, &e.Settled, &e.Winner, &e.Turnout)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if e.Cands, err = h.candidatesOf(ctx, h.DB, e.ID, commune); err != nil {
		return nil, err
	}
	if user != "" {
		_ = h.DB.QueryRow(ctx, `SELECT candidate FROM ballots WHERE election_id = $1 AND user_id = $2`, e.ID, user).Scan(&e.MyVote)
	}
	return &e, nil
}

// last: the latest settled election of a kind (the results shown).
func (h *Handler) last(ctx context.Context, kind, commune string) (*Election, error) {
	var e Election
	err := h.DB.QueryRow(ctx, `SELECT `+electionColumns+` FROM elections WHERE kind = $1 AND commune = $2 AND settled ORDER BY results_at DESC LIMIT 1`, kind, commune).
		Scan(&e.ID, &e.Kind, &e.Commune, &e.OpensAt, &e.CampaignAt, &e.VotesAt, &e.ClosesAt, &e.ResultsAt, &e.Settled, &e.Winner, &e.Turnout)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	e.Cands, err = h.candidatesOf(ctx, h.DB, e.ID, commune)
	return &e, err
}

func (h *Handler) declare(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Election  int64  `json:"election"`
		Programme string `json:"programme"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	req.Programme = strings.TrimSpace(req.Programme)
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		if !s.Adult {
			return nil, userError("Il faut être adulte pour se présenter.")
		}
		if n := utf8.RuneCountInString(req.Programme); n < 20 || n > 600 {
			return nil, userError("Ton programme : dis aux gens pourquoi voter pour toi, de 20 à 600 lettres.")
		}
		var kind, commune string
		var votesAt, results time.Time
		if err := tx.QueryRow(ctx, `SELECT kind, commune, votes_at, results_at FROM elections WHERE id = $1 AND NOT settled`, req.Election).Scan(&kind, &commune, &votesAt, &results); err != nil {
			return nil, userError("Cette élection est passée.")
		}
		if time.Now().After(votesAt) {
			return nil, userError("Le vote a commencé : les candidatures sont closes. À la prochaine !")
		}
		var party int64
		var leader string
		if err := tx.QueryRow(ctx, `SELECT p.id, p.leader FROM party_members m JOIN parties p ON p.id = m.party_id WHERE m.sim_id = $1`, s.ID).Scan(&party, &leader); err != nil {
			return nil, userError("Il faut un parti pour se présenter : fonde le tien ou entre dans un parti.")
		}
		deposit, what := DepositMayor, ""
		if kind == "president" {
			if leader != s.ID {
				return nil, userError("À la présidentielle, c'est le chef du parti qui se présente.")
			}
			deposit, what = DepositPresident, "à la présidence"
			// Three mandates starting in a month, no more: the next one, the month after.
			if n, err := mandatesInMonth(ctx, tx, s.ID, results); err != nil {
				return nil, err
			} else if n >= game.MandatesAMonth {
				return nil, userError(fmt.Sprintf("Tu as déjà gagné %d présidentielles ce mois-ci : c'est la limite. Tu pourras te représenter le mois prochain.", n))
			}
		} else {
			if s.HomeCommune != commune {
				return nil, userError("On se présente à la mairie de sa commune (celle où l'on habite).")
			}
			what = "à la mairie " + communeDe(commune)
		}
		var taken bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM candidates WHERE election_id = $1 AND party_id = $2)`, req.Election, party).Scan(&taken)
		if taken {
			return nil, userError("Ton parti a déjà son candidat à cette élection.")
		}
		if err := charge(ctx, tx, s.ID, deposit, "Politique : ta caution de candidat "+what+"."); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO candidates (election_id, sim_id, party_id, programme) VALUES ($1, $2, $3, $4) ON CONFLICT (election_id, sim_id) DO UPDATE SET programme = EXCLUDED.programme`, req.Election, s.ID, party, req.Programme); err != nil {
			return nil, err
		}
		return map[string]any{"text": "Tu es candidat·e " + what + " ! Fais campagne : affiches, tournées, meeting."}, nil
	})
}

func (h *Handler) campaign(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Election int64  `json:"election"`
		Kind     string `json:"kind"`
		Commune  string `json:"commune"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		var act *CampaignAct
		for i := range CampaignActs {
			if CampaignActs[i].ID == req.Kind {
				act = &CampaignActs[i]
			}
		}
		if act == nil {
			return nil, userError("action de campagne inconnue")
		}
		var kind, commune string
		var opens, votes time.Time
		if err := tx.QueryRow(ctx, `SELECT e.kind, e.commune, e.campaign_at, e.votes_at FROM candidates c JOIN elections e ON e.id = c.election_id WHERE c.election_id = $1 AND c.sim_id = $2 AND NOT e.settled`, req.Election, s.ID).Scan(&kind, &commune, &opens, &votes); err != nil {
			return nil, userError("Tu n'es pas candidat·e à cette élection.")
		}
		if err := campaignOpen(opens, votes, time.Now()); err != nil {
			return nil, err
		}
		where := ""
		if act.Scope == "commune" {
			if kind == "maire" {
				req.Commune = commune
			}
			if _, _, ok := world.FindCommune(s.City, req.Commune); !ok {
				if _, _, ok := world.FindCommune(s.HomeCity, req.Commune); !ok {
					return nil, userError("Choisis la commune.")
				}
			}
			where = req.Commune
		}
		label := strings.ToLower(act.Label[:1]) + act.Label[1:]
		if where != "" {
			label += " (" + communeName(where) + ")"
		}
		if err := charge(ctx, tx, s.ID, act.Cost, "Campagne : "+label+"."); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO campaign_acts (election_id, sim_id, kind, commune, cost, points) VALUES ($1, $2, $3, $4, $5, $6)`, req.Election, s.ID, act.ID, where, act.Cost, act.Points); err != nil {
			return nil, err
		}
		return map[string]any{"text": act.Blurb}, nil
	})
}

func (h *Handler) vote(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Election  int64  `json:"election"`
		Candidate string `json:"candidate"`
		At        string `json:"at"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		if !s.Adult {
			return nil, userError("On vote à partir de 18 ans.")
		}
		var kind, commune string
		var votesAt, closes, results time.Time
		if err := tx.QueryRow(ctx, `SELECT kind, commune, votes_at, closes_at, results_at FROM elections WHERE id = $1 AND NOT settled`, req.Election).Scan(&kind, &commune, &votesAt, &closes, &results); err != nil {
			return nil, userError("Cette élection est passée.")
		}
		now := time.Now()
		if now.Before(votesAt) {
			return nil, userError("Le vote ouvre " + frenchDate(votesAt) + ". D'ici là, lis les programmes.")
		}
		if now.After(closes) {
			return nil, userError("Le vote est clos : les résultats tombent " + frenchDate(results) + ".")
		}
		// At a town hall: the commune's own for its mayor, any of the city's for the president.
		_, c, p, ok := world.FindPlace(req.At)
		if !ok || p.Kind != "mairie" {
			return nil, userError("On vote à la mairie : va dans une mairie, puis vote depuis ton téléphone.")
		}
		if kind == "maire" && (c.ID != commune || s.HomeCommune != commune) {
			return nil, userError("Pour le maire, on vote à la mairie de sa commune : la mairie " + communeDe(commune) + ".")
		}
		var exists bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM candidates WHERE election_id = $1 AND sim_id = $2)`, req.Election, req.Candidate).Scan(&exists)
		if !exists {
			return nil, userError("Ce candidat n'est pas sur la liste.")
		}
		var was bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM ballots WHERE election_id = $1 AND user_id = $2)`, req.Election, auth.UserID(ctx)).Scan(&was)
		if was {
			return nil, userError("Tu as déjà voté à cette élection (un vote par joueur).")
		}
		if _, err := tx.Exec(ctx, `INSERT INTO ballots (election_id, user_id, candidate) VALUES ($1, $2, $3)`, req.Election, auth.UserID(ctx), req.Candidate); err != nil {
			return nil, err
		}
		_ = note(ctx, tx, s.ID, "Politique : tu as voté à la "+p.Name+". L'encre sur ton doigt le prouve.", 0)
		return map[string]any{"text": "Bulletin dans l'urne ! Les résultats tombent " + frenchDate(results) + "."}, nil
	})
}

// popularity: what the candidate is worth before any campaign: friends and the party's members.
func popularity(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, simID string) int {
	var friends, members int
	_ = q.QueryRow(ctx, `SELECT count(*) FROM bonds WHERE (sim_a = $1 OR sim_b = $1) AND friends`, simID).Scan(&friends)
	_ = q.QueryRow(ctx, `SELECT count(*) FROM party_members WHERE party_id = (SELECT party_id FROM party_members WHERE sim_id = $1)`, simID).Scan(&members)
	return friends*2 + members*3
}

// Settle counts an election whose results are due: the players' ballots, each worth
// PlayerWeight, and the crowd, split by what each campaign won over (its points, its
// popularity, a little luck; the president's crowd commune by commune, and the
// outgoing president's rating with it); the winner takes office, the next opens.
func (h *Handler) Settle(ctx context.Context) error {
	rows, err := h.DB.Query(ctx, `SELECT id, kind, commune, results_at FROM elections WHERE NOT settled AND results_at <= now() ORDER BY results_at, kind DESC`)
	if err != nil {
		return err
	}
	type el struct {
		id      int64
		kind    string
		commune string
		closes  time.Time
	}
	var list []el
	for rows.Next() {
		var e el
		if err := rows.Scan(&e.id, &e.kind, &e.commune, &e.closes); err == nil {
			list = append(list, e)
		}
	}
	rows.Close()
	for _, e := range list {
		if err := h.settleOne(ctx, e.id, e.kind, e.commune, e.closes); err != nil {
			log.Printf("politics: election %d: %v", e.id, err)
		}
	}
	if len(list) > 0 {
		return h.ensure(ctx)
	}
	return nil
}

func (h *Handler) settleOne(ctx context.Context, id int64, kind, commune string, results time.Time) error {
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	cands, err := h.candidatesOf(ctx, tx, id, commune)
	if err != nil {
		return err
	}
	// The crowd's votes for each: the mayor's in the commune; the president's commune by
	// commune, each its share, where the tours and the posters count with the radio and the meeting.
	areas := []string{commune}
	if kind == "president" {
		areas = areas[:0]
		for _, m := range mayoralCommunes() {
			areas = append(areas, m.ID)
		}
	}
	crowd := CrowdMayor
	if kind == "president" {
		crowd = CrowdPresident
	}
	base := make([]float64, len(cands))
	for i, c := range cands {
		f := fnv.New32a()
		_, _ = f.Write([]byte(fmt.Sprintf("%d|%s", id, c.Sim)))
		luck := 0.9 + float64(f.Sum32()%2000)/10000 // 0.9 … 1.1
		base[i] = luck * ratingFactor(ctx, tx, c.Sim)
	}
	npc := make([]int, len(cands))
	pop := make([]float64, len(cands))
	for i, c := range cands {
		pop[i] = float64(popularity(ctx, tx, c.Sim))
	}
	for _, area := range areas {
		share := float64(crowd) / float64(len(areas))
		weights := make([]float64, len(cands))
		var total float64
		for i, c := range cands {
			var pts int64
			_ = tx.QueryRow(ctx, `SELECT COALESCE(sum(points), 0) FROM campaign_acts WHERE election_id = $1 AND sim_id = $2 AND (commune = '' OR commune = $3)`, id, c.Sim, area).Scan(&pts)
			weights[i] = (20 + float64(pts) + pop[i]) * base[i]
			total += weights[i]
		}
		for i := range cands {
			if total > 0 {
				npc[i] += int(share * weights[i] / total)
			}
		}
	}
	var turnout int
	winner, best := "", -1
	for i, c := range cands {
		var votes int
		_ = tx.QueryRow(ctx, `SELECT count(*) FROM ballots WHERE election_id = $1 AND candidate = $2`, id, c.Sim).Scan(&votes)
		score := votes*PlayerWeight + npc[i]
		if _, err := tx.Exec(ctx, `UPDATE candidates SET votes = $1, npc_votes = $2 WHERE election_id = $3 AND sim_id = $4`, votes, npc[i], id, c.Sim); err != nil {
			return err
		}
		turnout += score
		cands[i].Votes, cands[i].NpcVotes = votes, npc[i]
		if score > best {
			winner, best = c.Sim, score
		}
	}
	var w any
	if winner != "" {
		w = winner
	}
	if _, err := tx.Exec(ctx, `UPDATE elections SET settled = true, winner = $1, turnout = $2 WHERE id = $3`, w, turnout, id); err != nil {
		return err
	}
	// What the militants didn't take goes back to the candidates who called them.
	if err := refundCalls(ctx, tx, id); err != nil {
		return err
	}
	if winner == "" {
		if kind == "president" {
			// Nobody stood: the old government goes all the same, the week has no president.
			if _, err := tx.Exec(ctx, `DELETE FROM offices WHERE office = 'president' OR office LIKE 'ministre:%' OR office LIKE 'depute:%'`); err != nil {
				return err
			}
		}
		return tx.Commit(ctx)
	}
	// Till the next results (a Monday at 9 h): the next election opens on the same calendar.
	_, _, _, until := game.ElectionWeek(results)
	var name, acronym string
	_ = tx.QueryRow(ctx, `SELECT s.first_name || ' ' || s.last_name, COALESCE(p.acronym, '') FROM sims s LEFT JOIN party_members m ON m.sim_id = s.id LEFT JOIN parties p ON p.id = m.party_id WHERE s.id = $1`, winner).Scan(&name, &acronym)
	share := 0
	if turnout > 0 {
		share = best * 100 / turnout
	}
	with := ""
	if acronym != "" {
		with = " (" + acronym + ")"
	}
	var news push.Message
	residents := ""
	if kind == "president" {
		// The old government goes with its president.
		if _, err := tx.Exec(ctx, `DELETE FROM offices WHERE office = 'president' OR office LIKE 'ministre:%' OR office LIKE 'depute:%'`); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO offices (office, sim_id, until, election_id) VALUES ('president', $1, $2, $3)`, winner, until, id); err != nil {
			return err
		}
		text := fmt.Sprintf("Présidentielle : %s%s élu·e président·e avec %d %% des voix, pour la semaine. Son discours et ses mesures arrivent dans l'appli Politique.", name, with, share)
		if _, err := tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) SELECT id, 'politique', $1, 0, $2 FROM sims`, text, game.MinuteOf(time.Now())); err != nil {
			return err
		}
		_ = note(ctx, tx, winner, "Tu es élu·e président·e de la République pour la semaine ! Fais ton discours à la nation, décrète tes deux mesures, nomme tes ministres et les députés depuis l'appli Politique : ils t'attendent au Palais.", 0)
		news = push.Message{Title: "Nouveau président·e : " + name, Body: fmt.Sprintf("%s%s est élu·e avec %d %% des voix. Son discours arrive.", name, with, share), URL: "/jeu", Tag: "presidentielle"}
	} else {
		office := "maire:" + commune
		if _, err := tx.Exec(ctx, `INSERT INTO offices (office, sim_id, until, election_id) VALUES ($1, $2, $3, $4) ON CONFLICT (office) DO UPDATE SET sim_id = EXCLUDED.sim_id, since = now(), until = EXCLUDED.until, paid_until = NULL, election_id = EXCLUDED.election_id`, office, winner, until, id); err != nil {
			return err
		}
		text := fmt.Sprintf("Municipales : %s%s élu·e maire %s avec %d %% des voix.", name, with, communeDe(commune), share)
		if _, err := tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) SELECT id, 'politique', $1, 0, $2 FROM sims WHERE home_commune = $3`, text, game.MinuteOf(time.Now()), commune); err != nil {
			return err
		}
		_ = note(ctx, tx, winner, "Tu es élu·e maire "+communeDe(commune)+" ! Ton bureau t'attend à la mairie ; parle à ta commune depuis l'appli Politique.", 0)
		news = push.Message{Title: "Nouveau maire " + communeDe(commune), Body: text, URL: "/jeu", Tag: "municipales-" + commune}
		residents = commune
	}
	// The others hear it too.
	for _, c := range cands {
		if c.Sim != winner {
			_ = note(ctx, tx, c.Sim, fmt.Sprintf("Élection : %s l'emporte avec %d %% des voix. Tu as eu %d voix. La prochaine : candidatures dès maintenant, campagne vendredi à 18 h, vote dimanche.", name, share, c.Votes*PlayerWeight+c.NpcVotes), 0)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	h.changed(winner)
	if kind == "president" {
		h.Push.ToAll(news)
	} else {
		h.Push.ToCommune(residents, news)
	}
	return nil
}

// mandatesInMonth: the presidencies a Sim won whose week starts in the month of a moment.
func mandatesInMonth(ctx context.Context, q pgx.Tx, sim string, at time.Time) (int, error) {
	var n int
	err := q.QueryRow(ctx, `SELECT count(*) FROM elections WHERE kind = 'president' AND settled AND winner = $1 AND date_trunc('month', results_at) = date_trunc('month', $2::timestamptz)`, sim, at).Scan(&n)
	return n, err
}

// campaignOpen: whether one may campaign now (from Friday 18 h to the vote), or why not.
func campaignOpen(opens, votes, now time.Time) error {
	switch {
	case now.Before(opens):
		return userError("La campagne ouvre " + frenchDate(opens) + ". D'ici là : ton programme, ton parti, tes militants.")
	case !now.Before(votes):
		return userError("La campagne est close : place au vote.")
	}
	return nil
}

// ratingFactor: the outgoing president's rating weighs on their campaign: from 0,8 (1 star
// on average) to 1,2 (5 stars), once ten citizens have said; 1 for anyone else.
func ratingFactor(ctx context.Context, q pgx.Tx, sim string) float64 {
	var avg float64
	var n int
	err := q.QueryRow(ctx, `SELECT COALESCE(avg(r.score), 0), count(*) FROM offices o JOIN president_ratings r ON r.election_id = o.election_id WHERE o.office = 'president' AND o.sim_id = $1`, sim).Scan(&avg, &n)
	if err != nil || n < 10 {
		return 1
	}
	return 0.8 + 0.1*(avg-1)
}

/* ---------- the government and the mayors ---------- */

type Holder struct {
	Office   string          `json:"office"`
	Label    string          `json:"label"`
	Sim      string          `json:"sim"`
	Name     string          `json:"name"`
	Username string          `json:"username,omitempty"`
	Gender   string          `json:"gender"`
	Look     json.RawMessage `json:"look"`
	Acronym  string          `json:"acronym,omitempty"`
	Color    string          `json:"color,omitempty"`
	Since    time.Time       `json:"since"`
	Until    time.Time       `json:"until"`
}

// OfficeLabel: how an office is called (« Président·e », « Ministre de la Santé », « Député·e de Cocody », « Maire de Cocody »).
func OfficeLabel(office, gender string) string {
	e := "·e"
	if gender == "femme" {
		e = "e"
	} else if gender == "homme" {
		e = ""
	}
	switch {
	case office == "president":
		return "Président" + e
	case strings.HasPrefix(office, "ministre:"):
		for _, p := range Portfolios {
			if p.ID == strings.TrimPrefix(office, "ministre:") {
				return p.Label
			}
		}
		return "Ministre"
	case strings.HasPrefix(office, "depute:"):
		return "Député" + e + " " + communeDe(strings.TrimPrefix(office, "depute:"))
	case strings.HasPrefix(office, "maire:"):
		return "Maire " + communeDe(strings.TrimPrefix(office, "maire:"))
	}
	return office
}

func (h *Handler) holders(ctx context.Context, where string, args ...any) ([]Holder, error) {
	rows, err := h.DB.Query(ctx, `SELECT o.office, o.sim_id, s.first_name || ' ' || s.last_name, COALESCE(u.username, ''), s.gender, s.look, COALESCE(p.acronym, ''), COALESCE(p.color, ''), o.since, o.until
		FROM offices o JOIN sims s ON s.id = o.sim_id JOIN users u ON u.id = s.user_id LEFT JOIN party_members m ON m.sim_id = s.id LEFT JOIN parties p ON p.id = m.party_id
		WHERE o.until > now() AND `+where+` ORDER BY o.office`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Holder{}
	for rows.Next() {
		var x Holder
		if err := rows.Scan(&x.Office, &x.Sim, &x.Name, &x.Username, &x.Gender, &x.Look, &x.Acronym, &x.Color, &x.Since, &x.Until); err != nil {
			return nil, err
		}
		x.Label = OfficeLabel(x.Office, x.Gender)
		out = append(out, x)
	}
	return out, rows.Err()
}

// government: everyone in office now: the president, the ministers, the deputies, the mayors.
func (h *Handler) government(w http.ResponseWriter, r *http.Request) {
	list, err := h.holders(r.Context(), "TRUE")
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"holders": list, "portfolios": Portfolios})
}

// name: the president names a minister or a deputy ({office, sim}); sim "" takes the office back.
func (h *Handler) name(w http.ResponseWriter, r *http.Request) {
	var req struct{ Office, Sim string }
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		var until time.Time
		if err := tx.QueryRow(ctx, `SELECT until FROM offices WHERE office = 'president' AND sim_id = $1 AND until > now()`, s.ID).Scan(&until); err != nil {
			return nil, userError("Seul·e le·la président·e nomme le gouvernement.")
		}
		ok := false
		if p, found := strings.CutPrefix(req.Office, "ministre:"); found {
			for _, x := range Portfolios {
				ok = ok || x.ID == p
			}
		} else if c, found := strings.CutPrefix(req.Office, "depute:"); found {
			for _, m := range mayoralCommunes() {
				ok = ok || m.ID == c
			}
		}
		if !ok {
			return nil, userError("poste inconnu")
		}
		if req.Sim == "" {
			if _, err := tx.Exec(ctx, `DELETE FROM offices WHERE office = $1`, req.Office); err != nil {
				return nil, err
			}
			return map[string]any{"text": "Le poste est libre."}, nil
		}
		var first, gender string
		if err := tx.QueryRow(ctx, `SELECT first_name, gender FROM sims WHERE id = $1`, req.Sim).Scan(&first, &gender); err != nil {
			return nil, userError("Ce perso n'existe pas.")
		}
		if req.Sim == s.ID {
			return nil, userError("Tu es déjà président·e : nomme quelqu'un d'autre.")
		}
		var held string
		if err := tx.QueryRow(ctx, `SELECT office FROM offices WHERE sim_id = $1 AND until > now() AND office <> $2 LIMIT 1`, req.Sim, req.Office).Scan(&held); err == nil {
			return nil, userError(first + " a déjà un poste : " + OfficeLabel(held, gender) + ".")
		}
		if _, err := tx.Exec(ctx, `INSERT INTO offices (office, sim_id, until, named_by) VALUES ($1, $2, $3, $4) ON CONFLICT (office) DO UPDATE SET sim_id = EXCLUDED.sim_id, since = now(), until = EXCLUDED.until, named_by = EXCLUDED.named_by, paid_until = NULL`, req.Office, req.Sim, until, s.ID); err != nil {
			return nil, err
		}
		label := OfficeLabel(req.Office, gender)
		_ = note(ctx, tx, req.Sim, "Le·la président·e "+s.First+" te nomme "+lowerFirst(label)+" ! Tu sièges au Palais présidentiel, payé·e chaque jour.", 0)
		h.changed(req.Sim)
		return map[string]any{"text": first + " est nommé·e " + lowerFirst(label) + "."}, nil
	})
}

// communique: the mayor speaks to the commune (a line in every resident's journal, one a day).
func (h *Handler) communique(w http.ResponseWriter, r *http.Request) {
	var req struct{ Text string }
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		var office string
		if err := tx.QueryRow(ctx, `SELECT office FROM offices WHERE sim_id = $1 AND office LIKE 'maire:%' AND until > now()`, s.ID).Scan(&office); err != nil {
			return nil, userError("Seul·e le·la maire parle à la commune.")
		}
		commune := strings.TrimPrefix(office, "maire:")
		if n := utf8.RuneCountInString(req.Text); n < 5 || n > 300 {
			return nil, userError("Le communiqué : de 5 à 300 lettres.")
		}
		var today bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM communiques WHERE commune = $1 AND created_at > now() - interval '24 hours')`, commune).Scan(&today)
		if today {
			return nil, userError("Un communiqué par jour : la commune a déjà eu le tien aujourd'hui.")
		}
		if _, err := tx.Exec(ctx, `INSERT INTO communiques (commune, sim_id, text) VALUES ($1, $2, $3)`, commune, s.ID, req.Text); err != nil {
			return nil, err
		}
		text := "Mairie " + communeDe(commune) + " · " + s.First + " " + s.Last + " : " + req.Text
		tag, err := tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) SELECT id, 'politique', $1, 0, $2 FROM sims WHERE home_commune = $3 OR commune = $3`, text, game.MinuteOf(time.Now()), commune)
		if err != nil {
			return nil, err
		}
		return map[string]any{"text": fmt.Sprintf("Communiqué affiché : %d habitants l'ont reçu.", tag.RowsAffected())}, nil
	})
}

// search: Sims by name, for the president's nominations (?q=).
func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if utf8.RuneCountInString(q) < 2 {
		httpx.JSON(w, http.StatusOK, map[string]any{"sims": []any{}})
		return
	}
	rows, err := h.DB.Query(r.Context(), `SELECT s.id, s.first_name, s.last_name, COALESCE(u.username, ''), s.home_commune FROM sims s JOIN users u ON u.id = s.user_id
		WHERE s.first_name ILIKE $1 || '%' OR s.last_name ILIKE $1 || '%' OR u.username ILIKE $1 || '%' ORDER BY s.last_tick DESC LIMIT 12`, q)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	type found struct {
		ID, FirstName, LastName, Username, Commune string
	}
	out := []map[string]string{}
	for rows.Next() {
		var f found
		if rows.Scan(&f.ID, &f.FirstName, &f.LastName, &f.Username, &f.Commune) == nil {
			out = append(out, map[string]string{"id": f.ID, "firstName": f.FirstName, "lastName": f.LastName, "username": f.Username, "commune": f.Commune})
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"sims": out})
}

/* ---------- the summary for the app ---------- */

type Summary struct {
	Party       *Party         `json:"party"`
	Offices     []Holder       `json:"offices"`
	Crew        *Crew          `json:"crew"`
	Sect        string         `json:"sect"`
	President   *Election      `json:"president"`
	LastPres    *Election      `json:"lastPresident"`
	Mayor       *Election      `json:"mayor"`
	LastMayor   *Election      `json:"lastMayor"`
	Government  []Holder       `json:"government"`
	Holders     []Holder       `json:"mayors"`
	Communiques []string       `json:"communiques"`
	Acts        []CampaignAct  `json:"campaignActs"`
	Sects       []Sect         `json:"sects"`
	Fees        map[string]int `json:"fees"`
	Pay         map[string]int `json:"pay"`
	Deposits    map[string]int `json:"deposits"`
	Weight      int            `json:"playerWeight"`
	// The president's week (presidency.go), the measures one may decree, the presidencies the
	// Sim may still win this month, the calls it made as a candidate, its meetings.
	Week         *Week          `json:"week"`
	Measures     []game.Measure `json:"measures"`
	MandatesLeft int            `json:"mandatesLeft"`
	MyCalls      []MilitCall    `json:"myCalls"`
	MyEvents     []StateEvent   `json:"myEvents"`
	Events       []StateEvent   `json:"events"`
	Rules        map[string]int `json:"rules"`
}

func (h *Handler) summary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	s, err := h.mine(ctx, tx, r)
	_ = tx.Rollback(ctx)
	if err != nil {
		fail(w, err)
		return
	}
	// An election closed since the clock's last look: its results now, not ten minutes on.
	if err := h.Settle(ctx); err != nil {
		log.Printf("politics: settle: %v", err)
	}
	if err := h.ensure(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	user := auth.UserID(ctx)
	out := Summary{Sect: s.Sect, Acts: CampaignActs, Sects: Sects, Fees: map[string]int{"party": PartyFee, "crew": CrewFee}, Pay: map[string]int{"president": PayPresident, "ministre": PayMinister, "depute": PayDeputy, "maire": PayMayor}, Deposits: map[string]int{"president": DepositPresident, "maire": DepositMayor}, Weight: PlayerWeight}
	if rows, err := h.DB.Query(ctx, partiesSQL+` JOIN party_members mm ON mm.party_id = p.id WHERE mm.sim_id = $1`, s.ID); err == nil {
		if list, err := scanParties(rows); err == nil && len(list) > 0 {
			out.Party = &list[0]
		}
	}
	out.Offices, _ = h.holders(ctx, "o.sim_id = $1", s.ID)
	out.Crew, _ = h.crewOf(ctx, s.ID)
	out.President, _ = h.current(ctx, "president", "", user)
	out.LastPres, _ = h.last(ctx, "president", "")
	out.Mayor, _ = h.current(ctx, "maire", s.HomeCommune, user)
	out.LastMayor, _ = h.last(ctx, "maire", s.HomeCommune)
	out.Government, _ = h.holders(ctx, "o.office NOT LIKE 'maire:%'")
	out.Holders, _ = h.holders(ctx, "o.office LIKE 'maire:%'")
	out.Week, _ = h.week(ctx, user)
	out.Measures = game.Measures
	if out.President != nil {
		var won int
		_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM elections WHERE kind = 'president' AND settled AND winner = $1 AND date_trunc('month', results_at) = date_trunc('month', $2::timestamptz)`, s.ID, out.President.ResultsAt).Scan(&won)
		out.MandatesLeft = max(0, game.MandatesAMonth-won)
	}
	out.MyCalls, _ = h.calls(ctx, `c.sim_id = $1 AND NOT c.settled`, s.ID)
	out.MyEvents, _ = h.stateEvents(ctx, `e.sim_id = $1 AND e.ends_at > now()`, s.ID)
	out.Events, _ = h.stateEvents(ctx, `e.ends_at > now()`)
	out.Rules = map[string]int{"tourCost": game.TourCost, "tourPoints": game.TourPoints, "militantPoints": game.MilitantPoints, "meetingCost": game.MeetingCost, "meetingPoints": game.MeetingPoints, "meetingGuest": game.MeetingGuest, "meetingGuests": game.MeetingGuests,
		"feteHours": game.FeteHours, "meetingHours": game.MeetingHours, "payMin": game.MilitantPayMin, "payMax": game.MilitantPayMax, "slotsMax": game.MilitantSlotMax, "measures": game.MeasuresAMandate, "mandatesAMonth": game.MandatesAMonth}
	out.Communiques = []string{}
	if rows, err := h.DB.Query(ctx, `SELECT text FROM communiques WHERE commune = $1 ORDER BY created_at DESC LIMIT 5`, s.HomeCommune); err == nil {
		for rows.Next() {
			var t string
			if rows.Scan(&t) == nil {
				out.Communiques = append(out.Communiques, t)
			}
		}
		rows.Close()
	}
	httpx.JSON(w, http.StatusOK, out)
}

/* ---------- crews: the players' gangs ---------- */

type Crew struct {
	ID       int64        `json:"id"`
	Name     string       `json:"name"`
	Tag      string       `json:"tag"`
	Color    string       `json:"color"`
	Commune  string       `json:"commune"`
	Leader   string       `json:"leader"`
	LeaderNm string       `json:"leaderName"`
	Treasury int          `json:"treasury"`
	Members  []CrewMember `json:"members,omitempty"`
	Size     int          `json:"size"`
	// For the one asking: a request waiting (theirs, or those the leader must answer).
	Asked    bool         `json:"asked,omitempty"`
	Requests []CrewMember `json:"requests,omitempty"`
}

type CrewMember struct {
	Sim      string `json:"sim"`
	Name     string `json:"name"`
	Username string `json:"username,omitempty"`
	Role     string `json:"role"`
}

const crewsSQL = `SELECT c.id, c.name, c.tag, c.color, c.commune, c.leader, s.first_name, c.treasury, (SELECT count(*) FROM crew_members m WHERE m.crew_id = c.id)
	FROM crews c JOIN sims s ON s.id = c.leader`

func scanCrews(rows pgx.Rows) ([]Crew, error) {
	defer rows.Close()
	out := []Crew{}
	for rows.Next() {
		var c Crew
		if err := rows.Scan(&c.ID, &c.Name, &c.Tag, &c.Color, &c.Commune, &c.Leader, &c.LeaderNm, &c.Treasury, &c.Size); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (h *Handler) members(ctx context.Context, crew int64) ([]CrewMember, error) {
	rows, err := h.DB.Query(ctx, `SELECT m.sim_id, s.first_name || ' ' || s.last_name, COALESCE(u.username, ''), m.role FROM crew_members m JOIN sims s ON s.id = m.sim_id JOIN users u ON u.id = s.user_id WHERE m.crew_id = $1 ORDER BY m.role = 'chef' DESC, m.joined_at`, crew)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CrewMember{}
	for rows.Next() {
		var m CrewMember
		if err := rows.Scan(&m.Sim, &m.Name, &m.Username, &m.Role); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// crewOf: the Sim's crew with its members, and the requests if the Sim leads it; nil: none.
func (h *Handler) crewOf(ctx context.Context, simID string) (*Crew, error) {
	rows, err := h.DB.Query(ctx, crewsSQL+` JOIN crew_members mm ON mm.crew_id = c.id WHERE mm.sim_id = $1`, simID)
	if err != nil {
		return nil, err
	}
	list, err := scanCrews(rows)
	if err != nil || len(list) == 0 {
		return nil, err
	}
	c := list[0]
	if c.Members, err = h.members(ctx, c.ID); err != nil {
		return nil, err
	}
	if c.Leader == simID {
		rows, err := h.DB.Query(ctx, `SELECT r.sim_id, s.first_name || ' ' || s.last_name, COALESCE(u.username, ''), 'demande' FROM crew_requests r JOIN sims s ON s.id = r.sim_id JOIN users u ON u.id = s.user_id WHERE r.crew_id = $1 ORDER BY r.at`, c.ID)
		if err == nil {
			c.Requests = []CrewMember{}
			for rows.Next() {
				var m CrewMember
				if rows.Scan(&m.Sim, &m.Name, &m.Username, &m.Role) == nil {
					c.Requests = append(c.Requests, m)
				}
			}
			rows.Close()
		}
	}
	return &c, nil
}

func (h *Handler) crews(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), crewsSQL+` ORDER BY 9 DESC, c.treasury DESC, c.created_at LIMIT 100`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	out, err := scanCrews(rows)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"crews": out, "fee": CrewFee})
}

var tagRe = regexp.MustCompile(`^[A-Z0-9]{2,4}$`)

func (h *Handler) foundCrew(w http.ResponseWriter, r *http.Request) {
	var req struct{ Name, Tag, Color string }
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	req.Name, req.Tag = strings.TrimSpace(req.Name), strings.ToUpper(strings.TrimSpace(req.Tag))
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		if !s.Adult {
			return nil, userError("Il faut être adulte pour monter un gang.")
		}
		if n := utf8.RuneCountInString(req.Name); n < 3 || n > 24 {
			return nil, userError("Le nom du gang : de 3 à 24 lettres.")
		}
		if !tagRe.MatchString(req.Tag) {
			return nil, userError("Le tag : 2 à 4 lettres ou chiffres (YOP, 225, BKS…).")
		}
		if !colorRe.MatchString(req.Color) {
			req.Color = "#111827"
		}
		var in bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM crew_members WHERE sim_id = $1)`, s.ID).Scan(&in)
		if in {
			return nil, userError("Tu es déjà dans un gang : quitte-le d'abord.")
		}
		if err := charge(ctx, tx, s.ID, CrewFee, "Gang : tu montes "+req.Name+" ["+req.Tag+"]."); err != nil {
			return nil, err
		}
		var id int64
		if err := tx.QueryRow(ctx, `INSERT INTO crews (name, tag, color, commune, leader) VALUES ($1, $2, $3, $4, $5) RETURNING id`, req.Name, req.Tag, req.Color, s.HomeCommune, s.ID).Scan(&id); err != nil {
			return nil, userError("Ce nom ou ce tag est déjà pris.")
		}
		if _, err := tx.Exec(ctx, `INSERT INTO crew_members (sim_id, crew_id, role) VALUES ($1, $2, 'chef')`, s.ID, id); err != nil {
			return nil, err
		}
		_, _ = tx.Exec(ctx, `DELETE FROM crew_requests WHERE sim_id = $1`, s.ID)
		return map[string]any{"id": id, "text": req.Name + " tient " + communeName(s.HomeCommune) + " ! Les autres demandent à entrer, tu décides."}, nil
	})
}

func (h *Handler) askCrew(w http.ResponseWriter, r *http.Request) {
	crew, _ := strconv.ParseInt(chi.URLParam(r, "crew"), 10, 64)
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		if !s.Adult {
			return nil, userError("Il faut être adulte pour entrer dans un gang.")
		}
		var in bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM crew_members WHERE sim_id = $1)`, s.ID).Scan(&in)
		if in {
			return nil, userError("Tu es déjà dans un gang.")
		}
		var leader, name string
		if err := tx.QueryRow(ctx, `SELECT leader, name FROM crews WHERE id = $1`, crew).Scan(&leader, &name); err != nil {
			return nil, userError("Ce gang n'existe plus.")
		}
		if _, err := tx.Exec(ctx, `INSERT INTO crew_requests (crew_id, sim_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, crew, s.ID); err != nil {
			return nil, err
		}
		_ = note(ctx, tx, leader, "Gang : "+s.First+" "+s.Last+" demande à entrer dans "+name+". Réponds depuis l'appli Politique.", 0)
		h.changed(leader)
		return map[string]any{"text": "Demande envoyée au chef de " + name + "."}, nil
	})
}

// leaderOf: the crew the Sim leads, or an error.
func leaderOf(ctx context.Context, tx pgx.Tx, simID string) (int64, string, error) {
	var id int64
	var name string
	if err := tx.QueryRow(ctx, `SELECT id, name FROM crews WHERE leader = $1`, simID).Scan(&id, &name); err != nil {
		return 0, "", userError("Seul le chef du gang décide de ça.")
	}
	return id, name, nil
}

func (h *Handler) acceptCrew(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Sim string `json:"sim"`
		No  bool   `json:"no"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		crew, name, err := leaderOf(ctx, tx, s.ID)
		if err != nil {
			return nil, err
		}
		tag, err := tx.Exec(ctx, `DELETE FROM crew_requests WHERE crew_id = $1 AND sim_id = $2`, crew, req.Sim)
		if err != nil || tag.RowsAffected() == 0 {
			return nil, userError("Cette demande n'est plus là.")
		}
		if req.No {
			_ = note(ctx, tx, req.Sim, "Gang : "+name+" ne te prend pas. Pour l'instant.", 0)
			h.changed(req.Sim)
			return nil, nil
		}
		var in bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM crew_members WHERE sim_id = $1)`, req.Sim).Scan(&in)
		if in {
			return nil, userError("Cette personne est déjà dans un gang.")
		}
		if _, err := tx.Exec(ctx, `INSERT INTO crew_members (sim_id, crew_id) VALUES ($1, $2)`, req.Sim, crew); err != nil {
			return nil, err
		}
		_ = note(ctx, tx, req.Sim, "Gang : tu es dans "+name+" ! Ton tag s'affiche au-dessus de toi.", 0)
		h.changed(req.Sim)
		return map[string]any{"text": "Un de plus dans " + name + "."}, nil
	})
}

func (h *Handler) kickCrew(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Sim  string `json:"sim"`
		Role string `json:"role"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		crew, name, err := leaderOf(ctx, tx, s.ID)
		if err != nil {
			return nil, err
		}
		if req.Sim == s.ID {
			return nil, userError("Le chef ne se vire pas : quitte le gang.")
		}
		// A role given instead (bras droit, membre), or out.
		if req.Role == "bras-droit" || req.Role == "membre" {
			if _, err := tx.Exec(ctx, `UPDATE crew_members SET role = $1 WHERE crew_id = $2 AND sim_id = $3`, req.Role, crew, req.Sim); err != nil {
				return nil, err
			}
			return map[string]any{"text": "C'est fait."}, nil
		}
		if _, err := tx.Exec(ctx, `DELETE FROM crew_members WHERE crew_id = $1 AND sim_id = $2`, crew, req.Sim); err != nil {
			return nil, err
		}
		_ = note(ctx, tx, req.Sim, "Gang : le chef de "+name+" t'a mis dehors.", 0)
		h.changed(req.Sim)
		return map[string]any{"text": "Dehors."}, nil
	})
}

func (h *Handler) leaveCrew(w http.ResponseWriter, r *http.Request) {
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		var crew int64
		var leader, name string
		if err := tx.QueryRow(ctx, `SELECT c.id, c.leader, c.name FROM crew_members m JOIN crews c ON c.id = m.crew_id WHERE m.sim_id = $1`, s.ID).Scan(&crew, &leader, &name); err != nil {
			return nil, userError("Tu n'es dans aucun gang.")
		}
		if _, err := tx.Exec(ctx, `DELETE FROM crew_members WHERE sim_id = $1`, s.ID); err != nil {
			return nil, err
		}
		if leader == s.ID {
			var next string
			if err := tx.QueryRow(ctx, `SELECT sim_id FROM crew_members WHERE crew_id = $1 ORDER BY role = 'bras-droit' DESC, joined_at LIMIT 1`, crew).Scan(&next); err == nil {
				_, _ = tx.Exec(ctx, `UPDATE crews SET leader = $1 WHERE id = $2`, next, crew)
				_, _ = tx.Exec(ctx, `UPDATE crew_members SET role = 'chef' WHERE sim_id = $1`, next)
				_ = note(ctx, tx, next, "Gang : le chef est parti, "+name+" est à toi maintenant.", 0)
				h.changed(next)
			} else {
				_, _ = tx.Exec(ctx, `DELETE FROM crews WHERE id = $1`, crew)
			}
		}
		_ = note(ctx, tx, s.ID, "Gang : tu quittes "+name+".", 0)
		return nil, nil
	})
}

// fundCrew: a member puts Djai in the gang's caisse (its rank among the gangs).
func (h *Handler) fundCrew(w http.ResponseWriter, r *http.Request) {
	var req struct{ Amount int }
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		if req.Amount < 1000 || req.Amount > 10_000_000 {
			return nil, userError("De 1 000 à 10 000 000 F.")
		}
		var crew int64
		var name string
		if err := tx.QueryRow(ctx, `SELECT c.id, c.name FROM crew_members m JOIN crews c ON c.id = m.crew_id WHERE m.sim_id = $1`, s.ID).Scan(&crew, &name); err != nil {
			return nil, userError("Tu n'es dans aucun gang.")
		}
		if err := charge(ctx, tx, s.ID, req.Amount, "Gang : ta part dans la caisse de "+name+"."); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE crews SET treasury = treasury + $1 WHERE id = $2`, req.Amount, crew); err != nil {
			return nil, err
		}
		return map[string]any{"text": "La caisse de " + name + " grossit."}, nil
	})
}

/* ---------- sects ---------- */

func (h *Handler) setSect(w http.ResponseWriter, r *http.Request) {
	var req struct{ Sect string }
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.inTx(w, r, func(ctx context.Context, tx pgx.Tx, s sim) (any, error) {
		if req.Sect == "" {
			if s.Sect == "" {
				return nil, userError("Tu n'es dans aucune société.")
			}
			if _, err := tx.Exec(ctx, `UPDATE sims SET sect = '', sect_since = NULL WHERE id = $1`, s.ID); err != nil {
				return nil, err
			}
			_ = note(ctx, tx, s.ID, "Tu quittes "+sectOf(s.Sect).Name+". Les frères ne te saluent plus.", 0)
			return map[string]any{"text": "Tu es sorti·e. On ne parle plus de ça."}, nil
		}
		if !s.Adult {
			return nil, userError("Les sociétés n'initient que les adultes.")
		}
		sect := sectOf(req.Sect)
		if sect == nil {
			return nil, userError("société inconnue")
		}
		if s.Sect != "" {
			return nil, userError("On n'est que d'une société à la fois : quitte la tienne d'abord.")
		}
		if err := charge(ctx, tx, s.ID, sect.Fee, "Ton initiation : "+sect.Name+". « "+sect.Motto+" »"); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE sims SET sect = $1, sect_since = now() WHERE id = $2`, sect.ID, s.ID); err != nil {
			return nil, err
		}
		return map[string]any{"text": "Tu es des leurs. " + sect.Perk + " Chaque lundi, " + thousands(sect.Dues) + " F pour la loge."}, nil
	})
}

/* ---------- the clock: pay, dues ---------- */

// Watch, until ctx ends: the elections opened and settled, the offices paid
// their day, the sects' dues taken each Monday.
func (h *Handler) Watch(ctx context.Context, every time.Duration) {
	t := time.NewTimer(20 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := h.ensure(ctx); err != nil {
				log.Printf("politics: elections: %v", err)
			}
			if err := h.Settle(ctx); err != nil {
				log.Printf("politics: settle: %v", err)
			}
			if err := h.paySalaries(ctx); err != nil {
				log.Printf("politics: pay: %v", err)
			}
			if err := h.takeDues(ctx); err != nil {
				log.Printf("politics: dues: %v", err)
			}
			t.Reset(every)
		}
	}
}

// paySalaries: each office its day's pay, once a day.
func (h *Handler) paySalaries(ctx context.Context) error {
	rows, err := h.DB.Query(ctx, `SELECT o.office, o.sim_id, s.gender FROM offices o JOIN sims s ON s.id = o.sim_id WHERE o.until > now() AND (o.paid_until IS NULL OR o.paid_until < CURRENT_DATE)`)
	if err != nil {
		return err
	}
	type due struct{ office, sim, gender string }
	var list []due
	for rows.Next() {
		var d due
		if rows.Scan(&d.office, &d.sim, &d.gender) == nil {
			list = append(list, d)
		}
	}
	rows.Close()
	for _, d := range list {
		amount := PayMayor
		switch {
		case d.office == "president":
			amount = PayPresident
		case strings.HasPrefix(d.office, "ministre:"):
			amount = PayMinister
		case strings.HasPrefix(d.office, "depute:"):
			amount = PayDeputy
		}
		tx, err := h.DB.Begin(ctx)
		if err != nil {
			return err
		}
		tag, err := tx.Exec(ctx, `UPDATE offices SET paid_until = CURRENT_DATE WHERE office = $1 AND sim_id = $2 AND (paid_until IS NULL OR paid_until < CURRENT_DATE)`, d.office, d.sim)
		if err == nil && tag.RowsAffected() == 1 {
			err = pay(ctx, tx, d.sim, amount, "L'État te paie ta journée : "+lowerFirst(OfficeLabel(d.office, d.gender))+".")
		}
		if err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		h.changed(d.sim)
	}
	return nil
}

// takeDues: each Monday the sects take their dues; who can't pay is out. The
// Enfants de la Lumière's scandal, one Monday in ten.
func (h *Handler) takeDues(ctx context.Context) error {
	now := time.Now()
	if now.Weekday() != time.Monday {
		return nil
	}
	rows, err := h.DB.Query(ctx, `SELECT id, sect, money FROM sims WHERE sect <> '' AND (sect_since IS NULL OR sect_since < date_trunc('day', now()))`)
	if err != nil {
		return err
	}
	type m struct {
		id, sect string
		money    int
	}
	var list []m
	for rows.Next() {
		var x m
		if rows.Scan(&x.id, &x.sect, &x.money) == nil {
			list = append(list, x)
		}
	}
	rows.Close()
	for _, x := range list {
		sect := sectOf(x.sect)
		if sect == nil {
			continue
		}
		tx, err := h.DB.Begin(ctx)
		if err != nil {
			return err
		}
		// Marked as taken for the day first: not twice the same Monday.
		tag, err := tx.Exec(ctx, `UPDATE sims SET sect_since = now() WHERE id = $1 AND sect = $2 AND (sect_since IS NULL OR sect_since < date_trunc('day', now()))`, x.id, x.sect)
		if err != nil || tag.RowsAffected() == 0 {
			_ = tx.Rollback(ctx)
			continue
		}
		if err := charge(ctx, tx, x.id, sect.Dues, "La loge passe : tes cotisations à "+sect.Name+"."); errors.Is(err, errMoney) {
			_, _ = tx.Exec(ctx, `UPDATE sims SET sect = '', sect_since = NULL WHERE id = $1`, x.id)
			_ = note(ctx, tx, x.id, sect.Name+" : tu ne peux pas payer. Les frères t'oublient : tu n'en es plus.", 0)
		} else if err != nil {
			_ = tx.Rollback(ctx)
			return err
		} else if sect.ID == "lumiere" {
			f := fnv.New32a()
			_, _ = f.Write([]byte(x.id + now.Format("2006-01-02")))
			if f.Sum32()%10 == 0 {
				_ = charge(ctx, tx, x.id, 10_000, "Scandale : on a parlé de la loge. Pour faire taire, 10 000 F.")
			}
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		h.changed(x.id)
	}
	return nil
}

/* ---------- words ---------- */

func communeName(id string) string {
	for _, c := range world.Cities {
		for _, m := range c.Communes {
			if m.ID == id {
				return m.Name
			}
		}
	}
	return id
}

// communeDe: « de Cocody », « d'Abobo », « du Plateau ».
func communeDe(id string) string {
	name := communeName(id)
	if name == "" {
		return ""
	}
	if name == "Plateau" {
		return "du Plateau"
	}
	switch strings.ToUpper(name[:1]) {
	case "A", "E", "I", "O", "U":
		return "d'" + name
	}
	return "de " + name
}

func lowerFirst(s string) string {
	if s == "" {
		return s
	}
	r := []rune(s)
	r[0] = []rune(strings.ToLower(string(r[0])))[0]
	return string(r)
}

var frenchDays = []string{"dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"}

// frenchDate: « samedi 25 octobre à 18 h » (Abidjan's clock is UTC).
func frenchDate(t time.Time) string {
	months := []string{"janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"}
	at := fmt.Sprintf("%d h", t.Hour())
	if t.Minute() != 0 {
		at = fmt.Sprintf("%d h %02d", t.Hour(), t.Minute())
	}
	return fmt.Sprintf("%s %d %s à %s", frenchDays[t.Weekday()], t.Day(), months[t.Month()-1], at)
}

func thousands(n int) string {
	s := strconv.Itoa(n)
	var b strings.Builder
	for i, r := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteRune(' ')
		}
		b.WriteRune(r)
	}
	return b.String()
}
