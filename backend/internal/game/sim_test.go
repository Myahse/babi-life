package game

import (
	"math/rand/v2"
	"testing"
	"time"
)

func noLuck() *rand.Rand { return rand.New(rand.NewPCG(1, 2)) }

func TestAvailableWrapsPastMidnight(t *testing.T) {
	party := Interaction{MinHour: 21, MaxHour: 4}
	for hour, want := range map[int]bool{20: false, 21: true, 23: true, 0: true, 3: true, 4: false, 12: false} {
		if got := party.Available(hour); got != want {
			t.Errorf("hour %d: got %v want %v", hour, got, want)
		}
	}
	if !(Interaction{}).Available(13) {
		t.Error("an interaction without hours should always be available")
	}
}

func TestPerformChargesAndAdvancesTime(t *testing.T) {
	kind := Kinds["maquis"]
	it, _ := kind.Interaction("eat-garba")
	st := State{Needs: Needs{Hunger: 20, Energy: 50, Hygiene: 50, Social: 50, Fun: 50}, Money: 1000, GameMinutes: 12 * 60}

	next, out, err := Perform(st, kind, it, noLuck())
	if err != nil {
		t.Fatal(err)
	}
	if next.GameMinutes != st.GameMinutes+it.Minutes {
		t.Errorf("time: got %d", next.GameMinutes)
	}
	if out.Random == nil && next.Money != 500 {
		t.Errorf("money: got %d want 500", next.Money)
	}
	if next.Needs.Hunger <= st.Needs.Hunger {
		t.Errorf("eating should raise hunger, got %.1f", next.Needs.Hunger)
	}
}

func TestPerformRefusesWhenBroke(t *testing.T) {
	kind := Kinds["maquis"]
	it, _ := kind.Interaction("eat-poulet-braise")
	_, _, err := Perform(State{Needs: FreshNeeds(), Money: 100, GameMinutes: 12 * 60}, kind, it, noLuck())
	if err != ErrNotEnoughMoney {
		t.Fatalf("got %v", err)
	}
}

func TestElapsedIsCapped(t *testing.T) {
	now := time.Now()
	if got := Elapsed(now.Add(-30*time.Second), now); got != 30 {
		t.Errorf("30s should be 30 game minutes, got %d", got)
	}
	if got := Elapsed(now.Add(-48*time.Hour), now); got != int64(MaxCatchUp) {
		t.Errorf("long absence should be capped, got %d", got)
	}
}

func TestEveryKindIsPlayable(t *testing.T) {
	for id, k := range Kinds {
		if k.ID != id {
			t.Errorf("kind %q has ID %q", id, k.ID)
		}
		if len(k.Interactions) == 0 {
			t.Errorf("kind %q has no interactions", id)
		}
	}
}
