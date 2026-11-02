package game

import "testing"

func TestStoriesAreDoable(t *testing.T) {
	all := map[string]bool{}
	for k := range Kinds {
		all[k] = true
	}
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
	all := map[string]bool{}
	for k := range Kinds {
		all[k] = true
	}
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
