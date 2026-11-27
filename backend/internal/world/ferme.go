package world

import (
	"math"

	"github.com/myahse/babi-life/backend/internal/game"
)

// L'agriculture et l'élevage (the update « agriculture », game/ferme.go): the village plots round the towns, the
// coopérative Ensemble's warehouses, the vets. The villages are real (Gonaté on the Issia road out of Daloa,
// Sangouiné east of Man, Djébonoua south of Bouaké, Karakoro by Korhogo, Attiégouakro by Yamoussoukro, Gabiadji
// by San-Pédro, Ebimpé at Anyama, Akandjé at Bingerville; abroad Bama in the Kou valley, Ejisu by Kumasi, the
// Loire's market gardens at Nantes, Polk County round Des Moines), placed where they are known to be (Approx);
// the plots, the coopérative and the clinics are the game's, under names of their own (no real company).

const srcVillages = "https://fr.wikipedia.org/wiki/Liste_des_sous-pr%C3%A9fectures_de_C%C3%B4te_d%27Ivoire"

// fermeInvented: the game's own farm places.
var fermeInvented = &game.Source{Status: game.StatusFictional, Note: "Parcelles, coopérative et cabinet vétérinaire du jeu, inventés ; le village est réel, sa position approchée."}

type fermePlace struct {
	commune, id, name, kind, quarter string
	lat, lng                         float64
}

// fermePlaces: where each goes (a commune already on the map).
var fermePlaces = []fermePlace{
	{"daloa-centre", "ferme-gonate", "Les parcelles de Gonaté", game.FermeKind, "Gonaté", 6.8120, -6.5010},
	{"man-centre", "ferme-sangouine", "Les parcelles de Sangouiné", game.FermeKind, "Sangouiné", 7.4200, -7.4400},
	{"bouake-centre", "ferme-djebonoua", "Les parcelles de Djébonoua", game.FermeKind, "Djébonoua", 7.5850, -5.0600},
	{"korhogo-centre", "ferme-karakoro", "Les parcelles de Karakoro", game.FermeKind, "Karakoro", 9.4100, -5.7200},
	{"yakro-centre", "ferme-attiegouakro", "Les parcelles d'Attiégouakro", game.FermeKind, "Attiégouakro", 6.7650, -5.2150},
	{"sp-centre", "ferme-gabiadji", "Les parcelles de Gabiadji", game.FermeKind, "Gabiadji", 4.8150, -6.6200},
	{"anyama", "ferme-ebimpe", "Les parcelles d'Ebimpé", game.FermeKind, "Ebimpé", 5.4700, -4.0750},
	{"bingerville", "ferme-akandje", "Les jardins d'Akandjé", game.FermeKind, "Akandjé", 5.3780, -3.9150},
	{"bobo-centre", "ferme-bama", "Les champs de Bama", game.FermeKind, "Bama (vallée du Kou)", 11.2400, -4.3700},
	{"kumasi-centre", "ferme-ejisu", "La ferme d'Ejisu", game.FermeKind, "Ejisu", 6.7300, -1.5000},
	{"nantes-centre", "ferme-loire", "Le maraîchage des bords de Loire", game.FermeKind, "Basse-Goulaine", 47.2100, -1.4700},
	{"des-moines-centre", "ferme-iowa", "La ferme du comté de Polk", game.FermeKind, "Polk County", 41.6600, -93.5000},
	// The coopérative Ensemble (invented) where the cash crops are weighed and bought.
	{"daloa-centre", "coop-daloa", "Coopérative Ensemble du Haut-Sassandra", game.CoopKind, "Zone industrielle", 6.8930, -6.4650},
	{"korhogo-centre", "coop-korhogo", "Coopérative Ensemble du Poro", game.CoopKind, "Route de Ferké", 9.4650, -5.6150},
	{"bouake-centre", "coop-bouake", "Coopérative Ensemble du Gbêkê", game.CoopKind, "Zone industrielle", 7.7050, -5.0450},
	{"sp-centre", "coop-sanpedro", "Coopérative Ensemble de San-Pédro", game.CoopKind, "Zone portuaire", 4.7600, -6.6250},
	// The vets (invented clinics).
	{"bouake-centre", "veto-bouake", "Cabinet vétérinaire Le Bon Berger", game.VetoKind, "Commerce", 7.6930, -5.0250},
	{"korhogo-centre", "veto-korhogo", "Clinique vétérinaire La Savane", game.VetoKind, "Haoussabougou", 9.4550, -5.6350},
	{"daloa-centre", "veto-daloa", "Cabinet vétérinaire Les Deux Rivières", game.VetoKind, "Lobia", 6.8720, -6.4430},
	{"bingerville", "veto-bingerville", "Clinique vétérinaire de la Lagune", game.VetoKind, "", 5.3580, -3.8930},
}

// FermePlaces: the places the update brings (features.go hides them while it's shut).
func FermePlaces() []string {
	out := make([]string, 0, len(fermePlaces))
	for _, p := range fermePlaces {
		out = append(out, p.id)
	}
	return out
}

var fermeCommuneOf = map[string]string{}

// FermeCommune: the commune a farm place is in ("" if none): a country not open yet hides it with its commune.
func FermeCommune(place string) string { return fermeCommuneOf[place] }

// ivoryZones: the climate of the Ivorian towns (the yard at home follows it).
var ivoryZones = map[string]string{"korhogo": game.ZoneNord, "bouake": game.ZoneCentre, "yamoussoukro": game.ZoneCentre}

// FermeZoneOf: a town's farming climate (game.Zone*), for the yard at home: the Ivorian towns as they are, abroad
// by the latitude (the tropics' forest and savanna, the Sahel, the temperate lands, the cold ones).
func FermeZoneOf(city string) string {
	if z, ok := ivoryZones[city]; ok {
		return z
	}
	c, ok := FindCity(city)
	if !ok || c.Country == "" {
		return game.ZoneSud
	}
	lat := math.Abs(c.Lat)
	switch {
	case lat < 8:
		return game.ZoneSud
	case lat < 10.5:
		return game.ZoneNord
	case lat < 30:
		return game.ZoneSahel
	case (c.Country == "us" || c.Country == "ca") && lat >= 38:
		return game.ZoneContinental
	case lat < 55:
		return game.ZoneTempere
	}
	return game.ZoneContinental
}

func init() {
	at := map[string][]fermePlace{}
	for _, p := range fermePlaces {
		at[p.commune] = append(at[p.commune], p)
		fermeCommuneOf[p.id] = p.commune
	}
	for i := range Cities {
		for j := range Cities[i].Communes {
			cm := &Cities[i].Communes[j]
			for _, p := range at[cm.ID] {
				cm.Places = append(cm.Places, Place{ID: p.id, Name: p.name, Kind: p.kind, Quarter: p.quarter, Lat: p.lat, Lng: p.lng, Approx: true, Source: fermeInvented})
			}
		}
	}
}
