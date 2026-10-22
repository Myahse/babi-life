package sims

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Vehicles of one's own (game/vehicles.go; web screens/BolideApp.tsx): on the
// Bolide app, a place to keep them is bought in the commune the Sim is in (a
// bike rack, a moto parking, a garage), then a vehicle, kept in a free one of
// them. The Sim drives it in the street (web world3d/drive.ts); at the end of
// a drive the petrol is paid, by the kilometre the phone measured (bounded:
// a drive stays in town). A vehicle sells back for a share of its price.

const (
	driveMax    = 40_000 // metres: the longest drive in town
	vehicleMax  = 12     // vehicles a Sim can have
	parkingsMax = 12
)

var (
	errVehicleModel = errors.New("ce modèle n'existe pas")
	errVehicleColor = errors.New("cette couleur n'existe pas pour ce modèle")
	errNoParking    = errors.New("il te faut d'abord une place pour le garder")
	errVehicle      = errors.New("véhicule introuvable")
	errParkingKind  = errors.New("cette place n'existe pas")
	errGarageFull      = errors.New("tu en as déjà assez")
)

type vehicleRow struct {
	ID      int64   `json:"id"`
	Model   string  `json:"model"`
	Color   string  `json:"color"`
	Parking *int64  `json:"parking"`
	Km      float64 `json:"km"`
}

type parkingRow struct {
	ID      int64  `json:"id"`
	Kind    string `json:"kind"`
	City    string `json:"city"`
	Commune string `json:"commune"`
	Used    int    `json:"used"`
}

type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// garageOf: the Sim's vehicles and places, each place with how many it keeps.
func garageOf(ctx context.Context, db querier, sim string) ([]vehicleRow, []parkingRow, error) {
	rows, err := db.Query(ctx, `SELECT id, model, color, parking, km FROM vehicles WHERE sim_id = $1 ORDER BY id`, sim)
	if err != nil {
		return nil, nil, err
	}
	vs := []vehicleRow{}
	for rows.Next() {
		var v vehicleRow
		if err := rows.Scan(&v.ID, &v.Model, &v.Color, &v.Parking, &v.Km); err != nil {
			rows.Close()
			return nil, nil, err
		}
		vs = append(vs, v)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	rows, err = db.Query(ctx, `SELECT id, kind, city, commune FROM parkings WHERE sim_id = $1 ORDER BY id`, sim)
	if err != nil {
		return nil, nil, err
	}
	ps := []parkingRow{}
	for rows.Next() {
		var p parkingRow
		if err := rows.Scan(&p.ID, &p.Kind, &p.City, &p.Commune); err != nil {
			rows.Close()
			return nil, nil, err
		}
		for _, v := range vs {
			if v.Parking != nil && *v.Parking == p.ID {
				p.Used++
			}
		}
		ps = append(ps, p)
	}
	rows.Close()
	return vs, ps, rows.Err()
}

// freeParking: where a new vehicle of a kind goes: a place for it with room, the one in the
// commune the Sim is in first; nil if there's none.
func freeParking(ps []parkingRow, kind, city, commune string) *parkingRow {
	var any *parkingRow
	for i, p := range ps {
		k, ok := game.FindParkingKind(p.Kind)
		if !ok || k.For != kind || p.Used >= k.Slots {
			continue
		}
		if p.City == city && p.Commune == commune {
			return &ps[i]
		}
		if any == nil {
			any = &ps[i]
		}
	}
	return any
}

// fuelCost: the petrol for a drive (rounded up to 25 Djai), nothing on a bike.
func fuelCost(m game.VehicleModel, metres int) int {
	if m.FuelPerKm == 0 || metres <= 0 {
		return 0
	}
	return int(math.Ceil(float64(metres)/1000*float64(m.FuelPerKm)/25)) * 25
}

// garage: GET: the Sim's vehicles and places.
func (h *Handler) garage(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	vs, ps, err := garageOf(r.Context(), h.DB, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"vehicles": vs, "parkings": ps})
}

