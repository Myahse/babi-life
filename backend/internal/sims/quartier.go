package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
)

// Mon quartier (the update « mon-quartier », game/quartier.go, web screens/Quartier.tsx): the Sim's own
// neighbourhood, beside the world of Babi. The owner shapes it (roads, water, bridges, trees), paid from its
// money. Its friends come in as they like; anyone else asks, and comes in once the owner says yes. Who is
// there sees the others live (live.go, the room « quartier:<owner> »).

// QuartierKey: the update that opens it.
const QuartierKey = "mon-quartier"

var (
	errQuartierShut   = errors.New("bientôt dans le jeu")
	errQuartierAsked  = errors.New("tu as déjà demandé : attends sa réponse")
	errQuartierFriend = errors.New("vous êtes ami·es : tu peux entrer directement")
	errQuartierSelf   = errors.New("c'est ton quartier")
	errQuartierNone   = errors.New("ce quartier n'existe pas encore")
)

func quartierOpen(ctx context.Context) bool {
	return features.Default == nil || features.Default.BlocksKey(ctx, QuartierKey) == ""
}

// CanEnterQuartier: may this Sim be in that owner's neighbourhood? Its own, a friend's, or one whose owner said yes.
func CanEnterQuartier(ctx context.Context, q rowQuerier, sim, owner string) bool {
	if sim == owner {
		return true
	}
	if areFriends(ctx, q, sim, owner) {
		return true
	}
	var ok bool
	_ = q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM quartier_requests WHERE owner = $1 AND from_sim = $2 AND status = 'ok')`, owner, sim).Scan(&ok)
	return ok
}

// quartierSeed: the land's trees and shore, drawn from its owner.
func quartierSeed(sim string) int64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(sim))
	return int64(h.Sum64() >> 1)
}

// loadQuartier: an owner's land; its own is made the first time it asks.
func loadQuartier(ctx context.Context, db interface {
	rowQuerier
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}, owner string, create bool) (string, error) {
	var grid string
	err := db.QueryRow(ctx, `SELECT grid FROM quartiers WHERE sim_id = $1`, owner).Scan(&grid)
	if errors.Is(err, pgx.ErrNoRows) && create {
		grid = game.NewQuartier(quartierSeed(owner))
		_, err = db.Exec(ctx, `INSERT INTO quartiers (sim_id, grid) VALUES ($1, $2) ON CONFLICT (sim_id) DO NOTHING`, owner, grid)
		if err == nil {
			err = db.QueryRow(ctx, `SELECT grid FROM quartiers WHERE sim_id = $1`, owner).Scan(&grid)
		}
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errQuartierNone
	}
	return grid, err
}

// quartierPerson: someone who may be in a neighbourhood (to draw them when they're there).
type quartierPerson struct {
	ID     string          `json:"id"`
	Name   string          `json:"name"`
	Gender string          `json:"gender"`
	Look   json.RawMessage `json:"look"`
	Owner  bool            `json:"owner,omitempty"`
}

// quartier: GET /sims/{id}/quartier?of=<owner> — a neighbourhood (the Sim's own when no owner is said): its
// land, its boards, who may be in it; for the owner, the requests waiting. Not let in: who owns it, and
// whether the Sim already asked.
func (h *Handler) quartier(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !quartierOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, errQuartierShut.Error())
		return
	}
	me, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	owner := r.URL.Query().Get("of")
	if owner == "" {
		owner = me
	}
	var ownerName, commune string
	if err := h.DB.QueryRow(ctx, `SELECT first_name, COALESCE(NULLIF(home_commune, ''), commune) FROM sims WHERE id::text = $1`, owner).Scan(&ownerName, &commune); err != nil {
		httpx.Error(w, http.StatusNotFound, "ce quartier n'existe pas")
		return
	}
	mine := owner == me
	if !CanEnterQuartier(ctx, h.DB, me, owner) {
		var asked bool
		_ = h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM quartier_requests WHERE owner = $1 AND from_sim = $2)`, owner, me).Scan(&asked)
		httpx.JSON(w, http.StatusOK, map[string]any{"owner": owner, "ownerName": ownerName, "locked": true, "asked": asked})
		return
	}
	grid, err := loadQuartier(ctx, h.DB, owner, mine)
	if err != nil {
		if errors.Is(err, errQuartierNone) {
			httpx.Error(w, http.StatusNotFound, err.Error())
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	// Who may be there: the owner, its friends, those it let in (drawn when they're there, live).
	rows, err := h.DB.Query(ctx, `
		SELECT s.id::text, s.first_name, s.gender, s.look, s.id = $1 FROM sims s WHERE s.id = $1
		UNION ALL
		SELECT s.id::text, s.first_name, s.gender, s.look, false FROM bonds b JOIN sims s ON s.id = CASE WHEN b.sim_a = $1 THEN b.sim_b ELSE b.sim_a END
		 WHERE (b.sim_a = $1 OR b.sim_b = $1) AND b.friends
		UNION ALL
		SELECT s.id::text, s.first_name, s.gender, s.look, false FROM quartier_requests q JOIN sims s ON s.id = q.from_sim WHERE q.owner = $1 AND q.status = 'ok'
		LIMIT 200`, owner)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	people, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (quartierPerson, error) {
		var p quartierPerson
		return p, row.Scan(&p.ID, &p.Name, &p.Gender, &p.Look, &p.Owner)
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	type request struct {
		Sim  string `json:"sim"`
		Name string `json:"name"`
	}
	requests := []request{}
	if mine {
		rows, err := h.DB.Query(ctx, `SELECT q.from_sim::text, s.first_name FROM quartier_requests q JOIN sims s ON s.id = q.from_sim WHERE q.owner = $1 AND q.status = 'pending' ORDER BY q.created_at LIMIT 50`, owner)
		if err == nil {
			requests, _ = pgx.CollectRows(rows, func(row pgx.CollectableRow) (request, error) {
				var q request
				return q, row.Scan(&q.Sim, &q.Name)
			})
		}
	}
	type board struct {
		X      int    `json:"x"`
		Y      int    `json:"y"`
		Format string `json:"format"`
	}
	boards := make([]board, 0, len(game.QuartierBoards))
	for _, b := range game.QuartierBoards {
		boards = append(boards, board{b.X, b.Y, b.Format})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"owner": owner, "ownerName": ownerName, "mine": mine, "commune": commune,
		"size": game.QuartierSize, "cell": game.QuartierCell, "grid": grid, "prices": game.QuartierPrices, "max": game.QuartierMaxPaint,
		"boards": boards, "people": people, "requests": requests,
	})
}

// quartierPaint: POST /sims/{id}/quartier/paint {cells: [{x, y, tile}]} — the Sim's land changed, cell by cell, paid.
func (h *Handler) quartierPaint(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !quartierOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, errQuartierShut.Error())
		return
	}
	var req struct {
		Cells []struct {
			X    int    `json:"x"`
			Y    int    `json:"y"`
			Tile string `json:"tile"`
		} `json:"cells"`
	}
	if err := httpx.Decode(r, &req); err != nil || len(req.Cells) == 0 {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	cells := make([]game.QuartierPaint, len(req.Cells))
	for i, c := range req.Cells {
		cells[i] = game.QuartierPaint{X: c.X, Y: c.Y, Tile: c.Tile}
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		grid, err := loadQuartier(ctx, tx, s.ID, true)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		next, cost, err := game.PaintQuartier(grid, cells)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if cost == 0 {
			return game.Outcome{Text: "Rien n'a changé."}, nil, nil
		}
		if cost > s.Money {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		if _, err := tx.Exec(ctx, `UPDATE quartiers SET grid = $2, updated_at = now() WHERE sim_id = $1`, s.ID, next); err != nil {
			return game.Outcome{}, nil, err
		}
		s.Money -= cost
		text := fmt.Sprintf("Travaux dans ton quartier : %s.", game.FCFA(cost))
		return game.Outcome{Text: text, Money: -cost}, []Event{{Kind: "bill", Text: text, Money: -cost, GameTime: s.GameMinutes}}, nil
	})
}

