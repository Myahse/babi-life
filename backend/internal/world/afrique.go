package world

import (
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
)

// L'Afrique (the update « pays-afrique »): the continent beyond Côte d'Ivoire and Burkina Faso, its countries'
// capitals and their great cities (afriqueVilles.go), first the neighbours of West Africa, where the Ivorian
// diaspora and its cousins live, then the centre, the north, the east and the south. Their places are real ones
// positioned from OpenStreetMap (Nominatim, 26 November 2026), the dibiteries, chop bars, maquis and clubs the
// game's own. One gets there by plane (game/afrique.go: Air Lagune flies to every city), and by road between
// the countries that share a border (afriqueBorders), along the great corridors (the coast from Abidjan to
// Lagos, the road to Bamako and Dakar, the road to Ouaga and Niamey) from one end to the other; never by road
// to an island (Cabo Verde, Bioko, Zanzibar, Madagascar, the Bijagós) nor across a closed border.

// AfriqueKey: the update that opens the continent.
const AfriqueKey = game.AfriqueKey

// The regions of Africa (Country.Land stays "afrique": one continent, the borders decide the roads).
var afriqueCountries = map[string]struct {
	name, flag string
	bounds     [4]float64
}{
	"sn": {"Sénégal", "🇸🇳", [4]float64{-17.6, 12.2, -11.3, 16.7}},
	"ml": {"Mali", "🇲🇱", [4]float64{-12.3, 10.1, 4.3, 25.0}},
	"gh": {"Ghana", "🇬🇭", [4]float64{-3.3, 4.7, 1.2, 11.2}},
	"gn": {"Guinée", "🇬🇳", [4]float64{-15.1, 7.2, -7.6, 12.7}},
	"tg": {"Togo", "🇹🇬", [4]float64{-0.2, 6.0, 1.9, 11.2}},
	"bj": {"Bénin", "🇧🇯", [4]float64{0.7, 6.2, 3.9, 12.5}},
	"ng": {"Nigeria", "🇳🇬", [4]float64{2.6, 4.2, 14.7, 13.9}},
	"ne": {"Niger", "🇳🇪", [4]float64{0.1, 11.6, 16.0, 23.6}},
	"lr": {"Liberia", "🇱🇷", [4]float64{-11.6, 4.3, -7.3, 8.6}},
	"sl": {"Sierra Leone", "🇸🇱", [4]float64{-13.4, 6.9, -10.2, 10.0}},
	"gm": {"Gambie", "🇬🇲", [4]float64{-16.9, 13.0, -13.7, 13.9}},
	"gw": {"Guinée-Bissau", "🇬🇼", [4]float64{-16.8, 10.8, -13.6, 12.7}},
	"cv": {"Cap-Vert", "🇨🇻", [4]float64{-25.4, 14.8, -22.6, 17.3}},
	"mr": {"Mauritanie", "🇲🇷", [4]float64{-17.2, 14.7, -4.8, 27.3}},
	"cm": {"Cameroun", "🇨🇲", [4]float64{8.4, 1.6, 16.2, 13.1}},
	"ga": {"Gabon", "🇬🇦", [4]float64{8.6, -4.0, 14.6, 2.4}},
	"cg": {"Congo", "🇨🇬", [4]float64{11.1, -5.1, 18.7, 3.8}},
	"cd": {"RD Congo", "🇨🇩", [4]float64{12.1, -13.5, 31.4, 5.4}},
	"td": {"Tchad", "🇹🇩", [4]float64{13.4, 7.4, 24.1, 23.5}},
	"cf": {"Centrafrique", "🇨🇫", [4]float64{14.4, 2.2, 27.5, 11.1}},
	"gq": {"Guinée équatoriale", "🇬🇶", [4]float64{5.5, -1.5, 11.4, 3.9}},
	"ma": {"Maroc", "🇲🇦", [4]float64{-13.2, 27.6, -1.0, 35.95}},
	"dz": {"Algérie", "🇩🇿", [4]float64{-8.7, 18.9, 12.0, 37.1}},
	"tn": {"Tunisie", "🇹🇳", [4]float64{7.5, 30.2, 11.6, 37.6}},
	"eg": {"Égypte", "🇪🇬", [4]float64{24.7, 21.9, 36.9, 31.7}},
	"ly": {"Libye", "🇱🇾", [4]float64{9.3, 19.5, 25.2, 33.2}},
	"et": {"Éthiopie", "🇪🇹", [4]float64{32.9, 3.4, 48.0, 14.9}},
	"ke": {"Kenya", "🇰🇪", [4]float64{33.9, -4.7, 41.9, 5.0}},
	"tz": {"Tanzanie", "🇹🇿", [4]float64{29.3, -11.8, 40.5, -0.9}},
	"ug": {"Ouganda", "🇺🇬", [4]float64{29.5, -1.5, 35.0, 4.3}},
	"rw": {"Rwanda", "🇷🇼", [4]float64{28.8, -2.9, 30.9, -1.0}},
	"sd": {"Soudan", "🇸🇩", [4]float64{21.8, 8.6, 38.6, 22.3}},
	"so": {"Somalie", "🇸🇴", [4]float64{40.9, -1.7, 51.5, 12.0}},
	"dj": {"Djibouti", "🇩🇯", [4]float64{41.7, 10.9, 43.5, 12.8}},
	"mg": {"Madagascar", "🇲🇬", [4]float64{43.1, -25.7, 50.6, -11.9}},
	"za": {"Afrique du Sud", "🇿🇦", [4]float64{16.4, -34.9, 32.9, -22.1}},
	"ao": {"Angola", "🇦🇴", [4]float64{11.6, -18.1, 24.1, -4.3}},
	"mz": {"Mozambique", "🇲🇿", [4]float64{30.2, -26.9, 40.9, -10.4}},
	"zm": {"Zambie", "🇿🇲", [4]float64{21.9, -18.1, 33.8, -8.2}},
	"zw": {"Zimbabwe", "🇿🇼", [4]float64{25.2, -22.5, 33.1, -15.6}},
	"na": {"Namibie", "🇳🇦", [4]float64{11.7, -29.0, 25.3, -16.9}},
	"bw": {"Botswana", "🇧🇼", [4]float64{19.9, -27.0, 29.4, -17.7}},
}

