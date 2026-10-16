package world

import (
	"strings"
	"testing"
)

func TestMapPlacesYopougon(t *testing.T) {
	if n := MapPlaceCount("yopougon"); n < 5000 {
		t.Fatalf("Yopougon has %d places from the map, want thousands", n)
	}
	// Near the commune's centre: nearest first, all within the radius.
	near := MapPlacesNear("yopougon", 5.3450, -4.0820, 0.5, 50)
	if len(near) == 0 {
		t.Fatal("no map place within 500 m of Yopougon's centre")
	}
	for i, p := range near {
		if d := distKm(5.3450, -4.0820, p.Lat, p.Lng); d > 0.5 {
			t.Fatalf("%s is %.2f km away", p.Name, d)
		}
		if i > 0 && distKm(5.3450, -4.0820, near[i-1].Lat, near[i-1].Lng) > distKm(5.3450, -4.0820, p.Lat, p.Lng) {
			t.Fatal("not nearest first")
		}
	}
	// A map place is found like any other (for activities, the phone…).
	c, cm, p, ok := FindPlace(near[0].ID)
	if !ok || c.ID != "abidjan" || cm.ID != "yopougon" || p.Name != near[0].Name || !p.Real || p.Source == nil {
		t.Fatalf("FindPlace(%s) = %v %v %+v %v", near[0].ID, c.ID, cm.ID, p, ok)
	}
	// Hand-made places aren't duplicated by the map's.
	for _, p := range mapPlaces["yopougon"] {
		if p.Name == "CHU de Yopougon" || p.Name == "Place Ficgayo" {
			t.Fatalf("%s (%s) duplicates a hand-made place", p.Name, p.ID)
		}
	}
	if got := SearchMapPlaces("yopougon", "pharmacie", 5); len(got) == 0 {
		t.Fatal("searching « pharmacie » finds nothing")
	}
}

func TestCommissariats(t *testing.T) {
	list := Commissariats("yopougon")
	names := map[string]bool{}
	for _, p := range list {
		names[p.Name] = true
		if p.Kind != "police" {
			t.Fatalf("%s is a %s", p.Name, p.Kind)
		}
	}
	for _, want := range []string{"Commissariat du 16ᵉ Arrondissement", "Commissariat du 23ᵉ Arrondissement", "Commissariat de Police du 19ᵉ Arrondissement"} {
		if !names[want] {
			t.Fatalf("missing %q in %v", want, names)
		}
	}
	for n := range names {
		if strings.Contains(strings.ToLower(n), "gendarmerie") {
			t.Fatalf("a gendarmerie counted as a commissariat: %s", n)
		}
	}
}