// quartierAsk: POST /sims/{id}/quartier/ask {owner} — asking to come into someone's neighbourhood.
func (h *Handler) quartierAsk(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !quartierOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, errQuartierShut.Error())
		return
	}
	var req struct {
		Owner string `json:"owner"`
	}
	if err := httpx.Decode(r, &req); err != nil || req.Owner == "" {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if req.Owner == s.ID {
			return game.Outcome{}, nil, errQuartierSelf
		}
		if areFriends(ctx, tx, s.ID, req.Owner) {
			return game.Outcome{}, nil, errQuartierFriend
		}
		var name string
		if err := tx.QueryRow(ctx, `SELECT first_name FROM sims WHERE id::text = $1`, req.Owner).Scan(&name); err != nil {
			return game.Outcome{}, nil, errQuartierNone
		}
		tag, err := tx.Exec(ctx, `INSERT INTO quartier_requests (owner, from_sim) VALUES ($1, $2) ON CONFLICT DO NOTHING`, req.Owner, s.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if tag.RowsAffected() == 0 {
			return game.Outcome{}, nil, errQuartierAsked
		}
		now := game.MinuteOf(time.Now())
		_ = insertEvent(ctx, tx, req.Owner, "social", fmt.Sprintf("%s demande à entrer dans ton quartier : réponds dans « Mon quartier ».", s.FirstName), 0, now)
		if h.Push != nil {
			h.Push.ToSim(req.Owner, push.Message{Title: "Babi Life · Mon quartier", Body: fmt.Sprintf("%s demande à entrer dans ton quartier", s.FirstName), URL: "/quartier", Tag: "quartier-" + s.ID})
		}
		text := fmt.Sprintf("Tu demandes à %s d'entrer dans son quartier.", name)
		return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
	})
}

