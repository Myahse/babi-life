package game

import (
	"strings"
	"testing"
)

func TestStadiumAgenda(t *testing.T) {
	// A week from a Monday: two matches, two concerts, in order, on their days.
	w := int64(100) * week
	ev := StadiumAgenda("plateau-stade", w, w, w+week)
	if len(ev) != 4 {
		t.Fatalf("%d events in a week, want 4", len(ev))
	}
	for i, e := range ev {
		if i > 0 && e.Start <= ev[i-1].Start {
			t.Errorf("not in order: %v", ev)
		}
		if e.Kind == "match" && (e.Home == e.Away || e.Home == "" || e.Away == "") {
			t.Errorf("match %q", e.Title)
		}
	}
	if d := WeekdayOf(ev[0].Start); d != 2 || HourOf(ev[0].Start) != 19 {
		t.Errorf("first is day %d %dh, want Wednesday 19h", d, HourOf(ev[0].Start))
	}
	// Sunday is gospel.
	if ev[3].Genre != "gospel" {
		t.Errorf("Sunday concert is %s", ev[3].Genre)
	}
	// The same for everyone.
	if again := StadiumAgenda("plateau-stade", w, w, w+week); again[1].Title != ev[1].Title {
		t.Error("the agenda changes between calls")
	}
}

func TestAtStadium(t *testing.T) {
	w := int64(100) * week
	match := Kinds[StadiumKind].Interactions[0]
	sat := w + 5*24*60 + 16*60 // Saturday kick-off
	// The doors are open an hour before; the match lasts till its end.
	it, err := AtStadium("plateau-stade", match, sat-30)
	if err != nil || it.Minutes != 150 || !strings.Contains(it.Label, " – ") {
		t.Fatalf("at the doors: %v %d %q", err, it.Minutes, it.Label)
	}
	// Tuesday: no match, and it says when the next is.
	if _, err := AtStadium("plateau-stade", match, w+24*60+12*60); err == nil || !strings.Contains(err.Error(), "mercredi 19 h") {
		t.Errorf("Tuesday: %v", err)
	}
	// No concert during the match.
	if _, err := AtStadium("plateau-stade", Kinds[StadiumKind].Interactions[1], sat+10); err == nil {
		t.Error("a concert during the match")
	}
	// The score: none before, then it only goes up.
	e, _ := StadiumEventAt("plateau-stade", sat+10)
	if s := withScore(e, sat-1).Score; s != "" {
		t.Errorf("score before kick-off: %q", s)
	}
	h, a := MatchGoals(e)
	if end := withScore(e, e.End).Score; end != strings.Join([]string{itoa(len(h)), itoa(len(a))}, " – ") {
		t.Errorf("final score %q, goals %v %v", end, h, a)
	}
}

func itoa(n int) string { return string(rune('0' + n)) }
