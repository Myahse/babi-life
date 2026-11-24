package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// La famille jouable (the update « famille-jouable », game/famillejouable.go; web game/household.ts): the
// household's members, directed, do their own things (game.MemberActs), alone or with another of the house
// (« aider-devoirs@kid:k12 », « calin@self »). Told here once done (foyer.go houseDone), like the rest:
// their needs, the others' and the Sim's, the children's school average. The average falls for a child
// neglected (houseSync), and grown up, a good one is a mention at the bac: renom for the family.

var (
	errNotForRole = errors.New("pas pour cette personne")
	errPairWho    = errors.New("avec qui ?")
)

func familleJouableOpen(ctx context.Context) bool {
	return features.Default != nil && features.Default.BlocksKey(ctx, game.FamilleJouableKey) == ""
}

// renomGain: renom earned on the way, written by renomFlush.
type renomGain struct {
	pts int
	why string
}

func (s *Sim) renomFlush(ctx context.Context, tx pgx.Tx) error {
	for _, g := range s.renomDue {
		if _, err := tx.Exec(ctx, `UPDATE sims SET renom = renom + $2 WHERE id = $1`, s.ID, g.pts); err != nil {
			return err
		}
		if err := logRenom(ctx, tx, s.ID, g.pts, g.why); err != nil {
			return err
		}
	}
	s.renomDue = nil
	return nil
}

// memberRole: what one of the house is (game.Role*): a child by its stage, an elder, an adult.
func (s *Sim) memberRole(id string) string {
	switch {
	case id == "self":
		if s.Life.Famille != nil && s.Life.Famille.Stage == game.AgeSenior {
			return game.RoleAncien
		}
		switch st := s.stage().ID; st {
		case game.StageEnfant, game.StageAdo:
			return st
		}
		return game.RoleAdulte
	case strings.HasPrefix(id, "kid:"):
		if k := s.fam().kid(strings.TrimPrefix(id, "kid:")); k != nil && (k.Stage == game.StageEnfant || k.Stage == game.StageAdo) {
			return k.Stage
		}
		return game.RoleAdulte
	case strings.HasPrefix(id, "elder:"):
		return game.RoleAncien
	}
	return game.RoleAdulte
}

// splitMemberAct: « act » or « act@with ».
func splitMemberAct(action string) (game.MemberAct, string, bool) {
	id, with, _ := strings.Cut(action, "@")
	a, ok := game.FindMemberAct(id)
	return a, with, ok
}

// memberAct: what a member did of their own, done.
func (s *Sim) memberAct(member string, a game.MemberAct, with string) error {
	if !a.For(s.memberRole(member)) {
		return errNotForRole
	}
	ids := s.houseMembers()
	if a.Pair {
		if with == "" || with == member || (with != "self" && !contains(ids, with)) {
			return errPairWho
		}
		if !a.With(s.memberRole(with)) {
			return errNotForRole
		}
	}
	h := s.Life.House
	h[member] = h[member].Add(a.Effect)
	if a.Grade > 0 {
		s.kidGrade(member, a.Grade)
	}
	if a.Family != (game.Needs{}) {
		for _, id := range ids {
			if id != member {
				h[id] = h[id].Add(a.Family)
			}
		}
	}
	if a.Sim != (game.Needs{}) {
		s.Needs = s.Needs.Add(a.Sim)
	}
	if a.Clean {
		s.dropMood("maison-sale", "")
	}
	if a.Pair {
		if with == "self" {
			s.Needs = s.Needs.Add(a.Target)
		} else {
			h[with] = h[with].Add(a.Target)
			if a.TargetGrade > 0 {
				s.kidGrade(with, a.TargetGrade)
			}
		}
	}
	return nil
}

func contains(xs []string, x string) bool {
	for _, y := range xs {
		if y == x {
			return true
		}
	}
	return false
}

func noteOf(k *Kid) float64 {
	if k.Note == 0 {
		return game.NoteStart
	}
	return k.Note
}

// kidGrade: points on a child's average (at most game.NoteDayGain a game day).
func (s *Sim) kidGrade(member string, pts float64) {
	k := s.fam().kid(strings.TrimPrefix(member, "kid:"))
	if k == nil || !strings.HasPrefix(member, "kid:") || (k.Stage != game.StageEnfant && k.Stage != game.StageAdo) {
		return
	}
	day := s.GameMinutes / game.DayMinutes
	if k.NoteDay != day {
		k.NoteDay, k.NoteGain = day, 0
	}
	gain := min(pts, game.NoteDayGain-k.NoteGain)
	if gain <= 0 {
		return
	}
	k.Note = min(game.NoteMax, noteOf(k)+gain)
	k.NoteGain += gain
}

// kidsNeglect: the children left hungry, tired, bored these `mins` see their average fall (houseSync).
func (s *Sim) kidsNeglect(mins int64) {
	f := s.Life.Famille
	if !s.familleOn || f == nil || mins <= 0 {
		return
	}
	for i := range f.Kids {
		k := &f.Kids[i]
		if k.Stage != game.StageEnfant && k.Stage != game.StageAdo {
			continue
		}
		n, ok := s.Life.House["kid:"+k.ID]
		if !ok || (n.Hunger+n.Energy+n.Hygiene+n.Social+n.Fun)/5 >= game.NeglectUnder {
			continue
		}
		k.Note = max(1, noteOf(k)-game.NoteNeglect*float64(mins)/float64(game.DayMinutes))
	}
}

// kidBac: a child of the house grown up: its school years end with the bac (famille.go famSync).
func (s *Sim) kidBac(k *Kid) {
	if !s.familleOn || k.Note == 0 || k.Mention != "" {
		return
	}
	note := game.Round1(k.Note)
	if note >= game.MentionAt {
		k.Mention = game.Mention(note)
		s.renomDue = append(s.renomDue, renomGain{game.MentionRenom, "mention au bac de " + k.Name})
		s.pending = append(s.pending, Event{Kind: "life", Text: fmt.Sprintf("%s a eu son bac, mention « %s », avec %.1f de moyenne : toute la famille est fière ! (+%d renom)", k.Name, k.Mention, note, game.MentionRenom), GameTime: s.GameMinutes})
		return
	}
	s.pending = append(s.pending, Event{Kind: "life", Text: fmt.Sprintf("%s termine l'école avec %.1f de moyenne. Le bac est passé, sans mention.", k.Name, note), GameTime: s.GameMinutes})
}

// memberActs: GET /famille/actes — what the household's members can do (the update open).
func (h *Handler) memberActs(w http.ResponseWriter, r *http.Request) {
	if !familleJouableOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, errLifeClosed.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"acts": game.MemberActs})
}
