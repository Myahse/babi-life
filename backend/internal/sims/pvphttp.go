package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The routes of « Jouer contre un joueur » (pvp.go): the challenge, the
// answer, the queue, the moves, the end, the « Classement ».

// pvpOpen: the update « jeux-en-ligne » is with the players (refused while closed).
func pvpOpen(w http.ResponseWriter, r *http.Request) bool {
	if features.Default.BlocksKey(r.Context(), "jeux-en-ligne") != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return false
	}
	return true
}

// gameOpen: the game itself is there (its app, its activity: their updates).
func gameOpen(ctx context.Context, g PvpGame) bool {
	if g.key != "" && features.Default.BlocksKey(ctx, g.key) != "" {
		return false
	}
	if g.act != "" && features.Default.Blocks(ctx, g.act) != "" {
		return false
	}
	return true
}

// pvpWho: what the match needs to know of a Sim.
type pvpWho struct {
	ID, Name, City, User string
	Stage                string
	Adult                bool // the account said 18 or over
}

func whoIs(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, id string) (pvpWho, error) {
	w := pvpWho{ID: id}
	var born int64
	err := q.QueryRow(ctx, `SELECT s.first_name, s.born_at, s.city, s.user_id, u.adult_at IS NOT NULL FROM sims s JOIN users u ON u.id = s.user_id WHERE s.id = $1`, id).Scan(&w.Name, &born, &w.City, &w.User, &w.Adult)
	w.Stage = game.StageOf(game.AgeAt(born, game.MinuteOf(time.Now()))).ID
	return w, err
}

// stakeOK: both may put this on the game (18 and over, accounts that can pass Djai on, the money there).
func stakeOK(ctx context.Context, tx pgx.Tx, g PvpGame, stake int, who ...pvpWho) error {
	if stake == 0 {
		return nil
	}
	if stake < 0 || stake > g.Max {
		return errPvpStake
	}
	for _, w := range who {
		if w.Stage != game.StageAdulte || !w.Adult {
			return errPvpMinor
		}
		if err := heldBack(ctx, tx, w.ID); err != nil {
			return err
		}
	}
	return nil
}

// pvpNow: GET: the match the Sim is in (asked, on, just over), the others' faces, the queue it waits in.
func (h *Handler) pvpNow(w http.ResponseWriter, r *http.Request) {
	if !pvpOpen(w, r) {
		return
	}
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	m, settle := h.Pvp.Of(id)
	h.pvpAnswerWith(w, r, id, m, settle)
}

// pvpAnswerWith: the match as the phone gets it (settled first if it just ended).
func (h *Handler) pvpAnswerWith(w http.ResponseWriter, r *http.Request, id string, m *PvpMatch, settle bool) {
	ctx := r.Context()
	if m != nil && settle && h.Pvp.Recorded(m.ID) {
		h.pvpSettle(ctx, m)
	}
	out := map[string]any{"match": m, "now": time.Now().UnixMilli()}
	if g, since := h.Pvp.Waiting(id); g != "" {
		out["waiting"] = map[string]any{"game": g, "since": since.UnixMilli()}
	}
	if m != nil {
		others := []map[string]any{}
		for _, o := range m.Players {
			if o == id {
				continue
			}
			var look Look
			var gender string
			if h.DB.QueryRow(ctx, `SELECT look, gender FROM sims WHERE id = $1`, o).Scan(&look, &gender) == nil {
				others = append(others, map[string]any{"id": o, "look": look, "gender": gender, "name": m.Names[m.seat(o)]})
			}
		}
		out["others"] = others
	}
	httpx.JSON(w, http.StatusOK, out)
}

// pvpTell: the other players of the match hear it at once (their phones load it again).
func (h *Handler) pvpTell(m *PvpMatch, from string) {
	for _, s := range m.Players {
		if s != from {
			h.notify(s, map[string]any{"t": "pvp", "id": m.ID})
		}
	}
}

