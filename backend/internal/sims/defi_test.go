package sims

import "testing"

// Each défi is played during its own activities only.
func TestDefiOf(t *testing.T) {
	for id, want := range map[string]string{"street-grin": "the", "street-the": "", "chat-grin": "the", "ski-boulay": "ski", "supermarche": "courses", "courses": "courses", "shower": "", "chat-dance": "",
		"console-foot": "foot", "console-defi": "foot", "tournoi-console": "foot", "console-course": "course", "console-combat": "combat", "borne-arcade": "arcade", "regarder-console": ""} {
		if got := defiOf(id); got != want {
			t.Errorf("%s: %q, want %q", id, got, want)
		}
	}
}

// A better score earns more, and never much: a made-up score buys little.
func TestDefiReward(t *testing.T) {
	for _, kind := range []string{"the", "ski", "courses", "foot", "course", "combat", "arcade"} {
		low, lowBack, _ := defiReward(kind, "", 10, 8000)
		high, highBack, _ := defiReward(kind, "", 100, 8000)
		if low.Social+low.Fun+low.Hunger > high.Social+high.Fun+high.Hunger || lowBack > highBack {
			t.Errorf("%s: 10 earns more than 100", kind)
		}
		if high.Social > 15 || high.Fun > 20 || highBack > 8000/5 {
			t.Errorf("%s: too much for a perfect score: %+v, %d back", kind, high, highBack)
		}
	}
	// The money back on the shopping is a round sum, and only on the shopping.
	if _, back, _ := defiReward("courses", "", 87, 8000); back%50 != 0 || back == 0 {
		t.Errorf("courses: %d back", back)
	}
	if _, back, _ := defiReward("the", "", 100, 100); back != 0 {
		t.Errorf("the: %d back", back)
	}
}

// The challenge where the loser pays: won, both stakes; level, one's own back; lost, nothing.
// The tournament: the cup and the final paid, the rest not; a plain match pays nothing.
func TestDefiStakes(t *testing.T) {
	for _, c := range []struct {
		id          string
		score, back int
	}{
		{"console-defi", 75, 800}, {"console-defi", 50, 400}, {"console-defi", 30, 0},
		{"tournoi-console", 100, tournamentWin}, {"tournoi-console", 70, tournamentFinal}, {"tournoi-console", 40, 0}, {"tournoi-console", 5, 0},
		{"console-foot", 100, 0},
	} {
		cost := 400
		if c.id == "tournoi-console" {
			cost = 1000
		}
		if _, back, text := defiReward("foot", c.id, c.score, cost); back != c.back || text == "" {
			t.Errorf("%s at %d: %d back (%q), want %d", c.id, c.score, back, text, c.back)
		}
	}
}
