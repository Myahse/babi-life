package sims

import (
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Sharing a ticket: a bet on the virtual football or a Loto Chance ticket,
// sent to a friend in Gbairai or to everyone in the grin, and drawn there as
// the ticket itself (web components/SharedCard.tsx) for the others to follow
// it, and play the same. The message carries a reference « [ticket:bet:ref:sig] »:
// the id in letters, signed by the server, so only a ticket its owner shared
// can be opened, and the messages' masks (links, phone numbers) leave it whole.

var errNotYourTicket = errors.New("ce ticket n'est pas à toi")

// letters: a number written in letters (a = 0, ba = 26…), digits being masked in messages.
func letters(n int64) string {
	if n <= 0 {
		return "a"
	}
	out := []byte{}
	for ; n > 0; n /= 26 {
		out = append([]byte{byte('a' + n%26)}, out...)
	}
	return string(out)
}

// unletters reads letters back (false if it isn't).
func unletters(s string) (int64, bool) {
	if s == "" || len(s) > 12 {
		return 0, false
	}
	var n int64
	for _, c := range []byte(s) {
		if c < 'a' || c > 'z' {
			return 0, false
		}
		n = n*26 + int64(c-'a')
	}
	return n, true
}

// ticketSig: the server's signature of a shared ticket, ten letters.
func ticketSig(kind string, id int64) string {
	m := hmac.New(sha256.New, []byte(game.BetSecret))
	m.Write([]byte("ticket:" + kind + ":" + strconv.FormatInt(id, 10)))
	sum := m.Sum(nil)
	out := make([]byte, 10)
	for i := range out {
		out[i] = 'a' + sum[i]%26
	}
	return string(out)
}

// TicketRef: what a message carries for a shared ticket.
func TicketRef(kind string, id int64) string {
	return "[ticket:" + kind + ":" + letters(id) + ":" + ticketSig(kind, id) + "]"
}

// ticketID: the ticket a shared reference names, if it's signed right.
func ticketID(kind, ref, sig string) (int64, bool) {
	id, ok := unletters(ref)
	if !ok || (kind != "bet" && kind != "loto") {
		return 0, false
	}
	return id, hmac.Equal([]byte(sig), []byte(ticketSig(kind, id)))
}

// shareTicket: the reference of one of the Sim's own tickets, to send (POST /sims/{id}/tickets/share).
func (h *Handler) shareTicket(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind string `json:"kind"`
		ID   int64  `json:"id"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	sim, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	table := map[string]string{"bet": "bets", "loto": "loto_tickets"}[req.Kind]
	var mine bool
	if table != "" {
		_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM `+table+` WHERE id = $1 AND sim = $2)`, req.ID, sim).Scan(&mine)
	}
	if !mine {
		httpx.Error(w, http.StatusForbidden, errNotYourTicket.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"ref": TicketRef(req.Kind, req.ID)})
}

// LotoView is a Loto Chance ticket as the app shows it.
type LotoView struct {
	ID      int64  `json:"id"`
	Draw    int64  `json:"draw"`
	Name    string `json:"name"`
	Numbers []int  `json:"numbers"`
	Drawn   []int  `json:"drawn,omitempty"`
	Stake   int    `json:"stake"`
	Status  string `json:"status"`
	Payout  int    `json:"payout"`
}

// lotoView: a ticket's draw, its name, and the numbers drawn once it's past.
func lotoView(t LotoView, nums []int32, now int64) LotoView {
	for _, n := range nums {
		t.Numbers = append(t.Numbers, int(n))
	}
	if d, ok := game.LotoDrawAt(t.Draw); ok {
		t.Name = d.Name
	}
	if t.Draw <= now {
		t.Drawn = game.LotoNumbers(t.Draw)
	}
	return t
}

// sharedTicket: a ticket someone shared, as it stands now, and whose it is (GET /tickets/{kind}/{ref}/{sig}).
func (h *Handler) sharedTicket(w http.ResponseWriter, r *http.Request) {
	kind := chi.URLParam(r, "kind")
	id, ok := ticketID(kind, chi.URLParam(r, "ref"), chi.URLParam(r, "sig"))
	if !ok {
		httpx.Error(w, http.StatusNotFound, "ticket introuvable")
		return
	}
	ctx := r.Context()
	now := time.Now().Unix()
	var owner string
	if kind == "loto" {
		var t LotoView
		var nums []int32
		if err := h.DB.QueryRow(ctx, `SELECT t.id, t.draw, t.numbers, t.stake, t.status, t.payout, s.first_name FROM loto_tickets t JOIN sims s ON s.id = t.sim WHERE t.id = $1`, id).
			Scan(&t.ID, &t.Draw, &nums, &t.Stake, &t.Status, &t.Payout, &owner); err != nil {
			httpx.Error(w, http.StatusNotFound, "ticket introuvable")
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"kind": kind, "owner": owner, "loto": lotoView(t, nums, now)})
		return
	}
	rows, err := h.DB.Query(ctx, `SELECT b.id, b.app, b.stake, b.odds::float8, b.status, b.payout, b.created_at, l.match, l.label, l.pick, l.odds::float8, s.first_name
		FROM bets b JOIN bet_legs l ON l.bet = b.id JOIN sims s ON s.id = b.sim WHERE b.id = $1 ORDER BY l.match`, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	var bet *BetView
	for rows.Next() {
		var b BetView
		var leg betLeg
		if err := rows.Scan(&b.ID, &b.App, &b.Stake, &b.Odds, &b.Status, &b.Payout, &b.At, &leg.Match, &leg.Label, &leg.Pick, &leg.Odds, &owner); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		legNow(b.App, &leg, now)
		if bet == nil {
			bet = &b
		}
		bet.Legs = append(bet.Legs, leg)
	}
	if bet == nil {
		httpx.Error(w, http.StatusNotFound, "ticket introuvable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"kind": kind, "owner": owner, "bet": bet})
}