// pvpChallenge: POST {game, to, stake}: challenge a friend or a player online in the city.
func (h *Handler) pvpChallenge(w http.ResponseWriter, r *http.Request) {
	if !pvpOpen(w, r) {
		return
	}
	var req struct {
		Game  string `json:"game"`
		To    string `json:"to"`
		Stake int    `json:"stake"`
	}
	if httpx.Decode(r, &req) != nil || req.To == "" {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	g, ok := pvpGame(req.Game)
	ctx := r.Context()
	if !ok || !gameOpen(ctx, g) {
		httpx.Error(w, http.StatusUnprocessableEntity, errPvpGame.Error())
		return
	}
	id, city, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	me, err := whoIs(ctx, tx, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	them, err := whoIs(ctx, tx, req.To)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && them.User == auth.UserID(ctx)) {
		httpx.Error(w, http.StatusNotFound, errNoFriend.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	friends := areFriends(ctx, tx, id, req.To)
	// A friend anywhere, or a player of the city; online now, to play at once.
	if (!friends && them.City != city) || (h.Connected != nil && !h.Connected(req.To)) {
		httpx.Error(w, http.StatusConflict, "cette personne n'est pas en ligne en ce moment")
		return
	}
	if fail := pvpAges(g, me, them); fail != nil {
		httpx.Error(w, http.StatusConflict, fail.Error())
		return
	}
	if err := stakeOK(ctx, tx, g, req.Stake, me, them); err != nil {
		httpx.Error(w, http.StatusConflict, err.Error())
		return
	}
	var money int
	_ = tx.QueryRow(ctx, `SELECT money FROM sims WHERE id = $1`, id).Scan(&money)
	if money < req.Stake {
		httpx.Error(w, http.StatusConflict, game.ErrNotEnoughMoney.Error())
		return
	}
	m, err := h.Pvp.Challenge(g, id, req.To, [2]string{me.Name, them.Name}, me.Stage == game.StageBebe, req.Stake)
	if err != nil {
		httpx.Error(w, http.StatusConflict, err.Error())
		return
	}
	// In Gbairai too, between friends: the card says Accepter / Refuser (web SharedCard.tsx).
	if friends && canWrite(ctx, tx, id, req.To) == nil {
		if _, err := sendMessage(ctx, tx, id, req.To, fmt.Sprintf("[jeu:%s:%s]", g.ID, m.ID), nil); err == nil {
			_ = tx.Commit(ctx)
		}
	}
	h.notify(req.To, map[string]any{"t": "pvp", "id": m.ID})
	httpx.JSON(w, http.StatusOK, map[string]any{"match": m})
}

// pvpAges: who may play whom: a baby only the bagarre with another baby, le godé from 18.
func pvpAges(g PvpGame, who ...pvpWho) error {
	baby := 0
	for _, w := range who {
		if w.Stage == game.StageBebe {
			baby++
		}
		if g.Adult && (w.Stage != game.StageAdulte || !w.Adult) {
			return errPvpGodeAge
		}
	}
	if baby > 0 && (baby != len(who) || g.ID != "combat") {
		return errPvpBaby
	}
	return nil
}

// pvpAnswer: POST {accept}: the one challenged says yes (the stakes down, the game started) or no.
func (h *Handler) pvpAnswer(w http.ResponseWriter, r *http.Request) {
	if !pvpOpen(w, r) {
		return
	}
	var req struct {
		Accept bool `json:"accept"`
	}
	if httpx.Decode(r, &req) != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	m, err := h.Pvp.Answer(chi.URLParam(r, "match"), id, req.Accept)
	if err != nil {
		httpx.Error(w, http.StatusConflict, err.Error())
		return
	}
	if m.State == "on" {
		if err := h.pvpBegin(r.Context(), m); err != nil {
			h.Pvp.Back(m.ID)
			h.pvpTell(m, id)
			httpx.Error(w, http.StatusConflict, err.Error())
			return
		}
	}
	h.pvpTell(m, id)
	m, _ = h.Pvp.Get(m.ID, id)
	h.pvpAnswerWith(w, r, id, m, false)
}

// pvpBegin: what a match needs before it's played: the stakes down (le godé:
// kept aside), the game of dames or 8 américain started between the two.
func (h *Handler) pvpBegin(ctx context.Context, m *PvpMatch) error {
	if m.Stake == 0 && m.Game != "dames" && m.Game != "huit" {
		return nil
	}
	g, _ := pvpGame(m.Game)
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	who := make([]pvpWho, len(m.Players))
	for i, s := range m.Players {
		if who[i], err = whoIs(ctx, tx, s); err != nil {
			return err
		}
	}
	if err := stakeOK(ctx, tx, g, m.Stake, who...); err != nil {
		return err
	}
	for i, s := range m.Players {
		if m.Stake == 0 {
			break
		}
		tag, err := tx.Exec(ctx, `UPDATE sims SET money = money - $1 WHERE id = $2 AND money >= $1`, m.Stake, s)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("%s n'a plus de quoi miser", m.Names[i])
		}
	}
	var ref int64
	switch m.Game {
	case "dames":
		var busy bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dames WHERE (white = ANY($1) OR black = ANY($1)) AND status = 'playing')`, m.Players).Scan(&busy)
		if busy {
			return errors.New("une partie de dames est déjà en cours pour l'un de vous : finissez-la d'abord")
		}
		if err := tx.QueryRow(ctx, `INSERT INTO dames (white, black, stake, board, status, live) VALUES ($1, $2, $3, $4, 'playing', true) RETURNING id`, m.Players[0], m.Players[1], m.Stake, game.NewBoard().String()).Scan(&ref); err != nil {
			return err
		}
	case "huit":
		var busy bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM huit WHERE (host = ANY($1) OR guest = ANY($1)) AND status = 'playing')`, m.Players).Scan(&busy)
		if busy {
			return errors.New("une partie de 8 américain est déjà en cours pour l'un de vous : finissez-la d'abord")
		}
		hg, err := game.NewHuit(2, newRand())
		if err != nil {
			return err
		}
		state, _ := json.Marshal(hg)
		if err := tx.QueryRow(ctx, `INSERT INTO huit (host, guest, stake, state, status, live) VALUES ($1, $2, $3, $4, 'playing', true) RETURNING id`, m.Players[0], m.Players[1], m.Stake, state).Scan(&ref); err != nil {
			return err
		}
	default:
		for _, s := range m.Players {
			if _, err := tx.Exec(ctx, `INSERT INTO pvp_stakes (match, sim, amount) VALUES ($1, $2, $3)`, m.ID, s, m.Stake); err != nil {
				return err
			}
		}
	}
	minute := game.MinuteOf(time.Now())
	for i, s := range m.Players {
		if m.Stake > 0 {
			_ = insertEvent(ctx, tx, s, "jeux", fmt.Sprintf("%s contre %s : %s chacun sur la table.", g.Name, m.Names[1-i], game.FCFA(m.Stake)), -m.Stake, minute)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	if ref != 0 {
		h.Pvp.SetRef(m.ID, ref)
	}
	for _, s := range m.Players {
		h.notify(s, map[string]any{"t": "sim", "id": s})
	}
	return nil
}

// pvpQueue: POST {game}: « Trouver un adversaire »: the next one who asks for the same game.
func (h *Handler) pvpQueue(w http.ResponseWriter, r *http.Request) {
	if !pvpOpen(w, r) {
		return
	}
	var req struct {
		Game string `json:"game"`
	}
	if httpx.Decode(r, &req) != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	g, ok := pvpGame(req.Game)
	ctx := r.Context()
	if !ok || !gameOpen(ctx, g) {
		httpx.Error(w, http.StatusUnprocessableEntity, errPvpGame.Error())
		return
	}
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	me, err := whoIs(ctx, h.DB, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if err := pvpAges(g, me); err != nil {
		httpx.Error(w, http.StatusConflict, err.Error())
		return
	}
	m, err := h.Pvp.Enqueue(g, id, me.Name, me.Stage == game.StageBebe)
	if err != nil {
		httpx.Error(w, http.StatusConflict, err.Error())
		return
	}
	if m != nil {
		if err := h.pvpBegin(ctx, m); err != nil {
			h.Pvp.Back(m.ID)
			h.pvpTell(m, id)
			httpx.Error(w, http.StatusConflict, err.Error())
			return
		}
		h.pvpTell(m, id)
		m, _ = h.Pvp.Get(m.ID, id)
	}
	h.pvpAnswerWith(w, r, id, m, false)
}

// pvpUnqueue: DELETE: out of the queue (the phone plays the computer instead).
func (h *Handler) pvpUnqueue(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	h.Pvp.Dequeue(id)
	w.WriteHeader(http.StatusNoContent)
}

// pvpMove: POST {seq, m, next, roll}: a move of awalé, Ludo or godé.
func (h *Handler) pvpMoveHandler(w http.ResponseWriter, r *http.Request) {
	if !pvpOpen(w, r) {
		return
	}
	var req struct {
		Seq  int             `json:"seq"`
		M    json.RawMessage `json:"m"`
		Next int             `json:"next"`
		Roll bool            `json:"roll"`
	}
	if httpx.Decode(r, &req) != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	m, err := h.Pvp.Move(chi.URLParam(r, "match"), id, req.Seq, req.M, req.Next, req.Roll, casinoRng())
	if err != nil && m == nil {
		httpx.Error(w, http.StatusConflict, err.Error())
		return
	}
	if err != nil {
		// Refused: the match as it stands, for the phone to catch up.
		httpx.JSON(w, http.StatusConflict, map[string]any{"error": err.Error(), "match": m})
		return
	}
	h.pvpTell(m, id)
	m, settle := h.Pvp.Get(m.ID, id)
	h.pvpAnswerWith(w, r, id, m, settle)
}

// pvpEnd: POST {winner, quit}: how the game ended, as this phone saw it.
func (h *Handler) pvpEnd(w http.ResponseWriter, r *http.Request) {
	if !pvpOpen(w, r) {
		return
	}
	var req struct {
		Winner string `json:"winner"`
		Quit   bool   `json:"quit"`
	}
	if httpx.Decode(r, &req) != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	m, err := h.Pvp.Report(chi.URLParam(r, "match"), id, req.Winner, req.Quit)
	if err != nil {
		httpx.Error(w, http.StatusConflict, err.Error())
		return
	}
	h.pvpTell(m, id)
	m, settle := h.Pvp.Get(m.ID, id)
	h.pvpAnswerWith(w, r, id, m, settle)
}

// pvpSettle: a match just over: the result kept for the « Classement », the
// journal told, le godé's pot paid (within the day's limit for winnings
// from players). Dames and 8 américain settle in their own games.
func (h *Handler) pvpSettle(ctx context.Context, m *PvpMatch) {
	if m.Game == "dames" || m.Game == "huit" {
		return
	}
	g, _ := pvpGame(m.Game)
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)
	paid := map[string]int{}
	var held int
	_ = tx.QueryRow(ctx, `SELECT COALESCE(sum(amount), 0) FROM pvp_stakes WHERE match = $1`, m.ID).Scan(&held)
	if held > 0 {
		if m.Winner == "" {
			_, _ = tx.Exec(ctx, `UPDATE sims s SET money = money + p.amount FROM pvp_stakes p WHERE p.match = $1 AND p.sim = s.id`, m.ID)
			for _, s := range m.Players {
				paid[s] = m.Stake
			}
		} else if amount, err := payWinner(ctx, tx, m.Winner, m.Stake, held, game.FromPlayers); err == nil {
			paid[m.Winner] = amount
		}
		_, _ = tx.Exec(ctx, `DELETE FROM pvp_stakes WHERE match = $1`, m.ID)
	}
	if len(m.Players) == 2 {
		var loser *string
		var winner *string
		if !m.Draw && m.Winner != "" {
			winner = &m.Winner
			l := m.Players[1-m.seat(m.Winner)]
			loser = &l
		}
		_, _ = tx.Exec(ctx, `INSERT INTO pvp_results (game, winner, loser, draw, stake) VALUES ($1, $2, $3, $4, $5)`, m.Game, winner, loser, m.Draw || m.Winner == "", m.Stake)
	}
	minute := game.MinuteOf(time.Now())
	for _, s := range m.Players {
		line := g.Name + " contre un joueur : " + m.Result
		if paid[s] > 0 && m.Winner != "" {
			line += " " + game.FCFA(paid[s]) + " pour toi."
		}
		_ = insertEvent(ctx, tx, s, "jeux", line, paid[s], minute)
	}
	if tx.Commit(ctx) == nil {
		for _, s := range m.Players {
			h.notify(s, map[string]any{"t": "sim", "id": s})
			h.notify(s, map[string]any{"t": "pvp", "id": m.ID})
		}
	}
}

// RefundPvp: on start, the stakes of matches the server forgot (it stopped) given back.
func (h *Handler) RefundPvp(ctx context.Context) {
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE sims s SET money = money + t.amount FROM (SELECT sim, sum(amount) AS amount FROM pvp_stakes GROUP BY sim) t WHERE t.sim = s.id`); err != nil {
		return
	}
	if _, err := tx.Exec(ctx, `DELETE FROM pvp_stakes`); err != nil {
		return
	}
	_ = tx.Commit(ctx)
}

// pvpRecordGame: a game of dames or 8 américain started from here is over: kept for the « Classement ».
func pvpRecordGame(ctx context.Context, tx pgx.Tx, gameID string, players []string, winner int, stake int) {
	if len(players) != 2 {
		return
	}
	if winner < 0 || winner > 1 {
		_, _ = tx.Exec(ctx, `INSERT INTO pvp_results (game, draw, stake) VALUES ($1, true, $2)`, gameID, stake)
		return
	}
	_, _ = tx.Exec(ctx, `INSERT INTO pvp_results (game, winner, loser, stake) VALUES ($1, $2, $3, $4)`, gameID, players[winner], players[1-winner], stake)
}

// PvpRank: a line of a game's « Classement ».
type PvpRank struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Wins   int    `json:"wins"`
	Losses int    `json:"losses"`
}

// pvpRanking: GET ?game=: the ten who won the most at the game against players (the testers left out), and the Sim's own.
func (h *Handler) pvpRanking(w http.ResponseWriter, r *http.Request) {
	if !pvpOpen(w, r) {
		return
	}
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	g, ok := pvpGame(r.URL.Query().Get("game"))
	if !ok {
		httpx.Error(w, http.StatusBadRequest, errPvpGame.Error())
		return
	}
	ctx := r.Context()
	rows, err := h.DB.Query(ctx, `
		SELECT s.id, s.first_name,
		       count(*) FILTER (WHERE r.winner = s.id), count(*) FILTER (WHERE r.loser = s.id)
		FROM pvp_results r
		JOIN sims s ON s.id = r.winner OR s.id = r.loser
		JOIN users u ON u.id = s.user_id
		WHERE r.game = $1 AND NOT r.draw AND NOT u.tester AND NOT s.tested
		GROUP BY s.id, s.first_name
		HAVING count(*) FILTER (WHERE r.winner = s.id) > 0
		ORDER BY 3 DESC, 4 ASC, s.first_name LIMIT 10`, g.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	top := []PvpRank{}
	for rows.Next() {
		var p PvpRank
		if rows.Scan(&p.ID, &p.Name, &p.Wins, &p.Losses) == nil {
			top = append(top, p)
		}
	}
	mine := PvpRank{ID: id}
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FILTER (WHERE winner = $2), count(*) FILTER (WHERE loser = $2) FROM pvp_results WHERE game = $1 AND NOT draw`, g.ID, id).Scan(&mine.Wins, &mine.Losses)
	httpx.JSON(w, http.StatusOK, map[string]any{"game": g.ID, "top": top, "mine": mine})
}

// pvpGames: GET: the games that can be played against a player now (their updates open).
func (h *Handler) pvpGames(w http.ResponseWriter, r *http.Request) {
	if !pvpOpen(w, r) {
		return
	}
	out := []PvpGame{}
	for _, g := range PvpGames {
		if gameOpen(r.Context(), g) {
			out = append(out, g)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"games": out})
}
