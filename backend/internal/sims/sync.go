package sims

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Played without network (web lib/offlinePlay.ts): the phone keeps what the
// player does (an action started or stopped, a défi, a message) and, every
// minute the game is open and seen, that it's there; once online it sends
// it all and the server plays it again in order, on its own rules. The time
// the game was played goes by for the Sim, the time it was put away is held
// (as online: clock.go), and each action is checked as of when it was done
// (the money then, the hours, the place). What doesn't pass is left out and
// said. The phone only showed what it guessed: the server's answer is the Sim.

// syncStep: one thing done offline. At is the phone's clock (ms).
type syncStep struct {
	At            int64  `json:"at"`
	Do            string `json:"do"` // beat | pause | interact | stop | defi | message
	PlaceID       string `json:"placeId,omitempty"`
	InteractionID string `json:"interactionId,omitempty"`
	// Label: the action as the player saw it, to say which one didn't pass.
	Label string `json:"label,omitempty"`
	Kind  string `json:"kind,omitempty"`
	Score int    `json:"score,omitempty"`
	To    string `json:"to,omitempty"`
	Body  string `json:"body,omitempty"`
}

// maxSyncSteps: a day and more of minutes played offline; beyond, the oldest are dropped.
// maxSyncMessages: the messages written offline, at most (Gbairai's own pace is MessagesBurst a minute).
const (
	maxSyncSteps    = 3000
	maxSyncMessages = 100
)

// replay: the Sim brought along the steps, as clock.go's advance does online.
type replay struct {
	s       *Sim
	rng     *rand.Rand
	playing bool
	// last: when the player was last there (a step, a beat).
	last   time.Time
	events []Event
}

// move: the Sim brought to `at`: lived while the game was there, held while it was away
// (put away, or silent more than offlineAfter: then lived a heartbeat after the last sign).
func (p *replay) move(at time.Time) {
	s := p.s
	switch {
	case !p.playing:
		p.events = append(p.events, s.hold(game.MinuteOf(at)-s.GameMinutes)...)
	case at.Sub(p.last) > offlineAfter:
		p.events = append(p.events, s.advanceTo(game.MinuteOf(p.last.Add(heartbeat)), p.rng)...)
		p.events = append(p.events, s.hold(game.MinuteOf(at)-s.GameMinutes)...)
	}
	p.events = append(p.events, s.advanceTo(game.MinuteOf(at), p.rng)...)
	p.last = at
}

// sentMessage: a message written offline, sent once the replay is saved.
type sentMessage struct{ to, body string }

func (h *Handler) sync(w http.ResponseWriter, r *http.Request) {
	var req struct {
		// Clock: the phone's clock as it sent this (ms), to set its steps on the server's.
		Clock int64      `json:"clock"`
		Steps []syncStep `json:"steps"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	steps := req.Steps
	if len(steps) > maxSyncSteps {
		steps = steps[len(steps)-maxSyncSteps:]
	}
	slices.SortStableFunc(steps, func(a, b syncStep) int { return cmp.Compare(a.At, b.At) })
	ctx := r.Context()
	var sent []sentMessage
	var me, name string
	h.mutateWith(w, r, false, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		me, name = s.ID, s.FirstName
		now := time.Now()
		var shift time.Duration
		if req.Clock > 0 {
			shift = now.Sub(time.UnixMilli(req.Clock))
		}
		// Sent again (the answer lost on the way back): what was counted already isn't counted twice.
		var done int64
		if err := tx.QueryRow(ctx, `SELECT synced_at FROM sims WHERE id = $1`, s.ID).Scan(&done); err != nil {
			return game.Outcome{}, nil, err
		}
		p := &replay{s: s, rng: newRand(), playing: s.pausedAt == nil, last: s.lastTick}
		out, done, err := h.replaySync(ctx, tx, p, steps, shift, now, done, &sent)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE sims SET synced_at = $2 WHERE id = $1`, s.ID, done); err != nil {
			return game.Outcome{}, nil, err
		}
		return out, p.events, nil
	})
	// The messages written offline reach the friends' phones now.
	if len(sent) > 0 {
		last := map[string]string{}
		for _, m := range sent {
			last[m.to] = m.body
		}
		for to, body := range last {
			written := true
			if reSticker.MatchString(body) {
				body, written = "a envoyé un sticker", false
			}
			h.Push.ToSim(to, push.Message{Title: name + " · Gbairai", Body: body, URL: "/jeu?app=gbairai", Tag: "gbairai-" + me, Written: written})
		}
	}
}

