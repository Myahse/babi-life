// Command prologues prints the stories' prologues (game/stories.go) as JSON,
// [{id, title, prologue}], for their narration (tools/voix/histoires.mjs).
package main

import (
	"encoding/json"
	"os"

	"github.com/myahse/babi-life/backend/internal/game"
)

func main() {
	type prologue struct {
		ID       string `json:"id"`
		Title    string `json:"title"`
		Prologue string `json:"prologue"`
	}
	out := make([]prologue, 0, len(game.Stories))
	for _, st := range game.Stories {
		out = append(out, prologue{st.ID, st.Title, st.Prologue})
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(out); err != nil {
		os.Exit(1)
	}
}
