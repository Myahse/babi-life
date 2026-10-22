package sims

import (
	"strings"
	"testing"
)

func TestTicketRef(t *testing.T) {
	for _, id := range []int64{0, 1, 25, 26, 12345678, 9876543210} {
		ref := TicketRef("bet", id)
		// A message carries it whole: no digits for the phone mask, no dots for the link one.
		if said, err := cleanMessage(ref); err != nil || said != ref {
			t.Fatalf("%d: %q became %q (%v)", id, ref, said, err)
		}
		parts := strings.Split(strings.Trim(ref, "[]"), ":")
		if got, ok := ticketID(parts[1], parts[2], parts[3]); !ok || got != id {
			t.Errorf("%d: read back %d %v", id, got, ok)
		}
		// Another ticket's signature, or another kind: not opened.
		if _, ok := ticketID("loto", parts[2], parts[3]); ok {
			t.Errorf("%d: a bet's signature opens a loto ticket", id)
		}
		if _, ok := ticketID("bet", letters(id+1), parts[3]); ok {
			t.Errorf("%d: the next ticket opens with this signature", id)
		}
	}
	if _, ok := unletters("ab1"); ok {
		t.Error("digits read as letters")
	}
}
