package sims

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Player against player at the street fight (update « combat-joueurs », web
// components/defi/combat/net.ts): a player challenges another in the same
// commune, who says yes or no; then both phones meet in the live hub's
// "fight" room, the one who challenged running the fight and the other
// sending its hands. Two babies have their baby fight. Kept in memory: a
// challenge lasts a minute, a fight a few.

const (
	duelAsk  = time.Minute
	duelLast = 10 * time.Minute
)

type duel struct {
	ID    string    `json:"id"`
	From  string    `json:"from"`
	To    string    `json:"to"`
	Names [2]string `json:"names"`
	Baby  bool      `json:"baby"`
	// State: "pending" (asked), "on" (said yes), "off" (said no).
	State string    `json:"state"`
	At    time.Time `json:"at"`
	done  map[string]bool
}

// Duels: the challenges and fights going on.
type Duels struct {
	mu sync.Mutex
	m  map[string]*duel
	n  int
}

func (d *Duels) prune() {
	for id, x := range d.m {
		if (x.State == "pending" && time.Since(x.At) > duelAsk) || time.Since(x.At) > duelLast {
			delete(d.m, id)
		}
	}
}

// Has: this Sim fights in this duel, said yes (the live hub's "fight" room).
func (d *Duels) Has(id, sim string) bool {
	if d == nil {
		return false
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	x := d.m[id]
	return x != nil && x.State == "on" && (x.From == sim || x.To == sim)
}

// of: the duel this Sim is in, the newest (asked, or on), or nil.
func (d *Duels) of(sim string) *duel {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.prune()
	var out *duel
	for _, x := range d.m {
		if (x.From == sim || x.To == sim) && x.State != "off" && !x.done[sim] && (out == nil || x.At.After(out.At)) {
			c := *x
			out = &c
		}
	}
	return out
}

var (
	errDuelBaby = errors.New("un bébé ne se bagarre qu'avec un autre bébé")
	errDuelGone = errors.New("ce défi n'est plus valable")
	errDuelBusy = errors.New("un défi est déjà en cours")
)

func (h *Handler) notify(to string, v map[string]any) {
	if h.Notify != nil {
		h.Notify(to, v)
	}
}

// duelChallenge: POST {to}: challenge a player of the commune, online now.
func (h *Handler) duelChallenge(w http.ResponseWriter, r *http.Request) {
	if features.Default.BlocksKey(r.Context(), "combat-joueurs") != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	var req struct {
		To string `json:"to"`
	}
	if httpx.Decode(r, &req) != nil || req.To == "" {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	id, city, commune, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	now := game.MinuteOf(time.Now())
	var names [2]string
	var born [2]int64
	var oCity, oCommune, owner string
	if err := h.DB.QueryRow(ctx, `SELECT first_name, born_at FROM sims WHERE id = $1`, id).Scan(&names[0], &born[0]); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	err = h.DB.QueryRow(ctx, `SELECT first_name, born_at, city, commune, user_id FROM sims WHERE id = $1`, req.To).Scan(&names[1], &born[1], &oCity, &oCommune, &owner)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && owner == auth.UserID(ctx)) {
		httpx.Error(w, http.StatusNotFound, errNoFriend.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if oCity != city || oCommune != commune || (h.Connected != nil && !h.Connected(req.To)) {
		httpx.Error(w, http.StatusConflict, errNotHere.Error())
		return
	}
	baby := [2]bool{game.StageOf(game.AgeAt(born[0], now)).ID == game.StageBebe, game.StageOf(game.AgeAt(born[1], now)).ID == game.StageBebe}
	if baby[0] != baby[1] {
		httpx.Error(w, http.StatusConflict, errDuelBaby.Error())
		return
	}
	d := h.Duels
	d.mu.Lock()
	d.prune()
	for _, x := range d.m {
		if x.State != "off" && (x.From == id || x.To == id || x.From == req.To || x.To == req.To) {
			d.mu.Unlock()
			httpx.Error(w, http.StatusConflict, errDuelBusy.Error())
			return
		}
	}
	d.n++
	x := &duel{ID: strconv.FormatInt(time.Now().UnixNano(), 36) + strconv.Itoa(d.n), From: id, To: req.To, Names: names, Baby: baby[0], State: "pending", At: time.Now(), done: map[string]bool{}}
	if d.m == nil {
		d.m = map[string]*duel{}
	}
	d.m[x.ID] = x
	c := *x
	d.mu.Unlock()
	h.notify(req.To, map[string]any{"t": "duel", "id": c.ID})
	httpx.JSON(w, http.StatusOK, c)
}

// duelAnswer: POST {accept}: the one challenged says yes or no.
func (h *Handler) duelAnswer(w http.ResponseWriter, r *http.Request) {
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
	d := h.Duels
	d.mu.Lock()
	d.prune()
	x := d.m[chi.URLParam(r, "duel")]
	if x == nil || x.To != id || x.State != "pending" {
		d.mu.Unlock()
		httpx.Error(w, http.StatusConflict, errDuelGone.Error())
		return
	}
	x.State = "off"
	if req.Accept {
		x.State = "on"
		x.At = time.Now()
	}
	c := *x
	d.mu.Unlock()
	h.notify(c.From, map[string]any{"t": "duel", "id": c.ID})
	httpx.JSON(w, http.StatusOK, c)
}

// duelNow: GET: the challenge or fight this Sim is in, with the other one's face; null if none.
func (h *Handler) duelNow(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	x := h.Duels.of(id)
	if x == nil {
		httpx.JSON(w, http.StatusOK, map[string]any{"duel": nil})
		return
	}
	other := x.From
	if other == id {
		other = x.To
	}
	var look Look
	var gender string
	if err := h.DB.QueryRow(r.Context(), `SELECT look, gender FROM sims WHERE id = $1`, other).Scan(&look, &gender); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"duel": x, "other": map[string]any{"id": other, "look": look, "gender": gender}})
}

// duelEnd: POST {won, quit}: the fight over, for this Sim (once): the mood it leaves, said in the journal.
func (h *Handler) duelEnd(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Won  bool `json:"won"`
		Quit bool `json:"quit"`
	}
	if httpx.Decode(r, &req) != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	d := h.Duels
	sim := chi.URLParam(r, "id")
	d.mu.Lock()
	x := d.m[chi.URLParam(r, "duel")]
	if x == nil || x.State != "on" || (x.From != sim && x.To != sim) || x.done[sim] {
		d.mu.Unlock()
		httpx.Error(w, http.StatusConflict, errDuelGone.Error())
		return
	}
	other := x.Names[1]
	if x.To == sim {
		other = x.Names[0]
	}
	baby := x.Baby
	d.mu.Unlock()
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		d.mu.Lock()
		if x.done[sim] {
			d.mu.Unlock()
			return game.Outcome{}, nil, errDuelGone
		}
		x.done[sim] = true
		if x.done[x.From] && x.done[x.To] {
			delete(d.m, x.ID)
		}
		d.mu.Unlock()
		var text string
		switch {
		case req.Quit:
			text = fmt.Sprintf("Le combat contre %s s'arrête avant la fin.", other)
		case req.Won && baby:
			text = fmt.Sprintf("Bagarre gagnée contre %s : le jouet est à toi !", other)
		case req.Won:
			text = fmt.Sprintf("Victoire au combat contre %s : le quartier en parle !", other)
		case baby:
			text = fmt.Sprintf("%s t'a pris le jouet… La revanche, c'est pour bientôt.", other)
		default:
			text = fmt.Sprintf("%s t'a battu·e au combat. Entraîne-toi pour la revanche !", other)
		}
		gain := game.Needs{Fun: 8, Social: 8}
		if req.Won {
			gain.Fun = 15
		}
		if !req.Quit {
			s.Needs = s.Needs.Add(gain)
		}
		return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
	})
}
