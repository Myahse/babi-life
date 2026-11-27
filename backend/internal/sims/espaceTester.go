package sims

import (
	"fmt"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The testers' shortcuts for l'espace (tester.go; web components/TesterTools.tsx): a ticket given, the training
// done, the next launch now, a cruise's round finished, and straight to the Sassandra pad. (Stage carries the
// destination: "station", "lune", "mars"; the station when empty.)
func (s *Sim) testerEspace(action, dest string) ([]Event, bool, error) {
	say := func(text string) []Event {
		return []Event{{Kind: "life", Text: "Testeur : " + text, GameTime: s.GameMinutes}}
	}
	switch action {
	case "espace-billet":
		if dest == "" {
			dest = "station"
		}
		d, ok := game.FindDestination(dest)
		if !ok {
			return nil, true, fmt.Errorf("destination inconnue")
		}
		// (Given, not paid: the cancelling gives nothing back.)
		s.space().Ticket = &SpaceTicket{Dest: d.ID, Bought: s.GameMinutes}
		return say(fmt.Sprintf("billet offert pour %s.", d.Name)), true, nil
	case "espace-formation":
		s.space().Training = true
		return say("formation d'Astrélia validée."), true, nil
	// The careers (espaceFormation.go): the selection passed, the brevet given, the mission's shifts done.
	case "espace-selection":
		f := s.formation()
		f.Ecrit, f.Selected = max(f.Ecrit, game.DrillPass), true
		return say("sélection d'Astrélia réussie : signe comme astronaute dans l'appli Boulot."), true, nil
	case "espace-brevet":
		f := s.formation()
		f.Selected = true
		st := f.Stay
		if st == nil {
			st = &FormationStay{Modules: len(game.FormationModules), Since: s.GameMinutes}
		}
		st.Sum, st.Count = max(st.Sum, 80), max(st.Count, 1)
		return say(strings.TrimSpace(s.brevetEarned(f, st))), true, nil
	case "espace-centre":
		if s.Activity != nil {
			return nil, true, game.ErrBusy
		}
		sp := game.Spaceports["sassandra"]
		s.City, s.Commune = sp.ID, sp.Commune
		return say("te voilà devant le Centre d'entraînement Astrélia."), true, nil
	case "espace-lancer":
		s.space().LaunchNow = true
		return say(fmt.Sprintf("le prochain embarquement décolle tout de suite (%d minutes de préparation).", game.Preflight)), true, nil
	case "espace-round":
		v := s.voyage()
		if v == nil || v.Arrived != 0 || v.Rounds == 0 {
			return nil, true, fmt.Errorf("pas de croisière en cours")
		}
		if a := s.Activity; a != nil && a.Kind == "do" {
			s.Activity = nil
		}
		return append(say("étape de croisière terminée."), s.spaceRound()...), true, nil
	case "espace-pad":
		if s.Activity != nil {
			return nil, true, game.ErrBusy
		}
		sp := game.Spaceports["sassandra"]
		if _, _, ok := world.FindCommune(sp.ID, sp.Commune); !ok {
			return nil, true, fmt.Errorf("spatioport introuvable")
		}
		s.City, s.Commune = sp.ID, sp.Commune
		return say("te voilà au pas de tir de Sassandra."), true, nil
	}
	return nil, false, nil
}
