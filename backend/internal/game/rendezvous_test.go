package game

import (
	"testing"
	"time"
)

// The week's rendez-vous: each one at its days and hours (Abidjan's clock, UTC), one key per time,
// a featured commune never the same two days running, the Friday night found after midnight.
func TestRendezVousWeek(t *testing.T) {
	communes := []string{"cocody", "yopougon", "treichville", "marcory", "abobo"}
	monday := time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)
	occs := OccurrencesBetween(RendezVousList, monday, monday.AddDate(0, 0, 7), communes)
	count := map[string]int{}
	keys := map[string]bool{}
	for i, o := range occs {
		count[o.ID]++
		if keys[o.Key] {
			t.Fatalf("key twice: %s", o.Key)
		}
		keys[o.Key] = true
		if i > 0 && o.From.Before(occs[i-1].From) {
			t.Fatal("not in start order")
		}
		if o.Featured != (o.Commune != "") {
			t.Fatalf("%s: commune %q", o.Key, o.Commune)
		}
	}
	want := map[string]int{"happy-hour": 4, "soiree-vendredi": 1, "dames-samedi": 1, "foot-dimanche": 1, "vote-dimanche": 1, "resultats-lundi": 1}
	for id, n := range want {
		if count[id] != n {
			t.Errorf("%s: %d times, want %d", id, count[id], n)
		}
	}
	// The happy hour's commune changes from one day to the next.
	var last string
	for _, o := range occs {
		if o.ID == "happy-hour" {
			if o.Commune == last {
				t.Errorf("happy hour in %s two days running", o.Commune)
			}
			last = o.Commune
			if o.From.Hour() != 18 || o.Until.Sub(o.From) != time.Hour {
				t.Errorf("happy hour at %v", o.From)
			}
		}
	}
	// Saturday 00:30: the Friday night is still on.
	at := time.Date(2026, 11, 14, 0, 30, 0, 0, time.UTC)
	found := false
	for _, o := range OccurrencesBetween(RendezVousList, at, at.Add(time.Minute), communes) {
		if o.ID == "soiree-vendredi" && o.Live(at) && o.Key == "soiree-vendredi:20261113" {
			found = true
		}
	}
	if !found {
		t.Error("the Friday night not on after midnight")
	}
	// The same everywhere: a pure function of the clock.
	if a, b := FeaturedCommune("happy-hour", monday, communes), FeaturedCommune("happy-hour", monday, communes); a != b {
		t.Error("featured commune not stable")
	}
	// The pot is fixed and the source capped.
	if DamesPrizes[0]+DamesPrizes[1]+DamesPrizes[2] != 15000 || Caps[FromRendezVous].Djai < DamesPrizes[0] || !inTotal(FromRendezVous) {
		t.Error("the tournament's pot or its limit")
	}
	if MeasureOff([]string{HappyHour.ID}, "maquis") != HappyHourOff || MeasureOff([]string{HappyHour.ID}, "market") != 0 {
		t.Error("the happy hour's prices")
	}
	if _, ok := FindMeasure(HappyHour.ID); ok {
		t.Error("a president could decree the happy hour")
	}
}
