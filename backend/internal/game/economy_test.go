package game

import "testing"

func TestSaturdays(t *testing.T) {
	sat := int64(firstSaturdayMin) // day 6, 00:00
	cases := []struct {
		from, to int64
		want     int
	}{
		{7 * 60, sat - 1, 0},
		{7 * 60, sat, 1},
		{sat, sat + 60, 0}, // already settled at sat
		{sat - 10, sat + minutesPerWeek, 2},
		{sat + 1, sat + 3*minutesPerWeek, 3},
		{100, 50, 0},
	}
	for _, c := range cases {
		if got := Saturdays(c.from, c.to); got != c.want {
			t.Errorf("Saturdays(%d, %d) = %d, want %d", c.from, c.to, got, c.want)
		}
	}
}

func TestWeekEndPaysRentThenLoan(t *testing.T) {
	l, charges := WeekEnd(Ledger{Money: 30000, Loan: 60000, Housing: "entrer-coucher"})
	if l.Money != 30000-7000-LoanInstallment || l.Loan != 50000 || l.RentArrears != 0 {
		t.Fatalf("got %+v", l)
	}
	if len(charges) != 2 {
		t.Fatalf("want rent + loan lines, got %v", charges)
	}
}

func TestWeekEndEvictsAfterArrears(t *testing.T) {
	l := Ledger{Money: 0, Housing: "studio"}
	l, _ = WeekEnd(l)
	if l.Housing != "studio" || l.RentArrears != 15000 {
		t.Fatalf("first missed week: %+v", l)
	}
	l, _ = WeekEnd(l)
	if l.Housing != "entrer-coucher" || l.RentArrears != 0 {
		t.Fatalf("second missed week should evict: %+v", l)
	}
	// The cheapest tier can't get cheaper: arrears just grow.
	l, _ = WeekEnd(l)
	l, _ = WeekEnd(l)
	if l.Housing != "entrer-coucher" || l.RentArrears != 14000 {
		t.Fatalf("bottom tier: %+v", l)
	}
}

func TestComfortOnlyScalesGoodEffects(t *testing.T) {
	sleep, _ := Kinds["home"].Interaction("sleep")
	poor, _ := FindHousing("entrer-coucher")
	it := poor.AtHome(sleep)
	if it.Effect.Energy != 70 || it.Effect.Hunger != sleep.Effect.Hunger {
		t.Fatalf("got %+v", it.Effect)
	}
}

func TestCatalogueIsConsistent(t *testing.T) {
	for _, o := range Origins {
		if _, ok := FindHousing(o.Housing); !ok {
			t.Errorf("origin %s: unknown housing %s", o.ID, o.Housing)
		}
	}
	for _, c := range Careers {
		if _, ok := Kinds[c.Kind]; !ok {
			t.Errorf("career %s: unknown place kind %s", c.ID, c.Kind)
		}
		if len(c.Levels) == 0 {
			t.Errorf("career %s has no levels", c.ID)
		}
		if _, ok := Kinds[c.Kind].Interaction(WorkInteractionID); ok {
			t.Errorf("place kind %s already has a %q interaction", c.Kind, WorkInteractionID)
		}
	}
}

func TestFCFA(t *testing.T) {
	for n, want := range map[int]string{0: "0F", 500: "500F", 1000: "1 000F", 60000: "60 000F", 1250000: "1 250 000F", -7000: "-7 000F"} {
		if got := FCFA(n); got != want {
			t.Errorf("FCFA(%d) = %q, want %q", n, got, want)
		}
	}
}
