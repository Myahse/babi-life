package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Les dames at the grin (game/dames.go plays them): against one of the men
// of the grin, or a player friend challenged, for nothing or for money. The
// stakes are put down when the game starts (the friend's when they accept)
// and the winner takes them both; a draw gives each their own back. Against
// a man of the grin, his moves are played here, so a game can't be won from
// the phone; the more there is on the board, the harder he thinks. A friend
// who doesn't play for dameIdle has given up the game; an invitation not
// answered within dameInviteWindow is gone.

const (
	dameIdle         = 10 * time.Minute
	dameInviteWindow = 10 * time.Minute
	// dameNpcMax: the most a man of the grin puts on a game; damePlayerMax: between friends.
	dameNpcMax    = 5000
	damePlayerMax = 50000
	// How long a game just over still shows (its result).
	dameShowEnded = 3 * time.Minute
)

var (
	errDameBusy     = errors.New("tu as déjà une partie de dames en cours")
	errDameStake    = errors.New("mise invalide")
	errDameNotYours = errors.New("ce n'est pas ta partie")
	errDameNotTurn  = errors.New("ce n'est pas à toi de jouer")
	errDameIllegal  = errors.New("ce coup n'est pas permis (la prise est obligatoire, et il faut prendre le plus de pions)")
	errDameOver     = errors.New("la partie est finie")
)

// DameSide: who plays a colour.
type DameSide struct {
	ID   string `json:"id,omitempty"`
	Name string `json:"name"`
	Npc  bool   `json:"npc,omitempty"`
}

// DameGame: a game as the phone shows it, from one player's side.
type DameGame struct {
	ID     int64            `json:"id"`
	You    int8             `json:"you"`
	White  DameSide         `json:"white"`
	Black  DameSide         `json:"black"`
	Stake  int              `json:"stake"`
	Board  []int8           `json:"board"`
	Turn   int8             `json:"turn"`
	Status string           `json:"status"`
	Winner int8             `json:"winner"`
	Last   *game.DamesMove  `json:"last,omitempty"`
	Legal  []game.DamesMove `json:"legal,omitempty"`
	Text   string           `json:"text,omitempty"`
}

// dameRow: a game as kept.
type dameRow struct {
	ID        int64
	White     string
	Black     *string
	WhiteName string
	BlackName string
	Npc       string
	Depth     int
	Stake     int
	Board     game.Board
	Turn      int8
	Quiet     int
	Status    string
	Winner    int8
	Last      *game.DamesMove
	Text      string
	UpdatedAt time.Time
	CreatedAt time.Time
}

const dameColumns = `d.id, d.white, d.black, w.first_name, COALESCE(b.first_name, ''), d.npc_name, d.depth, d.stake, d.board, d.turn, d.quiet, d.status, d.winner, d.last, d.result, d.updated_at, d.created_at`
const dameFrom = ` FROM dames d JOIN sims w ON w.id = d.white LEFT JOIN sims b ON b.id = d.black`

func scanDame(row pgx.Row) (dameRow, error) {
	var d dameRow
	var board, last string
	if err := row.Scan(&d.ID, &d.White, &d.Black, &d.WhiteName, &d.BlackName, &d.Npc, &d.Depth, &d.Stake, &board, &d.Turn, &d.Quiet, &d.Status, &d.Winner, &last, &d.Text, &d.UpdatedAt, &d.CreatedAt); err != nil {
		return d, err
	}
	d.Board, _ = game.ParseBoard(board)
	if last != "" {
		var m game.DamesMove
		if json.Unmarshal([]byte(last), &m) == nil {
			d.Last = &m
		}
	}
	return d, nil
}

// view: the game from the side of the Sim `me`.
func (d dameRow) view(me string) DameGame {
	g := DameGame{ID: d.ID, White: DameSide{ID: d.White, Name: d.WhiteName}, Stake: d.Stake, Board: d.Board[:], Turn: d.Turn, Status: d.Status, Winner: d.Winner, Last: d.Last, Text: d.Text}
	if d.Black != nil {
		g.Black = DameSide{ID: *d.Black, Name: d.BlackName}
	} else {
		g.Black = DameSide{Name: d.Npc, Npc: true}
	}
	g.You = 1
	if d.Black != nil && *d.Black == me {
		g.You = -1
	}
	if d.Status == "playing" && d.Turn == g.You {
		g.Legal = d.Board.Moves(d.Turn)
	}
	return g
}

// dameNpcDepth: how far the man of the grin looks ahead, by what's on the board.
func dameNpcDepth(stake int) int {
	switch {
	case stake == 0:
		return 2
	case stake <= 1000:
		return 3
	}
	return 4
}

