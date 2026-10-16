package sims

import (
	"strings"
	"testing"
)

func TestCleanMessage(t *testing.T) {
	for in, want := range map[string]string{
		"  On se voit au maquis à 20h ?  ":       "On se voit au maquis à 20h ?",
		"Appelle-moi au 07 07 12 34 56":          "Appelle-moi au [numéro masqué]",
		"+225 0707123456 c'est moi":              "[numéro masqué] c'est moi",
		"regarde www.exemple.com/x stp":          "regarde [lien masqué] stp",
		"https://site.ci/promo":                  "[lien masqué]",
		"va sur monsite.com":                     "va sur [lien masqué]",
		"Le garba est à 1 500 F, 2 000 avec œuf": "Le garba est à 1 500 F, 2 000 avec œuf",
		"ligne 1\nligne 2\x07":                   "ligne 1\nligne 2",
	} {
		got, err := cleanMessage(in)
		if err != nil || got != want {
			t.Errorf("cleanMessage(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	if _, err := cleanMessage("   "); err != errEmpty {
		t.Errorf("blank: %v", err)
	}
	if _, err := cleanMessage(strings.Repeat("é", MaxMessage+1)); err != errTooLong {
		t.Errorf("too long: %v", err)
	}
	if _, err := cleanMessage(strings.Repeat("é", MaxMessage)); err != nil {
		t.Errorf("500 accented letters: %v", err)
	}
}

func TestReportReasons(t *testing.T) {
	if !validReason("harcèlement") || validReason("") || validReason("spam !") {
		t.Error("report reasons")
	}
}
