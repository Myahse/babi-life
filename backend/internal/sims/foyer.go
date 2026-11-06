package sims

import (
	"errors"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Le mode vie's household (the update « mode-vie », web game/household.ts): the others at home (papa and
// maman for a child at the family's home, the partner living with the Sim) have needs of their own,
// kept here in the Sim's Life (House) so every phone shows the same. They go down with the game clock
// (houseSync, on the same requests as the moods: lifeSync), never below a floor; what a member was told
// (or chose) to do, done, fills them (houseDone). They touch nothing else: no money, no Sim's needs.

// houseFloor: a member's needs never go below this (they look after themselves).
const houseFloor = 10

// houseFull: how a member starts.
var houseFull = game.Needs{Hunger: 80, Energy: 80, Hygiene: 80, Social: 80, Fun: 80}

var errNoMember = errors.New("personne de ce nom à la maison")

// houseMembers: who of the household is there to have needs (web HomeInside's ids).
func (s *Sim) houseMembers() []string {
	var ids []string
	if s.parentsHome() {
		ids = append(ids, ParentPrefix+"papa", ParentPrefix+"maman")
	}
	for _, f := range s.Friends {
		if f.Partner && f.Home {
			ids = append(ids, "partner:"+f.ID)
		}
	}
	// The generations (famille.go): the children old enough to be told, the elders.
	if fm := s.Life.Famille; fm != nil {
		for _, k := range fm.Kids {
			if k.Stage != "" && k.Stage != game.StageBebe {
				ids = append(ids, "kid:"+k.ID)
			}
		}
		for _, e := range fm.Elders {
			ids = append(ids, "elder:"+e.ID)
		}
	}
	return ids
}

// houseSync: the members' needs brought to the clock (at most a day's worth at once); those no longer at home go.
func (s *Sim) houseSync() {
	l := &s.Life
	now := s.GameMinutes
	ids := s.houseMembers()
	if len(ids) == 0 {
		l.House, l.HouseAt = nil, now
		return
	}
	if l.House == nil {
		l.House = map[string]game.Needs{}
	}
	mins := min(max(0, now-l.HouseAt), 24*60)
	if l.HouseAt == 0 {
		mins = 0
	}
	for k := range l.House {
		if !slices.Contains(ids, k) {
			delete(l.House, k)
		}
	}
	for _, id := range ids {
		n, ok := l.House[id]
		if !ok {
			n = houseFull
		} else if mins > 0 {
			n = floorNeeds(game.DecayIdle(n, mins), houseFloor)
		}
		l.House[id] = n
	}
	l.HouseAt = now
}

func floorNeeds(n game.Needs, f float64) game.Needs {
	return game.Needs{Hunger: max(f, n.Hunger), Energy: max(f, n.Energy), Hygiene: max(f, n.Hygiene), Social: max(f, n.Social), Fun: max(f, n.Fun)}
}

// houseEffect: what doing this does to a member's needs: the home's action (its good only), or a bite
// from the fridge; false for anything else.
func houseEffect(action string) (game.Needs, bool) {
	if action == "frigo" || strings.HasPrefix(action, "frigo-") {
		return game.Needs{Hunger: 45}, true
	}
	// The household's own free will (web household.ts FREE).
	switch action {
	case "golvo":
		return game.Needs{Hunger: 55}, true
	case "call-family":
		return game.Needs{Social: 35}, true
	}
	k := game.Kinds["home"]
	i := slices.IndexFunc(k.Interactions, func(it game.Interaction) bool { return it.ID == action })
	if i < 0 {
		return game.Needs{}, false
	}
	e := k.Interactions[i].Effect
	pos := func(v float64) float64 { return max(0, v) }
	return game.Needs{Hunger: pos(e.Hunger), Energy: pos(e.Energy), Hygiene: pos(e.Hygiene), Social: pos(e.Social), Fun: pos(e.Fun)}, true
}

// houseDo: a member did this: their needs filled by it.
func (s *Sim) houseDo(member, action string) error {
	if !slices.Contains(s.houseMembers(), member) {
		return errNoMember
	}
	e, ok := houseEffect(action)
	if !ok {
		return errors.New("action inconnue")
	}
	s.houseSync()
	s.Life.House[member] = s.Life.House[member].Add(e)
	return nil
}

// houseDone: POST /sims/{id}/foyer/{member} {action} — what a member of the household did, done.
func (h *Handler) houseDone(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Action string `json:"action"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	member, _ := url.PathUnescape(chi.URLParam(r, "member"))
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		if !s.lifeOn {
			return game.Outcome{}, nil, errLifeClosed
		}
		return game.Outcome{}, nil, s.houseDo(member, req.Action)
	})
}
