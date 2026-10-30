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

// 8 américain (game/huit.go plays the rules), the card game of the 8
// américain app: at a table with one to three of the game's players, or
// against a player friend challenged, for nothing or for money. Each puts the
// stake down when the game starts (the friend when they accept), the game's
// players too, and the first to have no cards left takes it all. The game's
// players play here, right after the Sim, so a game can't be won from the
// phone. A friend who doesn't play for huitIdle has given up the game; a
// challenge not answered within huitInviteWindow is gone.

const (
	huitIdle         = 10 * time.Minute
	huitInviteWindow = 10 * time.Minute
	// huitNpcMax: the most the game's players put on a game; huitPlayerMax: between friends.
	huitNpcMax    = 2000
	huitPlayerMax = 10000
	// How long a game just over still shows (its result).
	huitShowEnded = 3 * time.Minute
	// The steps kept for the phones to show (the last move and the game's players' answers).
	huitSteps = 40
	// huitLiveIdle: a game started from « Jouer contre un joueur » (pvp.go): a move's time.
	huitLiveIdle = 90 * time.Second
)

var (
	errHuitBusy  = errors.New("tu as déjà une partie de 8 américain en cours")
	errHuitStake = errors.New("mise invalide")
	errHuitTable = errors.New("on joue à 2, 3 ou 4")
	errHuitMine  = errors.New("ce n'est pas ta partie")
)

// The game's players who sit down when the phone names none.
var huitBots = []string{"Tantie Bintou", "Le Boss du 8", "Kader Joker", "Mimi Carreau"}

// HuitSeat: a player at the table, as the phones see them (how many cards, not which).
type HuitSeat struct {
	ID    string `json:"id,omitempty"`
	Name  string `json:"name"`
	Npc   bool   `json:"npc,omitempty"`
	Cards int    `json:"cards"`
}

// HuitGame: a game as the phone shows it, from one seat.
type HuitGame struct {
	ID     int64           `json:"id"`
	You    int             `json:"you"`
	Seats  []HuitSeat      `json:"seats"`
	Hand   []game.Card     `json:"hand"`
	Top    game.Card       `json:"top"`   // the last card put down
	Under  game.Card       `json:"under"` // the one played on (under the jokers)
	Deck   int             `json:"deck"`
	Turn   int             `json:"turn"`
	Dir    int             `json:"dir"`
	Suit   int             `json:"suit"`
	Owed   int             `json:"owed"`
	By     int             `json:"by"`
	Ace    bool            `json:"ace"`
	Drawn  int             `json:"drawn"` // the card the Sim just drew, which goes (-1 none)
	Legal  []game.Card     `json:"legal"`
	Stake  int             `json:"stake"`
	Pot    int             `json:"pot"`
	Status string          `json:"status"`
	Winner int             `json:"winner"`
	Text   string          `json:"text,omitempty"`
	Steps  []game.HuitStep `json:"steps"`
	// Live: against a player on the spot (pvp.go); Deadline: when the one to play loses it (ms).
	Live     bool  `json:"live,omitempty"`
	Deadline int64 `json:"deadline,omitempty"`
}

// huitRow: a game as kept.
type huitRow struct {
	ID        int64
	Host      string
	Guest     *string
	HostName  string
	GuestName string
	Bots      []string
	Stake     int
	G         game.Huit
	Status    string
	Winner    int
	Text      string
	UpdatedAt time.Time
	CreatedAt time.Time
	// Live: started from « Jouer contre un joueur » (pvp.go).
	Live bool
}

const huitColumns = `h.id, h.host, h.guest, a.first_name, COALESCE(b.first_name, ''), h.bots, h.stake, h.state, h.status, h.winner, h.result, h.updated_at, h.created_at, h.live`
const huitFrom = ` FROM huit h JOIN sims a ON a.id = h.host LEFT JOIN sims b ON b.id = h.guest`

func scanHuit(row pgx.Row) (huitRow, error) {
	var h huitRow
	var state []byte
	if err := row.Scan(&h.ID, &h.Host, &h.Guest, &h.HostName, &h.GuestName, &h.Bots, &h.Stake, &state, &h.Status, &h.Winner, &h.Text, &h.UpdatedAt, &h.CreatedAt, &h.Live); err != nil {
		return h, err
	}
	err := json.Unmarshal(state, &h.G)
	return h, err
}

// names: who sits where (the Sim who started at 0, then the friend or the game's players).
func (h huitRow) names() []string {
	if h.Guest != nil {
		return []string{h.HostName, h.GuestName}
	}
	return append([]string{h.HostName}, h.Bots...)
}

