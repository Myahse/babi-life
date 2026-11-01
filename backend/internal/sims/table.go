package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// La table de l'Ivoire (game/table.go): the roulette played together. The bets of a round are taken
// while it's « faites vos jeux », paid for at once; the ball's number is the round's, the same for all;
// a round's bets are settled once the ball has stopped (settleTable, on any refresh of the Sim).

var (
	errTableClosed = errors.New("rien ne va plus : attends le prochain tour pour miser")
	errTableTwice  = errors.New("tes jetons sont déjà sur le tapis pour ce tour")
)

// TableSpot is a place on the cloth with what the players put there this round.
type TableSpot struct {
	game.RouletteBet
	Players int `json:"players"`
}

// TableState is the table as a player sees it.
type TableState struct {
	Round int64 `json:"round"`
	// Phase: « mises » (bets taken), « tour » (the ball rolling), « resultat » (stopped).
	Phase    string `json:"phase"`
	Now      int64  `json:"now"`
	SpinAt   int64  `json:"spinAt"`
	ResultAt int64  `json:"resultAt"`
	NextAt   int64  `json:"nextAt"`
	// Number: this round's, once the bets are closed (-1 before).
	Number int `json:"number"`
	// Last: the numbers of the rounds before, the latest first.
	Last []int `json:"last"`
	// Cloth: everyone's bets this round, by place; Players: who's at the table (betting this round or the last).
	Cloth   []TableSpot `json:"cloth"`
	Players []string    `json:"players"`
	// Mine: the player's bets this round; Result: their last settled round, when it's this one or the one before.
	Mine   []game.RouletteBet `json:"mine"`
	Result *TableResult       `json:"result,omitempty"`
}

// TableResult is a round a player had bets on, settled.
type TableResult struct {
	Round  int64 `json:"round"`
	Number int   `json:"number"`
	Staked int   `json:"staked"`
	Back   int   `json:"back"`
}

func tablePhase(n, nowMs int64) string {
	switch {
	case nowMs < game.TableSpinAt(n):
		return "mises"
	case nowMs < game.TableResultAt(n):
		return "tour"
	}
	return "resultat"
}

