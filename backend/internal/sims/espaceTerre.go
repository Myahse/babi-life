package sims

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// L'espace on Earth (game/espaceTerreActs.go): what the spaceports' activities leave once done (a moodlet, the
// launch seen or the next one to come; never money), and the ticket cancelled from the Astrélia app (web
// components/espace/AstreliaApp.tsx): before boarding only, 80 % back, never more than was paid.

var errBoarding = errors.New("l'embarquement a commencé : le billet ne se rend plus")

// spaceEarthDone: a space activity on Earth over (clock.go finish).
func (s *Sim) spaceEarthDone(a *game.Activity) []Event {
	if a == nil || a.Kind != "do" || s.inSpace() {
		return nil
	}
	say := func(text string) []Event { return []Event{{Kind: "life", Text: text, GameTime: s.GameMinutes}} }
	switch a.Interaction.ID {
	case game.ActAlbatros:
		s.addMood("apesanteur", "")
		return say("Quinze paraboles : à chaque sommet, tout le monde flotte et rit. L'Albatros 0G se pose, les jambes encore légères.")
	case game.ActSuborbital:
		s.addMood("apesanteur", "")
		s.addMood("terre-haut", "")
		return say("Quatre minutes là-haut : le ciel noir, la Terre toute ronde sous le hublot. La Pirogue redescend sous ses parachutes.")
	case game.ActCentrifuge:
		return say("La centrifugeuse ralentit : 4 G tenus, la tête qui tourne un peu, le sourire jusqu'aux oreilles.")
	case game.ActPlage, game.ActSteppe:
		sp := game.WatchFrom[a.PlaceID]
		if sp == "" {
			return nil
		}
		if l, ok := game.LaunchDuring(sp, a.Start, a.End+1); ok {
			s.addMood("lancement-vu", "")
			what := "la Calao"
			if !l.Crewed {
				what = "la Calao cargo"
			}
			return say(fmt.Sprintf("À %s, %s s'est arrachée du pas de tir : la lumière d'abord, le grondement un peu après. Toute la plage a applaudi.", game.ClockLabel(l.At), what))
		}
		next := game.NextLaunch(sp, s.GameMinutes)
		return say(fmt.Sprintf("Pas de lancement cette fois. Le prochain habité part à %s.", game.ClockLabel(next.At)))
	}
	return nil
}

// ticketCancelApp: the ticket given back from the app (not while boarding: the rocket's trip is under way).
func (s *Sim) ticketCancelApp() (Event, error) {
	if s.Life.Espace == nil || s.Life.Espace.Ticket == nil {
		return Event{}, errNoTicketHeld
	}
	if a := s.Activity; a != nil && a.Kind == "travel" && a.Trip != nil && a.Trip.Mode == game.RocketApp {
		return Event{}, errBoarding
	}
	return s.ticketCancel(), nil
}

// espaceCancel: POST /sims/{id}/espace/annuler.
func (h *Handler) espaceCancel(w http.ResponseWriter, r *http.Request) {
	if features.Default.BlocksKey(r.Context(), game.EspaceKey) != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		ev, err := s.ticketCancelApp()
		if err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: ev.Text, Money: ev.Money}, []Event{ev}, nil
	})
}