// current: the Sim's game going on (or waiting for an answer, or just over), for update or not.
func current(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, sim string, lock bool) (dameRow, error) {
	sql := `SELECT ` + dameColumns + dameFrom + ` WHERE (d.white = $1 OR d.black = $1) AND (d.status IN ('invited', 'playing') OR d.updated_at > $2) ORDER BY d.id DESC LIMIT 1`
	if lock {
		sql += ` FOR UPDATE OF d`
	}
	return scanDame(q.QueryRow(ctx, sql, sim, time.Now().Add(-dameShowEnded)))
}

// expire: an invitation left unanswered, a game left unplayed: over, settled.
func expire(ctx context.Context, tx pgx.Tx, d *dameRow) error {
	now := time.Now()
	switch {
	case d.Status == "invited" && now.Sub(d.CreatedAt) > dameInviteWindow:
		d.Status, d.Text = "expired", "Le défi n'a pas eu de réponse."
		_, err := tx.Exec(ctx, `UPDATE dames SET status = $2, result = $3, updated_at = now() WHERE id = $1`, d.ID, d.Status, d.Text)
		return err
	case d.Status == "playing" && d.Black != nil && now.Sub(d.UpdatedAt) > dameIdle:
		// The one who had to play has given up.
		return finish(ctx, tx, d, -d.Turn, "abandon")
	}
	return nil
}

// finish: the game is over (winner 1 white, -1 black, 0 draw): the pot paid out, the journal told.
func finish(ctx context.Context, tx pgx.Tx, d *dameRow, winner int8, why string) error {
	d.Status, d.Winner = "done", winner
	name := func(c int8) string {
		if c == 1 {
			return d.WhiteName
		}
		if d.Black == nil {
			return d.Npc
		}
		return d.BlackName
	}
	pot := 2 * d.Stake
	switch {
	case winner == 0:
		d.Text = "Partie nulle : chacun reprend sa mise."
	case why == "abandon":
		d.Text = fmt.Sprintf("%s abandonne : %s gagne.", name(-winner), name(winner))
	default:
		d.Text = fmt.Sprintf("%s gagne la partie !", name(winner))
	}
	if d.Stake > 0 && winner != 0 {
		d.Text += " " + game.FCFA(pot) + " pour " + name(winner) + "."
	}
	// Paid: the pot to the winner, or each their stake back.
	pay := func(sim string, amount int) error {
		if amount == 0 {
			return nil
		}
		_, err := tx.Exec(ctx, `UPDATE sims SET money = money + $1 WHERE id = $2`, amount, sim)
		return err
	}
	players := []struct {
		id    string
		color int8
	}{{d.White, 1}}
	if d.Black != nil {
		players = append(players, struct {
			id    string
			color int8
		}{*d.Black, -1})
	}
	now := game.MinuteOf(time.Now())
	for _, p := range players {
		amount := 0
		switch {
		case winner == 0:
			amount = d.Stake
		case winner == p.color:
			amount = pot
		}
		if err := pay(p.id, amount); err != nil {
			return err
		}
		line := "Dames : " + d.Text
		_ = insertEvent(ctx, tx, p.id, "dames", line, amount, now)
	}
	_, err := tx.Exec(ctx, `UPDATE dames SET status = 'done', winner = $2, result = $3, updated_at = now() WHERE id = $1`, d.ID, winner, d.Text)
	return err
}

// dames: the Sim's game, if any (GET /sims/{id}/dames).
func (h *Handler) dames(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	d, err := current(ctx, tx, id, true)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.JSON(w, http.StatusOK, map[string]any{"game": nil})
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if err := expire(ctx, tx, &d); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"game": d.view(id)})
}

