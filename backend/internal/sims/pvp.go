package sims

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Les jeux contre de vrais joueurs (update « jeux-en-ligne », web
// components/pvp/*): every game of the phone's « Jeux » and of the salle de
// jeux played against a real player, the way the street fight is (duel.go).
// A player challenges a friend or a player online in the city, who says yes
// or no; or waits in a game's queue for the next one who asks for the same
// game (« Trouver un adversaire »: the phone plays the computer if nobody
// comes). Then:
//
//   - the real-time games (the console's foot, the race, the fight, the
//     arcade's mosquitoes, the tea, the shopping list) meet in the live hub's
//     "pvp" room (live.go): the first player runs the game and sends it, the
//     other sends its hands (web streetball/online.ts, defi/combat/net.ts);
//   - les dames and le 8 américain are the server's own games (dames.go,
//     huit.go), started here between the two and played move by move, a
//     minute and a half a move;
//   - l'awalé and le Ludo are played move by move through here (Move): each
//     move kept in order, sent at once to the other, the dice thrown here;
//     both phones play the same rules (web game/awale.ts, game/ludo.ts), and
//     the one who doesn't play within pvpMove loses the game;
//   - le godé is played here whole: the server throws the dice, so nobody
//     can know the other's before calling.
//
// Each says how it ended (End): the result counts when both say the same, or
// when one has said it and the other hasn't within pvpReport. Kept in
// memory, like the duels; the stakes of le godé are kept in the database
// (pvp_stakes) until paid, and given back if the server stopped before.

const (
	pvpAsk    = 90 * time.Second
	pvpQueue  = 75 * time.Second
	pvpLast   = 40 * time.Minute
	pvpMove   = 60 * time.Second
	pvpReport = 30 * time.Second
	// pvpShown: a match over stays this long for the phones to show its result.
	pvpShown = 2 * time.Minute
	// pvpCount: from yes to the whistle of a real-time game (both phones open the line).
	pvpCount = 5 * time.Second
	// The challenges a Sim may send: one every pvpGap, pvpBurst in pvpBurstWindow.
	pvpGap         = 5 * time.Second
	pvpBurst       = 12
	pvpBurstWindow = 10 * time.Minute
	// pvpMoves: the most moves a game keeps (a Ludo game is a few hundred).
	pvpMoves = 1200
	// GodeTo: the rounds to win le godé against a player.
	GodeTo = 3
)

// PvpGame: a game that can be played against a player.
type PvpGame struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// Mode: "direct" (real time, both at once) or "tour" (move by move).
	Mode string `json:"mode"`
	// Max: the most each may stake (0: no stake); Adult: 18 and over, even for nothing.
	Max   int  `json:"max"`
	Adult bool `json:"adult"`
	// key: the phone key of its app, act: the place activity it's played at (a closed update holds it back).
	key, act string
}

// PvpGames: the games, in the order the phone lists them.
var PvpGames = []PvpGame{
	{ID: "foot", Name: "Babi Foot", Mode: "direct"},
	{ID: "course", Name: "La course à deux", Mode: "direct", act: "console-course"},
	{ID: "combat", Name: "Le combat de rue", Mode: "direct", act: "console-combat"},
	{ID: "arcade", Name: "Moustiques !", Mode: "direct", act: "borne-arcade"},
	{ID: "the", Name: "Le thé du grin", Mode: "direct"},
	{ID: "courses", Name: "La liste de courses", Mode: "direct"},
	{ID: "dames", Name: "Dames 225", Mode: "tour", Max: damePlayerMax, key: "app:dames"},
	{ID: "huit", Name: "8 américain", Mode: "tour", Max: huitPlayerMax, key: "app:huit"},
	{ID: "awale", Name: "Awalé 225", Mode: "tour", key: "app:awale"},
	{ID: "ludo", Name: "Ludo 225", Mode: "tour", key: "app:ludo"},
	{ID: "gode", Name: "Godé", Mode: "tour", Max: game.GodeMax, Adult: true, key: "app:gode"},
}