// garageAct: POST {…}: "parking" {kind} bought in the commune the Sim is in; "buy" {model,
// color}; "sell" {vehicle}; "drive" {vehicle, metres}: a drive over, its petrol paid.
func (h *Handler) garageAct(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind    string `json:"kind"`
		Model   string `json:"model"`
		Color   string `json:"color"`
		Vehicle int64  `json:"vehicle"`
		Metres  int    `json:"metres"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	action := chi.URLParam(r, "action")
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		vs, ps, err := garageOf(ctx, tx, s.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		switch action {
		case "parking":
			if err := needApp(s, "bolide"); err != nil {
				return game.Outcome{}, nil, err
			}
			k, ok := game.FindParkingKind(req.Kind)
			if !ok {
				return game.Outcome{}, nil, errParkingKind
			}
			if len(ps) >= parkingsMax {
				return game.Outcome{}, nil, errGarageFull
			}
			if s.Money < k.Price {
				return game.Outcome{}, nil, game.ErrNotEnoughMoney
			}
			if _, err := tx.Exec(ctx, `INSERT INTO parkings (sim_id, kind, city, commune) VALUES ($1, $2, $3, $4)`, s.ID, k.ID, s.City, s.Commune); err != nil {
				return game.Outcome{}, nil, err
			}
			s.Money -= k.Price
			return game.Outcome{Text: fmt.Sprintf("%s à toi ici : %d places.", k.Name, k.Slots), Money: -k.Price}, nil, nil
		case "buy":
			if err := needApp(s, "bolide"); err != nil {
				return game.Outcome{}, nil, err
			}
			m, ok := game.FindVehicleModel(req.Model)
			if !ok {
				return game.Outcome{}, nil, errVehicleModel
			}
			if !containsString(m.Colors, req.Color) {
				return game.Outcome{}, nil, errVehicleColor
			}
			if len(vs) >= vehicleMax {
				return game.Outcome{}, nil, errGarageFull
			}
			p := freeParking(ps, m.Kind, s.City, s.Commune)
			if p == nil {
				return game.Outcome{}, nil, errNoParking
			}
			if s.Money < m.Price {
				return game.Outcome{}, nil, game.ErrNotEnoughMoney
			}
			if _, err := tx.Exec(ctx, `INSERT INTO vehicles (sim_id, model, color, parking) VALUES ($1, $2, $3, $4)`, s.ID, m.ID, req.Color, p.ID); err != nil {
				return game.Outcome{}, nil, err
			}
			s.Money -= m.Price
			s.Needs = s.Needs.Add(game.Needs{Fun: 15})
			k, _ := game.FindParkingKind(p.Kind)
			return game.Outcome{Text: fmt.Sprintf("%s t'attend dans ton %s.", m.Name, strings.ToLower(k.Name)), Money: -m.Price}, nil, nil
		case "sell", "drive":
			var v *vehicleRow
			for i := range vs {
				if vs[i].ID == req.Vehicle {
					v = &vs[i]
				}
			}
			if v == nil {
				return game.Outcome{}, nil, errVehicle
			}
			m, _ := game.FindVehicleModel(v.Model)
			if action == "sell" {
				back := int(math.Round(float64(m.Price)*game.ResaleShare/1000)) * 1000
				if _, err := tx.Exec(ctx, `DELETE FROM vehicles WHERE id = $1 AND sim_id = $2`, v.ID, s.ID); err != nil {
					return game.Outcome{}, nil, err
				}
				s.Money += back
				return game.Outcome{Text: fmt.Sprintf("%s revendu.", m.Name), Money: back}, nil, nil
			}
			metres := max(0, min(req.Metres, driveMax))
			cost := min(fuelCost(m, metres), s.Money)
			if _, err := tx.Exec(ctx, `UPDATE vehicles SET km = km + $3 WHERE id = $1 AND sim_id = $2`, v.ID, s.ID, float64(metres)/1000); err != nil {
				return game.Outcome{}, nil, err
			}
			s.Money -= cost
			km := float64(metres) / 1000
			// Riding is good fun; a bike's legs are tired after.
			if m.Kind == "velo" {
				s.Needs = s.Needs.Add(game.Needs{Fun: math.Min(10, km*2), Energy: -math.Min(15, km*3)})
			} else {
				s.Needs = s.Needs.Add(game.Needs{Fun: math.Min(8, km)})
			}
			dist := strings.Replace(fmt.Sprintf("%.1f", km), ".", ",", 1)
			text := fmt.Sprintf("Garé : %s, %s km.", m.Name, dist)
			if cost > 0 {
				text = fmt.Sprintf("Garé : %s, %s km, %s d'essence.", m.Name, dist, game.FCFA(cost))
			}
			return game.Outcome{Text: text, Money: -cost}, nil, nil
		}
		return game.Outcome{}, nil, errors.New("action inconnue")
	})
}

func containsString(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}
