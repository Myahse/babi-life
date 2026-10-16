package sims

import "testing"

func TestRobbery(t *testing.T) {
	s := &Sim{Money: 20000, GameMinutes: 3 * 24 * 60}
	text, amount := robbery(s, "nouchi:yop:1:2", -1)
	if amount < 500 || amount > 5000 || amount%500 != 0 || text == "" {
		t.Fatalf("robbery took %d (%q)", amount, text)
	}
	if _, again := robbery(s, "nouchi:yop:1:2", -1); again != amount {
		t.Fatalf("same spot, same day: %d then %d", amount, again)
	}
	if _, n := robbery(s, "nouchi:yop:1:2", s.GameMinutes-60); n != 0 {
		t.Fatalf("robbed again an hour later: %d", n)
	}
	if _, n := robbery(&Sim{Money: 50}, "nouchi:a", -1); n != 0 {
		t.Fatalf("empty pockets gave %d", n)
	}
	if _, n := robbery(&Sim{Money: 700, GameMinutes: 1}, "nouchi:b", -1); n > 700 {
		t.Fatalf("took more than there is: %d", n)
	}
	if _, n := robbery(&Sim{Money: 9000, Gang: "member"}, "nouchi:c", -1); n != 0 {
		t.Fatalf("robbed a gang member: %d", n)
	}
}
