package sims

import (
	"fmt"
	"net/http"
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// La vie là-haut (workstream D of l'espace; game/espaceActs.go; web world3d/espace, components/espace/SortieEVA):
// what an action up there does once done (spaceDone, the socle's hook in espace.go): the skill points of the
// experiments and the spacewalk (more when its mini-game went well), the mood of a photo, the family's gauges
// raised by a call from orbit, and the messages from Mars that reach the Earth 12 minutes later (and the family's
// answer 12 minutes after that). Never money: nothing up there pays, nothing costs (docs/economie.md).

// EspaceVie: what the life up there keeps (in Espace.Vie).
type EspaceVie struct {
	// Mail: the messages on their way between Mars and the Earth (delivered by settleRange: spaceMail).
	Mail []SpaceMail `json:"mail,omitempty"`
	// Score, ScoreFor, ScoreAt: the mini-game played during the action now (its id, its start): once each time.
	Score    int    `json:"score,omitempty"`
	ScoreFor string `json:"scoreFor,omitempty"`
	ScoreAt  int64  `json:"scoreAt,omitempty"`
	// Last: the last action with a mini-game that ended unplayed (its id, its end, the points it gave, its
	// minutes): a score sent a little after (the game still open as it ended) still counts (spacePlayed).
	Last *SpaceLast `json:"last,omitempty"`
	// BestEVA: the best spacewalk; Walks, Photos, Experiments: how many done.
	BestEVA     int `json:"bestEva,omitempty"`
	Walks       int `json:"walks,omitempty"`
	Photos      int `json:"photos,omitempty"`
	Experiments int `json:"experiments,omitempty"`
}

// SpaceLast: an action with a mini-game, ended before its game was played to the end.
type SpaceLast struct {
	ID      string `json:"id"`
	End     int64  `json:"end"`
	Points  int    `json:"points"`
	Minutes int64  `json:"minutes"`
}

// SpaceGameGrace: how long (game minutes) after its action a mini-game's score still counts.
const SpaceGameGrace = 30

// SpaceMail: a message on its way (At: the game minute it arrives).
type SpaceMail struct {
	At    int64  `json:"at"`
	Text  string `json:"text"`
	Reply bool   `json:"reply,omitempty"`
}

func (s *Sim) spaceVie() *EspaceVie {
	e := s.space()
	if e.Vie == nil {
		e.Vie = &EspaceVie{}
	}
	return e.Vie
}

func init() { spaceDone = espaceDone }

// espaceDone: an action up there over (espace.go spaceFinish calls it).
func espaceDone(s *Sim, a *game.Activity) []Event {
	id := a.Interaction.ID
	v := s.spaceVie()
	score := 0
	if v.ScoreFor == id && v.ScoreAt == a.Start {
		score = v.Score
	}
	v.Score, v.ScoreFor, v.ScoreAt = 0, "", 0
	var events []Event
	say := func(text string) { events = append(events, Event{Kind: "life", Text: text, GameTime: s.GameMinutes}) }
	switch id {
	case game.SpacewalkID:
		v.Walks++
		s.addMood("sortie-eva", "")
		if score >= game.SpaceGamePass {
			say(fmt.Sprintf("Sortie réussie (%d/100) : le panneau solaire est réparé, la station te dit merci.", score))
		} else {
			say("Retour au sas : la sortie est finie, tout le monde est rentré sain et sauf.")
		}
	case game.PhotoTerreID, game.PhotoLuneID, game.PhotoMarsID:
		v.Photos++
		s.addMood("photo-espace", "")
		say("Belle photo de l'espace : publie-la sur Babigram avec le bouton de la scène.")
	case game.StationCallID, game.CruiseCallID:
		s.familyCheered(20)
		say("La famille a entendu ta voix depuis l'espace : toute la maison a le sourire.")
	case game.MarsMessageID:
		at := s.GameMinutes + game.MarsLag
		v.Mail = append(v.Mail,
			SpaceMail{At: at, Text: "Ton message de Mars est arrivé à la maison, 12 minutes plus tard : on l'écoute en boucle, même au grin du quartier."},
			SpaceMail{At: at + game.MarsLag, Text: "Réponse de la maison, partie il y a 12 minutes : « On est fiers de toi ! Mange bien là-haut, et rapporte-nous un caillou rouge. »", Reply: true})
		say(fmt.Sprintf("Message envoyé vers la Terre : il y sera dans %d minutes.", game.MarsLag))
	}
	if _, ok := game.SpaceGames[id]; ok && id != game.SpacewalkID {
		v.Experiments++
		if score >= game.SpaceGamePass {
			s.addMood("savant-espace", "")
		}
	}
	v.Last = nil
	if sk, ok := game.SpaceSkill[id]; ok {
		pts := spaceSkillPoints(a, sk.Rate, s.mood().Score, score)
		events = append(events, s.gainSkill(sk.Skill, pts)...)
		if _, played := game.SpaceGames[id]; played && score == 0 {
			v.Last = &SpaceLast{ID: id, End: s.GameMinutes, Points: pts, Minutes: a.Interaction.Minutes}
		}
	}
	return events
}

// spaceLate: a mini-game's score sent just after its action ended (the game was still open): the points it adds
// to what the action gave, its mood, its line. False when there's no such action to score.
func (s *Sim) spaceLate(kind string, score int, air bool) (string, bool) {
	v := s.spaceVie()
	l := v.Last
	if l == nil || game.SpaceGames[l.ID] != kind || s.GameMinutes-l.End > SpaceGameGrace {
		return "", false
	}
	v.Last = nil
	score = max(1, min(100, score))
	sk := game.SpaceSkill[l.ID]
	a := &game.Activity{Interaction: game.Interaction{ID: l.ID, Minutes: l.Minutes}}
	if more := spaceSkillPoints(a, sk.Rate, s.mood().Score, score) - l.Points; more > 0 {
		s.pending = append(s.pending, s.gainSkill(sk.Skill, more)...)
	}
	if kind != "eva" {
		if score >= game.SpaceGamePass {
			s.addMood("savant-espace", "")
		}
		return fmt.Sprintf("Expérience notée %d/100 : les points sont comptés.", score), true
	}
	v.BestEVA = max(v.BestEVA, score)
	if air {
		return fmt.Sprintf("Oxygène à zéro : retour au sas, tranquillement (%d/100). Personne n'a rien.", score), true
	}
	if score >= game.SpaceGamePass {
		return fmt.Sprintf("Sortie réussie (%d/100) : le panneau solaire est réparé, la station te dit merci.", score), true
	}
	return fmt.Sprintf("Retour au sas : sortie notée %d/100.", score), true
}

// spaceSkillPoints: the points an action up there gives (as game.SkillGain: a minute's worth times its rate, the
// mood's factor; a mini-game played counts, from 0.6 to 1.2 times).
func spaceSkillPoints(a *game.Activity, rate float64, mood, score int) int {
	g := 15 * float64(max(1, a.Interaction.Minutes)) * rate * game.MoodFactor(mood)
	if score > 0 {
		g *= 0.6 + 0.6*float64(score)/100
	}
	return max(1, int(g+0.5))
}

// familyCheered: the household's gauges (foyer.go) raised: their Social, by this much.
func (s *Sim) familyCheered(social float64) {
	members := s.houseMembers()
	if len(members) == 0 {
		return
	}
	s.houseSync()
	for _, m := range members {
		s.Life.House[m] = s.Life.House[m].Add(game.Needs{Social: social})
	}
}

// spaceMail: the messages due by `to` delivered (clock.go settleRange), on Earth or up there.
func (s *Sim) spaceMail(to int64) []Event {
	e := s.Life.Espace
	if e == nil || e.Vie == nil || len(e.Vie.Mail) == 0 {
		return nil
	}
	var events []Event
	e.Vie.Mail = slices.DeleteFunc(e.Vie.Mail, func(m SpaceMail) bool {
		if m.At > to {
			return false
		}
		events = append(events, Event{Kind: "social", Text: m.Text, GameTime: m.At})
		if m.Reply {
			s.Needs = s.Needs.Add(game.Needs{Social: 20})
			s.addMood("nouvelles-terre", "")
		} else {
			s.familyCheered(15)
		}
		return true
	})
	return events
}

// spacePlayed: a mini-game up there played during its action (POST /sims/{id}/espace/jeu): its score kept for
// the action's end (once each time). Air: the oxygen ran out (the spacewalk): back to the airlock, the score as it was.
func (s *Sim) spacePlayed(kind string, score int, air bool) (string, error) {
	a := s.Activity
	if a == nil || a.Kind != "do" || !s.inSpace() || game.SpaceGames[a.Interaction.ID] != kind {
		// Its action just ended while the game was still open: the score still counts.
		if text, ok := s.spaceLate(kind, score, air); ok {
			return text, nil
		}
	}
	if a == nil || a.Kind != "do" || !s.inSpace() {
		return "", fmt.Errorf("rien à jouer maintenant")
	}
	if game.SpaceGames[a.Interaction.ID] != kind {
		return "", fmt.Errorf("ce n'est pas le moment de ce jeu")
	}
	v := s.spaceVie()
	if v.ScoreFor == a.Interaction.ID && v.ScoreAt == a.Start {
		return "Déjà joué cette fois-ci : le score est gardé pour la fin.", nil
	}
	score = max(0, min(100, score))
	v.Score, v.ScoreFor, v.ScoreAt = max(1, score), a.Interaction.ID, a.Start
	if kind != "eva" {
		return fmt.Sprintf("Expérience notée %d/100 : les points comptent à la fin.", score), nil
	}
	v.BestEVA = max(v.BestEVA, score)
	if air {
		return fmt.Sprintf("Oxygène à zéro : retour au sas, tranquillement (%d/100). Personne n'a rien.", score), nil
	}
	return fmt.Sprintf("Retour au sas : sortie notée %d/100.", score), nil
}

// spaceGame: POST /sims/{id}/espace/jeu {kind, score, air}.
func (h *Handler) spaceGame(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind  string `json:"kind"`
		Score int    `json:"score"`
		Air   bool   `json:"air"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		text, err := s.spacePlayed(req.Kind, req.Score, req.Air)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: text}, nil, nil
	})
}

// testerEspaceVie: the testers' shortcuts for the life up there (espaceTester.go): the messages from Mars
// delivered now.
func (s *Sim) testerEspaceVie(action string) ([]Event, bool, error) {
	if action != "espace-courrier" {
		return nil, false, nil
	}
	e := s.Life.Espace
	if e == nil || e.Vie == nil || len(e.Vie.Mail) == 0 {
		return nil, true, fmt.Errorf("aucun message en route")
	}
	evs := s.spaceMail(1 << 62)
	return append([]Event{{Kind: "life", Text: "Testeur : les messages en route sont arrivés.", GameTime: s.GameMinutes}}, evs...), true, nil
}
