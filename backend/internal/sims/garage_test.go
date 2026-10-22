package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Petrol by the kilometre, rounded up; nothing on a bike.
func TestFuelCost(t *testing.T) {
	moto, _ := game.FindVehicleModel("moto-baobab")
	velo, _ := game.FindVehicleModel("velo-kodjo")
	if got := fuelCost(moto, 4000); got != 100 {
		t.Errorf("4 km on the Baobab: %d", got)
	}
	if got := fuelCost(moto, 100); got != 25 {
		t.Errorf("100 m on the Baobab: %d", got)
	}
	if got := fuelCost(velo, 9000); got != 0 {
		t.Errorf("a bike: %d", got)
	}
}

// A new vehicle goes into a place for its kind with room, the one in the Sim's commune first.
func TestFreeParking(t *testing.T) {
	ps := []parkingRow{
		{ID: 1, Kind: "garage", City: "abidjan", Commune: "cocody", Used: 2},
		{ID: 2, Kind: "garage", City: "abidjan", Commune: "plateau", Used: 0},
		{ID: 3, Kind: "range-velo", City: "abidjan", Commune: "cocody", Used: 1},
		{ID: 4, Kind: "garage", City: "abidjan", Commune: "yopougon", Used: 1},
	}
	if p := freeParking(ps, "voiture", "abidjan", "cocody"); p == nil || p.ID != 2 {
		t.Errorf("the full garage in Cocody: %+v", p)
	}
	if p := freeParking(ps, "voiture", "abidjan", "yopougon"); p == nil || p.ID != 4 {
		t.Errorf("the garage in Yopougon first: %+v", p)
	}
	if p := freeParking(ps, "moto", "abidjan", "cocody"); p != nil {
		t.Errorf("no moto parking: %+v", p)
	}
}
