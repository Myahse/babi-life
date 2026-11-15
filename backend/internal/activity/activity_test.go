package activity

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestGateActive(t *testing.T) {
	g := &Gate{Window: 50 * time.Millisecond}
	if g.Active() {
		t.Fatal("a gate nobody touched is idle")
	}
	g.Touch()
	if !g.Active() {
		t.Fatal("touched: active")
	}
	time.Sleep(70 * time.Millisecond)
	if g.Active() {
		t.Fatal("past the window: idle")
	}
	busy := true
	g.Busy = func() bool { return busy }
	if !g.Active() {
		t.Fatal("a socket open: active")
	}
	busy = false
	if g.Active() {
		t.Fatal("the socket gone: idle")
	}
	var nilGate *Gate
	if !nilGate.Active() {
		t.Fatal("a nil gate is always active")
	}
	nilGate.Touch()
}

func TestMiddlewareTouches(t *testing.T) {
	g := &Gate{Window: time.Minute}
	h := g.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/me", nil))
	if !g.Active() {
		t.Fatal("a request through the middleware makes the gate active")
	}
}

// counter: a job's runs, and what it says is due next.
type counter struct {
	runs atomic.Int32
	due  atomic.Int64 // unix nanos, 0: nothing
}

func (c *counter) job(every time.Duration) Job {
	return Job{Every: every, Run: func(ctx context.Context) time.Time {
		c.runs.Add(1)
		if n := c.due.Swap(0); n != 0 {
			return time.Unix(0, n)
		}
		return time.Time{}
	}}
}

func TestLoopIdleRunsNothing(t *testing.T) {
	g := &Gate{Window: 30 * time.Millisecond}
	var c counter
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go g.Loop(ctx, c.job(10*time.Millisecond))
	time.Sleep(20 * time.Millisecond)
	// Run once at the start (First 0), then nothing while nobody plays.
	if n := c.runs.Load(); n != 1 {
		t.Fatalf("runs at start = %d, want 1", n)
	}
	time.Sleep(150 * time.Millisecond)
	if n := c.runs.Load(); n != 1 {
		t.Fatalf("idle: runs = %d, want still 1", n)
	}
}

func TestLoopActiveEveryThenStops(t *testing.T) {
	g := &Gate{Window: 100 * time.Millisecond}
	var c counter
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	g.Touch()
	go g.Loop(ctx, c.job(20*time.Millisecond))
	time.Sleep(90 * time.Millisecond)
	active := c.runs.Load()
	if active < 3 {
		t.Fatalf("active: runs = %d, want several", active)
	}
	// The window closes: the job stops.
	time.Sleep(60 * time.Millisecond)
	stopped := c.runs.Load()
	time.Sleep(150 * time.Millisecond)
	if n := c.runs.Load(); n != stopped {
		t.Fatalf("after the window: runs went %d -> %d", stopped, n)
	}
}

func TestLoopWakesOnTouchAndCatchesUp(t *testing.T) {
	g := &Gate{Window: 50 * time.Millisecond}
	var c counter
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go g.Loop(ctx, c.job(time.Hour))
	time.Sleep(20 * time.Millisecond)
	if n := c.runs.Load(); n != 1 {
		t.Fatalf("runs at start = %d, want 1", n)
	}
	// Someone plays before Every has passed: nothing yet (the job ran an instant ago).
	g.Touch()
	time.Sleep(20 * time.Millisecond)
	if n := c.runs.Load(); n != 1 {
		t.Fatalf("touched before Every: runs = %d, want 1", n)
	}

	// A job whose Every has passed while idle runs as soon as someone comes back.
	g2 := &Gate{Window: 20 * time.Millisecond}
	var c2 counter
	go g2.Loop(ctx, c2.job(30*time.Millisecond))
	time.Sleep(120 * time.Millisecond)
	if n := c2.runs.Load(); n != 1 {
		t.Fatalf("idle: runs = %d, want 1", n)
	}
	g2.Touch()
	time.Sleep(15 * time.Millisecond)
	if n := c2.runs.Load(); n != 2 {
		t.Fatalf("woken: runs = %d, want 2 (caught up at once)", n)
	}
}

func TestLoopRunsAtDueTimeWhileIdle(t *testing.T) {
	g := &Gate{Window: 10 * time.Millisecond, MinIdleWait: 5 * time.Millisecond}
	var c counter
	c.due.Store(time.Now().Add(80 * time.Millisecond).UnixNano())
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go g.Loop(ctx, c.job(time.Hour))
	time.Sleep(50 * time.Millisecond)
	if n := c.runs.Load(); n != 1 {
		t.Fatalf("before its time: runs = %d, want 1", n)
	}
	time.Sleep(60 * time.Millisecond)
	if n := c.runs.Load(); n != 2 {
		t.Fatalf("at its time, nobody playing: runs = %d, want 2", n)
	}
	// Nothing more due: it waits for players.
	time.Sleep(60 * time.Millisecond)
	if n := c.runs.Load(); n != 2 {
		t.Fatalf("after: runs = %d, want 2", n)
	}
}

func TestLoopPastDueIsNotASpin(t *testing.T) {
	g := &Gate{Window: time.Millisecond, MinIdleWait: 30 * time.Millisecond}
	var runs atomic.Int32
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go g.Loop(ctx, Job{Every: time.Hour, Run: func(ctx context.Context) time.Time {
		runs.Add(1)
		return time.Now().Add(-time.Hour) // always « due »: a failure
	}})
	time.Sleep(100 * time.Millisecond)
	if n := runs.Load(); n > 5 {
		t.Fatalf("a time in the past: runs = %d in 100 ms, want a few", n)
	}
}

func TestLoopFirst(t *testing.T) {
	g := &Gate{Window: time.Minute}
	g.Touch()
	var c counter
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	j := c.job(time.Hour)
	j.First = 40 * time.Millisecond
	go g.Loop(ctx, j)
	time.Sleep(20 * time.Millisecond)
	if n := c.runs.Load(); n != 0 {
		t.Fatalf("before First: runs = %d", n)
	}
	time.Sleep(40 * time.Millisecond)
	if n := c.runs.Load(); n != 1 {
		t.Fatalf("after First: runs = %d, want 1", n)
	}
}

func TestLoopLazyWaitsForPlayers(t *testing.T) {
	g := &Gate{Window: time.Minute}
	var c counter
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	j := c.job(10 * time.Millisecond)
	j.Lazy = true
	go g.Loop(ctx, j)
	time.Sleep(50 * time.Millisecond)
	if n := c.runs.Load(); n != 0 {
		t.Fatalf("lazy, nobody playing: runs = %d, want 0", n)
	}
	g.Touch()
	time.Sleep(15 * time.Millisecond)
	if n := c.runs.Load(); n < 1 {
		t.Fatalf("lazy, someone playing: runs = %d, want ≥ 1", n)
	}
}

func TestWindow(t *testing.T) {
	// The window is shorter than Neon's idle time plus the game's /me/playing minute: a player on screen never lets it close.
	if Window < 2*time.Minute || Window > 10*time.Minute {
		t.Fatalf("Window = %v", Window)
	}
}
