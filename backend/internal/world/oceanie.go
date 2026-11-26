package world

import "github.com/myahse/babi-life/backend/internal/game"

// L'Océanie (the update « pays-oceanie »): Sydney in depth (the harbour and its Opera House and bridge, Bondi,
// Mascot and the airport), then Melbourne, Brisbane, Perth and Canberra; Auckland and Wellington; and the islands:
// Suva (Fidji), Port Moresby (Papouasie-Nouvelle-Guinée), Nouméa (Nouvelle-Calédonie) and Papeete (Polynésie
// française), where French is spoken, Apia (Samoa), Nuku'alofa (Tonga), Port-Vila (Vanuatu). Each with its city
// hall, its airport (Air Lagune flies there, game/oceanie.go) and its famous places, positioned from
// OpenStreetMap (Nominatim, 26 November 2026) where it found them, else where they are known to be (Approx).
//
// Roads: between Australia's cities, and between Auckland and Wellington; nothing across the sea (each country
// lists no land border, so no road leaves it; the islands are Island). The seasons are the south's: summer at
// Christmas (game/oceanie.go's happenings).

// InOceanie: whether a city is in Oceania.
func InOceanie(cityID string) bool {
	c, ok := FindCity(cityID)
	return ok && CountryOf(c).Land == "oceanie"
}

// OceanieCommunes: every commune of Oceania's cities (the update hides them while closed).
func OceanieCommunes() []string {
	var out []string
	for _, c := range oceanie {
		for _, cm := range c.Communes {
			out = append(out, cm.ID)
		}
	}
	return out
}

func init() {
	for _, k := range []Country{
		{ID: "au", Name: "Australie", Flag: "🇦🇺", Land: "oceanie", Bounds: [4]float64{112.9, -43.7, 153.7, -10.6}, Key: game.OceanieKey},
		{ID: "nz", Name: "Nouvelle-Zélande", Flag: "🇳🇿", Land: "oceanie", Bounds: [4]float64{166.4, -47.3, 178.6, -34.4}, Key: game.OceanieKey},
		{ID: "fj", Name: "Fidji", Flag: "🇫🇯", Land: "oceanie", Bounds: [4]float64{176.8, -19.2, 180, -16.1}, Key: game.OceanieKey},
		{ID: "pg", Name: "Papouasie-Nouvelle-Guinée", Flag: "🇵🇬", Land: "oceanie", Bounds: [4]float64{140.8, -11.7, 156, -1.3}, Key: game.OceanieKey},
		{ID: "nc", Name: "Nouvelle-Calédonie", Flag: "🇳🇨", Land: "oceanie", Bounds: [4]float64{163.5, -22.8, 168.2, -19.5}, Key: game.OceanieKey},
		{ID: "pf", Name: "Polynésie française", Flag: "🇵🇫", Land: "oceanie", Bounds: [4]float64{-154.8, -27.7, -134.9, -7.8}, Key: game.OceanieKey},
		{ID: "ws", Name: "Samoa", Flag: "🇼🇸", Land: "oceanie", Bounds: [4]float64{-172.8, -14.1, -171.4, -13.4}, Key: game.OceanieKey},
		{ID: "to", Name: "Tonga", Flag: "🇹🇴", Land: "oceanie", Bounds: [4]float64{-176.3, -22.4, -173.7, -15.5}, Key: game.OceanieKey},
		{ID: "vu", Name: "Vanuatu", Flag: "🇻🇺", Land: "oceanie", Bounds: [4]float64{166.5, -20.3, 170.3, -13}, Key: game.OceanieKey},
	} {
		Countries[k.ID] = k
		// No land border: no road out of the country (roadLinked).
		if _, ok := Borders[k.ID]; !ok {
			Borders[k.ID] = []string{}
		}
	}
}