// seatOf: the Sim's seat (-1 not at the table).
func (h huitRow) seatOf(sim string) int {
	switch {
	case h.Host == sim:
		return 0
	case h.Guest != nil && *h.Guest == sim:
		return 1
	}
	return -1
}

// view: the game from the Sim's seat: its own cards, the others' counted.
func (h huitRow) view(me string) HuitGame {
	you := h.seatOf(me)
	names := h.names()
	g := HuitGame{ID: h.ID, You: you, Deck: len(h.G.Deck), Turn: h.G.Turn, Dir: h.G.Dir, Suit: h.G.Suit, Owed: h.G.Owed, By: h.G.By, Ace: h.G.Ace, Drawn: -1, Stake: h.Stake, Pot: h.Stake * len(names), Status: h.Status, Winner: h.Winner, Text: h.Text}
	for i, name := range names {
		seat := HuitSeat{Name: name, Npc: h.Guest == nil && i > 0}
		if i < len(h.G.Hands) {
			seat.Cards = len(h.G.Hands[i])
		}
		switch {
		case i == 0:
			seat.ID = h.Host
		case h.Guest != nil:
			seat.ID = *h.Guest
		}
		g.Seats = append(g.Seats, seat)
	}
	if you >= 0 && you < len(h.G.Hands) {
		g.Hand = append([]game.Card{}, h.G.Hands[you]...)
	}
	if n := len(h.G.Pile); n > 0 {
		g.Top, g.Under = h.G.Pile[n-1], h.G.Top()
	}
	if h.Live {
		g.Live = true
		if h.Status == "playing" {
			g.Deadline = h.UpdatedAt.Add(huitLiveIdle).UnixMilli()
		}
	}
	if h.Status == "playing" && h.G.Turn == you {
		g.Legal = h.G.Legal(you)
		g.Drawn = h.G.Drawn
	}
	// The cards others drew stay theirs: only how many.
	for _, s := range h.G.Steps {
		if s.Seat != you {
			s.Cards = nil
		}
		g.Steps = append(g.Steps, s)
	}
	return g
}

// currentHuit: the Sim's game going on (or waiting for an answer, or just over).
func currentHuit(ctx context.Context, tx pgx.Tx, sim string) (huitRow, error) {
	return scanHuit(tx.QueryRow(ctx, `SELECT `+huitColumns+huitFrom+` WHERE (h.host = $1 OR h.guest = $1) AND (h.status IN ('invited', 'playing') OR h.updated_at > $2) ORDER BY h.id DESC LIMIT 1 FOR UPDATE OF h`, sim, time.Now().Add(-huitShowEnded)))
}

