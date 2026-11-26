package game

import "testing"

// The ocean crossing costs less per kilometre than the hops at home, and stays above them.
func TestFlightLongHaul(t *testing.T) {
	_, ouaga := FlightQuote(840)
	_, ny := FlightQuote(7900)
	if ouaga != 114000 {
		t.Errorf("Abidjan → Ouaga: %d F, want 114 000", ouaga)
	}
	if ny < 300000 || ny > 400000 {
		t.Errorf("Abidjan → New York: %d F, want between 300 000 and 400 000", ny)
	}
}
