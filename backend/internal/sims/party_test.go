package sims

import (
	"errors"
	"math/rand/v2"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// A soirée in Yopougon: its guests dance, mix and drink there; only the host
// receives; someone in another commune is sent there; once over, nothing.
func TestPartyActions(t *testing.T) {
	f := game.Families[0]
	party := &Party{ID: "p1", Host: "host", HostName: "Awa", Theme: "zouglou", Title: "Soirée zouglou", City: "abidjan", Commune: "yopougon", Ends: time.Now().Add(time.Hour)}
	place := party.PlaceID()

	guest := adultSim(f, "")
	guest.ID = "guest"
	guest.party = party
	it, err := guest.interactAt(place, "danser-soiree")
	if err != nil {
		t.Fatalf("a guest dances: %v", err)
	}
	if guest.Activity.PlaceName != "Soirée zouglou chez Awa" || guest.Activity.PlaceKind != game.SoireeKind || it.Cost != 0 {
		t.Errorf("at the soirée: %+v", guest.Activity)
	}
	if !joinable(guest.Activity, guest.GameMinutes) {
		t.Error("the others can join a guest dancing")
	}

	busy := adultSim(f, "")
	busy.party = party
	if _, err := busy.interactAt(place, game.SoireeHostID); !errors.Is(err, errPartyHost) {
		t.Errorf("a guest can't receive: %v", err)
	}
	money := busy.Money
	if _, err := busy.interactAt(place, "boire-soiree"); err != nil || busy.Money != money-1000 {
		t.Errorf("a drink at the bar: %v, %d", err, busy.Money)
	}

	away := adultSim(f, "")
	away.Commune = "cocody"
	away.party = party
	if _, err := away.interactAt(place, "danser-soiree"); err == nil || !strings.Contains(err.Error(), "Yopougon") {
		t.Errorf("from Cocody, sent to Yopougon: %v", err)
	}

	late := adultSim(f, "")
	if _, err := late.interactAt(place, "danser-soiree"); !errors.Is(err, errPartyGone) {
		t.Errorf("no soirée read (over): %v", err)
	}
	other := adultSim(f, "")
	other.party = &Party{ID: "p2", City: "abidjan", Commune: "yopougon"}
	if _, err := other.interactAt(place, "danser-soiree"); !errors.Is(err, errPartyGone) {
		t.Errorf("another soirée read: %v", err)
	}

	host := adultSim(f, "")
	host.ID = "host"
	host.party = party
	if _, err := host.interactAt(place, game.SoireeHostID); err != nil {
		t.Errorf("the host receives: %v", err)
	}
}

// Nothing done at a soirée pays (it's a sink), and its themes are a fixed list.
func TestPartySink(t *testing.T) {
	for _, it := range game.Kinds[game.SoireeKind].Interactions {
		if it.Cost < 0 {
			t.Errorf("%s pays %d", it.ID, -it.Cost)
		}
	}
	if _, ok := themeLabel("coupe-decale"); !ok {
		t.Error("coupé-décalé is a theme")
	}
	if _, ok := themeLabel("n'importe quoi"); ok {
		t.Error("no free titles")
	}
	s := adultSim(game.Families[0], "")
	if _, _, _, err := s.goOut(game.SoireePrefix+"p1", "danser-soiree", nil, newRand()); !errors.Is(err, errOutingWhere) {
		t.Errorf("no outing with the NPC friends to a soirée: %v", err)
	}
}

// A slow is always danced with someone: a new face met as an adult (a friend now), or a friend seen again.
func TestSlowWith(t *testing.T) {
	for seed := range uint64(30) {
		s := adultSim(game.Families[0], "")
		ev := s.socialize(game.Interaction{ID: game.SlowID}, rand.New(rand.NewPCG(seed, 7)))
		if len(ev) != 1 || len(s.Friends) != 1 || !s.Friends[0].Adult || !strings.Contains(ev[0].Text, s.Friends[0].Name) {
			t.Fatalf("seed %d: %+v %+v", seed, ev, s.Friends)
		}
		before := s.Friends[0].Friendship
		s.Friends[0].Seen = 0
		for i := 0; len(s.Friends) == 1 && i < 50; i++ {
			s.socialize(game.Interaction{ID: game.SlowID + "-soiree"}, rand.New(rand.NewPCG(seed, uint64(i))))
		}
		if len(s.Friends) == 1 && s.Friends[0].Friendship <= before {
			t.Errorf("seed %d: the friend danced with again is closer", seed)
		}
	}
	for _, k := range []string{"club", game.SoireeKind} {
		for _, id := range []string{"atalaku", "podium", "slow"} {
			if k == game.SoireeKind {
				id += "-soiree"
			}
			if _, ok := game.Kinds[k].Interaction(id); !ok {
				t.Errorf("%s: no %s", k, id)
			}
		}
	}
}

// An activity done brings XP and trains its skill; stopped, the part done.
func TestActivityExperience(t *testing.T) {
	s := adultSim(game.Families[0], "")
	if _, err := s.interactAt(HomePlaceID, "cook-attieke"); err != nil {
		t.Fatal(err)
	}
	ev := s.finish(noLuck())
	if s.Progress.XP != 15 || s.Progress.Skills[game.SkillCuisine] != 15 || !strings.Contains(ev[0].Text, "+15 XP") {
		t.Errorf("cooking for 45 min: %+v, %q", s.Progress, ev[0].Text)
	}
	if _, err := s.interactAt(HomePlaceID, "cook-attieke"); err != nil {
		t.Fatal(err)
	}
	s.GameMinutes = s.Activity.Start + (s.Activity.End-s.Activity.Start)/2
	stopped, err := s.stop()
	if err != nil || s.Progress.XP != 22 || !strings.Contains(stopped.Text, "+7 XP") {
		t.Errorf("half of it: %+v, %q, %v", s.Progress, stopped.Text, err)
	}
	// A garba made at home is for the cooks (Cuisine 3).
	if _, err := s.interactAt(HomePlaceID, "garba-maison"); err == nil || !strings.Contains(err.Error(), "Cuisine niveau 3") {
		t.Errorf("garba maison at Cuisine 0: %v", err)
	}
}
