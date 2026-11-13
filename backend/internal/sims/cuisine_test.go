package sims

import (
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func cookSim() *Sim {
	s := &Sim{}
	s.City, s.HomeCity, s.Commune, s.HomeCommune = "abidjan", "abidjan", "yopougon", "yopougon"
	s.Housing, s.Furnished = game.OwnHouse, []string{"frigo"}
	s.Money = 20000
	return s
}

// Cooking at home: with the fridge and its ingredients only, at home only; what's missing is said.
func TestCanCook(t *testing.T) {
	s := cookSim()
	full := map[string]int{"ing-banane": 2, "ing-graine": 1, "ing-poisson": 1, "ing-condiments": 1}
	if err := s.canCook("recette-foutou-graine", full); err != nil {
		t.Fatal(err)
	}
	err := s.canCook("recette-foutou-graine", map[string]int{"ing-banane": 1})
	if err == nil || !strings.Contains(err.Error(), "Graines de palme") || !strings.Contains(err.Error(), "Bananes") {
		t.Errorf("missing: %v", err)
	}
	away := cookSim()
	away.Commune = "cocody"
	if away.canCook("recette-foutou-graine", full) != errCookAtHome {
		t.Error("cooks away from home")
	}
	nofridge := cookSim()
	nofridge.Furnished = nil
	if nofridge.canCook("recette-foutou-graine", full) != errNoFridge {
		t.Error("cooks without a fridge")
	}
	if s.canCook("recette-inconnue", full) == nil {
		t.Error("an unknown recipe")
	}
}

// Shared with the house: more social, a happier partner, the label says so.
func TestShareMeal(t *testing.T) {
	s := cookSim()
	s.Friends = []game.Friend{{ID: "p", Name: "Awa", Partner: true, Home: true, Friendship: 50}}
	r, _ := game.FindRecipe("recette-kedjenou")
	s.Activity = &game.Activity{Kind: "do", Interaction: r.Interaction()}
	s.shareMeal(r)
	it := s.Activity.Interaction
	if it.Effect.Social != r.Effect.Social+game.Shared.Social || !strings.Contains(it.Label, "partagé") {
		t.Errorf("shared: %+v", it)
	}
	if s.Friends[0].Friendship != 50+game.SharedFriendship {
		t.Errorf("partner %d", s.Friends[0].Friendship)
	}
}

// The ingredients are bought at the market only (cheaper at Treichville), as far as the fridge holds.
func TestFillPantry(t *testing.T) {
	s := cookSim()
	g, _ := game.FindIngredient("ing-poulet")
	stock := map[string]int{}
	if _, err := s.fillPantry(stock, g, 1); err != errNotMarket {
		t.Errorf("bought outside the market: %v", err)
	}
	s.Activity = &game.Activity{Kind: "do", PlaceKind: "supermarket", Interaction: game.Interaction{ID: "supermarche"}}
	if _, err := s.fillPantry(stock, g, 1); err != errNotMarket {
		t.Errorf("bought at the supermarket: %v", err)
	}
	s.Activity = &game.Activity{Kind: "do", PlaceID: game.MarcheTreichID, PlaceKind: "market", Interaction: game.Interaction{ID: "buy-food"}}
	cost, err := s.fillPantry(stock, g, 2)
	if err != nil || cost >= 2*g.Price || stock["ing-poulet"] != 2 || s.Money != 20000-cost {
		t.Errorf("Treichville: %d, %v, %v", cost, err, stock)
	}
	if _, err := s.fillPantry(stock, g, 11); err != errFridgeFull {
		t.Errorf("past the fridge's room: %v", err)
	}
}
