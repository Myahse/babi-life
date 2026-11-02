package sims

import (
	"slices"
	"testing"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// Every story can be done from Abidjan with the game's real places (the trips
// once one may travel), and none asks for an activity an update still shuts.
func TestStoriesReachable(t *testing.T) {
	kinds := storyKinds("yopougon", game.StageAdulte, true)
	var shut []string
	for _, f := range features.List {
		shut = append(shut, f.Interactions...)
	}
	for _, st := range game.Stories {
		if !st.For(game.StageAdulte, kinds) {
			t.Errorf("%s can't be done from Yopougon", st.ID)
		}
		for _, c := range st.Chapters {
			for _, step := range c.Steps {
				for _, id := range step.Do {
					if slices.Contains(shut, id) {
						t.Errorf("%s asks for %s, shut by an update", st.ID, id)
					}
				}
			}
		}
	}
	for _, e := range game.Errands {
		for _, step := range e.Steps {
			for _, id := range step.Do {
				if slices.Contains(shut, id) {
					t.Errorf("%s asks for %s, shut by an update", e.ID, id)
				}
			}
		}
	}
	// Without trips, the stories that stay in Abidjan still come.
	home := storyKinds("yopougon", game.StageAdulte, false)
	n := 0
	for _, st := range game.Stories {
		if st.For(game.StageAdulte, home) {
			n++
		}
	}
	if n < 8 {
		t.Errorf("only %d stories without trips", n)
	}
}

// A child, who can't take a taxi alone, only gets stories it can do in its own commune.
func TestChildStoriesStayHome(t *testing.T) {
	kinds := storyKinds("yopougon", game.StageEnfant, true)
	seen := map[string]bool{}
	for {
		st, ok := game.NextStory(seen, game.StageEnfant, kinds)
		if !ok {
			break
		}
		for _, c := range st.Chapters {
			for _, step := range c.Steps {
				if step.City != "" {
					t.Fatalf("a child got %s, which goes to %s", st.ID, step.City)
				}
			}
		}
		seen[st.ID] = true
	}
	if len(seen) < 3 {
		t.Fatalf("a child should still have a few stories, got %v", seen)
	}
}
