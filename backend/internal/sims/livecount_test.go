package sims

import (
	"context"
	"errors"
	"testing"
	"time"
)

// The home page's live count is asked on every visit: the database is asked at most once per
// LiveCountTTL, the online players are never fewer than those online, and a failure keeps the last count.
func TestLiveCountCached(t *testing.T) {
	now := time.Date(2026, 11, 11, 20, 0, 0, 0, time.UTC)
	asked := 0
	today, online := 12, 3
	var fail error
	l := &LiveCount{
		Online: func() int { return online },
		Today: func(context.Context) (int, error) {
			asked++
			return today, fail
		},
		Now: func() time.Time { return now },
	}
	ctx := context.Background()
	c, err := l.Count(ctx)
	if err != nil || c != (LiveCounts{Online: 3, Today: 12}) || asked != 1 {
		t.Fatalf("first count %+v %v (asked %d)", c, err, asked)
	}
	today, online = 40, 9
	now = now.Add(LiveCountTTL - time.Second)
	if c, _ = l.Count(ctx); c.Today != 12 || asked != 1 {
		t.Fatalf("within the TTL: %+v, asked %d", c, asked)
	}
	now = now.Add(2 * time.Second)
	if c, _ = l.Count(ctx); c != (LiveCounts{Online: 9, Today: 40}) || asked != 2 {
		t.Fatalf("after the TTL: %+v, asked %d", c, asked)
	}
	// More online than counted today (a Sim not ticked yet): today is at least the online ones.
	today, online = 2, 5
	now = now.Add(LiveCountTTL)
	if c, _ = l.Count(ctx); c.Today != 5 {
		t.Fatalf("today below online: %+v", c)
	}
	// The database away: the last count stays.
	fail = errors.New("down")
	now = now.Add(LiveCountTTL)
	if c, err = l.Count(ctx); err != nil || c.Today != 5 {
		t.Fatalf("on failure: %+v %v", c, err)
	}
	// Never counted and the database away: an error.
	empty := &LiveCount{Today: func(context.Context) (int, error) { return 0, fail }}
	if _, err := empty.Count(ctx); err == nil {
		t.Fatal("no count and no database: want an error")
	}
}
