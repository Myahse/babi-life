package sims

import (
	"encoding/json"
	"math/rand/v2"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// A clock the tests move by hand.
type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time      { return c.t }
func (c *fakeClock) add(d time.Duration) { c.t = c.t.Add(d) }
func newPvp() (*Pvp, *fakeClock) {
	c := &fakeClock{t: time.Unix(1_800_000_000, 0)}
	return &Pvp{now: c.now}, c
}
func mustGame(t *testing.T, id string) PvpGame {
	g, ok := pvpGame(id)
	if !ok {
		t.Fatalf("no game %s", id)
	}
	return g
}

func TestPvpChallengeAnswer(t *testing.T) {
	p, c := newPvp()
	foot := mustGame(t, "foot")
	m, err := p.Challenge(foot, "a", "b", [2]string{"Awa", "Bakary"}, false, 0)
	if err != nil || m.State != "pending" {
		t.Fatalf("challenge: %v %+v", err, m)
	}
	if p.Has(m.ID, "a") {
		t.Fatal("not in the live room before the answer")
	}
	// Busy both ways, and too fast.
	if _, err := p.Challenge(foot, "b", "c", [2]string{"Bakary", "Cissé"}, false, 0); err != errPvpBusy {
		t.Fatalf("the one asked is busy: %v", err)
	}
	if _, err := p.Answer(m.ID, "a", true); err != errPvpGone {
		t.Fatal("only the one asked answers")
	}
	on, err := p.Answer(m.ID, "b", true)
	if err != nil || on.State != "on" || on.Start != c.t.Add(pvpCount).UnixMilli() {
		t.Fatalf("answer: %v %+v", err, on)
	}
	if !p.Has(m.ID, "a") || !p.Has(m.ID, "b") || p.Has(m.ID, "c") {
		t.Fatal("both in the room, nobody else")
	}
	// The phones say who won: the same, it's over.
	if r, _ := p.Report(m.ID, "a", "b", false); r.State != "on" {
		t.Fatal("one word isn't the end")
	}
	r, _ := p.Report(m.ID, "b", "b", false)
	if r.State != "done" || r.Winner != "b" {
		t.Fatalf("agreed: %+v", r)
	}
	if !p.Recorded(m.ID) || p.Recorded(m.ID) {
		t.Fatal("recorded once")
	}
}

func TestPvpRateLimit(t *testing.T) {
	p, c := newPvp()
	foot := mustGame(t, "foot")
	m, _ := p.Challenge(foot, "a", "b", [2]string{"A", "B"}, false, 0)
	_, _ = p.Answer(m.ID, "b", false)
	if _, err := p.Challenge(foot, "a", "c", [2]string{"A", "C"}, false, 0); err != errPvpFast {
		t.Fatalf("a second challenge at once: %v", err)
	}
	for i := 0; i < pvpBurst+2; i++ {
		c.add(pvpGap + time.Second)
		m, err := p.Challenge(foot, "a", "c", [2]string{"A", "C"}, false, 0)
		if i >= pvpBurst-1 {
			if err != errPvpFast {
				t.Fatalf("challenge %d past the burst: %v", i, err)
			}
			continue
		}
		if err != nil {
			t.Fatalf("challenge %d: %v", i, err)
		}
		_, _ = p.Answer(m.ID, "c", false)
	}
}

func TestPvpQueue(t *testing.T) {
	p, c := newPvp()
	awale := mustGame(t, "awale")
	if m, err := p.Enqueue(awale, "a", "Awa", false); m != nil || err != nil {
		t.Fatalf("alone, it waits: %v %v", m, err)
	}
	if g, _ := p.Waiting("a"); g != "awale" {
		t.Fatal("waiting at the awalé")
	}
	// A baby doesn't meet a grown-up; the same one twice isn't a match.
	if m, _ := p.Enqueue(awale, "baby", "Bébé", true); m != nil {
		t.Fatal("a baby isn't paired with a grown-up")
	}
	if _, err := p.Enqueue(awale, "a", "Awa", false); err != errPvpBusy {
		t.Fatal("already waiting")
	}
	m, err := p.Enqueue(awale, "b", "Bakary", false)
	if err != nil || m == nil || m.State != "on" || m.Players[0] != "a" || !m.Queue {
		t.Fatalf("paired: %v %+v", err, m)
	}
	if g, _ := p.Waiting("a"); g != "" {
		t.Fatal("out of the queue once paired")
	}
	// Left waiting too long: gone.
	c.add(pvpQueue + time.Second)
	p.Of("baby")
	if g, _ := p.Waiting("baby"); g != "" {
		t.Fatal("the queue forgets")
	}
}

func TestPvpMovesAndClock(t *testing.T) {
	p, c := newPvp()
	m, _ := p.Enqueue(mustGame(t, "ludo"), "a", "Awa", false)
	m, _ = p.Enqueue(mustGame(t, "ludo"), "b", "Bakary", false)
	rng := rand.New(rand.NewPCG(1, 2))
	mv := json.RawMessage(`{"k":0}`)
	if _, err := p.Move(m.ID, "b", 0, mv, 0, true, rng); err != errPvpTurn {
		t.Fatalf("the first player starts: %v", err)
	}
	got, err := p.Move(m.ID, "a", 0, mv, 1, true, rng)
	if err != nil || len(got.Moves) != 1 || got.Moves[0].Die < 1 || got.Moves[0].Die > 6 {
		t.Fatalf("move: %v %+v", err, got)
	}
	if _, err := p.Move(m.ID, "b", 0, mv, 0, false, rng); err != errPvpSeq {
		t.Fatalf("a move from an old board: %v", err)
	}
	if _, err := p.Move(m.ID, "b", 1, json.RawMessage(`nope`), 0, false, rng); err != errPvpMove {
		t.Fatal("not a move")
	}
	// B doesn't play within a minute: A wins.
	c.add(pvpMove + time.Second)
	got, settle := p.Get(m.ID, "a")
	if got.State != "done" || got.Winner != "a" || !settle {
		t.Fatalf("out of time: %+v", got)
	}
}

func TestPvpGodeServerDice(t *testing.T) {
	p, _ := newPvp()
	m, _ := p.Challenge(mustGame(t, "gode"), "a", "b", [2]string{"Awa", "Bakary"}, false, 500)
	m, _ = p.Answer(m.ID, "b", true)
	rng := rand.New(rand.NewPCG(3, 4))
	roll := json.RawMessage(`{"a":"roll"}`)
	for rounds := 0; rounds < 2*GodeTo; rounds++ {
		cur, _ := p.Get(m.ID, "a")
		if cur.State == "done" {
			break
		}
		first := cur.Players[cur.Gode.First]
		other := cur.Players[1-cur.Gode.First]
		if _, err := p.Move(m.ID, other, 0, roll, 0, false, rng); err != errPvpTurn {
			t.Fatalf("the first throws first: %v", err)
		}
		cur, err := p.Move(m.ID, first, 0, roll, 0, false, rng)
		if err != nil || cur.Gode.Phase != "call" {
			t.Fatalf("roll: %v %+v", err, cur.Gode)
		}
		die := cur.Gode.Dice[cur.Gode.First]
		if _, err := p.Move(m.ID, first, 0, json.RawMessage(`{"a":"call","c":"`+game.GodeCallFor(die)+`"}`), 0, false, rng); err != nil {
			t.Fatal(err)
		}
		cur, err = p.Move(m.ID, other, 0, roll, 0, false, rng)
		if err != nil || cur.Gode.LastTaken < 0 || cur.Gode.LastDice[0] == cur.Gode.LastDice[1] {
			t.Fatalf("second roll: %v %+v", err, cur.Gode)
		}
	}
	cur, settle := p.Get(m.ID, "a")
	if cur.State != "done" || !settle || cur.Gode.Points[cur.seat(cur.Winner)] != GodeTo {
		t.Fatalf("over at %d rounds: %+v %+v", GodeTo, cur, cur.Gode)
	}
}

func TestPvpQuitAndDisagree(t *testing.T) {
	p, c := newPvp()
	m, _ := p.Enqueue(mustGame(t, "course"), "a", "Awa", false)
	m, _ = p.Enqueue(mustGame(t, "course"), "b", "Bakary", false)
	r, _ := p.Report(m.ID, "a", "", true)
	if r.State != "done" || r.Winner != "b" {
		t.Fatalf("the one who leaves loses: %+v", r)
	}
	c.add(pvpGap)
	m, _ = p.Enqueue(mustGame(t, "course"), "a", "Awa", false)
	m, _ = p.Enqueue(mustGame(t, "course"), "b", "Bakary", false)
	_, _ = p.Report(m.ID, "a", "a", false)
	r, _ = p.Report(m.ID, "b", "b", false)
	if r.State != "done" || !r.Draw {
		t.Fatalf("they don't agree: nobody wins: %+v", r)
	}
	// One word, then nothing: it stands.
	m, _ = p.Enqueue(mustGame(t, "course"), "a", "Awa", false)
	m, _ = p.Enqueue(mustGame(t, "course"), "b", "Bakary", false)
	_, _ = p.Report(m.ID, "b", "b", false)
	c.add(pvpReport + time.Second)
	r, _ = p.Get(m.ID, "a")
	if r.State != "done" || r.Winner != "b" {
		t.Fatalf("the first word stands: %+v", r)
	}
}

func TestPvpAges(t *testing.T) {
	grown := pvpWho{Stage: game.StageAdulte, Adult: true}
	teen := pvpWho{Stage: game.StageAdo}
	baby := pvpWho{Stage: game.StageBebe}
	if pvpAges(mustGame(t, "dames"), grown, teen) != nil {
		t.Fatal("a teenager plays dames with a grown-up, for nothing")
	}
	if pvpAges(mustGame(t, "gode"), grown, teen) != errPvpGodeAge {
		t.Fatal("le godé from 18")
	}
	if pvpAges(mustGame(t, "combat"), baby, baby) != nil || pvpAges(mustGame(t, "combat"), baby, grown) != errPvpBaby || pvpAges(mustGame(t, "foot"), baby, baby) != errPvpBaby {
		t.Fatal("babies: the bagarre, between them")
	}
}