// damesStart: a game against a man of the grin, or a friend challenged (POST /sims/{id}/dames).
func (h *Handler) damesStart(w http.ResponseWriter, r *http.Request) {
	var req struct {
		With  string `json:"with"`
		Npc   string `json:"npc"`
		Stake int    `json:"stake"`
	}
	if err := httpx.Decode(r, &req); err != nil || req.With == "" {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if d, err := current(ctx, tx, s.ID, true); err == nil {
			if err := expire(ctx, tx, &d); err != nil {
				return game.Outcome{}, nil, err
			}
			if d.Status == "invited" || d.Status == "playing" {
				return game.Outcome{}, nil, errDameBusy
			}
		}
		board := game.NewBoard().String()
		if req.With == "npc" {
			name := strings.TrimSpace(req.Npc)
			if name == "" || len(name) > 40 {
				name = "un joueur du grin"
			}
			if req.Stake < 0 || req.Stake > dameNpcMax {
				return game.Outcome{}, nil, errDameStake
			}
			if s.Money < req.Stake {
				return game.Outcome{}, nil, game.ErrNotEnoughMoney
			}
			s.Money -= req.Stake
			s.Needs = s.Needs.Add(game.Needs{Social: 4})
			if _, err := tx.Exec(ctx, `INSERT INTO dames (white, npc_name, depth, stake, board, status) VALUES ($1, $2, $3, $4, $5, 'playing')`,
				s.ID, name, dameNpcDepth(req.Stake), req.Stake, board); err != nil {
				return game.Outcome{}, nil, err
			}
			text := fmt.Sprintf("Tu t'assois au damier avec %s.", name)
			if req.Stake > 0 {
				text = fmt.Sprintf("Tu t'assois au damier avec %s, %s chacun sur la table.", name, game.FCFA(req.Stake))
			}
			return game.Outcome{Text: text, Money: -req.Stake}, nil, nil
		}
		// A friend: the challenge, which they answer.
		o, err := otherSim(ctx, tx, s, req.With)
		if err != nil && !errors.Is(err, errNotHere) {
			return game.Outcome{}, nil, err
		}
		if !areFriends(ctx, tx, s.ID, o.ID) {
			return game.Outcome{}, nil, errOnlyFriends
		}
		if req.Stake < 0 || req.Stake > damePlayerMax {
			return game.Outcome{}, nil, errDameStake
		}
		if s.Money < req.Stake {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		var busy bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dames WHERE (white = $1 OR black = $1) AND (status = 'playing' OR (status = 'invited' AND created_at > $2)))`, o.ID, time.Now().Add(-dameInviteWindow)).Scan(&busy)
		if busy {
			return game.Outcome{}, nil, fmt.Errorf("%s a déjà une partie de dames en cours", o.FirstName)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO dames (white, black, stake, board, status) VALUES ($1, $2, $3, $4, 'invited')`, s.ID, o.ID, req.Stake, board); err != nil {
			return game.Outcome{}, nil, err
		}
		mise := ""
		if req.Stake > 0 {
			mise = ", mise " + game.FCFA(req.Stake)
		}
		_ = insertEvent(ctx, tx, o.ID, "dames", fmt.Sprintf("%s te défie aux dames%s.", s.FirstName, mise), 0, game.MinuteOf(time.Now()))
		return game.Outcome{Text: fmt.Sprintf("Défi envoyé à %s%s : à lui ou à elle de répondre.", o.FirstName, mise)}, nil, nil
	})
}

// damesAct: accept or decline a challenge, play a move, give up (POST /sims/{id}/dames/{game}/{action}).
func (h *Handler) damesAct(w http.ResponseWriter, r *http.Request) {
	gameID, err := strconv.ParseInt(chi.URLParam(r, "game"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	action := chi.URLParam(r, "action")
	var req struct {
		Path []int `json:"path"`
	}
	if action == "move" {
		if err := httpx.Decode(r, &req); err != nil || len(req.Path) < 2 || len(req.Path) > 21 {
			httpx.Error(w, http.StatusBadRequest, "requête invalide")
			return
		}
	}
	if action == "accept" {
		// Accepting puts the stake down: the Sim's money moves with it.
		h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
			d, err := h.lockDame(r.Context(), tx, gameID, s.ID)
			if err != nil {
				return game.Outcome{}, nil, err
			}
			if err := expire(r.Context(), tx, &d); err != nil {
				return game.Outcome{}, nil, err
			}
			if d.Status != "invited" || d.Black == nil || *d.Black != s.ID {
				return game.Outcome{}, nil, errors.New("ce défi n'attend plus de réponse")
			}
			if s.Money < d.Stake {
				return game.Outcome{}, nil, game.ErrNotEnoughMoney
			}
			// The one who challenged puts theirs down now too, if they still have it.
			tag, err := tx.Exec(r.Context(), `UPDATE sims SET money = money - $1 WHERE id = $2 AND money >= $1`, d.Stake, d.White)
			if err != nil {
				return game.Outcome{}, nil, err
			}
			if tag.RowsAffected() == 0 {
				return game.Outcome{}, nil, fmt.Errorf("%s n'a plus de quoi miser", d.WhiteName)
			}
			s.Money -= d.Stake
			if _, err := tx.Exec(r.Context(), `UPDATE dames SET status = 'playing', updated_at = now() WHERE id = $1`, d.ID); err != nil {
				return game.Outcome{}, nil, err
			}
			_ = befriend(r.Context(), tx, s.ID, d.White, 3)
			_ = insertEvent(r.Context(), tx, d.White, "dames", fmt.Sprintf("%s a accepté ton défi aux dames : à toi de jouer (les blancs).", s.FirstName), -d.Stake, game.MinuteOf(time.Now()))
			return game.Outcome{Text: fmt.Sprintf("Partie lancée contre %s : %s joue les blancs.", d.WhiteName, d.WhiteName), Money: -d.Stake}, nil, nil
		})
		return
	}
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	d, err := h.lockDame(ctx, tx, gameID, id)
	if err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if err := expire(ctx, tx, &d); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	me := int8(1)
	if d.Black != nil && *d.Black == id {
		me = -1
	}
	fail := func(err error) { httpx.Error(w, http.StatusUnprocessableEntity, err.Error()) }
	switch action {
	case "decline":
		if d.Status != "invited" {
			fail(errDameOver)
			return
		}
		d.Status, d.Text = "declined", "Défi refusé."
		if _, err := tx.Exec(ctx, `UPDATE dames SET status = 'declined', result = $2, updated_at = now() WHERE id = $1`, d.ID, d.Text); err != nil {
			fail(err)
			return
		}
		_ = insertEvent(ctx, tx, d.White, "dames", fmt.Sprintf("%s ne veut pas jouer aux dames pour l'instant.", d.BlackName), 0, game.MinuteOf(time.Now()))
	case "resign":
		if d.Status != "playing" {
			fail(errDameOver)
			return
		}
		if err := finish(ctx, tx, &d, -me, "abandon"); err != nil {
			fail(err)
			return
		}
	case "move":
		if d.Status != "playing" {
			fail(errDameOver)
			return
		}
		if d.Turn != me {
			fail(errDameNotTurn)
			return
		}
		m, ok := d.Board.Find(me, req.Path)
		if !ok {
			fail(errDameIllegal)
			return
		}
		if err := d.play(ctx, tx, m); err != nil {
			fail(err)
			return
		}
		// The man of the grin answers at once.
		if d.Status == "playing" && d.Black == nil && d.Turn == -1 {
			reply, ok := d.Board.BestMove(-1, d.Depth, newRand())
			if ok {
				if err := d.play(ctx, tx, reply); err != nil {
					fail(err)
					return
				}
			}
		}
	default:
		httpx.Error(w, http.StatusNotFound, "action inconnue")
		return
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"game": d.view(id)})
}

