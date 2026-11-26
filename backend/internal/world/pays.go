package world

import "github.com/myahse/babi-life/backend/internal/game"

// Les pays (the updates « pays-burkina », « pays-usa », « pays-canada »): the game's world beyond Côte
// d'Ivoire, for the players invited from there (born in the city nearest them, sims.birthplace) and for
// those of Abidjan who travel. Each city abroad is its country's (City.Country), hidden with its communes
// while its update is closed (features.go Places). The streets are OpenStreetMap's everywhere (the map
// tiles), the places below are real ones placed from OpenStreetMap (Nominatim, 2026-11-25), the maquis,
// clubs and shops the game's own. One gets there by plane (game/flights.go Airports), between the two
// African countries also by road; never by road across the ocean (SameLand).

// Cities: every city of the game, Côte d'Ivoire's first.
var Cities = append(append(ivoire, abroad...), etats...)

// Country: a country of the game.
type Country struct {
	ID, Name, Flag string
	// Land: the continent (roads join the countries of one land only).
	Land string
	// Bounds: west, south, east, north (the audit's check).
	Bounds [4]float64
	// Key: the update it waits for ("" Côte d'Ivoire, always there).
	Key string
}

// The countries' keys.
const (
	BurkinaKey = game.BurkinaKey
	USAKey     = game.USAKey
	CanadaKey  = game.CanadaKey
)

// Countries: by id ("ci" for a city without one).
var Countries = map[string]Country{
	"ci": {ID: "ci", Name: "Côte d'Ivoire", Flag: "🇨🇮", Land: "afrique", Bounds: countryBounds},
	"bf": {ID: "bf", Name: "Burkina Faso", Flag: "🇧🇫", Land: "afrique", Bounds: [4]float64{-5.6, 9.4, 2.5, 15.1}, Key: BurkinaKey},
	"us": {ID: "us", Name: "États-Unis", Flag: "🇺🇸", Land: "amerique", Bounds: [4]float64{-170, 18, -66, 72}, Key: USAKey},
	"ca": {ID: "ca", Name: "Canada", Flag: "🇨🇦", Land: "amerique", Bounds: [4]float64{-141, 41.6, -52, 70}, Key: CanadaKey},
}

// CountryOf: a city's country ("ci" when it says none).
func CountryOf(c City) Country {
	if k, ok := Countries[c.Country]; ok {
		return k
	}
	return Countries["ci"]
}

// SameLand: whether a road joins the two cities (the same continent).
func SameLand(a, b City) bool {
	if a.ID != b.ID && (a.Island || b.Island) {
		return false
	}
	return CountryOf(a).Land == CountryOf(b).Land
}

// CountryCommunes: every commune of a country's cities (its update hides them).
func CountryCommunes(country string) []string {
	var out []string
	for _, c := range Cities {
		if c.Country == country {
			for _, cm := range c.Communes {
				out = append(out, cm.ID)
			}
		}
	}
	return out
}

const (
	srcOuaga    = "https://fr.wikipedia.org/wiki/Ouagadougou"
	srcBobo     = "https://fr.wikipedia.org/wiki/Bobo-Dioulasso"
	srcNYC      = "https://en.wikipedia.org/wiki/New_York_City"
	srcBoroughs = "https://en.wikipedia.org/wiki/Boroughs_of_New_York_City"
	srcMontreal = "https://fr.wikipedia.org/wiki/Montr%C3%A9al"
	srcDorval   = "https://fr.wikipedia.org/wiki/Dorval"
)

// osmAt: a real place, positioned from OpenStreetMap.
func osmAt(id, name, kind, quarter string, lat, lng float64, note string) Place {
	return Place{ID: id, Name: name, Kind: kind, Quarter: quarter, Lat: lat, Lng: lng, Real: true, Source: game.Partial(note+" Position d'après OpenStreetMap.", srcOSM)}
}

