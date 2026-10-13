package game

import (
	"math"
	"testing"
	"time"
)

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

func TestBeginChargesUpFrontAndRespectsHours(t *testing.T) {
	kind := Kinds["maquis"]
	garba, _ := kind.Interaction("eat-garba")
	st, err := Begin(State{Needs: FreshNeeds(), Money: 1000, GameMinutes: 12 * 60}, garba)
	if err != nil || st.Money != 500 {
		t.Fatalf("money %d, err %v", st.Money, err)
	}
	poulet, _ := kind.Interaction("eat-poulet-braise")
	if _, err := Begin(State{Money: 100, GameMinutes: 12 * 60}, poulet); err != ErrNotEnoughMoney {
		t.Errorf("broke: got %v", err)
	}
	dance, _ := kind.Interaction("dance-coupe-decale")
	if _, err := Begin(State{Money: 0, GameMinutes: 10 * 60}, dance); err != ErrClosed {
		t.Errorf("closed at 10h: got %v", err)
	}
}

func TestActivityAppliesEffectAsItGoes(t *testing.T) {
	sleep, _ := Kinds["home"].Interaction("sleep")
	a := Activity{Kind: "do", Interaction: sleep, Start: 0, End: sleep.Minutes}
	n := a.Progress(Needs{Energy: 0}, 0, sleep.Minutes/2)
	if math.Abs(n.Energy-50) > 0.5 || math.Abs(a.Applied-0.5) > 1e-9 {
		t.Fatalf("half way: energy %.1f applied %.2f", n.Energy, a.Applied)
	}
	n = a.Progress(n, sleep.Minutes/2, sleep.Minutes+600)
	if n.Energy != 100 || a.Applied != 1 {
		t.Fatalf("done: energy %.1f applied %.2f", n.Energy, a.Applied)
	}
	if n2 := a.Progress(n, 0, sleep.Minutes); n2 != n {
		t.Error("an effect must never be applied twice")
	}
}

func TestEarnedIsProRata(t *testing.T) {
	sell, _ := Kinds["market"].Interaction("sell-goods")
	a := Activity{Kind: "do", Interaction: sell, Start: 0, End: sell.Minutes}
	a.Progress(Needs{}, 0, sell.Minutes/4)
	if got := a.Earned(); got != 1000 {
		t.Errorf("a quarter of 4 000F: got %d", got)
	}
}

func TestIdleDecayStopsAtTheFloor(t *testing.T) {
	n := DecayIdle(FreshNeeds(), 7*24*60)
	if n.Hunger != IdleFloor || n.Energy != IdleFloor {
		t.Errorf("a week away: %+v", n)
	}
	low := DecayIdle(Needs{Hunger: 3}, 60)
	if low.Hunger != 3 {
		t.Errorf("already below the floor stays put, got %.1f", low.Hunger)
	}
}

func TestClockIsRealAbidjanTime(t *testing.T) {
	at := time.Date(2026, 10, 17, 14, 30, 0, 0, time.UTC) // a Saturday
	m := MinuteOf(at)
	if HourOf(m) != 14 || !TimeOf(m).Equal(at) {
		t.Fatalf("hour %d time %v", HourOf(m), TimeOf(m))
	}
	if Saturdays(m-24*60, m) != 1 {
		t.Error("the real Saturday must be rent day")
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
