package shop

import "testing"

func TestOperatorFee(t *testing.T) {
	for _, c := range []struct {
		op    string
		price int
		fee   int
	}{{"wave", 1000, 15}, {"orange_money", 1000, 35}, {"mtn_money", 999, 35}, {"moov_money", 2500, 88}, {"wave", 200, 3}} {
		o, ok := FindOperator(c.op)
		if !ok {
			t.Fatalf("%s: unknown", c.op)
		}
		if got := o.Fee(c.price); got != c.fee {
			t.Errorf("%s on %d F: fee %d, want %d", c.op, c.price, got, c.fee)
		}
	}
}
