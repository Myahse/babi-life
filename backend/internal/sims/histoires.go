package sims

import (
	"context"
	"fmt"
	"slices"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The quartier's stories (game/stories.go, the update « histoires », shown
// with the demandes): the Sim's story under way, kept in sim_stories, its
// chapter moved on as the Sim finishes what it asks (storyAfter, with the
// demandes in errandsAfter). A chapter done, the next waits for tomorrow; the
// last done, the next story begins the day after.

// storyView: the story under way as the phone shows it: the chapter to do (or
// done today, the next one tomorrow), its steps and the step it's at.
type storyView struct {
	game.Story
	Chapter  int               `json:"chapter"`
	Chapters int               `json:"chapters"`
	Ask      string            `json:"ask"`
	Steps    []game.ErrandStep `json:"steps"`
	Step     int               `json:"step"`
	Reward   int               `json:"reward"`
	// Waiting: today's chapter done, the next tomorrow; Said: what was said at its end.
	Waiting bool   `json:"waiting"`
	Said    string `json:"said,omitempty"`
}

// storiesOpen: the stories come with the demandes, each its own update.
func storiesOpen(ctx context.Context) bool {
	return errandsOpen(ctx) && features.Default.BlocksKey(ctx, game.StoriesKey) == ""
}

// storyRow: where the Sim is in a story.
type storyRow struct {
	id            string
	chapter, step int
	readyDay      int64
	story         game.Story
}

// storyNow: the Sim's story under way, the next one begun (from `day`) when none is.
func storyNow(ctx context.Context, db errandDB, sim, commune, stage string, day int64) (*storyRow, error) {
	rows, err := db.Query(ctx, `SELECT story_id, chapter, step, ready_day, done_at IS NOT NULL FROM sim_stories WHERE sim_id = $1`, sim)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var on *storyRow
	for rows.Next() {
		var r storyRow
		var done bool
		if err := rows.Scan(&r.id, &r.chapter, &r.step, &r.readyDay, &done); err != nil {
			rows.Close()
			return nil, err
		}
		seen[r.id] = true
		if st, ok := game.FindStory(r.id); ok && !done && r.chapter < len(st.Chapters) && on == nil {
			r.story = st
			on = &r
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil || on != nil {
		return on, err
	}
	st, ok := game.NextStory(seen, stage, storyKinds(commune, stage, travelOpen()))
	if !ok {
		return nil, nil
	}
	if _, err := db.Exec(ctx, `INSERT INTO sim_stories (sim_id, story_id, ready_day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, sim, st.ID, day); err != nil {
		return nil, err
	}
	return &storyRow{id: st.ID, readyDay: day, story: st}, nil
}

// storyKinds: the kinds of place a Sim can reach for a story: its commune's, its
// own city's as « city/kind » (the airport, the commissariat: a taxi away), and
// while trips between cities are open (game.TravelKey), every other city's (a
// story that goes to Man waits until one can go there). A child doesn't take
// the road alone (leaveWith): its commune's places only.
func storyKinds(commune, stage string, travel bool) map[string]bool {
	kinds := world.KindsIn(commune)
	if stage == game.StageBebe || stage == game.StageEnfant {
		return kinds
	}
	for _, c := range world.Cities {
		home := slices.ContainsFunc(c.Communes, func(cm world.Commune) bool { return cm.ID == commune })
		if !home && !travel {
			continue
		}
		for _, cm := range c.Communes {
			for k := range world.KindsIn(cm.ID) {
				kinds[c.ID+"/"+k] = true
			}
		}
	}
	return kinds
}

// view: the story as the phone shows it on `day`.
func (r *storyRow) view(day int64) storyView {
	c := r.story.Chapters[r.chapter]
	v := storyView{Story: r.story, Chapter: r.chapter, Chapters: len(r.story.Chapters), Ask: c.Ask, Steps: c.Steps, Step: r.step, Reward: c.Reward}
	if r.readyDay > day {
		v.Waiting = true
		if r.chapter > 0 {
			v.Said = r.story.Chapters[r.chapter-1].Thanks
		}
	}
	return v
}

// storyAfter: the activities just finished move the story's chapter on; a
// chapter done pays (within the day's FromStory), the next waits for tomorrow.
func (s *Sim) storyAfter(ctx context.Context, tx pgx.Tx, ended []*tally, day int64) ([]Event, error) {
	r, err := storyNow(ctx, tx, s.ID, s.HomeCommune, s.stage().ID, day)
	if err != nil || r == nil || r.readyDay > day {
		return nil, err
	}
	c := r.story.Chapters[r.chapter]
	step := r.step
	for _, d := range ended {
		if step < len(c.Steps) && c.Steps[step].Counts(d.kind, d.id, d.city) {
			step++
		}
	}
	if step == r.step {
		return nil, nil
	}
	if step < len(c.Steps) {
		if _, err := tx.Exec(ctx, `UPDATE sim_stories SET step = $3 WHERE sim_id = $1 AND story_id = $2`, s.ID, r.id, step); err != nil {
			return nil, err
		}
		// A twist on the way (what they say then), or just the next step.
		if said := c.Steps[step-1].Said; said != "" {
			return []Event{{Kind: "errand", Text: fmt.Sprintf("%s : « %s » Ensuite : %s.", r.story.Giver, said, c.Steps[step].Text), GameTime: s.GameMinutes}}, nil
		}
		return []Event{{Kind: "errand", Text: fmt.Sprintf("%s : étape faite. Ensuite : %s.", r.story.Giver, c.Steps[step].Text), GameTime: s.GameMinutes}}, nil
	}
	last := r.chapter == len(r.story.Chapters)-1
	if _, err := tx.Exec(ctx, `UPDATE sim_stories SET chapter = chapter + 1, step = 0, ready_day = $3, done_at = CASE WHEN $4 THEN now() END WHERE sim_id = $1 AND story_id = $2`, s.ID, r.id, day+1, last); err != nil {
		return nil, err
	}
	s.Needs = s.Needs.Add(r.story.Effect)
	got := s.earn(game.FromStory, c.Reward)
	text := fmt.Sprintf("%s : « %s »", r.story.Giver, c.Thanks)
	if last {
		text = fmt.Sprintf("Fin de l'histoire « %s ». %s", r.story.Title, text)
		// The next story, from tomorrow (its first chapter waits like a chapter would).
		if _, err := storyNow(ctx, tx, s.ID, s.HomeCommune, s.stage().ID, day+1); err != nil {
			return nil, err
		}
	}
	text = capNote(text, game.FromStory, got, c.Reward)
	return []Event{{Kind: "errand", Text: text, Money: got, GameTime: s.GameMinutes}}, nil
}