// quartierAnswer: POST /sims/{id}/quartier/answer {from, ok} — the owner lets someone in, or not (ok false
// also sends away someone let in before).
func (h *Handler) quartierAnswer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !quartierOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, errQuartierShut.Error())
		return
	}
	var req struct {
		From string `json:"from"`
		OK   bool   `json:"ok"`
	}
	if err := httpx.Decode(r, &req); err != nil || req.From == "" {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		var name string
		if err := tx.QueryRow(ctx, `SELECT s.first_name FROM quartier_requests q JOIN sims s ON s.id = q.from_sim WHERE q.owner = $1 AND q.from_sim::text = $2`, s.ID, req.From).Scan(&name); err != nil {
			return game.Outcome{}, nil, errNoRequest
		}
		now := game.MinuteOf(time.Now())
		if !req.OK {
			_, err := tx.Exec(ctx, `DELETE FROM quartier_requests WHERE owner = $1 AND from_sim::text = $2`, s.ID, req.From)
			return game.Outcome{Text: fmt.Sprintf("%s n'entre pas dans ton quartier.", name)}, nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE quartier_requests SET status = 'ok' WHERE owner = $1 AND from_sim::text = $2`, s.ID, req.From); err != nil {
			return game.Outcome{}, nil, err
		}
		_ = insertEvent(ctx, tx, req.From, "social", fmt.Sprintf("%s t'ouvre son quartier : tu peux y aller depuis « Mon quartier ».", s.FirstName), 0, now)
		if h.Push != nil {
			h.Push.ToSim(req.From, push.Message{Title: "Babi Life · Mon quartier", Body: fmt.Sprintf("%s t'ouvre son quartier", s.FirstName), URL: "/quartier", Tag: "quartier-ok-" + s.ID})
		}
		text := fmt.Sprintf("%s peut entrer dans ton quartier.", name)
		return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
	})
}

// quartiers: GET /sims/{id}/quartiers — the neighbourhoods the Sim can go to (its friends', those whose owner
// let it in) and the people it knows whose door it can knock at (asked or not yet).
func (h *Handler) quartiers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !quartierOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, errQuartierShut.Error())
		return
	}
	me, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	type entry struct {
		Owner  string `json:"owner"`
		Name   string `json:"name"`
		Friend bool   `json:"friend"`
		// Open: may go in; Asked: a request waits; Built: the owner already has its land.
		Open  bool `json:"open"`
		Asked bool `json:"asked"`
		Built bool `json:"built"`
	}
	// Everyone the Sim knows (a bond: friends or met), and those who let it in.
	rows, err := h.DB.Query(ctx, `
		WITH known AS (
			SELECT CASE WHEN b.sim_a = $1 THEN b.sim_b ELSE b.sim_a END AS other, b.friends FROM bonds b WHERE b.sim_a = $1 OR b.sim_b = $1
			UNION
			SELECT q.owner, false FROM quartier_requests q WHERE q.from_sim = $1
		)
		SELECT s.id::text, s.first_name, bool_or(k.friends),
			EXISTS(SELECT 1 FROM quartier_requests q WHERE q.owner = s.id AND q.from_sim = $1 AND q.status = 'ok'),
			EXISTS(SELECT 1 FROM quartier_requests q WHERE q.owner = s.id AND q.from_sim = $1 AND q.status = 'pending'),
			EXISTS(SELECT 1 FROM quartiers x WHERE x.sim_id = s.id)
		FROM known k JOIN sims s ON s.id = k.other
		WHERE s.user_id IS NOT NULL
		GROUP BY s.id, s.first_name
		ORDER BY bool_or(k.friends) DESC, s.first_name LIMIT 100`, me)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	list, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (entry, error) {
		var e entry
		var let bool
		err := row.Scan(&e.Owner, &e.Name, &e.Friend, &let, &e.Asked, &e.Built)
		e.Open = e.Friend || let
		return e, err
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if list == nil {
		list = []entry{}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"quartiers": list})
}

// QuartierRoutes: Mon quartier's (signed in, the Sim's own).
func (h *Handler) QuartierRoutes(r chi.Router) {
	r.Get("/sims/{id}/quartier", h.quartier)
	r.Post("/sims/{id}/quartier/paint", h.quartierPaint)
	r.Post("/sims/{id}/quartier/ask", h.quartierAsk)
	r.Post("/sims/{id}/quartier/answer", h.quartierAnswer)
	r.Get("/sims/{id}/quartiers", h.quartiers)
}
