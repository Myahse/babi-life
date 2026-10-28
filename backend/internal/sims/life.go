package sims

import (
	"errors"
	"fmt"
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Growing up: birthdays, pocket money while living with the family, marks at
// school, and leaving home at 18.

var (
	errTooSmallToTravel = errors.New("trop petit·e pour prendre la route seul·e")
	errNoPhoneYet       = errors.New("pas encore de téléphone : il arrive à 12 ans")
	errTooYoungToWork   = errors.New("pas de travail avant 18 ans : va à l'école")
)

func (s *Sim) age() int            { return game.AgeAt(s.BornAt, s.GameMinutes) }
func (s *Sim) stage() game.Stage   { return game.StageOf(s.age()) }
func (s *Sim) minor() bool         { return s.age() < game.AdultAge }
func (s *Sim) family() game.Family { f, _ := game.FindFamily(s.Family); return f }

// hasPhone: a phone of one's own comes at 12.
func (s *Sim) hasPhone() bool {
	return s.stage().ID == game.StageAdo || s.stage().ID == game.StageAdulte
}

// growUp says what happened between two game minutes: a new stage, a phone,
// and at 18 the start of adult life.
func (s *Sim) growUp(from, to int64) []Event {
	if s.BornAt == 0 {
		return nil
	}
	var events []Event
	for _, st := range game.Stages[1:] {
		at := s.BornAt + game.MinutesToAge(float64(st.From))
		if at <= from || at > to {
			continue
		}
		switch st.ID {
		case game.StageAdulte:
			events = append(events, s.comeOfAge(at)...)
		case game.StageAdo:
			if !s.hasApp("waye") {
				s.Apps = append(s.Apps, "waye")
			}
			events = append(events, Event{Kind: "life", Text: game.Birthday(s.FirstName, st) + " Premier téléphone, avec Waye dessus.", GameTime: at})
		default:
			events = append(events, Event{Kind: "life", Text: game.Birthday(s.FirstName, st), GameTime: at})
		}
	}
	return events
}

// comeOfAge: the bac (if the marks are there), the family's help, and a home
// of one's own whose rent is due from now on.
func (s *Sim) comeOfAge(at int64) []Event {
	f := s.family()
	gift := f.Start
	var events []Event
	if s.Performance >= game.BacMarks {
		gift += f.BacGift
		events = append(events, Event{Kind: "life", Text: fmt.Sprintf("Bac en poche ! La famille est fière (%s offerts).", game.FCFA(f.BacGift)), Money: f.BacGift, GameTime: at})
	} else {
		events = append(events, Event{Kind: "life", Text: "Pas de bac cette fois. La vie d'adulte commence quand même.", GameTime: at})
	}
	s.Money += gift
	s.Housing = f.Leave
	s.Performance = 0
	h, _ := game.FindHousing(f.Leave)
	events = append(events, Event{Kind: "life", Text: fmt.Sprintf("%s a 18 ans et quitte la maison familiale pour un %s. La famille donne %s pour démarrer.", s.FirstName, h.Label, game.FCFA(f.Start)), Money: f.Start, GameTime: at})
	// The friend from childhood is 18 too: friends still, grown-ups now (childhood.go).
	if b := s.childhoodFriend(); b != nil {
		b.Adult = true
		b.Friendship = min(100, b.Friendship+10)
		events = append(events, Event{Kind: "life", Text: fmt.Sprintf("%s, ton ami d'enfance, a 18 ans aussi. Depuis la crèche, vous ne vous êtes pas lâchés.", b.Name), GameTime: at})
	}
	// The family's mentor takes over (mentor.go).
	if ev := s.mentorIntro(at); ev != nil {
		events = append(events, *ev)
	}
	return events
}

// birthdayShare: a birthday's pocket money is the family's Pocket divided by this.
const birthdayShare = 5

// pocketMoney: while living with the family, each birthday from 3 to 17
// brings a little pocket money. Childhood goes fast (game.GrowUp: a birthday
// every two minutes of play or so), so a birthday is a fifth of the family's
// weekly sum: the whole of it was a fortune by 18, and seemed to come with
// every shower.
func (s *Sim) pocketMoney(from, to int64) []Event {
	f := s.family()
	gift := f.Pocket / birthdayShare / 100 * 100
	if gift == 0 {
		return nil
	}
	n := 0
	for age := 3; age < game.AdultAge; age++ {
		at := s.BornAt + game.MinutesToAge(float64(age))
		if at > from && at <= to {
			n++
		}
	}
	if n == 0 {
		return nil
	}
	s.Money += n * gift
	return []Event{{Kind: "life", Text: fmt.Sprintf("Argent de poche pour l'anniversaire : %s.", game.FCFA(n*gift)), Money: n * gift, GameTime: to}}
}

// schoolMark: class and homework count towards the bac.
func (s *Sim) schoolMark(it game.Interaction) {
	if s.minor() && slices.Contains(game.Schoolwork, it.ID) {
		s.Performance++
	}
}

// ageTo puts the Sim at the start of a stage now (the tester's ages, the
// shop's « tout de suite »); growing older, the birthdays on the way are said
// (and at 18, leaving home).
func (s *Sim) ageTo(st game.Stage) []Event {
	old := s.GameMinutes - s.BornAt
	if s.BornAt == 0 {
		old = game.MinutesToAge(game.AdultAge) // a Sim from before births is an adult
	}
	if s.Family == "" {
		s.Family = "poignon" // leaving home at 18 needs a family
	}
	to := game.MinutesToAge(float64(st.From))
	s.BornAt = s.GameMinutes - to
	if s.BornAt == 0 {
		s.BornAt = -1 // 0 means "no birth date"
	}
	var events []Event
	if to > old {
		events = s.growUp(s.BornAt+old, s.GameMinutes)
		if s.age() < game.AdultAge {
			events = append(events, s.pocketMoney(s.BornAt+old, s.GameMinutes)...)
		}
	}
	return events
}

// grow: the shop's « Enfant / Adulte tout de suite » paid for (shop.give
// sets grow_to): the Sim reaches that stage on its next turn, never younger.
func (s *Sim) grow() []Event {
	st := game.StageByID(s.growing)
	s.growing = ""
	if s.BornAt == 0 || s.age() >= st.From {
		return nil
	}
	return s.ageTo(st)
}
