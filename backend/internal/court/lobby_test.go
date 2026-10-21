package court

import (
	"errors"
	"testing"
	"time"
)

func TestMatchFillsUpToTheSport(t *testing.T) {
	l := NewLobby()
	now := time.Now()
	var first Match
	for i := 0; i < Cap["basket"]; i++ {
		m, err := l.Join("court", "basket", Entry{Sim: string(rune('a' + i))}, now)
		if err != nil {
			t.Fatalf("player %d refused: %v", i, err)
		}
		if i == 0 {
			first = m
		} else if m.ID != first.ID {
			t.Fatal("players at the same court should share a match")
		}
	}
	m, _ := l.Get(first.ID)
	seen := map[int]bool{}
	teams := [2]int{}
	for _, e := range m.Entries {
		if seen[e.Slot] {
			t.Fatalf("slot %d given twice", e.Slot)
		}
		seen[e.Slot] = true
		teams[e.Slot/3]++
	}
	if teams[0] != 3 || teams[1] != 3 {
		t.Fatalf("teams should be even, got %v", teams)
	}
	// One more: the court is full until the match ends.
	_, err := l.Join("court", "basket", Entry{Sim: "z"}, now)
	var full Full
	if !errors.As(err, &full) || full.Until != m.End {
		t.Fatalf("expected the court full until the end, got %v", err)
	}
	// The same player asking again keeps its place.
	again, err := l.Join("court", "basket", Entry{Sim: "a"}, now)
	if err != nil || again.ID != first.ID {
		t.Fatal("a player already in should get its match back")
	}
	// Someone leaves: a place opens.
	l.Leave(first.ID, "b")
	if _, err := l.Join("court", "basket", Entry{Sim: "z"}, now); err != nil {
		t.Fatalf("a freed place should be taken: %v", err)
	}
	// Once over, the court takes a new match.
	next, err := l.Join("court", "basket", Entry{Sim: "y"}, time.UnixMilli(m.End+1))
	if err != nil || next.ID == first.ID {
		t.Fatal("after the end a new match should open")
	}
}

func TestOneGameAtATimePerCourt(t *testing.T) {
	l := NewLobby()
	now := time.Now()
	if _, err := l.Join("p", "foot", Entry{Sim: "a"}, now); err != nil {
		t.Fatal(err)
	}
	var full Full
	if _, err := l.Join("p", "basket", Entry{Sim: "b"}, now); !errors.As(err, &full) {
		t.Fatal("a court busy with football shouldn't open a basketball match")
	}
	if _, err := l.Join("p", "tennis", Entry{Sim: "c"}, now); err != ErrSport {
		t.Fatal("unknown sport should be refused")
	}
}

func TestPlayingElsewhereFreesThePlace(t *testing.T) {
	l := NewLobby()
	now := time.Now()
	m, _ := l.Join("a", "foot", Entry{Sim: "x"}, now)
	if _, err := l.Join("b", "foot", Entry{Sim: "x"}, now); err != nil {
		t.Fatal(err)
	}
	if l.Has(m.ID, "x") {
		t.Fatal("a player gone to another court should leave the first")
	}
}

func TestLateComersWaitForTheNextMatch(t *testing.T) {
	l := NewLobby()
	now := time.Now()
	m, _ := l.Join("c", "basket", Entry{Sim: "a"}, now)
	late := time.UnixMilli(m.End - 20_000)
	n, err := l.Join("c", "basket", Entry{Sim: "b"}, late)
	if err != nil || n.ID == m.ID || n.Start < m.End {
		t.Fatalf("a late comer should get the next match after this one, got %+v %v", n, err)
	}
	again, _ := l.Join("c", "basket", Entry{Sim: "b"}, late)
	if again.ID != n.ID {
		t.Fatal("asking again should give the same next match")
	}
	// Once the first is over, the next one is the court's.
	at, ok := l.At("c", time.UnixMilli(m.End+1))
	if !ok || at.ID != n.ID {
		t.Fatal("the next match should take the court")
	}
}
