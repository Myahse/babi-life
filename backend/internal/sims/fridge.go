package sims

import (
	"context"
	"encoding/json"
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

// The fridge one fills (game/fridge.go): bought while doing the shopping at
// the market or the supermarket, kept in the house's fridge, taken out and
// eaten (or drunk) at home. Kept in sims.fridge, apart from the Sim, like the
// wardrobe's clothes.

var (
	errNoFridge     = errors.New("il te faut un frigo dans ta maison (appli Logement, Ma maison)")
	errFridgeFull   = errors.New("ton frigo est plein")
	errNotShopping  = errors.New("le frigo se remplit en faisant le marché ou les courses")
	errNoGrocery    = errors.New("on ne vend pas ça ici")
	errFridgeEmpty  = errors.New("il n'y en a plus dans ton frigo")
	errFridgeAtHome = errors.New("le frigo est chez toi : rentre d'abord")
)

func readFridge(ctx context.Context, tx pgx.Tx, simID string) (map[string]int, error) {
	var raw []byte
	if err := tx.QueryRow(ctx, `SELECT fridge FROM sims WHERE id = $1`, simID).Scan(&raw); err != nil {
		return nil, err
	}
	stock := map[string]int{}
	_ = json.Unmarshal(raw, &stock)
	return stock, nil
}

func writeFridge(ctx context.Context, tx pgx.Tx, simID string, stock map[string]int) error {
	for id, n := range stock {
		if n <= 0 {
			delete(stock, id)
		}
	}
	raw, _ := json.Marshal(stock)
	_, err := tx.Exec(ctx, `UPDATE sims SET fridge = $2 WHERE id = $1`, simID, raw)
	return err
}

// fridgeOf: GET /sims/{id}/fridge, what's in it and how much it holds.
func (h *Handler) fridgeOf(w http.ResponseWriter, r *http.Request) {
	var raw []byte
	var furnished []string
	if err := h.DB.QueryRow(r.Context(), `SELECT fridge, furnished FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())).Scan(&raw, &furnished); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	stock := map[string]int{}
	_ = json.Unmarshal(raw, &stock)
	httpx.JSON(w, http.StatusOK, map[string]any{"stock": stock, "room": game.FridgeRoom(furnished)})
}

// fillFridge: the things bought, n of one, while shopping (its price each), as far as the fridge holds.
func (s *Sim) fillFridge(stock map[string]int, g game.Grocery, n int) error {
	if s.Activity == nil || !slices.Contains(game.FridgeShopping, s.Activity.Interaction.ID) {
		return errNotShopping
	}
	room := game.FridgeRoom(s.Furnished)
	if s.Housing != game.OwnHouse || room == 0 {
		return errNoFridge
	}
	if n < 1 || game.FridgeCount(stock)+n > room {
		return errFridgeFull
	}
	if s.Money < g.Price*n {
		return game.ErrNotEnoughMoney
	}
	s.Money -= g.Price * n
	stock[g.ID] += n
	return nil
}

// fridgeBuy: POST /sims/{id}/fridge/buy {item, n}.
func (h *Handler) fridgeBuy(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Item string `json:"item"`
		N    int    `json:"n"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	if features.Default.BlocksKey(ctx, game.FridgeKey) != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	g, ok := game.FindGrocery(req.Item)
	if !ok {
		httpx.Error(w, http.StatusNotFound, errNoGrocery.Error())
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		stock, err := readFridge(ctx, tx, s.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if err := s.fillFridge(stock, g, max(1, req.N)); err != nil {
			return game.Outcome{}, nil, err
		}
		if err := writeFridge(ctx, tx, s.ID, stock); err != nil {
			return game.Outcome{}, nil, err
		}
		cost := g.Price * max(1, req.N)
		text := fmt.Sprintf("Pour le frigo : %d × %s (%s Djai).", max(1, req.N), g.Label, money(cost))
		return game.Outcome{Text: text, Money: -cost}, []Event{{Kind: "money", Text: text, Money: -cost, GameTime: s.GameMinutes}}, nil
	})
}

// eatFromFridge: one taken out, eaten at home as an activity.
func (s *Sim) eatFromFridge(stock map[string]int, g game.Grocery) error {
	if s.Housing != game.OwnHouse || game.FridgeRoom(s.Furnished) == 0 {
		return errNoFridge
	}
	if s.City != s.HomeCity || s.Commune != s.HomeCommune {
		return errFridgeAtHome
	}
	if stock[g.ID] < 1 {
		return errFridgeEmpty
	}
	if err := s.start(game.FromFridge(g), HomePlaceID, "home", "Chez toi", nil, ""); err != nil {
		return err
	}
	stock[g.ID]--
	return nil
}

// fridgeEat: POST /sims/{id}/fridge/eat {item}.
func (h *Handler) fridgeEat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Item string `json:"item"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	if features.Default.BlocksKey(ctx, game.FridgeKey) != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	g, ok := game.FindGrocery(req.Item)
	if !ok {
		httpx.Error(w, http.StatusNotFound, errFridgeEmpty.Error())
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		stock, err := readFridge(ctx, tx, s.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if err := s.eatFromFridge(stock, g); err != nil {
			return game.Outcome{}, nil, err
		}
		if err := writeFridge(ctx, tx, s.ID, stock); err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: s.Activity.Interaction.Label + ", bon appétit !"}, nil, nil
	})
}
