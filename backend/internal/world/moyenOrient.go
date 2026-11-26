package world

import (
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Le Moyen-Orient (the update « pays-moyen-orient »; Turkey is Europe's, Egypt Africa's): in depth (several
// communes) Dubaï and Deira, where Africa's traders buy, Abou Dhabi; Riyad, Djeddah, and La Mecque and Médine, the
// holy cities of the pilgrimage (the Omra and the Hajj, done simply); Doha; Beyrouth, with its long tie to
// Abidjan; Jérusalem and Tel-Aviv; Amman and Pétra; Téhéran and Ispahan. Then the capitals, one commune each:
// Koweït, Manama, Mascate, Bagdad, Damas, Sanaa, and Ramallah and Bethléem. Each with its city hall, its airport
// where there is one (Air Lagune flies there, game/moyenOrient.go; La Mecque, Jérusalem, Pétra, Ramallah and
// Bethléem by road) and its famous places, positioned from OpenStreetMap (Nominatim, 26 November 2026) where it
// found them, else where they are known to be (Approx); the restaurants, barbers and hotels are the game's.
// Generated (scratch spec) like world/europe.go.
//
// Roads: through the land borders open to travellers (moBorders), joined to Turkey and through it to Europe
// (borders.go: two lands join where both countries list their borders), and by Iran to Asia. No politics: the
// borders as they are today, the closed ones left without a road.

// InMoyenOrient: whether a city is in the Middle East (its own diseases, sims/sante.go; its own streets).
func InMoyenOrient(cityID string) bool {
	c, ok := FindCity(cityID)
	return ok && CountryOf(c).Land == "moyen-orient"
}

// MoyenOrientCommunes: every commune of the Middle East's cities (the update hides them while closed).
func MoyenOrientCommunes() []string {
	var out []string
	for _, c := range moyenOrient {
		for _, cm := range c.Communes {
			out = append(out, cm.ID)
		}
	}
	return out
}

// moBorders: the land borders open to travellers, and Turkey's and Russia's that reach the region.
var moBorders = map[string][]string{
	"ae": {"sa", "om"},
	"sa": {"jo", "iq", "kw", "qa", "ae", "om", "ye", "bh"},
	"qa": {"sa"},
	"bh": {"sa"},
	"kw": {"sa", "iq"},
	"om": {"ae", "sa", "ye"},
	"ye": {"sa", "om"},
	"iq": {"kw", "sa", "jo", "sy", "tr", "ir"},
	"sy": {"tr", "iq", "jo", "lb"},
	"lb": {"sy"},
	"jo": {"sy", "iq", "sa", "il", "ps"},
	"il": {"jo", "ps", "eg"},
	"ps": {"il", "jo"},
	"ir": {"tr", "iq", "am", "az", "tm", "af", "pk"},
	"am": {"ge", "ir", "az"},
	"az": {"ge", "am", "ir", "ru"},
	"ge": {"tr", "am", "az", "ru"},
	"tr": {"sy", "iq", "ir", "ge", "am", "az"},
	"ru": {"ge", "az"},
}

// moDry: where no alcohol is served (Saudi Arabia and its holy cities, Kuwait, Iran, Yemen): the game's generic
// drinks (the pot with friends, the hotel's bar, the club's bottle) aren't offered there.
var moDry = []string{"sa", "kw", "ir", "ye"}

// moAddBorders: a country's neighbours added to Borders, without doubles (Asia's file adds its own the same way).
func moAddBorders(k string, l []string) {
	for _, n := range l {
		if !slices.Contains(Borders[k], n) {
			Borders[k] = append(Borders[k], n)
		}
	}
}

func init() {
	for _, k := range []Country{
		{ID: "ae", Name: "Émirats arabes unis", Flag: "🇦🇪", Land: "moyen-orient", Bounds: [4]float64{51.5, 22.6, 56.4, 26.1}, Key: game.MoyenOrientKey},
		{ID: "sa", Name: "Arabie saoudite", Flag: "🇸🇦", Land: "moyen-orient", Bounds: [4]float64{34.5, 16.3, 55.7, 32.2}, Key: game.MoyenOrientKey},
		{ID: "qa", Name: "Qatar", Flag: "🇶🇦", Land: "moyen-orient", Bounds: [4]float64{50.7, 24.4, 51.7, 26.2}, Key: game.MoyenOrientKey},
		{ID: "lb", Name: "Liban", Flag: "🇱🇧", Land: "moyen-orient", Bounds: [4]float64{35.1, 33, 36.7, 34.7}, Key: game.MoyenOrientKey},
		{ID: "il", Name: "Israël", Flag: "🇮🇱", Land: "moyen-orient", Bounds: [4]float64{34.2, 29.4, 35.9, 33.4}, Key: game.MoyenOrientKey},
		{ID: "jo", Name: "Jordanie", Flag: "🇯🇴", Land: "moyen-orient", Bounds: [4]float64{34.9, 29.1, 39.4, 33.4}, Key: game.MoyenOrientKey},
		{ID: "ir", Name: "Iran", Flag: "🇮🇷", Land: "moyen-orient", Bounds: [4]float64{44, 25, 63.4, 39.8}, Key: game.MoyenOrientKey},
		{ID: "kw", Name: "Koweït", Flag: "🇰🇼", Land: "moyen-orient", Bounds: [4]float64{46.5, 28.5, 48.5, 30.1}, Key: game.MoyenOrientKey},
		{ID: "bh", Name: "Bahreïn", Flag: "🇧🇭", Land: "moyen-orient", Bounds: [4]float64{50.3, 25.7, 50.8, 26.3}, Key: game.MoyenOrientKey},
		{ID: "om", Name: "Oman", Flag: "🇴🇲", Land: "moyen-orient", Bounds: [4]float64{51.9, 16.6, 59.9, 26.4}, Key: game.MoyenOrientKey},
		{ID: "iq", Name: "Irak", Flag: "🇮🇶", Land: "moyen-orient", Bounds: [4]float64{38.8, 29, 48.6, 37.4}, Key: game.MoyenOrientKey},
		{ID: "sy", Name: "Syrie", Flag: "🇸🇾", Land: "moyen-orient", Bounds: [4]float64{35.7, 32.3, 42.4, 37.3}, Key: game.MoyenOrientKey},
		{ID: "ye", Name: "Yémen", Flag: "🇾🇪", Land: "moyen-orient", Bounds: [4]float64{42.5, 12.1, 54.6, 19}, Key: game.MoyenOrientKey},
		{ID: "ps", Name: "Palestine", Flag: "🇵🇸", Land: "moyen-orient", Bounds: [4]float64{34.2, 31.2, 35.6, 32.6}, Key: game.MoyenOrientKey},
	} {
		Countries[k.ID] = k
	}
	for k, l := range moBorders {
		if _, ok := Borders[k]; !ok {
			Borders[k] = []string{}
		}
		moAddBorders(k, l)
	}
	// The generic drinks, kept from the dry countries' cities.
	var dry []string
	for _, c := range moyenOrient {
		if slices.Contains(moDry, c.Country) {
			dry = append(dry, c.ID)
		}
	}
	for k, kind := range game.Kinds {
		for i, it := range kind.Interactions {
			if len(it.Places) > 0 || !slices.Contains([]string{"beer", "wine", "martini"}, it.Icon) {
				continue
			}
			if len(it.Cities) == 0 {
				for _, c := range Cities {
					if !slices.Contains(dry, c.ID) {
						kind.Interactions[i].Cities = append(kind.Interactions[i].Cities, c.ID)
					}
				}
			} else {
				kind.Interactions[i].Cities = slices.DeleteFunc(slices.Clone(it.Cities), func(id string) bool { return slices.Contains(dry, id) })
			}
		}
		game.Kinds[k] = kind
	}
}

var moyenOrient = []City{
	{
		ID: "dubai", Name: "Dubaï", Country: "ae", Zoom: 11, Lat: 25.2048, Lng: 55.2708,
		Blurb: "La ville des tours au bord du Golfe : la Burj Khalifa, le Dubai Mall, les souks de l'or et des épices de Deira, les abras sur la Creek, et les commerçants venus d'Afrique.",
		Admin: CityAdmin{Type: "ville", Region: "Émirat de Dubaï", Source: game.Partial("La plus grande ville des Émirats arabes unis. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Dubaï", srcOSM)},
		Communes: []Commune{
			{ID: "dxb-downtown", Name: "Downtown Dubaï", Lat: 25.1972, Lng: 55.2744, Blurb: "Le centre neuf : la Burj Khalifa, la plus haute tour du monde, le Dubai Mall et sa fontaine qui danse le soir, l'opéra.",
				Admin: Admin{Type: "quartier", Parent: "Émirat de Dubaï", Mairie: "mairie-dxb-downtown", Source: game.Partial("Downtown Dubaï, à Dubaï.", "https://fr.wikipedia.org/wiki/Dubaï")},
				Places: []Place{
					{ID: "mairie-dxb-downtown", Name: "Municipalité de Dubaï (antenne de Downtown)", Kind: "mairie", Lat: 25.199, Lng: 55.279, Real: false, Approx: true, Operator: "Municipalité de Dubaï", Source: invented},
					approxAt("dxb-burj-khalifa", "Burj Khalifa", "culture", "Downtown", 25.19716, 55.27437, "La plus haute tour du monde (828 m) et sa terrasse au 148e étage. Position approchée."),
					approxAt("dxb-mall", "Dubai Mall", "mall", "Downtown", 25.19788, 55.27965, "Le grand centre commercial, son aquarium et sa patinoire. Position approchée."),
					approxAt("dxb-fontaine", "Fontaine de Dubaï", "rue", "Downtown", 25.19544, 55.27548, "Les jets d'eau qui dansent en musique au pied de la tour, le soir. Position approchée."),
					osmAt("dxb-opera", "Opéra de Dubaï", "culture", "Downtown", 25.19566, 55.27195, "L'opéra en forme de boutre."),
					osmAt("dxb-musee-futur", "Musée du Futur", "culture", "Sheikh Zayed Road", 25.21915, 55.28187, "Le tore d'acier couvert de calligraphie."),
					fictional("dxb-downtown-shawarma", "Shawarma de la Fontaine", "restaurant", "Downtown", 25.1962, 55.2774),
					fictional("dxb-downtown-karak", "Karak Corner", "restaurant", "Downtown", 25.1992, 55.2724),
					fictional("dxb-downtown-hotel", "Hôtel Les Dunes de Downtown", "hotel", "Downtown", 25.1982, 55.2784),
					fictional("dxb-downtown-club", "Club Skyline Lounge", "club", "Business Bay", 25.2032, 55.2684),
				}},
			{ID: "dxb-deira", Name: "Deira", Lat: 25.2697, Lng: 55.3095, Blurb: "Le vieux Dubaï de la Creek : le souk de l'or, le souk des épices, les boutres chargés pour l'Afrique et l'Iran, et autour de la rue Naïf les commerçants venus de Lagos, d'Abidjan, de Kampala ou de Mogadiscio.",
				Admin: Admin{Type: "quartier", Parent: "Émirat de Dubaï", Mairie: "mairie-dxb-deira", Source: game.Partial("Deira, à Dubaï.", "https://fr.wikipedia.org/wiki/Dubaï")},
				Places: []Place{
					{ID: "mairie-dxb-deira", Name: "Municipalité de Dubaï", Kind: "mairie", Lat: 25.2631, Lng: 55.3108, Real: true, Approx: true, Operator: "Municipalité de Dubaï", Source: game.Partial("Municipalité de Dubaï ; position approchée.", "https://fr.wikipedia.org/wiki/Dubaï", srcOSM)},
					osmAt("dxb-deira-souk-or", "Souk de l'or", "market", "Deira", 25.26998, 55.29812, "Les vitrines d'or des bijoutiers, rue après rue."),
					osmAt("dxb-deira-souk-epices", "Souk des épices", "market", "Deira", 25.26785, 55.29697, "Les sacs de safran, de cardamome, d'encens et de citrons séchés."),
					osmAt("dxb-deira-naif", "Souk de Naïf", "market", "Naïf", 25.27153, 55.30511, "Le souk où les commerçants d'Afrique achètent en gros tissus, téléphones et parfums pour les ramener au pays."),
					approxAt("dxb-deira-abra", "Station d'abras de Deira", "transport", "Deira", 25.26777, 55.29705, "Les bateaux de bois qui traversent la Creek pour un dirham. Position approchée."),
					osmAt("dxb-deira-al-fahidi", "Quartier historique d'Al Fahidi", "culture", "Bur Dubaï", 25.26423, 55.30017, "Les maisons de corail et leurs tours à vent, de l'autre côté de la Creek."),
					osmAt("dxb-aeroport", "Aéroport international de Dubaï", "aeroport", "Al Garhoud", 25.25154, 55.36665, "Le grand aéroport de Dubaï, à Deira."),
					fictional("dxb-deira-gare", "Gare routière d'Al Ghubaiba", "transport", "Deira", 25.2647, 55.3005),
					fictional("dxb-deira-wax", "Bazar Afrique-Golfe (tissus et wax)", "boutique", "Naïf", 25.2717, 55.3065),
					fictional("dxb-deira-resto-africain", "Restaurant Le Goût du Pays", "restaurant", "Naïf", 25.2712, 55.305),
					fictional("dxb-deira-biryani", "Biryani House de la Creek", "restaurant", "Deira", 25.2677, 55.3015),
					fictional("dxb-deira-barbier", "Barbier Al Ras", "barbier", "Deira", 25.2702, 55.2995),
					fictional("dxb-deira-parfums", "Parfumerie Oud & Musc", "boutique", "Deira", 25.2707, 55.2985),
					fictional("dxb-deira-hotel", "Hôtel Creek Palace", "hotel", "Deira", 25.2657, 55.3035),
				}},
			{ID: "dxb-jumeirah", Name: "Jumeirah", Lat: 25.1412, Lng: 55.1853, Blurb: "La côte : la Burj Al Arab en forme de voile, les plages de sable blanc, le souk Madinat, et au large la Palm.",
				Admin: Admin{Type: "quartier", Parent: "Émirat de Dubaï", Mairie: "mairie-dxb-jumeirah", Source: game.Partial("Jumeirah, à Dubaï.", "https://fr.wikipedia.org/wiki/Dubaï")},
				Places: []Place{
					{ID: "mairie-dxb-jumeirah", Name: "Municipalité de Dubaï (centre de Jumeirah)", Kind: "mairie", Lat: 25.15, Lng: 55.2, Real: false, Approx: true, Operator: "Municipalité de Dubaï", Source: invented},
					osmAt("dxb-jumeirah-burj-al-arab", "Burj Al Arab", "culture", "Jumeirah", 25.14143, 55.18515, "L'hôtel en forme de voile, sur son île."),
					osmAt("dxb-jumeirah-plage", "Plage de Jumeirah", "beach", "Jumeirah", 25.14811, 55.1941, "La plage face à la Burj Al Arab."),
					approxAt("dxb-jumeirah-mosquee", "Mosquée de Jumeirah", "worship", "Jumeirah", 25.23392, 55.26505, "La mosquée blanche ouverte aux visiteurs. Position approchée."),
					osmAt("dxb-jumeirah-palm", "Palm Jumeirah", "nature", "Palm", 25.11733, 55.1351, "L'île en forme de palmier."),
					fictional("dxb-jumeirah-glaces", "Glacier de la plage", "restaurant", "Jumeirah", 25.1442, 55.1893),
					fictional("dxb-jumeirah-poisson", "Poisson grillé du port", "restaurant", "Umm Suqeim", 25.1392, 55.1913),
				}},
		},
	},
	{
		ID: "abou-dhabi", Name: "Abou Dhabi", Country: "ae", Zoom: 11.5, Lat: 24.4539, Lng: 54.3773,
		Blurb: "La capitale des Émirats : la grande mosquée Cheikh Zayed toute blanche, la corniche, le palais présidentiel, le Louvre d'Abou Dhabi sous sa coupole.",
		Admin: CityAdmin{Type: "ville", Region: "Émirat d'Abou Dhabi", Source: game.Partial("Capitale des Émirats arabes unis. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Abou_Dhabi", srcOSM)},
		Communes: []Commune{
			{ID: "auh-centre", Name: "Centre (île d'Abou Dhabi)", Lat: 24.48, Lng: 54.36, Blurb: "L'île : la corniche, le fort Qasr al-Hosn, le palais Qasr al-Watan, les tours.",
				Admin: Admin{Type: "quartier", Parent: "Émirat d'Abou Dhabi", Mairie: "mairie-auh-centre", Source: game.Partial("Centre (île d'Abou Dhabi), à Abou Dhabi.", "https://fr.wikipedia.org/wiki/Abou_Dhabi")},
				Places: []Place{
					{ID: "mairie-auh-centre", Name: "Municipalité d'Abou Dhabi", Kind: "mairie", Lat: 24.463, Lng: 54.375, Real: true, Approx: true, Operator: "Municipalité d'Abou Dhabi", Source: game.Partial("Municipalité d'Abou Dhabi ; position approchée.", "https://fr.wikipedia.org/wiki/Abou_Dhabi", srcOSM)},
					osmAt("auh-corniche", "Corniche d'Abou Dhabi", "beach", "Corniche", 24.47419, 54.34019, "Huit kilomètres de plage et de jardins face au Golfe."),
					osmAt("auh-qasr-al-hosn", "Qasr al-Hosn", "culture", "Centre", 24.48234, 54.35528, "Le vieux fort blanc, le plus ancien bâtiment de la ville."),
					osmAt("auh-qasr-al-watan", "Qasr al-Watan", "culture", "Ras al-Akhdar", 24.46259, 54.30683, "Le palais présidentiel ouvert aux visiteurs."),
					osmAt("auh-louvre", "Louvre Abou Dhabi", "culture", "Saadiyat", 24.53368, 54.39861, "Le musée sous sa coupole percée d'étoiles."),
					fictional("auh-centre-gare", "Gare routière d'Abou Dhabi", "transport", "Centre", 24.45, 54.37),
					fictional("auh-centre-machboos", "Restaurant Al Machboos", "restaurant", "Centre", 24.478, 54.361),
					fictional("auh-centre-cafe", "Café de la Corniche", "restaurant", "Corniche", 24.482, 54.35),
					fictional("auh-centre-hotel", "Hôtel Perle du Golfe", "hotel", "Centre", 24.481, 54.362),
				}},
			{ID: "auh-zayed", Name: "Mosquée Cheikh Zayed – Khalifa City", Lat: 24.42, Lng: 54.55, Blurb: "Sur le continent : la grande mosquée Cheikh Zayed, ses 82 coupoles et ses colonnes de nacre, et l'aéroport.",
				Admin: Admin{Type: "quartier", Parent: "Émirat d'Abou Dhabi", Mairie: "mairie-auh-zayed", Source: game.Partial("Mosquée Cheikh Zayed – Khalifa City, à Abou Dhabi.", "https://fr.wikipedia.org/wiki/Abou_Dhabi")},
				Places: []Place{
					{ID: "mairie-auh-zayed", Name: "Municipalité d'Abou Dhabi (Khalifa City)", Kind: "mairie", Lat: 24.42, Lng: 54.58, Real: false, Approx: true, Operator: "Municipalité d'Abou Dhabi", Source: invented},
					osmAt("auh-grande-mosquee", "Grande mosquée Cheikh Zayed", "worship", "Al Rawdah", 24.41245, 54.47427, "La grande mosquée blanche, ses coupoles et ses bassins ; on la visite en tenue couvrante."),
					osmAt("auh-aeroport", "Aéroport international Zayed", "aeroport", "", 24.44093, 54.63773, "L'aéroport d'Abou Dhabi."),
					fictional("auh-zayed-hotel", "Hôtel des Coupoles", "hotel", "Khalifa City", 24.425, 54.56),
				}},
		},
	},
	{
		ID: "riyad", Name: "Riyad", Country: "sa", Zoom: 11, Lat: 24.7136, Lng: 46.6753,
		Blurb: "La capitale de l'Arabie saoudite, au cœur du désert du Najd : le Kingdom Centre et son anneau, le fort de Masmak, le souk de Batha, et Diriyah, la ville de terre des origines.",
		Admin: CityAdmin{Type: "ville", Region: "Région de Riyad", Source: game.Partial("Capitale de l'Arabie saoudite. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Riyad", srcOSM)},
		Communes: []Commune{
			{ID: "ryd-centre", Name: "Centre (Olaya – Batha)", Lat: 24.69, Lng: 46.69, Blurb: "Les tours d'Olaya, le Kingdom Centre ; plus au sud, le vieux Riyad : le fort de Masmak et le souk de Batha.",
				Admin: Admin{Type: "quartier", Parent: "Région de Riyad", Mairie: "mairie-ryd-centre", Source: game.Partial("Centre (Olaya – Batha), à Riyad.", "https://fr.wikipedia.org/wiki/Riyad")},
				Places: []Place{
					{ID: "mairie-ryd-centre", Name: "Municipalité de Riyad", Kind: "mairie", Lat: 24.63, Lng: 46.713, Real: true, Approx: true, Operator: "Municipalité de Riyad", Source: game.Partial("Municipalité de Riyad ; position approchée.", "https://fr.wikipedia.org/wiki/Riyad", srcOSM)},
					osmAt("ryd-kingdom-centre", "Kingdom Centre", "culture", "Olaya", 24.71138, 46.67435, "La tour et son anneau, le pont du ciel à 300 m."),
					approxAt("ryd-masmak", "Fort de Masmak", "culture", "Dirah", 24.6312, 46.7133, "Le fort de terre crue du vieux Riyad. Position approchée."),
					osmAt("ryd-batha", "Souk de Batha", "market", "Batha", 24.63001, 46.71735, "Le grand marché populaire, ses tissus, ses téléphones et ses gargotes de tous les pays."),
					osmAt("ryd-musee", "Musée national d'Arabie saoudite", "culture", "Murabba", 24.64714, 46.7107, "Le musée de l'histoire de la péninsule."),
					osmAt("ryd-stade", "Stade international du roi Fahd", "sport", "", 24.78858, 46.83914, "Le grand stade sous sa toile."),
					fictional("ryd-centre-gare", "Gare routière de Batha", "transport", "Batha", 24.635, 46.718),
					fictional("ryd-centre-kabsa", "Restaurant Kabsa du Najd", "restaurant", "Olaya", 24.694, 46.684),
					fictional("ryd-centre-cafe", "Café arabe Al Dallah", "restaurant", "Olaya", 24.698, 46.688),
					fictional("ryd-centre-dattes", "Dattes et Gahwa Al Qassim", "boutique", "Batha", 24.638, 46.715),
					fictional("ryd-centre-hotel", "Hôtel Les Oasis d'Olaya", "hotel", "Olaya", 24.693, 46.687),
				}},
			{ID: "ryd-diriyah", Name: "Diriyah", Lat: 24.734, Lng: 46.575, Blurb: "La ville de terre crue des origines, At-Turaif, au bord du wadi Hanifa.",
				Admin: Admin{Type: "gouvernorat", Parent: "Région de Riyad", Mairie: "mairie-ryd-diriyah", Source: game.Partial("Diriyah, à Riyad.", "https://fr.wikipedia.org/wiki/Riyad")},
				Places: []Place{
					{ID: "mairie-ryd-diriyah", Name: "Gouvernorat de Diriyah", Kind: "mairie", Lat: 24.74, Lng: 46.57, Real: false, Approx: true, Operator: "Gouvernorat de Diriyah", Source: invented},
					osmAt("ryd-diriyah-turaif", "At-Turaif", "culture", "Diriyah", 24.733, 46.57338, "Le quartier de terre crue, patrimoine mondial."),
					approxAt("ryd-diriyah-wadi", "Wadi Hanifa", "nature", "Diriyah", 24.72, 46.58, "La vallée verte et ses palmiers. Position approchée."),
					fictional("ryd-diriyah-cafe", "Café des Terrasses de Diriyah", "restaurant", "Diriyah", 24.735, 46.578),
				}},
			{ID: "ryd-aeroport", Name: "Aéroport", Lat: 24.9576, Lng: 46.6988, Blurb: "L'aéroport international du roi Khaled, au nord de la ville.",
				Admin: Admin{Type: "quartier", Parent: "Région de Riyad", Mairie: "mairie-ryd-aeroport", Source: game.Partial("Aéroport, à Riyad.", "https://fr.wikipedia.org/wiki/Riyad")},
				Places: []Place{
					{ID: "mairie-ryd-aeroport", Name: "Municipalité de Riyad (nord)", Kind: "mairie", Lat: 24.93, Lng: 46.7, Real: false, Approx: true, Operator: "Municipalité de Riyad", Source: invented},
					osmAt("ryd-aeroport-kkia", "Aéroport international du roi Khaled", "aeroport", "", 24.95862, 46.71104, "L'aéroport de Riyad."),
					fictional("ryd-aeroport-hotel", "Hôtel de l'Aéroport du Najd", "hotel", "Aéroport", 24.9476, 46.7088),
				}},
		},
	},
	{
		ID: "djeddah", Name: "Djeddah", Country: "sa", Zoom: 11.5, Lat: 21.4858, Lng: 39.1925,
		Blurb: "Le grand port de la mer Rouge, la porte des pèlerins vers La Mecque : la vieille ville d'Al-Balad et ses maisons de corail, la corniche et la plus haute fontaine du monde.",
		Admin: CityAdmin{Type: "ville", Region: "Région de La Mecque", Source: game.Partial("Grande ville d'Arabie saoudite, porte de La Mecque. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Djeddah", srcOSM)},
		Communes: []Commune{
			{ID: "jed-balad", Name: "Al-Balad", Lat: 21.485, Lng: 39.187, Blurb: "La vieille ville : les maisons de corail aux moucharabiehs de bois, le souk, la porte de La Mecque.",
				Admin: Admin{Type: "quartier", Parent: "Région de La Mecque", Mairie: "mairie-jed-balad", Source: game.Partial("Al-Balad, à Djeddah.", "https://fr.wikipedia.org/wiki/Djeddah")},
				Places: []Place{
					townHall("jed-balad", "Municipalité de Djeddah", "Municipalité de Djeddah", 21.50053, 39.16773, "https://fr.wikipedia.org/wiki/Djeddah"),
					approxAt("jed-balad-nassif", "Maison Nassif", "culture", "Al-Balad", 21.4834, 39.1869, "La maison de corail où séjourna le roi Abdelaziz. Position approchée."),
					approxAt("jed-balad-souk", "Souk d'Al-Alawi", "market", "Al-Balad", 21.4843, 39.188, "Le souk couvert de la vieille ville. Position approchée."),
					osmAt("jed-balad-porte", "Porte de La Mecque (Bab Makkah)", "rue", "Al-Balad", 21.48526, 39.1927, "La porte d'où partaient les pèlerins."),
					fictional("jed-balad-gare", "Gare routière de Djeddah (cars pour La Mecque et Médine)", "transport", "Al-Balad", 21.481, 39.195),
					fictional("jed-balad-foul", "Foul et Tamees du Souk", "restaurant", "Al-Balad", 21.4855, 39.188),
					fictional("jed-balad-poisson", "Poissonnerie grillée de la mer Rouge", "restaurant", "Al-Balad", 21.483, 39.184),
					fictional("jed-balad-hotel", "Hôtel Bab Makkah", "hotel", "Al-Balad", 21.482, 39.193),
					fictional("jed-balad-barbier", "Barbier de l'Alawi", "barbier", "Al-Balad", 21.486, 39.189),
				}},
			{ID: "jed-corniche", Name: "Corniche", Lat: 21.53, Lng: 39.15, Blurb: "La corniche : la fontaine du roi Fahd qui monte à 260 m, la mosquée flottante d'Ar-Rahma, les promeneurs du soir.",
				Admin: Admin{Type: "quartier", Parent: "Région de La Mecque", Mairie: "mairie-jed-corniche", Source: game.Partial("Corniche, à Djeddah.", "https://fr.wikipedia.org/wiki/Djeddah")},
				Places: []Place{
					{ID: "mairie-jed-corniche", Name: "Municipalité de Djeddah (corniche)", Kind: "mairie", Lat: 21.54, Lng: 39.16, Real: false, Approx: true, Operator: "Municipalité de Djeddah", Source: invented},
					osmAt("jed-corniche-fontaine", "Fontaine du roi Fahd", "rue", "Corniche", 21.51566, 39.14505, "Le jet d'eau le plus haut du monde, sur la mer."),
					approxAt("jed-corniche-rahma", "Mosquée Ar-Rahma", "worship", "Corniche", 21.5881, 39.1091, "La mosquée « flottante », sur pilotis au-dessus de la mer. Position approchée."),
					approxAt("jed-corniche-plage", "Corniche nord", "beach", "Corniche", 21.56, 39.12, "La promenade au bord de la mer Rouge. Position approchée."),
					osmAt("jed-aeroport", "Aéroport international du roi Abdelaziz", "aeroport", "", 21.68933, 39.16695, "L'aéroport de Djeddah, où arrivent les pèlerins."),
					fictional("jed-corniche-glaces", "Glacier de la Corniche", "restaurant", "Corniche", 21.532, 39.149),
					fictional("jed-corniche-hotel", "Hôtel Mer Rouge", "hotel", "Corniche", 21.528, 39.152),
				}},
		},
	},
	{
		ID: "la-mecque", Name: "La Mecque", Country: "sa", Zoom: 12.5, Lat: 21.4225, Lng: 39.8262,
		Blurb: "La ville sainte de l'islam, où les musulmans du monde entier viennent faire la Omra et le Hajj : la Grande Mosquée et la Kaaba, Mina, le mont Arafat. On y arrive par la route depuis Djeddah.",
		Admin: CityAdmin{Type: "ville", Region: "Région de La Mecque", Source: game.Partial("Ville sainte de l'islam ; pas d'aéroport, on y vient de Djeddah. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/La_Mecque", srcOSM)},
		Communes: []Commune{
			{ID: "mecque-centre", Name: "Al-Haram", Lat: 21.4225, Lng: 39.8262, Blurb: "Autour de la Grande Mosquée : la Kaaba au milieu de la cour, les pèlerins en blanc, la tour de l'Horloge au-dessus.",
				Admin: Admin{Type: "quartier", Parent: "Région de La Mecque", Mairie: "mairie-mecque-centre", Source: game.Partial("Al-Haram, à la Mecque.", "https://fr.wikipedia.org/wiki/La_Mecque")},
				Places: []Place{
					{ID: "mairie-mecque-centre", Name: "Municipalité de La Mecque", Kind: "mairie", Lat: 21.41, Lng: 39.87, Real: true, Approx: true, Operator: "Municipalité de La Mecque", Source: game.Partial("Municipalité de La Mecque ; position approchée.", "https://fr.wikipedia.org/wiki/La_Mecque", srcOSM)},
					osmAt("mecque-masjid-al-haram", "Masjid al-Haram (la Grande Mosquée)", "worship", "Al-Haram", 21.42456, 39.82487, "La Grande Mosquée et la Kaaba en son centre, vers laquelle prient les musulmans du monde entier."),
					osmAt("mecque-horloge", "Tour de l'Horloge (Abraj Al-Bait)", "culture", "Al-Haram", 21.41804, 39.8253, "La tour et son horloge géante au-dessus de la Grande Mosquée."),
					approxAt("mecque-mina", "Mina", "worship", "Mina", 21.4133, 39.8933, "La vallée des tentes blanches, étape du Hajj. Position approchée."),
					approxAt("mecque-arafat", "Mont Arafat (Jabal al-Rahma)", "worship", "Arafat", 21.355, 39.9841, "La colline où les pèlerins se tiennent le jour d'Arafat. Position approchée."),
					fictional("mecque-centre-gare", "Gare des cars de pèlerins", "transport", "Kudai", 21.4075, 39.8312),
					fictional("mecque-centre-hotel", "Hôtel des Pèlerins", "hotel", "Ajyad", 21.4195, 39.8272),
					fictional("mecque-centre-resto", "Restaurant Zamzam (riz et poulet)", "restaurant", "Ajyad", 21.4185, 39.8282),
					fictional("mecque-centre-dattes", "Dattes et tapis de prière d'Ajyad", "boutique", "Ajyad", 21.418, 39.8277),
					fictional("mecque-centre-barbier", "Barbier des pèlerins", "barbier", "Ajyad", 21.419, 39.8287),
				}},
		},
	},
	{
		ID: "medine", Name: "Médine", Country: "sa", Zoom: 12, Lat: 24.4672, Lng: 39.6111,
		Blurb: "La deuxième ville sainte de l'islam : la mosquée du Prophète et sa coupole verte, la mosquée de Quba, le mont Uhud ; une ville calme où les pèlerins prolongent leur voyage.",
		Admin: CityAdmin{Type: "ville", Region: "Région de Médine", Source: game.Partial("Deuxième ville sainte de l'islam. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Médine", srcOSM)},
		Communes: []Commune{
			{ID: "medine-centre", Name: "Centre (Al-Haram)", Lat: 24.4672, Lng: 39.6111, Blurb: "Autour de la mosquée du Prophète : ses parasols géants, ses minarets, la coupole verte.",
				Admin: Admin{Type: "quartier", Parent: "Région de Médine", Mairie: "mairie-medine-centre", Source: game.Partial("Centre (Al-Haram), à Médine.", "https://fr.wikipedia.org/wiki/Médine")},
				Places: []Place{
					townHall("medine-centre", "Municipalité de Médine", "Municipalité de Médine", 24.45957, 39.60037, "https://fr.wikipedia.org/wiki/Médine"),
					osmAt("medine-masjid-nabawi", "Masjid an-Nabawi (la mosquée du Prophète)", "worship", "Al-Haram", 24.46868, 39.61116, "La mosquée du Prophète et sa coupole verte."),
					osmAt("medine-quba", "Mosquée de Quba", "worship", "Quba", 24.43942, 39.61746, "La première mosquée de l'islam."),
					approxAt("medine-uhud", "Mont Uhud", "nature", "Uhud", 24.505, 39.614, "La montagne rouge au nord de la ville. Position approchée."),
					osmAt("medine-aeroport", "Aéroport de Médine", "aeroport", "", 24.55549, 39.70609, "L'aéroport de Médine."),
					fictional("medine-centre-gare", "Gare des cars de Médine", "transport", "Centre", 24.4752, 39.6011),
					fictional("medine-centre-dattes", "Marché aux dattes de Médine", "market", "Centre", 24.4642, 39.6151),
					fictional("medine-centre-resto", "Restaurant Al-Ansar", "restaurant", "Centre", 24.4702, 39.6141),
					fictional("medine-centre-hotel", "Hôtel Les Palmiers de Médine", "hotel", "Centre", 24.4652, 39.6091),
				}},
		},
	},
	{
		ID: "doha", Name: "Doha", Country: "qa", Zoom: 11.5, Lat: 25.2854, Lng: 51.531,
		Blurb: "La capitale du Qatar : la corniche en arc, le musée d'Art islamique, le souq Waqif et ses faucons, les tours de West Bay, les stades de la Coupe du monde 2022.",
		Admin: CityAdmin{Type: "ville", Region: "Municipalité de Doha", Source: game.Partial("Capitale du Qatar. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Doha", srcOSM)},
		Communes: []Commune{
			{ID: "doha-centre", Name: "Centre (Souq Waqif – Corniche)", Lat: 25.287, Lng: 51.533, Blurb: "Le vieux Doha : le souq Waqif, le souk aux faucons, le musée d'Art islamique au bout de la corniche.",
				Admin: Admin{Type: "quartier", Parent: "Municipalité de Doha", Mairie: "mairie-doha-centre", Source: game.Partial("Centre (Souq Waqif – Corniche), à Doha.", "https://fr.wikipedia.org/wiki/Doha")},
				Places: []Place{
					{ID: "mairie-doha-centre", Name: "Municipalité de Doha", Kind: "mairie", Lat: 25.283, Lng: 51.528, Real: true, Approx: true, Operator: "Municipalité de Doha", Source: game.Partial("Municipalité de Doha ; position approchée.", "https://fr.wikipedia.org/wiki/Doha", srcOSM)},
					osmAt("doha-souq-waqif", "Souq Waqif", "market", "Souq Waqif", 25.28706, 51.53286, "Le vieux souk, ses épices, ses tissus et ses cafés."),
					osmAt("doha-faucons", "Souk aux faucons", "market", "Souq Waqif", 25.28858, 51.53066, "Les faucons sur leurs perchoirs et l'hôpital des faucons."),
					osmAt("doha-mia", "Musée d'Art islamique", "culture", "Corniche", 25.29554, 51.53942, "Le musée de pierre blanche sur son île."),
					osmAt("doha-corniche", "Corniche de Doha", "rue", "Corniche", 25.30721, 51.51537, "Sept kilomètres de promenade autour de la baie, les boutres."),
					osmAt("doha-aeroport", "Aéroport international Hamad", "aeroport", "", 25.27486, 51.61245, "L'aéroport de Doha et son ours jaune."),
					fictional("doha-centre-gare", "Gare routière Al Ghanim", "transport", "Al Ghanim", 25.285, 51.535),
					fictional("doha-centre-machboos", "Machboos du Souq", "restaurant", "Souq Waqif", 25.2875, 51.534),
					fictional("doha-centre-karak", "Karak et Chapati de Doha", "restaurant", "Souq Waqif", 25.286, 51.532),
					fictional("doha-centre-hotel", "Hôtel Les Faucons", "hotel", "Souq Waqif", 25.288, 51.531),
				}},
			{ID: "doha-westbay", Name: "West Bay – Katara", Lat: 25.329, Lng: 51.525, Blurb: "Les tours de verre de West Bay, le village culturel de Katara et sa plage, et plus loin The Pearl.",
				Admin: Admin{Type: "quartier", Parent: "Municipalité de Doha", Mairie: "mairie-doha-westbay", Source: game.Partial("West Bay – Katara, à Doha.", "https://fr.wikipedia.org/wiki/Doha")},
				Places: []Place{
					{ID: "mairie-doha-westbay", Name: "Municipalité de Doha (West Bay)", Kind: "mairie", Lat: 25.325, Lng: 51.53, Real: false, Approx: true, Operator: "Municipalité de Doha", Source: invented},
					osmAt("doha-katara", "Village culturel de Katara", "culture", "Katara", 25.36091, 51.52474, "L'amphithéâtre, les galeries et la mosquée colorée."),
					osmAt("doha-katara-plage", "Plage de Katara", "beach", "Katara", 25.35873, 51.52744, "La plage du village culturel."),
					osmAt("doha-pearl", "The Pearl", "nature", "The Pearl", 25.36953, 51.55221, "L'île aux marinas."),
					osmAt("doha-khalifa", "Stade international Khalifa", "sport", "Aspire", 25.26365, 51.44922, "Le stade de la Coupe du monde, près de la tour Aspire."),
					fictional("doha-westbay-club", "Lounge Pearl Night", "club", "West Bay", 25.332, 51.528),
					fictional("doha-westbay-resto", "Restaurant Le Dhow", "restaurant", "West Bay", 25.326, 51.529),
				}},
		},
	},
	{
		ID: "beyrouth", Name: "Beyrouth", Country: "lb", Zoom: 11.5, Lat: 33.8938, Lng: 35.5018,
		Blurb: "La capitale du Liban, entre la mer et la montagne : la corniche et les rochers de Raouché, la place des Martyrs, Hamra et Gemmayzé, les mezzés. Beaucoup de familles ont un oncle, un cousin ou leurs souvenirs à Abidjan.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat de Beyrouth", Source: game.Partial("Capitale du Liban. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Beyrouth", srcOSM)},
		Communes: []Commune{
			{ID: "bey-centre", Name: "Centre-ville – Gemmayzé", Lat: 33.896, Lng: 35.507, Blurb: "La place des Martyrs, la mosquée Mohammad al-Amine et la cathédrale Saint-Georges côte à côte, l'escalier Saint-Nicolas et les cafés de Gemmayzé.",
				Admin: Admin{Type: "quartier", Parent: "Gouvernorat de Beyrouth", Mairie: "mairie-bey-centre", Source: game.Partial("Centre-ville – Gemmayzé, à Beyrouth.", "https://fr.wikipedia.org/wiki/Beyrouth")},
				Places: []Place{
					townHall("bey-centre", "Municipalité de Beyrouth", "Municipalité de Beyrouth", 33.89799, 35.50589, "https://fr.wikipedia.org/wiki/Beyrouth"),
					osmAt("bey-martyrs", "Place des Martyrs", "rue", "Centre-ville", 33.8954, 35.50688, "La grande place et sa statue."),
					approxAt("bey-al-amine", "Mosquée Mohammad al-Amine", "worship", "Centre-ville", 33.895, 35.5063, "La grande mosquée aux coupoles bleues. Position approchée."),
					approxAt("bey-saint-georges", "Cathédrale Saint-Georges des Maronites", "worship", "Centre-ville", 33.8951, 35.5055, "La cathédrale maronite, voisine de la mosquée. Position approchée."),
					osmAt("bey-musee", "Musée national de Beyrouth", "culture", "Mathaf", 33.87896, 35.5172, "Les trésors phéniciens et romains."),
					approxAt("bey-gemmayze", "Escalier Saint-Nicolas (Gemmayzé)", "rue", "Gemmayzé", 33.8935, 35.5153, "Les marches colorées du quartier des cafés. Position approchée."),
					fictional("bey-centre-gare", "Gare routière Charles-Hélou", "transport", "Port", 33.9, 35.512),
					fictional("bey-centre-mezze", "Mezzés Chez Tante Salwa", "restaurant", "Gemmayzé", 33.894, 35.515),
					fictional("bey-centre-manakish", "Four à manakish du Centre", "restaurant", "Centre-ville", 33.897, 35.505),
					fictional("bey-centre-patisserie", "Pâtisserie Les Mille Feuilles", "restaurant", "Achrafieh", 33.892, 35.516),
					fictional("bey-centre-club", "Club Mar Mikhaël", "club", "Mar Mikhaël", 33.8965, 35.519),
					fictional("bey-centre-hotel", "Hôtel Le Phénicien", "hotel", "Centre-ville", 33.898, 35.504),
				}},
			{ID: "bey-hamra", Name: "Hamra – Raouché", Lat: 33.896, Lng: 35.48, Blurb: "Ras Beyrouth : la rue Hamra et ses librairies, l'Université américaine, la corniche et la grotte aux Pigeons.",
				Admin: Admin{Type: "quartier", Parent: "Gouvernorat de Beyrouth", Mairie: "mairie-bey-hamra", Source: game.Partial("Hamra – Raouché, à Beyrouth.", "https://fr.wikipedia.org/wiki/Beyrouth")},
				Places: []Place{
					{ID: "mairie-bey-hamra", Name: "Municipalité de Beyrouth (Ras Beyrouth)", Kind: "mairie", Lat: 33.897, Lng: 35.483, Real: false, Approx: true, Operator: "Municipalité de Beyrouth", Source: invented},
					osmAt("bey-hamra-rue", "Rue Hamra", "rue", "Hamra", 33.89564, 35.48226, "La rue des cafés, des librairies et des cinémas."),
					osmAt("bey-hamra-aub", "Université américaine de Beyrouth", "universite", "Ras Beyrouth", 33.90003, 35.48238, "Le campus face à la mer."),
					osmAt("bey-hamra-raouche", "Rochers de Raouché (grotte aux Pigeons)", "nature", "Raouché", 33.89023, 35.47004, "Les deux arches de roche dans la mer."),
					osmAt("bey-hamra-corniche", "Corniche de Beyrouth", "beach", "Ain el-Mreisseh", 33.89925, 35.47059, "La promenade des joggeurs, des pêcheurs et des vendeurs de maïs."),
					fictional("bey-hamra-abidjan", "Café Abidjan–Beyrouth", "restaurant", "Hamra", 33.8965, 35.481),
					fictional("bey-hamra-falafel", "Falafel de Hamra", "restaurant", "Hamra", 33.895, 35.482),
					fictional("bey-hamra-barbier", "Barbier de la rue Makhoul", "barbier", "Hamra", 33.8975, 35.4795),
					fictional("bey-hamra-librairie", "Librairie Le Cèdre", "boutique", "Hamra", 33.8965, 35.483),
				}},
			{ID: "bey-aeroport", Name: "Aéroport (Ouzaï)", Lat: 33.8209, Lng: 35.4884, Blurb: "L'aéroport de Beyrouth, au bord de la mer.",
				Admin: Admin{Type: "quartier", Parent: "Mont-Liban", Mairie: "mairie-bey-aeroport", Source: game.Partial("Aéroport (Ouzaï), à Beyrouth.", "https://fr.wikipedia.org/wiki/Beyrouth")},
				Places: []Place{
					{ID: "mairie-bey-aeroport", Name: "Municipalité de Ghobeiry", Kind: "mairie", Lat: 33.85, Lng: 35.495, Real: false, Approx: true, Operator: "Municipalité de Ghobeiry", Source: invented},
					osmAt("bey-aeroport-rhia", "Aéroport international de Beyrouth", "aeroport", "", 33.81849, 35.49091, "L'aéroport de Beyrouth, d'où partent les vols vers l'Afrique de l'Ouest."),
					fictional("bey-aeroport-hotel", "Hôtel de l'Aéroport", "hotel", "Ouzaï", 33.8309, 35.4894),
				}},
		},
	},
	{
		ID: "jerusalem", Name: "Jérusalem", Country: "il", Zoom: 12.5, Lat: 31.7767, Lng: 35.2345,
		Blurb: "La ville sainte des trois religions : dans les remparts de la vieille ville, le mur des Lamentations, l'esplanade des Mosquées et le Dôme du Rocher, le Saint-Sépulcre, les souks.",
		Admin: CityAdmin{Type: "ville", Region: "District de Jérusalem", Source: game.Partial("Ville sainte du judaïsme, du christianisme et de l'islam ; pas d'aéroport, on y vient de Tel-Aviv ou d'Amman. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Jérusalem", srcOSM)},
		Communes: []Commune{
			{ID: "jlm-vieille-ville", Name: "Vieille ville", Lat: 31.7767, Lng: 35.2345, Blurb: "Les quatre quartiers dans les remparts de Soliman, leurs ruelles de pierre blonde, les cloches, les appels à la prière et les prières au Mur.",
				Admin: Admin{Type: "quartier", Parent: "District de Jérusalem", Mairie: "mairie-jlm-vieille-ville", Source: game.Partial("Vieille ville, à Jérusalem.", "https://fr.wikipedia.org/wiki/Jérusalem")},
				Places: []Place{
					{ID: "mairie-jlm-vieille-ville", Name: "Mairie de Jérusalem", Kind: "mairie", Lat: 31.7793, Lng: 35.2241, Real: true, Approx: true, Operator: "Municipalité de Jérusalem", Source: game.Partial("Mairie de Jérusalem ; position approchée.", "https://fr.wikipedia.org/wiki/Jérusalem", srcOSM)},
					osmAt("jlm-mur", "Mur des Lamentations", "worship", "Quartier juif", 31.77675, 35.23445, "Le mur de l'ancien Temple, où l'on glisse ses prières."),
					osmAt("jlm-dome-rocher", "Dôme du Rocher", "worship", "Esplanade des Mosquées", 31.77802, 35.2353, "La coupole d'or sur l'esplanade, près de la mosquée al-Aqsa."),
					osmAt("jlm-saint-sepulcre", "Basilique du Saint-Sépulcre", "worship", "Quartier chrétien", 31.77846, 35.22951, "L'église du tombeau du Christ."),
					osmAt("jlm-porte-jaffa", "Porte de Jaffa et tour de David", "culture", "Quartier arménien", 31.77663, 35.22754, "La porte de l'ouest et la citadelle."),
					approxAt("jlm-souk", "Souk de la rue al-Wad", "market", "Quartier musulman", 31.779, 35.2326, "Les échoppes d'épices, de pain et de souvenirs. Position approchée."),
					osmAt("jlm-mont-oliviers", "Mont des Oliviers", "nature", "Mont des Oliviers", 31.77891, 35.24503, "La colline face aux remparts, et la vue sur la ville."),
					fictional("jlm-vieille-ville-gare", "Gare routière centrale", "transport", "Ville nouvelle", 31.7897, 35.2035),
					fictional("jlm-vieille-ville-houmous", "Houmous de la porte de Damas", "restaurant", "Quartier musulman", 31.7787, 35.2335),
					fictional("jlm-vieille-ville-falafel", "Falafel de la rue Jaffa", "restaurant", "Ville nouvelle", 31.7787, 35.2225),
					fictional("jlm-vieille-ville-pain", "Boulangerie Ka'ak", "restaurant", "Quartier musulman", 31.7777, 35.234),
					fictional("jlm-vieille-ville-hotel", "Hôtel des Remparts", "hotel", "Porte de Jaffa", 31.7757, 35.2275),
				}},
		},
	},
	{
		ID: "tel-aviv", Name: "Tel-Aviv", Country: "il", Zoom: 11.5, Lat: 32.0853, Lng: 34.7818,
		Blurb: "La grande ville du bord de mer : les plages, la « ville blanche » du Bauhaus, le boulevard Rothschild, le marché du Carmel, et Jaffa, le vieux port.",
		Admin: CityAdmin{Type: "ville", Region: "District de Tel-Aviv", Source: game.Partial("Grande ville d'Israël, avec Jaffa. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Tel-Aviv", srcOSM)},
		Communes: []Commune{
			{ID: "tlv-centre", Name: "Centre – Plages", Lat: 32.08, Lng: 34.774, Blurb: "Le boulevard Rothschild et ses immeubles blancs, le marché du Carmel, la promenade et les plages.",
				Admin: Admin{Type: "quartier", Parent: "District de Tel-Aviv", Mairie: "mairie-tlv-centre", Source: game.Partial("Centre – Plages, à Tel-Aviv.", "https://fr.wikipedia.org/wiki/Tel-Aviv")},
				Places: []Place{
					{ID: "mairie-tlv-centre", Name: "Mairie de Tel-Aviv", Kind: "mairie", Lat: 32.0814, Lng: 34.7807, Real: true, Approx: true, Operator: "Municipalité de Tel-Aviv-Jaffa", Source: game.Partial("Mairie de Tel-Aviv ; position approchée.", "https://fr.wikipedia.org/wiki/Tel-Aviv", srcOSM)},
					osmAt("tlv-rothschild", "Boulevard Rothschild (ville blanche)", "rue", "Lev Ha'ir", 32.06379, 34.77433, "Le boulevard et ses immeubles du Bauhaus, patrimoine mondial."),
					osmAt("tlv-carmel", "Marché du Carmel", "market", "Kerem HaTeimanim", 32.06837, 34.76855, "Le grand marché des fruits, des épices et des étals."),
					osmAt("tlv-plage", "Plage Gordon", "beach", "Plages", 32.08316, 34.76762, "La plage, ses parties de matkot et le coucher du soleil."),
					osmAt("tlv-rabin", "Place Rabin", "rue", "Centre", 32.08093, 34.78079, "La grande place devant la mairie."),
					fictional("tlv-centre-gare", "Gare routière centrale de Tel-Aviv", "transport", "Neve Sha'anan", 32.055, 34.791),
					fictional("tlv-centre-sabich", "Sabich de Rothschild", "restaurant", "Centre", 32.07, 34.775),
					fictional("tlv-centre-shakshuka", "Shakshuka du Carmel", "restaurant", "Carmel", 32.069, 34.77),
					fictional("tlv-centre-erythree", "Restaurant érythréen de Neve Sha'anan", "restaurant", "Neve Sha'anan", 32.057, 34.79),
					fictional("tlv-centre-club", "Club Florentin", "club", "Florentin", 32.057, 34.772),
					fictional("tlv-centre-hotel", "Hôtel Bauhaus", "hotel", "Centre", 32.075, 34.774),
				}},
			{ID: "tlv-jaffa", Name: "Jaffa", Lat: 32.054, Lng: 34.752, Blurb: "Le vieux port, la tour de l'Horloge, le marché aux puces, les ruelles en pente vers la mer.",
				Admin: Admin{Type: "quartier", Parent: "District de Tel-Aviv", Mairie: "mairie-tlv-jaffa", Source: game.Partial("Jaffa, à Tel-Aviv.", "https://fr.wikipedia.org/wiki/Tel-Aviv")},
				Places: []Place{
					{ID: "mairie-tlv-jaffa", Name: "Municipalité de Tel-Aviv-Jaffa (Jaffa)", Kind: "mairie", Lat: 32.053, Lng: 34.756, Real: false, Approx: true, Operator: "Municipalité de Tel-Aviv-Jaffa", Source: invented},
					osmAt("tlv-jaffa-horloge", "Tour de l'Horloge de Jaffa", "culture", "Jaffa", 32.05507, 34.75627, "La tour ottomane de 1906."),
					osmAt("tlv-jaffa-port", "Port de Jaffa", "beach", "Jaffa", 32.05398, 34.75027, "L'un des plus vieux ports du monde."),
					osmAt("tlv-jaffa-puces", "Marché aux puces de Jaffa", "market", "Jaffa", 32.05358, 34.75627, "Le bric-à-brac et les cafés."),
					fictional("tlv-jaffa-houmous", "Houmous du Port", "restaurant", "Jaffa", 32.0545, 34.753),
					fictional("tlv-jaffa-boulangerie", "Boulangerie de la Tour", "restaurant", "Jaffa", 32.055, 34.755),
				}},
			{ID: "tlv-aeroport", Name: "Aéroport (Lod)", Lat: 32.0055, Lng: 34.8854, Blurb: "L'aéroport Ben Gourion, à Lod.",
				Admin: Admin{Type: "commune", Parent: "District centre", Mairie: "mairie-tlv-aeroport", Source: game.Partial("Aéroport (Lod), à Tel-Aviv.", "https://fr.wikipedia.org/wiki/Tel-Aviv")},
				Places: []Place{
					{ID: "mairie-tlv-aeroport", Name: "Municipalité de Lod", Kind: "mairie", Lat: 31.951, Lng: 34.888, Real: false, Approx: true, Operator: "Municipalité de Lod", Source: invented},
					osmAt("tlv-aeroport-bg", "Aéroport Ben Gourion", "aeroport", "", 32.00271, 34.88092, "L'aéroport international d'Israël."),
					fictional("tlv-aeroport-hotel", "Hôtel de l'Aéroport de Lod", "hotel", "Lod", 31.9855, 34.8854),
				}},
		},
	},
	{
		ID: "amman", Name: "Amman", Country: "jo", Zoom: 11.5, Lat: 31.9539, Lng: 35.9106,
		Blurb: "La capitale de la Jordanie, blanche sur ses sept collines : la citadelle, le théâtre romain, la rue Rainbow, le knafeh chaud du centre.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat d'Amman", Source: game.Partial("Capitale de la Jordanie. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Amman", srcOSM)},
		Communes: []Commune{
			{ID: "amman-centre", Name: "Centre (Balad)", Lat: 31.952, Lng: 35.933, Blurb: "Le centre du bas : le théâtre romain, la citadelle au-dessus, la mosquée du roi Hussein, les souks, et la rue Rainbow sur le jebel Amman.",
				Admin: Admin{Type: "quartier", Parent: "Gouvernorat d'Amman", Mairie: "mairie-amman-centre", Source: game.Partial("Centre (Balad), à Amman.", "https://fr.wikipedia.org/wiki/Amman")},
				Places: []Place{
					{ID: "mairie-amman-centre", Name: "Grand Amman (Municipalité)", Kind: "mairie", Lat: 31.9455, Lng: 35.9292, Real: true, Approx: true, Operator: "Municipalité du Grand Amman", Source: game.Partial("Grand Amman (Municipalité) ; position approchée.", "https://fr.wikipedia.org/wiki/Amman", srcOSM)},
					osmAt("amman-citadelle", "Citadelle d'Amman", "culture", "Jebel al-Qal'a", 31.95448, 35.93671, "Le temple d'Hercule et le palais omeyyade, au sommet."),
					osmAt("amman-theatre", "Théâtre romain", "culture", "Balad", 31.95162, 35.93929, "Le théâtre de 6 000 places taillé dans la colline."),
					osmAt("amman-roi-abdallah", "Mosquée du roi Abdallah Ier", "worship", "Abdali", 31.96117, 35.91287, "La mosquée à la coupole bleue."),
					osmAt("amman-rainbow", "Rue Rainbow", "rue", "Jebel Amman", 31.95063, 35.92352, "La rue des cafés et des vieilles maisons."),
					fictional("amman-centre-gare", "Gare routière d'Abdali", "transport", "Abdali", 31.962, 35.916),
					fictional("amman-centre-knafeh", "Knafeh du Balad", "restaurant", "Balad", 31.952, 35.935),
					fictional("amman-centre-mansaf", "Restaurant Le Mansaf", "restaurant", "Balad", 31.953, 35.933),
					fictional("amman-centre-falafel", "Falafel Hashem du coin", "restaurant", "Balad", 31.9528, 35.932),
					fictional("amman-centre-hotel", "Hôtel des Sept Collines", "hotel", "Jebel Amman", 31.951, 35.924),
				}},
			{ID: "amman-aeroport", Name: "Aéroport (Zizya)", Lat: 31.7226, Lng: 35.9932, Blurb: "L'aéroport international Reine-Alia, au sud.",
				Admin: Admin{Type: "quartier", Parent: "Gouvernorat d'Amman", Mairie: "mairie-amman-aeroport", Source: game.Partial("Aéroport (Zizya), à Amman.", "https://fr.wikipedia.org/wiki/Amman")},
				Places: []Place{
					{ID: "mairie-amman-aeroport", Name: "Municipalité du Grand Amman (sud)", Kind: "mairie", Lat: 31.76, Lng: 35.98, Real: false, Approx: true, Operator: "Municipalité du Grand Amman", Source: invented},
					osmAt("amman-aeroport-qaia", "Aéroport international Reine-Alia", "aeroport", "", 31.7238, 36.00724, "L'aéroport d'Amman."),
					fictional("amman-aeroport-hotel", "Hôtel du Désert d'Alia", "hotel", "Zizya", 31.7326, 35.9932),
				}},
		},
	},
	{
		ID: "petra", Name: "Pétra", Country: "jo", Zoom: 13, Lat: 30.3285, Lng: 35.4444,
		Blurb: "La cité nabatéenne taillée dans la roche rose : le Siq, le Trésor, le Monastère, et le village de Wadi Moussa. On y vient par la route depuis Amman.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat de Ma'an", Source: game.Partial("Site nabatéen, au village de Wadi Moussa ; pas d'aéroport. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Pétra", srcOSM)},
		Communes: []Commune{
			{ID: "petra-centre", Name: "Wadi Moussa – Pétra", Lat: 30.325, Lng: 35.46, Blurb: "Le village de Wadi Moussa et l'entrée du site, le Siq qui mène au Trésor.",
				Admin: Admin{Type: "commune", Parent: "Gouvernorat de Ma'an", Mairie: "mairie-petra-centre", Source: game.Partial("Wadi Moussa – Pétra, à Pétra.", "https://fr.wikipedia.org/wiki/Pétra")},
				Places: []Place{
					{ID: "mairie-petra-centre", Name: "Municipalité de Wadi Moussa", Kind: "mairie", Lat: 30.3219, Lng: 35.4762, Real: true, Approx: true, Operator: "Autorité de la région de Pétra", Source: game.Partial("Municipalité de Wadi Moussa ; position approchée.", "https://fr.wikipedia.org/wiki/Pétra", srcOSM)},
					osmAt("petra-tresor", "Al-Khazneh (le Trésor)", "culture", "Pétra", 30.32208, 35.45153, "La façade de 40 m taillée dans la falaise rose, au bout du Siq."),
					osmAt("petra-siq", "Le Siq", "nature", "Pétra", 30.32291, 35.45604, "Le défilé d'un kilomètre entre les falaises."),
					osmAt("petra-monastere", "Ad-Deir (le Monastère)", "culture", "Pétra", 30.33821, 35.43098, "La grande façade en haut des 800 marches."),
					fictional("petra-centre-gare", "Arrêt des cars de Wadi Moussa", "transport", "Wadi Moussa", 30.323, 35.473),
					fictional("petra-centre-resto", "Restaurant Le Nabatéen (zarb)", "restaurant", "Wadi Moussa", 30.324, 35.472),
					fictional("petra-centre-hotel", "Hôtel Les Roches roses", "hotel", "Wadi Moussa", 30.326, 35.474),
				}},
		},
	},
	{
		ID: "teheran", Name: "Téhéran", Country: "ir", Zoom: 11, Lat: 35.6892, Lng: 51.389,
		Blurb: "La capitale de l'Iran au pied des monts Alborz : la tour Azadi, le palais du Golestan, le Grand Bazar, la tour Milad, les montagnes enneigées au nord l'hiver.",
		Admin: CityAdmin{Type: "ville", Region: "Province de Téhéran", Source: game.Partial("Capitale de l'Iran. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Téhéran", srcOSM)},
		Communes: []Commune{
			{ID: "teh-centre", Name: "Centre (Bazar – Golestan)", Lat: 35.68, Lng: 51.42, Blurb: "Le vieux Téhéran : le palais du Golestan, le Grand Bazar, la place Imam-Khomeini, les musées.",
				Admin: Admin{Type: "district", Parent: "Ville de Téhéran", Mairie: "mairie-teh-centre", Source: game.Partial("Centre (Bazar – Golestan), à Téhéran.", "https://fr.wikipedia.org/wiki/Téhéran")},
				Places: []Place{
					{ID: "mairie-teh-centre", Name: "Mairie de Téhéran", Kind: "mairie", Lat: 35.686, Lng: 51.419, Real: true, Approx: true, Operator: "Municipalité de Téhéran", Source: game.Partial("Mairie de Téhéran ; position approchée.", "https://fr.wikipedia.org/wiki/Téhéran", srcOSM)},
					osmAt("teh-golestan", "Palais du Golestan", "culture", "Arg", 35.68042, 51.42061, "Le palais aux faïences et aux miroirs, patrimoine mondial."),
					osmAt("teh-bazar", "Grand Bazar de Téhéran", "market", "Bazar", 35.67304, 51.42313, "Les kilomètres de galeries couvertes : tapis, épices, cuivre, or."),
					approxAt("teh-musee", "Musée national d'Iran", "culture", "Centre", 35.687, 51.4145, "Sept mille ans d'histoire de la Perse. Position approchée."),
					osmAt("teh-milad", "Tour Milad", "culture", "Gisha", 35.7447, 51.37527, "La tour de télévision de 435 m."),
					fictional("teh-centre-gare", "Gare routière du Sud (Terminal Jonoub)", "transport", "Sud", 35.65, 51.42),
					fictional("teh-centre-kebab", "Kebab Koobideh du Bazar", "restaurant", "Bazar", 35.675, 51.423),
					fictional("teh-centre-dizi", "Dizi Sara", "restaurant", "Bazar", 35.676, 51.421),
					fictional("teh-centre-tchai", "Maison de thé Hafez", "restaurant", "Centre", 35.682, 51.418),
					fictional("teh-centre-tapis", "Tapis de Tabriz du Bazar", "boutique", "Bazar", 35.6745, 51.424),
					fictional("teh-centre-hotel", "Hôtel Ferdowsi", "hotel", "Centre", 35.683, 51.42),
				}},
			{ID: "teh-azadi", Name: "Azadi – ouest", Lat: 35.6997, Lng: 51.338, Blurb: "La tour Azadi, porte de la ville vers l'ouest, et le stade.",
				Admin: Admin{Type: "district", Parent: "Ville de Téhéran", Mairie: "mairie-teh-azadi", Source: game.Partial("Azadi – ouest, à Téhéran.", "https://fr.wikipedia.org/wiki/Téhéran")},
				Places: []Place{
					{ID: "mairie-teh-azadi", Name: "Mairie du district 9", Kind: "mairie", Lat: 35.69, Lng: 51.33, Real: false, Approx: true, Operator: "Municipalité de Téhéran", Source: invented},
					osmAt("teh-azadi-tour", "Tour Azadi", "culture", "Azadi", 35.69974, 51.33806, "La tour blanche de 1971, en arc, sur la grande place."),
					osmAt("teh-azadi-stade", "Stade Azadi", "sport", "Ekbatan", 35.7245, 51.27555, "Le grand stade de football."),
					fictional("teh-azadi-resto", "Chelo Kebab Azadi", "restaurant", "Azadi", 35.7007, 51.341),
				}},
			{ID: "teh-tajrish", Name: "Tajrish – Darband", Lat: 35.804, Lng: 51.434, Blurb: "Le nord au pied de la montagne : le bazar de Tajrish, le sentier de Darband et ses cafés au bord du torrent.",
				Admin: Admin{Type: "district", Parent: "Ville de Téhéran", Mairie: "mairie-teh-tajrish", Source: game.Partial("Tajrish – Darband, à Téhéran.", "https://fr.wikipedia.org/wiki/Téhéran")},
				Places: []Place{
					{ID: "mairie-teh-tajrish", Name: "Mairie du district 1", Kind: "mairie", Lat: 35.8, Lng: 51.43, Real: false, Approx: true, Operator: "Municipalité de Téhéran", Source: invented},
					approxAt("teh-tajrish-bazar", "Bazar de Tajrish", "market", "Tajrish", 35.8051, 51.4344, "Le marché des fruits et des fleurs du nord. Position approchée."),
					osmAt("teh-tajrish-darband", "Darband", "nature", "Darband", 35.82621, 51.426, "Le sentier qui monte dans la montagne, ses cafés et ses brochettes."),
					fictional("teh-tajrish-ash", "Ash Reshteh de Tajrish", "restaurant", "Tajrish", 35.805, 51.435),
				}},
			{ID: "teh-ika", Name: "Aéroport Imam-Khomeini", Lat: 35.4161, Lng: 51.1522, Blurb: "Le grand aéroport international, au sud de la ville.",
				Admin: Admin{Type: "district", Parent: "Province de Téhéran", Mairie: "mairie-teh-ika", Source: game.Partial("Aéroport Imam-Khomeini, à Téhéran.", "https://fr.wikipedia.org/wiki/Téhéran")},
				Places: []Place{
					{ID: "mairie-teh-ika", Name: "Administration de l'aéroport", Kind: "mairie", Lat: 35.42, Lng: 51.16, Real: false, Approx: true, Operator: "Province de Téhéran", Source: invented},
					osmAt("teh-aeroport", "Aéroport international Imam-Khomeini", "aeroport", "", 35.41646, 51.14483, "L'aéroport international de Téhéran."),
					fictional("teh-ika-hotel", "Hôtel de la route de Qom", "hotel", "Aéroport", 35.4261, 51.1622),
				}},
		},
	},
	{
		ID: "ispahan", Name: "Ispahan", Country: "ir", Zoom: 12, Lat: 32.6546, Lng: 51.668,
		Blurb: "« Ispahan, la moitié du monde » : la place Naghsh-e Jahan, la mosquée de l'Imam et ses faïences bleues, les ponts sur le Zayandeh Roud, la cathédrale de Vank.",
		Admin: CityAdmin{Type: "ville", Region: "Province d'Ispahan", Source: game.Partial("Grande ville d'Iran, ancienne capitale des Safavides. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Ispahan", srcOSM)},
		Communes: []Commune{
			{ID: "isf-centre", Name: "Centre (Naghsh-e Jahan)", Lat: 32.657, Lng: 51.677, Blurb: "La grande place des Safavides, ses mosquées et son bazar ; au sud, les ponts et le quartier arménien de Djolfa.",
				Admin: Admin{Type: "district", Parent: "Ville d'Ispahan", Mairie: "mairie-isf-centre", Source: game.Partial("Centre (Naghsh-e Jahan), à Ispahan.", "https://fr.wikipedia.org/wiki/Ispahan")},
				Places: []Place{
					{ID: "mairie-isf-centre", Name: "Mairie d'Ispahan", Kind: "mairie", Lat: 32.6619, Lng: 51.674, Real: true, Approx: true, Operator: "Municipalité d'Ispahan", Source: game.Partial("Mairie d'Ispahan ; position approchée.", "https://fr.wikipedia.org/wiki/Ispahan", srcOSM)},
					osmAt("isf-place", "Place Naghsh-e Jahan", "rue", "Centre", 32.6581, 51.67736, "La place de 500 m, ses arcades, ses calèches."),
					osmAt("isf-mosquee-imam", "Mosquée de l'Imam (mosquée du Shah)", "worship", "Naghsh-e Jahan", 32.65476, 51.6784, "La coupole et l'iwan couverts de faïences bleues."),
					osmAt("isf-lotfollah", "Mosquée Cheikh Lotfollah", "worship", "Naghsh-e Jahan", 32.65737, 51.67865, "La coupole couleur crème qui vire au rose."),
					approxAt("isf-ali-qapu", "Palais Ali Qapu", "culture", "Naghsh-e Jahan", 32.6578, 51.6763, "Le palais et sa salle de musique. Position approchée."),
					osmAt("isf-si-o-se", "Pont Si-o-Se Pol", "rue", "Zayandeh Roud", 32.64459, 51.66751, "Le pont aux trente-trois arches."),
					osmAt("isf-khaju", "Pont Khadju", "rue", "Zayandeh Roud", 32.63681, 51.68331, "Le pont-barrage où l'on chante le soir sous les arches."),
					approxAt("isf-vank", "Cathédrale de Vank", "worship", "Djolfa", 32.6347, 51.6558, "La cathédrale arménienne et ses fresques. Position approchée."),
					osmAt("isf-aeroport", "Aéroport international d'Ispahan", "aeroport", "", 32.76145, 51.88818, "L'aéroport d'Ispahan."),
					fictional("isf-centre-gare", "Gare routière de Kaveh", "transport", "Nord", 32.687, 51.667),
					fictional("isf-centre-beryani", "Beryani de la Place", "restaurant", "Naghsh-e Jahan", 32.658, 51.679),
					fictional("isf-centre-tchai", "Maison de thé Azadegan", "restaurant", "Naghsh-e Jahan", 32.659, 51.678),
					fictional("isf-centre-gaz", "Confiserie Gaz d'Ispahan", "boutique", "Bazar", 32.661, 51.68),
					fictional("isf-centre-hotel", "Hôtel Les Deux Ponts", "hotel", "Chahar Bagh", 32.651, 51.672),
				}},
		},
	},
	{
		ID: "koweit", Name: "Koweït", Country: "kw", Zoom: 12, Lat: 29.3759, Lng: 47.9774,
		Blurb: "La capitale du Koweït au bord du Golfe : les tours du Koweït et leurs boules bleues, la Grande Mosquée, le souk Al-Mubarakiya.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat de la Capitale", Source: game.Partial("Capitale : Koweït. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Koweït", srcOSM)},
		Communes: []Commune{
			{ID: "koweit-centre", Name: "Centre-ville", Lat: 29.3759, Lng: 47.9774, Blurb: "Le centre de Koweït : Tours du Koweït, Grande Mosquée du Koweït, Souk Al-Mubarakiya.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Koweït", Mairie: "mairie-koweit-centre", Source: game.Partial("Centre-ville, à Koweït.", "https://fr.wikipedia.org/wiki/Koweït")},
				Places: []Place{
					townHall("koweit-centre", "Municipalité du Koweït", "Ville de Koweït", 29.36929, 47.97291, "https://fr.wikipedia.org/wiki/Koweït"),
					osmAt("koweit-aeroport", "Aéroport international du Koweït", "aeroport", "", 29.22027, 47.95516, "L'aéroport de Koweït."),
					osmAt("koweit-tours", "Tours du Koweït", "culture", "", 29.38992, 48.00329, "Les trois tours et leurs sphères couvertes d'écailles bleues."),
					approxAt("koweit-grande-mosquee", "Grande Mosquée du Koweït", "worship", "", 29.3763, 47.9885, "La plus grande mosquée du pays. Position approchée."),
					approxAt("koweit-mubarakiya", "Souk Al-Mubarakiya", "market", "", 29.3723, 47.9754, "Le vieux souk : dattes, épices, poisson grillé. Position approchée."),
					approxAt("koweit-plage", "Plage de la Corniche", "beach", "", 29.387, 48, "La plage au pied des tours. Position approchée."),
					fictional("koweit-machboos", "Machboos Al-Mubarakiya", "restaurant", "Centre-ville", 29.3729, 47.9754),
					fictional("koweit-hotel", "Hôtel Les Tours bleues", "hotel", "Centre-ville", 29.3809, 47.9854),
					fictional("koweit-gare", "Gare routière du Koweït", "transport", "Centre-ville", 29.3739, 47.9774),
				}},
		},
	},
	{
		ID: "manama", Name: "Manama", Country: "bh", Zoom: 12, Lat: 26.2285, Lng: 50.586,
		Blurb: "La capitale de Bahreïn, île du Golfe reliée à l'Arabie par une chaussée : Bab el-Bahreïn et le souk, la mosquée Al-Fateh, le fort de Bahreïn.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat de la Capitale", Source: game.Partial("Capitale : Bahreïn. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Manama", srcOSM)},
		Communes: []Commune{
			{ID: "manama-centre", Name: "Centre-ville", Lat: 26.2285, Lng: 50.586, Blurb: "Le centre de Manama : Bab el-Bahreïn et le souk, Mosquée Al-Fateh, Fort de Bahreïn (Qal'at al-Bahreïn).",
				Admin: Admin{Type: "quartier", Parent: "Ville de Manama", Mairie: "mairie-manama-centre", Source: game.Partial("Centre-ville, à Manama.", "https://fr.wikipedia.org/wiki/Manama")},
				Places: []Place{
					townHall("manama-centre", "Municipalité de Manama", "Ville de Manama", 26.23166, 50.57379, "https://fr.wikipedia.org/wiki/Manama"),
					osmAt("manama-aeroport", "Aéroport international de Bahreïn", "aeroport", "", 26.26965, 50.63289, "L'aéroport de Manama."),
					osmAt("manama-bab", "Bab el-Bahreïn et le souk", "market", "", 26.23399, 50.57553, "La porte et le souk de Manama."),
					approxAt("manama-al-fateh", "Mosquée Al-Fateh", "worship", "", 26.2197, 50.5973, "La grande mosquée ouverte aux visiteurs. Position approchée."),
					osmAt("manama-fort", "Fort de Bahreïn (Qal'at al-Bahreïn)", "culture", "", 26.23335, 50.52, "Le fort sur un site habité depuis quatre mille ans."),
					approxAt("manama-wtc", "Bahrain World Trade Center", "culture", "", 26.2151, 50.5856, "Les deux tours et leurs éoliennes. Position approchée."),
					fictional("manama-resto", "Restaurant Les Perles", "restaurant", "Centre-ville", 26.2335, 50.578),
					fictional("manama-halwa", "Halwa de Muharraq", "boutique", "Centre-ville", 26.2345, 50.576),
					fictional("manama-hotel", "Hôtel Bab el-Bahreïn", "hotel", "Centre-ville", 26.2355, 50.576),
					fictional("manama-gare", "Gare routière de Manama", "transport", "Centre-ville", 26.2345, 50.577),
				}},
		},
	},
	{
		ID: "mascate", Name: "Mascate", Country: "om", Zoom: 12, Lat: 23.588, Lng: 58.3829,
		Blurb: "La capitale d'Oman, blanche entre la mer et les montagnes : la grande mosquée Sultan-Qabous, la corniche et le souk de Mutrah, l'opéra royal, les forts portugais.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat de Mascate", Source: game.Partial("Capitale : Oman. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Mascate", srcOSM)},
		Communes: []Commune{
			{ID: "mascate-centre", Name: "Centre-ville", Lat: 23.588, Lng: 58.3829, Blurb: "Le centre de Mascate : Grande mosquée Sultan-Qabous, Souk de Mutrah, Corniche de Mutrah.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Mascate", Mairie: "mairie-mascate-centre", Source: game.Partial("Centre-ville, à Mascate.", "https://fr.wikipedia.org/wiki/Mascate")},
				Places: []Place{
					townHall("mascate-centre", "Municipalité de Mascate", "Ville de Mascate", 23.61495, 58.54318, "https://fr.wikipedia.org/wiki/Mascate"),
					osmAt("mascate-aeroport", "Aéroport international de Mascate", "aeroport", "", 23.59947, 58.2738, "L'aéroport de Mascate."),
					osmAt("mascate-grande-mosquee", "Grande mosquée Sultan-Qabous", "worship", "", 23.58379, 58.38852, "La grande mosquée et son tapis tissé d'une seule pièce."),
					osmAt("mascate-mutrah", "Souk de Mutrah", "market", "", 23.61941, 58.56502, "Le souk de l'encens, de l'argent et des khanjars."),
					osmAt("mascate-corniche", "Corniche de Mutrah", "beach", "", 23.62018, 58.56453, "La promenade face aux boutres."),
					osmAt("mascate-opera", "Opéra royal de Mascate", "culture", "", 23.61425, 58.46856, "L'opéra de pierre blanche."),
					fictional("mascate-shuwa", "Restaurant Shuwa d'Oman", "restaurant", "Centre-ville", 23.618, 58.5529),
					fictional("mascate-halwa", "Halwa omanaise de Mutrah", "boutique", "Centre-ville", 23.618, 58.5669),
					fictional("mascate-hotel", "Hôtel L'Encens", "hotel", "Centre-ville", 23.616, 58.5629),
					fictional("mascate-gare", "Gare routière de Ruwi", "transport", "Centre-ville", 23.598, 58.5329),
				}},
		},
	},
	{
		ID: "bagdad", Name: "Bagdad", Country: "iq", Zoom: 12, Lat: 33.3152, Lng: 44.3661,
		Blurb: "La capitale de l'Irak sur le Tigre : la rue Al-Mutanabbi et ses livres, l'école Al-Mustansiriya, le monument au Martyr, le poisson masgouf grillé au bord du fleuve.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat de Bagdad", Source: game.Partial("Capitale : Irak. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Bagdad", srcOSM)},
		Communes: []Commune{
			{ID: "bagdad-centre", Name: "Centre-ville", Lat: 33.3152, Lng: 44.3661, Blurb: "Le centre de Bagdad : Rue Al-Mutanabbi, Al-Mustansiriya, Monument au Martyr (Al-Shaheed).",
				Admin: Admin{Type: "quartier", Parent: "Ville de Bagdad", Mairie: "mairie-bagdad-centre", Source: game.Partial("Centre-ville, à Bagdad.", "https://fr.wikipedia.org/wiki/Bagdad")},
				Places: []Place{
					townHall("bagdad-centre", "Municipalité de Bagdad", "Ville de Bagdad", 33.33505, 44.40442, "https://fr.wikipedia.org/wiki/Bagdad"),
					osmAt("bagdad-aeroport", "Aéroport international de Bagdad", "aeroport", "", 33.26768, 44.22892, "L'aéroport de Bagdad."),
					osmAt("bagdad-mutanabbi", "Rue Al-Mutanabbi", "market", "", 33.34074, 44.38872, "La rue des libraires, ouverte le vendredi matin."),
					approxAt("bagdad-mustansiriya", "Al-Mustansiriya", "culture", "", 33.3421, 44.3848, "L'école abbasside du XIIIe siècle au bord du Tigre. Position approchée."),
					osmAt("bagdad-martyr", "Monument au Martyr (Al-Shaheed)", "culture", "", 33.34345, 44.44612, "La coupole turquoise fendue en deux."),
					osmAt("bagdad-abou-nawas", "Rue Abou-Nawas", "rue", "", 33.29897, 44.41672, "La promenade sur le Tigre et ses grills à masgouf."),
					fictional("bagdad-masgouf", "Masgouf du Tigre", "restaurant", "Centre-ville", 33.3092, 44.4141),
					fictional("bagdad-tchai", "Café Shabandar", "restaurant", "Centre-ville", 33.3392, 44.3881),
					fictional("bagdad-hotel", "Hôtel Le Tigre", "hotel", "Centre-ville", 33.3172, 44.4061),
					fictional("bagdad-gare", "Gare routière d'Allawi", "transport", "Centre-ville", 33.3252, 44.3761),
				}},
		},
	},
	{
		ID: "damas", Name: "Damas", Country: "sy", Zoom: 12, Lat: 33.5138, Lng: 36.2765,
		Blurb: "L'une des plus vieilles villes habitées du monde : la mosquée des Omeyyades, le souk Al-Hamidiyya, le palais Azem, les ruelles de la vieille ville.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat de Damas", Source: game.Partial("Capitale : Syrie. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Damas", srcOSM)},
		Communes: []Commune{
			{ID: "damas-centre", Name: "Centre-ville", Lat: 33.5138, Lng: 36.2765, Blurb: "Le centre de Damas : Mosquée des Omeyyades, Souk Al-Hamidiyya, Palais Azem.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Damas", Mairie: "mairie-damas-centre", Source: game.Partial("Centre-ville, à Damas.", "https://fr.wikipedia.org/wiki/Damas")},
				Places: []Place{
					townHall("damas-centre", "Gouvernorat de Damas", "Ville de Damas", 33.51068, 36.28626, "https://fr.wikipedia.org/wiki/Damas"),
					osmAt("damas-aeroport", "Aéroport international de Damas", "aeroport", "", 33.4102, 36.52406, "L'aéroport de Damas."),
					approxAt("damas-omeyyades", "Mosquée des Omeyyades", "worship", "", 33.5115, 36.3066, "La grande mosquée du VIIIe siècle et sa cour de marbre. Position approchée."),
					approxAt("damas-hamidiyya", "Souk Al-Hamidiyya", "market", "", 33.5113, 36.3021, "Le grand souk couvert de tôle percée d'étoiles. Position approchée."),
					osmAt("damas-azem", "Palais Azem", "culture", "", 33.51019, 36.30701, "Le palais du XVIIIe siècle et sa cour aux citronniers."),
					approxAt("damas-rue-droite", "Rue Droite", "rue", "", 33.5095, 36.309, "La rue de la vieille ville, de porte à porte. Position approchée."),
					fictional("damas-glaces", "Glacier du souk (booza)", "restaurant", "Centre-ville", 33.5113, 36.3015),
					fictional("damas-shawarma", "Shawarma de la porte de Bab Touma", "restaurant", "Centre-ville", 33.5128, 36.3145),
					fictional("damas-hotel", "Hôtel Le Jasmin", "hotel", "Centre-ville", 33.5108, 36.3065),
					fictional("damas-gare", "Gare routière de Damas", "transport", "Centre-ville", 33.5188, 36.2765),
				}},
		},
	},
	{
		ID: "sanaa", Name: "Sanaa", Country: "ye", Zoom: 12, Lat: 15.3694, Lng: 44.191,
		Blurb: "La capitale du Yémen à 2 300 m d'altitude : la vieille ville et ses tours de terre décorées de blanc, Bab al-Yaman, le souk du sel.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat de la Capitale", Source: game.Partial("Capitale : Yémen. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Sanaa", srcOSM)},
		Communes: []Commune{
			{ID: "sanaa-centre", Name: "Centre-ville", Lat: 15.3694, Lng: 44.191, Blurb: "Le centre de Sanaa : Vieille ville de Sanaa, Bab al-Yaman, Souk al-Milh.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Sanaa", Mairie: "mairie-sanaa-centre", Source: game.Partial("Centre-ville, à Sanaa.", "https://fr.wikipedia.org/wiki/Sanaa")},
				Places: []Place{
					{ID: "mairie-sanaa-centre", Name: "Municipalité de Sanaa", Kind: "mairie", Lat: 15.35, Lng: 44.2, Real: true, Approx: true, Operator: "Ville de Sanaa", Source: game.Partial("Municipalité de Sanaa ; position approchée.", "https://fr.wikipedia.org/wiki/Sanaa", srcOSM)},
					osmAt("sanaa-aeroport", "Aéroport international de Sanaa", "aeroport", "", 15.47455, 44.21974, "L'aéroport de Sanaa."),
					approxAt("sanaa-vieille-ville", "Vieille ville de Sanaa", "culture", "", 15.355, 44.215, "Les maisons-tours de terre et de plâtre blanc, patrimoine mondial. Position approchée."),
					osmAt("sanaa-bab", "Bab al-Yaman", "rue", "", 15.35121, 44.21465, "La porte de la vieille ville."),
					approxAt("sanaa-souk", "Souk al-Milh", "market", "", 15.354, 44.213, "Le souk du sel, des épices et du café. Position approchée."),
					approxAt("sanaa-grande-mosquee", "Grande Mosquée de Sanaa", "worship", "", 15.353, 44.216, "L'une des plus anciennes mosquées. Position approchée."),
					fictional("sanaa-saltah", "Saltah de Bab al-Yaman", "restaurant", "Centre-ville", 15.3524, 44.209),
					fictional("sanaa-cafe", "Café de moka", "restaurant", "Centre-ville", 15.3544, 44.214),
					fictional("sanaa-hotel", "Hôtel Les Tours de Sanaa", "hotel", "Centre-ville", 15.3534, 44.213),
					fictional("sanaa-gare", "Gare routière de Sanaa", "transport", "Centre-ville", 15.3644, 44.196),
				}},
		},
	},
	{
		ID: "ramallah", Name: "Ramallah", Country: "ps", Zoom: 12, Lat: 31.9038, Lng: 35.2034,
		Blurb: "La ville sur les collines de Cisjordanie : la place al-Manara et ses lions, les cafés, le musée palestinien, les vergers d'oliviers autour.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat de Ramallah et al-Bireh", Source: game.Partial("Grande ville : Palestine. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Ramallah", srcOSM)},
		Communes: []Commune{
			{ID: "ramallah-centre", Name: "Centre-ville", Lat: 31.9038, Lng: 35.2034, Blurb: "Le centre de Ramallah : Place al-Manara, Musée palestinien, Collines d'oliviers.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Ramallah", Mairie: "mairie-ramallah-centre", Source: game.Partial("Centre-ville, à Ramallah.", "https://fr.wikipedia.org/wiki/Ramallah")},
				Places: []Place{
					townHall("ramallah-centre", "Municipalité de Ramallah", "Ville de Ramallah", 31.90212, 35.19958, "https://fr.wikipedia.org/wiki/Ramallah"),
					osmAt("ramallah-manara", "Place al-Manara", "rue", "", 31.90496, 35.20443, "La place centrale et ses lions de pierre."),
					osmAt("ramallah-musee", "Musée palestinien", "culture", "", 31.96344, 35.18279, "Le musée sur sa colline en terrasses, à Birzeit."),
					approxAt("ramallah-oliviers", "Collines d'oliviers", "nature", "", 31.92, 35.16, "Les vergers d'oliviers, et la récolte d'octobre. Position approchée."),
					fictional("ramallah-knafeh", "Knafeh de la Manara", "restaurant", "Centre-ville", 31.9033, 35.2044),
					fictional("ramallah-musakhan", "Musakhan de grand-mère", "restaurant", "Centre-ville", 31.9048, 35.2034),
					fictional("ramallah-hotel", "Hôtel Les Oliviers", "hotel", "Centre-ville", 31.9058, 35.2024),
					fictional("ramallah-gare", "Gare routière de Ramallah", "transport", "Centre-ville", 31.9028, 35.2044),
				}},
		},
	},
	{
		ID: "bethleem", Name: "Bethléem", Country: "ps", Zoom: 12, Lat: 31.7054, Lng: 35.2024,
		Blurb: "La ville de la Nativité : la basilique sur la grotte, la place de la Crèche et la mosquée d'Omar face à face, la vieille ville et ses artisans de bois d'olivier.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat de Bethléem", Source: game.Partial("Grande ville : Palestine. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Bethléem", srcOSM)},
		Communes: []Commune{
			{ID: "bethleem-centre", Name: "Centre-ville", Lat: 31.7054, Lng: 35.2024, Blurb: "Le centre de Bethléem : Basilique de la Nativité, Place de la Crèche, Mosquée d'Omar.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Bethléem", Mairie: "mairie-bethleem-centre", Source: game.Partial("Centre-ville, à Bethléem.", "https://fr.wikipedia.org/wiki/Bethléem")},
				Places: []Place{
					townHall("bethleem-centre", "Municipalité de Bethléem", "Ville de Bethléem", 31.7043, 35.20539, "https://fr.wikipedia.org/wiki/Bethléem"),
					osmAt("bethleem-nativite", "Basilique de la Nativité", "worship", "", 31.70432, 35.20735, "La basilique sur la grotte de la naissance du Christ."),
					osmAt("bethleem-creche", "Place de la Crèche", "rue", "", 31.70441, 35.20673, "La place, son grand sapin à Noël."),
					osmAt("bethleem-omar", "Mosquée d'Omar", "worship", "", 31.70455, 35.2054, "La mosquée face à la basilique."),
					fictional("bethleem-artisan", "Atelier de bois d'olivier", "boutique", "Centre-ville", 31.7044, 35.2064),
					fictional("bethleem-falafel", "Falafel de la rue de l'Étoile", "restaurant", "Centre-ville", 31.7049, 35.2054),
					fictional("bethleem-hotel", "Hôtel L'Étoile", "hotel", "Centre-ville", 31.7059, 35.2074),
					fictional("bethleem-gare", "Gare routière de Bethléem", "transport", "Centre-ville", 31.7064, 35.2034),
				}},
		},
	},
}
