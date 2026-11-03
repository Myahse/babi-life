package game

import "testing"

// Each épreuve ends its chapter, at a place of the kind of the step before, which offers it.
func TestEpreuves(t *testing.T) {
	for _, e := range Epreuves {
		s, ok := FindStory(e.Story)
		if !ok {
			t.Fatalf("%s : pas d'histoire", e.Story)
		}
		steps := s.Chapters[e.Chapter].Steps
		last := steps[len(steps)-1]
		if len(last.Do) != 1 || last.Do[0] != EpreuveID(e.Story) {
			t.Errorf("%s : l'épreuve n'est pas la dernière étape du chapitre %d", e.Story, e.Chapter+1)
		}
		if len(steps) < 2 || steps[len(steps)-2].Kind != last.Kind || steps[len(steps)-2].City != last.City {
			t.Errorf("%s : pas au même genre de lieu que l'étape d'avant", e.Story)
		}
		if _, ok := Kinds[last.Kind].Interaction(EpreuveID(e.Story)); !ok {
			t.Errorf("%s : le lieu « %s » ne la propose pas", e.Story, last.Kind)
		}
		if !last.Counts(last.Kind, EpreuveID(e.Story), last.City) {
			t.Errorf("%s : jouée, elle ne compte pas", e.Story)
		}
	}
}
