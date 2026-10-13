package world

import (
	"strings"
	"testing"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The audit is the "Look to fix" list: errors break the game, warnings are
// facts still to verify. This test fails on errors and prints the summary.
func TestAuditHasNoErrors(t *testing.T) {
	issues := Audit()
	for _, i := range issues {
		if i.Severity == SevError {
			t.Errorf("%s %s: %s", i.Code, i.Ref, i.Message)
		}
	}
	t.Logf("look to fix: %v", Summary(issues))
}

func TestRequestedLocalitiesExist(t *testing.T) {
	abj, _ := FindCity("abidjan")
	for _, id := range []string{"plateau", "cocody", "yopougon", "adjame", "abobo", "treichville", "marcory", "koumassi", "port-bouet", "attecoube", "anyama", "bingerville", "songon"} {
		cm, ok := abj.Commune(id)
		if !ok {
			t.Errorf("Abidjan is missing %s", id)
			continue
		}
		if cm.Admin.Parent != "District autonome d'Abidjan" {
			t.Errorf("%s: parent %q", id, cm.Admin.Parent)
		}
	}
	for _, id := range []string{"yamoussoukro", "bouake", "grand-bassam", "san-pedro", "man", "korhogo", "daloa"} {
		if _, ok := FindCity(id); !ok {
			t.Errorf("missing city %s", id)
		}
	}
}

// IDs saved in players' Sims must keep working.
func TestExistingIDsArePreserved(t *testing.T) {
	for _, id := range []string{"plateau-tours", "cocody-danga", "yop-rue-princesse", "adjame-gare", "treich-palais", "pb-plage", "attecoube-banco", "yakro-basilique", "bouake-stade", "bassam-plage", "sp-port", "man-dent", "korhogo-marche", "daloa-maquis"} {
		if _, _, _, ok := FindPlace(id); !ok {
			t.Errorf("place %s disappeared", id)
		}
	}
	for city, cm := range map[string]string{"yamoussoukro": "yakro-centre", "bouake": "bouake-centre", "grand-bassam": "bassam-france", "san-pedro": "sp-centre", "man": "man-centre", "korhogo": "korhogo-centre", "daloa": "daloa-centre"} {
		c, _ := FindCity(city)
		if _, ok := c.Commune(cm); !ok {
			t.Errorf("commune %s/%s disappeared", city, cm)
		}
	}
}

func TestAuditCatchesProblems(t *testing.T) {
	saved := Cities
	defer func() { Cities = saved }()
	bad := Commune{ID: "x", Name: "X", Blurb: "x", Lat: 5.3, Lng: -4.0, Admin: Admin{Type: "commune", Parent: "District autonome d'Abidjan", Bank: "nord", Mairie: "mairie-x", Source: game.Fictional},
		Places: []Place{
			{ID: "p1", Name: "Marché", Kind: "market", Lat: 5.3, Lng: -4.0, Source: game.Fictional},
			{ID: "p2", Name: "marche", Kind: "market", Lat: 5.3001, Lng: -4.0, Source: game.Fictional},
			{ID: "p3", Name: "Ailleurs", Kind: "nowhere", Lat: 12, Lng: 3, Real: true, Source: game.Unverified("?")},
		}}
	Cities = []City{{ID: "abidjan", Name: "Abidjan", Blurb: "x", Lat: 5.33, Lng: -4.01, Admin: CityAdmin{Type: "district autonome", Source: game.Fictional}, Communes: []Commune{bad}}}
	got := map[string]bool{}
	for _, i := range Audit() {
		if strings.HasPrefix(i.Ref, "place:") || strings.HasPrefix(i.Ref, "commune:") {
			got[i.Code] = true
		}
	}
	for _, code := range []string{CodeMairie, CodeDuplicatePlace, CodeBadReference, CodeGeography, CodeUnverified} {
		if !got[code] {
			t.Errorf("audit missed %s", code)
		}
	}
}

func TestTripPrices(t *testing.T) {
	abj, _ := FindCity("abidjan")
	yop, _ := abj.Commune("yopougon")
	coc, _ := abj.Commune("cocody")
	if m, f := Trip(abj, yop, abj, yop); m != 0 || f != 0 {
		t.Errorf("staying put should be free, got %d min %dF", m, f)
	}
	if _, f := Trip(abj, yop, abj, coc); f < 300 || f > 1000 {
		t.Errorf("Yop → Cocody fare looks wrong: %dF", f)
	}
	bke, _ := FindCity("bouake")
	// Trips are shortened for the game, but the bus up country is still the long one.
	if m, f := Trip(abj, coc, bke, bke.Communes[0]); m < 30 || m > 60 || f < 5000 {
		t.Errorf("Abidjan → Bouaké: %d min %dF", m, f)
	}
}
