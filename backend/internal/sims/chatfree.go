package sims

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/npcchat"
)

// Talking freely to someone in the street: the player types what they want,
// and the passer-by answers in their own words (npcchat). The words come
// first, the Sim's row untouched while they're written; then the exchange
// counts like any chat (chat.go, topic « libre »): needs, friendship, how
// long the conversation goes on. An update the team opens from the admin.

const (
	// What a player can type at once, and how much of the conversation goes with it.
	freeMax    = 280
	freeBefore = 12
	// A player's words a day (the model costs per message), and the time between two.
	freeDaily = 150
	freeGap   = 1500 * time.Millisecond
)

// talkQuota: each account's messages today and its last one (in memory: a restart forgives).
type talkQuota struct {
	mu   sync.Mutex
	day  string
	n    map[string]int
	last map[string]time.Time
}

var quota talkQuota

// take counts one message of the account, or says why not now.
func (q *talkQuota) take(user string, now time.Time) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	if d := now.Format("2006-01-02"); d != q.day {
		q.day, q.n, q.last = d, map[string]int{}, map[string]time.Time{}
	}
	if now.Sub(q.last[user]) < freeGap {
		return errors.New("Doucement, laisse-lui le temps de répondre !")
	}
	if q.n[user] >= freeDaily {
		return errors.New("Tu as trop causé aujourd'hui : les gens du quartier se reposent. Reviens demain !")
	}
	q.n[user]++
	q.last[user] = now
	return nil
}

func (h *Handler) chatFreeHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if features.Default.BlocksKey(ctx, "chat-libre") != "" {
		httpx.Error(w, http.StatusForbidden, "Bientôt : une mise à jour arrive.")
		return
	}
	if h.Talk == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Les gens ne causent pas librement pour l'instant.")
		return
	}
	var req struct {
		With Passerby `json:"with"`
		Text string   `json:"text"`
		// The conversation so far, as the phone shows it.
		Before    []npcchat.Line `json:"before"`
		Job       string         `json:"job"`
		Doing     string         `json:"doing"`
		Languages []string       `json:"languages"`
		Rapport   int            `json:"rapport"`
		Met       int            `json:"met"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" || utf8.RuneCountInString(req.Text) > freeMax {
		httpx.Error(w, http.StatusBadRequest, fmt.Sprintf("Entre 1 et %d caractères.", freeMax))
		return
	}
	if len(req.Before) > freeBefore {
		req.Before = req.Before[len(req.Before)-freeBefore:]
	}
	for i := range req.Before {
		req.Before[i].Text = clip(req.Before[i].Text, 400)
	}
	if len(req.Languages) > 6 {
		req.Languages = req.Languages[:6]
	}
	for i := range req.Languages {
		req.Languages[i] = clip(req.Languages[i], 20)
	}
	// Who's talking: read, not locked (the words take a few seconds).
	s, err := scanSim(h.DB.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(ctx)))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	if err := quota.take(auth.UserID(ctx), time.Now()); err != nil {
		httpx.Error(w, http.StatusTooManyRequests, err.Error())
		return
	}
	reply, err := h.Talk.Answer(ctx,
		npcchat.Persona{Name: req.With.Name, Gender: req.With.Gender, Job: clip(req.Job, 60), Doing: clip(req.Doing, 60), Languages: req.Languages, Rapport: min(5, max(0, req.Rapport)), Met: max(0, req.Met)},
		npcchat.Player{FirstName: s.FirstName, Gender: s.Gender, Minor: s.minor(), Commune: s.Commune, Hour: fmt.Sprintf("%d h %02d", game.HourOf(s.GameMinutes), s.GameMinutes%60)},
		req.Before, req.Text)
	if err != nil {
		log.Printf("npcchat: %v", err)
		httpx.Error(w, http.StatusBadGateway, req.With.Name+" n'a pas bien entendu… Redis-le ?")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		adult, err := accountAdult(ctx, tx)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		ans, err := s.chatWith(req.With, "libre", req.Text, "", adult, newRand(), &chatAnswer{Text: reply.Text, Mood: reply.Mood})
		if err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: ans.Text, Mood: ans.Mood}, nil, nil
	})
}

// clip: at most n letters.
func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
}
