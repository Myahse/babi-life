package features

import (
	"context"
	"testing"
	"time"
)

func TestLive(t *testing.T) {
	now := time.Now()
	past, future := now.Add(-time.Minute), now.Add(time.Hour)
	for _, c := range []struct {
		s    State
		want bool
	}{
		{State{}, false},
		{State{Open: true}, true},
		{State{OpensAt: &past}, true},
		{State{OpensAt: &future}, false},
	} {
		if got := c.s.Live(now); got != c.want {
			t.Errorf("%+v: live %v, want %v", c.s, got, c.want)
		}
	}
}

func TestNoStoreOpensEverything(t *testing.T) {
	var s *Store
	if !s.Open(context.Background(), "kart") || s.Blocks(context.Background(), "course-kart") != "" {
		t.Fatal("without a store (tests, no database) nothing is held back")
	}
}

func TestListWellFormed(t *testing.T) {
	seen := map[string]bool{}
	for _, f := range List {
		if f.ID == "" || f.Label == "" || seen[f.ID] {
			t.Fatalf("bad or twice: %+v", f)
		}
		seen[f.ID] = true
	}
}
