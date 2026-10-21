package sims

import (
	"math/rand/v2"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/world"
)

func TestGramAudience(t *testing.T) {
	avg := func(fans int, place string, filtered, captioned bool, traits []string) (reach, likes, nf int) {
		r := rand.New(rand.NewPCG(3, 4))
		for range 400 {
			a, b, c := gramAudience(fans, place, filtered, captioned, traits, r)
			reach, likes, nf = reach+a, likes+b, nf+c
		}
		return reach / 400, likes / 400, nf / 400
	}
	r0, l0, f0 := avg(0, "", false, false, nil)
	if r0 <= 0 || l0 <= 0 || f0 <= 0 {
		t.Fatalf("a first photo brings nobody: %d reach, %d likes, %d fans", r0, l0, f0)
	}
	rBeach, _, fBeach := avg(0, "beach", false, false, nil)
	if rBeach <= r0 || fBeach < f0 {
		t.Errorf("the beach does no better than the street: %d/%d vs %d/%d", rBeach, fBeach, r0, f0)
	}
	rDone, _, _ := avg(0, "", true, true, []string{"artiste"})
	if rDone <= r0 {
		t.Errorf("a filter, a caption and an artist bring no more (%d vs %d)", rDone, r0)
	}
	rBig, lBig, _ := avg(20000, "", false, false, nil)
	if rBig <= rBeach*10 || lBig <= l0 {
		t.Errorf("20 000 followers reach too few: %d", rBig)
	}
	if l0 > r0 {
		t.Error("more likes than people who saw it")
	}
}

func TestGramRanking(t *testing.T) {
	if gramScore(10, 0, 1) <= gramScore(10, 0, 30) {
		t.Error("a fresh photo should beat an old one with as many likes")
	}
	if gramScore(500, 0, 5) <= gramScore(5, 0, 5) {
		t.Error("more likes should rank higher at the same age")
	}
	if gramScore(0, 5, 5) <= gramScore(5, 0, 5) {
		t.Error("comments weigh more than likes")
	}
	// The log keeps a big account from burying a friend's fresh photo forever.
	if gramHomeScore(10, 0, 2, true, false) <= gramHomeScore(3000, 10, 20, false, false) {
		t.Error("a followed friend's fresh photo should beat a day-old viral one on the home feed")
	}
	if gramHomeScore(0, 0, 0.2, false, true) <= gramHomeScore(5000, 50, 0.2, true, false) {
		t.Error("one's own photo, just posted, sits on top")
	}
	// In Explorer the popular win longer (lower gravity).
	old, fresh := gramExploreScore(3000, 20, 24), gramExploreScore(20, 0, 1)
	if old <= fresh {
		t.Errorf("Explorer: a day-old popular photo (%f) should beat a fresh quiet one (%f)", old, fresh)
	}
}

func TestGramNPCSlots(t *testing.T) {
	now := time.Date(2026, 10, 21, 15, 30, 0, 0, time.UTC)
	total := 0
	for _, n := range gramNPCs {
		a, b := gramNPCSlots(n, now, gramBackfillDays), gramNPCSlots(n, now, gramBackfillDays)
		if len(a) == 0 || len(a) != len(b) {
			t.Fatalf("%s: %d posts, then %d", n.ID, len(a), len(b))
		}
		seen := map[string]bool{}
		for i, p := range a {
			if p.Key != b[i].Key || p.Caption != b[i].Caption || p.Seed != b[i].Seed || !p.At.Equal(b[i].At) {
				t.Fatalf("%s: a slot isn't always the same post", n.ID)
			}
			if p.At.After(now) || now.Sub(p.At) > time.Duration(gramBackfillDays+2)*24*time.Hour {
				t.Errorf("%s: post at %v", n.ID, p.At)
			}
			if seen[p.Key] {
				t.Errorf("%s: key %s twice", n.ID, p.Key)
			}
			seen[p.Key] = true
			if _, ok := gramScenes[p.Scene]; !ok || p.Caption == "" || p.Place == "" {
				t.Errorf("%s: scene %q, caption %q, place %q", n.ID, p.Scene, p.Caption, p.Place)
			}
			if p.Likes <= 0 || p.Likes > p.Reach {
				t.Errorf("%s: %d likes for %d reached", n.ID, p.Likes, p.Reach)
			}
		}
		// An hour later, the same posts are still there (keys kept), but maybe the oldest.
		later := map[string]bool{}
		for _, p := range gramNPCSlots(n, now.Add(time.Hour), gramBackfillDays) {
			later[p.Key] = true
		}
		for _, p := range a[1:] {
			if !later[p.Key] {
				t.Errorf("%s: post %s gone an hour later", n.ID, p.Key)
			}
		}
		total += len(a)
	}
	if total < 40 {
		t.Errorf("only %d of the game's photos at launch: the feed would look empty", total)
	}
	for _, n := range gramNPCs {
		if _, ok := findGramNPC(n.ID); !ok || n.Fans <= 0 || len(n.Scenes) == 0 {
			t.Errorf("account %s", n.ID)
		}
	}
}

func TestGramComments(t *testing.T) {
	at := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	a, b := gramNPCCommentList(9, "maquis", 6, at), gramNPCCommentList(9, "maquis", 6, at)
	if len(a) != 6 || a[3].Body != b[3].Body || a[3].Handle != b[3].Handle {
		t.Error("a photo's audience comments are always the same")
	}
	if gramNPCComments(50) != 0 || gramNPCComments(10_000_000) != gramNPCMaxComments {
		t.Error("audience comments come with the reach, up to a cap")
	}
	if _, ok := world.FindPhoneApp("babigram"); !ok {
		t.Error("Babigram isn't in the Store")
	}
}
