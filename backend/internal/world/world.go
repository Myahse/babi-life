// Package world describes the map of Côte d'Ivoire: cities, their communes
// and the places a Sim can visit. It is static content for now; each area
// will be fleshed out as it gets designed.
package world

import "math"

type Place struct {
	ID   string  `json:"id"`
	Name string  `json:"name"`
	Kind string  `json:"kind"` // key into game.Kinds
	Lat  float64 `json:"lat"`
	Lng  float64 `json:"lng"`
}

type Commune struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Blurb  string  `json:"blurb"`
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
	Places []Place `json:"places"`
}

type City struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Blurb    string    `json:"blurb"`
	Lat      float64   `json:"lat"`
	Lng      float64   `json:"lng"`
	Zoom     float64   `json:"zoom"`
	Communes []Commune `json:"communes"`
}

var Cities = []City{
	{
		ID: "abidjan", Name: "Abidjan", Zoom: 11.2, Lat: 5.33, Lng: -4.01,
		Blurb: "Babi, la perle des lagunes. Ça ne dort jamais.",
		Communes: []Commune{
			{ID: "plateau", Name: "Plateau", Lat: 5.3237, Lng: -4.0197, Blurb: "Les tours, les bureaux, les costumes.",
				Places: []Place{
					{ID: "plateau-tours", Name: "Cité administrative", Kind: "office", Lat: 5.3262, Lng: -4.0178},
					{ID: "plateau-cathedrale", Name: "Cathédrale Saint-Paul", Kind: "worship", Lat: 5.3315, Lng: -4.0230},
				}},
			{ID: "cocody", Name: "Cocody", Lat: 5.3480, Lng: -3.9870, Blurb: "Résidences, université et Riviera.",
				Places: []Place{
					{ID: "cocody-danga", Name: "Maquis de Danga", Kind: "maquis", Lat: 5.3420, Lng: -4.0040},
					{ID: "cocody-ufhb", Name: "Terrain de l'Université", Kind: "sport", Lat: 5.3460, Lng: -3.9890},
					{ID: "cocody-riviera", Name: "Bureaux de la Riviera", Kind: "office", Lat: 5.3560, Lng: -3.9640},
				}},
			{ID: "yopougon", Name: "Yopougon", Lat: 5.3450, Lng: -4.0820, Blurb: "Yop City, capitale de l'ambiance.",
				Places: []Place{
					{ID: "yop-rue-princesse", Name: "Rue Princesse", Kind: "club", Lat: 5.3380, Lng: -4.0760},
					{ID: "yop-maquis", Name: "Maquis de Sideci", Kind: "maquis", Lat: 5.3320, Lng: -4.0690},
					{ID: "yop-marche", Name: "Marché de Siporex", Kind: "market", Lat: 5.3510, Lng: -4.0710},
				}},
			{ID: "adjame", Name: "Adjamé", Lat: 5.3550, Lng: -4.0240, Blurb: "Le cœur commerçant, ça bouge dans tous les sens.",
				Places: []Place{
					{ID: "adjame-gare", Name: "Gare routière d'Adjamé", Kind: "transport", Lat: 5.3580, Lng: -4.0220},
					{ID: "adjame-forum", Name: "Forum des marchés", Kind: "market", Lat: 5.3530, Lng: -4.0270},
					{ID: "adjame-mosquee", Name: "Grande mosquée", Kind: "worship", Lat: 5.3500, Lng: -4.0215},
				}},
			{ID: "abobo", Name: "Abobo", Lat: 5.4250, Lng: -4.0170, Blurb: "La plus peuplée. Débrouillardise et solidarité.",
				Places: []Place{
					{ID: "abobo-marche", Name: "Grand marché d'Abobo", Kind: "market", Lat: 5.4180, Lng: -4.0200},
					{ID: "abobo-terrain", Name: "Terrain de quartier", Kind: "sport", Lat: 5.4300, Lng: -4.0120},
				}},
			{ID: "treichville", Name: "Treichville", Lat: 5.2990, Lng: -4.0090, Blurb: "Le vieux quartier mythique, le Palais des Sports.",
				Places: []Place{
					{ID: "treich-marche", Name: "Marché de Treichville", Kind: "market", Lat: 5.3020, Lng: -4.0100},
					{ID: "treich-palais", Name: "Palais des Sports", Kind: "sport", Lat: 5.2950, Lng: -4.0040},
					{ID: "treich-maquis", Name: "Maquis de l'Avenue 16", Kind: "maquis", Lat: 5.3000, Lng: -4.0150},
				}},
			{ID: "marcory", Name: "Marcory", Lat: 5.3000, Lng: -3.9850, Blurb: "Zone 4, Biétry, restos et sorties.",
				Places: []Place{
					{ID: "marcory-zone4", Name: "Zone 4", Kind: "club", Lat: 5.2930, Lng: -3.9900},
					{ID: "marcory-bietry", Name: "Maquis de Biétry", Kind: "maquis", Lat: 5.2860, Lng: -3.9770},
				}},
			{ID: "koumassi", Name: "Koumassi", Lat: 5.2930, Lng: -3.9500, Blurb: "Populaire, vivante, au bord de la lagune.",
				Places: []Place{
					{ID: "koumassi-marche", Name: "Marché de Koumassi", Kind: "market", Lat: 5.2960, Lng: -3.9520},
				}},
			{ID: "port-bouet", Name: "Port-Bouët", Lat: 5.2560, Lng: -3.9260, Blurb: "La plage, l'aéroport, le vent de l'océan.",
				Places: []Place{
					{ID: "pb-plage", Name: "Plage de Port-Bouët", Kind: "beach", Lat: 5.2470, Lng: -3.9400},
					{ID: "pb-maquis", Name: "Maquis du Wharf", Kind: "maquis", Lat: 5.2520, Lng: -3.9530},
				}},
			{ID: "attecoube", Name: "Attécoubé", Lat: 5.3350, Lng: -4.0400, Blurb: "Entre lagune et forêt du Banco.",
				Places: []Place{
					{ID: "attecoube-banco", Name: "Forêt du Banco", Kind: "nature", Lat: 5.3800, Lng: -4.0500},
				}},
		},
	},
	{
		ID: "yamoussoukro", Name: "Yamoussoukro", Zoom: 12, Lat: 6.8276, Lng: -5.2893,
		Blurb: "La capitale politique et sa basilique géante.",
		Communes: []Commune{
			{ID: "yakro-centre", Name: "Centre", Lat: 6.8276, Lng: -5.2893, Blurb: "Larges avenues et lacs aux caïmans.",
				Places: []Place{
					{ID: "yakro-basilique", Name: "Basilique Notre-Dame de la Paix", Kind: "worship", Lat: 6.8113, Lng: -5.2970},
					{ID: "yakro-maquis", Name: "Maquis du Lac", Kind: "maquis", Lat: 6.8190, Lng: -5.2760},
				}},
		},
	},
	{
		ID: "bouake", Name: "Bouaké", Zoom: 12, Lat: 7.6906, Lng: -5.0303,
		Blurb: "Deuxième ville du pays, carrefour du centre.",
		Communes: []Commune{
			{ID: "bouake-centre", Name: "Centre", Lat: 7.6906, Lng: -5.0303, Blurb: "Grand marché et ambiance du Carnaval.",
				Places: []Place{
					{ID: "bouake-marche", Name: "Grand marché de Bouaké", Kind: "market", Lat: 7.6890, Lng: -5.0290},
					{ID: "bouake-stade", Name: "Stade de la Paix", Kind: "sport", Lat: 7.7050, Lng: -5.0200},
				}},
		},
	},
	{
		ID: "grand-bassam", Name: "Grand-Bassam", Zoom: 13, Lat: 5.2118, Lng: -3.7388,
		Blurb: "Ancienne capitale coloniale, patrimoine et plages.",
		Communes: []Commune{
			{ID: "bassam-france", Name: "Quartier France", Lat: 5.1990, Lng: -3.7380, Blurb: "Vieilles maisons coloniales face à la mer.",
				Places: []Place{
					{ID: "bassam-plage", Name: "Plage de Bassam", Kind: "beach", Lat: 5.1950, Lng: -3.7300},
					{ID: "bassam-maquis", Name: "Maquis de la plage", Kind: "maquis", Lat: 5.1975, Lng: -3.7450},
				}},
		},
	},
	{
		ID: "san-pedro", Name: "San-Pédro", Zoom: 12, Lat: 4.7485, Lng: -6.6363,
		Blurb: "Le grand port du cacao, et la plage de Monogaga.",
		Communes: []Commune{
			{ID: "sp-centre", Name: "Centre", Lat: 4.7485, Lng: -6.6363, Blurb: "Port, cacao et poisson frais.",
				Places: []Place{
					{ID: "sp-port", Name: "Port autonome", Kind: "office", Lat: 4.7400, Lng: -6.6150},
					{ID: "sp-plage", Name: "Plage de San-Pédro", Kind: "beach", Lat: 4.7380, Lng: -6.6500},
				}},
		},
	},
	{
		ID: "man", Name: "Man", Zoom: 12, Lat: 7.4125, Lng: -7.5538,
		Blurb: "La ville aux dix-huit montagnes.",
		Communes: []Commune{
			{ID: "man-centre", Name: "Centre", Lat: 7.4125, Lng: -7.5538, Blurb: "Montagnes, cascades et danses masquées.",
				Places: []Place{
					{ID: "man-dent", Name: "La Dent de Man", Kind: "nature", Lat: 7.4580, Lng: -7.5170},
					{ID: "man-cascade", Name: "La Cascade", Kind: "nature", Lat: 7.3900, Lng: -7.5870},
					{ID: "man-marche", Name: "Marché de Man", Kind: "market", Lat: 7.4100, Lng: -7.5530},
				}},
		},
	},
	{
		ID: "korhogo", Name: "Korhogo", Zoom: 12, Lat: 9.4580, Lng: -5.6296,
		Blurb: "Capitale du pays sénoufo, toiles et tissages.",
		Communes: []Commune{
			{ID: "korhogo-centre", Name: "Centre", Lat: 9.4580, Lng: -5.6296, Blurb: "Artisans, toiles de Korhogo et chaleur du nord.",
				Places: []Place{
					{ID: "korhogo-marche", Name: "Grand marché", Kind: "market", Lat: 9.4560, Lng: -5.6310},
					{ID: "korhogo-mosquee", Name: "Grande mosquée", Kind: "worship", Lat: 9.4600, Lng: -5.6270},
				}},
		},
	},
	{
		ID: "daloa", Name: "Daloa", Zoom: 12, Lat: 6.8774, Lng: -6.4502,
		Blurb: "La cité des antilopes, au cœur de la boucle du cacao.",
		Communes: []Commune{
			{ID: "daloa-centre", Name: "Centre", Lat: 6.8774, Lng: -6.4502, Blurb: "Commerce, cacao et bonne humeur.",
				Places: []Place{
					{ID: "daloa-marche", Name: "Marché de Daloa", Kind: "market", Lat: 6.8760, Lng: -6.4500},
					{ID: "daloa-maquis", Name: "Maquis du centre", Kind: "maquis", Lat: 6.8800, Lng: -6.4460},
				}},
		},
	},
}

