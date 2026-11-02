package game

import (
	"slices"
	"testing"
)

func TestErrandsAreDoable(t *testing.T) {
	seen := map[string]bool{}
	for _, e := range Errands {
		if seen[e.ID] {
			t.Fatalf("%s twice", e.ID)
		}
		seen[e.ID] = true
		cost := 0
		for _, st := range e.Steps {
			k, ok := Kinds[st.Kind]
			if !ok {
				t.Fatalf("%s: no kind %s", e.ID, st.Kind)
			}
			cheapest := -1
			for _, id := range st.Do {
				i := slices.IndexFunc(k.Interactions, func(it Interaction) bool { return it.ID == id })
				if i < 0 {
					t.Fatalf("%s: %s isn't done at %s", e.ID, id, st.Kind)
				}
				it := k.Interactions[i]
				if len(it.Days) > 0 || len(it.Places) > 0 || it.Requires != nil {
					t.Fatalf("%s: %s can't be done any day anywhere", e.ID, id)
				}
				if cheapest < 0 || it.Cost < cheapest {
					cheapest = it.Cost
				}
			}
			cost += cheapest
		}
		if e.Reward <= cost {
			t.Fatalf("%s pays %d for %d spent", e.ID, e.Reward, cost)
		}
	}
}

func TestErrandsOfDay(t *testing.T) {
	all := map[string]bool{}
	for k := range Kinds {
		all[k] = true
	}
	a := ErrandsOfDay("sim", 10, StageAdulte, all)
	if len(a) != ErrandsADay || !slices.Equal(a, ErrandsOfDay("sim", 10, StageAdulte, all)) {
		t.Fatalf("a day's demandes should be %d and the same all day: %v", ErrandsADay, a)
	}
	if slices.Equal(a, ErrandsOfDay("sim", 11, StageAdulte, all)) && slices.Equal(a, ErrandsOfDay("sim", 12, StageAdulte, all)) {
		t.Fatal("the demandes should change from day to day")
	}
	if ErrandsOfDay("sim", 10, StageBebe, all) != nil {
		t.Fatal("a baby gets no demande")
	}
	// A child: only what a child may do (no gbairai at the maquis, no hospital visit).
	for d := range int64(30) {
		for _, id := range ErrandsOfDay("kid", d, StageEnfant, all) {
			if id == "gbairai-mariam" || id == "malade-rose" || id == "marchander-yaya" {
				t.Fatalf("a child got %s", id)
			}
		}
	}
	// Only the kinds of place the commune has.
	for _, id := range ErrandsOfDay("sim", 10, StageAdulte, map[string]bool{"maquis": true}) {
		if e, _ := FindErrand(id); e.Steps[0].Kind != "maquis" {
			t.Fatalf("%s needs a place the commune hasn't", id)
		}
	}
}
