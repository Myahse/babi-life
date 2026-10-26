package politics

import (
	"strings"
	"testing"
)

func TestOfficeLabel(t *testing.T) {
	cases := map[string]string{
		"president":        "Présidente",
		"ministre:sante":   "Ministre de la Santé",
		"depute:cocody":    "Députée de Cocody",
		"maire:plateau":    "Maire du Plateau",
		"maire:abobo":      "Maire d'Abobo",
		"ministre:inconnu": "Ministre",
	}
	for office, want := range cases {
		if got := OfficeLabel(office, "femme"); got != want {
			t.Errorf("%s: got %q, want %q", office, got, want)
		}
	}
	if got := OfficeLabel("president", "homme"); got != "Président" {
		t.Errorf("homme: %q", got)
	}
	if got := OfficeLabel("depute:yopougon", ""); got != "Député·e de Yopougon" {
		t.Errorf("unknown gender: %q", got)
	}
}

func TestCycle(t *testing.T) {
	if len(Portfolios) != MaxMinisters {
		t.Errorf("%d portfolios for %d ministers", len(Portfolios), MaxMinisters)
	}
	for _, a := range CampaignActs {
		if a.Scope != "commune" && a.Scope != "all" {
			t.Errorf("%s: scope %q", a.ID, a.Scope)
		}
	}
	for _, s := range Sects {
		if sectOf(s.ID) == nil || s.Fee <= 0 || s.Dues <= 0 {
			t.Errorf("sect %s", s.ID)
		}
	}
	if sectOf("x") != nil {
		t.Error("unknown sect")
	}
}

func TestWords(t *testing.T) {
	if thousands(1234567) != "1 234 567" || thousands(500) != "500" {
		t.Error("thousands")
	}
	if !strings.HasPrefix(lowerFirst("Ministre"), "m") {
		t.Error("lowerFirst")
	}
	if len(mayoralCommunes()) < 10 {
		t.Errorf("only %d communes with a town hall", len(mayoralCommunes()))
	}
}
