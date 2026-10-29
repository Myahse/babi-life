package sims

import (
	"context"
	"errors"
	"math/rand/v2"
	"strings"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// Who may text papa and maman: a child from 3 (and a teenager), not a baby, not a grown-up.
func TestWhoTextsParents(t *testing.T) {
	s := newSimPtr()
	s.GameMinutes = 100000
	s.BornAt = s.GameMinutes - 10 // a baby
	if err := s.canTextParents(); !errors.Is(err, errTooSmallText) {
		t.Errorf("a baby: %v", err)
	}
	s.BornAt = s.GameMinutes - game.MinutesToAge(3)
	if err := s.canTextParents(); err != nil {
		t.Errorf("a child of 3: %v", err)
	}
	s.BornAt = s.GameMinutes - game.MinutesToAge(15)
	if err := s.canTextParents(); err != nil {
		t.Errorf("a teenager: %v", err)
	}
	s.BornAt = s.GameMinutes - game.MinutesToAge(20)
	if err := s.canTextParents(); !errors.Is(err, errGrownText) {
		t.Errorf("an adult: %v", err)
	}
}

// Every canned line, said to a boy or a girl by papa or maman, is fit for a child, and
// its placeholders are all filled.
func TestCannedParentLinesFitForChild(t *testing.T) {
	all := [][]string{unfitLines, privateLines, worriedLines, stickerLines, lateLines, classLines, hungryLines, tiredLines, anyLines}
	for _, c := range cannedTopics {
		all = append(all, c.lines)
	}
	rng := rand.New(rand.NewPCG(1, 2))
	s := newSimPtr()
	for _, gender := range []string{"homme", "femme"} {
		s.Gender = gender
		for _, who := range []string{"papa", "maman"} {
			for _, lines := range all {
				for _, l := range lines {
					got := sayToChild(l, who, s, rng)
					if strings.ContainsAny(got, "{}") {
						t.Errorf("unfilled: %q", got)
					}
					if unfitForChild(got) {
						t.Errorf("not for a child: %q", got)
					}
					for _, w := range []string{"ton adresse", "ton numéro", "ton vrai nom", "envoie-moi", "envoie une photo", "en privé", "rencontr"} {
						if strings.Contains(strings.ToLower(got), w) {
							t.Errorf("asks for real life (%q): %q", w, got)
						}
					}
				}
			}
		}
	}
}

// The canned answers follow what the child wrote: a rude word gets a gentle word back,
// a worry comfort, a real-life question a warning; hunger, school, love get theirs.
func TestCannedParentAnswers(t *testing.T) {
	s := newSimPtr()
	s.Gender = "femme"
	s.GameMinutes = 3*24*60 + 15*60 // a Thursday, 15 h
	s.Needs = game.FreshNeeds()
	in := func(lines []string, said string) {
		t.Helper()
		got := cannedParent("maman", s, said, rand.New(rand.NewPCG(3, 4)))
		for _, l := range lines {
			if sayToChild(l, "maman", s, rand.New(rand.NewPCG(0, 0)))[:12] == got[:12] {
				return
			}
		}
		t.Errorf("%q → %q", said, got)
	}
	in(unfitLines, "t'es une CONNASSE")
	in(unfitLines, "je veux de la bière")
	in(worriedLines, "j'ai peur, je suis triste")
	in(privateLines, "c'est quoi ton numéro whatsapp ?")
	in(cannedTopics[0].lines, "Je t'aime maman")
	in(cannedTopics[1].lines, "Coucou !")
	in(cannedTopics[2].lines, "J'ai faim")
	in(cannedTopics[3].lines, "J'ai fini mes devoirs d'école")
	in(stickerLines, "(un sticker « on-dit-quoi »)")
	// Late at night, a word for bed.
	s.GameMinutes = 3*24*60 + 23*60
	got := cannedParent("papa", s, "blabla", rand.New(rand.NewPCG(5, 6)))
	if !strings.Contains(got, "lit") {
		t.Errorf("at 23 h: %q", got)
	}
}

// The same words over and over: never the same answer twice in a row.
func TestCannedParentNoRepeat(t *testing.T) {
	s := newSimPtr()
	s.Gender = "femme"
	s.GameMinutes = 3*24*60 + 15*60
	s.Needs = game.FreshNeeds()
	rng := rand.New(rand.NewPCG(1, 2))
	last := ""
	for i := range 200 {
		got := cannedParent("maman", s, "coucou", rng, last)
		if got == last {
			t.Fatalf("draw %d: %q twice in a row", i, got)
		}
		last = got
	}
}

// A child of 3 writes to maman and gets an answer (canned, no model here); a baby can't.
// Without « gbairai-bebe », the same child can't write to another player.
func TestChildTextsParents(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	kid := replySim(t, pool, "Awa")
	now := game.MinuteOf(time.Now())
	if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = $2, game_minutes = $3 WHERE id = $1`, kid, now-game.MinutesToAge(3), now); err != nil {
		t.Fatal(err)
	}
	s, err := scanSim(pool.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1`, kid))
	if err != nil {
		t.Fatal(err)
	}
	if s.age() != 3 || s.canTextParents() != nil {
		t.Fatalf("age %d: %v", s.age(), s.canTextParents())
	}
	if _, err := pool.Exec(ctx, `INSERT INTO parent_messages (sim_id, parent, mine, body) VALUES ($1, 'maman', true, 'Maman j''ai faim')`, kid); err != nil {
		t.Fatal(err)
	}
	h := &Handler{DB: pool}
	text, err := h.parentAnswer(ctx, &s, "maman", "u")
	if err != nil || text == "" || unfitForChild(text) {
		t.Fatalf("answer: %q %v", text, err)
	}
	if err := saveParentAnswer(ctx, pool, kid, "maman", text); err != nil {
		t.Fatal(err)
	}
	msgs, err := parentMessages(ctx, pool, kid, "maman", 0, 60)
	if err != nil || len(msgs) != 2 || !msgs[0].Mine || msgs[0].ReadAt == nil || msgs[1].Mine || msgs[1].Body != text {
		t.Fatalf("thread: %+v %v", msgs, err)
	}
	// Answered already: nothing more to say until the child writes again.
	if again, _ := h.parentAnswer(ctx, &s, "maman", "u"); again != "" {
		t.Errorf("answered twice: %q", again)
	}
	// Papa's thread is apart.
	if p, _ := parentMessages(ctx, pool, kid, "papa", 0, 60); len(p) != 0 {
		t.Errorf("papa's: %+v", p)
	}

	// A baby can't.
	baby := s
	baby.BornAt = s.GameMinutes - 5
	if err := baby.canTextParents(); err == nil {
		t.Error("a baby texting")
	}

	// The updates as the admin set them: all closed in a fresh database.
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	if parentsOpen(ctx) {
		t.Error("gbairai-parents should ship closed")
	}
	if err := friendsGbairai(ctx, &s); !errors.Is(err, errNoPhoneYet) {
		t.Errorf("a child writing to a player, « gbairai-bebe » closed: %v", err)
	}
	if err := features.Default.Set(ctx, "gbairai-bebe", true, nil); err != nil {
		t.Fatal(err)
	}
	if err := friendsGbairai(ctx, &s); err != nil {
		t.Errorf("« gbairai-bebe » open: %v", err)
	}
}
