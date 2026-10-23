package sims

import "testing"

func TestStayRefund(t *testing.T) {
	day := int64(24 * 60)
	// Three nights at 30 000: freed at the start of the second, the last two paid back.
	st := &Stay{Kind: "hotel", From: 0, Until: 3 * day, Paid: 30000}
	if got := stayRefund(st, day); got != 20000 {
		t.Errorf("two whole nights left: %d back, want 20 000", got)
	}
	// Half way through the last night, or a few hours' room: nothing.
	if got := stayRefund(st, 2*day+day/2); got != 0 {
		t.Errorf("the night under way is owed: %d back", got)
	}
	if got := stayRefund(&Stay{Kind: "hotel", From: 0, Until: 180, Paid: 8000}, 30); got != 0 {
		t.Errorf("hours: %d back", got)
	}
	// A home on Dodo: its host was paid, nothing back.
	if got := stayRefund(&Stay{Kind: "dodo", From: 0, Until: 3 * day, Paid: 30000}, 0); got != 0 {
		t.Errorf("Dodo: %d back", got)
	}
}
