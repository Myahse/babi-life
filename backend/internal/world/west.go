package world

import (
	"slices"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
)

// New York and Montréal are not Abidjan (the updates « pays-usa », « pays-canada »): what the game's
// places offer everywhere and is Ivorian (the dishes of the carte, the gbairai, the « travaillement »
// and the atalaku, the coxers of the gares, the alloco, the wax, the état civil and the campaigns of
// Côte d'Ivoire, the challenges of the stories, all set in Côte d'Ivoire), and the happenings of its
// streets (the Éléphants' match, the coupé-décalé concert, the délestage, the tontine…), stay on this
// side of the ocean: given the cities of Africa only (Interaction.Cities, Happening.Cities, which the
// server and the phone both check). The cities over there have their own (game/paysActs.go).

// westIvorian: the generic activities (no place, no city of their own) that are Ivorian.
var westIvorian = []string{
	"gbairai", "eat-alloco", "bargain", "boutique-wax", "sell-goods", "brunch-lagune", "rs-poisson", "sucrerie",
	"petit-travaillement", "travaillement", "grand-travaillement", "atalaku", "coxers", "eat-brochette", "arachides-route",
	"eau-glacee-gare", "brochettes-rue", "danser-rue", "taper-dessin", "campagne-terrain", "militer", "etat-civil",
	"legalisation", "carte-identite-mairie", "conseil",
}

// westKinds: the kinds whose every generic activity is Ivorian (there is no maquis over there).
var westKinds = []string{"maquis"}

// westHappenings: what can happen in the streets over there too; the rest is Côte d'Ivoire's.
var westHappenings = []string{"pluie", "embouteillage", "controle", "anniversaire", "ouverture-boutique", "noel", "nouvel-an"}

// InAmerica: whether a city is across the ocean (New York, Montréal).
func InAmerica(cityID string) bool {
	for _, c := range Cities {
		if c.ID == cityID {
			return AmericanLand(CountryOf(c).Land)
		}
	}
	return false
}

// IvorianOnly: whether a generic activity of a kind stays in Africa.
func IvorianOnly(kind string, it game.Interaction) bool {
	if len(it.Places) > 0 || len(it.Cities) > 0 {
		return false
	}
	return slices.Contains(westKinds, kind) || strings.HasPrefix(it.ID, game.DishPrefix) || strings.HasPrefix(it.ID, "epreuve-") || slices.Contains(westIvorian, it.ID)
}

func init() {
	var africa []string
	for _, c := range Cities {
		if !AmericanLand(CountryOf(c).Land) {
			africa = append(africa, c.ID)
		}
	}
	for k, kind := range game.Kinds {
		for i, it := range kind.Interactions {
			if IvorianOnly(k, it) {
				kind.Interactions[i].Cities = africaFor(it.ID, africa)
			}
		}
	}
	for i, h := range game.Happenings {
		if len(h.Cities) == 0 && len(h.Communes) == 0 && !slices.Contains(westHappenings, h.ID) {
			game.Happenings[i].Cities = africaFor(h.ID, africa)
		}
	}
}
