package game

import "testing"

// The table's numbers: 0 to 36, about as often each, the same for a round every time.
func TestTableNumber(t *testing.T) {
	seen := make([]int, 37)
	for n := int64(0); n < 37000; n++ {
		x := TableNumber(n)
		if x < 0 || x > 36 {
			t.Fatalf("round %d: %d", n, x)
		}
		seen[x]++
	}
	for x, c := range seen {
		if c < 800 || c > 1200 {
			t.Errorf("%d came %d times in 37000", x, c)
		}
	}
	if TableNumber(12345) != TableNumber(12345) {
		t.Fatal("not the same twice")
	}
	if TableSpinAt(10) >= TableResultAt(10) || TableResultAt(10) >= TableSpinAt(11) {
		t.Fatal("phases out of order")
	}
}
