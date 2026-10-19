package kart

import (
	"testing"
	"time"
)

func TestLobby(t *testing.T) {
	l := NewLobby()
	now := time.Unix(1_800_000_000, 0)
	a := l.Join(Entry{Sim: "a", Name: "Awa"}, now)
	b := l.Join(Entry{Sim: "b", Name: "Yao"}, now.Add(5*time.Second))
	if a.ID != b.ID || len(b.Entries) != 2 || b.Entries[1].Slot != 1 {
		t.Fatalf("two players a few seconds apart share a grid: %+v %+v", a, b)
	}
	// Joining again: the same race, the same place.
	again := l.Join(Entry{Sim: "a"}, now.Add(6*time.Second))
	if again.ID != a.ID || len(again.Entries) != 2 {
		t.Fatalf("rejoining keeps the place: %+v", again)
	}
	// Too close to the lights: the next race.
	late := l.Join(Entry{Sim: "c"}, now.Add(Wait-2*time.Second))
	if late.ID == a.ID || late.Entries[0].Slot != 0 {
		t.Fatalf("a late player waits for the next race: %+v", late)
	}
	if !l.Has(a.ID, "b") || l.Has(a.ID, "c") {
		t.Fatal("Has knows who's on which grid")
	}
	// A full grid: the next one.
	full := NewLobby()
	var first string
	for i := 0; i < Max+1; i++ {
		r := full.Join(Entry{Sim: string(rune('a' + i))}, now)
		if i == 0 {
			first = r.ID
		}
		if i == Max && r.ID == first {
			t.Fatal("a seventh kart goes to the next race")
		}
	}
	// Old races are forgotten.
	l.Join(Entry{Sim: "z"}, now.Add(Keep+Wait+time.Minute))
	if _, ok := l.Get(a.ID); ok {
		t.Fatal("an old race is swept")
	}
}
