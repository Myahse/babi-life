package sims

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// An outing: the Sim takes friends along (the maquis, the cinema, the beach,
// a court, the club…). The people met in the game answer at once (yes more
// often the closer they are; a partner almost always), and those who come
// are at its side the whole time (Activity.With: the street and the room
// show them). Player friends get an invitation to come and join. The Sim
// invites, so the Sim pays: the bill is for everyone who came.

const (
	// maxOuting: friends at most on one outing.
	maxOuting = 4
	// What each friend who came adds to the outing.
	outingSocial, outingFun = 8, 4
	// outingFriendship: how much closer an outing together brings; a date, more (and more fun).
	outingFriendship = 6
	outingDate       = 10
	outingDateFun    = 6
)

var (
	errOutingWho   = errors.New("choisis au moins un·e ami·e (4 au plus)")
	errOutingWhere = errors.New("on ne sort pas pour ça : choisis un lieu où aller ensemble")
	errOutingBill  = errors.New("pas assez d'argent pour inviter tout le monde")
)

// outingYes: whether a friend met in the game comes along.
func outingYes(f game.Friend, rng *rand.Rand) bool {
	chance := min(0.95, 0.35+float64(f.Friendship)/150)
	if f.Partner {
		chance = 0.95
	}
	return rng.Float64() < chance
}

// outingNo: what a friend says who can't come.
var outingNo = []string{"{name} ne peut pas, le travail", "{name} est déjà pris·e ce soir", "{name} n'a pas répondu", "{name} dit « la prochaine fois, promis ! »"}

// goOut starts the outing for the friends met in the game (ids from
// s.Friends): who came, and what the ones who didn't said.
func (s *Sim) goOut(placeID, interactionID string, friends []string, rng *rand.Rand) (came []game.Friend, refused []string, news string, err error) {
	if placeID == HomePlaceID || placeID == HappeningPlaceID || placeID == "ami" || placeID == "bande" || interactionID == game.WorkInteractionID || interactionID == game.NightID {
		return nil, nil, "", errOutingWhere
	}
	var asked []*game.Friend
	for _, id := range friends {
		f := s.findFriend(id)
		if f == nil || slices.Contains(asked, f) {
			continue
		}
		asked = append(asked, f)
	}
	for _, f := range asked {
		if outingYes(*f, rng) {
			came = append(came, *f)
		} else {
			refused = append(refused, strings.ReplaceAll(outingNo[rng.IntN(len(outingNo))], "{name}", f.Name))
		}
	}
	it, err := s.interactAt(placeID, interactionID)
	if err != nil {
		return nil, nil, "", err
	}
	if !joinable(s.Activity, s.GameMinutes) {
		s.Activity = nil
		return nil, nil, "", errOutingWhere
	}
	// The guests' share of the bill (the Sim's own was paid on starting).
	if bill := max(it.Cost, 0) * len(came); bill > 0 {
		if s.Money < bill {
			return nil, nil, "", errOutingBill
		}
		s.Money -= bill
	}
	a := s.Activity
	names := make([]string, len(came))
	for i, f := range came {
		names[i] = f.Name
		a.With = append(a.With, f.ID)
		g := s.findFriend(f.ID)
		closer := outingFriendship
		if g.Partner {
			closer = outingDate // a date: closer still
		}
		g.Friendship, g.Seen = min(100, g.Friendship+closer), s.GameMinutes
	}
	if len(came) > 0 {
		a.Interaction.Label += " avec " + listNames(names)
		a.Interaction.Effect.Social += float64(outingSocial * len(came))
		a.Interaction.Effect.Fun += float64(outingFun * len(came))
	}
	// Just the two of them: a date.
	if len(came) == 1 && came[0].Partner {
		a.Interaction.Label += " (en amoureux)"
		a.Interaction.Effect.Fun += outingDateFun
	}
	// Out with one while together with another: seen, maybe (cheating.go).
	for _, f := range came {
		if g := s.findFriend(f.ID); g.Partner && news == "" {
			news = s.caught(g, caughtOuting, rng)
		}
	}
	return came, refused, news, nil
}

// listNames: « Awa », « Awa et Yao », « Awa, Yao et Koffi ».
func listNames(n []string) string {
	if len(n) <= 1 {
		return strings.Join(n, "")
	}
	return strings.Join(n[:len(n)-1], ", ") + " et " + n[len(n)-1]
}

// outing: POST {placeId, interactionId, friends: ids of friends met in the
// game, players: Sim ids of player friends}.
func (h *Handler) outing(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PlaceID       string   `json:"placeId"`
		InteractionID string   `json:"interactionId"`
		Friends       []string `json:"friends"`
		Players       []string `json:"players"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if n := len(req.Friends) + len(req.Players); n == 0 || n > maxOuting {
		httpx.Error(w, http.StatusUnprocessableEntity, errOutingWho.Error())
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		rng := newRand()
		came, refused, news, err := s.goOut(req.PlaceID, req.InteractionID, req.Friends, rng)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		a := s.Activity
		names := []string{}
		for _, f := range came {
			names = append(names, f.Name)
		}
		// The player friends: an invitation each, to come and join.
		invited := []string{}
		for _, id := range req.Players {
			o, err := otherSim(ctx, tx, s, id)
			if (err != nil && !errors.Is(err, errNotHere)) || !areFriends(ctx, tx, s.ID, o.ID) {
				continue
			}
			if _, _, err := h.invite(ctx, tx, s, o); err == nil {
				invited = append(invited, o.FirstName)
			}
		}
		// The label already says with whom (goOut).
		text := fmt.Sprintf("Sortie : %s à %s", a.Interaction.Label, a.PlaceName)
		if len(names) == 0 && len(invited) == 0 {
			text += ", tout·e seul·e finalement."
		} else {
			text += "."
		}
		if len(invited) > 0 {
			text += fmt.Sprintf(" Invitation envoyée à %s.", listNames(invited))
		}
		if len(refused) > 0 {
			text += " " + strings.Join(refused, ". ") + "."
		}
		if news != "" {
			text += " " + news
		}
		// A date with someone met in the game, while together with a player: seen, maybe (couple.go).
		for _, f := range came {
			if f.Partner {
				if g := h.gossip(ctx, tx, s, f.Name, caughtOuting, rng); g != "" {
					text += " " + g
					break
				}
			}
		}
		cost := max(a.Interaction.Cost, 0) * (1 + len(came))
		return game.Outcome{Text: text, Money: -cost}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
	})
}
