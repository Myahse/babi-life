package sims

import (
	"slices"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// jeuAt: the Sim, where each game is played, and the place.
var jeuxWhere = []struct {
	id, city, commune, place string
}{
	{game.AmarrageID, "station-akwaba", "akwaba-noeud", "akwaba-sas"},
	{game.ReparationID, "station-akwaba", "akwaba-noeud", "akwaba-sas"},
	{game.AlunissageID, "lune", "lune-pirogue", "lune-capsule"},
	{game.AlunissageSimuID, "sassandra", "sassandra-spatioport", game.EntrainementID},
	{game.MargouillatJeuID, "lune", "lune-base", "lune-base-margouillat"},
	{game.SerreJeuID, "mars", "mars-colonie", "mars-colonie-serre"},
}

// The five games of the places: a good score gives more skill points than a bad one, more than none; a moodlet
// from SpaceGamePass; never money; once each time; the action done there and then.
func TestJeuxScoring(t *testing.T) {
	for _, w := range jeuxWhere {
		kind := game.JeuxGames[w.id]
		sk := game.JeuxSkill[w.id].Skill
		at := func() *Sim {
			s := aboard(w.city, w.commune)
			if w.city == "sassandra" {
				s.Life.Espace.Voyage = nil
			}
			return s
		}
		plain := at()
		money := plain.Money
		doneAt(t, plain, w.place, w.id, nil)
		played := func(score int) *Sim {
			s := at()
			if _, err := s.interactAt(w.place, w.id); err != nil {
				t.Fatalf("%s: %v", w.id, err)
			}
			text, evs, err := s.jeuxPlayed(kind, score)
			if err != nil || text == "" {
				t.Fatalf("%s played: %q %v", w.id, text, err)
			}
			if s.Activity != nil {
				t.Fatalf("%s: still running once played", w.id)
			}
			// (On Earth a surprise may come at the end, the cousin's call: not the game's.)
			luck := 0
			for _, e := range evs {
				if e.Kind == "random" {
					luck += e.Money
				}
			}
			if s.Money != money+luck {
				t.Fatalf("%s: money moved %d → %d", w.id, money, s.Money)
			}
			return s
		}
		good, bad := played(95), played(20)
		if !(good.Life.Skills[sk] > bad.Life.Skills[sk] && bad.Life.Skills[sk] >= plain.Life.Skills[sk] && plain.Life.Skills[sk] > 0) {
			t.Fatalf("%s skills: good %d, bad %d, plain %d", w.id, good.Life.Skills[sk], bad.Life.Skills[sk], plain.Life.Skills[sk])
		}
		mood := jeuMood(kind)
		has := func(s *Sim) bool {
			return slices.ContainsFunc(s.Life.Moodlets, func(m game.Moodlet) bool { return m.ID == mood })
		}
		if !has(good) || has(bad) {
			t.Fatalf("%s: the moodlet from %d", w.id, game.SpaceGamePass)
		}
		if good.Life.Espace.Jeux.Best[kind] != 95 {
			t.Fatalf("%s: money %d, best %v", w.id, plain.Money, good.Life.Espace.Jeux.Best)
		}
	}
}

// Once each time; not the wrong game; nothing to play while doing nothing; a score sent just after its action
// ended unplayed still counts (a little while).
func TestJeuxOnceAndLate(t *testing.T) {
	s := aboard("station-akwaba", "akwaba-noeud")
	if _, _, err := s.jeuxPlayed("amarrage", 80); err == nil {
		t.Fatal("scored while doing nothing")
	}
	if _, err := s.interactAt("akwaba-sas", game.AmarrageID); err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.jeuxPlayed("reparation", 80); err == nil {
		t.Fatal("the wrong game scored")
	}
	s.GameMinutes = s.Activity.End
	s.finish(rocketRng())
	before := s.Life.Skills["logique"]
	if before == 0 || s.Life.Espace.Jeux.Last == nil {
		t.Fatal("unplayed: nothing given, nothing kept")
	}
	text, _, err := s.jeuxPlayed("amarrage", 90)
	if err != nil || !strings.Contains(text, "réussi") || s.Life.Skills["logique"] <= before {
		t.Fatalf("late: %q %v (%d → %d)", text, err, before, s.Life.Skills["logique"])
	}
	if _, _, err := s.jeuxPlayed("amarrage", 90); err == nil {
		t.Fatal("a late score counted twice")
	}
	// Too late.
	s2 := aboard("station-akwaba", "akwaba-noeud")
	doneAt(t, s2, "akwaba-sas", game.AmarrageID, nil)
	s2.GameMinutes += SpaceGameGrace + 1
	if _, _, err := s2.jeuxPlayed("amarrage", 90); err == nil {
		t.Fatal("a score far too late")
	}
	// Each game only where it's played: the docking at the station, not on the Moon.
	if _, err := aboard("lune", "lune-base").interactAt("lune-base-sas", game.AmarrageID); err == nil {
		t.Fatal("the station's docking from the Moon")
	}
	if _, err := aboard("mars", "mars-colonie").interactAt("mars-colonie-rover", game.MargouillatJeuID); err == nil {
		t.Fatal("the Margouillat on Mars")
	}
}

// controleur: a mission controller at the siège, in the shift's hours.
func controleur() *Sim {
	s := astronaut()
	s.City, s.Commune = "abidjan", "plateau"
	s.Career, s.CareerLevel = game.ControleCareer, 1
	s.Life.Etudes = &game.Etudes{BEPC: &game.Exam{Note: 13}, BAC: &game.Exam{Note: 13, Serie: game.SerieD}, Diplomes: []game.Diplome{{Degree: game.DegreeLicence, Filiere: "sciences"}}}
	s.GameMinutes = (s.GameMinutes/(24*60)+1)*24*60 + 9*60
	return s
}

// The control room: the controller's shift itself, in the one-shift-a-day cap; its pay never more than the
// shift's (a little less played badly); the « go » given right, the performance; nobody else at the console.
func TestControleShiftCap(t *testing.T) {
	c, _ := game.FindCareer(game.ControleCareer)
	pay := c.Levels[1].Pay
	paid := func(evs []Event) int {
		for _, e := range evs {
			if e.Kind == "interaction" {
				return e.Money
			}
		}
		return 0
	}
	plain := controleur()
	if _, err := plain.interactAt(game.AstreliaSiegeID, game.WorkInteractionID); err != nil {
		t.Fatal(err)
	}
	shift := paid(plain.advanceTo(plain.Activity.End, rocketRng()))
	if shift <= 0 || shift > pay*2 {
		t.Fatalf("the shift paid %d (pay %d)", shift, pay)
	}
	perfs := map[int]int{}
	for _, sc := range []struct{ score int }{{95}, {20}} {
		s := controleur()
		if _, err := s.interactAt(game.AstreliaSiegeID, game.ControleJeuID); err != nil {
			t.Fatal(err)
		}
		if s.Activity.Career != game.ControleCareer || s.Activity.Interaction.Cost >= 0 {
			t.Fatalf("not a shift: %+v", s.Activity)
		}
		text, evs, err := s.jeuxPlayed("controle", sc.score)
		if err != nil || text == "" {
			t.Fatal(text, err)
		}
		got := paid(evs)
		if got <= 0 || got > shift {
			t.Fatalf("score %d: paid %d, a plain shift %d", sc.score, got, shift)
		}
		perfs[sc.score] = s.Performance
		// In the cap: no second shift today, whichever way.
		if _, err := s.interactAt(game.AstreliaSiegeID, game.ControleJeuID); err == nil {
			t.Fatal("a second control-room shift the same day")
		}
		if _, err := s.interactAt(game.AstreliaSiegeID, game.WorkInteractionID); err == nil {
			t.Fatal("a shift after the control room's, the same day")
		}
	}
	if perfs[95] <= perfs[20] {
		t.Fatalf("the right « go » counts for nothing: %v", perfs)
	}
	// After the plain shift, no control room either.
	if _, err := plain.interactAt(game.AstreliaSiegeID, game.ControleJeuID); err == nil {
		t.Fatal("the control room after the day's shift")
	}
	// At the pad of Sassandra too.
	pad := controleur()
	pad.City, pad.Commune = "sassandra", "sassandra-spatioport"
	if _, err := pad.interactAt("sassandra-pas-de-tir", game.ControleJeuID); err != nil {
		t.Fatalf("the spaceport's control room: %v", err)
	}
	// Not for another career.
	other := controleur()
	other.Career = game.GuideCareer
	if _, err := other.interactAt(game.AstreliaSiegeID, game.ControleJeuID); err == nil {
		t.Fatal("a guide at the console")
	}
}

// The update lists every action of the six, each one on a place's kind.
func TestJeuxActsListed(t *testing.T) {
	for _, id := range game.JeuxActs {
		if !slices.Contains(game.EspaceActs[game.EspaceJeuxKey], id) {
			t.Fatalf("%s not in the update", id)
		}
		if _, ok := game.JeuxGames[id]; !ok {
			t.Fatalf("%s has no game", id)
		}
		found := false
		for _, k := range game.Kinds {
			if _, ok := k.Interaction(id); ok {
				found = true
			}
		}
		if !found || !slices.Contains(gesteNot, id) {
			t.Fatalf("%s: on no place, or played as gestures", id)
		}
	}
}
