package sims

import (
	"context"
	"slices"
	"testing"
	"time"
)

func TestParseMentions(t *testing.T) {
	cases := []struct {
		body string
		want []string
	}{
		{"salut @kofi_225 ça dit quoi", []string{"kofi_225"}},
		// Punctuation after the name: a full stop, a comma, an apostrophe, brackets.
		{"On se voit @Awa.", []string{"awa"}},
		{"@awa, @yao! (@ama_k) @bintou's", []string{"awa", "yao", "ama_k", "bintou"}},
		{"@kofi.k est là", []string{"kofi.k"}},
		// Case: the same player once, in lower case.
		{"@Kofi @KOFI @kofi", []string{"kofi"}},
		// An e-mail-like text is no mention.
		{"écris à awa@mail.ci ou yao@test", nil},
		{"é@kofi", nil},
		// Accents: a username has none, so « @Amélie » names nobody (not « am »).
		{"@Amélie viens", nil},
		{"bonjour @ kofi, @ab, @" + "abcdefghijklmnopqrstuvwxy", nil},
		// At most five.
		{"@aaa @bbb @ccc @ddd @eee @fff", []string{"aaa", "bbb", "ccc", "ddd", "eee"}},
		{"@aaa @aaa @bbb @ccc @ddd @eee @fff", []string{"aaa", "bbb", "ccc", "ddd", "eee"}},
		{"@@kofi", nil},
		{"(@yao)\n@ama", []string{"yao", "ama"}},
		{"🔥@yao", []string{"yao"}},
	}
	for _, c := range cases {
		if got := parseMentions(c.body); !slices.Equal(got, c.want) {
			t.Errorf("parseMentions(%q) = %v, want %v", c.body, got, c.want)
		}
	}
}

func TestMentionGate(t *testing.T) {
	var g mentionGate
	t0 := time.Date(2026, 11, 16, 12, 0, 0, 0, time.UTC)
	if !g.allow("a", "b", t0) {
		t.Fatal("the first ring goes")
	}
	if g.allow("a", "b", t0.Add(time.Minute)) {
		t.Error("the same sender to the same player a minute later: held")
	}
	if !g.allow("a", "c", t0.Add(time.Minute)) || !g.allow("c", "b", t0.Add(time.Minute)) {
		t.Error("another player, or another sender: goes")
	}
	if !g.allow("a", "b", t0.Add(mentionGap)) {
		t.Error("after the gap: goes again")
	}
	// The old pairs are forgotten on the way, the recent ones kept.
	for i := 0; i < 2100; i++ {
		g.allow("x", string(rune('A'+i%26))+time.Duration(i).String(), t0)
	}
	if g.allow("a", "b", t0.Add(mentionGap+time.Second)) {
		t.Error("held right after its last ring")
	}
	g.allow("y", "z", t0.Add(10*time.Minute))
	if len(g.last) > 10 {
		t.Errorf("old pairs kept: %d", len(g.last))
	}
}

func TestMentionQuery(t *testing.T) {
	for q, want := range map[string]string{"Kofi": "kofi", "ko_fi": `ko\_fi`, "a%b'": "ab", " yao. ": "yao."} {
		if got := mentionQuery(q); got != want {
			t.Errorf("mentionQuery(%q) = %q, want %q", q, got, want)
		}
	}
}

func TestResolveMentions(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	awa, koffi, yao := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi"), replySim(t, pool, "Yao")
	// Yao blocked Awa: never named by her.
	if _, err := pool.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2)`, yao, awa); err != nil {
		t.Fatal(err)
	}
	found, err := resolveMentions(ctx, pool, awa, parseMentions("@Koffi @awa @yao @personne"))
	if err != nil {
		t.Fatal(err)
	}
	if len(found) != 1 || found[0].Sim != koffi || found[0].Username != "koffi" || found[0].Commune != "cocody" {
		t.Fatalf("found %+v", found)
	}
	// Koffi is in Cocody: he reads Cocody's room and Tout Babi's (once Gbairai is his), not the Plateau's.
	if found[0].canReadRoom(ctx, "plateau") {
		t.Error("another commune's room")
	}
}
