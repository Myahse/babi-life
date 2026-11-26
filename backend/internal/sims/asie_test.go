package sims

import (
	"math/rand/v2"
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/world"
)

// Asia (world/asie.go): Abidjan to Canton by plane only; Tokyo to Kyoto on Lumio from Tokyo station, landing at
// Kyoto's; no Lumio to Seoul; a player in Xiaobei is born there.
func TestAsieTravel(t *testing.T) {
	gz := mustCity(t, "canton")
	xb, _ := gz.Commune("gz-xiaobei")
	s := newSim()
	s.Commune, s.Money = "port-bouet", 5_000_000
	if err := s.leaveWith(gz, xb, Ride{}, rand.New(rand.NewPCG(1, 1))); err == nil || !strings.Contains(err.Error(), "avion") {
		t.Fatalf("by road to Canton: %v", err)
	}
	if err := s.leaveWith(gz, xb, Ride{App: "avion"}, rand.New(rand.NewPCG(1, 1))); err != nil || s.Activity.Trip.Commune != "gz-aeroport" {
		t.Fatalf("flight to Canton: %v %+v", err, s.Activity.Trip)
	}
	b := newSim()
	b.City, b.Commune, b.Money, b.GameMinutes = "tokyo", "tokyo-shibuya", 1_000_000, 8*60
	kyoto := mustCity(t, "kyoto")
	gion, _ := kyoto.Commune("kyoto-higashiyama")
	if err := b.leaveWith(kyoto, gion, Ride{App: world.AsiaRailApp}, rand.New(rand.NewPCG(1, 1))); err == nil {
		t.Fatal("Lumio from Shibuya, not the station")
	}
	b.Commune = "tokyo-chiyoda"
	if err := b.leaveWith(kyoto, gion, Ride{App: world.AsiaRailApp}, rand.New(rand.NewPCG(1, 1))); err != nil {
		t.Fatal(err)
	}
	if tr := b.Activity.Trip; tr.Mode != "train" || tr.Company != world.AsiaRailCompany || tr.Place != "kyoto-gare" || tr.Fare < 20000 {
		t.Fatalf("Lumio to Kyoto: %+v", tr)
	}
	seoul := mustCity(t, "seoul")
	if err := b.leaveWith(seoul, seoul.Communes[0], Ride{App: world.AsiaRailApp}, rand.New(rand.NewPCG(1, 1))); err == nil {
		t.Fatal("a Lumio to Seoul")
	}
	lat, lng := 23.1386, 113.2779 // Tianxiu building
	if city, cm := birthplace(&lat, &lng, "", "", newRand(), nil); city != "canton" || cm != "gz-xiaobei" {
		t.Errorf("born in Xiaobei: %s %s", city, cm)
	}
}
