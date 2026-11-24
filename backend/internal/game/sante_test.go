package game

import "testing"

// The risks follow the Sim (the night, the net, the hygiene, the tiredness, a senior); the roll catches; the drain grows with the stage.
func TestSante(t *testing.T) {
	ok := Needs{Hunger: 80, Energy: 80, Hygiene: 80, Social: 80, Fun: 80}
	day := SickRisk(ok, false, false, false)
	if day["typhoide"] != 0 || day["ventre"] != 0 || day["palu"] <= 0 {
		t.Fatalf("well and clean: %v", day)
	}
	if n := SickRisk(ok, false, false, true); n["palu"] != day["palu"]*2 {
		t.Fatalf("night palu %v", n["palu"])
	}
	if n := SickRisk(ok, false, true, true); n["palu"] >= day["palu"] {
		t.Fatalf("a net keeps it away: %v", n["palu"])
	}
	dirty := SickRisk(Needs{Hunger: 80, Energy: 10, Hygiene: 10, Social: 80, Fun: 80}, true, false, false)
	if dirty["ventre"] <= 0 || dirty["typhoide"] <= 0 || dirty["grippe"] <= day["grippe"] {
		t.Fatalf("dirty and worn out: %v", dirty)
	}
	if SickRoll(day, 5, func() float64 { return 0.99 }) != "" {
		t.Fatal("caught on a high roll")
	}
	if SickRoll(day, 5, func() float64 { return 0 }) != "palu" {
		t.Fatal("not caught on a zero roll")
	}
	pal, _ := FindSickness("palu")
	if d1, d3 := SickDrain(pal, SickLight, 2), SickDrain(pal, SickGrave, 2); d3.Energy != 3*d1.Energy || d1.Energy >= 0 {
		t.Fatalf("drain %v %v", d1, d3)
	}
	if _, ok := Kinds["pharmacie"].Interaction(MoustiquaireID); !ok {
		t.Fatal("no net at the pharmacy")
	}
}
