package sims

import (
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The boutiques' pieces (game/clothes.go): bought one by one while shopping
// there (the activity « Faire les boutiques », « chez les vendeuses de wax »),
// kept in the wardrobe, put on with « Changer de look ».

var (
	errPieceMoney = errors.New("pas assez de Djai pour cette pièce")
	errNotInShop  = errors.New("les pièces s'achètent en boutique : va faire les boutiques d'abord")
	errPieceShop  = errors.New("cette pièce ne se vend pas ici")
)

// clothesList: GET /sims/{id}/clothes, the pieces bought.
func (h *Handler) clothesList(w http.ResponseWriter, r *http.Request) {
	var owned []string
	if err := h.DB.QueryRow(r.Context(), `SELECT clothes FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())).Scan(&owned); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	if owned == nil {
		owned = []string{}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"owned": owned})
}

// buyPiece: in the shop that sells it (or from the phone's Boutique, `app`: any piece, the exclusive
// collection only there), with the money, not had yet.
func (s *Sim) buyPiece(p game.ClothingPiece, owned []string, app bool) (string, error) {
	if !app {
		shop := ""
		if s.Activity != nil {
			shop = game.ShopOf(s.Activity.Interaction.ID)
		}
		if shop == "" {
			return "", errNotInShop
		}
		if p.Shop != shop {
			return "", errPieceShop
		}
	}
	if slices.Contains(owned, p.ID) {
		return fmt.Sprintf("Tu as déjà « %s » dans ta garde-robe.", p.Label), nil
	}
	if p.Gender != "" && p.Gender != s.Gender {
		return "", errors.New("cette pièce n'est pas à ta taille")
	}
	if s.Money < p.Price {
		return "", errPieceMoney
	}
	s.Money -= p.Price
	return "", nil
}

// clothesBuy: POST /sims/{id}/clothes/{piece}.
func (h *Handler) clothesBuy(w http.ResponseWriter, r *http.Request) {
	p, ok := game.FindPiece(chi.URLParam(r, "piece"))
	if !ok {
		httpx.Error(w, http.StatusNotFound, "pièce inconnue")
		return
	}
	ctx := r.Context()
	app := r.URL.Query().Get("app") == "1"
	if features.Default.Blocks(ctx, game.ShopMallID) != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		var owned []string
		if err := tx.QueryRow(ctx, `SELECT clothes FROM sims WHERE id = $1`, s.ID).Scan(&owned); err != nil {
			return game.Outcome{}, nil, err
		}
		said, err := s.buyPiece(p, owned, app)
		if err != nil || said != "" {
			return game.Outcome{Text: said}, nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE sims SET clothes = array_append(clothes, $2) WHERE id = $1`, s.ID, p.ID); err != nil {
			return game.Outcome{}, nil, err
		}
		text := fmt.Sprintf("Acheté : %s, %s (%s Djai). Elle t'attend dans ta garde-robe.", p.Label, p.Brand, money(p.Price))
		return game.Outcome{Text: text, Money: -p.Price}, []Event{{Kind: "money", Text: text, Money: -p.Price, GameTime: s.GameMinutes}}, nil
	})
}

// clothesPack: POST /sims/{id}/clothes/pack/{pack}, from the phone's Boutique: the lot's pieces
// the Sim can wear and hasn't yet, at three quarters of their prices.
func (h *Handler) clothesPack(w http.ResponseWriter, r *http.Request) {
	pk, ok := game.FindClothingPack(chi.URLParam(r, "pack"))
	if !ok {
		httpx.Error(w, http.StatusNotFound, "lot inconnu")
		return
	}
	ctx := r.Context()
	if features.Default.Blocks(ctx, game.ShopMallID) != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		var owned []string
		if err := tx.QueryRow(ctx, `SELECT clothes FROM sims WHERE id = $1`, s.ID).Scan(&owned); err != nil {
			return game.Outcome{}, nil, err
		}
		pieces := game.PackPieces(pk, s.Gender, owned)
		if len(pieces) == 0 {
			return game.Outcome{Text: fmt.Sprintf("Tu as déjà tout le %s.", pk.Label)}, nil, nil
		}
		price := game.PackPrice(pieces)
		if s.Money < price {
			return game.Outcome{}, nil, errPieceMoney
		}
		s.Money -= price
		ids := make([]string, len(pieces))
		for i, c := range pieces {
			ids[i] = c.ID
		}
		if _, err := tx.Exec(ctx, `UPDATE sims SET clothes = clothes || $2::text[] WHERE id = $1`, s.ID, ids); err != nil {
			return game.Outcome{}, nil, err
		}
		text := fmt.Sprintf("Acheté : le %s, %d pièces (%s Djai). Elles t'attendent dans ta garde-robe.", pk.Label, len(pieces), money(price))
		return game.Outcome{Text: text, Money: -price}, []Event{{Kind: "money", Text: text, Money: -price, GameTime: s.GameMinutes}}, nil
	})
}

// piecePattern: a print only the pieces have is worn by those who bought one with it.
func piecePattern(pattern string, owned []string) error {
	if !slices.Contains(game.PiecePatterns, pattern) {
		return nil
	}
	for _, id := range owned {
		if p, ok := game.FindPiece(id); ok && p.Pattern == pattern {
			return nil
		}
	}
	return errors.New("ce motif vient avec une pièce des boutiques")
}
