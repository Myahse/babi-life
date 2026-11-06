package sims

import (
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Three wishes come with the clock; the same minute draws the same ones; they go when over and come back.
func TestWishesCome(t *testing.T) {
	s := lifeSim()
	s.ID = "11111111-1111-1111-1111-111111111111"
	s.lifeSync()
	if len(s.Life.Wishes) != game.MaxWishes {
		t.Fatalf("three wishes: %+v", s.Life.Wishes)
	}
	seen := map[string]bool{}
	for _, w := range s.Life.Wishes {
		if seen[w.Goal] || w.Label == "" || w.Points <= 0 || w.Until <= s.GameMinutes {
			t.Fatalf("a wish twice, or empty: %+v", s.Life.Wishes)
		}
		seen[w.Goal] = true
	}
	again := lifeSim()
	again.ID = s.ID
	again.lifeSync()
	for i := range s.Life.Wishes {
		if again.Life.Wishes[i].Goal != s.Life.Wishes[i].Goal {
			t.Fatal("the same Sim at the same minute: the same wishes")
		}
	}
	s.GameMinutes += game.WishLife + 1
	s.lifeSync()
	if len(s.Life.Wishes) != 0 {
		t.Fatalf("over: gone, the slot fills a little after: %+v", s.Life.Wishes)
	}
	s.GameMinutes += game.WishGap + 1
	s.lifeSync()
	if len(s.Life.Wishes) != game.MaxWishes {
		t.Fatal("back after the gap")
	}
}

// Who the Sim is shows in what it wants: a baby's are a baby's; a dirty house wants cleaning; a friend to see.
func TestWishOffer(t *testing.T) {
	s := lifeSim()
	s.Friends = []game.Friend{{ID: "p-koffi", Name: "Koffi", Friendship: 50, Adult: true}, {ID: "p-yao", Name: "Yao", Friendship: 10, Enemy: true}}
	s.addMood("maison-sale", "")
	goals := map[string]game.Wish{}
	for _, w := range s.wishOffer() {
		goals[w.Goal] = w
	}
	for _, g := range []string{"do:faire-menage", "chat:p-koffi", "excuse:p-yao", "flirt:p-koffi", "skill:charisme", "train:forme"} {
		if _, ok := goals[g]; !ok {
			t.Fatalf("%s offered: %v", g, goals)
		}
	}
	if goals["chat:p-koffi"].Label != "Discuter avec Koffi" {
		t.Fatalf("named: %q", goals["chat:p-koffi"].Label)
	}
	s.Friends[0].Partner = true
	for _, w := range s.wishOffer() {
		if strings.HasPrefix(w.Goal, "flirt:") {
			t.Fatal("together with someone: no flirting wish")
		}
	}
	baby := lifeSim()
	baby.BornAt = baby.GameMinutes - 60
	for _, w := range baby.wishOffer() {
		if strings.HasPrefix(w.Goal, "place:") || strings.HasPrefix(w.Goal, "skill:") || strings.HasPrefix(w.Goal, "buy:") {
			t.Fatalf("a baby doesn't want %s", w.Goal)
		}
	}
}

// Fulfilled: its points, a good mood, a line; the slot fills after the gap.
func TestWishFulfilled(t *testing.T) {
	s := lifeSim()
	s.Life.Wishes = []game.Wish{{Goal: "do:faire-menage", Label: "Faire le ménage", Points: 20, Until: s.GameMinutes + 100}, {Goal: "place:maquis", Label: "Aller au maquis ce soir", Points: 25, Until: s.GameMinutes + 100}}
	s.Life.WishNext = s.GameMinutes + 1000
	s.lifeDone(done("faire-menage", game.Needs{}, 2), 0)
	if s.Life.Points != 20 || len(s.Life.Wishes) != 1 || !s.hasMood("envie") || len(s.pending) != 1 || s.pending[0].Kind != "wish" {
		t.Fatalf("fulfilled: %+v %+v", s.Life, s.pending)
	}
	a := done("drink-with-friends", game.Needs{Fun: 20, Social: 20}, 2)
	a.PlaceKind = "maquis"
	s.lifeDone(a, 0)
	if s.Life.Points != 45 || len(s.Life.Wishes) != 0 || s.Life.Fulfilled != 2 {
		t.Fatalf("at the maquis: %+v", s.Life)
	}
	// A mood, a level, a word, a game of dames won elsewhere.
	s.Life.Wishes = []game.Wish{{Goal: "mood:douche", Points: 10, Until: s.GameMinutes + 99}, {Goal: "skill:musique", Level: 2, Points: 10, Until: s.GameMinutes + 99}, {Goal: "win:dames", Points: 10, Until: s.GameMinutes + 99}}
	s.addMood("douche", "")
	s.gainSkill("musique", game.SkillXP(2))
	s.Life.Hits = []string{"win:dames", "mood:bon-moment:Awa"}
	s.lifeSync()
	if s.Life.Points != 75 || !s.hasMood("bon-moment") {
		t.Fatalf("each way fulfilled: %+v", s.Life)
	}
	// Shut, nothing.
	s.lifeOn = false
	s.Life.Wishes = []game.Wish{{Goal: "mood:douche", Points: 10, Until: s.GameMinutes + 99}}
	s.wishGoal("mood:douche")
	if len(s.Life.Wishes) != 1 {
		t.Fatal("le mode vie shut: no wish fulfilled")
	}
}

// A few changes a day, then none until the next; the new one isn't the old one.
func TestWishDismiss(t *testing.T) {
	s := lifeSim()
	s.ID = "22222222-2222-2222-2222-222222222222"
	s.lifeSync()
	for i := 0; i < game.WishSwaps; i++ {
		old := s.Life.Wishes[0].Goal
		if _, _, err := s.dismissWish(old); err != nil {
			t.Fatalf("change %d: %v", i, err)
		}
		if len(s.Life.Wishes) != game.MaxWishes || s.Life.Wishes[0].Goal == old {
			t.Fatalf("replaced: %+v", s.Life.Wishes)
		}
	}
	if _, _, err := s.dismissWish(s.Life.Wishes[0].Goal); err != errNoSwap {
		t.Fatalf("no more today: %v", err)
	}
	if _, _, err := s.dismissWish("nope"); err != errNoWish {
		t.Fatal("not there")
	}
	s.GameMinutes += 24 * 60
	s.lifeSync()
	if s.swapsLeft() != game.WishSwaps {
		t.Fatal("a new day")
	}
	s.Life.Perks = []string{"envie-plus"}
	if s.swapsLeft() != game.WishSwaps+game.SwapsPlus {
		t.Fatal("the perk: more")
	}
}

// The shop: paid in points, once each; the perks do what they say.
func TestPerks(t *testing.T) {
	s := lifeSim()
	if _, _, err := s.buyPerk("taxi-ami"); err != errFewPoints {
		t.Fatalf("no points: %v", err)
	}
	if _, _, err := s.buyPerk("voler"); err != errNoPerk {
		t.Fatal("unknown")
	}
	p, _ := game.PerkOf("taxi-ami")
	s.Life.Points = p.Cost + 5
	money := s.Money
	if _, _, err := s.buyPerk("taxi-ami"); err != nil || s.Life.Points != 5 || s.Money != money {
		t.Fatalf("bought with points only: %v %+v", err, s.Life)
	}
	if _, _, err := s.buyPerk("taxi-ami"); err != errHavePerk {
		t.Fatal("once")
	}
	if s.rideOff(1000, "taxi") != 800 || s.rideOff(1000, "moto") != 800 || s.rideOff(1000, "avion") != 1000 {
		t.Fatal("taxi 20 % less, not the plane")
	}
	// Slower needs.
	plain := lifeSim()
	slow := lifeSim()
	slow.Life.Perks = []string{"besoins-lents"}
	a, b := plain.decay(plain.Needs, 60, true), slow.decay(slow.Needs, 60, true)
	if !(b.Hunger > a.Hunger) || b.Hunger-plain.Needs.Hunger > 0 {
		t.Fatalf("slower, still down: %v %v", a, b)
	}
	// Faster skills.
	quick := lifeSim()
	quick.Life.Perks = []string{"apprenti"}
	plain.gainSkill("forme", 40)
	quick.gainSkill("forme", 40)
	if quick.Life.Skills["forme"] != 50 || plain.Life.Skills["forme"] != 40 {
		t.Fatalf("apprenti: %v %v", quick.Life.Skills, plain.Life.Skills)
	}
	// Shut: the perks do nothing.
	slow.lifeOn = false
	if slow.hasPerk("besoins-lents") {
		t.Fatal("shut")
	}
}

// The household's needs: kept here, down with the clock (not below the floor), up with what they do.
func TestHouseNeeds(t *testing.T) {
	s := lifeSim()
	s.Friends = []game.Friend{{ID: "p-ami", Name: "Ami", Partner: true, Home: true, Adult: true}}
	s.lifeSync()
	id := "partner:p-ami"
	if s.Life.House[id] != houseFull {
		t.Fatalf("starts fine: %+v", s.Life.House)
	}
	s.GameMinutes += 60
	s.lifeSync()
	if n := s.Life.House[id]; n.Hunger >= houseFull.Hunger {
		t.Fatalf("down with the clock: %+v", n)
	}
	s.GameMinutes += 10 * 24 * 60
	s.lifeSync()
	if n := s.Life.House[id]; n.Hunger != houseFloor {
		t.Fatalf("never below the floor: %+v", n)
	}
	if err := s.houseDo(id, "frigo"); err != nil || s.Life.House[id].Hunger != houseFloor+45 {
		t.Fatalf("ate: %v %+v", err, s.Life.House[id])
	}
	if err := s.houseDo("parent:papa", "frigo"); err != errNoMember {
		t.Fatal("papa isn't there")
	}
	if err := s.houseDo(id, "voler"); err == nil {
		t.Fatal("unknown action")
	}
	s.Friends = nil
	s.lifeSync()
	if len(s.Life.House) != 0 {
		t.Fatal("gone: dropped")
	}
}

// With another player: romance only between grown-up friends, never with someone taken; kisses for couples.
func TestWhyPlayer(t *testing.T) {
	stranger := playerBond{}
	if whyPlayer("salut", stranger) != "" || whyPlayer("blague", stranger) != "" {
		t.Fatal("a stranger can be greeted")
	}
	if whyPlayer("confier", stranger) == "" || whyPlayer("drague", stranger) == "" {
		t.Fatal("not to a stranger")
	}
	friends := playerBond{Known: true, Friends: true, Friendship: 50, Adults: true}
	if whyPlayer("drague", friends) != "" || whyPlayer("embrasser", friends) == "" {
		t.Fatal("flirting between grown-up friends; kissing for couples")
	}
	kids := friends
	kids.Adults = false
	if whyPlayer("drague", kids) == "" {
		t.Fatal("not under 18")
	}
	taken := friends
	taken.Taken = true
	if whyPlayer("drague", taken) == "" {
		t.Fatal("not with someone taken")
	}
	couple := friends
	couple.Couple, couple.Romance = true, 80
	if whyPlayer("embrasser", couple) != "" {
		t.Fatal("a couple kisses")
	}
	blocked := friends
	blocked.Blocked = true
	if whyPlayer("salut", blocked) == "" {
		t.Fatal("blocked: nothing")
	}
	if socialGood("disputer", friends, 10, 0) {
		t.Fatal("a quarrel never goes well")
	}
}
