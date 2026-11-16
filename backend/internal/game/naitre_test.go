package game

import (
	"math/rand/v2"
	"testing"
)

// The first souvenir nudges the drawn family a little: a villa lifts it one step a third of the time
// (never past the top), a cour commune lifts only the precarious quarters, the village never moves it;
// nobody is ever lowered.
func TestNudgeFamily(t *testing.T) {
	rng := rand.New(rand.NewPCG(7, 7))
	const n = 4000
	for i, f := range Families {
		up := map[string]int{}
		for _, grew := range GrewUp {
			for range n {
				g, moved := NudgeFamily(f, grew, rng)
				j := indexFamily(g.ID)
				if j > i || (j < i-1) {
					t.Fatalf("%s (%s) became %s", f.ID, grew, g.ID)
				}
				if moved != (j != i) {
					t.Fatalf("moved %v for %s → %s", moved, f.ID, g.ID)
				}
				if moved {
					up[grew]++
				}
			}
		}
		if up[GrewVillage] != 0 {
			t.Errorf("%s: the village moved the family", f.ID)
		}
		if i == 0 && up[GrewVilla] != 0 {
			t.Errorf("the top family went higher")
		}
		if i > 0 {
			if share := float64(up[GrewVilla]) / n; share < 0.30 || share > 0.37 {
				t.Errorf("%s: a villa lifted it %.2f of the time", f.ID, share)
			}
		}
		if f.ID == "gnambro" {
			if share := float64(up[GrewCour]) / n; share < 0.30 || share > 0.37 {
				t.Errorf("gnambro: the cour lifted it %.2f of the time", share)
			}
		} else if up[GrewCour] != 0 {
			t.Errorf("%s: the cour moved it", f.ID)
		}
	}
	// The draw at birth is the same as before; with the villa answered by everyone, the weighted result
	// moves only a little towards the richer families.
	rich := func(nudge bool) float64 {
		k := 0
		for range n {
			f := BornInto(rng)
			if nudge {
				f, _ = NudgeFamily(f, GrewVilla, rng)
			}
			if indexFamily(f.ID) <= 2 {
				k++
			}
		}
		return float64(k) / n
	}
	before, after := rich(false), rich(true)
	if after <= before || after-before > 0.15 {
		t.Errorf("share of lagnon or richer: %.2f, %.2f nudged", before, after)
	}
}

func indexFamily(id string) int {
	for i, f := range Families {
		if f.ID == id {
			return i
		}
	}
	return -1
}

func TestSchoolSavingsAndPionnier(t *testing.T) {
	for _, f := range Families {
		cm2, bepc, bac := SchoolSavings(f, SchoolCM2), SchoolSavings(f, SchoolBEPC), SchoolSavings(f, SchoolBac)
		if cm2 < bepc || bepc < bac || bac != 0 {
			t.Errorf("%s: savings %d %d %d", f.ID, cm2, bepc, bac)
		}
	}
	for paid, want := range map[int]int{0: 0, 1000: 150_000, 2000: 250_000, 3000: 350_000, 5000: 600_000, 7000: 800_000} {
		if got := PionnierDjai(paid); got != want {
			t.Errorf("PionnierDjai(%d) = %d, want %d", paid, got, want)
		}
	}
	for talent, trait := range ChildTraits {
		if !ValidOption(Traits, trait) {
			t.Errorf("%s: %s isn't a trait", talent, trait)
		}
	}
	a, b := FriendChoices("abcdef123", "cocody", 10), FriendChoices("abcdef123", "cocody", 99)
	if len(a) != 3 || a[0].Name == a[1].Name || a[1].Name == a[2].Name || a[0].Name == a[2].Name {
		t.Fatalf("friends offered: %v", a)
	}
	for i := range a {
		if a[i].Name != b[i].Name || a[i].Seed != b[i].Seed || !a[i].Childhood {
			t.Fatalf("not the same friends each time: %v / %v", a, b)
		}
	}
}