func pvpGame(id string) (PvpGame, bool) {
	i := slices.IndexFunc(PvpGames, func(g PvpGame) bool { return g.ID == id })
	if i < 0 {
		return PvpGame{}, false
	}
	return PvpGames[i], true
}

// moveLog: the games played move by move through here.
func moveLog(g string) bool { return g == "awale" || g == "ludo" || g == "gode" }

// PvpMove: a move of awalé or Ludo as kept: who played it, what (the phone's
// own words, sent on as is), the die thrown for it, and whose turn it is
// after (the index in Players, as the mover's rules say).
type PvpMove struct {
	By   string          `json:"by"`
	M    json.RawMessage `json:"m"`
	Die  int             `json:"die,omitempty"`
	Next int             `json:"next"`
	At   int64           `json:"at"`
}

// PvpGode: a game of godé between two players: the rounds won, who throws
// first this round (each in turn), where the round is (the first to throw,
// to call, the other to throw), the dice and the call; the last round as it
// fell, for both phones to show.
type PvpGode struct {
	Round  int    `json:"round"`
	Points [2]int `json:"points"`
	First  int    `json:"first"`
	Phase  string `json:"phase"` // "roll1", "call", "roll2", "over"
	Dice   [2]int `json:"dice"`
	Call   string `json:"call,omitempty"`
	// The last round: its dice (the first's, the other's, by seat), the call, who took it (-1: none yet).
	LastDice  [2]int `json:"lastDice"`
	LastCall  string `json:"lastCall,omitempty"`
	LastTaken int    `json:"lastTaken"`
	Rethrows  int    `json:"rethrows"`
}

// PvpMatch: a challenge, then the game between the players.
type PvpMatch struct {
	ID      string   `json:"id"`
	Game    string   `json:"game"`
	From    string   `json:"from"`
	Players []string `json:"players"`
	Names   []string `json:"names"`
	Stake   int      `json:"stake"`
	Baby    bool     `json:"baby"`
	// State: "pending" (asked), "on" (said yes, or met in the queue), "off" (said no), "done".
	State string `json:"state"`
	// Start: the whistle of a real-time game (ms, the server's clock); Seed: the same on both phones.
	Start int64 `json:"start"`
	Seed  int64 `json:"seed"`
	// Ref: the game of dames or 8 américain started for them.
	Ref   int64     `json:"ref,omitempty"`
	Moves []PvpMove `json:"moves,omitempty"`
	Gode  *PvpGode  `json:"gode,omitempty"`
	// Queue: met in the queue (no challenge was sent).
	Queue  bool   `json:"queue,omitempty"`
	Winner string `json:"winner,omitempty"`
	Draw   bool   `json:"draw,omitempty"`
	Result string `json:"result,omitempty"`
	// Deadline: when the one to play loses (ms), move by move.
	Deadline int64 `json:"deadline,omitempty"`

	at       time.Time
	moved    time.Time
	reports  map[string]string
	reportAt time.Time
	ended    time.Time
	recorded bool
}

func (m *PvpMatch) seat(sim string) int { return slices.Index(m.Players, sim) }

// copy: what the phones get (the moves slice copied: the match goes on changing).
func (m *PvpMatch) copy() *PvpMatch {
	c := *m
	c.Moves = slices.Clone(m.Moves)
	if m.Gode != nil {
		g := *m.Gode
		c.Gode = &g
	}
	c.reports = nil
	return &c
}

// pvpWait: a Sim in a game's queue.
type pvpWait struct {
	sim, name string
	baby      bool
	at        time.Time
}

// Pvp: the challenges, the queues and the games going on.
type Pvp struct {
	mu    sync.Mutex
	m     map[string]*PvpMatch
	queue map[string][]pvpWait
	sent  map[string][]time.Time
	n     int
	// now: the clock (tests set it).
	now func() time.Time
}

func (p *Pvp) clock() time.Time {
	if p.now != nil {
		return p.now()
	}
	return time.Now()
}