// townHall: a real mairie (an arrondissement's, a borough's), positioned from OpenStreetMap.
func townHall(communeID, name, operator string, lat, lng float64, src string) Place {
	return Place{ID: "mairie-" + communeID, Name: name, Kind: "mairie", Lat: lat, Lng: lng, Real: true, Operator: operator, Source: game.Partial(name+" ; position d'après OpenStreetMap.", src, srcOSM)}
}

var abroad = []City{
	/* ---------- Burkina Faso ---------- */
	{
		ID: "ouagadougou", Name: "Ouagadougou", Country: "bf", Zoom: 11.8, Lat: 12.3682, Lng: -1.5271,
		Blurb: "« Ouaga », la capitale du Burkina : les mobylettes, le Grand marché, le FESPACO et les maquis sous les manguiers.",
		Admin: CityAdmin{Type: "commune urbaine", Region: "Centre (Burkina Faso)", Source: game.Verified("Capitale du Burkina Faso, divisée en arrondissements.", srcOuaga)},
		Communes: []Commune{
			{ID: "ouaga-centre", Name: "Ouaga centre", Lat: 12.3660, Lng: -1.5250, Blurb: "Le cœur de la ville : le Grand marché, la cathédrale, la grande mosquée, la gare.",
				Admin: Admin{Type: "arrondissement", Parent: "Commune de Ouagadougou", Mairie: "mairie-ouaga-centre", Source: game.Partial("Arrondissement de Baskuy, le centre-ville.", srcOuaga)},
				Places: []Place{
					osmAt("ouaga-aeroport", "Aéroport international de Ouagadougou", "aeroport", "", 12.35041, -1.51244, "L'aéroport de la capitale, en pleine ville."),
					townHall("ouaga-centre", "Mairie de Baskuy", "Arrondissement de Baskuy", 12.35744, -1.51400, srcOuaga),
					osmAt("ouaga-grand-marche", "Grand marché Rood Woko", "market", "", 12.36830, -1.52350, "Le Grand marché de Ouagadougou (Rood Woko)."),
					osmAt("ouaga-cathedrale", "Cathédrale de l'Immaculée-Conception", "worship", "", 12.36197, -1.52701, "La cathédrale de Ouagadougou."),
					osmAt("ouaga-mosquee", "Grande mosquée de Ouagadougou", "worship", "", 12.36622, -1.52139, "La grande mosquée, avenue Yennenga."),
					osmAt("ouaga-gare", "Gare de Ouagadougou", "transport", "Paspanga", 12.37361, -1.52657, "La gare ferroviaire, terminus de la ligne venue d'Abidjan."),
					osmAt("ouaga-place-nation", "Place de la Nation", "rue", "", 12.36883, -1.52937, "La grande place du centre-ville."),
					fictional("ouaga-maquis", "Maquis Le Poulet bicyclette", "maquis", "Gounghin", 12.3640, -1.5330),
					fictional("ouaga-club", "Le Faso Night", "club", "Centre", 12.3620, -1.5200),
				}},
			{ID: "ouaga-2000", Name: "Ouaga 2000", Lat: 12.3061, Lng: -1.5029, Blurb: "Le quartier neuf du sud : les grandes avenues, les villas, le monument des Héros nationaux.",
				Admin: Admin{Type: "arrondissement", Parent: "Commune de Ouagadougou", Mairie: "mairie-ouaga-2000", Source: game.Partial("Ouaga 2000, dans l'arrondissement 12.", srcOuaga)},
				Places: []Place{
					townHall("ouaga-2000", "Mairie de l'arrondissement 12", "Arrondissement 12", 12.28000, -1.47990, srcOuaga),
					osmAt("ouaga-monument-heros", "Monument des Héros nationaux", "culture", "", 12.31219, -1.50262, "Le monument au rond-point des Héros nationaux."),
					fictional("ouaga2000-hotel", "Hôtel Les Baobabs", "hotel", "Ouaga 2000", 12.3020, -1.4980),
					fictional("ouaga2000-resto", "Restaurant Le Sahel", "restaurant", "Ouaga 2000", 12.3090, -1.5060),
					fictional("ouaga2000-salle", "Salle de sport Faso Forme", "gym", "Ouaga 2000", 12.3045, -1.5000),
				}},
			{ID: "ouaga-zogona", Name: "Zogona", Lat: 12.3810, Lng: -1.4843, Blurb: "Le quartier des étudiants : l'université, les grins, les maquis pas chers et le musée.",
				Admin: Admin{Type: "quartier", Parent: "Commune de Ouagadougou", Mairie: "mairie-ouaga-zogona", Source: game.Partial("Zogona, quartier de l'université Joseph Ki-Zerbo.", srcOuaga)},
				Places: []Place{
					{ID: "mairie-ouaga-zogona", Name: "Mairie de Zogona", Kind: "mairie", Lat: 12.3790, Lng: -1.4880, Real: false, Approx: true, Operator: "Commune de Ouagadougou", Source: invented},
					{ID: "ouaga-universite", Name: "Université Joseph Ki-Zerbo", Kind: "universite", Lat: 12.37944, Lng: -1.49905, Real: true, Operator: "Université publique",
						Source: game.Partial("La grande université publique de Ouagadougou. Position d'après OpenStreetMap.", srcOSM)},
					{ID: "ouaga-chu", Name: "CHU Yalgado Ouédraogo", Kind: "health", Lat: 12.38356, Lng: -1.50646, Real: true, Operator: "Hôpital public",
						Source: game.Partial("Le grand hôpital universitaire de Ouagadougou. Position d'après OpenStreetMap.", srcOSM)},
					osmAt("ouaga-musee", "Musée national du Burkina Faso", "culture", "", 12.37969, -1.47196, "Le musée national, boulevard des Tensoba."),
					fictional("zogona-maquis", "Maquis Chez Tantie Awa", "maquis", "Zogona", 12.3825, -1.4860),
					fictional("zogona-grin", "Le grin des étudiants", "grin", "Zogona", 12.3800, -1.4825),
				}},
		},
	},
	{
		ID: "bobo-dioulasso", Name: "Bobo-Dioulasso", Country: "bf", Zoom: 12, Lat: 11.1766, Lng: -4.2961,
		Blurb: "« Bobo », la deuxième ville du Burkina : la mosquée de Dioulassoba en terre, la vieille ville, la musique.",
		Admin: CityAdmin{Type: "commune urbaine", Region: "Hauts-Bassins", Source: game.Verified("Deuxième ville du Burkina Faso.", srcBobo)},
		Communes: []Commune{
			{ID: "bobo-centre", Name: "Bobo centre", Lat: 11.1766, Lng: -4.2961, Blurb: "La grande mosquée, le Grand marché, le quartier ancien de Dioulassoba.",
				Admin: Admin{Type: "commune urbaine", Parent: "Province du Houet", Mairie: "mairie-bobo-centre", Source: game.Partial("Le centre de Bobo-Dioulasso.", srcBobo)},
				Places: []Place{
					osmAt("bobo-aeroport", "Aéroport de Bobo-Dioulasso", "aeroport", "", 11.15540, -4.33736, "L'aéroport de Bobo-Dioulasso."),
					townHall("bobo-centre", "Mairie de Bobo-Dioulasso", "Commune de Bobo-Dioulasso", 11.18638, -4.33121, srcBobo),
					osmAt("bobo-mosquee", "Grande mosquée de Dioulassoba", "worship", "Dioulassoba", 11.17781, -4.29598, "La grande mosquée de terre crue, à Dioulassoba."),
					osmAt("bobo-marche", "Grand marché de Bobo-Dioulasso", "market", "", 11.17732, -4.30025, "Le Grand marché."),
					{ID: "bobo-gare", Name: "Gare de Bobo-Dioulasso", Kind: "transport", Lat: 11.17468, Lng: -4.30684, Real: true, Approx: true, Source: game.Partial("La gare ferroviaire de la ligne Abidjan – Ouagadougou ; placée près de l'école de la gare, d'après OpenStreetMap.", srcOSM)},
					{ID: "bobo-universite", Name: "Université Nazi Boni", Kind: "universite", Lat: 11.20912, Lng: -4.41785, Real: true, Operator: "Université publique",
						Source: game.Partial("L'université de Bobo-Dioulasso. Position d'après OpenStreetMap.", srcOSM)},
					fictional("bobo-maquis", "Maquis Le Dolo", "maquis", "Dioulassoba", 11.1750, -4.2930),
					fictional("bobo-club", "Le Djembé Club", "club", "Centre", 11.1790, -4.2990),
				}},
		},
	},
	/* ---------- États-Unis ---------- */
	{
		ID: "new-york", Name: "New York", Country: "us", Zoom: 11, Lat: 40.7580, Lng: -73.9855,
		Blurb: "« Big Apple » : les gratte-ciel de Manhattan, Central Park, Harlem et l'Apollo, le Bronx et ses Yankees, Queens et ses quartiers de toutes les nations.",
		Admin: CityAdmin{Type: "ville", Region: "État de New York", Source: game.Verified("La plus grande ville des États-Unis, en cinq arrondissements (boroughs).", srcNYC, srcBoroughs)},
		Communes: []Commune{
			{ID: "nyc-manhattan", Name: "Manhattan", Lat: 40.7580, Lng: -73.9855, Blurb: "Times Square, Central Park, les gratte-ciel ; au nord, Harlem, l'Apollo et la 125e rue.",
				Admin: Admin{Type: "borough", Parent: "Ville de New York", Mairie: "mairie-nyc-manhattan", Source: game.Verified("Un des cinq boroughs de New York.", srcBoroughs)},
				Places: []Place{
					townHall("nyc-manhattan", "Hôtel de ville de New York (City Hall)", "Ville de New York", 40.71274, -74.00594, srcNYC),
					osmAt("nyc-times-square", "Times Square", "rue", "Midtown", 40.75701, -73.98597, "Le carrefour des écrans géants."),
					osmAt("nyc-central-park", "Central Park", "nature", "", 40.78277, -73.96536, "Le grand parc de Manhattan."),
					osmAt("nyc-empire-state", "Empire State Building", "culture", "Midtown", 40.74844, -73.98566, "Le gratte-ciel de la 5e avenue et son observatoire."),
					osmAt("nyc-grand-central", "Grand Central Terminal", "transport", "Midtown", 40.75269, -73.97725, "La grande gare de Manhattan."),
					osmAt("nyc-apollo", "Apollo Theater", "culture", "Harlem", 40.81009, -73.94999, "La salle mythique de la 125e rue, à Harlem."),
					osmAt("nyc-harlem-market", "Marché Malcolm Shabazz", "market", "Harlem", 40.80147, -73.94886, "Le marché couvert de la 116e rue, à Harlem."),
					{ID: "nyc-columbia", Name: "Université Columbia", Kind: "universite", Quarter: "Morningside Heights", Lat: 40.80775, Lng: -73.96249, Real: true, Operator: "Université privée",
						Source: game.Partial("Université de Manhattan. Position d'après OpenStreetMap.", srcOSM)},
					fictional("nyc-diner", "Lenox Avenue Diner", "restaurant", "Harlem", 40.8020, -73.9520),
					fictional("nyc-club", "Club Skyline", "club", "Harlem", 40.8080, -73.9460),
				}},
			{ID: "nyc-bronx", Name: "Bronx", Lat: 40.8265, Lng: -73.9235, Blurb: "Le Grand Concourse, le stade des Yankees, le zoo, les bodegas à chaque coin de rue.",
				Admin: Admin{Type: "borough", Parent: "Ville de New York", Mairie: "mairie-nyc-bronx", Source: game.Verified("Un des cinq boroughs de New York.", srcBoroughs)},
				Places: []Place{
					townHall("nyc-bronx", "Bronx County Building", "Borough du Bronx", 40.82628, -73.92351, srcBoroughs),
					osmAt("nyc-yankee-stadium", "Yankee Stadium", "sport", "Concourse", 40.82958, -73.92652, "Le stade de baseball des Yankees."),
					osmAt("nyc-bronx-zoo", "Zoo du Bronx", "zoo", "Belmont", 40.84930, -73.87714, "Le grand zoo de New York."),
					{ID: "nyc-montefiore", Name: "Montefiore Medical Center", Kind: "health", Lat: 40.88009, Lng: -73.87984, Real: true, Operator: "Hôpital privé à but non lucratif",
						Source: game.Partial("Le grand hôpital du Bronx. Position d'après OpenStreetMap.", srcOSM)},
					fictional("bronx-pizza", "Concourse Pizza", "restaurant", "Concourse", 40.8330, -73.9180),
					fictional("bronx-barbier", "161st Street Barbershop", "barbier", "Concourse", 40.8295, -73.9200),
					fictional("bronx-bodega", "Bodega du Grand Concourse", "boutique", "Concourse", 40.8240, -73.9210),
				}},
			{ID: "nyc-queens", Name: "Queens", Lat: 40.7138, Lng: -73.8283, Blurb: "L'aéroport JFK, le parc de Flushing Meadows, les quartiers de toutes les nations.",
				Admin: Admin{Type: "borough", Parent: "Ville de New York", Mairie: "mairie-nyc-queens", Source: game.Verified("Un des cinq boroughs de New York.", srcBoroughs)},
				Places: []Place{
					osmAt("nyc-jfk", "Aéroport international John-F.-Kennedy", "aeroport", "", 40.64295, -73.77937, "Le grand aéroport international de New York."),
					townHall("nyc-queens", "Queens Borough Hall", "Borough de Queens", 40.71378, -73.82830, srcBoroughs),
					osmAt("nyc-flushing", "Parc Flushing Meadows–Corona", "nature", "", 40.74057, -73.84283, "Le grand parc de Queens."),
					{ID: "nyc-queens-hospital", Name: "Queens Hospital Center", Kind: "health", Lat: 40.71771, Lng: -73.80601, Real: true, Operator: "Hôpital public de la ville",
						Source: game.Partial("Hôpital public de Queens. Position d'après OpenStreetMap.", srcOSM)},
					fictional("queens-grill", "Jamaica Avenue Grill", "restaurant", "Jamaica", 40.7020, -73.8010),
				}},
		},
	},
	/* ---------- Canada ---------- */
	{
		ID: "montreal", Name: "Montréal", Country: "ca", Zoom: 11.5, Lat: 45.5048, Lng: -73.5772,
		Blurb: "La grande ville francophone d'Amérique : le Vieux-Montréal, le mont Royal, les hivers sous la neige, la poutine et les bagels.",
		Admin: CityAdmin{Type: "ville", Region: "Québec", Source: game.Verified("Plus grande ville du Québec, divisée en arrondissements.", srcMontreal)},
		Communes: []Commune{
			{ID: "mtl-ville-marie", Name: "Ville-Marie", Lat: 45.5048, Lng: -73.5600, Blurb: "Le centre-ville et le Vieux-Montréal : la basilique, le Vieux-Port, la gare, le mont Royal.",
				Admin: Admin{Type: "arrondissement", Parent: "Ville de Montréal", Mairie: "mairie-mtl-ville-marie", Source: game.Verified("Arrondissement du centre de Montréal.", srcMontreal)},
				Places: []Place{
					townHall("mtl-ville-marie", "Hôtel de ville de Montréal", "Ville de Montréal", 45.50884, -73.55414, srcMontreal),
					osmAt("mtl-basilique", "Basilique Notre-Dame", "worship", "Vieux-Montréal", 45.50444, -73.55599, "La basilique du Vieux-Montréal."),
					osmAt("mtl-vieux-port", "Vieux-Port", "nature", "Vieux-Montréal", 45.50423, -73.55299, "Les quais du Saint-Laurent."),
					osmAt("mtl-gare-centrale", "Gare Centrale", "transport", "Centre-ville", 45.49999, -73.56664, "La gare des trains de Montréal."),
					osmAt("mtl-mont-royal", "Parc du Mont-Royal", "nature", "", 45.50540, -73.58864, "La montagne au milieu de la ville."),
					fictional("mtl-cassecroute", "Casse-croûte Sainte-Catherine", "restaurant", "Centre-ville", 45.5080, -73.5680),
					fictional("mtl-club", "Club Saint-Laurent", "club", "Centre-ville", 45.5110, -73.5640),
				}},
			{ID: "mtl-cdn", Name: "Côte-des-Neiges", Lat: 45.4966, Lng: -73.6235, Blurb: "L'Université de Montréal, l'oratoire Saint-Joseph, et des quartiers de toutes les origines.",
				Admin: Admin{Type: "arrondissement", Parent: "Ville de Montréal", Mairie: "mairie-mtl-cdn", Source: game.Verified("Arrondissement de Côte-des-Neiges–Notre-Dame-de-Grâce.", srcMontreal)},
				Places: []Place{
					{ID: "mairie-mtl-cdn", Name: "Bureau d'arrondissement de Côte-des-Neiges", Kind: "mairie", Lat: 45.4925, Lng: -73.6300, Real: true, Approx: true, Operator: "Ville de Montréal", Source: game.Partial("Le bureau d'arrondissement ; position à relever.", srcMontreal)},
					{ID: "mtl-udem", Name: "Université de Montréal", Kind: "universite", Lat: 45.50476, Lng: -73.61454, Real: true, Operator: "Université publique",
						Source: game.Partial("Le grand campus du mont Royal. Position d'après OpenStreetMap.", srcOSM)},
					{ID: "mtl-oratoire", Name: "Oratoire Saint-Joseph", Kind: "worship", Lat: 45.4925, Lng: -73.6178, Real: true, Approx: true, Source: game.Partial("Le sanctuaire sur le flanc du mont Royal ; placé d'après l'arrêt voisin sur OpenStreetMap.", srcOSM)},
					{ID: "mtl-hgj", Name: "Hôpital général juif", Kind: "health", Lat: 45.49624, Lng: -73.62984, Real: true, Operator: "Hôpital public",
						Source: game.Partial("Hôpital de Côte-des-Neiges. Position d'après OpenStreetMap.", srcOSM)},
					fictional("cdn-bagels", "Bagels Côte-des-Neiges", "restaurant", "Côte-des-Neiges", 45.4950, -73.6255),
					fictional("cdn-depanneur", "Dépanneur Queen-Mary", "boutique", "Côte-des-Neiges", 45.4980, -73.6215),
				}},
			{ID: "mtl-dorval", Name: "Dorval", Lat: 45.4500, Lng: -73.7350, Blurb: "La ville de l'aéroport Montréal-Trudeau, au bord du lac Saint-Louis.",
				Admin: Admin{Type: "ville", Parent: "Agglomération de Montréal", Mairie: "mairie-mtl-dorval", Source: game.Verified("Ville de l'agglomération de Montréal où se trouve l'aéroport.", srcDorval)},
				Places: []Place{
					osmAt("mtl-aeroport", "Aéroport international Montréal-Trudeau", "aeroport", "", 45.46873, -73.74249, "L'aéroport de Montréal."),
					townHall("mtl-dorval", "Hôtel de ville de Dorval", "Ville de Dorval", 45.43925, -73.73055, srcDorval),
					fictional("dorval-hotel", "Hôtel Le Voyageur", "hotel", "Dorval", 45.4600, -73.7400),
				}},
		},
	},
}
