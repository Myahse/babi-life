package sims

import (
	"errors"
	"fmt"
	"hash/fnv"
	"math/rand/v2"
	"net/http"
	"slices"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Friends, the street gang and the police.

const custodyPlace = "commissariat"

var (
	errNoFriend      = errors.New("tu ne connais pas cette personne")
	errNoGang        = errors.New("tu n'es pas dans une bande")
	errNoInvite      = errors.New("personne ne t'a proposé de rejoindre une bande")
	errInCustody     = errors.New("tu es au commissariat : attends qu'on te relâche")
	errRecordCareers = errors.New("avec ton casier judiciaire, cette porte est fermée")
)

func friendsOrEmpty(f []game.Friend) []game.Friend {
	if f == nil {
		return []game.Friend{}
	}
	return f
}

// socialize: after doing something with others, maybe a new friend, a
// friend seen again, or (for a poor teenager) the bande coming to talk.
func (s *Sim) socialize(it game.Interaction, rng *rand.Rand) []Event {
	if game.IsSlow(it.ID) {
		return s.slowWith(rng)
	}
	if !slices.Contains(game.SocialInteractions, it.ID) {
		return nil
	}
	var events []Event
	if f, isNew := game.Meet(s.Friends, s.Commune, s.GameMinutes, rng); f != nil {
		if isNew {
			f.Adult = s.stage().ID == game.StageAdulte
			s.Friends = append(s.Friends, *f)
			events = append(events, Event{Kind: "social", Text: fmt.Sprintf("Nouvelle rencontre : %s. Vous avez sympathisé.", f.Name), GameTime: s.GameMinutes})
		} else {
			f.Friendship = min(100, f.Friendship+6)
			f.Seen = s.GameMinutes
		}
	}
	if s.Gang == "" && rng.Float64() < game.GangInviteChance(s.stage().ID, s.Family, s.Performance) {
		s.Gang = "invited"
		events = append(events, Event{Kind: "social", Text: "Des gars du quartier t'ont repéré·e : « Viens avec nous, on va te montrer la vie. » Ils attendent ta réponse (appli Amis).", GameTime: s.GameMinutes})
	}
	return events
}

// slowWith: a slow at the club or a soirée is always danced with someone: a new face (their number
// swapped, then the Amis app, and going out together asked when talking: chat.go) or a friend seen
// again, closer. Together with someone else, word may get back to them, as when flirting.
func (s *Sim) slowWith(rng *rand.Rand) []Event {
	var f *game.Friend
	isNew := false
	for range 20 {
		if f, isNew = game.Meet(s.Friends, s.Commune, s.GameMinutes, rng); f != nil {
			break
		}
	}
	if f == nil {
		return nil
	}
	var text string
	if isNew {
		f.Adult = true
		f.Friendship = min(100, f.Friendship+10)
		s.Friends = append(s.Friends, *f)
		f = &s.Friends[len(s.Friends)-1]
		text = fmt.Sprintf("Un slow avec %s. À la fin, vous avez échangé vos numéros (appli Amis).", f.Name)
	} else {
		f.Friendship = min(100, f.Friendship+8)
		f.Seen = s.GameMinutes
		text = fmt.Sprintf("Un slow avec %s, collé·e·s. Vous vous êtes rapproché·e·s.", f.Name)
	}
	if mine := s.partner(); mine != nil && mine.ID != f.ID && rng.Float64() < caughtFlirt {
		mine.Friendship = max(0, mine.Friendship-15)
		text += " " + strings.NewReplacer("{name}", mine.Name, "{Pronoun}", pronoun(mine)).Replace(flirtHeard[rng.IntN(len(flirtHeard))])
	}
	return []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}
}

func (s *Sim) findFriend(id string) *game.Friend {
	for i := range s.Friends {
		if s.Friends[i].ID == id {
			return &s.Friends[i]
		}
	}
	return nil
}

// meetFriend: a call or time together.
func (s *Sim) meetFriend(id, action string) (game.Interaction, error) {
	f := s.findFriend(id)
	if f == nil {
		return game.Interaction{}, errNoFriend
	}
	i := slices.IndexFunc(game.FriendActions, func(a game.FriendAction) bool { return a.ID == action })
	if i < 0 {
		return game.Interaction{}, errors.New("action inconnue")
	}
	a := game.FriendActions[i]
	if a.Phone && !s.hasPhone() {
		return game.Interaction{}, errNoPhoneYet
	}
	it := game.Interaction{ID: "ami-" + a.ID, Label: fmt.Sprintf("%s %s", a.Label, f.Name), Icon: a.Icon, Minutes: a.Minutes, Cost: a.Cost, Effect: a.Effect, Ages: game.KidsUp}
	if err := it.AllowedFor(s.stage().ID); err != nil {
		return game.Interaction{}, err
	}
	if err := s.start(it, "ami", "social", f.Name, nil, ""); err != nil {
		return game.Interaction{}, err
	}
	f.Friendship = min(100, f.Friendship+a.Friendship)
	f.Seen = s.GameMinutes
	return it, nil
}