func (p *Pvp) init() {
	if p.m == nil {
		p.m = map[string]*PvpMatch{}
		p.queue = map[string][]pvpWait{}
		p.sent = map[string][]time.Time{}
	}
}

// Has: this Sim plays in this match, on now (the live hub's "pvp" room).
func (p *Pvp) Has(id, sim string) bool {
	if p == nil {
		return false
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	m := p.m[id]
	return m != nil && m.State == "on" && m.seat(sim) >= 0
}

var (
	errPvpGame     = errors.New("ce jeu ne se joue pas contre un joueur")
	errPvpBusy     = errors.New("une partie contre un joueur est déjà en cours")
	errPvpTheyBusy = errors.New("cette personne est déjà en partie")
	errPvpGone     = errors.New("ce défi n'est plus valable")
	errPvpFast     = errors.New("doucement : attends un peu avant de lancer un autre défi")
	errPvpBaby     = errors.New("un bébé ne joue qu'à la bagarre, avec un autre bébé")
	errPvpStake    = errors.New("mise invalide")
	errPvpMinor    = errors.New("pas de mise avec un mineur : jouez pour le plaisir")
	errPvpGodeAge  = errors.New("le godé, c'est à partir de 18 ans")
	errPvpNotOn    = errors.New("la partie n'est pas en cours")
	errPvpTurn     = errors.New("ce n'est pas à toi de jouer")
	errPvpSeq      = errors.New("un autre coup est passé avant : on recharge la partie")
	errPvpMove     = errors.New("coup invalide")
	errPvpSelf     = errors.New("tu ne peux pas jouer contre toi-même")
)

// prune: the old challenges, queues and games forgotten. Locked.
func (p *Pvp) prune(now time.Time) {
	for id, m := range p.m {
		switch {
		case m.State == "pending" && now.Sub(m.at) > pvpAsk,
			m.State == "off" && now.Sub(m.at) > pvpShown,
			m.State == "done" && now.Sub(m.ended) > pvpShown,
			now.Sub(m.at) > pvpLast:
			delete(p.m, id)
		}
	}
	for g, q := range p.queue {
		q = slices.DeleteFunc(q, func(w pvpWait) bool { return now.Sub(w.at) > pvpQueue })
		if len(q) == 0 {
			delete(p.queue, g)
		} else {
			p.queue[g] = q
		}
	}
	for sim, t := range p.sent {
		t = slices.DeleteFunc(t, func(at time.Time) bool { return now.Sub(at) > pvpBurstWindow })
		if len(t) == 0 {
			delete(p.sent, sim)
		} else {
			p.sent[sim] = t
		}
	}
}

// busy: the Sim is asked, asking, playing or waiting in a queue. Locked.
func (p *Pvp) busy(sim string) bool {
	for _, m := range p.m {
		if (m.State == "pending" || m.State == "on") && m.seat(sim) >= 0 {
			return true
		}
	}
	for _, q := range p.queue {
		if slices.ContainsFunc(q, func(w pvpWait) bool { return w.sim == sim }) {
			return true
		}
	}
	return false
}

// allow: the Sim may send a challenge now (and it's counted). Locked.
func (p *Pvp) allow(sim string, now time.Time) error {
	t := p.sent[sim]
	if len(t) > 0 && now.Sub(t[len(t)-1]) < pvpGap || len(t) >= pvpBurst {
		return errPvpFast
	}
	p.sent[sim] = append(t, now)
	return nil
}

func (p *Pvp) newID(now time.Time) string {
	p.n++
	return strconv.FormatInt(now.UnixNano(), 36) + strconv.Itoa(p.n)
}

// Challenge: from one Sim to another, for this game and stake (checked before: who they are).
func (p *Pvp) Challenge(g PvpGame, from, to string, names [2]string, baby bool, stake int) (*PvpMatch, error) {
	if from == to {
		return nil, errPvpSelf
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.init()
	now := p.clock()
	p.prune(now)
	if p.busy(from) {
		return nil, errPvpBusy
	}
	if p.busy(to) {
		return nil, errPvpTheyBusy
	}
	if err := p.allow(from, now); err != nil {
		return nil, err
	}
	m := &PvpMatch{ID: p.newID(now), Game: g.ID, From: from, Players: []string{from, to}, Names: names[:], Stake: stake, Baby: baby, State: "pending", Seed: rand.Int64N(1 << 40), at: now}
	p.m[m.ID] = m
	return m.copy(), nil
}

// Answer: the one challenged says yes or no. Yes: the match on, the whistle in a few seconds.
func (p *Pvp) Answer(id, sim string, accept bool) (*PvpMatch, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.init()
	now := p.clock()
	p.prune(now)
	m := p.m[id]
	if m == nil || m.State != "pending" || m.seat(sim) != 1 {
		return nil, errPvpGone
	}
	if !accept {
		m.State, m.at = "off", now
		return m.copy(), nil
	}
	p.begin(m, now)
	return m.copy(), nil
}

// begin: the match on now. Locked.
func (p *Pvp) begin(m *PvpMatch, now time.Time) {
	m.State, m.at, m.moved = "on", now, now
	m.Start = now.Add(pvpCount).UnixMilli()
	m.reports = map[string]string{}
	if m.Game == "gode" {
		m.Gode = &PvpGode{Phase: "roll1", LastTaken: -1}
	}
	if moveLog(m.Game) {
		m.Deadline = now.Add(pvpMove + pvpCount).UnixMilli()
	}
}

// Back: an "on" match (dames, 8 américain) whose game couldn't be started (money, a game already going on): off again. Locked by the caller's result.
func (p *Pvp) Back(id string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if m := p.m[id]; m != nil {
		m.State, m.at = "off", p.clock()
	}
}

// SetRef: the dames or 8 américain game started for the match.
func (p *Pvp) SetRef(id string, ref int64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if m := p.m[id]; m != nil {
		m.Ref = ref
	}
}

// Enqueue: the Sim waits for an opponent at this game; if one was waiting, the match is on with them (the one who waited first runs it).
func (p *Pvp) Enqueue(g PvpGame, sim, name string, baby bool) (*PvpMatch, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.init()
	now := p.clock()
	p.prune(now)
	if p.busy(sim) {
		return nil, errPvpBusy
	}
	q := p.queue[g.ID]
	i := slices.IndexFunc(q, func(w pvpWait) bool { return w.baby == baby && w.sim != sim })
	if i < 0 {
		p.queue[g.ID] = append(q, pvpWait{sim: sim, name: name, baby: baby, at: now})
		return nil, nil
	}
	w := q[i]
	p.queue[g.ID] = slices.Delete(q, i, i+1)
	m := &PvpMatch{ID: p.newID(now), Game: g.ID, From: w.sim, Players: []string{w.sim, sim}, Names: []string{w.name, name}, Baby: baby, Queue: true, Seed: rand.Int64N(1 << 40), at: now}
	p.begin(m, now)
	p.m[m.ID] = m
	return m.copy(), nil
}

// Dequeue: out of the queues (the phone stopped waiting).
func (p *Pvp) Dequeue(sim string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for g, q := range p.queue {
		p.queue[g] = slices.DeleteFunc(q, func(w pvpWait) bool { return w.sim == sim })
	}
}

// Waiting: the game the Sim waits for in a queue, and since when ("" if none).
func (p *Pvp) Waiting(sim string) (string, time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for g, q := range p.queue {
		for _, w := range q {
			if w.sim == sim {
				return g, w.at
			}
		}
	}
	return "", time.Time{}
}

// Of: the newest match the Sim is in (asked, on, or just over), and whether it now needs settling (an ended game not yet recorded).
func (p *Pvp) Of(sim string) (*PvpMatch, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.init()
	now := p.clock()
	p.prune(now)
	var out *PvpMatch
	for _, m := range p.m {
		if m.seat(sim) >= 0 && (out == nil || m.at.After(out.at)) {
			out = m
		}
	}
	if out == nil {
		return nil, false
	}
	p.expire(out, now)
	return out.copy(), out.State == "done" && !out.recorded
}

// Get: a match by id, if the Sim is in it.
func (p *Pvp) Get(id, sim string) (*PvpMatch, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.init()
	m := p.m[id]
	if m == nil || m.seat(sim) < 0 {
		return nil, false
	}
	p.expire(m, p.clock())
	return m.copy(), m.State == "done" && !m.recorded
}

// expire: the time a match gives ran out: the one to play loses (move by
// move); one said how it ended and the other said nothing (real time). Locked.
func (p *Pvp) expire(m *PvpMatch, now time.Time) {
	if m.State != "on" {
		return
	}
	if moveLog(m.Game) && m.Deadline > 0 && now.UnixMilli() > m.Deadline {
		late := p.toPlay(m)
		if late >= 0 {
			p.over(m, m.Players[1-late], false, fmt.Sprintf("%s n'a pas joué à temps : %s gagne.", m.Names[late], m.Names[1-late]), now)
			return
		}
	}
	if len(m.reports) > 0 && now.Sub(m.reportAt) > pvpReport {
		// The first word stands.
		for _, w := range m.reports {
			p.over(m, w, w == "", "", now)
			return
		}
	}
}

// toPlay: the seat whose move it is (move by move), -1 if it can't be said.
func (p *Pvp) toPlay(m *PvpMatch) int {
	if m.Gode != nil {
		switch m.Gode.Phase {
		case "roll1", "call":
			return m.Gode.First
		case "roll2":
			return 1 - m.Gode.First
		}
		return -1
	}
	if len(m.Moves) == 0 {
		return 0
	}
	n := m.Moves[len(m.Moves)-1].Next
	if n < 0 || n >= len(m.Players) {
		return -1
	}
	return n
}

// over: the match ends (winner a Sim, or a draw). Locked.
func (p *Pvp) over(m *PvpMatch, winner string, draw bool, text string, now time.Time) {
	m.State, m.Winner, m.Draw, m.ended, m.Deadline = "done", winner, draw, now, 0
	if draw {
		m.Winner = ""
	}
	if text == "" {
		switch {
		case draw:
			text = "Match nul !"
		default:
			text = fmt.Sprintf("%s gagne la partie !", m.Names[max(0, m.seat(winner))])
		}
	}
	m.Result = text
}

// Recorded: the result written (pvp_results, the money): not again.
func (p *Pvp) Recorded(id string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	m := p.m[id]
	if m == nil || m.recorded || m.State != "done" {
		return false
	}
	m.recorded = true
	return true
}

// Report: how the game ended, as this player saw it (winner: a Sim of the
// match, "" a draw; quit: this player left, the other wins). Both the same,
// or a player who left: over.
func (p *Pvp) Report(id, sim, winner string, quit bool) (*PvpMatch, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.init()
	now := p.clock()
	m := p.m[id]
	if m == nil || m.seat(sim) < 0 {
		return nil, errPvpGone
	}
	if m.State != "on" {
		return m.copy(), nil
	}
	if quit {
		other := m.Players[1-m.seat(sim)]
		p.over(m, other, false, fmt.Sprintf("%s a quitté la partie : %s gagne.", m.Names[m.seat(sim)], m.Names[1-m.seat(sim)]), now)
		return m.copy(), nil
	}
	if winner != "" && m.seat(winner) < 0 {
		return nil, errPvpMove
	}
	// The move-by-move games are settled by their moves (and their clock); dames and 8 américain by their own game.
	if m.Game == "gode" || m.Game == "dames" || m.Game == "huit" {
		return m.copy(), nil
	}
	if _, said := m.reports[sim]; !said {
		m.reports[sim] = winner
		if len(m.reports) == 1 {
			m.reportAt = now
		}
	}
	if len(m.reports) == len(m.Players) {
		first := m.reports[m.Players[0]]
		agree := true
		for _, w := range m.reports {
			agree = agree && w == first
		}
		if agree {
			p.over(m, first, first == "", "", now)
		} else {
			// They don't say the same: nobody takes it.
			p.over(m, "", true, "Les deux téléphones ne disent pas la même chose : partie nulle.", now)
		}
	}
	return m.copy(), nil
}

// Move: a move of awalé or Ludo (seq: how many moves the phone has seen, so
// none passes another; next: whose turn after, by the phone's rules; roll: a
// die to throw for it), or of godé (m: {"a":"roll"} or {"a":"call","c":"grand"}).
func (p *Pvp) Move(id, sim string, seq int, mv json.RawMessage, next int, roll bool, rng *rand.Rand) (*PvpMatch, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.init()
	now := p.clock()
	m := p.m[id]
	if m == nil || m.seat(sim) < 0 {
		return nil, errPvpGone
	}
	p.expire(m, now)
	if m.State != "on" || !moveLog(m.Game) {
		return m.copy(), errPvpNotOn
	}
	me := m.seat(sim)
	if p.toPlay(m) != me {
		return m.copy(), errPvpTurn
	}
	if m.Gode != nil {
		var req struct {
			A string `json:"a"`
			C string `json:"c"`
		}
		if json.Unmarshal(mv, &req) != nil {
			return m.copy(), errPvpMove
		}
		if err := godeStep(m, me, req.A, req.C, rng); err != nil {
			return m.copy(), err
		}
	} else {
		if seq != len(m.Moves) {
			return m.copy(), errPvpSeq
		}
		if len(mv) == 0 || len(mv) > 200 || !json.Valid(mv) || next < 0 || next >= len(m.Players) || len(m.Moves) >= pvpMoves {
			return m.copy(), errPvpMove
		}
		x := PvpMove{By: sim, M: mv, Next: next, At: now.UnixMilli()}
		if roll {
			x.Die = 1 + rng.IntN(6)
		}
		m.Moves = append(m.Moves, x)
	}
	m.moved = now
	if m.State == "on" {
		m.Deadline = now.Add(pvpMove).UnixMilli()
	}
	if m.Gode != nil && m.Gode.Phase == "over" {
		w := 0
		if m.Gode.Points[1] > m.Gode.Points[0] {
			w = 1
		}
		p.over(m, m.Players[w], false, fmt.Sprintf("%s gagne le godé, %d manches à %d !", m.Names[w], m.Gode.Points[w], m.Gode.Points[1-w]), now)
	}
	return m.copy(), nil
}

// godeStep: the first throws (his die seen by him only… and the other, once
// thrown), calls « grand » or « petit », the other throws; the same die, both
// throw again. The first to GodeTo rounds wins; the first throw changes hands
// each round.
func godeStep(m *PvpMatch, me int, action, call string, rng *rand.Rand) error {
	g := m.Gode
	switch {
	case g.Phase == "roll1" && action == "roll":
		g.Dice = [2]int{}
		g.Dice[me] = game.GodeRoll(rng)
		g.Phase = "call"
	case g.Phase == "call" && action == "call" && (call == game.GodeGrand || call == game.GodePetit):
		g.Call = call
		g.Phase = "roll2"
	case g.Phase == "roll2" && action == "roll":
		first := g.First
		g.Dice[1-first] = game.GodeRoll(rng)
		g.Rethrows = 0
		// The same: both throw again, the call stays (it can't go on for ever: the dice change).
		for g.Dice[0] == g.Dice[1] && g.Rethrows < 50 {
			g.Dice = [2]int{game.GodeRoll(rng), game.GodeRoll(rng)}
			g.Rethrows++
		}
		won := game.GodeBeats(g.Call, g.Dice[first], g.Dice[1-first])
		taken := first
		if won < 0 {
			taken = 1 - first
		}
		g.Points[taken]++
		g.LastDice, g.LastCall, g.LastTaken = g.Dice, g.Call, taken
		g.Round++
		g.First = g.Round % 2
		g.Call = ""
		g.Dice = [2]int{}
		g.Phase = "roll1"
		if g.Points[taken] >= GodeTo {
			g.Phase = "over"
		}
	default:
		return errPvpMove
	}
	return nil
}
