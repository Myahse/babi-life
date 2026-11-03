package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The quartier's stories (game/stories.go, the update « histoires », shown
// with the demandes): the Sim's story under way, kept in sim_stories, its
// chapter moved on as the Sim finishes what it asks (storyAfter, with the
// demandes in errandsAfter). A chapter done, the next waits for tomorrow. With
// no story under way, the player picks the next among a few (StoryChoices,
// POST /sims/{id}/histoires), and it begins the day after the last one ended.

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

// storyState: where the Sim is in the stories: the one under way, those begun
// (all done when none is under way), and the first day a new one may start
// (the day after the last chapter done).
type storyState struct {
	on       *storyRow
	seen     map[string]bool
	startDay int64
}

// storyNow: the Sim's stories as they stand on `day`.
func storyNow(ctx context.Context, db errandDB, sim string, day int64) (storyState, error) {
	st := storyState{seen: map[string]bool{}, startDay: day}
	rows, err := db.Query(ctx, `SELECT story_id, chapter, step, ready_day, done_at IS NOT NULL FROM sim_stories WHERE sim_id = $1`, sim)
	if err != nil {
		return st, err
	}
	defer rows.Close()
	for rows.Next() {
		var r storyRow
		var done bool
		if err := rows.Scan(&r.id, &r.chapter, &r.step, &r.readyDay, &done); err != nil {
			return st, err
		}
		st.seen[r.id] = true
		if done {
			st.startDay = max(st.startDay, r.readyDay)
		} else if story, ok := game.FindStory(r.id); ok && r.chapter < len(story.Chapters) && st.on == nil {
			r.story = story
			st.on = &r
		}
	}
	return st, rows.Err()
}

// StoryChoicesShown: how many stories the player picks from.
const StoryChoicesShown = 3

// storyOffer: a story the player may pick: who, what it starts with, how long,
// whether it goes away (the cities' names) or is for adults.
type storyOffer struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Giver    string   `json:"giver"`
	Role     string   `json:"role"`
	Gender   string   `json:"gender"`
	Chapters int      `json:"chapters"`
	Prologue string   `json:"prologue"`
	Teaser   string   `json:"teaser"`
	Trips    []string `json:"trips,omitempty"`
	Adults   bool     `json:"adults,omitempty"`
}

// choices: the stories the Sim may pick from now.
func (st storyState) choices(commune, stage string) []game.Story {
	if st.on != nil {
		return nil
	}
	return game.StoryChoices(st.seen, stage, storyKinds(commune, stage, travelOpen()), StoryChoicesShown)
}

// offer: a story as the choice shows it.
func offer(s game.Story) storyOffer {
	o := storyOffer{ID: s.ID, Title: s.Title, Giver: s.Giver, Role: s.Role, Gender: s.Gender, Chapters: len(s.Chapters), Prologue: s.Prologue, Teaser: s.Chapters[0].Ask, Adults: s.Adults}
	for _, c := range s.Chapters {
		for _, step := range c.Steps {
			if step.City == "" || step.City == "abidjan" {
				continue
			}
			if city, ok := world.FindCity(step.City); ok && !slices.Contains(o.Trips, city.Name) {
				o.Trips = append(o.Trips, city.Name)
			}
		}
	}
	return o
}

// storyPayload: what the phone shows of the stories: the one under way, or the choice.
func storyPayload(st storyState, commune, stage string, day int64) map[string]any {
	out := map[string]any{"story": nil}
	if st.on != nil {
		out["story"] = st.on.view(day)
		return out
	}
	offers := []storyOffer{}
	for _, s := range st.choices(commune, stage) {
		offers = append(offers, offer(s))
	}
	out["choices"] = offers
	out["startsTomorrow"] = st.startDay > day
	return out
}

var errStoryPick = errors.New("cette histoire n'est pas proposée")

// storyPick: POST /sims/{id}/histoires {story}: the player begins one of the stories offered.
func (h *Handler) storyPick(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !storiesOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	var req struct {
		Story string `json:"story"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	var born, minutes int64
	var commune string
	id := chi.URLParam(r, "id")
	// The Sim locked: two picks at once can't both begin a story.
	if err := tx.QueryRow(ctx, `SELECT born_at, home_commune, game_minutes FROM sims WHERE id = $1 AND user_id = $2 FOR UPDATE`, id, auth.UserID(ctx)).Scan(&born, &commune, &minutes); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	now := time.Now()
	day, stage := errandDay(now), errandStage(born, now)
	st, err := storyNow(ctx, tx, id, day)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if !slices.ContainsFunc(st.choices(commune, stage), func(s game.Story) bool { return s.ID == req.Story }) {
		httpx.Error(w, http.StatusUnprocessableEntity, errStoryPick.Error())
		return
	}
	if _, err := tx.Exec(ctx, `INSERT INTO sim_stories (sim_id, story_id, ready_day) VALUES ($1, $2, $3)`, id, req.Story, st.startDay); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	// Its prologue in the journal, to read again later.
	picked, _ := game.FindStory(req.Story)
	if err := insertEvent(ctx, tx, id, "errand", fmt.Sprintf("Nouvelle histoire : « %s ». %s", picked.Title, picked.Prologue), 0, minutes); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if st, err = storyNow(ctx, tx, id, day); err != nil || tx.Commit(ctx) != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, storyPayload(st, commune, stage, day))
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
	st, err := storyNow(ctx, tx, s.ID, day)
	r := st.on
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
		// The next story is the player's pick, among those offered (it begins tomorrow).
		text = fmt.Sprintf("Fin de l'histoire « %s ». %s Une nouvelle histoire t'attend dans « Demandes ».", r.story.Title, text)
	}
	text = capNote(text, game.FromStory, got, c.Reward)
	return []Event{{Kind: "errand", Text: text, Money: got, GameTime: s.GameMinutes}}, nil
}

// errEpreuveNot: a story's épreuve asked for while the story isn't at it.
var errEpreuveNot = errors.New("cette épreuve vient avec son histoire : ce n'est pas encore le moment")

// epreuveNow: whether the Sim's story under way is at that épreuve (its chapter's step today).
func epreuveNow(ctx context.Context, tx pgx.Tx, sim, id string) error {
	day := errandDay(time.Now())
	st, err := storyNow(ctx, tx, sim, day)
	if err != nil {
		return err
	}
	r := st.on
	if r == nil || r.readyDay > day || r.step >= len(r.story.Chapters[r.chapter].Steps) || !slices.Contains(r.story.Chapters[r.chapter].Steps[r.step].Do, id) {
		return errEpreuveNot
	}
	return nil
}