// gangAction: answer the invitation, hang out, pull a coup, or walk away.
func (s *Sim) gangAction(action string, rng *rand.Rand) (string, int, error) {
	switch action {
	case "accepter", "refuser":
		if s.Gang != "invited" {
			return "", 0, errNoInvite
		}
		if action == "refuser" {
			s.Gang = ""
			return "Tu as dit non à la bande. Ils reviendront peut-être.", 0, nil
		}
		s.Gang = "member"
		for _, name := range []string{"Bôrô", "Zouzou"} {
			s.Friends = append(s.Friends, game.Friend{ID: "g-" + name, Name: name, Gender: "homme", Seed: rng.IntN(1 << 20), Commune: s.Commune, Friendship: 45, Gang: true, Met: s.GameMinutes, Seen: s.GameMinutes})
		}
		return "Tu fais partie de la bande. Bôrô et Zouzou te présentent aux autres.", 0, nil
	case "quitter":
		if s.Gang != "member" {
			return "", 0, errNoGang
		}
		s.Gang = "left"
		s.Friends = slices.DeleteFunc(s.Friends, func(f game.Friend) bool { return f.Gang })
		s.Needs = s.Needs.Add(game.Needs{Social: -20})
		return "Tu quittes la bande. Les gars ne te parlent plus, mais tu respires.", 0, nil
	case "zoner":
		if s.Gang != "member" {
			return "", 0, errNoGang
		}
		it := game.Interaction{ID: "bande-zoner", Label: "Zoner avec la bande", Icon: "users", Minutes: 90, Effect: game.Needs{Social: 35, Fun: 25, Hygiene: -10}, Ages: game.TeensUp}
		if err := s.start(it, "bande", "social", "La bande", nil, ""); err != nil {
			return "", 0, err
		}
		for i := range s.Friends {
			if s.Friends[i].Gang {
				s.Friends[i].Friendship = min(100, s.Friends[i].Friendship+8)
				s.Friends[i].Seen = s.GameMinutes
			}
		}
		return "Avec la bande au coin de la rue.", 0, nil
	case "coup":
		if s.Gang != "member" {
			return "", 0, errNoGang
		}
		if s.Activity != nil {
			return "", 0, game.ErrBusy
		}
		// One a day for the account (money.go), caught or not.
		if !s.wallet().Can(s.today(), game.FromCoup) {
			return "", 0, game.ErrFull(game.FromCoup)
		}
		s.wallet().Use(s.today(), game.FromCoup)
		money, caught := game.CoupOutcome(s.Record, rng)
		if caught {
			s.Record++
			s.Needs = s.Needs.Add(game.Needs{Fun: -30, Social: -20, Energy: -20})
			it := game.Interaction{ID: "garde-a-vue", Label: "Garde à vue", Icon: "shield", Minutes: game.CustodyMinutes, Ages: game.Everyone}
			where := custodyName(s)
			_ = s.start(it, custodyPlace, "police", where, nil, "")
			return fmt.Sprintf("La police t'a attrapé·e ! Garde à vue au %s, et ça reste sur ton casier.", lowerFirst(where)), 0, nil
		}
		it := game.Interaction{ID: "bande-coup", Label: "Un coup avec la bande", Icon: "zap", Minutes: game.CoupMinutes, Effect: game.Needs{Fun: 15, Energy: -15}, Ages: game.TeensUp}
		if err := s.start(it, "bande", "social", "La bande", nil, ""); err != nil {
			return "", 0, err
		}
		money = s.earn(game.FromCoup, money)
		return fmt.Sprintf("Le coup a marché : %s pour toi. Mais la police a l'œil.", game.FCFA(money)), money, nil
	}
	return "", 0, errors.New("action inconnue")
}

func (h *Handler) friend(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Friend string `json:"friend"`
		Action string `json:"action"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		it, err := s.meetFriend(req.Friend, req.Action)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: it.Label, Money: -it.Cost}, nil, nil
	})
}

func (h *Handler) gang(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Action string `json:"action"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		text, money, err := s.gangAction(req.Action, newRand())
		if err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: text, Money: money}, []Event{{Kind: "social", Text: text, Money: money, GameTime: s.GameMinutes}}, nil
	})
}

// custodyName: where the police take the Sim, a real commissariat of its
// commune on the map (« Commissariat du 16ᵉ Arrondissement »), always the same
// one for the same Sim; « Commissariat » where the map has none.
func custodyName(s *Sim) string {
	list := world.Commissariats(s.Commune)
	if len(list) == 0 {
		return "Commissariat"
	}
	f := fnv.New32a()
	_, _ = f.Write([]byte(s.ID))
	return list[f.Sum32()%uint32(len(list))].Name
}

// lowerFirst: « Commissariat du 16ᵉ… » inside a sentence.
func lowerFirst(s string) string {
	if s == "" {
		return s
	}
	r := []rune(s)
	return strings.ToLower(string(r[0])) + string(r[1:])
}
