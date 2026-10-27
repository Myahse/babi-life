package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestBuyPiece(t *testing.T) {
	s := newSim()
	p, _ := game.FindPiece("denim-classique")
	if _, err := s.buyPiece(p, nil); err != errNotInShop {
		t.Fatalf("out of a shop: %v", err)
	}
	s.Activity = &game.Activity{Interaction: game.Interaction{ID: game.ShopMarketID}}
	if _, err := s.buyPiece(p, nil); err != errPieceShop {
		t.Fatalf("at the market: %v", err)
	}
	s.Activity.Interaction.ID = game.ShopMallID
	money := s.Money
	if said, err := s.buyPiece(p, nil); err != nil || said != "" || s.Money != money-p.Price {
		t.Fatalf("bought: %q %v %d", said, err, s.Money)
	}
	if said, _ := s.buyPiece(p, []string{p.ID}); said == "" || s.Money != money-p.Price {
		t.Fatal("bought twice")
	}
	s.Money = 0
	if _, err := s.buyPiece(p, nil); err != errPieceMoney {
		t.Fatalf("no money: %v", err)
	}
}

func TestPiecesAndPatterns(t *testing.T) {
	seen := map[string]bool{}
	for _, p := range game.Clothes {
		if seen[p.ID] || p.Price <= 0 || (p.Shop != "mall" && p.Shop != "marche") {
			t.Errorf("piece %s", p.ID)
		}
		seen[p.ID] = true
		l := Look{Skin: "#8d5524", HairColor: "#141416", Outfit: p.Outfit, OutfitColor: p.OutfitColor, BottomColor: p.BottomColor, ShoeColor: p.ShoeColor, Accessory: p.Accessory, AccessoryColor: p.AccessoryColor}
		if err := l.validate("femme"); err != nil {
			t.Errorf("%s: %v", p.ID, err)
		}
	}
	if piecePattern("bogolan", nil) == nil || piecePattern("bogolan", []string{"bogolan-chemise"}) != nil || piecePattern("kente", nil) != nil {
		t.Error("the pieces' prints")
	}
}