// save: the game's cards and turn kept.
func (h *huitRow) save(ctx context.Context, tx pgx.Tx) error {
	if len(h.G.Steps) > huitSteps {
		h.G.Steps = h.G.Steps[len(h.G.Steps)-huitSteps:]
	}
	state, err := json.Marshal(h.G)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE huit SET state = $2, updated_at = now() WHERE id = $1`, h.ID, state)
	return err
}

// expireHuit: a challenge left unanswered, a friend's game left unplayed: over, settled.
func expireHuit(ctx context.Context, tx pgx.Tx, h *huitRow) error {
	now := time.Now()
	switch {
	case h.Status == "invited" && now.Sub(h.CreatedAt) > huitInviteWindow:
		h.Status, h.Text = "expired", "Le défi n'a pas eu de réponse."
		_, err := tx.Exec(ctx, `UPDATE huit SET status = $2, result = $3, updated_at = now() WHERE id = $1`, h.ID, h.Status, h.Text)
		return err
	case h.Status == "playing" && h.Guest != nil && (now.Sub(h.UpdatedAt) > huitIdle || (h.Live && now.Sub(h.UpdatedAt) > huitLiveIdle)):
		// The one who had to play has given up.
		return finishHuit(ctx, tx, h, 1-h.G.Turn, true)
	}
	return nil
}

// finishHuit: the game is over, won by seat: the pot paid, the journal told.
func finishHuit(ctx context.Context, tx pgx.Tx, h *huitRow, winner int, abandon bool) error {
	names := h.names()
	h.Status, h.Winner = "done", winner
	pot := h.Stake * len(names)
	if abandon {
		h.Text = fmt.Sprintf("%s abandonne : %s gagne.", names[h.G.Turn], names[winner])
		if h.Guest == nil {
			h.Text = fmt.Sprintf("Tu abandonnes : %s gagne.", names[winner])
		}
	} else {
		h.Text = fmt.Sprintf("%s pose sa dernière carte et gagne !", names[winner])
	}
	if h.Stake > 0 {
		h.Text += " " + game.FCFA(pot) + " pour " + names[winner] + "."
	}
	players := []string{h.Host}
	if h.Guest != nil {
		players = append(players, *h.Guest)
	}
	minute := game.MinuteOf(time.Now())
	for seat, sim := range players {
		amount := 0
		line := "8 américain : " + h.Text
		if seat == winner && h.Stake > 0 {
			// Won: within the day's limit for the account (money.go).
			src := game.FromPlayers
			if h.Guest == nil {
				src = game.FromGames
			}
			var err error
			if amount, err = payWinner(ctx, tx, sim, h.Stake, pot, src); err != nil {
				return err
			}
			if amount < pot {
				line += " " + game.Full(src)
			}
		}
		_ = insertEvent(ctx, tx, sim, "huit", line, amount, minute)
	}
	if h.Live && h.Guest != nil {
		pvpRecordGame(ctx, tx, "huit", players, winner, h.Stake)
	}
	h.G.Winner = winner
	state, _ := json.Marshal(h.G)
	_, err := tx.Exec(ctx, `UPDATE huit SET status = 'done', winner = $2, result = $3, state = $4, updated_at = now() WHERE id = $1`, h.ID, winner, h.Text, state)
	return err
}

// huit: the Sim's game, if any (GET /sims/{id}/huit).
func (h *Handler) huit(w http.ResponseWriter, r *http.Request) {
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
	g, err := currentHuit(ctx, tx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.JSON(w, http.StatusOK, map[string]any{"game": nil})
		return
	}
	if err == nil {
		err = expireHuit(ctx, tx, &g)
	}
	if err == nil {
		err = tx.Commit(ctx)
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"game": g.view(id)})
}

// huitStart: a table with the game's players, or a friend challenged (POST /sims/{id}/huit).
func (h *Handler) huitStart(w http.ResponseWriter, r *http.Request) {
	var req struct {
		With  string   `json:"with"`
		Npcs  []string `json:"npcs"`
		Stake int      `json:"stake"`
	}
	if err := httpx.Decode(r, &req); err != nil || req.With == "" {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if g, err := currentHuit(ctx, tx, s.ID); err == nil {
			if err := expireHuit(ctx, tx, &g); err != nil {
				return game.Outcome{}, nil, err
			}
			if g.Status == "invited" || g.Status == "playing" {
				return game.Outcome{}, nil, errHuitBusy
			}
		}
		if req.With == "npc" {
			if len(req.Npcs) < 1 || len(req.Npcs) > game.HuitMaxPlayers-1 {
				return game.Outcome{}, nil, errHuitTable
			}
			bots := make([]string, len(req.Npcs))
			for i, n := range req.Npcs {
				n = strings.TrimSpace(n)
				if n == "" || len([]rune(n)) > 24 {
					n = huitBots[i]
				}
				bots[i] = n
			}
			if req.Stake < 0 || req.Stake > huitNpcMax {
				return game.Outcome{}, nil, errHuitStake
			}
			if s.Money < req.Stake {
				return game.Outcome{}, nil, game.ErrNotEnoughMoney
			}
			g, err := game.NewHuit(1+len(bots), newRand())
			if err != nil {
				return game.Outcome{}, nil, err
			}
			state, _ := json.Marshal(g)
			s.Money -= req.Stake
			s.Needs = s.Needs.Add(game.Needs{Social: 4})
			if _, err := tx.Exec(ctx, `INSERT INTO huit (host, bots, stake, state, status) VALUES ($1, $2, $3, $4, 'playing')`, s.ID, bots, req.Stake, state); err != nil {
				return game.Outcome{}, nil, err
			}
			text := fmt.Sprintf("Tu t'assois au 8 américain avec %s.", strings.Join(bots, ", "))
			if req.Stake > 0 {
				text = fmt.Sprintf("Tu t'assois au 8 américain avec %s, %s chacun sur la table.", strings.Join(bots, ", "), game.FCFA(req.Stake))
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
		if req.Stake < 0 || req.Stake > huitPlayerMax {
			return game.Outcome{}, nil, errHuitStake
		}
		if s.Money < req.Stake {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		if req.Stake > 0 {
			if err := heldBack(ctx, tx, s.ID); err != nil {
				return game.Outcome{}, nil, err
			}
		}
		var busy bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM huit WHERE (host = $1 OR guest = $1) AND (status = 'playing' OR (status = 'invited' AND created_at > $2)))`, o.ID, time.Now().Add(-huitInviteWindow)).Scan(&busy)
		if busy {
			return game.Outcome{}, nil, fmt.Errorf("%s a déjà une partie de 8 américain en cours", o.FirstName)
		}
		g, err := game.NewHuit(2, newRand())
		if err != nil {
			return game.Outcome{}, nil, err
		}
		state, _ := json.Marshal(g)
		if _, err := tx.Exec(ctx, `INSERT INTO huit (host, guest, stake, state, status) VALUES ($1, $2, $3, $4, 'invited')`, s.ID, o.ID, req.Stake, state); err != nil {
			return game.Outcome{}, nil, err
		}
		mise := ""
		if req.Stake > 0 {
			mise = ", mise " + game.FCFA(req.Stake)
		}
		_ = insertEvent(ctx, tx, o.ID, "huit", fmt.Sprintf("%s te défie au 8 américain%s.", s.FirstName, mise), 0, game.MinuteOf(time.Now()))
		return game.Outcome{Text: fmt.Sprintf("Défi envoyé à %s%s : à lui ou à elle de répondre.", o.FirstName, mise)}, nil, nil
	})
}

