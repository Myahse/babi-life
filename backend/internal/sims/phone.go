package sims

import (
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The phone's apps: the store, Waye (mobile money) and Golvo (food delivery).

var (
	errUnknownApp  = errors.New("appli inconnue")
	errNoContact   = errors.New("contact inconnu")
	errNoDish      = errors.New("ce plat n'est pas au menu")
	errNotAbidjan  = errors.New("Golvo ne livre qu'à Abidjan")
	errPlaceClosed = errors.New("ce lieu a fermé")
)

func (s *Sim) hasApp(id string) bool { return slices.Contains(s.Apps, id) }

func needApp(s *Sim, id string) error {
	if !s.hasPhone() {
		return errNoPhoneYet
	}
	if s.hasApp(id) {
		return nil
	}
	a, _ := world.FindPhoneApp(id)
	return fmt.Errorf("installe d'abord %s depuis le Store", a.Name)
}

// install adds or removes an app from the store.
func (s *Sim) install(id string, on bool) error {
	if !s.hasPhone() {
		return errNoPhoneYet
	}
	if _, ok := world.FindPhoneApp(id); !ok {
		return errUnknownApp
	}
	s.Apps = slices.DeleteFunc(s.Apps, func(a string) bool { return a == id })
	if on {
		s.Apps = append(s.Apps, id)
	}
	return nil
}

// send transfers money with Waye: the amount plus a 1 % fee.
func (s *Sim) send(to string, amount int) (Event, error) {
	if err := needApp(s, "waye"); err != nil {
		return Event{}, err
	}
	i := slices.IndexFunc(world.Contacts, func(c world.Contact) bool { return c.ID == to })
	if i < 0 {
		return Event{}, errNoContact
	}
	c := world.Contacts[i]
	if amount < 100 {
		return Event{}, errors.New("100 Djai minimum")
	}
	fee := world.SendFee(amount)
	if s.Money < amount+fee {
		return Event{}, game.ErrNotEnoughMoney
	}
	s.Money -= amount + fee
	// The bigger the gift, the warmer the thanks, up to twice a 5 000 F gift.
	k := min(2, float64(amount)/5000)
	s.Needs = s.Needs.Add(game.Needs{Social: c.Effect.Social * k, Fun: c.Effect.Fun * k})
	text := fmt.Sprintf("Waye : %s envoyés à %s (frais %s).", game.FCFA(amount), c.Name, game.FCFA(fee))
	return Event{Kind: "transfer", Text: text, Money: -(amount + fee), GameTime: s.GameMinutes}, nil
}

// order: the Golvo courier has arrived; the Sim pays and eats where they are.
func (s *Sim) order(placeID, dishID string) error {
	if err := needApp(s, "golvo"); err != nil {
		return err
	}
	city, commune, place, ok := world.FindPlace(placeID)
	if !ok {
		return errors.New("lieu inconnu")
	}
	if city.ID != "abidjan" || s.City != "abidjan" {
		return errNotAbidjan
	}
	if place.Closed != "" {
		return errPlaceClosed
	}
	i := slices.IndexFunc(world.Menus[place.Kind], func(d world.Dish) bool { return d.ID == dishID })
	if i < 0 {
		return errNoDish
	}
	d := world.Menus[place.Kind][i]
	fee, _, ok := world.DeliveryQuote(city.ID, commune.ID, s.Commune)
	if !ok {
		return errNotAbidjan
	}
	it := game.Interaction{ID: "golvo-" + d.ID, Label: d.Label + " (livré par Golvo)", Icon: d.Icon, Minutes: d.Minutes, Cost: d.Price + fee, Effect: d.Effect, MinHour: d.MinHour, MaxHour: d.MaxHour}
	return s.start(it, "golvo", place.Kind, place.Name, nil, "")
}

func (h *Handler) apps(w http.ResponseWriter, r *http.Request) {
	var req struct {
		App     string `json:"app"`
		Install bool   `json:"install"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		if err := s.install(req.App, req.Install); err != nil {
			return game.Outcome{}, nil, err
		}
		a, _ := world.FindPhoneApp(req.App)
		if req.Install {
			return game.Outcome{Text: a.Name + " est installée."}, nil, nil
		}
		return game.Outcome{Text: a.Name + " est désinstallée."}, nil, nil
	})
}

func (h *Handler) send(w http.ResponseWriter, r *http.Request) {
	var req struct {
		To     string `json:"to"`
		Amount int    `json:"amount"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		ev, err := s.send(req.To, req.Amount)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: ev.Text, Money: ev.Money}, []Event{ev}, nil
	})
}

func (h *Handler) order(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Place string `json:"place"`
		Dish  string `json:"dish"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		if err := s.order(req.Place, req.Dish); err != nil {
			return game.Outcome{}, nil, err
		}
		a := s.Activity
		return game.Outcome{Text: fmt.Sprintf("Golvo : %s, bon appétit !", a.Interaction.Label), Money: -a.Interaction.Cost}, nil, nil
	})
}
