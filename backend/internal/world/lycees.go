package world

import "github.com/myahse/babi-life/backend/internal/game"

// The collèges and lycées (the update « parcours-etudes », game/etudes.go): real secondary schools of
// the big towns, their name and position from OpenStreetMap (looked up on Nominatim, 2026-11-13), and a
// « Collège moderne » of the game's own in the communes where no lycée was found with confidence. They
// are « school » places (the classes, the exams, the internat: game.LyceeIDs), added after ecoles.go
// (the files' order) so every commune keeps its own groupe scolaire for the children.

type lyceePlace struct {
	commune, id, name, quarter, operator string
	lat, lng                             float64
	real                                 bool
}

var lyceePlaces = []lyceePlace{
	{"cocody", "lycee-classique-abidjan", "Lycée classique d'Abidjan", "Ambassade", "Établissement public", 5.33226, -4.00594, true},
	{"cocody", "lycee-sainte-marie-cocody", "Lycée Sainte-Marie de Cocody", "Vieux Cocody", "Établissement catholique (privé)", 5.33389, -3.99515, true},
	{"yopougon", "lycee-moderne-yopougon", "Lycée moderne de Yopougon Andokoi", "Andokoi", "Établissement public", 5.36337, -4.06787, true},
	{"adjame", "lycee-moderne-adjame", "Lycée moderne Nangui-Abrogoua", "Saint-Michel", "Établissement public", 5.34748, -4.02449, true},
	{"treichville", "lycee-moderne-treichville", "Lycée moderne de Treichville", "Nanan Yamousso", "Établissement public", 5.30844, -4.00419, true},
	{"koumassi", "lycee-moderne-koumassi", "Lycée moderne de Koumassi", "", "Établissement public", 5.28918, -3.96098, true},
	{"port-bouet", "lycee-moderne-port-bouet", "Lycée moderne de Port-Bouët", "Petit Bassam", "Établissement public", 5.25530, -3.95815, true},
	{"bingerville", "lycee-garcons-bingerville", "Lycée de garçons de Bingerville", "", "Établissement public", 5.35912, -3.89105, true},
	{"abobo", "college-moderne-abobo", "Collège moderne d'Abobo", "", "", 0, 0, false},
	{"marcory", "college-moderne-marcory", "Collège moderne de Marcory", "", "", 0, 0, false},
	{"plateau", "college-moderne-plateau", "Collège moderne du Plateau", "", "", 0, 0, false},
	{"yakro-centre", "lycee-scientifique-yamoussoukro", "Lycée scientifique de Yamoussoukro", "Lolobo", "Établissement public", 6.82369, -5.24783, true},
	{"yakro-centre", "lycee-mamie-adjoua", "Lycée Mamie Adjoua", "Riviera", "Établissement public", 6.83174, -5.26990, true},
	{"bouake-centre", "lycee-classique-bouake", "Lycée moderne 1 et classique de Bouaké", "Koko", "Établissement public", 7.70232, -5.03424, true},
	{"bouake-centre", "lycee-djibo-sounkalo", "Lycée municipal Djibo Sounkalo", "Tiérékro", "Établissement municipal", 7.68877, -5.05446, true},
	{"daloa-centre", "lycee-moderne-daloa", "Lycée moderne 1 et 3 de Daloa", "Dioulabougou", "Établissement public", 6.87590, -6.43828, true},
	{"korhogo-centre", "lycee-moderne-korhogo", "Lycée moderne de Korhogo", "Koko", "Établissement public", 9.45303, -5.64301, true},
	{"man-centre", "lycee-moderne-man", "Lycée moderne de Man", "Quartier CAFOP", "Établissement public", 7.38879, -7.54716, true},
	{"sp-centre", "lycee-moderne-san-pedro", "Lycée moderne de San-Pédro", "Cité Ivosep", "Établissement public", 4.75931, -6.67988, true},
	{"bassam-france", "college-moderne-grand-bassam", "Collège moderne de Grand-Bassam", "", "", 0, 0, false},
}

// LyceePlaceIDs: the places the update brings (features.go: hidden while it's closed).
func LyceePlaceIDs() []string {
	out := make([]string, len(lyceePlaces))
	for i, p := range lyceePlaces {
		out[i] = p.id
	}
	return out
}

func init() {
	for _, e := range lyceePlaces {
		cm := communeRef(e.commune)
		if cm == nil {
			panic("lycees.go: unknown commune " + e.commune)
		}
		if !e.real {
			// The game's own, along the street from the commune's groupe scolaire (ecoles.go), on dry ground like it.
			cm.Places = append(cm.Places, fictional(e.id, e.name, "school", "", cm.Lat-0.0024, cm.Lng+0.0034))
			continue
		}
		cm.Places = append(cm.Places, Place{ID: e.id, Name: e.name, Kind: "school", Quarter: e.quarter, Lat: e.lat, Lng: e.lng, Real: true, Operator: e.operator,
			Source: game.Partial("Nom et position d'après OpenStreetMap (recherche Nominatim, 2026-11-13).", srcOSM, srcNominatim)})
	}
}
