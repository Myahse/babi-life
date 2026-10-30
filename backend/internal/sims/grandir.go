package sims

import (
	"context"
	"fmt"
	"net/http"
	"slices"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Growing up by milestones (the update « grandir-par-etapes », web
// components/Firsts.tsx and GrowUpParty.tsx). Closed, childhood lasts the time
// played (game.GrowUp). Open, the clock no longer makes the baby a child nor
// the child a teenager: the baby waits at the edge of babyhood until its
// « premières fois » (firsts.go) are all done, the child at the edge of
// childhood until its « étapes » are; then it grows up at once, on the server
// (settleGrowth), and the app throws the party. From the teenager on, nothing
// changes. The shop's « tout de suite » still skips what's left. The étapes are
// recorded even while the update is closed, so a child already on its way
// keeps what it did; nobody ever grows younger.

// stepsOpen: the milestone childhood is on. No store (tests, a database-less run): off, the timed childhood.
var stepsOpen = func(ctx context.Context) bool {
	return features.Default != nil && features.Default.BlocksKey(ctx, "grandir-par-etapes") == ""
}

// firstsOn: the « premières fois » are recorded (their own update, or the milestone childhood that needs them).
func firstsOn(ctx context.Context) bool {
	return features.Default.BlocksKey(ctx, "premieres-fois") == "" || stepsOpen(ctx)
}

// Step is one of a child's « étapes ».
type Step struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	// How and Where: what brings it, and where it's done (said in the list, so nobody is stuck).
	How   string `json:"how"`
	Where string `json:"where"`
	// Line: what the journal says when it comes.
	Line string `json:"-"`
	// by: the interactions that bring it when started (the others come from the day: the homework done,
	// the friend made, the birthday).
	by []string
}

// Steps: a child's « étapes », all within its commune (a child doesn't travel alone) and most of them at home.
var Steps = []Step{
	{ID: "ecole", Label: "Le premier jour d'école", Icon: "graduation-cap", How: "« Aller à l'école »", Where: "Chez toi, en semaine, de 7 h à 9 h", Line: "Premier jour d'école : le cartable sur le dos, l'uniforme tout neuf. Maman prend une photo à la porte.", by: []string{"aller-ecole"}},
	{ID: "note", Label: "Une bonne note en classe", Icon: "notebook-pen", How: "« Faire ses devoirs » jusqu'au bout, ou bien répondre en classe (« Lever la main »)", Where: "Chez toi, de 14 h à 21 h ; ou à l'école", Line: "Une bonne note ! « Très bien », écrit en rouge sur le cahier : papa le montre à toute la cour."},
	{ID: "ami", Label: "Un copain à la récré", Icon: "users", How: "Aller à l'école (ou à la crèche, bébé) : à la récré, on se fait un copain", Where: "À l'école, en semaine", Line: "Un copain à la récré : on partage le goûter, on se donne rendez-vous demain sous le manguier."},
	{ID: "sport", Label: "Le premier match", Icon: "volleyball", How: "« Jouer dans la cour », ou au foot, au basket", Where: "Chez toi, dans la cour ; ou au terrain du quartier", Line: "Premier match ! Les buts en tongs, le ballon qui file, les copains qui crient ton nom.", by: []string{"jouer-cour", "play-football", "play-basket", "foot-plage", "play-foot11", "stade-footing"}},
	{ID: "aider", Label: "Aider à la maison", Icon: "cooking-pot", How: "« Aider maman à la cuisine »", Where: "Chez toi, à la cuisine", Line: "Aider à la maison : maman te laisse remuer la sauce graine. « Mon grand ! »", by: []string{"aider-maison"}},
	{ID: "anniv", Label: "Un anniversaire", Icon: "cake", How: "Il arrive tout seul en jouant : 4 ans", Where: "Partout", Line: "Un anniversaire ! Le gâteau, les bougies, les copains du quartier qui chantent."},
}

// stepAge: the birthday that is a child's étape.
const stepAge = 4

// holdAt: the most minutes since birth a Sim may have at this point of childhood (since: its minutes now):
// just short of the next stage for a baby and a child, 0 (no limit) from the teenager on.
func holdAt(since int64) int64 {
	for _, next := range []string{game.StageEnfant, game.StageAdo} {
		if edge := game.MinutesToAge(float64(game.StageByID(next).From)); since < edge {
			return edge - 1
		}
	}
	return 0
}

// growHold: the hold the app applies to its own clock (Sim.GrowHold), 0 when none.
func (s *Sim) growHold(ctx context.Context) int64 {
	if s.BornAt == 0 || !stepsOpen(ctx) {
		return 0
	}
	return holdAt(s.GameMinutes - s.BornAt)
}

// holdChildhood: time going by from `from` to `to`, the baby and the child stop at the edge of their stage
// (their birth date moves with the time instead), the milestones not done.
func (s *Sim) holdChildhood(from, to int64) {
	if s.BornAt == 0 || !stepsOpen(context.Background()) {
		return
	}
	if limit := holdAt(from - s.BornAt); limit > 0 && to-s.BornAt > limit {
		if s.BornAt = to - limit; s.BornAt == 0 {
			s.BornAt = -1 // 0 means "no birth date"
		}
	}
}

// reach: a child's étape reached this turn, recorded by settleGrowth.
func (s *Sim) reach(id string) {
	if s.BornAt != 0 && s.stage().ID == game.StageEnfant && !slices.Contains(s.reached, id) {
		s.reached = append(s.reached, id)
	}
}

// reachBy: the étapes an interaction brings when it starts.
func (s *Sim) reachBy(interaction string) {
	for _, st := range Steps {
		if slices.Contains(st.by, interaction) {
			s.reach(st.ID)
		}
	}
	// Without the friend from childhood (its update closed), the first day at school brings the copain.
	if interaction == "aller-ecole" && features.Default.BlocksKey(context.Background(), "ami-enfance") != "" {
		s.reach("ami")
	}
}

// firstsDue: the « premières fois » a baby must have done to become a child: those it can do now
// (one whose activity waits for its update isn't asked for).
func firstsDue(ctx context.Context) []First {
	return slices.DeleteFunc(slices.Clone(Firsts), func(f First) bool { return features.Default.Blocks(ctx, f.By) != "" })
}

// doneIDs: the ids of a Sim's rows in sim_firsts or sim_steps.
func doneIDs(ctx context.Context, q interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, table, simID string) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT id FROM `+table+` WHERE sim_id = $1`, simID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

// allDone: every one of the ids is in done.
func allDone(ids []string, done []string) bool {
	for _, id := range ids {
		if !slices.Contains(done, id) {
			return false
		}
	}
	return true
}

func stepIDs() []string {
	ids := make([]string, len(Steps))
	for i, st := range Steps {
		ids[i] = st.ID
	}
	return ids
}

func firstIDs(list []First) []string {
	ids := make([]string, len(list))
	for i, f := range list {
		ids[i] = f.ID
	}
	return ids
}

// settleGrowth, at the end of every turn: the child's étapes reached are recorded (said in the journal
// when the update is open), the ones the day already shows too (the friend from childhood, the birthday);
// open, the baby whose premières fois are all done becomes a child, the child whose étapes are becomes a
// teenager, now.
func settleGrowth(ctx context.Context, tx pgx.Tx, s *Sim) ([]Event, error) {
	reached := s.reached
	s.reached = nil
	if s.BornAt == 0 {
		return nil, nil
	}
	open := stepsOpen(ctx)
	switch s.stage().ID {
	case game.StageBebe:
		if !open {
			return nil, nil
		}
		done, err := doneIDs(ctx, tx, "sim_firsts", s.ID)
		if err != nil || !allDone(firstIDs(firstsDue(ctx)), done) {
			return nil, err
		}
		events := s.ageTo(game.StageByID(game.StageEnfant))
		return append(events, Event{Kind: "life", Text: fmt.Sprintf("Toutes ses premières fois ! %s n'est plus un bébé : place à l'enfance, et à ses étapes.", s.FirstName), GameTime: s.GameMinutes}), nil
	case game.StageEnfant:
		s.reached = reached
		if s.childhoodFriend() != nil {
			s.reach("ami")
		}
		if s.age() >= stepAge {
			s.reach("anniv")
		}
		reached, s.reached = s.reached, nil
		var events []Event
		for _, id := range reached {
			tag, err := tx.Exec(ctx, `INSERT INTO sim_steps (sim_id, id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, s.ID, id)
			if err != nil {
				return nil, err
			}
			if i := slices.IndexFunc(Steps, func(st Step) bool { return st.ID == id }); open && i >= 0 && tag.RowsAffected() > 0 {
				events = append(events, Event{Kind: "life", Text: fmt.Sprintf("Étape d'enfant : %s", Steps[i].Line), GameTime: s.GameMinutes})
			}
		}
		if !open {
			return events, nil
		}
		done, err := doneIDs(ctx, tx, "sim_steps", s.ID)
		if err != nil || !allDone(stepIDs(), done) {
			return events, err
		}
		events = append(events, s.ageTo(game.StageByID(game.StageAdo))...)
		return append(events, Event{Kind: "life", Text: fmt.Sprintf("Toutes les étapes d'enfant ! %s entre dans l'adolescence : toute la famille est fière.", s.FirstName), GameTime: s.GameMinutes}), nil
	}
	return nil, nil
}

// etapes: GET /sims/{id}/etapes: the child's étapes, those done, and the minutes till the birthday that is one.
func (h *Handler) etapes(w http.ResponseWriter, r *http.Request) {
	if !stepsOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	id := chi.URLParam(r, "id")
	var born, minutes int64
	if err := h.DB.QueryRow(r.Context(), `SELECT born_at, game_minutes FROM sims WHERE id = $1 AND user_id = $2`, id, auth.UserID(r.Context())).Scan(&born, &minutes); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	done, err := doneIDs(r.Context(), h.DB, "sim_steps", id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	wait := int64(0)
	if born != 0 {
		wait = max(0, born+game.MinutesToAge(stepAge)-minutes)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"list": Steps, "done": done, "wait": wait})
}