// afriqueBorders: the land borders open to the road between the game's African countries (Côte d'Ivoire's and
// Burkina Faso's too). The closed ones are left out: Morocco and Algeria (closed since 1994); none drawn through
// Western Sahara. The lakes and the sea are no border (Tanzania and the RD Congo face each other across Lake
// Tanganyika, no road).
var afriqueBorders = [][2]string{
	{"ci", "lr"}, {"ci", "gn"}, {"ci", "ml"}, {"ci", "bf"}, {"ci", "gh"},
	{"bf", "ml"}, {"bf", "ne"}, {"bf", "bj"}, {"bf", "tg"}, {"bf", "gh"},
	{"sn", "mr"}, {"sn", "ml"}, {"sn", "gn"}, {"sn", "gw"}, {"sn", "gm"},
	{"ml", "mr"}, {"ml", "dz"}, {"ml", "ne"}, {"ml", "gn"},
	{"gh", "tg"}, {"tg", "bj"}, {"bj", "ne"}, {"bj", "ng"},
	{"gn", "gw"}, {"gn", "lr"}, {"gn", "sl"}, {"lr", "sl"},
	{"ng", "ne"}, {"ng", "td"}, {"ng", "cm"},
	{"ne", "dz"}, {"ne", "ly"}, {"ne", "td"},
	{"mr", "dz"},
	{"cm", "td"}, {"cm", "cf"}, {"cm", "cg"}, {"cm", "ga"}, {"cm", "gq"},
	{"ga", "gq"}, {"ga", "cg"}, {"cg", "cf"}, {"cg", "cd"}, {"cg", "ao"},
	{"cd", "cf"}, {"cd", "ug"}, {"cd", "rw"}, {"cd", "zm"}, {"cd", "ao"},
	{"td", "ly"}, {"td", "sd"}, {"td", "cf"}, {"cf", "sd"},
	{"dz", "tn"}, {"dz", "ly"}, {"tn", "ly"}, {"eg", "ly"}, {"eg", "sd"}, {"ly", "sd"},
	{"et", "so"}, {"et", "dj"}, {"et", "ke"}, {"et", "sd"}, {"so", "ke"}, {"so", "dj"},
	{"ke", "tz"}, {"ke", "ug"}, {"tz", "ug"}, {"tz", "rw"}, {"tz", "zm"}, {"tz", "mz"}, {"ug", "rw"},
	{"za", "na"}, {"za", "bw"}, {"za", "zw"}, {"za", "mz"},
	{"ao", "na"}, {"ao", "zm"}, {"mz", "zm"}, {"mz", "zw"},
	{"zm", "zw"}, {"zm", "bw"}, {"zm", "na"}, {"zw", "bw"}, {"na", "bw"},
}

