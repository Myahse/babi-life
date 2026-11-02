package game

import "testing"

// reachable: every kind of place, here and (« city/kind ») in the cities the stories go to.
func reachable() map[string]bool {
	all := map[string]bool{}
	for k := range Kinds {
		all[k] = true
	}
	for _, st := range Stories {
		for _, c := range st.Chapters {
			for _, step := range c.Steps {
				all[step.placeKey()] = true
			}
		}
	}
	return all
}

func TestStoriesAreDoable(t *testing.T) {
	all := reachable()
	seen := map[string]bool{}
	for _, st := range Stories {
		if seen[st.ID] {
			t.Fatalf("%s twice", st.ID)
		}
		seen[st.ID] = true
		if len(st.Chapters) < 2 {
			t.Fatalf("%s: a story has chapters", st.ID)
		}
		for i, c := range st.Chapters {
			// Each chapter checked as a demande is (the activities exist there, any day, and it pays more than it costs).
			e := Errand{ID: st.ID, Steps: c.Steps, Reward: c.Reward}
			saved := Errands
			Errands = []Errand{e}
			TestErrandsAreDoable(t)
			Errands = saved
			if c.Reward > Caps[FromStory].Djai {
				t.Fatalf("%s chapter %d pays more than a day's cap", st.ID, i+1)
			}
		}
		if !st.For(StageAdulte, all) {
			t.Fatalf("an adult can't do %s", st.ID)
		}
	}
}

func TestNextStory(t *testing.T) {
	all := reachable()
	first, ok := NextStory(nil, StageAdulte, all)
	if !ok || first.ID != Stories[0].ID {
		t.Fatalf("the first story should come first, got %v", first.ID)
	}
	second, _ := NextStory(map[string]bool{first.ID: true}, StageAdulte, all)
	if second.ID != Stories[1].ID {
		t.Fatalf("then the next, got %v", second.ID)
	}
	if _, ok := NextStory(nil, StageBebe, all); ok {
		t.Fatal("a baby has no story")
	}
	// A child: the stories with the maquis's gbairai or the market's bargaining are passed over.
	seen := map[string]bool{}
	for {
		st, ok := NextStory(seen, StageEnfant, all)
		if !ok {
			break
		}
		if st.ID == "serge-fatou" || st.ID == "bintou-maquis" {
			t.Fatalf("a child got %s", st.ID)
		}
		seen[st.ID] = true
	}
	if !seen["kone-petit-fils"] {
		t.Fatal("a child should get the vieux Koné's story")
	}
}

func TestStoriesUnlock(t *testing.T) {
	all := reachable()
	// In their order, the mysteries after the stories they follow on from, and only for an adult.
	seen := map[string]bool{"kone-petit-fils": true, "chat-grigri": true, "bintou-maquis": true, "grand-match": true}
	if st, _ := NextStory(seen, StageAdulte, all); st.ID != "serge-fatou" {
		t.Fatalf("Serge's story next, got %s", st.ID)
	}
	seen["serge-fatou"], seen["recette-ahou"] = true, true
	if st, _ := NextStory(seen, StageAdulte, all); st.ID != "maquis-maudit" {
		t.Fatalf("then the maquis maudit, got %s", st.ID)
	}
	if st, _ := NextStory(map[string]bool{"kone-petit-fils": true, "chat-grigri": true}, StageAdulte, all); st.ID != "bintou-maquis" {
		t.Fatalf("Bintou's own story before her mystery, got %s", st.ID)
	}
	if st, _ := NextStory(map[string]bool{"chat-grigri": true, "bintou-maquis": true, "grand-match": true, "serge-fatou": true, "recette-ahou": true}, StageAdulte, all); st.ID != "kone-petit-fils" {
		t.Fatalf("a story not done comes first, got %s", st.ID)
	}
	// A teenager goes through every story it may have, and none is an adult's.
	teen := map[string]bool{}
	for {
		st, ok := NextStory(teen, StageAdo, all)
		if !ok {
			break
		}
		if st.Adults {
			t.Fatalf("a teenager got %s", st.ID)
		}
		teen[st.ID] = true
	}
	if len(teen) < 4 {
		t.Fatalf("a teenager should have a few stories, got %v", teen)
	}
	// No trips (the update closed): the stories that go to Man or Bassam wait.
	home := map[string]bool{}
	for k := range Kinds {
		home[k] = true
	}
	for _, st := range Stories {
		trip := false
		for _, c := range st.Chapters {
			for _, step := range c.Steps {
				trip = trip || step.City != "" && step.City != "abidjan"
			}
		}
		if trip && st.For(StageAdulte, home) {
			t.Fatalf("%s goes away: it can't come while one can't travel", st.ID)
		}
	}
	// A step away counts there only.
	var trip ErrandStep
	for _, st := range Stories {
		for _, c := range st.Chapters {
			for _, step := range c.Steps {
				if step.City != "" && step.City != "abidjan" && trip.City == "" {
					trip = step
				}
			}
		}
	}
	if trip.Counts(trip.Kind, trip.Do[0], "abidjan") || !trip.Counts(trip.Kind, trip.Do[0], trip.City) {
		t.Fatal("a trip's step counts in its city only")
	}
}

// Two different activities never share an ID: a défi, a 3D prop or a demande found by
// it would take one for the other (the pharmacist's advice played the town council's quiz).
func TestInteractionIDsMeanOneThing(t *testing.T) {
	same := map[string]bool{"petit-travaillement": true} // the same « travaillement », at the club or in the street
	label := map[string]string{}
	for k, pk := range Kinds {
		for _, it := range pk.Interactions {
			if l, ok := label[it.ID]; ok && l != it.Label && !same[it.ID] {
				t.Fatalf("%s is both « %s » and « %s » (%s)", it.ID, l, it.Label, k)
			}
			label[it.ID] = it.Label
		}
	}
}

func TestStoryChoices(t *testing.T) {
	all := reachable()
	first := StoryChoices(nil, StageAdulte, all, 3)
	if len(first) != 3 || first[0].ID != Stories[0].ID {
		t.Fatalf("three to pick from, in the list's order: %v", first)
	}
	for _, st := range first {
		if st.After != "" {
			t.Fatalf("%s can't be offered before the story it follows on from", st.ID)
		}
	}
	// Bintou's own story done: the two it leads to (Serge, whom she sends you to, and her
	// mystery) are offered first.
	c := StoryChoices(map[string]bool{"kone-petit-fils": true, "bintou-maquis": true}, StageAdulte, all, 3)
	if c[0].ID != "serge-fatou" || c[1].ID != "maquis-maudit" {
		t.Fatalf("the sequels just unlocked come first, got %s, %s", c[0].ID, c[1].ID)
	}
	// Every story seen: nothing left.
	seen := map[string]bool{}
	for _, st := range Stories {
		seen[st.ID] = true
	}
	if c := StoryChoices(seen, StageAdulte, all, 3); len(c) != 0 {
		t.Fatalf("nothing left to offer, got %v", c)
	}
}

// Every story sets its scene before the first chapter: who, where, what's at stake.
func TestStoriesHavePrologues(t *testing.T) {
	for _, st := range Stories {
		if n := len([]rune(st.Prologue)); n < 120 || n > 420 {
			t.Errorf("%s: a prologue of a few sentences (%d characters)", st.ID, n)
		}
	}
}
