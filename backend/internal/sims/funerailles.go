package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Les funérailles (the update « cycle-vie », game/funerailles.go; web components/Funerailles.tsx): an elder
// gone (famille.go mourn), its Memorial waits for the funeral the Sim gives: POST /sims/{id}/funerailles
// {at, kind}. It's paid (less the cotisations), the family's renom grows (renom_log), the needs too. Not
// given within game.FuneralDays, the family does a simple one on its own (funeralsDue, in the mutate flow).

var (
	errNoMemorial  = errors.New("aucun défunt à honorer")
	errFuneralDone = errors.New("ses funérailles ont déjà eu lieu")
	errFuneralKind = errors.New("funérailles inconnues")
)

type funeralRequest struct {
	At   int64  `json:"at"`
	Kind string `json:"kind"`
}

func (h *Handler) funeraillesPost(w http.ResponseWriter, r *http.Request) {
	var req funeralRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	if !cycleVieOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, errLifeClosed.Error())
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		return s.giveFuneral(ctx, tx, req.At, req.Kind, time.Now())
	})
}

// giveFuneral: the funeral given for the Memorial of `at`.
func (s *Sim) giveFuneral(ctx context.Context, tx pgx.Tx, at int64, kind string, now time.Time) (game.Outcome, []Event, error) {
	f := s.fam()
	var m *Memorial
	for i := range f.Memorials {
		if f.Memorials[i].At == at {
			m = &f.Memorials[i]
		}
	}
	if m == nil {
		return game.Outcome{}, nil, errNoMemorial
	}
	if m.Funeral != "" {
		return game.Outcome{}, nil, errFuneralDone
	}
	fu, ok := game.FindFuneral(kind)
	if !ok {
		return game.Outcome{}, nil, errFuneralKind
	}
	pay := game.FuneralPays(fu)
	if s.Money < pay {
		return game.Outcome{}, nil, errBroke
	}
	s.Money -= pay
	s.Needs = s.Needs.Add(fu.Needs)
	m.Funeral, m.FuneralAt = fu.ID, now.Unix()
	if err := s.funeralRenom(ctx, tx, fu.Renom, m.Name); err != nil {
		return game.Outcome{}, nil, err
	}
	text := fmt.Sprintf("%s pour %s : la famille et les amis étaient là, ils ont cotisé. Repose en paix. (+%d renom)", fu.Label, m.Name, fu.Renom)
	return game.Outcome{Text: text, Money: -pay}, []Event{{Kind: "life", Text: text, Money: -pay, GameTime: s.GameMinutes}}, nil
}

func (s *Sim) funeralRenom(ctx context.Context, tx pgx.Tx, pts int, name string) error {
	if _, err := tx.Exec(ctx, `UPDATE sims SET renom = renom + $2 WHERE id = $1`, s.ID, pts); err != nil {
		return err
	}
	return logRenom(ctx, tx, s.ID, pts, "funérailles de "+name)
}

// funeralsDue: the funerals not given in time, done simply by the family (no cost to the Sim, a little renom).
func (s *Sim) funeralsDue(ctx context.Context, tx pgx.Tx, now time.Time) ([]Event, error) {
	f := s.fam()
	var out []Event
	for i := range f.Memorials {
		m := &f.Memorials[i]
		if m.Funeral != "" || m.Died == 0 || now.Unix()-m.Died < game.FuneralDays*24*3600 {
			continue
		}
		m.Funeral, m.FuneralAt = "famille", now.Unix()
		if err := s.funeralRenom(ctx, tx, 1, m.Name); err != nil {
			return nil, err
		}
		out = append(out, Event{Kind: "life", Text: fmt.Sprintf("Sans toi, la famille a enterré %s simplement, au village. On a remarqué ton absence…", m.Name), GameTime: s.GameMinutes})
	}
	return out, nil
}