// afriqueCorridors: the great roads whose coaches run from one end to the other across the borders (the
// Abidjan–Lagos corridor along the coast, the road of Bamako and Dakar, the road of Ouaga and Niamey).
var afriqueCorridors = [][]string{
	{"abidjan", "accra", "lome", "cotonou", "lagos"},
	{"abidjan", "bamako", "dakar"},
	{"abidjan", "ouagadougou", "niamey"},
}

func init() {
	for id, c := range afriqueCountries {
		Countries[id] = Country{ID: id, Name: c.name, Flag: c.flag, Land: "afrique", Bounds: c.bounds, Key: AfriqueKey}
	}
}

// africanCountry: a country of the game in Africa (Côte d'Ivoire's and Burkina's included).
func africanCountry(id string) bool {
	_, ok := afriqueCountries[id]
	return ok || id == "ci" || id == "bf"
}

// roadAcross: whether a road joins two cities of one land: the same country, a border open between their
// countries, or a corridor both stand on. Outside Africa (the Americas), the land decides alone.
func roadAcross(a, b City) bool {
	x, y := CountryOf(a).ID, CountryOf(b).ID
	if x == y || !africanCountry(x) || !africanCountry(y) {
		return true
	}
	if slices.Contains(afriqueBorders, [2]string{x, y}) || slices.Contains(afriqueBorders, [2]string{y, x}) {
		return true
	}
	for _, co := range afriqueCorridors {
		if slices.Contains(co, a.ID) && slices.Contains(co, b.ID) {
			return true
		}
	}
	return false
}

// afriqueWest: the West African countries where the street's generic activities (bargaining at the market,
// the brochettes, the alloco, the dancing in the street…) are as at home as in Abidjan.
var afriqueWest = []string{"ci", "bf", "sn", "ml", "gh", "gn", "tg", "bj", "ng", "ne", "lr", "sl", "gm", "gw"}

// afriqueStreet: the generic activities of Abidjan's street that West Africa shares (westIvorian's others —
// the gbairai, the travaillement, the coxers, the wax boutique, Côte d'Ivoire's état civil and its campaigns —
// stay Ivorian).
var afriqueStreet = []string{"bargain", "sell-goods", "eat-brochette", "brochettes-rue", "danser-rue", "eau-glacee-gare", "arachides-route", "eat-alloco"}

// afriqueHappenings: what happens in West Africa's streets as in Abidjan's (the délestage, the tontine, the
// baptême, the Korité and the Tabaski…); the others (the Éléphants' match, the coupé-décalé concert, the
// FEMUA, the Abissa, Côte d'Ivoire's national days) stay Ivorian.
var afriqueHappenings = []string{"delestage", "tontine", "bapteme", "mariage", "funerailles", "foot", "inondation", "korite", "tabaski", "salubrite", "association"}

// africaFor: of the cities of Africa an Ivorian activity or happening was given (west.go), those it belongs
// in: Côte d'Ivoire's and Burkina's, as before the continent opened; West Africa's too for what its streets
// share with Abidjan's.
func africaFor(id string, africa []string) []string {
	shared := slices.Contains(afriqueStreet, id) || slices.Contains(afriqueHappenings, id)
	var out []string
	for _, cid := range africa {
		c, _ := FindCity(cid)
		k := CountryOf(c)
		if k.Key != AfriqueKey || shared && slices.Contains(afriqueWest, k.ID) {
			out = append(out, cid)
		}
	}
	return out
}

// InAfriqueNorth: a city of the Maghreb or of Egypt, no malaria there (sims/sante.go asks InAmerica the same).
func InAfriqueNorth(cityID string) bool {
	c, ok := FindCity(cityID)
	return ok && slices.Contains([]string{"ma", "dz", "tn", "eg", "ly"}, c.Country)
}

// KeyCommunes: every commune of the countries an update opens (« pays-afrique »: the whole continent's).
func KeyCommunes(key string) []string {
	var out []string
	for _, c := range Cities {
		if c.Country != "" && CountryOf(c).Key == key {
			for _, cm := range c.Communes {
				out = append(out, cm.ID)
			}
		}
	}
	return out
}