// huitAct: accept or decline a challenge, put a card down, draw, pass, give up
// (POST /sims/{id}/huit/{game}/{action}).
func (h *Handler) huitAct(w http.ResponseWriter, r *http.Request) {
	gameID, err := strconv.ParseInt(chi.URLParam(r, "game"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	action := chi.URLParam(r, "action")
	var req struct {
		Card  int  `json:"card"`
		Suit  int  `json:"suit"`
		Carte bool `json:"carte"`
	}
	if action == "play" {
		if err := httpx.Decode(r, &req); err != nil || req.Card < 0 || req.Card > 53 {
			httpx.Error(w, http.StatusBadRequest, "requête invalide")
			return
		}
	}
	if action == "accept" {
		// Accepting puts the stake down: the Sim's money moves with it.
		h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
			g, err := h.lockHuit(r.Context(), tx, gameID, s.ID)
			if err != nil {
				return game.Outcome{}, nil, err
			}
			if err := expireHuit(r.Context(), tx, &g); err != nil {
				return game.Outcome{}, nil, err
			}
			if g.Status != "invited" || g.seatOf(s.ID) != 1 {
				return game.Outcome{}, nil, errors.New("ce défi n'attend plus de réponse")
			}
			if s.Money < g.Stake {
				return game.Outcome{}, nil, game.ErrNotEnoughMoney
			}
			if g.Stake > 0 {
				if err := heldBack(r.Context(), tx, s.ID); err != nil {
					return game.Outcome{}, nil, err
				}
			}
			// The one who challenged puts theirs down now too, if they still have it.
			tag, err := tx.Exec(r.Context(), `UPDATE sims SET money = money - $1 WHERE id = $2 AND money >= $1`, g.Stake, g.Host)
			if err != nil {
				return game.Outcome{}, nil, err
			}
			if tag.RowsAffected() == 0 {
				return game.Outcome{}, nil, fmt.Errorf("%s n'a plus de quoi miser", g.HostName)
			}
			s.Money -= g.Stake
			if _, err := tx.Exec(r.Context(), `UPDATE huit SET status = 'playing', updated_at = now() WHERE id = $1`, g.ID); err != nil {
				return game.Outcome{}, nil, err
			}
			_ = befriend(r.Context(), tx, s.ID, g.Host, 3)
			_ = insertEvent(r.Context(), tx, g.Host, "huit", fmt.Sprintf("%s a accepté ton défi au 8 américain : à toi de jouer.", s.FirstName), -g.Stake, game.MinuteOf(time.Now()))
			return game.Outcome{Text: fmt.Sprintf("Partie lancée contre %s : %s commence.", g.HostName, g.HostName), Money: -g.Stake}, nil, nil
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
	g, err := h.lockHuit(ctx, tx, gameID, id)
	if err == nil {
		err = expireHuit(ctx, tx, &g)
	}
	if err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	me := g.seatOf(id)
	fail := func(err error) { httpx.Error(w, http.StatusUnprocessableEntity, err.Error()) }
	rnd := newRand()
	switch action {
	case "decline":
		if g.Status != "invited" || me != 1 {
			fail(game.ErrHuitOver)
			return
		}
		g.Status, g.Text = "declined", "Défi refusé."
		if _, err := tx.Exec(ctx, `UPDATE huit SET status = 'declined', result = $2, updated_at = now() WHERE id = $1`, g.ID, g.Text); err != nil {
			fail(err)
			return
		}
		_ = insertEvent(ctx, tx, g.Host, "huit", fmt.Sprintf("%s ne veut pas jouer au 8 américain pour l'instant.", g.GuestName), 0, game.MinuteOf(time.Now()))
	case "resign":
		if g.Status != "playing" {
			fail(game.ErrHuitOver)
			return
		}
		// Between friends, the other wins; at the game's table, the next one round.
		g.G.Turn = me
		winner := 1 - me
		if g.Guest == nil {
			winner = 1
		}
		if err := finishHuit(ctx, tx, &g, winner, true); err != nil {
			fail(err)
			return
		}
	case "play", "draw", "pass":
		if g.Status != "playing" {
			fail(game.ErrHuitOver)
			return
		}
		var step game.HuitStep
		var err error
		switch action {
		case "play":
			step, err = g.G.Play(me, game.Card(req.Card), req.Suit, req.Carte, rnd)
		case "draw":
			step, err = g.G.Draw(me, rnd)
		default:
			step, err = g.G.Pass(me)
		}
		if err != nil {
			fail(err)
			return
		}
		g.G.Steps = []game.HuitStep{step}
		// The game's players answer at once, until it's the Sim's turn again.
		for k := 0; g.Guest == nil && g.G.Winner < 0 && g.G.Turn != 0 && k < 500; k++ {
			s, err := g.G.HuitBot(g.G.Turn, rnd)
			if err != nil {
				fail(err)
				return
			}
			g.G.Steps = append(g.G.Steps, s)
		}
		if err := g.save(ctx, tx); err != nil {
			fail(err)
			return
		}
		if g.G.Winner >= 0 {
			if err := finishHuit(ctx, tx, &g, g.G.Winner, false); err != nil {
				fail(err)
				return
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
	// The other player sees the move at once (the table loads again: web Huit.tsx).
	if g.Guest != nil {
		other := g.Host
		if other == id {
			other = *g.Guest
		}
		h.notify(other, map[string]any{"t": "pvp", "game": "huit", "ref": g.ID})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"game": g.view(id)})
}

// lockHuit: a game of the Sim's, for update.
func (h *Handler) lockHuit(ctx context.Context, tx pgx.Tx, gameID int64, sim string) (huitRow, error) {
	g, err := scanHuit(tx.QueryRow(ctx, `SELECT `+huitColumns+huitFrom+` WHERE h.id = $1 FOR UPDATE OF h`, gameID))
	if errors.Is(err, pgx.ErrNoRows) {
		return g, errHuitMine
	}
	if err != nil {
		return g, err
	}
	// The Sim must be at the table, and the player's own.
	var mine bool
	_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sims WHERE id = $1 AND user_id = $2)`, sim, auth.UserID(ctx)).Scan(&mine)
	if !mine || g.seatOf(sim) < 0 {
		return g, errHuitMine
	}
	return g, nil
}

// HuitInvite: a game waiting for the Sim (a challenge to answer, or its game going on), in the « around » news.
type HuitInvite struct {
	ID       int64  `json:"id"`
	Status   string `json:"status"`
	FromName string `json:"fromName"`
	Stake    int    `json:"stake"`
	Mine     bool   `json:"mine"`
}

// queuePendingHuit: the challenge waiting for the Sim's answer, or its game going on; nil if none.
func queuePendingHuit(b *pgx.Batch, sim string, out **HuitInvite) {
	b.Queue(`SELECT h.id, h.status, a.first_name, h.stake, h.host FROM huit h JOIN sims a ON a.id = h.host
		WHERE ((h.guest = $1 AND h.status = 'invited' AND h.created_at > $2) OR ((h.host = $1 OR h.guest = $1) AND h.status = 'playing'))
		ORDER BY h.id DESC LIMIT 1`, sim, time.Now().Add(-huitInviteWindow)).QueryRow(func(row pgx.Row) error {
		var in HuitInvite
		var host string
		if row.Scan(&in.ID, &in.Status, &in.FromName, &in.Stake, &host) == nil {
			in.Mine = host == sim
			*out = &in
		}
		return nil
	})
}
