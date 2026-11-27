package world

import (
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
)

// L'espace (the updates « espace-station », « espace-lune », « espace-mars »; game/espace.go): the three places
// up there, each a city of its own whose « communes » are the station's modules, the Moon's base and its capsule,
// Mars's colony and its ship. They are NOT in Cities: what walks every city of the Earth (the map, the flights,
// the coaches, the births, the audit…) never meets them. FindCity, FindCommune and FindPlace fall back on them;
// the phone gets them apart (the API's "espace"). No road, no plane: the rocket only (game.RocketApp). Their
// places are the game's own (Real false), drawn by the phone's world3d/espace (no map tiles up there).

// Espace: the three destinations, nearest first.
var Espace = []City{
	{
		ID: "station-akwaba", Name: "Station Akwaba", Country: game.SpaceCountry, Island: true, Zoom: 16,
		Blurb: "La station d'Astrélia en orbite basse, à 400 km au-dessus de la Terre : un tour du monde toutes les 92 minutes.",
		Admin: CityAdmin{Type: "station orbitale", Region: "Orbite basse", Source: spaceSource},
		Communes: []Commune{
			spaceCommune("akwaba-noeud", "Le nœud d'amarrage", "Là où la Pirogue s'amarre : le sas, les combinaisons, la porte du retour.",
				spacePlace("akwaba-sas", "Sas d'amarrage de la Pirogue", game.EspaceSasKind),
				spacePlace("akwaba-module-vie", "Module de vie", game.EspaceStationK)),
			spaceCommune("akwaba-coupole", "La coupole", "Sept hublots tournés vers la Terre : les nuits d'Afrique et leurs villes allumées.",
				spacePlace("akwaba-coupole-hublots", "Coupole d'observation", game.EspaceStationK)),
			spaceCommune("akwaba-labo", "Le laboratoire", "Les expériences : les plantes, les cristaux, l'attiéké en apesanteur.",
				spacePlace("akwaba-labo-module", "Laboratoire Akwaba", game.EspaceStationK)),
		},
	},
	{
		ID: "lune", Name: "La Lune", Country: game.SpaceCountry, Island: true, Zoom: 16,
		Blurb: "La Base Clair-de-Terre, au cratère Shackleton, au pôle Sud de la Lune : la Terre bleue au ras de l'horizon.",
		Admin: CityAdmin{Type: "base lunaire", Region: "Pôle Sud de la Lune", Source: spaceSource},
		Communes: []Commune{
			spaceCommune("lune-pirogue", "La Pirogue en croisière", "Trois jours de croisière entre la Terre et la Lune, serrés dans la capsule.",
				spacePlace("lune-capsule", "Capsule Pirogue", game.EspaceCapsuleK)),
			spaceCommune("lune-base", "Base Clair-de-Terre", "Les modules gonflables au bord du cratère Shackleton, la serre, le sas vers le sol gris.",
				spacePlace("lune-base-sas", "Sas de la base", game.EspaceSasKind),
				spacePlace("lune-base-module", "Module de vie de Clair-de-Terre", game.EspaceLuneKind)),
		},
	},
	{
		ID: "mars", Name: "Mars", Country: game.SpaceCountry, Island: true, Zoom: 16,
		Blurb: "La Colonie Harmattan, au cratère Jezero : le dôme, la serre, et la poussière rouge que soulève le vent.",
		Admin: CityAdmin{Type: "colonie", Region: "Cratère Jezero, Mars", Source: spaceSource},
		Communes: []Commune{
			spaceCommune("mars-pirogue", "La Grande Pirogue en croisière", "Des mois de route réduits à quelques heures : dormir, le sport, la maintenance, les appels à la maison.",
				spacePlace("mars-capsule", "Grande Pirogue", game.EspaceCapsuleK)),
			spaceCommune("mars-colonie", "Colonie Harmattan", "Le dôme sous le ciel rose, la serre, le laboratoire, le sas vers le delta de Jezero.",
				spacePlace("mars-colonie-sas", "Sas de la colonie", game.EspaceSasKind),
				spacePlace("mars-colonie-dome", "Dôme d'Harmattan", game.EspaceMarsKind)),
		},
	},
}

// spaceSource: everything up there is the game's.
var spaceSource = &game.Source{Status: game.StatusFictional, Note: "Lieu spatial inventé pour le jeu (agence Astrélia) ; aucune agence, entreprise ni mission réelle."}

func spaceCommune(id, name, blurb string, places ...Place) Commune {
	return Commune{ID: id, Name: name, Blurb: blurb, Admin: Admin{Type: "module", Parent: game.Agency, Source: spaceSource}, Places: places}
}

func spacePlace(id, name, kind string) Place {
	return Place{ID: id, Name: name, Kind: kind, Approx: true, Operator: game.Agency, Source: spaceSource}
}

func init() {
	// The space's « country »: a land of its own (no road joins it to the Earth).
	Countries[game.SpaceCountry] = Country{ID: game.SpaceCountry, Name: "L'espace", Flag: "🚀", Land: "espace", Bounds: [4]float64{-180, -90, 180, 90}, Key: game.EspaceKey}
}

// IsSpace: whether a city is up there.
func IsSpace(city string) bool {
	return slices.ContainsFunc(Espace, func(c City) bool { return c.ID == city })
}

// findSpace: a space city by id.
func findSpace(id string) (City, bool) {
	for _, c := range Espace {
		if c.ID == id {
			return c, true
		}
	}
	return City{}, false
}

// EspaceWithout: the space cities with the hidden communes and places left out (the API's "espace"); a city
// with nothing left isn't sent.
func EspaceWithout(hidden map[string]bool) []City {
	out := make([]City, 0, len(Espace))
	for _, c := range Espace {
		c.Communes = slices.DeleteFunc(slices.Clone(c.Communes), func(cm Commune) bool { return hidden[cm.ID] })
		for j, cm := range c.Communes {
			c.Communes[j].Places = slices.DeleteFunc(slices.Clone(cm.Places), func(p Place) bool { return hidden[p.ID] })
		}
		if len(c.Communes) > 0 {
			out = append(out, c)
		}
	}
	return out
}

// EspaceCommunes: the communes of a destination's city (its update hides them, features.go); "" all of them.
func EspaceCommunes(city string) []string {
	var out []string
	for _, c := range Espace {
		if city != "" && c.ID != city {
			continue
		}
		for _, cm := range c.Communes {
			out = append(out, cm.ID)
		}
	}
	return out
}

// findSpacePlace: a place up there.
func findSpacePlace(id string) (City, Commune, Place, bool) {
	for _, c := range Espace {
		for _, cm := range c.Communes {
			for _, p := range cm.Places {
				if p.ID == id {
					return c, cm, p, true
				}
			}
		}
	}
	return City{}, Commune{}, Place{}, false
}
