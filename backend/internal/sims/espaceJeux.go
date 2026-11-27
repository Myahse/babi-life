package sims

import (
	"errors"
	"fmt"
	"math"
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Les jeux de l'espace (the update « espace-jeux »; game/espaceJeux.go; web components/espace/jeux2/). Each of
// the six is an action of its own, played on the phone as it runs (POST /sims/{id}/espace/jeu, the kind of its
// game): its score (0–100) gives the action's skill points (0.6 to 1.2 times what a minute of it is worth), a
// moodlet from game.SpaceGamePass, and the action done there and then (its good, a little less played badly).
// Never money: nothing pays but the controller's shift, which is the career's own (in the one-shift-a-day cap,
// its pay a little less played badly, never more). Left unplayed, the action still gives a little; a score sent
// just after it ended (the game still open) still counts for SpaceGameGrace minutes.

// EspaceJeux: what the six games keep (in Espace.Jeux).
type EspaceJeux struct {
	// Played: the action scored last (its id and start): once each time.
	Played string `json:"played,omitempty"`
	// Last: the last one ended unplayed (a late score still counts).
	Last *SpaceLast `json:"last,omitempty"`
	// Best: the best score at each game (by its kind).
	Best map[string]int `json:"best,omitempty"`
}

var (
	errJeuNone     = errors.New("rien à jouer maintenant")
	errJeuNotNow   = errors.New("ce n'est pas le moment de ce jeu")
	errJeuxClosed  = errors.New("bientôt dans le jeu")
	errControleJob = errors.New("la salle de contrôle, c'est pour les contrôleurs et contrôleuses de mission d'Astrélia")
	errControleAt  = errors.New("la salle de contrôle est au siège d'Astrélia (le Plateau) ou au pas de tir d'un spatioport")
)

func init() {
	// Their own game (the phone's components/espace/jeux2), not the gestures'.
	gesteNot = append(gesteNot, game.JeuxActs...)
}

func (s *Sim) jeux() *EspaceJeux {
	e := s.space()
	if e.Jeux == nil {
		e.Jeux = &EspaceJeux{}
	}
	return e.Jeux
}

func jeuKey(a *game.Activity) string { return fmt.Sprintf("%s@%d", a.Interaction.ID, a.Start) }

// controleCheck: the controller's launch (interactAt routes it as the shift): the update open, the career's,
// in a control room.
func (s *Sim) controleCheck(c game.Career, kind string) error {
	if !spaceOpen(game.EspaceKey, game.EspaceJeuxKey) {
		return errJeuxClosed
	}
	if c.ID != game.ControleCareer {
		return errControleJob
	}
	if !slices.Contains(game.ControleRooms, kind) {
		return errControleAt
	}
	return nil
}

// jeuxPlayed: a game played (POST /sims/{id}/espace/jeu): during its action, the points, the mood, the action
// done at once; just after it ended unplayed, what's still due. The line said and the journal.
func (s *Sim) jeuxPlayed(kind string, score int) (string, []Event, error) {
	if !spaceOpen(game.EspaceJeuxKey) {
		return "", nil, errJeuxClosed
	}
	score = max(1, min(100, score))
	v := s.jeux()
	a := s.Activity
	if a == nil || a.Kind != "do" || game.JeuxGames[a.Interaction.ID] != kind {
		if text, ok := s.jeuxLate(kind, score); ok {
			return text, nil, nil
		}
		if a == nil || a.Kind != "do" {
			return "", nil, errJeuNone
		}
		return "", nil, errJeuNotNow
	}
	if v.Played == jeuKey(a) {
		return "Déjà joué cette fois-ci : le score est gardé.", nil, nil
	}
	v.Played = jeuKey(a)
	s.jeuBest(kind, score)
	sk := game.JeuxSkill[a.Interaction.ID]
	events := s.gainSkill(sk.Skill, spaceSkillPoints(a, sk.Rate, s.mood().Score, score))
	text := jeuLine(kind, score)
	if kind == "controle" {
		// The shift, its pay a little less played badly (never more: in its daily cap), its performance.
		if a.Interaction.Cost < 0 {
			a.Interaction.Cost = int(math.Round(float64(a.Interaction.Cost) * (0.6 + 0.4*float64(score)/100)))
		}
		if score >= game.SpaceGamePass {
			s.Performance++
		}
	}
	if score >= game.SpaceGamePass {
		s.addMood(jeuMood(kind), "")
	}
	// The game was the action: done there and then (its good scaled), not left running.
	s.Needs = homeDone(s.Needs, a, score)
	a.End = min(a.End, s.GameMinutes)
	events = append(events, s.advanceTo(s.GameMinutes, newRand())...)
	return text, events, nil
}

// jeuxDone: one of the six's actions over (clock.go finish): unplayed, a little of its points, and kept a while
// for a late score.
func (s *Sim) jeuxDone(a *game.Activity) []Event {
	if a == nil || a.Kind != "do" {
		return nil
	}
	if _, ok := game.JeuxGames[a.Interaction.ID]; !ok {
		return nil
	}
	v := s.jeux()
	if v.Played == jeuKey(a) {
		return nil
	}
	sk := game.JeuxSkill[a.Interaction.ID]
	pts := spaceSkillPoints(a, sk.Rate, s.mood().Score, 1)
	v.Last = &SpaceLast{ID: a.Interaction.ID, End: s.GameMinutes, Points: pts, Minutes: a.Interaction.Minutes}
	return s.gainSkill(sk.Skill, pts)
}

// jeuxLate: a score sent just after its action ended unplayed: what more it gives (never money, nor the shift's
// pay: that was paid as it was).
func (s *Sim) jeuxLate(kind string, score int) (string, bool) {
	v := s.jeux()
	l := v.Last
	if l == nil || game.JeuxGames[l.ID] != kind || s.GameMinutes-l.End > SpaceGameGrace {
		return "", false
	}
	v.Last = nil
	s.jeuBest(kind, score)
	sk := game.JeuxSkill[l.ID]
	a := &game.Activity{Interaction: game.Interaction{ID: l.ID, Minutes: l.Minutes}}
	if more := spaceSkillPoints(a, sk.Rate, s.mood().Score, score) - l.Points; more > 0 {
		s.pending = append(s.pending, s.gainSkill(sk.Skill, more)...)
	}
	if score >= game.SpaceGamePass {
		s.addMood(jeuMood(kind), "")
		if kind == "controle" {
			s.Performance++
		}
	}
	return jeuLine(kind, score), true
}

func (s *Sim) jeuBest(kind string, score int) {
	v := s.jeux()
	if v.Best == nil {
		v.Best = map[string]int{}
	}
	v.Best[kind] = max(v.Best[kind], score)
}

func jeuMood(kind string) string {
	if kind == "controle" {
		return "go-lancement"
	}
	if kind == "serre" || kind == "reparation" {
		return "savant-espace"
	}
	return "pilote-espace"
}

// jeuLine: what's said of a game played (« réussi » from game.SpaceGamePass; else, PG, « on recommence »).
func jeuLine(kind string, score int) string {
	ok := score >= game.SpaceGamePass
	switch kind {
	case "amarrage":
		if ok {
			return fmt.Sprintf("Amarrage réussi (%d/100) : les crochets se ferment, la station t'accueille.", score)
		}
		return fmt.Sprintf("Amarrage manqué (%d/100) : la Pirogue recule tranquillement, on recommencera.", score)
	case "alunissage":
		if ok {
			return fmt.Sprintf("Posé en douceur (%d/100) : le module se pose comme une plume sur la Base Clair-de-Terre.", score)
		}
		return fmt.Sprintf("Remise des gaz (%d/100) : l'ordinateur reprend la main et se pose à ta place. On recommence.", score)
	case "margouillat":
		if ok {
			return fmt.Sprintf("Balise atteinte (%d/100) : le Margouillat rentre couvert de poussière grise.", score)
		}
		return fmt.Sprintf("Le Margouillat rentre à la base (%d/100) : la balise attendra la prochaine sortie.", score)
	case "serre":
		if ok {
			return fmt.Sprintf("La serre tient bon (%d/100) : manioc et piment pour toute la colonie.", score)
		}
		return fmt.Sprintf("Une petite récolte (%d/100) : la serre repartira mieux au prochain cycle.", score)
	case "reparation":
		if ok {
			return fmt.Sprintf("Module changé (%d/100) : le panneau solaire recharge, retour au sas sain et sauf.", score)
		}
		return fmt.Sprintf("Retour au sas (%d/100) : le module attendra la prochaine sortie, personne n'a rien.", score)
	case "controle":
		if ok {
			return fmt.Sprintf("Lancement suivi (%d/100) : tes « go » tombaient pile, la salle applaudit.", score)
		}
		return fmt.Sprintf("Lancement reporté (%d/100) : la directrice de vol reprend le décompte, on recommencera.", score)
	}
	return fmt.Sprintf("Score %d/100.", score)
}

// testerEspaceJeux: the testers' shortcut: a mission controller at the siège (the control room's launch).
func (s *Sim) testerEspaceJeux(action string) ([]Event, bool, error) {
	if action != "espace-controleur" {
		return nil, false, nil
	}
	if s.Activity != nil {
		return nil, true, game.ErrBusy
	}
	if s.inSpace() {
		return nil, true, errInSpace
	}
	if s.Career != game.ControleCareer || s.CareerLevel == 0 {
		s.Career, s.CareerLevel = game.ControleCareer, 1
	}
	s.City, s.Commune = "abidjan", "plateau"
	return []Event{{Kind: "life", Text: "Testeur : te voilà contrôleur·se de mission, au siège d'Astrélia (le Plateau).", GameTime: s.GameMinutes}}, true, nil
}
