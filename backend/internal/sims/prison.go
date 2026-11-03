package sims

import (
	"errors"
	"fmt"
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Prison at the MACA (game/prison.go): caught after a robbery (braquage.go), the Sim lives its sentence
// there, its « étapes » to do (the cantine, the promenade, the atelier, the parloir, a class), the juge
// last; then it's let out, at the next turn once the juge's hearing is over. Meanwhile, nowhere else:
// no other place, no taxi, nothing stopped half done (it counts once started).

// PrisonPlaceID: where the MACA's interactions happen.
const PrisonPlaceID = "maca"

var errInPrison = errors.New("tu es en prison à la MACA : fais tes étapes pour sortir")

// Prison: a sentence being lived.
type Prison struct {
	// Since: the game minute it began.
	Since int64 `json:"since"`
	// Steps: the étapes it asks (game.PrisonStepsFor); Done: those done.
	Steps []string `json:"steps"`
	Done  []string `json:"done"`
	Bank  bool     `json:"bank,omitempty"`
}

// ready: every étape done but the juge's.
func (p *Prison) ready() bool {
	for _, id := range p.Steps {
		if id != "juge" && !slices.Contains(p.Done, id) {
			return false
		}
	}
	return true
}

// jail: caught, to the MACA (whatever the Sim was doing ends).
func (s *Sim) jail(bank bool) {
	s.Activity = nil
	s.Prison = &Prison{Since: s.GameMinutes, Steps: game.PrisonStepsFor(s.Record-1, bank), Done: []string{}, Bank: bank}
}

// atPrison: the MACA's interactions, for a prisoner only; the juge once the rest is done.
func (s *Sim) atPrison(interactionID string) (game.PlaceKind, error) {
	if s.Prison == nil {
		return game.PlaceKind{}, errors.New("tu n'es pas en prison")
	}
	if interactionID == game.JugeID && !s.Prison.ready() {
		return game.PlaceKind{}, errors.New("le juge te verra quand tes autres étapes seront faites")
	}
	return game.Kinds[game.PrisonKind], nil
}

// reachPrison: the étape an interaction brings, said in the journal.
func (s *Sim) reachPrison(interaction string) {
	if s.Prison == nil {
		return
	}
	st, ok := game.PrisonStepBy(interaction)
	if !ok || !slices.Contains(s.Prison.Steps, st.ID) || slices.Contains(s.Prison.Done, st.ID) {
		return
	}
	s.Prison.Done = append(s.Prison.Done, st.ID)
	n := len(s.Prison.Done)
	s.pending = append(s.pending, Event{Kind: "life", Text: fmt.Sprintf("Étape de prison (%d/%d) : %s", n, len(s.Prison.Steps), st.Line), GameTime: s.GameMinutes})
}

// settlePrison, at the end of every turn: the étapes all done and the juge's hearing over, let out.
func (s *Sim) settlePrison() []Event {
	p := s.Prison
	if p == nil || len(p.Done) < len(p.Steps) || (s.Activity != nil && s.Activity.PlaceID == PrisonPlaceID) {
		return nil
	}
	for _, id := range p.Steps {
		if !slices.Contains(p.Done, id) {
			return nil
		}
	}
	s.Prison = nil
	days := (s.GameMinutes - p.Since) / (24 * 60)
	stay := humanMinutes(s.GameMinutes - p.Since)
	if days >= 1 {
		stay = fmt.Sprintf("%d jour(s)", days)
	}
	return []Event{{Kind: "life", Text: fmt.Sprintf("Libéré·e ! Les portes de la MACA s'ouvrent après %s. Le soleil, le bruit des gbakas : la vie reprend. Le casier, lui, reste.", stay), GameTime: s.GameMinutes}}
}
