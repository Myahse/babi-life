package sims

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/myahse/babi-life/backend/internal/adminkey"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The testers' toolbox (web/src/components/TesterTools.tsx): before launch,
// the team plays everything without waiting. With the testers' code (typed
// on /testeur) or the admin key, a Sim can jump to any age, get Djai, have
// its needs full, finish what it is doing now and get every phone app.

// TesterCodeSHA256: the SHA-256 of the testers' code, as in web/src/lib/launch.ts.
// The code itself is never in the repository.
const TesterCodeSHA256 = "92b21e0ee6aa63de70e43ad4d37d005b992d0c44837a0e4f6ad4773123971e4d"

// TesterMaxMoney: the most Djai one tap gives.
const TesterMaxMoney = 10_000_000

var errNotTester = errors.New("réservé aux testeurs : entre le code sur /testeur")

// testerPass: the testers' code or the admin key.
func testerPass(pass string) bool {
	pass = strings.TrimSpace(pass)
	if pass == "" {
		return false
	}
	sum := sha256.Sum256([]byte(strings.ToLower(pass)))
	if hex.EncodeToString(sum[:]) == TesterCodeSHA256 {
		return true
	}
	return adminkey.Master != "" && subtle.ConstantTimeCompare([]byte(pass), []byte(adminkey.Master)) == 1
}

// TesterAction is a tap in the toolbox.
type TesterAction struct {
	Action string `json:"action"` // age, money, needs, finish, apps
	Stage  string `json:"stage"`  // for age: game.Stage* id
	Amount int    `json:"amount"` // for money
}

func (h *Handler) tester(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Pass string `json:"pass"`
		TesterAction
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if !testerPass(req.Pass) {
		httpx.Error(w, http.StatusForbidden, errNotTester.Error())
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		events, err := s.testerDo(req.TesterAction)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		out := game.Outcome{}
		for _, e := range events {
			out.Money += e.Money
		}
		if len(events) > 0 {
			out.Text = events[len(events)-1].Text
		}
		return out, events, nil
	})
}

func (s *Sim) testerDo(a TesterAction) ([]Event, error) {
	switch a.Action {
	case "age":
		return s.testerAge(a.Stage)
	case "money":
		n := min(max(a.Amount, 1), TesterMaxMoney)
		s.Money += n
		return []Event{{Kind: "life", Text: fmt.Sprintf("Testeur : %s ajoutés.", game.FCFA(n)), Money: n, GameTime: s.GameMinutes}}, nil
	case "needs":
		s.Needs = game.Needs{Hunger: 100, Energy: 100, Hygiene: 100, Social: 100, Fun: 100}
		return []Event{{Kind: "life", Text: "Testeur : tous les besoins au maximum.", GameTime: s.GameMinutes}}, nil
	case "finish":
		a := s.Activity
		if a == nil {
			return nil, fmt.Errorf("ton perso ne fait rien")
		}
		s.Needs = a.Progress(s.Needs, s.GameMinutes, a.End)
		return s.finish(newRand()), nil
	case "apps":
		if !s.hasPhone() {
			return nil, errNoPhoneYet
		}
		for _, p := range world.PhoneApps {
			if !slices.Contains(s.Apps, p.ID) {
				s.Apps = append(s.Apps, p.ID)
			}
		}
		return []Event{{Kind: "life", Text: "Testeur : toutes les applis sont installées.", GameTime: s.GameMinutes}}, nil
	}
	return nil, fmt.Errorf("action testeur inconnue")
}

// testerAge: the Sim is now at the start of a stage. Growing up goes through
// what happens on the way (birthdays, the phone at 12, leaving home at 18),
// as if the time had passed; going back just changes the birth date.
func (s *Sim) testerAge(stage string) ([]Event, error) {
	i := slices.IndexFunc(game.Stages, func(st game.Stage) bool { return st.ID == stage })
	if i < 0 {
		return nil, fmt.Errorf("âge inconnu")
	}
	old := s.GameMinutes - s.BornAt
	if s.BornAt == 0 {
		old = game.MinutesToAge(game.AdultAge) // a Sim from before births is an adult
	}
	if s.Family == "" {
		s.Family = "poignon" // leaving home at 18 needs a family
	}
	to := game.MinutesToAge(float64(game.Stages[i].From))
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
	text := fmt.Sprintf("Testeur : %s est maintenant %s (%d ans).", s.FirstName, strings.ToLower(game.Stages[i].Label), s.age())
	if s.age() == 0 {
		text = fmt.Sprintf("Testeur : %s est de nouveau un bébé.", s.FirstName)
	}
	return append(events, Event{Kind: "life", Text: text, GameTime: s.GameMinutes}), nil
}
