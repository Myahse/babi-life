// Package activity: whether someone is playing right now, and the server's
// background jobs run by it, so the database (Neon, billed by the hour it is
// awake) can sleep while nobody plays.
//
// A player's request (or an open live WebSocket) makes the server « active »
// for Window. While active, each job runs every Every, as before. While idle,
// a job runs only at the next time it said something is due for players who
// are away (a notification, an election's results, the day's pay), or not at
// all; and as soon as someone plays again, each job whose Every has passed
// runs at once, so whatever is late is caught up then.
package activity

import (
	"context"
	"net/http"
	"sync"
	"time"
)

// Window: how long after the last player request the server stays active. The
// game posts /me/playing every minute while it's on screen, so 5 minutes only
// ends a few minutes after the last player has gone.
const Window = 5 * time.Minute

// MaxLateWait: the longest wait for a job that keeps giving a time already past.
const MaxLateWait = 6 * time.Hour

// Gate is the « someone is playing » signal.
type Gate struct {
	// Window: how long a request keeps the gate active (0: Window).
	Window time.Duration
	// Busy: whether someone counts as playing whatever the window says; nil: nobody.
	Busy func() bool
	// MinIdleWait: the shortest wait for a job's own time (0: a minute).
	MinIdleWait time.Duration

	mu   sync.Mutex
	last time.Time
	wake chan struct{}
}

// Default is the gate the server uses (cmd/api). Touch and Active are nil-safe (a nil gate is always active).
var Default = &Gate{}

func (g *Gate) minWait() time.Duration {
	if g.MinIdleWait > 0 {
		return g.MinIdleWait
	}
	return time.Minute
}

func (g *Gate) window() time.Duration {
	if g.Window > 0 {
		return g.Window
	}
	return Window
}

// Touch: a player did something now. From idle, it wakes the jobs waiting.
func (g *Gate) Touch() {
	if g == nil {
		return
	}
	now := time.Now()
	g.mu.Lock()
	idle := now.Sub(g.last) >= g.window()
	g.last = now
	var w chan struct{}
	if idle && g.wake != nil {
		w, g.wake = g.wake, nil
	}
	g.mu.Unlock()
	if w != nil {
		close(w)
	}
}

// Active: whether someone played within the window, or is connected.
func (g *Gate) Active() bool {
	if g == nil {
		return true
	}
	g.mu.Lock()
	recent := time.Now().Sub(g.last) < g.window()
	g.mu.Unlock()
	return recent || (g.Busy != nil && g.Busy())
}

// woken: a channel closed at the next Touch from idle.
func (g *Gate) woken() <-chan struct{} {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.wake == nil {
		g.wake = make(chan struct{})
	}
	return g.wake
}

// Middleware: every request through it counts as a player's.
func (g *Gate) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		g.Touch()
		next.ServeHTTP(w, r)
	})
}

// Job is a background job run by the gate.
type Job struct {
	// Every: how often it runs while someone plays.
	Every time.Duration
	// First: when it first runs after the start (0: right away), whether
	// anyone plays or not (the server just started: the database is awake for
	// its migrations), so that it learns its next due time.
	First time.Duration
	// Lazy: the first run too waits for someone playing (a job only for players: nothing to learn).
	Lazy bool
	// Run does the work; it returns when the job must run again even if
	// nobody plays (zero: not before someone plays). It may look at the
	// database: it's called only while active, or at the time it gave.
	Run func(ctx context.Context) time.Time
}

// Loop runs the job until ctx ends.
func (g *Gate) Loop(ctx context.Context, j Job) {
	last := time.Now().Add(j.First - j.Every)
	var due time.Time // the job's own next time, for while nobody plays
	late := 0         // the times in a row, nobody playing, it gave a time already past
	if !j.Lazy {
		due = time.Now().Add(j.First)
	}
	for {
		wake := g.woken()
		now := time.Now()
		active := g.Active()
		every := last.Add(j.Every)
		if (active && !now.Before(every)) || (!due.IsZero() && !now.Before(due)) {
			due = j.Run(ctx)
			last = time.Now()
			// A time already past (something due that failed, or that this job can't clear):
			// not again straight away, and less and less often, so that one stuck row never
			// keeps the database awake (players coming back run the job anyway).
			if !due.IsZero() && due.Before(last.Add(g.minWait())) {
				// (Counted only while nobody plays: a job waiting on something players clear stays prompt.)
				if !active {
					late++
				}
				wait := g.minWait() << min(late, 10)
				due = last.Add(min(wait, MaxLateWait))
			} else {
				late = 0
			}
			continue
		}
		// Active: until Every (the window may have closed by then: the job's own time
		// is waited for next). Idle: until the job's own time, or someone plays.
		wait := time.Duration(-1)
		if active {
			wait = every.Sub(now)
		}
		if !due.IsZero() && (wait < 0 || due.Sub(now) < wait) {
			wait = due.Sub(now)
		}
		if wait < 0 {
			select {
			case <-ctx.Done():
				return
			case <-wake:
			}
			continue
		}
		t := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			t.Stop()
			return
		case <-t.C:
		case <-wake:
			t.Stop()
		}
	}
}
