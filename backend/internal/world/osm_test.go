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

func TestInGameBrands(t *testing.T) {
	for in, want := range map[string]string{
		"KFC Yopougon":                 "CFC Yopougon",
		"Sofitel Abidjan Hôtel Ivoire": "Softitel Abidjan Hôtel Ivoire",
		"Gare SOTRA de Yopougon":       "Gare SITRA de Yopougon",
		"Kfcool":                       "Kfcool",
	} {
		if got := InGameName(in); got != want {
			t.Errorf("InGameName(%q) = %q, want %q", in, got, want)
		}
	}
	for _, p := range mapPlaces["yopougon"] {
		if strings.Contains(p.Name, "KFC") {
			t.Errorf("%s still says KFC", p.ID)
		}
	}
}

func TestWorshipNames(t *testing.T) {
	for in, want := range map[string]string{
		"Mosquéu NOUROULOUDHA":            "Mosquée Nourouloudha",
		"mosqée":                          "Mosquée",
		"mosqué Sénégalaise":              "Mosquée Sénégalaise",
		"Eglie Methodiste Rehoboth":       "Église Methodiste Rehoboth",
		"Église évangélique CMA Koumassi": "Église évangélique CMA Koumassi",
	} {
		if got := worshipName(in); got != want {
			t.Errorf("worshipName(%q) = %q, want %q", in, got, want)
		}
	}
	for name, want := range map[string]bool{"Mosquée": false, "Eglise Evangelique": false, "Église Parole de Vie": true, "Mosquée Bilal": true} {
		if got := named(name); got != want {
			t.Errorf("named(%q) = %v, want %v", name, got, want)
		}
	}
}

// A dense commune: all its churches and mosques (a hundred and more), spelt right, a named one once.
func TestKoumassiWorship(t *testing.T) {
	var w []MapPlace
	for _, p := range mapPlaces["koumassi"] {
		if p.Kind == "worship" {
			w = append(w, p)
		}
	}
	if len(w) < 90 {
		t.Fatalf("%d places of worship in Koumassi, want them all (90 and more)", len(w))
	}
	for i, p := range w {
		if strings.Contains(strings.ToLower(p.Name), "mosquéu") {
			t.Errorf("misspelt: %s", p.Name)
		}
		for _, o := range w[i+1:] {
			if named(p.Name) && sameWords(nameWords(p.Name), nameWords(o.Name)) && distKm(p.Lat, p.Lng, o.Lat, o.Lng) < 0.3 {
				t.Errorf("twice: %s", p.Name)
			}
		}
	}
}
