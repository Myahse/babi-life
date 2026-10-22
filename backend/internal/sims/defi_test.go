package sims

import "testing"

// Each défi is played during its own activities only.
func TestDefiOf(t *testing.T) {
	for id, want := range map[string]string{"street-the": "the", "chat-grin": "the", "ski-boulay": "ski", "supermarche": "courses", "courses": "courses", "shower": "", "chat-dance": ""} {
		if got := defiOf(id); got != want {
			t.Errorf("%s: %q, want %q", id, got, want)
		}
	}
}

// A better score earns more, and never much: a made-up score buys little.
func TestDefiReward(t *testing.T) {
	for _, kind := range []string{"the", "ski", "courses"} {
		low, lowBack, _ := defiReward(kind, 10, 8000)
		high, highBack, _ := defiReward(kind, 100, 8000)
		if low.Social+low.Fun+low.Hunger > high.Social+high.Fun+high.Hunger || lowBack > highBack {
			t.Errorf("%s: 10 earns more than 100", kind)
		}
		if high.Social > 15 || high.Fun > 20 || highBack > 8000/5 {
			t.Errorf("%s: too much for a perfect score: %+v, %d back", kind, high, highBack)
		}
	}
	// The money back on the shopping is a round sum, and only on the shopping.
	if _, back, _ := defiReward("courses", 87, 8000); back%50 != 0 || back == 0 {
		t.Errorf("courses: %d back", back)
	}
	if _, back, _ := defiReward("the", 100, 100); back != 0 {
		t.Errorf("the: %d back", back)
	}
}
