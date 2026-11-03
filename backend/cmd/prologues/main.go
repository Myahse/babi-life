// Command prologues prints the stories' prologues (game/stories.go) as JSON,
// [{id, title, prologue}], for their narration (tools/voix/histoires.mjs); with -chapters, each story's
// giver and chapters too (what's asked, the thanks, the steps), for the chapters' films
// (tools/prologues/chapitres.py).
package main

import (
	"encoding/json"
	"flag"
	"os"

	"github.com/myahse/babi-life/backend/internal/game"
)

func main() {
	chapters := flag.Bool("chapters", false, "the givers and the chapters too")
	flag.Parse()
	type chapter struct {
		Ask    string            `json:"ask"`
		Thanks string            `json:"thanks"`
		Steps  []game.ErrandStep `json:"steps"`
	}
	type prologue struct {
		ID       string    `json:"id"`
		Title    string    `json:"title"`
		Prologue string    `json:"prologue"`
		Giver    string    `json:"giver,omitempty"`
		Chapters []chapter `json:"chapters,omitempty"`
	}
	out := make([]prologue, 0, len(game.Stories))
	for _, st := range game.Stories {
		p := prologue{ID: st.ID, Title: st.Title, Prologue: st.Prologue}
		if *chapters {
			p.Giver = st.Giver
			for _, c := range st.Chapters {
				p.Chapters = append(p.Chapters, chapter{c.Ask, c.Thanks, c.Steps})
			}
		}
		out = append(out, p)
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(out); err != nil {
		os.Exit(1)
	}
}