// tableState: GET /sims/{id}/casino/table — the round, its phase and times, the cloth, the numbers before;
// GET /casino/table: the same without one's own bets (the table seen in the 3D hall).
func (h *Handler) tableState(w http.ResponseWriter, r *http.Request) {
	id := ""
	if chi.URLParam(r, "id") != "" {
		var err error
		if id, _, _, err = h.mySim(r); err != nil {
			httpx.Error(w, http.StatusNotFound, "sim introuvable")
			return
		}
	}
	ctx := r.Context()
	nowMs := time.Now().UnixMilli()
	n := game.TableRound(nowMs)
	st := TableState{Round: n, Phase: tablePhase(n, nowMs), Now: nowMs, SpinAt: game.TableSpinAt(n), ResultAt: game.TableResultAt(n), NextAt: (n + 1) * game.TablePeriod * 1000, Number: -1, Cloth: []TableSpot{}, Players: []string{}, Mine: []game.RouletteBet{}}
	if st.Phase != "mises" {
		st.Number = game.TableNumber(n)
	}
	for k := int64(1); k <= 15; k++ {
		st.Last = append(st.Last, game.TableNumber(n-k))
	}
	rows, err := h.DB.Query(ctx, `SELECT t.sim, t.round, t.bets, s.first_name FROM table_bets t JOIN sims s ON s.id = t.sim WHERE t.round IN ($1, $2) ORDER BY t.id`, n, n-1)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	spots := map[string]*TableSpot{}
	seen := map[string]bool{}
	for rows.Next() {
		var sim, name string
		var round int64
		var raw []byte
		if err := rows.Scan(&sim, &round, &raw, &name); err != nil {
			rows.Close()
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		if !seen[sim] && len(st.Players) < 12 {
			seen[sim] = true
			st.Players = append(st.Players, name)
		}
		if round != n {
			continue
		}
		var bets []game.RouletteBet
		_ = json.Unmarshal(raw, &bets)
		if id != "" && sim == id {
			st.Mine = bets
		}
		for _, b := range bets {
			k := spotKey(b)
			if spots[k] == nil {
				spots[k] = &TableSpot{RouletteBet: game.RouletteBet{Kind: b.Kind, Number: b.Number, Numbers: b.Numbers}}
			}
			spots[k].Stake += b.Stake
			spots[k].Players++
		}
	}
	rows.Close()
	for _, sp := range spots {
		st.Cloth = append(st.Cloth, *sp)
	}
	sort.Slice(st.Cloth, func(i, j int) bool { return spotKey(st.Cloth[i].RouletteBet) < spotKey(st.Cloth[j].RouletteBet) })
	if id == "" {
		httpx.JSON(w, http.StatusOK, st)
		return
	}
	var res TableResult
	err = h.DB.QueryRow(ctx, `SELECT round, stake, payout FROM table_bets WHERE sim = $1 AND status <> 'open' AND round >= $2 ORDER BY round DESC LIMIT 1`, id, n-1).Scan(&res.Round, &res.Staked, &res.Back)
	if err == nil {
		res.Number = game.TableNumber(res.Round)
		st.Result = &res
	}
	httpx.JSON(w, http.StatusOK, st)
}

func spotKey(b game.RouletteBet) string {
	ns := append([]int(nil), b.Numbers...)
	sort.Ints(ns)
	return fmt.Sprintf("%s:%d:%v", b.Kind, b.Number, ns)
}

// tableBet: POST /sims/{id}/casino/table {bets} — the player's chips on the cloth for this round, paid now.
func (h *Handler) tableBet(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Bets []game.RouletteBet `json:"bets"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		nowMs := time.Now().UnixMilli()
		n := game.TableRound(nowMs)
		if tablePhase(n, nowMs) != "mises" {
			return game.Outcome{}, nil, errTableClosed
		}
		if len(req.Bets) == 0 || len(req.Bets) > game.RouletteMaxBets {
			return game.Outcome{}, nil, errNoBets
		}
		total := 0
		for _, b := range req.Bets {
			if err := game.RouletteCheck(b); err != nil {
				return game.Outcome{}, nil, err
			}
			total += b.Stake
		}
		if total > game.RouletteMaxTotal {
			return game.Outcome{}, nil, errTooMuchCloth
		}
		if err := casinoOpen(ctx, tx, s, total); err != nil {
			return game.Outcome{}, nil, err
		}
		if s.Money < total {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		raw, _ := json.Marshal(req.Bets)
		tag, err := tx.Exec(ctx, `INSERT INTO table_bets (sim, round, bets, stake, settles_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (sim, round) DO NOTHING`,
			s.ID, n, raw, total, (game.TableResultAt(n)+999)/1000)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if tag.RowsAffected() == 0 {
			return game.Outcome{}, nil, errTableTwice
		}
		s.Money -= total
		s.wallet().Use(s.today(), game.Casino)
		return game.Outcome{Text: fmt.Sprintf("Table de l'Ivoire : %s Djai sur le tapis. Rien ne va plus dans quelques secondes.", money(total)), Money: -total}, nil, nil
	})
}

// settleTable: the player's bets on rounds whose ball has stopped are paid (or lost).
func settleTable(ctx context.Context, tx pgx.Tx, s *Sim, now int64) ([]Event, error) {
	rows, err := tx.Query(ctx, `SELECT id, round, bets, stake FROM table_bets WHERE sim = $1 AND status = 'open' AND settles_at <= $2`, s.ID, now)
	if err != nil {
		return nil, err
	}
	type open struct {
		id, round int64
		bets      []game.RouletteBet
		stake     int
	}
	var all []open
	for rows.Next() {
		var o open
		var raw []byte
		if err := rows.Scan(&o.id, &o.round, &raw, &o.stake); err != nil {
			rows.Close()
			return nil, err
		}
		_ = json.Unmarshal(raw, &o.bets)
		all = append(all, o)
	}
	rows.Close()
	var events []Event
	for _, o := range all {
		n := game.TableNumber(o.round)
		_, back, _ := roulettePay(o.bets, n)
		status := "lost"
		if back > 0 {
			status = "won"
		}
		if _, err := tx.Exec(ctx, `UPDATE table_bets SET status = $2, payout = $3 WHERE id = $1`, o.id, status, back); err != nil {
			return nil, err
		}
		if back > 0 {
			s.Money += back
			events = append(events, bigWin(s, fmt.Sprintf("la table de l'Ivoire, le %d", n), o.stake, back)...)
		}
	}
	return events, nil
}