var oceanie = []City{
	{
		ID: "sydney", Name: "Sydney", Country: "au", Zoom: 11, Lat: -33.8688, Lng: 151.2093,
		Blurb: "La grande ville de l'Australie autour de sa baie : l'Opéra et ses voiles blanches, le Harbour Bridge, les ferries, Bondi Beach et ses surfeurs ; Noël s'y fête en été.",
		Admin: CityAdmin{Type: "ville", Region: "Nouvelle-Galles du Sud", Source: game.Partial("Plus grande ville d'Australie. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Sydney", srcOSM)},
		Communes: []Commune{
			{ID: "syd-centre", Name: "City – Circular Quay", Lat: -33.861, Lng: 151.211, Blurb: "Le centre et la baie : l'Opéra, le Harbour Bridge, les Rocks, le Jardin botanique.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Sydney", Mairie: "mairie-syd-centre", Source: game.Partial("City – Circular Quay, à Sydney.", "https://fr.wikipedia.org/wiki/Sydney")},
				Places: []Place{
					townHall("syd-centre", "Hôtel de ville de Sydney", "Ville de Sydney", -33.8732, 151.20618, "https://fr.wikipedia.org/wiki/Sydney"),
					osmAt("syd-opera", "Opéra de Sydney", "culture", "Bennelong Point", -33.8572, 151.21512, "L'opéra et ses voiles blanches sur la baie."),
					osmAt("syd-harbour-bridge", "Harbour Bridge", "rue", "The Rocks", -33.85235, 151.21085, "Le grand pont d'acier en arc, « le cintre »."),
					osmAt("syd-circular-quay", "Circular Quay", "transport", "Circular Quay", -33.86136, 151.21072, "Le quai des ferries."),
					osmAt("syd-rocks", "The Rocks", "market", "The Rocks", -33.85999, 151.20832, "Le vieux quartier et son marché du week-end."),
					osmAt("syd-jardin", "Jardin botanique royal", "nature", "Centre", -33.86277, 151.21571, "Le jardin au bord de la baie."),
					osmAt("syd-centrale", "Gare centrale de Sydney", "transport", "Haymarket", -33.88399, 151.20634, "La grande gare et la gare routière."),
					fictional("syd-centre-gare", "Terminal des cars de Central", "transport", "Haymarket", -33.8825, 151.206),
					fictional("syd-centre-pie", "Pie Shop de Circular Quay", "restaurant", "Circular Quay", -33.862, 151.21),
					fictional("syd-centre-cafe", "Café Flat White", "restaurant", "City", -33.867, 151.207),
					fictional("syd-centre-barbie", "Grill du port (barbie)", "restaurant", "Darling Harbour", -33.869, 151.199),
					fictional("syd-centre-club", "Club Kings Cross", "club", "Kings Cross", -33.874, 151.226),
					fictional("syd-centre-hotel", "Hôtel Harbourside", "hotel", "The Rocks", -33.8605, 151.207),
					fictional("syd-centre-afro", "Épicerie africaine de Blacktown Road", "boutique", "City", -33.876, 151.201),
				}},
			{ID: "syd-bondi", Name: "Bondi", Lat: -33.8915, Lng: 151.2767, Blurb: "La plage de Bondi, ses surfeurs, ses sauveteurs en jaune et rouge, la piscine d'Icebergs.",
				Admin: Admin{Type: "quartier", Parent: "Waverley", Mairie: "mairie-syd-bondi", Source: game.Partial("Bondi, à Sydney.", "https://fr.wikipedia.org/wiki/Sydney")},
				Places: []Place{
					townHall("syd-bondi", "Mairie de Waverley", "Conseil de Waverley", -33.89331, 151.25658, "https://fr.wikipedia.org/wiki/Sydney"),
					osmAt("syd-bondi-plage", "Bondi Beach", "beach", "Bondi", -33.8907, 151.27241, "La plage d'un kilomètre et ses vagues."),
					osmAt("syd-bondi-icebergs", "Piscine des Icebergs", "beach", "Bondi", -33.89505, 151.27457, "La piscine d'eau de mer battue par les vagues."),
					approxAt("syd-bondi-sentier", "Sentier côtier Bondi–Coogee", "nature", "Bondi", -33.901, 151.273, "Le sentier sur les falaises. Position approchée."),
					fictional("syd-bondi-surf", "École de surf de Bondi", "boutique", "Bondi", -33.8905, 151.2747),
					fictional("syd-bondi-fish", "Fish and chips de Campbell Parade", "restaurant", "Bondi", -33.891, 151.2737),
				}},
			{ID: "syd-mascot", Name: "Mascot (aéroport)", Lat: -33.9399, Lng: 151.1753, Blurb: "L'aéroport Kingsford-Smith, au bord de Botany Bay.",
				Admin: Admin{Type: "quartier", Parent: "Bayside", Mairie: "mairie-syd-mascot", Source: game.Partial("Mascot (aéroport), à Sydney.", "https://fr.wikipedia.org/wiki/Sydney")},
				Places: []Place{
					{ID: "mairie-syd-mascot", Name: "Conseil de Bayside", Kind: "mairie", Lat: -33.95, Lng: 151.14, Real: false, Approx: true, Operator: "Conseil de Bayside", Source: invented},
					osmAt("syd-aeroport", "Aéroport de Sydney (Kingsford-Smith)", "aeroport", "", -33.94989, 151.18197, "L'aéroport de Sydney."),
					fictional("syd-mascot-hotel", "Hôtel Botany Bay", "hotel", "Mascot", -33.9299, 151.1753),
				}},
		},
	},
	{
		ID: "melbourne", Name: "Melbourne", Country: "au", Zoom: 12, Lat: -37.8136, Lng: 144.9631,
		Blurb: "La ville des ruelles et du café : les tramways, Federation Square, le stade du cricket, la Great Ocean Road plus loin ; quatre saisons dans la même journée.",
		Admin: CityAdmin{Type: "ville", Region: "Victoria", Source: game.Partial("Grande ville : Australie. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Melbourne", srcOSM)},
		Communes: []Commune{
			{ID: "melbourne-centre", Name: "Centre-ville", Lat: -37.8136, Lng: 144.9631, Blurb: "Le centre de Melbourne : Federation Square, Melbourne Cricket Ground, Hosier Lane.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Melbourne", Mairie: "mairie-melbourne-centre", Source: game.Partial("Centre-ville, à Melbourne.", "https://fr.wikipedia.org/wiki/Melbourne")},
				Places: []Place{
					townHall("melbourne-centre", "Hôtel de ville de Melbourne", "Ville de Melbourne", -37.81492, 144.96685, "https://fr.wikipedia.org/wiki/Melbourne"),
					osmAt("melbourne-aeroport", "Aéroport de Melbourne (Tullamarine)", "aeroport", "", -37.67645, 144.83654, "L'aéroport de Melbourne."),
					osmAt("melbourne-federation", "Federation Square", "rue", "", -37.81774, 144.96916, "La place et la gare de Flinders Street en face."),
					osmAt("melbourne-mcg", "Melbourne Cricket Ground", "sport", "", -37.81991, 144.98323, "Le grand stade du cricket et du football australien."),
					osmAt("melbourne-hosier", "Hosier Lane", "rue", "", -37.81633, 144.96908, "La ruelle couverte de fresques."),
					osmAt("melbourne-queen-victoria", "Marché Queen Victoria", "market", "", -37.80739, 144.95739, "Le grand marché couvert."),
					fictional("melbourne-cafe", "Café de la ruelle Degraves", "restaurant", "Centre-ville", -37.8166, 144.9671),
					fictional("melbourne-souvlaki", "Souvlaki de Lonsdale Street", "restaurant", "Centre-ville", -37.8116, 144.9661),
					fictional("melbourne-injera", "Restaurant éthiopien de Footscray", "restaurant", "Centre-ville", -37.8036, 144.9031),
					fictional("melbourne-club", "Club Chapel Street", "club", "Centre-ville", -37.8436, 144.9931),
					fictional("melbourne-hotel", "Hôtel Yarra", "hotel", "Centre-ville", -37.8156, 144.9641),
					fictional("melbourne-gare", "Terminal des cars Southern Cross", "transport", "Centre-ville", -37.8186, 144.9521),
				}},
		},
	},
	{
		ID: "brisbane", Name: "Brisbane", Country: "au", Zoom: 12, Lat: -27.4698, Lng: 153.0251,
		Blurb: "La ville du soleil sur sa rivière : la plage artificielle de South Bank, la grande roue, les ponts, les koalas de Lone Pine.",
		Admin: CityAdmin{Type: "ville", Region: "Queensland", Source: game.Partial("Grande ville : Australie. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Brisbane", srcOSM)},
		Communes: []Commune{
			{ID: "brisbane-centre", Name: "Centre-ville", Lat: -27.4698, Lng: 153.0251, Blurb: "Le centre de Brisbane : Plage de South Bank, Story Bridge, Réserve de koalas de Lone Pine.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Brisbane", Mairie: "mairie-brisbane-centre", Source: game.Partial("Centre-ville, à Brisbane.", "https://fr.wikipedia.org/wiki/Brisbane")},
				Places: []Place{
					townHall("brisbane-centre", "Hôtel de ville de Brisbane", "Ville de Brisbane", -27.46897, 153.02349, "https://fr.wikipedia.org/wiki/Brisbane"),
					osmAt("brisbane-aeroport", "Aéroport de Brisbane", "aeroport", "", -27.38762, 153.12157, "L'aéroport de Brisbane."),
					osmAt("brisbane-south-bank", "Plage de South Bank", "beach", "", -27.47826, 153.0236, "La plage en pleine ville, au bord de la rivière."),
					osmAt("brisbane-story-bridge", "Story Bridge", "rue", "", -27.46371, 153.03575, "Le pont d'acier qu'on peut escalader."),
					osmAt("brisbane-lone-pine", "Réserve de koalas de Lone Pine", "zoo", "", -27.53518, 152.96837, "Les koalas et les kangourous."),
					fictional("brisbane-cafe", "Café de South Bank", "restaurant", "Centre-ville", -27.4778, 153.0241),
					fictional("brisbane-barbie", "Grill de la rivière", "restaurant", "Centre-ville", -27.4688, 153.0301),
					fictional("brisbane-hotel", "Hôtel Le Ruisseau", "hotel", "Centre-ville", -27.4688, 153.0241),
					fictional("brisbane-gare", "Terminal des cars de Roma Street", "transport", "Centre-ville", -27.4658, 153.0141),
				}},
		},
	},
	{
		ID: "perth", Name: "Perth", Country: "au", Zoom: 12, Lat: -31.9505, Lng: 115.8605,
		Blurb: "La ville du bout de l'Australie face à l'océan Indien : Kings Park et sa vue, la rivière Swan, la plage de Cottesloe, les quokkas de Rottnest.",
		Admin: CityAdmin{Type: "ville", Region: "Australie-Occidentale", Source: game.Partial("Grande ville : Australie. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Perth", srcOSM)},
		Communes: []Commune{
			{ID: "perth-centre", Name: "Centre-ville", Lat: -31.9505, Lng: 115.8605, Blurb: "Le centre de Perth : Kings Park, Plage de Cottesloe, Elizabeth Quay.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Perth", Mairie: "mairie-perth-centre", Source: game.Partial("Centre-ville, à Perth.", "https://fr.wikipedia.org/wiki/Perth")},
				Places: []Place{
					townHall("perth-centre", "Conseil de Perth", "Ville de Perth", -31.95666, 115.86079, "https://fr.wikipedia.org/wiki/Perth"),
					osmAt("perth-aeroport", "Aéroport de Perth", "aeroport", "", -31.94152, 115.96558, "L'aéroport de Perth."),
					osmAt("perth-kings-park", "Kings Park", "nature", "", -31.9622, 115.8326, "Le grand parc et la vue sur la ville."),
					osmAt("perth-cottesloe", "Plage de Cottesloe", "beach", "", -31.9954, 115.7512, "La plage du coucher de soleil sur l'océan Indien."),
					osmAt("perth-elizabeth-quay", "Elizabeth Quay", "rue", "", -31.9578, 115.85693, "Le quai et son pont sur la Swan."),
					fictional("perth-fish", "Fish and chips de Fremantle", "restaurant", "Centre-ville", -32.0105, 115.7605),
					fictional("perth-hotel", "Hôtel Swan River", "hotel", "Centre-ville", -31.9535, 115.8615),
					fictional("perth-gare", "Terminal des cars d'East Perth", "transport", "Centre-ville", -31.9505, 115.8805),
				}},
		},
	},
	{
		ID: "canberra", Name: "Canberra", Country: "au", Zoom: 12, Lat: -35.2809, Lng: 149.13,
		Blurb: "La capitale fédérale de l'Australie, dessinée autour d'un lac : le Parlement sous son mât, le Mémorial, la Galerie nationale.",
		Admin: CityAdmin{Type: "ville", Region: "Territoire de la capitale australienne", Source: game.Partial("Capitale : Australie. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Canberra", srcOSM)},
		Communes: []Commune{
			{ID: "canberra-centre", Name: "Centre-ville", Lat: -35.2809, Lng: 149.13, Blurb: "Le centre de Canberra : Parlement d'Australie, Lac Burley Griffin, Galerie nationale d'Australie.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Canberra", Mairie: "mairie-canberra-centre", Source: game.Partial("Centre-ville, à Canberra.", "https://fr.wikipedia.org/wiki/Canberra")},
				Places: []Place{
					townHall("canberra-centre", "Assemblée législative de l'ACT", "Ville de Canberra", -35.28166, 149.1315, "https://fr.wikipedia.org/wiki/Canberra"),
					osmAt("canberra-aeroport", "Aéroport de Canberra", "aeroport", "", -35.30439, 149.19369, "L'aéroport de Canberra."),
					osmAt("canberra-parlement", "Parlement d'Australie", "culture", "", -35.30756, 149.1246, "Le Parlement sous la colline et son grand mât."),
					approxAt("canberra-lac", "Lac Burley Griffin", "nature", "", -35.293, 149.125, "Le lac au milieu de la ville. Position approchée."),
					osmAt("canberra-galerie", "Galerie nationale d'Australie", "culture", "", -35.30093, 149.13666, "L'art aborigène et australien."),
					fictional("canberra-cafe", "Café du Lac", "restaurant", "Centre-ville", -35.2859, 149.128),
					fictional("canberra-hotel", "Hôtel Le Capitole", "hotel", "Centre-ville", -35.2799, 149.131),
					fictional("canberra-gare", "Terminal des cars de Jolimont", "transport", "Centre-ville", -35.2789, 149.128),
				}},
		},
	},
	{
		ID: "auckland", Name: "Auckland", Country: "nz", Zoom: 12, Lat: -36.8485, Lng: 174.7633,
		Blurb: "La plus grande ville de la Nouvelle-Zélande entre deux mers : la Sky Tower, le port aux voiliers, les volcans endormis, et la plus grande ville polynésienne du monde.",
		Admin: CityAdmin{Type: "ville", Region: "Région d'Auckland", Source: game.Partial("Grande ville : Nouvelle-Zélande. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Auckland", srcOSM)},
		Communes: []Commune{
			{ID: "auckland-centre", Name: "Centre-ville", Lat: -36.8485, Lng: 174.7633, Blurb: "Le centre d'Auckland : Sky Tower, Viaduct Harbour, Mont Eden (Maungawhau).",
				Admin: Admin{Type: "quartier", Parent: "Ville d'Auckland", Mairie: "mairie-auckland-centre", Source: game.Partial("Centre-ville, à Auckland.", "https://fr.wikipedia.org/wiki/Auckland")},
				Places: []Place{
					townHall("auckland-centre", "Conseil d'Auckland", "Ville d'Auckland", -36.85291, 174.76324, "https://fr.wikipedia.org/wiki/Auckland"),
					osmAt("auckland-aeroport", "Aéroport d'Auckland", "aeroport", "", -37.00655, 174.79034, "L'aéroport d'Auckland."),
					osmAt("auckland-sky-tower", "Sky Tower", "culture", "", -36.84846, 174.76218, "La tour de 328 m, et le saut à l'élastique."),
					osmAt("auckland-viaduct", "Viaduct Harbour", "beach", "", -36.8432, 174.76068, "Le port des voiliers."),
					osmAt("auckland-eden", "Mont Eden (Maungawhau)", "nature", "", -36.87621, 174.76461, "Le volcan et son cratère, au-dessus de la ville."),
					osmAt("auckland-musee", "Musée d'Auckland", "culture", "", -36.86076, 174.77781, "Le musée et les trésors maoris."),
					fictional("auckland-hangi", "Hāngī d'Otara", "restaurant", "Centre-ville", -36.9585, 174.8533),
					fictional("auckland-pie", "Pie Shop de Queen Street", "restaurant", "Centre-ville", -36.8475, 174.7643),
					fictional("auckland-club", "Club Karangahape Road", "club", "Centre-ville", -36.8565, 174.7613),
					fictional("auckland-hotel", "Hôtel Waitematā", "hotel", "Centre-ville", -36.8465, 174.7623),
					fictional("auckland-gare", "Terminal des cars de Sky City", "transport", "Centre-ville", -36.8485, 174.7623),
				}},
		},
	},
	{
		ID: "wellington", Name: "Wellington", Country: "nz", Zoom: 12, Lat: -41.2865, Lng: 174.7762,
		Blurb: "La capitale de la Nouvelle-Zélande, ventée, entre le port et les collines : la « Ruche » du Parlement, le musée Te Papa, le funiculaire rouge.",
		Admin: CityAdmin{Type: "ville", Region: "Région de Wellington", Source: game.Partial("Capitale : Nouvelle-Zélande. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Wellington", srcOSM)},
		Communes: []Commune{
			{ID: "wellington-centre", Name: "Centre-ville", Lat: -41.2865, Lng: 174.7762, Blurb: "Le centre de Wellington : La Ruche (Beehive), Musée Te Papa, Funiculaire de Wellington.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Wellington", Mairie: "mairie-wellington-centre", Source: game.Partial("Centre-ville, à Wellington.", "https://fr.wikipedia.org/wiki/Wellington")},
				Places: []Place{
					townHall("wellington-centre", "Conseil de Wellington", "Ville de Wellington", -41.28789, 174.77794, "https://fr.wikipedia.org/wiki/Wellington"),
					osmAt("wellington-aeroport", "Aéroport de Wellington", "aeroport", "", -41.3271, 174.808, "L'aéroport de Wellington."),
					osmAt("wellington-beehive", "La Ruche (Beehive)", "culture", "", -41.27844, 174.77663, "Le Parlement en forme de ruche."),
					osmAt("wellington-te-papa", "Musée Te Papa", "culture", "", -41.29033, 174.78193, "Le musée national, gratuit."),
					osmAt("wellington-funiculaire", "Funiculaire de Wellington", "transport", "", -41.28491, 174.77054, "Le funiculaire rouge vers le jardin botanique."),
					fictional("wellington-cafe", "Café Cuba Street", "restaurant", "Centre-ville", -41.2915, 174.7752),
					fictional("wellington-hotel", "Hôtel Le Vent du Détroit", "hotel", "Centre-ville", -41.2855, 174.7772),
					fictional("wellington-gare", "Gare routière de Wellington", "transport", "Centre-ville", -41.2805, 174.7762),
				}},
		},
	},
	{
		ID: "suva", Name: "Suva", Country: "fj", Zoom: 12, Lat: -18.1416, Lng: 178.4419, Island: true,
		Blurb: "La capitale des Fidji, sur l'île de Viti Levu : le marché municipal, le musée des Fidji, les danses du meke, le kava qu'on partage « bula ! ».",
		Admin: CityAdmin{Type: "ville", Region: "Division centrale", Source: game.Partial("Capitale : Fidji. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Suva", srcOSM)},
		Communes: []Commune{
			{ID: "suva-centre", Name: "Centre-ville", Lat: -18.1416, Lng: 178.4419, Blurb: "Le centre de Suva : Marché municipal de Suva, Musée des Fidji, Parc Thurston.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Suva", Mairie: "mairie-suva-centre", Source: game.Partial("Centre-ville, à Suva.", "https://fr.wikipedia.org/wiki/Suva")},
				Places: []Place{
					townHall("suva-centre", "Hôtel de ville de Suva", "Ville de Suva", -18.14133, 178.42303, "https://fr.wikipedia.org/wiki/Suva"),
					osmAt("suva-aeroport", "Aéroport de Nausori", "aeroport", "", -18.04374, 178.5605, "L'aéroport de Suva."),
					approxAt("suva-marche", "Marché municipal de Suva", "market", "", -18.1345, 178.4247, "Le marché des taros, du poisson et du kava. Position approchée."),
					osmAt("suva-musee", "Musée des Fidji", "culture", "", -18.1497, 178.4256, "Les pirogues et l'histoire des îles."),
					osmAt("suva-parc", "Parc Thurston", "nature", "", -18.14912, 178.42462, "Le jardin botanique."),
					fictional("suva-lovo", "Lovo de Suva (cuit dans la terre)", "restaurant", "Centre-ville", -18.1406, 178.4409),
					fictional("suva-kava", "Bar à kava du marché", "restaurant", "Centre-ville", -18.1356, 178.4249),
					fictional("suva-hotel", "Hôtel Bula", "hotel", "Centre-ville", -18.1426, 178.4409),
				}},
		},
	},
	{
		ID: "port-moresby", Name: "Port Moresby", Country: "pg", Zoom: 12, Lat: -9.4438, Lng: 147.1803, Island: true,
		Blurb: "La capitale de la Papouasie-Nouvelle-Guinée, au bord de la mer de Corail : le Parlement en forme de maison à esprits, le musée national, la plage d'Ela.",
		Admin: CityAdmin{Type: "ville", Region: "District de la Capitale nationale", Source: game.Partial("Capitale : Papouasie-Nouvelle-Guinée. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Port_Moresby", srcOSM)},
		Communes: []Commune{
			{ID: "port-moresby-centre", Name: "Centre-ville", Lat: -9.4438, Lng: 147.1803, Blurb: "Le centre de Port Moresby : Parlement national, Musée national, Plage d'Ela.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Port Moresby", Mairie: "mairie-port-moresby-centre", Source: game.Partial("Centre-ville, à Port Moresby.", "https://fr.wikipedia.org/wiki/Port_Moresby")},
				Places: []Place{
					{ID: "mairie-port-moresby-centre", Name: "Commission du District de la Capitale", Kind: "mairie", Lat: -9.428, Lng: 147.188, Real: true, Approx: true, Operator: "Ville de Port Moresby", Source: game.Partial("Commission du District de la Capitale ; position approchée.", "https://fr.wikipedia.org/wiki/Port_Moresby", srcOSM)},
					osmAt("port-moresby-aeroport", "Aéroport Jacksons", "aeroport", "", -9.44027, 147.21713, "L'aéroport de Port Moresby."),
					approxAt("port-moresby-parlement", "Parlement national", "culture", "", -9.432, 147.187, "Le Parlement en forme de maison haus tambaran. Position approchée."),
					osmAt("port-moresby-musee", "Musée national", "culture", "", -9.42562, 147.19013, "Les masques et les pirogues des provinces."),
					osmAt("port-moresby-ela", "Plage d'Ela", "beach", "", -9.47816, 147.15683, "La plage du centre."),
					fictional("port-moresby-mumu", "Mumu de Boroko", "restaurant", "Centre-ville", -9.4418, 147.1813),
					fictional("port-moresby-bilum", "Marché des bilums", "market", "Centre-ville", -9.4408, 147.1783),
					fictional("port-moresby-hotel", "Hôtel Le Paradisier", "hotel", "Centre-ville", -9.4448, 147.1823),
				}},
		},
	},
	{
		ID: "noumea", Name: "Nouméa", Country: "nc", Zoom: 12, Lat: -22.2758, Lng: 166.458, Island: true,
		Blurb: "La capitale de la Nouvelle-Calédonie, où l'on parle français : la place des Cocotiers, l'Anse Vata, le centre culturel Tjibaou, le lagon.",
		Admin: CityAdmin{Type: "ville", Region: "Province Sud", Source: game.Partial("Capitale : Nouvelle-Calédonie. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Nouméa", srcOSM)},
		Communes: []Commune{
			{ID: "noumea-centre", Name: "Centre-ville", Lat: -22.2758, Lng: 166.458, Blurb: "Le centre de Nouméa : Place des Cocotiers, Anse Vata, Centre culturel Tjibaou.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Nouméa", Mairie: "mairie-noumea-centre", Source: game.Partial("Centre-ville, à Nouméa.", "https://fr.wikipedia.org/wiki/Nouméa")},
				Places: []Place{
					townHall("noumea-centre", "Hôtel de ville de Nouméa", "Ville de Nouméa", -22.2712, 166.43946, "https://fr.wikipedia.org/wiki/Nouméa"),
					osmAt("noumea-aeroport", "Aéroport de La Tontouta", "aeroport", "", -22.0149, 166.21407, "L'aéroport de Nouméa."),
					osmAt("noumea-cocotiers", "Place des Cocotiers", "rue", "", -22.27109, 166.44166, "La grande place du centre et son kiosque."),
					osmAt("noumea-anse-vata", "Anse Vata", "beach", "", -22.30021, 166.44445, "La plage et les kitesurfs."),
					osmAt("noumea-tjibaou", "Centre culturel Tjibaou", "culture", "", -22.25631, 166.48184, "Les grandes cases de bois de Renzo Piano, la culture kanak."),
					osmAt("noumea-marche", "Marché de Nouméa", "market", "", -22.27566, 166.44091, "Le marché du port : poissons, fruits, bougna."),
					fictional("noumea-bougna", "Bougna de la Vallée-du-Tir", "restaurant", "Centre-ville", -22.2718, 166.455),
					fictional("noumea-snack", "Snack Le Lagon", "restaurant", "Centre-ville", -22.2958, 166.448),
					fictional("noumea-hotel", "Hôtel Les Niaoulis", "hotel", "Centre-ville", -22.2988, 166.444),
				}},
		},
	},
	{
		ID: "papeete", Name: "Papeete", Country: "pf", Zoom: 12, Lat: -17.535, Lng: -149.5696, Island: true,
		Blurb: "La capitale de la Polynésie française, sur Tahiti, où l'on parle français et tahitien : le marché aux couronnes de fleurs, le front de mer, les roulottes du soir.",
		Admin: CityAdmin{Type: "ville", Region: "Îles du Vent (Tahiti)", Source: game.Partial("Capitale : Polynésie française. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Papeete", srcOSM)},
		Communes: []Commune{
			{ID: "papeete-centre", Name: "Centre-ville", Lat: -17.535, Lng: -149.5696, Blurb: "Le centre de Papeete : Marché de Papeete, Place Vaiete (les roulottes), Cathédrale Notre-Dame de Papeete.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Papeete", Mairie: "mairie-papeete-centre", Source: game.Partial("Centre-ville, à Papeete.", "https://fr.wikipedia.org/wiki/Papeete")},
				Places: []Place{
					townHall("papeete-centre", "Hôtel de ville de Papeete", "Ville de Papeete", -17.53737, -149.5659, "https://fr.wikipedia.org/wiki/Papeete"),
					osmAt("papeete-aeroport", "Aéroport de Tahiti-Faa'a", "aeroport", "", -17.55419, -149.61059, "L'aéroport de Papeete."),
					osmAt("papeete-marche", "Marché de Papeete", "market", "", -17.5388, -149.56728, "Le marché couvert : couronnes de tiare, paréos, poisson cru."),
					approxAt("papeete-vaiete", "Place Vaiete (les roulottes)", "rue", "", -17.535, -149.569, "La place du port où les roulottes servent le soir. Position approchée."),
					osmAt("papeete-cathedrale", "Cathédrale Notre-Dame de Papeete", "worship", "", -17.54028, -149.56697, "La cathédrale rouge et blanche."),
					osmAt("papeete-plage", "Plage de la Pointe Vénus", "beach", "", -17.49443, -149.49427, "La plage de sable noir et son phare."),
					fictional("papeete-poisson-cru", "Roulotte Poisson cru au lait de coco", "restaurant", "Centre-ville", -17.534, -149.5706),
					fictional("papeete-monoi", "Monoï et Paréos du Marché", "boutique", "Centre-ville", -17.538, -149.5676),
					fictional("papeete-hotel", "Hôtel Tiare", "hotel", "Centre-ville", -17.5345, -149.5686),
				}},
		},
	},
	{
		ID: "apia", Name: "Apia", Country: "ws", Zoom: 12, Lat: -13.8333, Lng: -171.7667, Island: true,
		Blurb: "La capitale des Samoa, sur l'île d'Upolu : le marché aux puces, la maison de Robert Louis Stevenson à Vailima, les fale ouverts au vent.",
		Admin: CityAdmin{Type: "ville", Region: "Tuamasaga", Source: game.Partial("Capitale : Samoa. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Apia", srcOSM)},
		Communes: []Commune{
			{ID: "apia-centre", Name: "Centre-ville", Lat: -13.8333, Lng: -171.7667, Blurb: "Le centre d'Apia : Marché de Fugalei, Musée Robert Louis Stevenson (Vailima), Cathédrale de l'Immaculée-Conception.",
				Admin: Admin{Type: "quartier", Parent: "Ville d'Apia", Mairie: "mairie-apia-centre", Source: game.Partial("Centre-ville, à Apia.", "https://fr.wikipedia.org/wiki/Apia")},
				Places: []Place{
					{ID: "mairie-apia-centre", Name: "Gouvernement des Samoa (bureaux d'Apia)", Kind: "mairie", Lat: -13.833, Lng: -171.762, Real: true, Approx: true, Operator: "Ville d'Apia", Source: game.Partial("Gouvernement des Samoa (bureaux d'Apia) ; position approchée.", "https://fr.wikipedia.org/wiki/Apia", srcOSM)},
					osmAt("apia-aeroport", "Aéroport de Faleolo", "aeroport", "", -13.83106, -172.00775, "L'aéroport d'Apia."),
					approxAt("apia-marche", "Marché de Fugalei", "market", "", -13.843, -171.771, "Le marché des fruits et du taro. Position approchée."),
					osmAt("apia-vailima", "Musée Robert Louis Stevenson (Vailima)", "culture", "", -13.86661, -171.76553, "La maison de l'écrivain de « L'Île au trésor »."),
					approxAt("apia-cathedrale", "Cathédrale de l'Immaculée-Conception", "worship", "", -13.8314, -171.7628, "La cathédrale blanche au bord de l'eau. Position approchée."),
					fictional("apia-oka", "Oka et palusami d'Apia", "restaurant", "Centre-ville", -13.8323, -171.7657),
					fictional("apia-hotel", "Fale Hôtel du Port", "hotel", "Centre-ville", -13.8343, -171.7647),
				}},
		},
	},
	{
		ID: "nukualofa", Name: "Nuku'alofa", Country: "to", Zoom: 12, Lat: -21.1394, Lng: -175.2018, Island: true,
		Blurb: "La capitale des Tonga, le dernier royaume du Pacifique : le palais royal de bois blanc, le marché de Talamahu, les églises qui chantent le dimanche.",
		Admin: CityAdmin{Type: "ville", Region: "Tongatapu", Source: game.Partial("Capitale : Tonga. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Nuku'alofa", srcOSM)},
		Communes: []Commune{
			{ID: "nukualofa-centre", Name: "Centre-ville", Lat: -21.1394, Lng: -175.2018, Blurb: "Le centre de Nuku'alofa : Palais royal, Marché de Talamahu, Église Centenaire.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Nuku'alofa", Mairie: "mairie-nukualofa-centre", Source: game.Partial("Centre-ville, à Nuku'alofa.", "https://fr.wikipedia.org/wiki/Nuku'alofa")},
				Places: []Place{
					townHall("nukualofa-centre", "Conseil de Nuku'alofa", "Ville de Nuku'alofa", -21.13434, -175.20181, "https://fr.wikipedia.org/wiki/Nuku'alofa"),
					osmAt("nukualofa-aeroport", "Aéroport de Fua'amotu", "aeroport", "", -21.24216, -175.14434, "L'aéroport de Nuku'alofa."),
					osmAt("nukualofa-palais", "Palais royal", "culture", "", -21.13138, -175.20063, "Le palais de bois blanc de 1867."),
					approxAt("nukualofa-talamahu", "Marché de Talamahu", "market", "", -21.136, -175.199, "Le marché des fruits, du tapa et de l'artisanat. Position approchée."),
					osmAt("nukualofa-eglise", "Église Centenaire", "worship", "", -21.13287, -175.20337, "La grande église méthodiste et ses chœurs."),
					fictional("nukualofa-lu", "Lu pulu du Talamahu", "restaurant", "Centre-ville", -21.1384, -175.2008),
					fictional("nukualofa-hotel", "Hôtel Le Royaume", "hotel", "Centre-ville", -21.1404, -175.2008),
				}},
		},
	},
	{
		ID: "port-vila", Name: "Port-Vila", Country: "vu", Zoom: 12, Lat: -17.7333, Lng: 168.3273, Island: true,
		Blurb: "La capitale du Vanuatu sur l'île d'Efate, où l'on parle bichelamar, français et anglais : le marché couvert, le front de mer, les cascades de Mele.",
		Admin: CityAdmin{Type: "ville", Region: "Province de Shéfa", Source: game.Partial("Capitale : Vanuatu. Positions d'après OpenStreetMap (Nominatim, 26 novembre 2026).", "https://fr.wikipedia.org/wiki/Port-Vila", srcOSM)},
		Communes: []Commune{
			{ID: "port-vila-centre", Name: "Centre-ville", Lat: -17.7333, Lng: 168.3273, Blurb: "Le centre de Port-Vila : Marché de Port-Vila, Parlement du Vanuatu, Cascades de Mele.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Port-Vila", Mairie: "mairie-port-vila-centre", Source: game.Partial("Centre-ville, à Port-Vila.", "https://fr.wikipedia.org/wiki/Port-Vila")},
				Places: []Place{
					{ID: "mairie-port-vila-centre", Name: "Municipalité de Port-Vila", Kind: "mairie", Lat: -17.737, Lng: 168.315, Real: true, Approx: true, Operator: "Ville de Port-Vila", Source: game.Partial("Municipalité de Port-Vila ; position approchée.", "https://fr.wikipedia.org/wiki/Port-Vila", srcOSM)},
					osmAt("port-vila-aeroport", "Aéroport de Bauerfield", "aeroport", "", -17.69913, 168.31932, "L'aéroport de Port-Vila."),
					osmAt("port-vila-marche", "Marché de Port-Vila", "market", "", -17.7467, 168.32076, "Le marché ouvert jour et nuit en semaine."),
					osmAt("port-vila-parlement", "Parlement du Vanuatu", "culture", "", -17.74533, 168.3156, "Le Parlement sur la colline."),
					osmAt("port-vila-mele", "Cascades de Mele", "nature", "", -17.67599, 168.25949, "Les bassins en escalier dans la forêt."),
					fictional("port-vila-lap-lap", "Lap-lap du Marché", "restaurant", "Centre-ville", -17.7323, 168.3253),
					fictional("port-vila-hotel", "Hôtel Le Banian", "hotel", "Centre-ville", -17.7343, 168.3263),
				}},
		},
	},
}