// play: the move on the board, the turn passed, the game over if the other side can't move (or it's a draw).
func (d *dameRow) play(ctx context.Context, tx pgx.Tx, m game.DamesMove) error {
	board, quiet := d.Board.Play(m)
	d.Board, d.Last = board, &m
	if quiet {
		d.Quiet++
	} else {
		d.Quiet = 0
	}
	d.Turn = -d.Turn
	last, _ := json.Marshal(m)
	if _, err := tx.Exec(ctx, `UPDATE dames SET board = $2, turn = $3, quiet = $4, last = $5, updated_at = now() WHERE id = $1`, d.ID, d.Board.String(), d.Turn, d.Quiet, string(last)); err != nil {
		return err
	}
	switch {
	case len(d.Board.Moves(d.Turn)) == 0:
		return finish(ctx, tx, d, -d.Turn, "")
	case d.Quiet >= game.DamesQuietDraw:
		return finish(ctx, tx, d, 0, "")
	}
	return nil
}

// lockDame: a game of the Sim's, for update.
func (h *Handler) lockDame(ctx context.Context, tx pgx.Tx, gameID int64, sim string) (dameRow, error) {
	d, err := scanDame(tx.QueryRow(ctx, `SELECT `+dameColumns+dameFrom+` WHERE d.id = $1 FOR UPDATE OF d`, gameID))
	if errors.Is(err, pgx.ErrNoRows) {
		return d, errDameNotYours
	}
	if err != nil {
		return d, err
	}
	// The Sim must be one of the two, and the player's own.
	var mine bool
	_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sims WHERE id = $1 AND user_id = $2)`, sim, auth.UserID(ctx)).Scan(&mine)
	if !mine || (d.White != sim && (d.Black == nil || *d.Black != sim)) {
		return d, errDameNotYours
	}
	return d, nil
}

// DameInvite: a game waiting for the Sim (a challenge to answer, or its game going on), in the « around » news.
type DameInvite struct {
	ID       int64  `json:"id"`
	Status   string `json:"status"`
	FromName string `json:"fromName"`
	Stake    int    `json:"stake"`
	Mine     bool   `json:"mine"`
}

// queuePendingDame: the challenge waiting for the Sim's answer, or its game going on; nil if none.
func queuePendingDame(b *pgx.Batch, sim string, out **DameInvite) {
	b.Queue(`SELECT d.id, d.status, w.first_name, d.stake, d.white FROM dames d JOIN sims w ON w.id = d.white
		WHERE ((d.black = $1 AND d.status = 'invited' AND d.created_at > $2) OR ((d.white = $1 OR d.black = $1) AND d.status = 'playing'))
		ORDER BY d.id DESC LIMIT 1`, sim, time.Now().Add(-dameInviteWindow)).QueryRow(func(row pgx.Row) error {
		var in DameInvite
		var white string
		if row.Scan(&in.ID, &in.Status, &in.FromName, &in.Stake, &white) == nil {
			in.Mine = white == sim
			*out = &in
		}
		return nil
	})
}
