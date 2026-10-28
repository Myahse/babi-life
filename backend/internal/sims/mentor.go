package sims

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The mentor (game/mentor.go): from 18, advice on what the Sim's life needs
// now (a job, a home, money, friends, the bac), and once a game week at most a
// hand: a little money, or encouragement when they can't.

var errMentorMinor = errors.New("ton mentor t'attend à tes 18 ans")

// mentorIntro: at 18, the family's mentor introduces themself (in the journal).
func (s *Sim) mentorIntro(at int64) *Event {
	if features.Default.BlocksKey(context.Background(), game.MentorKey) != "" {
		return nil
	}
	m := game.MentorOf(s.Family)
	return &Event{Kind: "life", Text: fmt.Sprintf("%s (%s) te prend sous son aile : « %s » Retrouve ses conseils dans l'appli Mentor du téléphone.", m.Name, m.Title, m.Intro), GameTime: at}
}

// mentorAdvice: what they tell the Sim, from where its life is.
func (s *Sim) mentorAdvice(rng *rand.Rand) string {
	m := game.MentorOf(s.Family)
	var tips []string
	if s.Career == "" {
		tips = append(tips, "Trouve-toi un travail, même petit au début : l'appli Boulot. Celui qui travaille ne dépend de personne.")
	}
	if s.Money < 5000 {
		tips = append(tips, "Tes poches sont vides. Ne joue pas l'argent que tu n'as pas : ni casino ni paris tant que tu n'as pas mis de côté.")
	}
	if s.Loan > 0 {
		tips = append(tips, "Rembourse ton prêt avant tout le reste. Une dette, ça dort jamais.")
	}
	if s.RentArrears > 0 {
		tips = append(tips, "Le loyer en retard, c'est le propriétaire à la porte. Règle ça vite.")
	}
	if s.Housing != game.OwnHouse && s.Money > 200000 {
		tips = append(tips, "Tu as de quoi commencer : un terrain, petit à petit, et un jour ta maison. Regarde dans l'appli Logement.")
	}
	if len(s.Friends) < 3 {
		tips = append(tips, "Fais-toi des amis : au grin, au maquis, à la mosquée ou à l'église. Personne ne réussit seul.")
	}
	if s.Needs.Energy < 30 {
		tips = append(tips, "Tu as l'air fatigué. Dors un peu : la santé d'abord.")
	}
	tips = append(tips,
		"Garde toujours un peu de côté chaque semaine, même 1 000 Djai. C'est comme ça qu'on devient grand.",
		"Respecte les anciens, écoute beaucoup, parle peu. Les bonnes affaires viennent de là.",
		"Ne fais pas comme les brouteurs : l'argent facile part aussi vite qu'il vient.",
	)
	return fmt.Sprintf("%s : « %s »", m.Name, tips[rng.IntN(min(len(tips), 3))])
}

// mentorHelp: once a game week, a hand (within the day's limits), else a word to wait.
func (s *Sim) mentorHelp(last int64, rng *rand.Rand) (string, int, int64) {
	m := game.MentorOf(s.Family)
	if last > 0 && s.GameMinutes-last < game.MentorWeek {
		e := ""
		if s.Gender == "femme" {
			e = "e"
		}
		return fmt.Sprintf("%s : « Je t'ai aidé%s il n'y a pas longtemps. Débrouille-toi un peu, c'est pour ton bien. Reviens me voir la semaine prochaine. »", m.Name, e), 0, last
	}
	if rng.Float64() < 0.35 {
		return fmt.Sprintf("%s : « Cette semaine c'est dur pour moi aussi. Mais tiens bon, et va voir l'appli Boulot. »", m.Name), 0, s.GameMinutes
	}
	sum := (m.Help[0] + rng.IntN(m.Help[1]-m.Help[0]+1)) / 500 * 500
	got := s.earn(game.FromLuck, sum)
	if got <= 0 {
		return fmt.Sprintf("%s : « Je ne peux rien te donner aujourd'hui. Reviens un autre jour. »", m.Name), 0, last
	}
	return fmt.Sprintf("%s te glisse %s : « Ce n'est pas un cadeau, c'est un investissement. Fais-en bon usage. »", m.Name, game.FCFA(got)), got, s.GameMinutes
}

// mentorOf: GET /sims/{id}/mentor: who they are, and when a hand can be asked again.
func (h *Handler) mentorOf(w http.ResponseWriter, r *http.Request) {
	var family string
	var last, now, born int64
	if err := h.DB.QueryRow(r.Context(), `SELECT family, mentor_help, game_minutes, born_at FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())).Scan(&family, &last, &now, &born); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	next := int64(0)
	if last > 0 {
		next = max(0, last+game.MentorWeek-now)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"mentor": game.MentorOf(family), "helpIn": next})
}

// mentorAsk: POST /sims/{id}/mentor {ask: conseil | aide}.
func (h *Handler) mentorAsk(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Ask string `json:"ask"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	if features.Default.BlocksKey(ctx, game.MentorKey) != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if s.minor() {
			return game.Outcome{}, nil, errMentorMinor
		}
		rng := newRand()
		if req.Ask != "aide" {
			s.Needs = s.Needs.Add(game.Needs{Social: 4})
			return game.Outcome{Text: s.mentorAdvice(rng)}, nil, nil
		}
		var last int64
		if err := tx.QueryRow(ctx, `SELECT mentor_help FROM sims WHERE id = $1`, s.ID).Scan(&last); err != nil {
			return game.Outcome{}, nil, err
		}
		text, got, at := s.mentorHelp(last, rng)
		if at != last {
			if _, err := tx.Exec(ctx, `UPDATE sims SET mentor_help = $2 WHERE id = $1`, s.ID, at); err != nil {
				return game.Outcome{}, nil, err
			}
		}
		var events []Event
		if got > 0 {
			events = append(events, Event{Kind: "money", Text: text, Money: got, GameTime: s.GameMinutes})
		}
		return game.Outcome{Text: text, Money: got}, events, nil
	})
}
