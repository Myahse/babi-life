package ideas

import "testing"

func TestTopicsAndStatuses(t *testing.T) {
	for _, s := range []string{"new", "read", "kept", "done", "no"} {
		if !Statuses[s] {
			t.Errorf("status %q unknown", s)
		}
	}
	if Statuses["open"] || Statuses[""] {
		t.Error("open and empty are filters, not statuses")
	}
	for _, s := range []string{"jeu", "lieu", "bug", "autre"} {
		if !Topics[s] {
			t.Errorf("topic %q unknown", s)
		}
	}
}
