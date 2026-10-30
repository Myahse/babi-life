package extract

import (
	"encoding/json"
	"os"
	"sort"
	"testing"
)

// The server's French with no English yet: counted (go run ./cmd/i18n -todo lists them).
// It doesn't fail: a new text in French waits for its English, the game says it in French meanwhile.
func TestCatalogueCoverage(t *testing.T) {
	lits, err := Literals("../..")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../en.json")
	if err != nil {
		t.Fatal(err)
	}
	cat := map[string]string{}
	if err := json.Unmarshal(raw, &cat); err != nil {
		t.Fatalf("en.json: %v", err)
	}
	var missing []string
	for s := range lits {
		if cat[s] == "" {
			missing = append(missing, s)
		}
	}
	sort.Strings(missing)
	t.Logf("i18n (server): %d strings, %d still in French only", len(lits), len(missing))
	for i, s := range missing {
		if i == 10 {
			break
		}
		t.Logf("  no English: %q", s)
	}
}
