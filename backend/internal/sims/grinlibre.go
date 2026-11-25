package sims

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/npcchat"
)

// Le grin libre (the update « grin-libre », npcchat/grin.go): in the group chats, a PNJ spoken to (its
// message answered, or its name in the message), or a question left in the room, is answered in the PNJ's
// own words, in the writer's own way of writing, doing what it's asked when words can. The words take a
// few seconds: written in the background, the room's next read shows them (the same key as the banks'
// answer, so never twice). The model busy or off, the banks of lines answer as before (pnjvivants.go).

// GrinLibreKey: the update.
const GrinLibreKey = "grin-libre"

const (
	// GrinLibrePerHour: a room's PNJ answers in its own words an hour at most (the banks' limits are lower).
	GrinLibrePerHour = 60
	// GrinLibreQuestion: in a hundred, a question to nobody in particular a PNJ takes up.
	GrinLibreQuestion = 40
	// grinLibreBefore: the room's last messages the PNJ reads first.
	grinLibreBefore = 8
)

func grinLibreOpen(ctx context.Context) bool {
	return features.Default != nil && features.Default.BlocksKey(ctx, GrinLibreKey) == ""
}

// grinTalking: the messages being answered now (one model call each, whatever the reads).
var grinTalking sync.Map

// pnjTalk: the room's last message, a player's to a PNJ (or a question to all): answered in the PNJ's own
// words, in the background. True: it's being (or was) answered so; false: left to the banks of lines.
func (h *Handler) pnjTalk(ctx context.Context, room string, recent []grinRow, hourCount int, now time.Time) bool {
	if h.Talk == nil || len(recent) == 0 || !grinLibreOpen(ctx) {
		return false
	}
	m := recent[0]
	if m.sim == "" || now.Sub(m.at) > PnjAnswerWithin || hourCount >= GrinLibrePerHour {
		return false
	}
	for _, r := range recent {
		if r.pnj != "" && r.replyTo != nil && *r.replyTo == m.id {
			return true // answered already
		}
	}
	byID := map[int64]grinRow{}
	for _, r := range recent {
		byID[r.id] = r
	}
	var who Player
	if m.replyTo != nil {
		if q, ok := byID[*m.replyTo]; ok && q.pnj != "" {
			who, _ = pnjPlayer(q.pnj)
		}
	}
	speakers := pnjSpeakers(ctx, room, now)
	if who.ID == "" {
		low := fold(m.body)
		for _, p := range speakers {
			if strings.Contains(low, fold(p.FirstName)) {
				who = p
				break
			}
		}
	}
	if who.ID == "" {
		// A question to the room: a PNJ takes it up now and then (it's bored).
		seed := pnjMix("libre", fmt.Sprint(m.id))
		if !strings.Contains(m.body, "?") || len(speakers) == 0 || int(seed%100) >= GrinLibreQuestion {
			return false
		}
		who = speakers[(seed/100)%uint64(len(speakers))]
	}
	if _, busy := grinTalking.LoadOrStore(m.id, true); busy {
		return true
	}
	if quota.take("grin:"+m.sim, now) != nil {
		grinTalking.Delete(m.id)
		return false
	}
	// The room's last lines, oldest first (the message itself apart).
	var before []npcchat.GrinLine
	for i := min(len(recent)-1, grinLibreBefore); i >= 1; i-- {
		r := recent[i]
		switch {
		case r.pnj == who.ID:
			before = append(before, npcchat.GrinLine{Text: r.body})
		case r.pnj != "":
			p, _ := pnjPlayer(r.pnj)
			before = append(before, npcchat.GrinLine{Who: p.FirstName, Text: r.body, Pnj: true})
		default:
			before = append(before, npcchat.GrinLine{Who: r.name, Text: r.body})
		}
	}
	persona := npcchat.Persona{Name: who.FirstName, Gender: who.Gender, Job: "quelqu'un du quartier"}
	if l := pnjLife(who.ID); l != nil && l.Job != "" {
		persona.Job = l.Job
	}
	roomName := "« Tout Babi », le chat de toute la ville"
	if _, c, ok := communeOf(room); ok {
		roomName = fmt.Sprintf("le chat de la commune de %s", c.Name)
	}
	id := m.id
	// (The request's values kept, the player's language among them; not its end.)
	bg, cancel := context.WithTimeout(context.WithoutCancel(ctx), 25*time.Second)
	go func() {
		defer cancel()
		defer grinTalking.Delete(id)
		body := ""
		r, err := h.Talk.Grin(bg, persona, roomName, before, m.name, m.body)
		if err == nil {
			body, err = cleanMessage(r.Text)
		}
		if err != nil {
			log.Printf("grin libre: %v", err)
			// The banks' answer instead.
			t := pnjTopic(m.body)
			t.addressed = true
			body = pnjAnswerBody(t, m.name, who, pnjMix("answer", fmt.Sprint(id)))
		}
		_, _ = h.DB.Exec(bg, `INSERT INTO grin (room, pnj, pnj_name, body, reply_to, pnj_key) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (pnj_key) DO NOTHING`,
			room, who.ID, who.FirstName, body, id, fmt.Sprintf("ans:%d", id))
	}()
	return true
}
