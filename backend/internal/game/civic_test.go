package game

import (
	"testing"
	"time"
)

// The week: one stands from the Monday, campaigns from Friday 18 h, votes on Sunday, hears the results on Monday at 9 h.
func TestElectionWeek(t *testing.T) {
	at := func(s string) time.Time {
		x, err := time.Parse("2006-01-02 15:04", s)
		if err != nil {
			t.Fatal(err)
		}
		return x
	}
	cases := []struct{ now, campaign, votes, closes, results string }{
		// A Tuesday: this week's.
		{"2026-10-27 10:00", "2026-10-30 18:00", "2026-11-01 00:00", "2026-11-02 00:00", "2026-11-02 09:00"},
		// Monday at 9 h, the results just out: the next week's.
		{"2026-10-26 09:00", "2026-10-30 18:00", "2026-11-01 00:00", "2026-11-02 00:00", "2026-11-02 09:00"},
		// Saturday noon: the vote would open in 12 h, too soon to stand: the week after.
		{"2026-10-31 12:00", "2026-11-06 18:00", "2026-11-08 00:00", "2026-11-09 00:00", "2026-11-09 09:00"},
		// Monday at 8 h, the vote over: the week after.
		{"2026-10-26 08:00", "2026-10-30 18:00", "2026-11-01 00:00", "2026-11-02 00:00", "2026-11-02 09:00"},
	}
	for _, c := range cases {
		campaign, votes, closes, results := ElectionWeek(at(c.now))
		if !campaign.Equal(at(c.campaign)) || !votes.Equal(at(c.votes)) || !closes.Equal(at(c.closes)) || !results.Equal(at(c.results)) {
			t.Errorf("from %s: %v %v %v %v", c.now, campaign, votes, closes, results)
		}
		if results.Weekday() != time.Monday || campaign.Weekday() != time.Friday || votes.Weekday() != time.Sunday {
			t.Errorf("from %s: the days", c.now)
		}
	}
}

// The measures: their share off at their places, the fares, nothing elsewhere.
func TestMeasures(t *testing.T) {
	on := []string{"marche", "transport"}
	if off := MeasureOff(on, "maquis"); off != 0.25 {
		t.Errorf("maquis: %v", off)
	}
	if off := MeasureOff(on, "cinema"); off != 0 {
		t.Errorf("cinema: %v", off)
	}
	if FareOff(on) != 0.5 || FareOff([]string{"sante"}) != 0 {
		t.Error("fares")
	}
	if Discounted(3500, 0.25) != 2625 || Discounted(500, 0.5) != 250 || Discounted(-4000, 0.5) != -4000 || Discounted(1000, 0) != 1000 {
		t.Errorf("discounts: %d %d", Discounted(3500, 0.25), Discounted(500, 0.5))
	}
	for _, m := range Measures {
		if m.Off <= 0 || m.Off > 0.5 || (len(m.Kinds) == 0 && !m.Fares) {
			t.Errorf("%s: %+v", m.ID, m)
		}
		for _, k := range m.Kinds {
			if _, ok := Kinds[k]; !ok {
				t.Errorf("%s: no place kind %q", m.ID, k)
			}
		}
	}
	// The street's and the stadium's interactions are there.
	for kind, id := range map[string]string{"maquis": CampaignTourID, "market": MilitantID, "mairie": CampaignTourID, StadiumKind: FeteID} {
		if _, ok := Kinds[kind].Interaction(id); !ok {
			t.Errorf("%s: no %s", kind, id)
		}
	}
}