// replaySync plays the steps not counted yet (after `done`, the phone's clock) on the Sim, up to now;
// shift sets the phone's clock on the server's. It returns what to tell the player and the latest
// step counted (the journal's new lines are p.events).
func (h *Handler) replaySync(ctx context.Context, tx pgx.Tx, p *replay, steps []syncStep, shift time.Duration, now time.Time, done int64, sent *[]sentMessage) (game.Outcome, int64, error) {
	s := p.s
	var counted int
	var refused []string
	for _, st := range steps {
		if st.At <= done {
			continue
		}
		done = st.At
		// On the server's clock, between the last time it heard from the game and now.
		at := time.UnixMilli(st.At).Add(shift)
		if at.Before(p.last) {
			at = p.last
		}
		if at.After(now) {
			at = now
		}
		p.move(at)
		p.playing = st.Do != "pause"
		why, err := h.replayStep(ctx, tx, p, st, at, sent)
		if err != nil {
			return game.Outcome{}, done, err
		}
		switch {
		case why != "":
			refused = append(refused, why)
		case st.Do != "beat" && st.Do != "pause":
			counted++
		}
	}
	// Back online, the game open: up to now (played if it was there just before), held no more.
	p.move(now)
	s.lastTick = now
	s.pausedAt = nil
	return syncOutcome(counted, refused), done, nil
}

// replayStep plays one step at `at`; why: what stopped it (the step left out), "" if it passed.
func (h *Handler) replayStep(ctx context.Context, tx pgx.Tx, p *replay, st syncStep, at time.Time, sent *[]sentMessage) (string, error) {
	s := p.s
	label := st.Label
	switch st.Do {
	case "interact":
		if label == "" {
			label = st.InteractionID
		}
		// As /interact (sims.go), but a court's match, played live with others, isn't played again.
		if _, _, pl, ok := world.FindPlace(st.PlaceID); ok && pl.Kind == "gym" {
			until, err := gymMembership(ctx, tx, s.ID)
			if err != nil {
				return "", err
			}
			s.gymUntil = until
		}
		if st.InteractionID == game.NightID {
			if adult, err := accountAdult(ctx, tx); err != nil || !adult {
				return label + " : " + errNotAdult.Error(), nil
			}
		}
		if game.CourtSport(st.InteractionID) != "" {
			return label + " : un match se joue avec le réseau", nil
		}
		it, err := s.interactAt(st.PlaceID, st.InteractionID)
		if err != nil {
			return label + " : " + err.Error(), nil
		}
		p.events = append(p.events, gymEvents(s, it)...)
	case "stop":
		ev, err := s.stop()
		if err != nil {
			return "Arrêter : " + err.Error(), nil
		}
		p.events = append(p.events, ev)
	case "defi":
		score := max(0, min(100, st.Score))
		if _, _, err := playDefi(ctx, tx, s, st.Kind, score); err != nil {
			if errors.Is(err, errDefiNot) || errors.Is(err, errDefiDone) {
				return fmt.Sprintf("Défi %d/100 : %s", score, err.Error()), nil
			}
			return "", err
		}
	case "message":
		if len(*sent) >= maxSyncMessages {
			return "Message : " + errTooFast.Error(), nil
		}
		if !s.hasPhone() || !s.hasApp("gbairai") {
			return "Message : " + errNoGbairai.Error(), nil
		}
		body, err := cleanMessage(st.Body)
		if err != nil {
			return "Message : " + err.Error(), nil
		}
		if err := canWrite(ctx, tx, s.ID, st.To); err != nil {
			if errors.Is(err, errNotFriends) || errors.Is(err, errBlocked) {
				return "Message : " + err.Error(), nil
			}
			return "", err
		}
		// Dated when it was written: the conversation in its order.
		if _, err := tx.Exec(ctx, `INSERT INTO messages (from_sim, to_sim, body, created_at) VALUES ($1, $2, $3, $4)`, s.ID, st.To, body, at); err != nil {
			return "", err
		}
		*sent = append(*sent, sentMessage{st.To, body})
	}
	return "", nil
}

// syncOutcome: what the player is told once back online.
func syncOutcome(counted int, refused []string) game.Outcome {
	var b strings.Builder
	switch counted {
	case 0:
		b.WriteString("Ton perso est à jour.")
	case 1:
		b.WriteString("Ce que tu as fait hors ligne est compté.")
	default:
		fmt.Fprintf(&b, "Les %d choses faites hors ligne sont comptées.", counted)
	}
	if len(refused) > 0 {
		b.WriteString(" Pas compté : ")
		b.WriteString(strings.Join(refused, " ; "))
		b.WriteString(".")
	}
	return game.Outcome{Text: b.String()}
}
