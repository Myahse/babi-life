package game

import "testing"

// The duties by bracket, and every split conserving the estate (heir + pot + fee).
func TestSuccessionSplit(t *testing.T) {
	for _, c := range []struct{ estate, fee int }{{0, 0}, {250_000, 0}, {300_000, 5_000}, {2_000_000, 175_000}, {3_000_000, 375_000}} {
		if got := SuccessionFee(c.estate); got != c.fee {
			t.Errorf("fee(%d) = %d, want %d", c.estate, got, c.fee)
		}
	}
	for _, e := range []int{-50_000, 0, 1, 249_999, 250_001, 999_999, 2_000_001, 12_345_678} {
		for _, pct := range []int{HeirShare, NeveuShare} {
			h, pot, fee := Split(e, pct)
			if h+pot+fee != max(0, e) || h < 0 || pot < 0 {
				t.Errorf("split(%d, %d) = %d + %d + %d", e, pct, h, pot, fee)
			}
		}
	}
	if h, pot, fee := Split(900_000, HeirShare); fee != 65_000 || h != 626_250 || pot != 208_750 {
		t.Errorf("900 000: %d %d %d", h, pot, fee)
	}
}

// The tier moves one step at most, each way.
func TestTierAfter(t *testing.T) {
	if got := TierAfter("gnambro", 100_000_000); got != "coule" {
		t.Errorf("rich gnambro: %s", got)
	}
	if got := TierAfter("debout", 0); got != "late" {
		t.Errorf("broke debout: %s", got)
	}
	if got := TierAfter("lagnon", 450_000); got != "lagnon" {
		t.Errorf("lagnon at its level: %s", got)
	}
}

// Played-hour spans: 30 h to 60, the inverse of the age, the veterans' age from time played.
func TestHeirSpans(t *testing.T) {
	sp := ParseHeirSpans("")
	if got := sp.LivedFor(60); got != 30*60 {
		t.Fatalf("60 after %d minutes, want 1800", got)
	}
	for _, y := range []int{18, 25, 30, 45, 50, 60, 70} {
		if _, got := sp.AdultAgeAt(sp.LivedFor(y)); got != y {
			t.Errorf("age %d → %d", y, got)
		}
	}
	if st, _ := sp.KidAgeAt(sp.Childhood()); st != StageAdulte || sp.Childhood() != 7*60 {
		t.Errorf("childhood: %s %d", st, sp.Childhood())
	}
	if got := ParseHeirSpans("jeune=5,adulte=10"); Days(got.Jeune) != 300 || Days(got.Adulte) != 600 || Days(got.Senior) != 600 {
		t.Errorf("env: %+v", got)
	}
	if VeteranAge(0) != 18 || VeteranAge(40*60*10) != 28 || VeteranAge(1<<40) != VeteranMaxAge {
		t.Error("veteran ages")
	}
}

// The renom: the generation's base, its works, the nudge past 60, the nephew's ×0.8.
func TestRenom(t *testing.T) {
	in := RenomIn{NetWorth: 5_000_000, Lots: 2, Buildings: 1, CareerLevel: 3, Kids: 2, Married: true, Bac: true, Years: 55, Office: "maire"}
	want := 100 + 100 + 60 + 40 + 30 + 80 + 30 + 20 + 30
	if got := Renom(in); got != want {
		t.Fatalf("renom %d, want %d", got, want)
	}
	in.Years = 65
	if got := Renom(in); got != 100+(want-100)/2 {
		t.Errorf("past 60: %d", got)
	}
	in.Years, in.Neveu = 55, true
	if got := Renom(in); got != want*4/5 {
		t.Errorf("nephew: %d", got)
	}
	js := Jalons(JalonsIn{Lots: 1, NetWorth: 300_000, Start: 70_000, CloseFriends: 5, PartnerHome: true, Kids: 2})
	if JalonsDone(js) != 4 || js[1].Done {
		t.Errorf("jalons: %+v", js)
	}
}
