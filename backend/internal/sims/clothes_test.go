package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

func TestBuyPiece(t *testing.T) {
	s := newSim()
	p, _ := game.FindPiece("denim-classique")
	if _, err := s.buyPiece(p, nil, false); err != errNotInShop {
		t.Fatalf("out of a shop: %v", err)
	}
	s.Activity = &game.Activity{Interaction: game.Interaction{ID: game.ShopMarketID}}
	if _, err := s.buyPiece(p, nil, false); err != errPieceShop {
		t.Fatalf("at the market: %v", err)
	}
	s.Activity.Interaction.ID = game.ShopMallID
	money := s.Money
	if said, err := s.buyPiece(p, nil, false); err != nil || said != "" || s.Money != money-p.Price {
		t.Fatalf("bought: %q %v %d", said, err, s.Money)
	}
	if said, _ := s.buyPiece(p, []string{p.ID}, false); said == "" || s.Money != money-p.Price {
		t.Fatal("bought twice")
	}
	s.Money = 0
	if _, err := s.buyPiece(p, nil, false); err != errPieceMoney {
		t.Fatalf("no money: %v", err)
	}
}

func TestPiecesAndPatterns(t *testing.T) {
	seen := map[string]bool{}
	for _, p := range game.Clothes {
		if seen[p.ID] || (p.Price <= 0) != (p.Shop == "premium") || (p.Shop != "mall" && p.Shop != "marche" && p.Shop != "exclu" && p.Shop != "premium") {
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

func TestPiecesFromTheApp(t *testing.T) {
	s := newSim()
	p, _ := game.FindPiece("exclu-elephants-or")
	if _, err := s.buyPiece(p, nil, false); err != errNotInShop {
		t.Fatalf("the exclusive out of the app: %v", err)
	}
	s.Money = 1_000_000
	if said, err := s.buyPiece(p, nil, true); err != nil || said != "" {
		t.Fatalf("from the app: %q %v", said, err)
	}
	for _, pk := range game.ClothingPacks {
		for _, id := range pk.Pieces {
			if _, ok := game.FindPiece(id); !ok {
				t.Errorf("%s: %s", pk.ID, id)
			}
		}
		all := game.PackPieces(pk, "femme", nil)
		if sum := game.PackPrice(all); sum <= 0 || len(game.PackPieces(pk, "femme", []string{all[0].ID})) != len(all)-1 {
			t.Errorf("%s: %d", pk.ID, sum)
		}
	}
}
