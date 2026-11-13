package sims

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// La cuisine ivoirienne at home (game/cuisine.go): a recipe cooked in one's own kitchen from the
// ingredients bought at the market into the fridge, played as its little game like every action, and
// shared with the house if one likes (the partner living there, a visitor at the table: their
// friendship; everyone's mood).

var (
	errNotOnCarte  = errors.New("ce n'est pas sur la carte d'ici")
	errNotMarket   = errors.New("les ingrédients, c'est au marché (Adjamé, Treichville ou celui du quartier)")
	errCookAtHome  = errors.New("on cuisine chez soi, dans sa cuisine")
	errCuisineSoon = errors.New("bientôt dans le jeu")
)

// cuisineOpen: the update open (without a store, the tests: open).
func cuisineOpen(ctx context.Context) bool {
	return features.Default == nil || features.Default.BlocksKey(ctx, game.CuisineKey) == ""
}

// canCook: whether the recipe can be cooked now, with what's in the fridge (or what's missing).
func (s *Sim) canCook(id string, stock map[string]int) error {
	r, ok := game.FindRecipe(id)
	if !ok {
		return errors.New("recette inconnue")
	}
	if !cuisineOpen(context.Background()) {
		return errCuisineSoon
	}
	if s.City != s.HomeCity || s.Commune != s.HomeCommune {
		return errCookAtHome
	}
	if s.Housing != game.OwnHouse || game.FridgeRoom(s.Furnished) == 0 {
		return errNoFridge
	}
	missing := r.Missing(stock)
	if len(missing) == 0 {
		return nil
	}
	var names []string
	for _, g := range game.Ingredients {
		if n := missing[g.ID]; n > 0 {
			if n > 1 {
				names = append(names, fmt.Sprintf("%d × %s", n, g.Label))
			} else {
				names = append(names, g.Label)
			}
		}
	}
	return fmt.Errorf("il te manque : %s (au marché, pour ton frigo)", strings.Join(names, ", "))
}

// cook: the recipe started: its ingredients out of the fridge (what it yields in), and shared with the house.
func (s *Sim) cook(ctx context.Context, tx pgx.Tx, id string, stock map[string]int, share bool) error {
	r, _ := game.FindRecipe(id)
	r.Cook(stock)
	if err := writeFridge(ctx, tx, s.ID, stock); err != nil {
		return err
	}
	if share && s.Activity != nil {
		s.shareMeal(r)
	}
	return nil
}

// shareMeal: the plate shared with the house: more for the mood and the company, and those at the
// table like you a little more.
func (s *Sim) shareMeal(r game.Recipe) {
	it := &s.Activity.Interaction
	it.Effect = it.Effect.Add(game.Shared)
	it.Label = fmt.Sprintf("%s (partagé avec la maison)", r.Label)
	for _, f := range []*game.Friend{s.partnerHome(), s.visitFriend()} {
		if f != nil {
			f.Friendship = min(100, f.Friendship+game.SharedFriendship)
		}
	}
	s.addMood("bon-moment", "")
}

// fillPantry: ingredients bought at the market, n of one (at that market's price), as far as the fridge holds.
func (s *Sim) fillPantry(stock map[string]int, g game.Ingredient, n int) (int, error) {
	if !cuisineOpen(context.Background()) {
		return 0, errCuisineSoon
	}
	if s.Activity == nil || s.Activity.Interaction.ID != "buy-food" || s.Activity.PlaceKind != "market" {
		return 0, errNotMarket
	}
	room := game.FridgeRoom(s.Furnished)
	if s.Housing != game.OwnHouse || room == 0 {
		return 0, errNoFridge
	}
	if n < 1 || game.FridgeCount(stock)+n > room {
		return 0, errFridgeFull
	}
	cost := game.IngredientPrice(g, s.Activity.PlaceID) * n
	if s.Money < cost {
		return 0, game.ErrNotEnoughMoney
	}
	s.Money -= cost
	stock[g.ID] += n
	return cost, nil
}