func FindCity(id string) (City, bool) {
	for _, c := range Cities {
		if c.ID == id {
			return c, true
		}
	}
	return City{}, false
}

func (c City) Commune(id string) (Commune, bool) {
	for _, cm := range c.Communes {
		if cm.ID == id {
			return cm, true
		}
	}
	return Commune{}, false
}

// FindPlace looks a place up across the whole map.
func FindPlace(id string) (City, Commune, Place, bool) {
	for _, c := range Cities {
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

// Trip returns the game minutes and FCFA fare to go from one commune to
// another: woro-woro/gbaka inside a city, intercity bus between cities.
func Trip(fromCity City, fromCommune Commune, toCity City, toCommune Commune) (minutes int64, fare int) {
	km := distanceKm(fromCommune.Lat, fromCommune.Lng, toCommune.Lat, toCommune.Lng)
	if fromCity.ID == toCity.ID {
		if fromCommune.ID == toCommune.ID {
			return 0, 0
		}
		return 20 + int64(km*4), 300 + 50*int(km/3)
	}
	// Roads are not straight: ~1.3× the crow-flies distance at 60 km/h.
	road := km * 1.3
	return int64(road) + 30, roundTo(road*25, 500)
}

func distanceKm(lat1, lng1, lat2, lng2 float64) float64 {
	const r = 6371
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * r * math.Asin(math.Sqrt(a))
}

func roundTo(v float64, step int) int {
	n := int(math.Round(v/float64(step))) * step
	if n < step {
		return step
	}
	return n
}
