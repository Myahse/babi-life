package game

import (
	"math/rand/v2"
	"testing"
	"time"
)

func TestEasterAndHolidays(t *testing.T) {
	for year, want := range map[int]string{2024: "2024-03-31", 2025: "2025-04-20", 2026: "2026-04-05", 2027: "2027-03-28"} {
		if got := Easter(year).Format("2006-01-02"); got != want {
			t.Errorf("Easter %d: got %s want %s", year, got, want)
		}
	}
	at := func(s string) int64 { d, _ := time.Parse("2006-01-02", s); return MinuteOf(d) + 10*60 }
	for date, id := range map[string]string{"2026-08-07": "fete-nationale", "2026-11-15": "paix", "2026-04-06": "lundi-paques", "2026-05-14": "ascension", "2026-05-25": "lundi-pentecote", "2026-03-16": "lendemain-nuit-destin"} {
		if h, ok := HolidayOn(at(date)); !ok || h.ID != id {
			t.Errorf("%s: got %q, want %s", date, h.ID, id)
		}
	}
	if _, ok := HolidayOn(at("2026-08-08")); ok {
		t.Error("8 August is not a holiday")
	}
}

func TestWeekdayAndOpeningDays(t *testing.T) {
	monday := MinuteOf(time.Date(2026, 10, 12, 10, 0, 0, 0, time.UTC))
	if WeekdayOf(monday) != Lundi || WeekdayOf(monday+5*24*60) != Samedi {
		t.Fatal("weekday arithmetic is off")
	}
	etat := Kinds["mairie"].Interactions[0]
	if !etat.OpenAt(monday) {
		t.Error("the mairie should be open on Monday at 10h")
	}
	if etat.OpenAt(monday + 6*24*60) {
		t.Error("the mairie should be closed on Sunday")
	}
	if etat.OpenAt(monday + 8*60) {
		t.Error("the mairie should be closed at 18h")
	}
}

func TestRequirements(t *testing.T) {
	r := &Requirement{Resident: true, MinMoney: 1000}
	if err := r.Check(Who{Resident: false, Money: 5000}); err != ErrResidentsOnly {
		t.Errorf("non-resident: got %v", err)
	}
	if err := r.Check(Who{Resident: true, Money: 500}); err != ErrNotEnoughMoney {
		t.Errorf("broke: got %v", err)
	}
	if err := r.Check(Who{Resident: true, Money: 5000}); err != nil {
		t.Errorf("eligible: got %v", err)
	}
	if err := (*Requirement)(nil).Check(Who{}); err != nil {
		t.Error("no requirement means anyone")
	}
	if err := (&Requirement{AnyTrait: []string{"sportif"}}).Check(Who{Traits: []string{"gourmand"}}); err != ErrNotYourThing {
		t.Errorf("trait: got %v", err)
	}
}

// A jam on the bridges only hits trips across the lagoon; roadblocks only intercity trips.
func TestTripIncidentsFollowTheRoute(t *testing.T) {
	rng := rand.New(rand.NewPCG(1, 2))
	at8 := int64(8 * 60)
	across := Route{FromCity: "abidjan", FromCommune: "cocody", ToCity: "abidjan", ToCommune: "marcory", FromBank: "nord", ToBank: "sud"}
	sameBank := Route{FromCity: "abidjan", FromCommune: "cocody", ToCity: "abidjan", ToCommune: "yopougon", FromBank: "nord", ToBank: "nord"}
	intercity := Route{FromCity: "abidjan", FromCommune: "cocody", ToCity: "bouake", ToCommune: "bouake-centre"}
	seen := map[string]map[string]bool{"across": {}, "same": {}, "inter": {}}
	for i := 0; i < 3000; i++ {
		for name, r := range map[string]Route{"across": across, "same": sameBank, "inter": intercity} {
			if inc := IncidentFor(r, at8, rng); inc != nil {
				seen[name][inc.ID] = true
			}
		}
	}
	if !seen["across"]["bouchon-pont"] {
		t.Error("crossing the lagoon at 8h never met a bridge jam")
	}
	if seen["same"]["bouchon-pont"] || seen["inter"]["bouchon-pont"] {
		t.Error("bridge jam on a trip that doesn't cross the lagoon")
	}
	if seen["across"]["controle-route"] || !seen["inter"]["controle-route"] {
		t.Error("roadblocks must only hit intercity trips")
	}
	if seen["inter"]["route-aeroport"] || seen["same"]["route-aeroport"] {
		t.Error("airport road works on a trip that doesn't go to Port-Bouët")
	}
}
