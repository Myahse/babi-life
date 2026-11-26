package world

import "github.com/myahse/babi-life/backend/internal/game"

// Code generated from the lookup of world/afrique.go's cities (Nominatim and Photon, OpenStreetMap's data,
// 26 November 2026); kept by hand since. Each city: its centre and quarters, its mairie, its airport, its
// gare routière, its famous places (real, positioned from OpenStreetMap; « position approximative » where the
// map had none), the game's own places to eat, dance and sleep.

const (
	srcAfriquedakar          = "https://fr.wikipedia.org/wiki/Dakar"
	srcAfriquesaint_louis    = "https://fr.wikipedia.org/wiki/Saint-Louis_(S%C3%A9n%C3%A9gal)"
	srcAfriquebamako         = "https://fr.wikipedia.org/wiki/Bamako"
	srcAfriquesikasso        = "https://fr.wikipedia.org/wiki/Sikasso"
	srcAfriqueaccra          = "https://fr.wikipedia.org/wiki/Accra"
	srcAfriquekumasi         = "https://fr.wikipedia.org/wiki/Kumasi"
	srcAfriqueconakry        = "https://fr.wikipedia.org/wiki/Conakry"
	srcAfriquekankan         = "https://fr.wikipedia.org/wiki/Kankan"
	srcAfriquelome           = "https://fr.wikipedia.org/wiki/Lom%C3%A9"
	srcAfriquekara           = "https://fr.wikipedia.org/wiki/Kara_(Togo)"
	srcAfriquecotonou        = "https://fr.wikipedia.org/wiki/Cotonou"
	srcAfriqueparakou        = "https://fr.wikipedia.org/wiki/Parakou"
	srcAfriquelagos          = "https://fr.wikipedia.org/wiki/Lagos"
	srcAfriqueabuja          = "https://fr.wikipedia.org/wiki/Abuja"
	srcAfriquekano           = "https://fr.wikipedia.org/wiki/Kano"
	srcAfriqueniamey         = "https://fr.wikipedia.org/wiki/Niamey"
	srcAfriqueagadez         = "https://fr.wikipedia.org/wiki/Agadez"
	srcAfriquemonrovia       = "https://fr.wikipedia.org/wiki/Monrovia"
	srcAfriquebuchanan       = "https://fr.wikipedia.org/wiki/Buchanan_(Liberia)"
	srcAfriquefreetown       = "https://fr.wikipedia.org/wiki/Freetown"
	srcAfriquebo             = "https://fr.wikipedia.org/wiki/Bo_(Sierra_Leone)"
	srcAfriquebanjul         = "https://fr.wikipedia.org/wiki/Banjul"
	srcAfriquebissau         = "https://fr.wikipedia.org/wiki/Bissau"
	srcAfriquebubaque        = "https://fr.wikipedia.org/wiki/Bubaque"
	srcAfriquepraia          = "https://fr.wikipedia.org/wiki/Praia"
	srcAfriquemindelo        = "https://fr.wikipedia.org/wiki/Mindelo"
	srcAfriquenouakchott     = "https://fr.wikipedia.org/wiki/Nouakchott"
	srcAfriquenouadhibou     = "https://fr.wikipedia.org/wiki/Nouadhibou"
	srcAfriqueyaounde        = "https://fr.wikipedia.org/wiki/Yaound%C3%A9"
	srcAfriquedouala         = "https://fr.wikipedia.org/wiki/Douala"
	srcAfriquelibreville     = "https://fr.wikipedia.org/wiki/Libreville"
	srcAfriqueport_gentil    = "https://fr.wikipedia.org/wiki/Port-Gentil"
	srcAfriquebrazzaville    = "https://fr.wikipedia.org/wiki/Brazzaville"
	srcAfriquepointe_noire   = "https://fr.wikipedia.org/wiki/Pointe-Noire"
	srcAfriquekinshasa       = "https://fr.wikipedia.org/wiki/Kinshasa"
	srcAfriquelubumbashi     = "https://fr.wikipedia.org/wiki/Lubumbashi"
	srcAfriquendjamena       = "https://fr.wikipedia.org/wiki/N%27Djamena"
	srcAfriquebangui         = "https://fr.wikipedia.org/wiki/Bangui"
	srcAfriquemalabo         = "https://fr.wikipedia.org/wiki/Malabo"
	srcAfriquebata           = "https://fr.wikipedia.org/wiki/Bata_(Guin%C3%A9e_%C3%A9quatoriale)"
	srcAfriquerabat          = "https://fr.wikipedia.org/wiki/Rabat"
	srcAfriquecasablanca     = "https://fr.wikipedia.org/wiki/Casablanca"
	srcAfriquemarrakech      = "https://fr.wikipedia.org/wiki/Marrakech"
	srcAfriquealger          = "https://fr.wikipedia.org/wiki/Alger"
	srcAfriqueoran           = "https://fr.wikipedia.org/wiki/Oran"
	srcAfriquetunis          = "https://fr.wikipedia.org/wiki/Tunis"
	srcAfriquele_caire       = "https://fr.wikipedia.org/wiki/Le_Caire"
	srcAfriquegizeh          = "https://fr.wikipedia.org/wiki/Gizeh"
	srcAfriquealexandrie     = "https://fr.wikipedia.org/wiki/Alexandrie"
	srcAfriquetripoli        = "https://fr.wikipedia.org/wiki/Tripoli"
	srcAfriqueaddis_abeba    = "https://fr.wikipedia.org/wiki/Addis-Abeba"
	srcAfriquenairobi        = "https://fr.wikipedia.org/wiki/Nairobi"
	srcAfriquemombasa        = "https://fr.wikipedia.org/wiki/Mombasa"
	srcAfriquedar_es_salaam  = "https://fr.wikipedia.org/wiki/Dar_es_Salaam"
	srcAfriquezanzibar       = "https://fr.wikipedia.org/wiki/Zanzibar_(ville)"
	srcAfriquekampala        = "https://fr.wikipedia.org/wiki/Kampala"
	srcAfriquekigali         = "https://fr.wikipedia.org/wiki/Kigali"
	srcAfriquekhartoum       = "https://fr.wikipedia.org/wiki/Khartoum"
	srcAfriquemogadiscio     = "https://fr.wikipedia.org/wiki/Mogadiscio"
	srcAfriquedjibouti       = "https://fr.wikipedia.org/wiki/Djibouti_(ville)"
	srcAfriqueantananarivo   = "https://fr.wikipedia.org/wiki/Antananarivo"
	srcAfriquejohannesburg   = "https://fr.wikipedia.org/wiki/Johannesburg"
	srcAfriquele_cap         = "https://fr.wikipedia.org/wiki/Le_Cap"
	srcAfriqueluanda         = "https://fr.wikipedia.org/wiki/Luanda"
	srcAfriquemaputo         = "https://fr.wikipedia.org/wiki/Maputo"
	srcAfriquelusaka         = "https://fr.wikipedia.org/wiki/Lusaka"
	srcAfriqueharare         = "https://fr.wikipedia.org/wiki/Harare"
	srcAfriquevictoria_falls = "https://fr.wikipedia.org/wiki/Victoria_Falls_(ville)"
	srcAfriquewindhoek       = "https://fr.wikipedia.org/wiki/Windhoek"
	srcAfriquegaborone       = "https://fr.wikipedia.org/wiki/Gaborone"
)

// afrAt: a real place of Africa, positioned from OpenStreetMap.
func afrAt(id, name, kind string, lat, lng float64, note string) Place {
	return Place{ID: id, Name: name, Kind: kind, Lat: lat, Lng: lng, Real: true, Source: game.Partial(note, srcOSM)}
}

// afrNear: a real place the map has no point for: placed near its quarter's centre.
func afrNear(id, name, kind string, lat, lng float64, note string) Place {
	return Place{ID: id, Name: name, Kind: kind, Lat: lat, Lng: lng, Real: true, Approx: true, Source: game.Partial(note, srcOSM)}
}

func (p Place) withFaith(f string) Place    { p.Faith = f; return p }
func (p Place) withOperator(o string) Place { p.Operator = o; return p }

var afrique = []City{
	{
		ID: "dakar", Name: "Dakar", Country: "sn", Zoom: 11.6, Lat: 14.69342, Lng: -17.44794,
		Blurb: "La capitale du Sénégal, au bout de la presqu'île du Cap-Vert : le Plateau et le marché Sandaga, la Médina, les Almadies, la Renaissance africaine sur sa colline et l'île de Gorée au large.",
		Admin: CityAdmin{Type: "ville", Region: "Région de Dakar", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquedakar, srcOSM)},
		Communes: []Commune{
			{ID: "dakar-plateau", Name: "Dakar-Plateau", Lat: 14.66732, Lng: -17.43797, Blurb: "Le centre : la place de l'Indépendance, le palais, le marché Sandaga, la gare et le port.",
				Admin: Admin{Type: "commune", Parent: "Ville de Dakar", Mairie: "mairie-dakar-plateau", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquedakar)},
				Places: []Place{
					townHall("dakar-plateau", "Hôtel de ville de Dakar", "Ville de Dakar", 14.67227, -17.43181, srcAfriquedakar),
					afrAt("dakar-independance", "Place de l'Indépendance", "rue", 14.66953, -17.43206, "La grande place du Plateau ; position d'après OpenStreetMap."),
					afrAt("dakar-sandaga", "Marché Sandaga", "market", 14.66992, -17.43772, "Le grand marché du centre-ville ; position d'après OpenStreetMap."),
					afrAt("dakar-palais", "Palais présidentiel de Dakar", "presidence", 14.6644, -17.43261, "Le palais présidentiel, face à la mer ; position d'après OpenStreetMap."),
					afrAt("dakar-cathedrale", "Cathédrale du Souvenir africain", "worship", 14.66545, -17.43761, "La cathédrale de Dakar ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("dakar-gare", "Gare de Dakar", "transport", 14.67646, -17.43368, "La gare de Dakar, d'où part le TER ; position d'après OpenStreetMap."),
					fictional("dakar-dibiterie", "Dibiterie Chez Ndèye", "restaurant", "Plateau", 14.66882, -17.44221),
					fictional("dakar-club", "Le Teranga Night", "club", "Plateau", 14.66142, -17.43685),
					fictional("dakar-hotel", "Hôtel Le Baobab du Plateau", "hotel", "Plateau", 14.66929, -17.4357),
				}},
			{ID: "dakar-medina", Name: "Médina", Lat: 14.68049, Lng: -17.45093, Blurb: "Le quartier populaire : la grande mosquée, la Gueule-Tapée, les tailleurs et les marchés.",
				Admin: Admin{Type: "commune", Parent: "Ville de Dakar", Mairie: "mairie-dakar-medina", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquedakar)},
				Places: []Place{
					townHall("dakar-medina", "Mairie de la Médina", "Commune de Médina", 14.68256, -17.45098, srcAfriquedakar),
					afrAt("dakar-grande-mosquee", "Grande mosquée de Dakar", "worship", 14.67821, -17.44246, "La grande mosquée, allée Pape-Gueye-Fall ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("dakar-ucad", "Université Cheikh-Anta-Diop", "universite", 14.68725, -17.46445, "La grande université de Dakar, à Fann ; position d'après OpenStreetMap.").withOperator("Université publique"),
					afrAt("dakar-soumbedioune", "Marché de Soumbédioune", "market", 14.67513, -17.4561, "Les pirogues, le marché au poisson et l'artisanat ; position d'après OpenStreetMap."),
					fictional("dakar-tailleur", "Atelier de couture Médina Style", "couture", "Médina", 14.68199, -17.45517),
					fictional("dakar-thieb", "Restaurant Le Thiéboudiène d'Or", "restaurant", "Gueule-Tapée", 14.67459, -17.44981),
					fictional("dakar-barbier", "Salon Baye Fall Coiffure", "barbier", "Médina", 14.68246, -17.44867),
				}},
			{ID: "dakar-almadies", Name: "Ouakam et Almadies", Lat: 14.72474, Lng: -17.48507, Blurb: "La pointe ouest : les Mamelles, le monument de la Renaissance africaine, la mosquée de la Divinité, les plages.",
				Admin: Admin{Type: "commune", Parent: "Ville de Dakar", Mairie: "mairie-dakar-almadies", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquedakar)},
				Places: []Place{
					townHall("dakar-almadies", "Mairie de Ouakam", "Commune de Ouakam", 14.72163, -17.49204, srcAfriquedakar),
					afrAt("dakar-renaissance", "Monument de la Renaissance africaine", "culture", 14.72214, -17.49497, "Le grand monument de bronze sur la colline des Mamelles ; position d'après OpenStreetMap."),
					afrAt("dakar-divinite", "Mosquée de la Divinité", "worship", 14.71575, -17.49045, "La mosquée blanche au bord de l'océan, à Ouakam ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("dakar-phare", "Phare des Mamelles", "culture", 14.72378, -17.50185, "Le phare sur la colline des Mamelles ; position d'après OpenStreetMap."),
					afrAt("dakar-ngor", "Plage de Ngor", "beach", 14.75093, -17.51483, "La plage face à l'île de Ngor ; position d'après OpenStreetMap."),
					fictional("dakar-grillades", "Les Grillades de la Corniche", "restaurant", "Almadies", 14.72624, -17.48931),
					fictional("dakar-surf", "Club de surf des Almadies", "sport", "Almadies", 14.71884, -17.48395),
				}},
			{ID: "dakar-goree", Name: "Île de Gorée", Lat: 14.66641, Lng: -17.39828, Blurb: "L'île au large de Dakar : ses maisons à balcons, ses ruelles sans voitures et la Maison des Esclaves, lieu de mémoire.",
				Admin: Admin{Type: "commune", Parent: "Ville de Dakar", Mairie: "mairie-dakar-goree", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquedakar)},
				Places: []Place{
					townHall("dakar-goree", "Mairie de Gorée", "Commune de Gorée", 14.66803, -17.39987, srcAfriquedakar),
					afrAt("dakar-esclaves", "Maison des Esclaves", "culture", 14.66765, -17.39725, "Le lieu de mémoire de la traite, sur l'île de Gorée ; position d'après OpenStreetMap."),
					afrAt("dakar-castel", "Le Castel de Gorée", "nature", 14.66715, -17.39854, "Le plateau rocheux au sud de l'île ; position d'après OpenStreetMap."),
					fictional("dakar-chaloupe", "Embarcadère de la chaloupe", "transport", "Gorée", 14.66792, -17.40252),
				}},
			{ID: "dakar-diass", Name: "Diass", Lat: 14.68688, Lng: -17.45066, Blurb: "La commune de l'aéroport international Blaise-Diagne, sur la route de Mbour.",
				Admin: Admin{Type: "commune", Parent: "Ville de Dakar", Mairie: "mairie-dakar-diass", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquedakar)},
				Places: []Place{
					{ID: "mairie-dakar-diass", Name: "Mairie de Diass", Kind: "mairie", Lat: 14.68808, Lng: -17.45156, Real: true, Approx: true, Operator: "Commune de Diass", Source: game.Partial("La mairie ; position approximative.", srcAfriquedakar)},
					afrAt("dakar-aeroport", "Aéroport international Blaise-Diagne", "aeroport", 14.66499, -17.07347, "Le grand aéroport du Sénégal, à Diass ; position d'après OpenStreetMap."),
					fictional("dakar-hotel-aibd", "Hôtel Le Transit de Diass", "hotel", "Diass", 14.68839, -17.4549),
				}},
			{ID: "dakar-pikine", Name: "Pikine", Lat: 14.75154, Lng: -17.39641, Blurb: "La grande banlieue : les marchés, la gare routière des Baux-Maraîchers, la lutte et le foot de quartier.",
				Admin: Admin{Type: "commune", Parent: "Ville de Dakar", Mairie: "mairie-dakar-pikine", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquedakar)},
				Places: []Place{
					townHall("dakar-pikine", "Mairie de Pikine", "Ville de Pikine", 14.7444, -17.40215, srcAfriquedakar),
					afrAt("dakar-gare-routiere", "Gare routière des Baux-Maraîchers", "transport", 14.74111, -17.40163, "La gare routière de Dakar, d'où partent les cars pour tout le pays ; position d'après OpenStreetMap."),
					afrAt("dakar-arene", "Arène nationale de lutte", "sport", 14.76118, -17.39892, "L'arène de la lutte sénégalaise ; position d'après OpenStreetMap."),
					fictional("dakar-marche", "Marché Zinc de Pikine", "market", "Pikine", 14.75305, -17.40065),
					fictional("dakar-dibiterie-pikine", "Dibiterie Keur Serigne", "restaurant", "Pikine", 14.74565, -17.39529),
				}},
		},
	},
	{
		ID: "saint-louis", Name: "Saint-Louis", Country: "sn", Zoom: 12.2, Lat: 16.02804, Lng: -16.50487,
		Blurb: "L'ancienne capitale, au bord du fleuve Sénégal : l'île et ses maisons coloniales, le pont Faidherbe, Guet-Ndar et ses pirogues peintes, le festival de jazz.",
		Admin: CityAdmin{Type: "ville", Region: "Région de Saint-Louis", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquesaint_louis, srcOSM)},
		Communes: []Commune{
			{ID: "saint-louis-ile", Name: "Île de Saint-Louis", Lat: 16.02859, Lng: -16.50481, Blurb: "L'île classée au patrimoine mondial : le pont Faidherbe, la Gouvernance, la place Faidherbe, les vieilles maisons.",
				Admin: Admin{Type: "commune", Parent: "Ville de Saint-Louis", Mairie: "mairie-saint-louis-ile", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquesaint_louis)},
				Places: []Place{
					{ID: "mairie-saint-louis-ile", Name: "Hôtel de ville de Saint-Louis", Kind: "mairie", Lat: 16.02979, Lng: -16.50571, Real: true, Approx: true, Operator: "Ville de Saint-Louis", Source: game.Partial("La mairie ; position approximative.", srcAfriquesaint_louis)},
					afrAt("saint-louis-pont", "Pont Faidherbe", "rue", 16.02577, -16.50114, "Le pont de fer entre la ville et l'île ; position d'après OpenStreetMap."),
					afrAt("saint-louis-gouvernance", "Gouvernance de Saint-Louis", "culture", 16.02556, -16.50414, "L'ancien palais du gouverneur, sur l'île ; position d'après OpenStreetMap."),
					afrAt("saint-louis-cathedrale", "Cathédrale de Saint-Louis", "worship", 16.0262, -16.5048, "La plus ancienne église d'Afrique de l'Ouest ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("saint-louis-aeroport", "Aéroport de Saint-Louis", "aeroport", 16.05121, -16.46125, "L'aéroport de Saint-Louis ; position d'après OpenStreetMap."),
					afrAt("saint-louis-gare-routiere", "Gare routière de Saint-Louis", "transport", 15.98864, -16.48826, "La gare routière, sur le continent ; position d'après OpenStreetMap."),
					fictional("saint-louis-jazz", "Le Jazz Club de l'île", "club", "Île", 16.03009, -16.50905),
					fictional("saint-louis-resto", "Restaurant La Linguère", "restaurant", "Île", 16.02269, -16.50369),
					fictional("saint-louis-hotel", "Hôtel de la Poste du Fleuve", "hotel", "Île", 16.03056, -16.50254),
				}},
			{ID: "saint-louis-guet-ndar", Name: "Guet-Ndar", Lat: 16.01816, Lng: -16.50923, Blurb: "Le quartier des pêcheurs sur la Langue de Barbarie : les pirogues peintes, le marché au poisson.",
				Admin: Admin{Type: "commune", Parent: "Ville de Saint-Louis", Mairie: "mairie-saint-louis-guet-ndar", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquesaint_louis)},
				Places: []Place{
					{ID: "mairie-saint-louis-guet-ndar", Name: "Mairie annexe de Guet-Ndar", Kind: "mairie", Lat: 16.01936, Lng: -16.51013, Real: true, Approx: true, Operator: "Ville de Saint-Louis", Source: game.Partial("La mairie ; position approximative.", srcAfriquesaint_louis)},
					afrAt("saint-louis-plage", "Plage de Guet-Ndar", "beach", 16.01816, -16.50923, "La plage des pêcheurs de la Langue de Barbarie ; position d'après OpenStreetMap."),
					fictional("saint-louis-poisson", "Marché au poisson de Guet-Ndar", "market", "Guet-Ndar", 16.01967, -16.51347),
					fictional("saint-louis-grillade", "Grillade Chez Fatou", "restaurant", "Guet-Ndar", 16.01227, -16.50811),
				}},
		},
	},
	{
		ID: "bamako", Name: "Bamako", Country: "ml", Zoom: 11.6, Lat: 12.61327, Lng: -7.98499,
		Blurb: "La capitale du Mali, sur les deux rives du Niger : le Grand marché, la grande mosquée, le pont des Martyrs, la musique mandingue et les sotramas vertes.",
		Admin: CityAdmin{Type: "ville", Region: "District de Bamako", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquebamako, srcOSM)},
		Communes: []Commune{
			{ID: "bamako-centre", Name: "Bamako centre (Commune III)", Lat: 12.63817, Lng: -8.00204, Blurb: "Le cœur de la ville : le Grand marché, la grande mosquée, la gare, le musée national.",
				Admin: Admin{Type: "commune", Parent: "Ville de Bamako", Mairie: "mairie-bamako-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebamako)},
				Places: []Place{
					townHall("bamako-centre", "Hôtel de ville de Bamako", "District de Bamako", 12.64727, -8.00148, srcAfriquebamako),
					afrAt("bamako-grand-marche", "Grand marché de Bamako", "market", 12.6438, -7.99692, "Le Grand marché (Marché rose) du centre-ville ; position d'après OpenStreetMap."),
					afrAt("bamako-mosquee", "Grande mosquée de Bamako", "worship", 12.6468, -7.99291, "La grande mosquée du centre-ville ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("bamako-musee", "Musée national du Mali", "culture", 12.65826, -7.9996, "Le musée national, près du parc national ; position d'après OpenStreetMap."),
					afrAt("bamako-gare", "Gare de Bamako", "transport", 12.66194, -7.98955, "La gare ferroviaire de la ligne de Dakar ; position d'après OpenStreetMap."),
					afrAt("bamako-parc", "Parc national du Mali", "nature", 12.63054, -8.02153, "Le grand parc au pied de la colline de Koulouba ; position d'après OpenStreetMap."),
					afrAt("bamako-cathedrale", "Cathédrale de Bamako", "worship", 12.64373, -7.9993, "La cathédrale du Sacré-Cœur ; position d'après OpenStreetMap.").withFaith("catholique"),
					fictional("bamako-maquis", "Restaurant Le Capitaine du Niger", "restaurant", "Centre", 12.63968, -8.00628),
					fictional("bamako-club", "Le Djembé de Bamako", "club", "Centre", 12.63228, -8.00092),
				}},
			{ID: "bamako-aci", Name: "ACI 2000 et Hamdallaye", Lat: 12.63388, Lng: -8.027, Blurb: "Le quartier d'affaires de la rive gauche : les grandes avenues, la tour de l'Afrique, les hôtels.",
				Admin: Admin{Type: "commune", Parent: "Ville de Bamako", Mairie: "mairie-bamako-aci", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebamako)},
				Places: []Place{
					townHall("bamako-aci", "Mairie de la Commune IV", "Commune IV de Bamako", 12.62897, -8.0359, srcAfriquebamako),
					afrAt("bamako-tour-afrique", "Tour de l'Afrique", "culture", 12.58398, -7.94399, "Le monument de l'avenue de l'Unité africaine ; position d'après OpenStreetMap."),
					afrAt("bamako-independance", "Monument de l'Indépendance", "culture", 12.63706, -8.0047, "Le monument de l'Indépendance, boulevard de l'Indépendance ; position d'après OpenStreetMap."),
					fictional("bamako-hotel", "Hôtel Le Djoliba", "hotel", "ACI 2000", 12.63539, -8.03124),
					fictional("bamako-grin", "Le grin de Hamdallaye", "grin", "Hamdallaye", 12.62799, -8.02588),
					fictional("bamako-to", "Restaurant Le Tô de Bamako", "restaurant", "Hamdallaye", 12.63585, -8.02474),
				}},
			{ID: "bamako-senou", Name: "Sénou et Sogoniko (Commune VI)", Lat: 12.60454, Lng: -7.96561, Blurb: "La rive droite : la gare routière de Sogoniko, la route de l'aéroport de Sénou.",
				Admin: Admin{Type: "commune", Parent: "Ville de Bamako", Mairie: "mairie-bamako-senou", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebamako)},
				Places: []Place{
					townHall("bamako-senou", "Mairie de la Commune VI", "Commune VI de Bamako", 12.60103, -7.96419, srcAfriquebamako),
					afrAt("bamako-aeroport", "Aéroport international Modibo-Keïta", "aeroport", 12.53533, -7.94876, "L'aéroport de Bamako-Sénou ; position d'après OpenStreetMap."),
					afrAt("bamako-gare-routiere", "Gare routière de Sogoniko", "transport", 12.60045, -7.96194, "La gare routière des cars pour Ségou, Sikasso, Dakar et Abidjan ; position d'après OpenStreetMap."),
					fictional("bamako-barbier", "Coiffure Bamako Style", "barbier", "Sogoniko", 12.60605, -7.96985),
					fictional("bamako-brochettes", "Grillades du Pont", "restaurant", "Sogoniko", 12.59865, -7.96449),
				}},
		},
	},
	{
		ID: "sikasso", Name: "Sikasso", Country: "ml", Zoom: 12.2, Lat: 11.3176, Lng: -5.6665,
		Blurb: "La deuxième ville du Mali, au sud, la ville verte des fruits et du coton : le tata de Babemba, le Mamelon, le grand marché.",
		Admin: CityAdmin{Type: "ville", Region: "Région de Sikasso", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquesikasso, srcOSM)},
		Communes: []Commune{
			{ID: "sikasso-centre", Name: "Sikasso centre", Lat: 11.3176, Lng: -5.6665, Blurb: "Le Mamelon, les restes du tata, le marché des mangues et des oranges.",
				Admin: Admin{Type: "commune", Parent: "Ville de Sikasso", Mairie: "mairie-sikasso-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquesikasso)},
				Places: []Place{
					townHall("sikasso-centre", "Mairie de Sikasso", "Commune urbaine de Sikasso", 11.31517, -5.66768, srcAfriquesikasso),
					afrAt("sikasso-mamelon", "Le Mamelon (Kéné-Dougou)", "nature", 11.3175, -5.669, "La colline sacrée au cœur de la ville ; position d'après OpenStreetMap."),
					afrAt("sikasso-marche", "Grand marché de Sikasso", "market", 11.315, -5.6645, "Le grand marché aux fruits ; position d'après OpenStreetMap."),
					afrAt("sikasso-aeroport", "Aéroport de Sikasso-Dignangan", "aeroport", 11.3533, -5.7072, "L'aéroport de Sikasso ; position d'après OpenStreetMap."),
					fictional("sikasso-gare-routiere", "Gare routière de Sikasso", "transport", "Centre", 11.31911, -5.67074),
					fictional("sikasso-resto", "Restaurant Le Kénédougou", "restaurant", "Centre", 11.31171, -5.66538),
					fictional("sikasso-hotel", "Hôtel Les Mangues", "hotel", "Centre", 11.31957, -5.66424),
				}},
		},
	},
	{
		ID: "accra", Name: "Accra", Country: "gh", Zoom: 11.6, Lat: 5.55711, Lng: -0.20124,
		Blurb: "La capitale du Ghana : la place de l'Indépendance et sa Black Star Gate, le mausolée de Nkrumah, le marché Makola, Osu et Oxford Street, les chop bars et le highlife.",
		Admin: CityAdmin{Type: "ville", Region: "Greater Accra", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueaccra, srcOSM)},
		Communes: []Commune{
			{ID: "accra-centre", Name: "Accra Central", Lat: 5.54595, Lng: -0.20739, Blurb: "Le vieux centre : la place de l'Indépendance, le mausolée de Kwame Nkrumah, le marché Makola, Jamestown et son phare.",
				Admin: Admin{Type: "quartier", Parent: "Ville d'Accra", Mairie: "mairie-accra-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueaccra)},
				Places: []Place{
					townHall("accra-centre", "Hôtel de ville d'Accra (Accra Metropolitan Assembly)", "Accra Metropolitan Assembly", 5.5508, -0.20353, srcAfriqueaccra),
					afrAt("accra-independance", "Place de l'Indépendance (Black Star Square)", "rue", 5.54742, -0.19256, "La grande place et son arche de l'Étoile noire ; position d'après OpenStreetMap."),
					afrAt("accra-nkrumah", "Mausolée de Kwame Nkrumah", "culture", 5.54474, -0.20299, "Le parc et le mausolée du premier président du Ghana ; position d'après OpenStreetMap."),
					afrAt("accra-makola", "Marché Makola", "market", 5.54807, -0.20693, "Le grand marché du centre d'Accra ; position d'après OpenStreetMap."),
					afrAt("accra-jamestown", "Phare de Jamestown", "culture", 5.53309, -0.21213, "Le phare du vieux quartier des pêcheurs ; position d'après OpenStreetMap."),
					afrAt("accra-arts", "Centre national des arts", "market", 5.54582, -0.20199, "Le marché d'artisanat d'Accra (kente, sculptures) ; position d'après OpenStreetMap."),
					fictional("accra-chopbar", "Chop bar Auntie Akos", "restaurant", "Accra Central", 5.54746, -0.21163),
					fictional("accra-hotel", "Hôtel Black Star Lodge", "hotel", "Accra Central", 5.54006, -0.20627),
				}},
			{ID: "accra-osu", Name: "Osu", Lat: 5.56059, Lng: -0.18244, Blurb: "Le quartier animé : Oxford Street, le château d'Osu, les bars, les boutiques et les vendeurs de kelewele.",
				Admin: Admin{Type: "quartier", Parent: "Ville d'Accra", Mairie: "mairie-accra-osu", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueaccra)},
				Places: []Place{
					townHall("accra-osu", "Bureau municipal d'Osu Klottey", "Assemblée municipale d'Osu Klottey", 5.55374, -0.18887, srcAfriqueaccra),
					afrAt("accra-oxford", "Oxford Street", "rue", 5.56564, -0.18117, "La rue commerçante d'Osu ; position d'après OpenStreetMap."),
					afrAt("accra-chateau", "Château d'Osu", "culture", 5.54742, -0.18327, "Le fort danois devenu château, au bord de la mer ; position d'après OpenStreetMap."),
					afrAt("accra-labadi", "Plage de Labadi", "beach", 5.56394, -0.14061, "La grande plage d'Accra ; position d'après OpenStreetMap."),
					fictional("accra-club", "Club Highlife Osu", "club", "Osu", 5.5621, -0.18668),
					fictional("accra-kelewele", "Kelewele Corner", "restaurant", "Osu", 5.5547, -0.18132),
					fictional("accra-barbier", "Osu Fresh Cuts", "barbier", "Osu", 5.56256, -0.18018),
				}},
			{ID: "accra-airport", Name: "Airport City", Lat: 5.60074, Lng: -0.17523, Blurb: "Le quartier de l'aéroport Kotoka : les tours, les hôtels, la gare des cars de Kaneshie un peu plus loin.",
				Admin: Admin{Type: "quartier", Parent: "Ville d'Accra", Mairie: "mairie-accra-airport", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueaccra)},
				Places: []Place{
					{ID: "mairie-accra-airport", Name: "Bureau de l'Ayawaso West", Kind: "mairie", Lat: 5.60194, Lng: -0.17613, Real: true, Approx: true, Operator: "Assemblée municipale d'Ayawaso West", Source: game.Partial("La mairie ; position approximative.", srcAfriqueaccra)},
					afrAt("accra-aeroport", "Aéroport international de Kotoka", "aeroport", 5.60384, -0.16827, "L'aéroport international d'Accra ; position d'après OpenStreetMap."),
					afrAt("accra-legon", "Université du Ghana (Legon)", "universite", 5.6466, -0.188, "La grande université du Ghana, à Legon ; position d'après OpenStreetMap.").withOperator("Université publique"),
					afrAt("accra-gare-routiere", "Gare routière de Kaneshie", "transport", 5.56658, -0.23446, "La gare des cars pour Kumasi, Lomé et Abidjan, autour du marché de Kaneshie ; position d'après OpenStreetMap."),
					fictional("accra-waakye", "Waakye Junction", "restaurant", "Airport Residential", 5.60225, -0.17947),
				}},
		},
	},
	{
		ID: "kumasi", Name: "Kumasi", Country: "gh", Zoom: 12, Lat: 6.69856, Lng: -1.62331,
		Blurb: "La deuxième ville du Ghana, capitale des Ashanti : le palais de Manhyia de l'Asantehene, le marché de Kejetia, l'un des plus grands d'Afrique de l'Ouest, le kente.",
		Admin: CityAdmin{Type: "ville", Region: "Région Ashanti", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquekumasi, srcOSM)},
		Communes: []Commune{
			{ID: "kumasi-centre", Name: "Kumasi centre", Lat: 6.69429, Lng: -1.62333, Blurb: "Adum et Kejetia : le grand marché, le centre culturel, le fort, le palais de Manhyia au nord.",
				Admin: Admin{Type: "quartier", Parent: "Ville de Kumasi", Mairie: "mairie-kumasi-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquekumasi)},
				Places: []Place{
					townHall("kumasi-centre", "Hôtel de ville de Kumasi", "Kumasi Metropolitan Assembly", 6.68653, -1.62304, srcAfriquekumasi),
					afrAt("kumasi-kejetia", "Marché de Kejetia", "market", 6.69583, -1.62105, "L'immense marché de Kumasi ; position d'après OpenStreetMap."),
					afrAt("kumasi-manhyia", "Palais de Manhyia", "culture", 6.70416, -1.61594, "Le palais et musée de l'Asantehene ; position d'après OpenStreetMap."),
					afrAt("kumasi-culturel", "Centre culturel de Kumasi", "culture", 6.70164, -1.62944, "Le centre culturel et ses ateliers de kente ; position d'après OpenStreetMap."),
					afrAt("kumasi-aeroport", "Aéroport international de Kumasi", "aeroport", 6.71508, -1.59033, "L'aéroport de Kumasi ; position d'après OpenStreetMap."),
					afrAt("kumasi-knust", "Université KNUST", "universite", 6.6745, -1.5716, "L'université des sciences et techniques Kwame-Nkrumah ; position d'après OpenStreetMap.").withOperator("Université publique"),
					fictional("kumasi-gare-routiere", "Gare routière de Kejetia", "transport", "Kejetia", 6.6958, -1.62757),
					fictional("kumasi-chopbar", "Chop bar Ashanti Fufu", "restaurant", "Adum", 6.6884, -1.62221),
					fictional("kumasi-club", "Club Golden Stool", "club", "Adum", 6.69626, -1.61987),
				}},
		},
	},
	{
		ID: "conakry", Name: "Conakry", Country: "gn", Zoom: 11.6, Lat: 9.51706, Lng: -13.69984,
		Blurb: "La capitale de la Guinée, sur sa presqu'île : Kaloum et ses ministères, le palais du Peuple, le marché Niger, la grande mosquée Fayçal, les îles de Loos au large.",
		Admin: CityAdmin{Type: "ville", Region: "Conakry", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueconakry, srcOSM)},
		Communes: []Commune{
			{ID: "conakry-kaloum", Name: "Kaloum", Lat: 9.51496, Lng: -13.70844, Blurb: "La pointe de la presqu'île : le centre administratif, le port, la cathédrale, le palais du Peuple.",
				Admin: Admin{Type: "commune", Parent: "Ville de Conakry", Mairie: "mairie-conakry-kaloum", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueconakry)},
				Places: []Place{
					townHall("conakry-kaloum", "Mairie de Kaloum", "Commune de Kaloum", 9.47436, -13.74878, srcAfriqueconakry),
					afrAt("conakry-palais-peuple", "Palais du Peuple", "culture", 9.51988, -13.69309, "Le palais du Peuple, salle des grands événements ; position d'après OpenStreetMap."),
					afrAt("conakry-cathedrale", "Cathédrale Sainte-Marie de Conakry", "worship", 9.51017, -13.71545, "La cathédrale de Conakry ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("conakry-niger", "Marché Niger", "market", 9.51144, -13.70613, "Le marché du centre ; position d'après OpenStreetMap."),
					afrAt("conakry-musee", "Musée national de Sandervalia", "culture", 9.50462, -13.70911, "Le musée national de Guinée ; position d'après OpenStreetMap."),
					fictional("conakry-resto", "Restaurant Le Fouta", "restaurant", "Kaloum", 9.51647, -13.71268),
					fictional("conakry-club", "Le Kaloum Night", "club", "Kaloum", 9.50907, -13.70732),
				}},
			{ID: "conakry-dixinn", Name: "Dixinn", Lat: 9.54688, Lng: -13.67331, Blurb: "La grande mosquée Fayçal, l'université Gamal-Abdel-Nasser, le stade du 28-Septembre.",
				Admin: Admin{Type: "commune", Parent: "Ville de Conakry", Mairie: "mairie-conakry-dixinn", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueconakry)},
				Places: []Place{
					townHall("conakry-dixinn", "Mairie de Dixinn", "Commune de Dixinn", 9.54703, -13.67253, srcAfriqueconakry),
					afrAt("conakry-mosquee", "Grande mosquée Fayçal", "worship", 9.53339, -13.6817, "La grande mosquée de Conakry ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("conakry-universite", "Université Gamal-Abdel-Nasser", "universite", 9.54441, -13.67662, "La grande université de Conakry ; position d'après OpenStreetMap.").withOperator("Université publique"),
					afrAt("conakry-stade", "Stade du 28-Septembre", "sport", 9.54608, -13.67397, "Le stade national ; position d'après OpenStreetMap."),
					fictional("conakry-grin", "Le grin de Dixinn", "grin", "Dixinn", 9.54838, -13.67755),
					fictional("conakry-barbier", "Coiffure Syli", "barbier", "Dixinn", 9.54098, -13.67219),
				}},
			{ID: "conakry-matoto", Name: "Matoto", Lat: 9.61806, Lng: -13.58891, Blurb: "La grande banlieue de l'aéroport de Gbessia et de la gare routière.",
				Admin: Admin{Type: "commune", Parent: "Ville de Conakry", Mairie: "mairie-conakry-matoto", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueconakry)},
				Places: []Place{
					townHall("conakry-matoto", "Mairie de Matoto", "Commune de Matoto", 9.60218, -13.60166, srcAfriqueconakry),
					afrAt("conakry-aeroport", "Aéroport international de Conakry-Gbessia", "aeroport", 9.67571, -13.54561, "L'aéroport de Conakry ; position d'après OpenStreetMap."),
					fictional("conakry-gare-routiere", "Gare routière de Matoto", "transport", "Matoto", 9.61957, -13.59315),
					fictional("conakry-marche", "Marché de Matoto", "market", "Matoto", 9.61217, -13.58779),
					fictional("conakry-resto-matoto", "Restaurant Le Riz Sauce Feuille", "restaurant", "Matoto", 9.62003, -13.58665),
				}},
		},
	},
	{
		ID: "kankan", Name: "Kankan", Country: "gn", Zoom: 12.2, Lat: 10.3854, Lng: -9.3057,
		Blurb: "La grande ville de Haute-Guinée, au bord du Milo : la grande mosquée, l'université Julius-Nyerere, le marché, la culture malinké.",
		Admin: CityAdmin{Type: "ville", Region: "Région de Kankan", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquekankan, srcOSM)},
		Communes: []Commune{
			{ID: "kankan-centre", Name: "Kankan centre", Lat: 10.3854, Lng: -9.3057, Blurb: "Le centre, le marché, la grande mosquée et les berges du Milo.",
				Admin: Admin{Type: "commune", Parent: "Ville de Kankan", Mairie: "mairie-kankan-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquekankan)},
				Places: []Place{
					townHall("kankan-centre", "Mairie de Kankan", "Commune urbaine de Kankan", 10.37322, -9.3075, srcAfriquekankan),
					afrAt("kankan-mosquee", "Grande mosquée de Kankan", "worship", 10.3835, -9.305, "La grande mosquée ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("kankan-universite", "Université Julius-Nyerere", "universite", 10.392, -9.293, "L'université de Kankan ; position d'après OpenStreetMap.").withOperator("Université publique"),
					afrAt("kankan-aeroport", "Aéroport de Kankan-Diankana", "aeroport", 10.44756, -9.23591, "L'aéroport de Kankan ; position d'après OpenStreetMap."),
					fictional("kankan-marche", "Grand marché de Kankan", "market", "Centre", 10.38691, -9.30994),
					fictional("kankan-gare-routiere", "Gare routière de Kankan", "transport", "Centre", 10.37951, -9.30458),
					fictional("kankan-resto", "Restaurant Le Milo", "restaurant", "Centre", 10.38737, -9.30344),
				}},
		},
	},
	{
		ID: "lome", Name: "Lomé", Country: "tg", Zoom: 11.8, Lat: 6.13042, Lng: 1.21583,
		Blurb: "La capitale du Togo, sur la côte à un pas du Ghana : le Grand marché et ses Nana Benz, le monument de l'Indépendance, la plage, le marché d'Akodésséwa.",
		Admin: CityAdmin{Type: "ville", Region: "Région maritime", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquelome, srcOSM)},
		Communes: []Commune{
			{ID: "lome-centre", Name: "Lomé centre", Lat: 6.13042, Lng: 1.21583, Blurb: "Le Grand marché d'Assigamé, la cathédrale, le palais de Lomé, le bord de mer.",
				Admin: Admin{Type: "commune", Parent: "Ville de Lomé", Mairie: "mairie-lome-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquelome)},
				Places: []Place{
					townHall("lome-centre", "Hôtel de ville de Lomé", "Commune de Lomé", 6.1569, 1.21664, srcAfriquelome),
					afrAt("lome-grand-marche", "Grand marché de Lomé (Assigamé)", "market", 6.12604, 1.22731, "Le Grand marché, le royaume des Nana Benz et du pagne ; position d'après OpenStreetMap."),
					afrAt("lome-cathedrale", "Cathédrale du Sacré-Cœur de Lomé", "worship", 6.12496, 1.22638, "La cathédrale de Lomé, en face du Grand marché ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("lome-palais", "Palais de Lomé", "culture", 6.12038, 1.21225, "L'ancien palais des gouverneurs, devenu centre d'art et parc ; position d'après OpenStreetMap."),
					afrAt("lome-independance", "Monument de l'Indépendance", "culture", 6.12996, 1.21601, "Le monument de la place de l'Indépendance ; position d'après OpenStreetMap."),
					afrAt("lome-plage", "Plage de Lomé", "beach", 6.11504, 1.20469, "La longue plage le long du boulevard ; position d'après OpenStreetMap."),
					fictional("lome-maquis", "Maquis Le Fufu d'Adjo", "maquis", "Centre", 6.13193, 1.21159),
					fictional("lome-club", "Le Lomé Beach Club", "club", "Bord de mer", 6.12452, 1.21695),
					fictional("lome-hotel", "Hôtel La Lagune de Bè", "hotel", "Bè", 6.13239, 1.21809),
				}},
			{ID: "lome-be", Name: "Bè et Akodésséwa", Lat: 6.14266, Lng: 1.24851, Blurb: "Les vieux quartiers de l'est : le marché d'Akodésséwa et ses remèdes traditionnels, le port.",
				Admin: Admin{Type: "commune", Parent: "Ville de Lomé", Mairie: "mairie-lome-be", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquelome)},
				Places: []Place{
					townHall("lome-be", "Mairie de Golfe 1", "Commune Golfe 1", 6.15369, 1.26556, srcAfriquelome),
					afrAt("lome-akodessewa", "Marché d'Akodésséwa", "market", 6.15364, 1.26734, "Le marché des remèdes et objets du culte vodou ; position d'après OpenStreetMap."),
					afrAt("lome-port", "Port autonome de Lomé", "transport", 6.14398, 1.28486, "Le grand port en eau profonde ; position d'après OpenStreetMap."),
					fictional("lome-akoume", "Maquis L'Akoumé de Bè", "maquis", "Bè", 6.14417, 1.24427),
					fictional("lome-barbier", "Coiffure Bè Style", "barbier", "Bè", 6.13677, 1.24963),
				}},
			{ID: "lome-tokoin", Name: "Tokoin", Lat: 6.1702, Lng: 1.25601, Blurb: "Le nord de la ville : l'université, l'aéroport, la gare routière d'Agbalépédogan.",
				Admin: Admin{Type: "commune", Parent: "Ville de Lomé", Mairie: "mairie-lome-tokoin", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquelome)},
				Places: []Place{
					townHall("lome-tokoin", "Mairie de Golfe 3", "Commune Golfe 3", 6.1569, 1.21664, srcAfriquelome),
					afrAt("lome-aeroport", "Aéroport international Gnassingbé-Eyadéma", "aeroport", 6.17097, 1.25251, "L'aéroport international de Lomé ; position d'après OpenStreetMap."),
					afrAt("lome-universite", "Université de Lomé", "universite", 6.17715, 1.21193, "La grande université du Togo ; position d'après OpenStreetMap.").withOperator("Université publique"),
					afrAt("lome-gare-routiere", "Gare routière d'Agbalépédogan", "transport", 6.1919, 1.1996, "La gare des cars du Nord, près du marché d'Agbalépédogan ; position d'après OpenStreetMap."),
					fictional("lome-grin", "Le grin des étudiants de Tokoin", "grin", "Tokoin", 6.17171, 1.25177),
				}},
		},
	},
	{
		ID: "kara", Name: "Kara", Country: "tg", Zoom: 12.2, Lat: 9.5511, Lng: 1.1861,
		Blurb: "La grande ville du Nord togolais, au pied des monts Kabyè : les fêtes des Evala (la lutte) en juillet, le marché, la rivière Kara.",
		Admin: CityAdmin{Type: "ville", Region: "Région de la Kara", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquekara, srcOSM)},
		Communes: []Commune{
			{ID: "kara-centre", Name: "Kara centre", Lat: 9.5511, Lng: 1.1861, Blurb: "Le centre, le grand marché, l'université de Kara.",
				Admin: Admin{Type: "commune", Parent: "Ville de Kara", Mairie: "mairie-kara-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquekara)},
				Places: []Place{
					townHall("kara-centre", "Mairie de Kara", "Commune de Kozah 1", 9.54732, 1.18986, srcAfriquekara),
					afrAt("kara-universite", "Université de Kara", "universite", 9.57, 1.19, "L'université de Kara ; position d'après OpenStreetMap.").withOperator("Université publique"),
					afrAt("kara-marche", "Grand marché de Kara", "market", 9.551, 1.186, "Le grand marché de Kara ; position d'après OpenStreetMap."),
					afrAt("kara-aeroport", "Aéroport international de Niamtougou", "aeroport", 9.7673, 1.0912, "L'aéroport du nord du Togo, à Niamtougou, sur la route de Kara ; position d'après OpenStreetMap."),
					fictional("kara-gare-routiere", "Gare routière de Kara", "transport", "Centre", 9.55261, 1.18186),
					fictional("kara-maquis", "Maquis Le Kabyè", "maquis", "Centre", 9.54521, 1.18722),
					fictional("kara-hotel", "Hôtel Les Monts Kabyè", "hotel", "Centre", 9.55307, 1.18836),
				}},
		},
	},
	{
		ID: "cotonou", Name: "Cotonou", Country: "bj", Zoom: 11.4, Lat: 6.3677, Lng: 2.42525,
		Blurb: "La grande ville du Bénin, entre la lagune et l'océan : le marché Dantokpa, les zémidjans en jaune, la place de l'Étoile rouge ; à côté, Porto-Novo la capitale et Ouidah et sa Porte du Non-Retour.",
		Admin: CityAdmin{Type: "ville", Region: "Littoral", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquecotonou, srcOSM)},
		Communes: []Commune{
			{ID: "cotonou-centre", Name: "Cotonou centre", Lat: 6.3677, Lng: 2.42525, Blurb: "Le marché Dantokpa, la cathédrale, l'Étoile rouge, les quartiers de Ganhi et d'Akpakpa.",
				Admin: Admin{Type: "commune", Parent: "Ville de Cotonou", Mairie: "mairie-cotonou-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquecotonou)},
				Places: []Place{
					townHall("cotonou-centre", "Hôtel de ville de Cotonou", "Ville de Cotonou", 6.36721, 2.45957, srcAfriquecotonou),
					afrAt("cotonou-dantokpa", "Marché Dantokpa", "market", 6.37271, 2.43351, "L'immense marché au bord de la lagune ; position d'après OpenStreetMap."),
					afrAt("cotonou-etoile-rouge", "Place de l'Étoile rouge", "rue", 6.37146, 2.40979, "Le grand rond-point du centre ; position d'après OpenStreetMap."),
					afrAt("cotonou-cathedrale", "Cathédrale Notre-Dame de Cotonou", "worship", 6.36046, 2.41781, "La cathédrale aux rayures rouges et blanches ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("cotonou-amazone", "Monument de l'Amazone", "culture", 6.34895, 2.40755, "La grande statue de l'Amazone du Dahomey ; position d'après OpenStreetMap."),
					afrAt("cotonou-gare-routiere", "Gare routière de Jonquet", "transport", 6.35841, 2.4315, "La gare des cars pour Lomé, Accra, Lagos et le Nord ; position d'après OpenStreetMap."),
					fictional("cotonou-maquis", "Maquis La Pâte de Mama Lolo", "maquis", "Ganhi", 6.3692, 2.42101),
					fictional("cotonou-club", "Le Zémidjan Club", "club", "Haie Vive", 6.3618, 2.42637),
				}},
			{ID: "cotonou-cadjehoun", Name: "Cadjèhoun et Fidjrossè", Lat: 6.35848, Lng: 2.39512, Blurb: "L'ouest de la ville : l'aéroport, la Haie Vive et ses restaurants, la plage de Fidjrossè.",
				Admin: Admin{Type: "arrondissement", Parent: "Ville de Cotonou", Mairie: "mairie-cotonou-cadjehoun", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquecotonou)},
				Places: []Place{
					{ID: "mairie-cotonou-cadjehoun", Name: "Mairie du 12e arrondissement", Kind: "mairie", Lat: 6.35968, Lng: 2.39422, Real: true, Approx: true, Operator: "Ville de Cotonou", Source: game.Partial("La mairie ; position approximative.", srcAfriquecotonou)},
					afrAt("cotonou-aeroport", "Aéroport international Cardinal-Bernardin-Gantin", "aeroport", 6.35775, 2.38591, "L'aéroport de Cotonou, à Cadjèhoun ; position d'après OpenStreetMap."),
					afrAt("cotonou-fidjrosse", "Plage de Fidjrossè", "beach", 6.355, 2.37, "La plage populaire de l'ouest de Cotonou ; position d'après OpenStreetMap."),
					fictional("cotonou-resto", "Restaurant La Haie Vive", "restaurant", "Haie Vive", 6.35999, 2.39088),
					fictional("cotonou-hotel", "Hôtel Le Littoral", "hotel", "Cadjèhoun", 6.35259, 2.39624),
				}},
			{ID: "cotonou-porto-novo", Name: "Porto-Novo", Lat: 6.49907, Lng: 2.62534, Blurb: "La capitale du Bénin, au bord de la lagune : le palais royal du roi Toffa, la grande mosquée de style brésilien, l'Assemblée nationale.",
				Admin: Admin{Type: "ville", Parent: "Ville de Cotonou", Mairie: "mairie-cotonou-porto-novo", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquecotonou)},
				Places: []Place{
					{ID: "mairie-cotonou-porto-novo", Name: "Hôtel de ville de Porto-Novo", Kind: "mairie", Lat: 6.50027, Lng: 2.62444, Real: true, Approx: true, Operator: "Ville de Porto-Novo", Source: game.Partial("La mairie ; position approximative.", srcAfriquecotonou)},
					afrAt("cotonou-mosquee", "Grande mosquée de Porto-Novo", "worship", 6.47174, 2.62811, "La grande mosquée aux façades de style brésilien ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("cotonou-palais", "Palais royal Honmè", "culture", 6.46933, 2.62516, "Le palais du roi Toffa, devenu musée ; position d'après OpenStreetMap."),
					afrAt("cotonou-assemblee", "Assemblée nationale du Bénin", "assemblee", 6.47693, 2.61473, "L'Assemblée nationale, dans la capitale ; position d'après OpenStreetMap."),
					fictional("cotonou-maquis-porto", "Maquis La Lagune de Porto", "maquis", "Centre", 6.50058, 2.6211),
				}},
			{ID: "cotonou-ouidah", Name: "Ouidah", Lat: 6.36661, Lng: 2.08536, Blurb: "La ville de la mémoire : la Route des Esclaves jusqu'à la Porte du Non-Retour, le temple des Pythons, la basilique, la fête du vodun en janvier.",
				Admin: Admin{Type: "ville", Parent: "Ville de Cotonou", Mairie: "mairie-cotonou-ouidah", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquecotonou)},
				Places: []Place{
					townHall("cotonou-ouidah", "Mairie de Ouidah", "Commune de Ouidah", 6.35627, 2.07449, srcAfriquecotonou),
					afrAt("cotonou-non-retour", "Porte du Non-Retour", "culture", 6.32425, 2.08958, "Le monument de la mémoire de la traite, sur la plage de Ouidah ; position d'après OpenStreetMap."),
					afrAt("cotonou-pythons", "Temple des Pythons", "culture", 6.35997, 2.08504, "Le temple vodun en face de la basilique ; position d'après OpenStreetMap."),
					afrAt("cotonou-basilique", "Basilique de l'Immaculée-Conception de Ouidah", "worship", 6.3606, 2.08606, "La basilique de Ouidah ; position d'après OpenStreetMap.").withFaith("catholique"),
					fictional("cotonou-resto-ouidah", "Restaurant La Route des Pêches", "restaurant", "Ouidah", 6.36812, 2.08112),
				}},
		},
	},
	{
		ID: "parakou", Name: "Parakou", Country: "bj", Zoom: 12.2, Lat: 9.34002, Lng: 2.62783,
		Blurb: "La grande ville du Nord béninois, carrefour des routes vers le Niger : le grand marché Arzèkè, le palais du roi des Baatonu, la gare du chemin de fer.",
		Admin: CityAdmin{Type: "ville", Region: "Borgou", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueparakou, srcOSM)},
		Communes: []Commune{
			{ID: "parakou-centre", Name: "Parakou centre", Lat: 9.34002, Lng: 2.62783, Blurb: "Le marché Arzèkè, la gare, le palais royal.",
				Admin: Admin{Type: "commune", Parent: "Ville de Parakou", Mairie: "mairie-parakou-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueparakou)},
				Places: []Place{
					townHall("parakou-centre", "Mairie de Parakou", "Commune de Parakou", 9.33901, 2.62918, srcAfriqueparakou),
					afrAt("parakou-marche", "Marché Arzèkè", "market", 9.33717, 2.62874, "Le grand marché de Parakou ; position d'après OpenStreetMap."),
					afrAt("parakou-aeroport", "Aéroport de Parakou", "aeroport", 9.3577, 2.6097, "L'aéroport de Parakou ; position d'après OpenStreetMap."),
					afrAt("parakou-universite", "Université de Parakou", "universite", 9.33707, 2.64522, "L'université du Nord ; position d'après OpenStreetMap.").withOperator("Université publique"),
					fictional("parakou-gare-routiere", "Gare routière de Parakou", "transport", "Centre", 9.34152, 2.62359),
					fictional("parakou-maquis", "Maquis Le Wagashi", "maquis", "Centre", 9.33412, 2.62894),
				}},
		},
	},
	{
		ID: "lagos", Name: "Lagos", Country: "ng", Zoom: 11.0, Lat: 6.45506, Lng: 3.39418,
		Blurb: "La plus grande ville d'Afrique de l'Ouest : Lagos Island et ses marchés, Victoria Island et Lekki, Ikeja et l'aéroport, les danfos jaunes, l'afrobeat et Nollywood.",
		Admin: CityAdmin{Type: "ville", Region: "État de Lagos", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquelagos, srcOSM)},
		Communes: []Commune{
			{ID: "lagos-island", Name: "Lagos Island", Lat: 6.45402, Lng: 3.41624, Blurb: "L'île historique : le marché Balogun, Tinubu Square, Freedom Park, la cathédrale du Christ.",
				Admin: Admin{Type: "zone", Parent: "Ville de Lagos", Mairie: "mairie-lagos-island", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquelagos)},
				Places: []Place{
					townHall("lagos-island", "Hôtel de ville de Lagos", "État de Lagos", 6.45065, 3.39714, srcAfriquelagos),
					afrAt("lagos-balogun", "Marché Balogun", "market", 6.459, 3.388, "L'immense marché des tissus de Lagos Island ; position d'après OpenStreetMap."),
					afrAt("lagos-freedom-park", "Freedom Park", "culture", 6.44882, 3.39653, "L'ancienne prison coloniale devenue parc de la mémoire et des concerts ; position d'après OpenStreetMap."),
					afrAt("lagos-tinubu", "Tinubu Square", "rue", 6.45384, 3.38944, "La place historique de Lagos Island ; position d'après OpenStreetMap."),
					afrAt("lagos-cathedrale", "Cathédrale du Christ de Lagos", "worship", 6.45089, 3.39021, "La cathédrale anglicane de Lagos Island ; position d'après OpenStreetMap.").withFaith("protestant"),
					afrAt("lagos-mosquee", "Mosquée centrale de Lagos", "worship", 6.45738, 3.38814, "La grande mosquée de Lagos Island ; position d'après OpenStreetMap.").withFaith("musulman"),
					fictional("lagos-buka", "Buka Mama Put", "restaurant", "Lagos Island", 6.45552, 3.412),
				}},
			{ID: "lagos-vi", Name: "Victoria Island et Lekki", Lat: 6.43003, Lng: 3.42599, Blurb: "Les tours, les plages, les galeries d'art et les clubs ; le pont de Lekki.",
				Admin: Admin{Type: "zone", Parent: "Ville de Lagos", Mairie: "mairie-lagos-vi", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquelagos)},
				Places: []Place{
					{ID: "mairie-lagos-vi", Name: "Bureau de la LCDA d'Eti-Osa", Kind: "mairie", Lat: 6.43123, Lng: 3.42509, Real: true, Approx: true, Operator: "Eti-Osa", Source: game.Partial("La mairie ; position approximative.", srcAfriquelagos)},
					afrAt("lagos-lekki-bridge", "Pont de Lekki-Ikoyi", "rue", 6.44843, 3.45954, "Le pont à haubans entre Ikoyi et Lekki ; position d'après OpenStreetMap."),
					afrAt("lagos-nike", "Galerie d'art Nike", "culture", 6.43152, 3.48189, "La grande galerie d'art de Lekki ; position d'après OpenStreetMap."),
					afrAt("lagos-conservation", "Centre de conservation de Lekki", "nature", 6.43621, 3.53558, "La forêt protégée et sa passerelle dans les arbres ; position d'après OpenStreetMap."),
					afrAt("lagos-plage", "Plage d'Elegushi", "beach", 6.42539, 3.48037, "La plage de Lekki ; position d'après OpenStreetMap."),
					fictional("lagos-club", "Club Afrobeat VI", "club", "Victoria Island", 6.43154, 3.42175),
					fictional("lagos-suya", "Suya Spot Lekki", "restaurant", "Lekki", 6.42413, 3.42711),
					fictional("lagos-hotel", "Hôtel Lagoon Heights", "hotel", "Victoria Island", 6.432, 3.42825),
				}},
			{ID: "lagos-ikeja", Name: "Ikeja", Lat: 6.59747, Lng: 3.34328, Blurb: "La capitale de l'État : l'aéroport Murtala-Muhammed, Computer Village, le New Afrika Shrine.",
				Admin: Admin{Type: "zone", Parent: "Ville de Lagos", Mairie: "mairie-lagos-ikeja", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquelagos)},
				Places: []Place{
					townHall("lagos-ikeja", "Secrétariat de l'État de Lagos (Alausa)", "État de Lagos", 6.61562, 3.36074, srcAfriquelagos),
					afrAt("lagos-aeroport", "Aéroport international Murtala-Muhammed", "aeroport", 6.58482, 3.33292, "Le grand aéroport de Lagos ; position d'après OpenStreetMap."),
					afrAt("lagos-shrine", "New Afrika Shrine", "club", 6.62284, 3.35689, "La salle de l'afrobeat, héritière du Shrine de Fela ; position d'après OpenStreetMap."),
					afrAt("lagos-computer-village", "Computer Village", "market", 6.59425, 3.34022, "Le grand marché des téléphones et de l'informatique ; position d'après OpenStreetMap."),
					afrAt("lagos-gare-routiere", "Gare routière d'Ojota", "transport", 6.51114, 3.37058, "La gare des cars vers tout le Nigeria et l'Afrique de l'Ouest ; position d'après OpenStreetMap."),
					fictional("lagos-amala", "Amala Spot Ikeja", "restaurant", "Ikeja", 6.59898, 3.33904),
					fictional("lagos-barbier", "Ikeja Sharp Cuts", "barbier", "Ikeja", 6.59158, 3.3444),
				}},
		},
	},
	{
		ID: "abuja", Name: "Abuja", Country: "ng", Zoom: 11.6, Lat: 9.06433, Lng: 7.4893,
		Blurb: "La capitale fédérale du Nigeria, bâtie au centre du pays : Aso Rock, la mosquée nationale et le centre œcuménique face à face, Millennium Park.",
		Admin: CityAdmin{Type: "ville", Region: "Territoire de la capitale fédérale", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueabuja, srcOSM)},
		Communes: []Commune{
			{ID: "abuja-centre", Name: "Central Business District", Lat: 9.05371, Lng: 7.48835, Blurb: "Le centre : la mosquée nationale, le centre œcuménique, les ministères, Millennium Park, Aso Rock en fond.",
				Admin: Admin{Type: "district", Parent: "Ville d'Abuja", Mairie: "mairie-abuja-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueabuja)},
				Places: []Place{
					townHall("abuja-centre", "Secrétariat du Territoire de la capitale fédérale", "Territoire de la capitale fédérale", 9.04788, 7.50176, srcAfriqueabuja),
					afrAt("abuja-mosquee", "Mosquée nationale d'Abuja", "worship", 9.0602, 7.48964, "La mosquée nationale aux minarets dorés ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("abuja-ecumenique", "Centre œcuménique national", "worship", 9.05164, 7.49512, "La grande église nationale ; position d'après OpenStreetMap.").withFaith("protestant"),
					afrAt("abuja-millennium", "Millennium Park", "nature", 9.07156, 7.49947, "Le grand parc de la capitale ; position d'après OpenStreetMap."),
					afrAt("abuja-aso-rock", "Aso Rock", "nature", 9.08039, 7.53604, "Le grand rocher qui domine la capitale ; position d'après OpenStreetMap."),
					afrAt("abuja-aeroport", "Aéroport international Nnamdi-Azikiwe", "aeroport", 9.02071, 7.26777, "L'aéroport d'Abuja ; position d'après OpenStreetMap."),
					afrAt("abuja-gare-routiere", "Gare routière de Jabi", "transport", 9.06383, 7.43269, "La gare routière d'Abuja ; position d'après OpenStreetMap."),
					fictional("abuja-suya", "Suya du Wuse Market", "restaurant", "Wuse", 9.05521, 7.48411),
					fictional("abuja-club", "Club Capitale", "club", "Wuse 2", 9.04781, 7.48947),
				}},
		},
	},
	{
		ID: "kano", Name: "Kano", Country: "ng", Zoom: 12, Lat: 11.994, Lng: 8.52197,
		Blurb: "La grande ville haoussa du Nord : la vieille ville et ses murailles, le palais de l'émir, le marché de Kurmi et les fosses de teinture de Kofar Mata.",
		Admin: CityAdmin{Type: "ville", Region: "État de Kano", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquekano, srcOSM)},
		Communes: []Commune{
			{ID: "kano-centre", Name: "Vieille ville de Kano", Lat: 11.994, Lng: 8.52197, Blurb: "La vieille ville : le palais de l'émir, la grande mosquée, le marché de Kurmi, les teintureries.",
				Admin: Admin{Type: "commune", Parent: "Ville de Kano", Mairie: "mairie-kano-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquekano)},
				Places: []Place{
					townHall("kano-centre", "Secrétariat du gouvernement de Kano", "État de Kano", 11.9801, 8.55286, srcAfriquekano),
					afrAt("kano-kurmi", "Marché de Kurmi", "market", 11.995, 8.513, "Le vieux marché de Kano, depuis le XVe siècle ; position d'après OpenStreetMap."),
					afrAt("kano-palais", "Palais de l'émir de Kano", "culture", 11.98338, 8.52296, "Le palais de l'émir (Gidan Rumfa) ; position d'après OpenStreetMap."),
					afrAt("kano-teinture", "Fosses de teinture de Kofar Mata", "culture", 12.0005, 8.506, "Les fosses de teinture à l'indigo ; position d'après OpenStreetMap."),
					afrAt("kano-aeroport", "Aéroport international Mallam-Aminu-Kano", "aeroport", 12.04685, 8.52132, "L'aéroport de Kano ; position d'après OpenStreetMap."),
					fictional("kano-gare-routiere", "Gare routière de Kano", "transport", "Centre", 11.99551, 8.51773),
					fictional("kano-resto", "Restaurant Le Tuwo de Kano", "restaurant", "Centre", 11.9881, 8.52309),
				}},
		},
	},
	{
		ID: "niamey", Name: "Niamey", Country: "ne", Zoom: 11.8, Lat: 13.52483, Lng: 2.10982,
		Blurb: "La capitale du Niger, sur le fleuve : le Grand marché, la grande mosquée, le musée national Boubou-Hama et ses dinosaures, le pont Kennedy.",
		Admin: CityAdmin{Type: "ville", Region: "Niamey", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueniamey, srcOSM)},
		Communes: []Commune{
			{ID: "niamey-centre", Name: "Niamey centre", Lat: 13.52483, Lng: 2.10982, Blurb: "Le Grand marché, le musée national, le pont Kennedy sur le Niger.",
				Admin: Admin{Type: "commune", Parent: "Ville de Niamey", Mairie: "mairie-niamey-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueniamey)},
				Places: []Place{
					townHall("niamey-centre", "Hôtel de ville de Niamey", "Ville de Niamey", 13.51364, 2.10884, srcAfriqueniamey),
					afrAt("niamey-grand-marche", "Grand marché de Niamey", "market", 13.51539, 2.12251, "Le Grand marché de Niamey ; position d'après OpenStreetMap."),
					afrAt("niamey-musee", "Musée national Boubou-Hama", "culture", 13.51204, 2.10822, "Le musée national, son zoo et ses artisans ; position d'après OpenStreetMap."),
					afrAt("niamey-mosquee", "Grande mosquée de Niamey", "worship", 13.5221, 2.13289, "La grande mosquée de Niamey ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("niamey-aeroport", "Aéroport international Diori-Hamani", "aeroport", 13.49017, 2.1846, "L'aéroport de Niamey ; position d'après OpenStreetMap."),
					fictional("niamey-gare-routiere", "Gare routière de Wadata", "transport", "Wadata", 13.52634, 2.10558),
					fictional("niamey-resto", "Restaurant Le Kilichi", "restaurant", "Centre", 13.51894, 2.11094),
					fictional("niamey-grin", "Le fada du Plateau", "grin", "Plateau", 13.5268, 2.11208),
					fictional("niamey-club", "Le Fleuve Night", "club", "Centre", 13.52627, 2.10676),
				}},
		},
	},
	{
		ID: "agadez", Name: "Agadez", Country: "ne", Zoom: 12.6, Lat: 16.97256, Lng: 7.99074,
		Blurb: "La porte du désert, la ville touarègue de l'Aïr : le minaret de terre de la grande mosquée, la vieille ville classée, les orfèvres et la croix d'Agadez.",
		Admin: CityAdmin{Type: "ville", Region: "Région d'Agadez", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueagadez, srcOSM)},
		Communes: []Commune{
			{ID: "agadez-centre", Name: "Vieille ville d'Agadez", Lat: 16.97256, Lng: 7.99074, Blurb: "La grande mosquée, le palais du sultan, les ruelles de banco.",
				Admin: Admin{Type: "commune", Parent: "Ville d'Agadez", Mairie: "mairie-agadez-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueagadez)},
				Places: []Place{
					{ID: "mairie-agadez-centre", Name: "Mairie d'Agadez", Kind: "mairie", Lat: 16.97376, Lng: 7.98984, Real: true, Approx: true, Operator: "Commune urbaine d'Agadez", Source: game.Partial("La mairie ; position approximative.", srcAfriqueagadez)},
					afrAt("agadez-mosquee", "Grande mosquée d'Agadez", "worship", 16.97414, 7.9884, "Le minaret de banco hérissé de pieux, le plus haut du monde en terre ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("agadez-sultan", "Palais du sultan de l'Aïr", "culture", 16.9728, 7.989, "Le palais du sultan de l'Aïr ; position d'après OpenStreetMap."),
					afrAt("agadez-aeroport", "Aéroport Mano-Dayak", "aeroport", 16.97092, 8.01402, "L'aéroport d'Agadez ; position d'après OpenStreetMap."),
					fictional("agadez-orfevre", "Atelier des orfèvres touaregs", "boutique", "Vieille ville", 16.97406, 7.9865),
					fictional("agadez-gare-routiere", "Gare routière d'Agadez", "transport", "Centre", 16.96666, 7.99186),
					fictional("agadez-the", "Le thé de l'Aïr", "grin", "Vieille ville", 16.97453, 7.993),
				}},
		},
	},
	{
		ID: "monrovia", Name: "Monrovia", Country: "lr", Zoom: 11.8, Lat: 6.32036, Lng: -10.80605,
		Blurb: "La capitale du Liberia, entre l'océan et le fleuve Mesurado : Broad Street, le marché de Waterside, Providence Island, le Centennial Pavilion.",
		Admin: CityAdmin{Type: "ville", Region: "Comté de Montserrado", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquemonrovia, srcOSM)},
		Communes: []Commune{
			{ID: "monrovia-centre", Name: "Monrovia centre", Lat: 6.32036, Lng: -10.80605, Blurb: "Broad Street, le marché de Waterside, le Capitole, Providence Island.",
				Admin: Admin{Type: "commune", Parent: "Ville de Monrovia", Mairie: "mairie-monrovia-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquemonrovia)},
				Places: []Place{
					townHall("monrovia-centre", "Hôtel de ville de Monrovia", "Monrovia City Corporation", 6.29532, -10.79345, srcAfriquemonrovia),
					afrAt("monrovia-waterside", "Marché de Waterside", "market", 6.3155, -10.806, "Le grand marché au bord du Mesurado ; position d'après OpenStreetMap."),
					afrAt("monrovia-providence", "Providence Island", "culture", 6.31982, -10.80139, "L'île où débarquèrent les premiers colons en 1822, lieu de mémoire ; position d'après OpenStreetMap."),
					afrAt("monrovia-centennial", "Centennial Pavilion", "culture", 6.31679, -10.80388, "Le pavillon des investitures présidentielles ; position d'après OpenStreetMap."),
					afrAt("monrovia-capitole", "Capitole du Liberia", "assemblee", 6.30177, -10.79571, "Le Parlement du Liberia, sur Capitol Hill ; position d'après OpenStreetMap."),
					afrAt("monrovia-aeroport", "Aéroport de Spriggs-Payne", "aeroport", 6.28894, -10.75935, "L'aéroport de la ville, à Sinkor ; position d'après OpenStreetMap."),
					fictional("monrovia-gare-routiere", "Gare routière de Red Light", "transport", "Paynesville", 6.32186, -10.81029),
					fictional("monrovia-cookshop", "Cookshop Ma Kebbeh", "restaurant", "Sinkor", 6.31446, -10.80493),
					fictional("monrovia-club", "Club Mamba Point", "club", "Mamba Point", 6.32233, -10.80379),
				}},
		},
	},
	{
		ID: "buchanan", Name: "Buchanan", Country: "lr", Zoom: 12.4, Lat: 5.8808, Lng: -10.0467,
		Blurb: "La deuxième ville du Liberia, port du minerai de fer sur la côte : les plages, la pêche, le marché.",
		Admin: CityAdmin{Type: "ville", Region: "Comté de Grand Bassa", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquebuchanan, srcOSM)},
		Communes: []Commune{
			{ID: "buchanan-centre", Name: "Buchanan centre", Lat: 5.8808, Lng: -10.0467, Blurb: "Le port, le marché, la plage.",
				Admin: Admin{Type: "commune", Parent: "Ville de Buchanan", Mairie: "mairie-buchanan-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebuchanan)},
				Places: []Place{
					{ID: "mairie-buchanan-centre", Name: "Hôtel de ville de Buchanan", Kind: "mairie", Lat: 5.882, Lng: -10.0476, Real: true, Approx: true, Operator: "Ville de Buchanan", Source: game.Partial("La mairie ; position approximative.", srcAfriquebuchanan)},
					afrAt("buchanan-aeroport", "Aérodrome de Buchanan", "aeroport", 5.867, -10.058, "Le petit aérodrome de Buchanan ; position d'après OpenStreetMap."),
					fictional("buchanan-marche", "Marché de Buchanan", "market", "Centre", 5.88231, -10.05094),
					fictional("buchanan-plage", "Plage de Buchanan", "beach", "Centre", 5.87491, -10.04558),
					fictional("buchanan-gare-routiere", "Gare routière de Buchanan", "transport", "Centre", 5.88277, -10.04444),
					fictional("buchanan-cookshop", "Cookshop Grand Bassa", "restaurant", "Centre", 5.88224, -10.04976),
				}},
		},
	},
	{
		ID: "freetown", Name: "Freetown", Country: "sl", Zoom: 11.8, Lat: 8.479, Lng: -13.26795,
		Blurb: "La capitale de la Sierra Leone, entre les collines et l'océan : le vieux fromager du centre, les plages de Lumley, l'aéroport de Lungi de l'autre côté de l'estuaire.",
		Admin: CityAdmin{Type: "ville", Region: "Western Area", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquefreetown, srcOSM)},
		Communes: []Commune{
			{ID: "freetown-centre", Name: "Freetown centre", Lat: 8.479, Lng: -13.26795, Blurb: "Le Cotton Tree, le musée national, le marché, State House.",
				Admin: Admin{Type: "commune", Parent: "Ville de Freetown", Mairie: "mairie-freetown-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquefreetown)},
				Places: []Place{
					townHall("freetown-centre", "Hôtel de ville de Freetown", "Freetown City Council", 8.4904, -13.23525, srcAfriquefreetown),
					afrAt("freetown-cotton-tree", "Place du Cotton Tree", "rue", 8.45255, -13.26655, "Le rond-point du vieux fromager, symbole de la ville ; position d'après OpenStreetMap."),
					afrAt("freetown-musee", "Musée national de Sierra Leone", "culture", 8.48677, -13.2359, "Le musée national ; position d'après OpenStreetMap."),
					afrAt("freetown-lumley", "Plage de Lumley", "beach", 8.45984, -13.27591, "La grande plage de Freetown ; position d'après OpenStreetMap."),
					afrAt("freetown-fourah-bay", "Fourah Bay College", "universite", 8.47787, -13.22104, "La plus ancienne université d'Afrique de l'Ouest ; position d'après OpenStreetMap.").withOperator("Université publique"),
					fictional("freetown-gare-routiere", "Gare routière de Freetown", "transport", "Centre", 8.48051, -13.27219),
					fictional("freetown-cookery", "Cookery Mama Salone", "restaurant", "Centre", 8.47311, -13.26683),
					fictional("freetown-club", "Club Lumley Night", "club", "Lumley", 8.48097, -13.26569),
				}},
			{ID: "freetown-lungi", Name: "Lungi", Lat: 8.67783, Lng: -13.00785, Blurb: "La ville de l'aéroport international, de l'autre côté de l'estuaire (le bateau ou l'hélicoptère pour Freetown).",
				Admin: Admin{Type: "commune", Parent: "Ville de Freetown", Mairie: "mairie-freetown-lungi", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquefreetown)},
				Places: []Place{
					{ID: "mairie-freetown-lungi", Name: "Bureau du chef de Lungi", Kind: "mairie", Lat: 8.67903, Lng: -13.00875, Real: true, Approx: true, Operator: "District de Port Loko", Source: game.Partial("La mairie ; position approximative.", srcAfriquefreetown)},
					afrAt("freetown-aeroport", "Aéroport international de Lungi", "aeroport", 8.6178, -13.18701, "L'aéroport international de Freetown, à Lungi ; position d'après OpenStreetMap."),
				}},
		},
	},
	{
		ID: "bo", Name: "Bo", Country: "sl", Zoom: 12.4, Lat: 7.9647, Lng: -11.7383,
		Blurb: "La deuxième ville de Sierra Leone, au cœur du pays mendé : le marché, l'école de Bo, les diamants de la région.",
		Admin: CityAdmin{Type: "ville", Region: "Province du Sud", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquebo, srcOSM)},
		Communes: []Commune{
			{ID: "bo-centre", Name: "Bo centre", Lat: 7.9647, Lng: -11.7383, Blurb: "Le centre, le grand marché, l'université Njala de Bo.",
				Admin: Admin{Type: "commune", Parent: "Ville de Bo", Mairie: "mairie-bo-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebo)},
				Places: []Place{
					{ID: "mairie-bo-centre", Name: "Hôtel de ville de Bo", Kind: "mairie", Lat: 7.9659, Lng: -11.7392, Real: true, Approx: true, Operator: "Bo City Council", Source: game.Partial("La mairie ; position approximative.", srcAfriquebo)},
					afrAt("bo-aeroport", "Aérodrome de Bo", "aeroport", 7.944, -11.761, "Le petit aérodrome de Bo ; position d'après OpenStreetMap."),
					fictional("bo-marche", "Grand marché de Bo", "market", "Centre", 7.96621, -11.74254),
					fictional("bo-gare-routiere", "Gare routière de Bo", "transport", "Centre", 7.95881, -11.73718),
					fictional("bo-cookery", "Cookery Mende Pot", "restaurant", "Centre", 7.96667, -11.73604),
				}},
		},
	},
	{
		ID: "banjul", Name: "Banjul", Country: "gm", Zoom: 11.6, Lat: 13.45535, Lng: -16.57565,
		Blurb: "La petite capitale de la Gambie, sur son île à l'embouchure du fleuve : l'Arch 22, le marché d'Albert ; à côté, Serrekunda la grande ville et les plages de l'Atlantique.",
		Admin: CityAdmin{Type: "ville", Region: "Banjul et Kanifing", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquebanjul, srcOSM)},
		Communes: []Commune{
			{ID: "banjul-centre", Name: "Banjul", Lat: 13.45535, Lng: -16.57565, Blurb: "L'île de Banjul : l'Arch 22, le marché Albert, le musée, le bac pour Barra.",
				Admin: Admin{Type: "commune", Parent: "Ville de Banjul", Mairie: "mairie-banjul-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebanjul)},
				Places: []Place{
					townHall("banjul-centre", "Hôtel de ville de Banjul", "Banjul City Council", 13.45791, -16.57861, srcAfriquebanjul),
					afrAt("banjul-arch22", "Arch 22", "culture", 13.46032, -16.58244, "L'arche monumentale à l'entrée de Banjul ; position d'après OpenStreetMap."),
					afrAt("banjul-albert", "Marché Albert", "market", 13.45389, -16.57152, "Le grand marché de Banjul ; position d'après OpenStreetMap."),
					afrAt("banjul-musee", "Musée national de Gambie", "culture", 13.45598, -16.57578, "Le musée national ; position d'après OpenStreetMap."),
					fictional("banjul-resto", "Restaurant Le Domoda", "restaurant", "Banjul", 13.45686, -16.57989),
				}},
			{ID: "banjul-serrekunda", Name: "Serrekunda", Lat: 13.43403, Lng: -16.6855, Blurb: "La plus grande ville du pays : les marchés, les gares de taxis, les plages de Kololi.",
				Admin: Admin{Type: "municipalité", Parent: "Ville de Banjul", Mairie: "mairie-banjul-serrekunda", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebanjul)},
				Places: []Place{
					townHall("banjul-serrekunda", "Conseil municipal de Kanifing", "Kanifing Municipal Council", 13.44695, -16.67231, srcAfriquebanjul),
					afrAt("banjul-marche", "Marché de Serrekunda", "market", 13.43912, -16.68163, "Le grand marché de Serrekunda ; position d'après OpenStreetMap."),
					afrAt("banjul-kololi", "Plage de Kololi", "beach", 13.4548, -16.71769, "La plage de Kololi ; position d'après OpenStreetMap."),
					afrAt("banjul-crocodiles", "Bassin sacré des crocodiles de Kachikally", "nature", 13.47667, -16.67243, "Le bassin sacré des crocodiles, à Bakau ; position d'après OpenStreetMap."),
					fictional("banjul-gare-routiere", "Gare routière de Serrekunda", "transport", "Serrekunda", 13.43554, -16.68974),
					fictional("banjul-club", "Club Senegambia Strip", "club", "Kololi", 13.42814, -16.68439),
					fictional("banjul-hotel", "Hôtel Le Fleuve Gambie", "hotel", "Kololi", 13.436, -16.68324),
				}},
			{ID: "banjul-yundum", Name: "Yundum", Lat: 13.34224, Lng: -16.66973, Blurb: "La ville de l'aéroport international.",
				Admin: Admin{Type: "ville", Parent: "Ville de Banjul", Mairie: "mairie-banjul-yundum", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebanjul)},
				Places: []Place{
					{ID: "mairie-banjul-yundum", Name: "Bureau de Yundum", Kind: "mairie", Lat: 13.34344, Lng: -16.67063, Real: true, Approx: true, Operator: "Région de West Coast", Source: game.Partial("La mairie ; position approximative.", srcAfriquebanjul)},
					afrAt("banjul-aeroport", "Aéroport international de Banjul", "aeroport", 13.33634, -16.6495, "L'aéroport international de la Gambie, à Yundum ; position d'après OpenStreetMap."),
				}},
		},
	},
	{
		ID: "bissau", Name: "Bissau", Country: "gw", Zoom: 12, Lat: 11.86132, Lng: -15.58305,
		Blurb: "La capitale de la Guinée-Bissau, sur l'estuaire du Geba : le vieux Bissau, le port de Pidjiguiti, le marché de Bandim, le carnaval.",
		Admin: CityAdmin{Type: "ville", Region: "Secteur autonome de Bissau", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquebissau, srcOSM)},
		Communes: []Commune{
			{ID: "bissau-centre", Name: "Bissau centre", Lat: 11.86132, Lng: -15.58305, Blurb: "Le Bissau Velho, le port de Pidjiguiti, le palais présidentiel, le marché de Bandim.",
				Admin: Admin{Type: "commune", Parent: "Ville de Bissau", Mairie: "mairie-bissau-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebissau)},
				Places: []Place{
					townHall("bissau-centre", "Hôtel de ville de Bissau", "Mairie de Bissau", 11.86433, -15.58719, srcAfriquebissau),
					afrAt("bissau-pidjiguiti", "Port de Pidjiguiti", "culture", 11.85583, -15.57846, "Le quai et son mémorial des dockers de 1959 ; position d'après OpenStreetMap."),
					afrAt("bissau-bandim", "Marché de Bandim", "market", 11.85751, -15.59342, "Le grand marché de Bissau ; position d'après OpenStreetMap."),
					afrAt("bissau-fortaleza", "Fort d'Amura", "culture", 11.859, -15.583, "Le vieux fort, avec le mausolée d'Amílcar Cabral ; position d'après OpenStreetMap."),
					afrAt("bissau-aeroport", "Aéroport international Osvaldo-Vieira", "aeroport", 11.89621, -15.65261, "L'aéroport de Bissau ; position d'après OpenStreetMap."),
					fictional("bissau-gare-routiere", "Gare routière de Bissau", "transport", "Centre", 11.86283, -15.5873),
					fictional("bissau-resto", "Restaurant Le Caldo de Mancarra", "restaurant", "Centre", 11.85543, -15.58194),
					fictional("bissau-club", "Le Gumbé Club", "club", "Centre", 11.86329, -15.58079),
				}},
		},
	},
	{
		ID: "bubaque", Name: "Bubaque", Country: "gw", Zoom: 12.6, Lat: 11.30008, Lng: -15.83124, Island: true,
		Blurb: "L'île des Bijagós, archipel de mangroves et de plages au large de la Guinée-Bissau : la pirogue, les tortues, les hippopotames de mer d'Orango.",
		Admin: CityAdmin{Type: "ville", Region: "Archipel des Bijagós", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquebubaque, srcOSM)},
		Communes: []Commune{
			{ID: "bubaque-centre", Name: "Bubaque", Lat: 11.30008, Lng: -15.83124, Blurb: "Le petit port de l'île, les plages, la pirogue pour les autres îles.",
				Admin: Admin{Type: "secteur", Parent: "Ville de Bubaque", Mairie: "mairie-bubaque-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebubaque)},
				Places: []Place{
					{ID: "mairie-bubaque-centre", Name: "Administration du secteur de Bubaque", Kind: "mairie", Lat: 11.30128, Lng: -15.83214, Real: true, Approx: true, Operator: "Secteur de Bubaque", Source: game.Partial("La mairie ; position approximative.", srcAfriquebubaque)},
					afrAt("bubaque-aeroport", "Aérodrome de Bubaque", "aeroport", 11.30335, -15.83918, "La piste de l'île de Bubaque ; position d'après OpenStreetMap."),
					fictional("bubaque-plage", "Plage de Bruce", "beach", "Bubaque", 11.30159, -15.83548),
					fictional("bubaque-port", "Embarcadère des pirogues", "transport", "Bubaque", 11.29419, -15.83012),
					fictional("bubaque-resto", "Restaurant Les Bijagós", "restaurant", "Bubaque", 11.30205, -15.82898),
				}},
		},
	},
	{
		ID: "praia", Name: "Praia", Country: "cv", Zoom: 12.4, Lat: 14.91628, Lng: -23.50951, Island: true,
		Blurb: "La capitale du Cap-Vert, sur l'île de Santiago : le Plateau et ses rues colorées, le marché de Sucupira ; à côté, la Cidade Velha, première ville européenne des tropiques.",
		Admin: CityAdmin{Type: "ville", Region: "Île de Santiago", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquepraia, srcOSM)},
		Communes: []Commune{
			{ID: "praia-plateau", Name: "Plateau de Praia", Lat: 14.92003, Lng: -23.50712, Blurb: "Le Plateau, le palais présidentiel, le marché, la plage de Quebra-Canela.",
				Admin: Admin{Type: "commune", Parent: "Ville de Praia", Mairie: "mairie-praia-plateau", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquepraia)},
				Places: []Place{
					townHall("praia-plateau", "Hôtel de ville de Praia", "Câmara Municipal da Praia", 14.91712, -23.50926, srcAfriquepraia),
					afrAt("praia-sucupira", "Marché de Sucupira", "market", 14.92259, -23.50964, "Le grand marché populaire de Praia ; position d'après OpenStreetMap."),
					afrAt("praia-quebra-canela", "Plage de Quebra-Canela", "beach", 14.91, -23.515, "La plage de la ville ; position d'après OpenStreetMap."),
					afrAt("praia-aeroport", "Aéroport international Nelson-Mandela", "aeroport", 14.94128, -23.48478, "L'aéroport de Praia ; position d'après OpenStreetMap."),
					fictional("praia-morna", "Le bar à morna du Plateau", "club", "Plateau", 14.92154, -23.51136),
					fictional("praia-cachupa", "Restaurant La Cachupa", "restaurant", "Plateau", 14.91414, -23.506),
				}},
			{ID: "praia-cidade-velha", Name: "Cidade Velha", Lat: 14.91585, Lng: -23.60484, Blurb: "La première ville fondée par les Européens sous les tropiques, classée au patrimoine mondial : le pilori, le fort Real de São Filipe.",
				Admin: Admin{Type: "ville", Parent: "Ville de Praia", Mairie: "mairie-praia-cidade-velha", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquepraia)},
				Places: []Place{
					{ID: "mairie-praia-cidade-velha", Name: "Mairie de Ribeira Grande de Santiago", Kind: "mairie", Lat: 14.91705, Lng: -23.60574, Real: true, Approx: true, Operator: "Câmara Municipal da Ribeira Grande de Santiago", Source: game.Partial("La mairie ; position approximative.", srcAfriquepraia)},
					afrAt("praia-fort", "Fort Real de São Filipe", "culture", 14.91605, -23.60182, "Le fort qui domine la vieille ville ; position d'après OpenStreetMap."),
					fictional("praia-pilori", "Place du Pilori", "rue", "Cidade Velha", 14.91736, -23.60908),
				}},
		},
	},
	{
		ID: "mindelo", Name: "Mindelo", Country: "cv", Zoom: 12.6, Lat: 16.88731, Lng: -24.98641, Island: true,
		Blurb: "La ville de la musique, sur l'île de São Vicente : la baie et son port, la tour de Belém en miniature, la morna de Cesária Évora, le carnaval.",
		Admin: CityAdmin{Type: "ville", Region: "Île de São Vicente", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquemindelo, srcOSM)},
		Communes: []Commune{
			{ID: "mindelo-centre", Name: "Mindelo centre", Lat: 16.88731, Lng: -24.98641, Blurb: "La baie, la rue de Lisbonne, le marché, la plage de Laginha.",
				Admin: Admin{Type: "commune", Parent: "Ville de Mindelo", Mairie: "mairie-mindelo-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquemindelo)},
				Places: []Place{
					{ID: "mairie-mindelo-centre", Name: "Hôtel de ville de São Vicente", Kind: "mairie", Lat: 16.88851, Lng: -24.98731, Real: true, Approx: true, Operator: "Câmara Municipal de São Vicente", Source: game.Partial("La mairie ; position approximative.", srcAfriquemindelo)},
					afrAt("mindelo-torre", "Torre de Belém de Mindelo", "culture", 16.88433, -24.9899, "La petite tour copie de celle de Lisbonne, sur le port ; position d'après OpenStreetMap."),
					afrAt("mindelo-laginha", "Plage de Laginha", "beach", 16.89423, -24.99263, "La plage de Mindelo ; position d'après OpenStreetMap."),
					afrAt("mindelo-aeroport", "Aéroport Cesária-Évora", "aeroport", 16.83451, -25.05517, "L'aéroport de São Vicente ; position d'après OpenStreetMap."),
					fictional("mindelo-morna", "Le bar à morna de Mindelo", "club", "Centre", 16.88881, -24.99065),
					fictional("mindelo-peixe", "Restaurant Le Poisson de la Baie", "restaurant", "Centre", 16.88141, -24.98529),
					fictional("mindelo-marche", "Marché municipal de Mindelo", "market", "Centre", 16.88928, -24.98414),
				}},
		},
	},
	{
		ID: "nouakchott", Name: "Nouakchott", Country: "mr", Zoom: 11.8, Lat: 18.11279, Lng: -15.99303,
		Blurb: "La capitale de la Mauritanie, entre le désert et l'océan : le port de pêche et ses centaines de pirogues, le marché Capitale, la mosquée saoudienne, le thé à la menthe sous la tente.",
		Admin: CityAdmin{Type: "ville", Region: "Nouakchott", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquenouakchott, srcOSM)},
		Communes: []Commune{
			{ID: "nouakchott-centre", Name: "Nouakchott centre (Tevragh-Zeina)", Lat: 18.1268, Lng: -16.00256, Blurb: "Le centre : la mosquée saoudienne, le marché Capitale, le musée national.",
				Admin: Admin{Type: "commune", Parent: "Ville de Nouakchott", Mairie: "mairie-nouakchott-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquenouakchott)},
				Places: []Place{
					{ID: "mairie-nouakchott-centre", Name: "Mairie de Tevragh-Zeina", Kind: "mairie", Lat: 18.128, Lng: -16.00346, Real: true, Approx: true, Operator: "Commune de Tevragh-Zeina", Source: game.Partial("La mairie ; position approximative.", srcAfriquenouakchott)},
					afrAt("nouakchott-mosquee", "Mosquée saoudienne", "worship", 18.09045, -15.97563, "La grande mosquée du centre-ville ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("nouakchott-marche", "Marché Capitale", "market", 18.06928, -15.97617, "Le grand marché du centre ; position d'après OpenStreetMap."),
					afrAt("nouakchott-musee", "Musée national de Mauritanie", "culture", 18.08557, -15.97498, "Le musée national ; position d'après OpenStreetMap."),
					afrAt("nouakchott-aeroport", "Aéroport international de Nouakchott-Oumtounsy", "aeroport", 18.30066, -15.97508, "L'aéroport de Nouakchott ; position d'après OpenStreetMap."),
					fictional("nouakchott-gare-routiere", "Gare routière de Nouakchott", "transport", "Ksar", 18.12831, -16.0068),
					fictional("nouakchott-the", "La tente du thé", "grin", "Tevragh-Zeina", 18.1209, -16.00144),
					fictional("nouakchott-resto", "Restaurant Le Thiéboudiène du Ksar", "restaurant", "Ksar", 18.12877, -16.0003),
				}},
			{ID: "nouakchott-port", Name: "Port de pêche", Lat: 17.99494, Lng: -16.02703, Blurb: "La plage des pêcheurs : les pirogues colorées qui rentrent l'après-midi, le marché au poisson.",
				Admin: Admin{Type: "commune", Parent: "Ville de Nouakchott", Mairie: "mairie-nouakchott-port", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquenouakchott)},
				Places: []Place{
					townHall("nouakchott-port", "Mairie de Sebkha", "Commune de Sebkha", 18.06295, -15.99052, srcAfriquenouakchott),
					afrAt("nouakchott-plage", "Plage des pêcheurs", "beach", 18.07874, -15.98363, "Le port de pêche artisanale et son marché ; position d'après OpenStreetMap."),
					fictional("nouakchott-poisson", "Marché au poisson", "market", "Port de pêche", 17.99645, -16.03127),
				}},
		},
	},
	{
		ID: "nouadhibou", Name: "Nouadhibou", Country: "mr", Zoom: 12.4, Lat: 20.9127, Lng: -17.05031,
		Blurb: "Le grand port du Nord mauritanien, au bout de la presqu'île du Cap-Blanc : la pêche, le train du minerai, le plus long du monde, le cimetière de bateaux.",
		Admin: CityAdmin{Type: "ville", Region: "Dakhlet Nouadhibou", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquenouadhibou, srcOSM)},
		Communes: []Commune{
			{ID: "nouadhibou-centre", Name: "Nouadhibou centre", Lat: 20.9127, Lng: -17.05031, Blurb: "Le port, le marché, la gare du train minéralier.",
				Admin: Admin{Type: "commune", Parent: "Ville de Nouadhibou", Mairie: "mairie-nouadhibou-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquenouadhibou)},
				Places: []Place{
					townHall("nouadhibou-centre", "Mairie de Nouadhibou", "Commune de Nouadhibou", 20.92989, -17.02987, srcAfriquenouadhibou),
					afrAt("nouadhibou-aeroport", "Aéroport de Nouadhibou", "aeroport", 20.92989, -17.02867, "L'aéroport de Nouadhibou ; position d'après OpenStreetMap."),
					fictional("nouadhibou-marche", "Marché de Nouadhibou", "market", "Centre", 20.91421, -17.05455),
					fictional("nouadhibou-gare-routiere", "Gare routière de Nouadhibou", "transport", "Centre", 20.90681, -17.04919),
					fictional("nouadhibou-resto", "Restaurant Le Cap-Blanc", "restaurant", "Centre", 20.91468, -17.04805),
					fictional("nouadhibou-plage", "Plage de la baie du Lévrier", "beach", "Centre", 20.91414, -17.05337),
				}},
		},
	},
	{
		ID: "yaounde", Name: "Yaoundé", Country: "cm", Zoom: 11.8, Lat: 3.86899, Lng: 11.52133,
		Blurb: "La capitale du Cameroun, la ville aux sept collines : le monument de la Réunification, la basilique de Mvolyé, le marché Mokolo, le ndolè et le bikutsi.",
		Admin: CityAdmin{Type: "ville", Region: "Région du Centre", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueyaounde, srcOSM)},
		Communes: []Commune{
			{ID: "yaounde-centre", Name: "Yaoundé centre", Lat: 3.86899, Lng: 11.52133, Blurb: "Le centre : le boulevard du 20-Mai, le monument de la Réunification, le marché central.",
				Admin: Admin{Type: "commune", Parent: "Ville de Yaoundé", Mairie: "mairie-yaounde-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueyaounde)},
				Places: []Place{
					townHall("yaounde-centre", "Hôtel de ville de Yaoundé", "Communauté urbaine de Yaoundé", 3.87505, 11.51645, srcAfriqueyaounde),
					afrAt("yaounde-reunification", "Monument de la Réunification", "culture", 3.85248, 11.5134, "Le monument de la Réunification du Cameroun ; position d'après OpenStreetMap."),
					afrAt("yaounde-mvolye", "Basilique Marie-Reine-des-Apôtres de Mvolyé", "worship", 3.84233, 11.50774, "La basilique sur la colline de Mvolyé ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("yaounde-mokolo", "Marché Mokolo", "market", 3.87469, 11.50019, "Le grand marché populaire de Yaoundé ; position d'après OpenStreetMap."),
					afrAt("yaounde-aeroport", "Aéroport international de Yaoundé-Nsimalen", "aeroport", 3.72501, 11.55214, "L'aéroport de Yaoundé ; position d'après OpenStreetMap."),
					afrAt("yaounde-gare-routiere", "Gare routière de Mvan", "transport", 3.82258, 11.51634, "La gare des cars de Yaoundé ; position d'après OpenStreetMap."),
					fictional("yaounde-resto", "Restaurant Le Ndolè de Mama", "restaurant", "Centre", 3.87049, 11.51709),
					fictional("yaounde-club", "Club Bikutsi", "club", "Centre", 3.86309, 11.52245),
				}},
		},
	},
	{
		ID: "douala", Name: "Douala", Country: "cm", Zoom: 11.8, Lat: 4.04294, Lng: 9.7062,
		Blurb: "La capitale économique du Cameroun, sur l'estuaire du Wouri : le port, Akwa et Bonanjo, la Pagode, le pont du Wouri, le makossa.",
		Admin: CityAdmin{Type: "ville", Region: "Région du Littoral", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquedouala, srcOSM)},
		Communes: []Commune{
			{ID: "douala-centre", Name: "Douala centre", Lat: 4.04294, Lng: 9.7062, Blurb: "Akwa et Bonanjo : la Pagode, la cathédrale, les grands boulevards, le marché central.",
				Admin: Admin{Type: "commune", Parent: "Ville de Douala", Mairie: "mairie-douala-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquedouala)},
				Places: []Place{
					townHall("douala-centre", "Hôtel de ville de Douala", "Communauté urbaine de Douala", 4.07015, 9.6845, srcAfriquedouala),
					afrAt("douala-pagode", "La Pagode", "culture", 4.044, 9.69, "Le palais du roi Manga Bell, à Bonanjo ; position d'après OpenStreetMap."),
					afrAt("douala-cathedrale", "Cathédrale Saints-Pierre-et-Paul de Douala", "worship", 4.04417, 9.69259, "La cathédrale de Douala ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("douala-wouri", "Pont du Wouri", "rue", 4.07216, 9.69303, "Le grand pont sur l'estuaire du Wouri ; position d'après OpenStreetMap."),
					afrAt("douala-aeroport", "Aéroport international de Douala", "aeroport", 4.01296, 9.71615, "L'aéroport de Douala ; position d'après OpenStreetMap."),
					fictional("douala-gare-routiere", "Gare routière de Mboppi", "transport", "Centre", 4.04445, 9.70196),
					fictional("douala-resto", "Restaurant Le Makossa", "restaurant", "Centre", 4.03704, 9.70732),
					fictional("douala-club", "Club Akwa Night", "club", "Centre", 4.04491, 9.70846),
				}},
		},
	},
	{
		ID: "libreville", Name: "Libreville", Country: "ga", Zoom: 11.8, Lat: 0.40865, Lng: 9.44188,
		Blurb: "La capitale du Gabon, au bord de l'estuaire : le bord de mer, la cathédrale Saint-Michel aux colonnes sculptées, le marché de Mont-Bouët.",
		Admin: CityAdmin{Type: "ville", Region: "Estuaire", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquelibreville, srcOSM)},
		Communes: []Commune{
			{ID: "libreville-centre", Name: "Libreville centre", Lat: 0.40865, Lng: 9.44188, Blurb: "Le bord de mer, le palais présidentiel, le marché de Mont-Bouët.",
				Admin: Admin{Type: "commune", Parent: "Ville de Libreville", Mairie: "mairie-libreville-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquelibreville)},
				Places: []Place{
					townHall("libreville-centre", "Hôtel de ville de Libreville", "Commune de Libreville", 0.41048, 9.4444, srcAfriquelibreville),
					afrAt("libreville-saint-michel", "Église Saint-Michel de Nkembo", "worship", 0.40906, 9.45753, "L'église aux colonnes de bois sculptées ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("libreville-mont-bouet", "Marché de Mont-Bouët", "market", 0.40125, 9.45191, "Le grand marché de Libreville ; position d'après OpenStreetMap."),
					afrAt("libreville-bord-de-mer", "Bord de mer de Libreville", "beach", 0.47047, 9.39919, "La plage et la promenade de Libreville ; position d'après OpenStreetMap."),
					afrAt("libreville-aeroport", "Aéroport international Léon-Mba", "aeroport", 0.46202, 9.41131, "L'aéroport de Libreville ; position d'après OpenStreetMap."),
					fictional("libreville-gare-routiere", "Gare routière de Libreville", "transport", "Centre", 0.41016, 9.43764),
					fictional("libreville-resto", "Restaurant Le Nyembwe", "restaurant", "Centre", 0.40276, 9.443),
					fictional("libreville-club", "Club L'Estuaire", "club", "Centre", 0.41062, 9.44535),
				}},
		},
	},
	{
		ID: "port-gentil", Name: "Port-Gentil", Country: "ga", Zoom: 11.8, Lat: -0.7152, Lng: 8.77879, Island: true,
		Blurb: "La capitale économique du Gabon, la ville du pétrole, sur une île du delta de l'Ogooué : le cap Lopez, les plages.",
		Admin: CityAdmin{Type: "ville", Region: "Ogooué-Maritime", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueport_gentil, srcOSM)},
		Communes: []Commune{
			{ID: "port-gentil-centre", Name: "Port-Gentil centre", Lat: -0.7152, Lng: 8.77879, Blurb: "Le centre, le port, le marché du Grand Village.",
				Admin: Admin{Type: "commune", Parent: "Ville de Port-Gentil", Mairie: "mairie-port-gentil-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueport_gentil)},
				Places: []Place{
					townHall("port-gentil-centre", "Hôtel de ville de Port-Gentil", "Commune de Port-Gentil", -0.72014, 8.7827, srcAfriqueport_gentil),
					afrAt("port-gentil-cap-lopez", "Cap Lopez", "nature", -0.62265, 8.71344, "La pointe du cap Lopez et sa plage ; position d'après OpenStreetMap."),
					afrAt("port-gentil-aeroport", "Aéroport de Port-Gentil", "aeroport", -0.71437, 8.75318, "L'aéroport de Port-Gentil ; position d'après OpenStreetMap."),
					fictional("port-gentil-marche", "Marché du Grand Village", "market", "Centre", -0.71369, 8.77455),
					fictional("port-gentil-resto", "Restaurant Le Poisson braisé", "restaurant", "Centre", -0.72109, 8.77991),
				}},
		},
	},
	{
		ID: "brazzaville", Name: "Brazzaville", Country: "cg", Zoom: 11.8, Lat: -4.26944, Lng: 15.27123,
		Blurb: "La capitale du Congo, face à Kinshasa de l'autre côté du fleuve : la basilique Sainte-Anne et ses tuiles vertes, le mémorial Pierre-Savorgnan-de-Brazza, la rumba.",
		Admin: CityAdmin{Type: "ville", Region: "Brazzaville", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquebrazzaville, srcOSM)},
		Communes: []Commune{
			{ID: "brazzaville-centre", Name: "Brazzaville centre", Lat: -4.26944, Lng: 15.27123, Blurb: "Le centre-ville, la corniche du fleuve, le marché Total de Bacongo.",
				Admin: Admin{Type: "commune", Parent: "Ville de Brazzaville", Mairie: "mairie-brazzaville-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebrazzaville)},
				Places: []Place{
					townHall("brazzaville-centre", "Hôtel de ville de Brazzaville", "Commune de Brazzaville", -4.27897, 15.27826, srcAfriquebrazzaville),
					afrAt("brazzaville-sainte-anne", "Basilique Sainte-Anne-du-Congo", "worship", -4.2684, 15.28443, "La basilique aux tuiles vertes ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("brazzaville-memorial", "Mémorial Pierre-Savorgnan-de-Brazza", "culture", -4.27848, 15.27938, "Le mémorial au bord du fleuve ; position d'après OpenStreetMap."),
					afrAt("brazzaville-marche", "Marché Total", "market", -4.28972, 15.24922, "Le grand marché de Bacongo ; position d'après OpenStreetMap."),
					afrAt("brazzaville-aeroport", "Aéroport international Maya-Maya", "aeroport", -4.25101, 15.25385, "L'aéroport de Brazzaville ; position d'après OpenStreetMap."),
					fictional("brazzaville-gare-routiere", "Gare routière de Brazzaville", "transport", "Centre", -4.26793, 15.26699),
					fictional("brazzaville-resto", "Restaurant Le Saka-Saka", "restaurant", "Centre", -4.27534, 15.27234),
					fictional("brazzaville-club", "Club Rumba du Fleuve", "club", "Centre", -4.26747, 15.27349),
				}},
		},
	},
	{
		ID: "pointe-noire", Name: "Pointe-Noire", Country: "cg", Zoom: 11.8, Lat: -4.79754, Lng: 11.85033,
		Blurb: "Le port du Congo sur l'Atlantique : la gare du Congo-Océan, la Côte Sauvage, le marché Tié-Tié.",
		Admin: CityAdmin{Type: "ville", Region: "Pointe-Noire", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquepointe_noire, srcOSM)},
		Communes: []Commune{
			{ID: "pointe-noire-centre", Name: "Pointe-Noire centre", Lat: -4.79754, Lng: 11.85033, Blurb: "La gare, le grand marché, la Côte Sauvage.",
				Admin: Admin{Type: "commune", Parent: "Ville de Pointe-Noire", Mairie: "mairie-pointe-noire-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquepointe_noire)},
				Places: []Place{
					townHall("pointe-noire-centre", "Hôtel de ville de Pointe-Noire", "Commune de Pointe-Noire", -4.7984, 11.84632, srcAfriquepointe_noire),
					afrAt("pointe-noire-gare", "Gare de Pointe-Noire", "transport", -4.80131, 11.84017, "La gare du chemin de fer Congo-Océan ; position d'après OpenStreetMap."),
					afrAt("pointe-noire-cote-sauvage", "Côte Sauvage", "beach", -4.81556, 11.85059, "La plage de la Côte Sauvage ; position d'après OpenStreetMap."),
					afrAt("pointe-noire-aeroport", "Aéroport Agostinho-Neto", "aeroport", -4.81576, 11.88663, "L'aéroport de Pointe-Noire ; position d'après OpenStreetMap."),
					fictional("pointe-noire-gare-routiere", "Gare routière de Pointe-Noire", "transport", "Centre", -4.79603, 11.84609),
					fictional("pointe-noire-marche", "Marché Tié-Tié", "market", "Centre", -4.80343, 11.85145),
					fictional("pointe-noire-resto", "Restaurant La Côte Sauvage", "restaurant", "Centre", -4.79557, 11.85259),
				}},
		},
	},
	{
		ID: "kinshasa", Name: "Kinshasa", Country: "cd", Zoom: 11.8, Lat: -4.32171, Lng: 15.31225,
		Blurb: "La capitale de la RD Congo, la plus grande ville francophone du monde : le boulevard du 30-Juin, la Gombe, le Grand marché, la rumba et le ndombolo.",
		Admin: CityAdmin{Type: "ville", Region: "Ville-province de Kinshasa", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquekinshasa, srcOSM)},
		Communes: []Commune{
			{ID: "kinshasa-centre", Name: "La Gombe", Lat: -4.32171, Lng: 15.31225, Blurb: "La Gombe : le boulevard du 30-Juin, le Grand marché, le fleuve et Brazzaville en face.",
				Admin: Admin{Type: "commune", Parent: "Ville de Kinshasa", Mairie: "mairie-kinshasa-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquekinshasa)},
				Places: []Place{
					townHall("kinshasa-centre", "Hôtel de ville de Kinshasa", "Ville-province de Kinshasa", -4.3063, 15.30861, srcAfriquekinshasa),
					afrAt("kinshasa-trente-juin", "Boulevard du 30-Juin", "rue", -4.30685, 15.29563, "La grande avenue de la Gombe ; position d'après OpenStreetMap."),
					afrAt("kinshasa-grand-marche", "Grand marché de Kinshasa", "market", -4.31029, 15.31252, "Le Grand marché (Zando) ; position d'après OpenStreetMap."),
					afrAt("kinshasa-echangeur", "Tour de l'Échangeur de Limete", "culture", -4.37226, 15.34505, "La tour monumentale de Limete ; position d'après OpenStreetMap."),
					afrAt("kinshasa-academie", "Académie des beaux-arts", "culture", -4.32149, 15.29338, "L'école d'art de Kinshasa ; position d'après OpenStreetMap."),
					afrAt("kinshasa-aeroport", "Aéroport international de N'djili", "aeroport", -4.3858, 15.4446, "L'aéroport de Kinshasa ; position d'après OpenStreetMap."),
					fictional("kinshasa-gare-routiere", "Gare routière de Kinshasa", "transport", "Centre", -4.3202, 15.30801),
					fictional("kinshasa-nganda", "Nganda Chez Maman Colonel", "restaurant", "Centre", -4.3276, 15.31337),
					fictional("kinshasa-club", "Club Rumba de Matonge", "club", "Matonge", -4.31974, 15.31451),
				}},
		},
	},
	{
		ID: "lubumbashi", Name: "Lubumbashi", Country: "cd", Zoom: 11.8, Lat: -11.66423, Lng: 27.48263,
		Blurb: "La grande ville minière du Katanga : la cathédrale Saints-Pierre-et-Paul, le terril de la Gécamines, le zoo, le marché Mzee.",
		Admin: CityAdmin{Type: "ville", Region: "Haut-Katanga", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquelubumbashi, srcOSM)},
		Communes: []Commune{
			{ID: "lubumbashi-centre", Name: "Lubumbashi centre", Lat: -11.66423, Lng: 27.48263, Blurb: "Le centre, la cathédrale, la place de la Poste.",
				Admin: Admin{Type: "commune", Parent: "Ville de Lubumbashi", Mairie: "mairie-lubumbashi-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquelubumbashi)},
				Places: []Place{
					townHall("lubumbashi-centre", "Hôtel de ville de Lubumbashi", "Ville de Lubumbashi", -11.66341, 27.48288, srcAfriquelubumbashi),
					afrAt("lubumbashi-cathedrale", "Cathédrale Saints-Pierre-et-Paul de Lubumbashi", "worship", -11.6657, 27.47982, "La cathédrale de Lubumbashi ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("lubumbashi-zoo", "Zoo de Lubumbashi", "zoo", -11.66839, 27.47441, "Le jardin zoologique de Lubumbashi ; position d'après OpenStreetMap."),
					afrAt("lubumbashi-aeroport", "Aéroport international de la Luano", "aeroport", -11.59265, 27.52592, "L'aéroport de Lubumbashi ; position d'après OpenStreetMap."),
					fictional("lubumbashi-gare-routiere", "Gare routière de Lubumbashi", "transport", "Centre", -11.66272, 27.47839),
					fictional("lubumbashi-marche", "Marché Mzee", "market", "Centre", -11.67013, 27.48375),
					fictional("lubumbashi-resto", "Restaurant Le Katanga", "restaurant", "Centre", -11.66226, 27.48489),
				}},
		},
	},
	{
		ID: "ndjamena", Name: "N'Djamena", Country: "td", Zoom: 11.8, Lat: 12.1067, Lng: 15.0444,
		Blurb: "La capitale du Tchad, au confluent du Chari et du Logone : la grande mosquée Roi-Fayçal, le Grand marché, le musée national.",
		Admin: CityAdmin{Type: "ville", Region: "N'Djamena", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquendjamena, srcOSM)},
		Communes: []Commune{
			{ID: "ndjamena-centre", Name: "N'Djamena centre", Lat: 12.1067, Lng: 15.0444, Blurb: "Le centre, la grande mosquée, la place de la Nation, le Grand marché.",
				Admin: Admin{Type: "commune", Parent: "Ville de N'Djamena", Mairie: "mairie-ndjamena-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquendjamena)},
				Places: []Place{
					{ID: "mairie-ndjamena-centre", Name: "Hôtel de ville de N'Djamena", Kind: "mairie", Lat: 12.1079, Lng: 15.0435, Real: true, Approx: true, Operator: "Commune de N'Djamena", Source: game.Partial("La mairie ; position approximative.", srcAfriquendjamena)},
					afrAt("ndjamena-mosquee", "Grande mosquée Roi-Fayçal", "worship", 12.1067, 15.044, "La grande mosquée de N'Djamena ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("ndjamena-grand-marche", "Grand marché de N'Djamena", "market", 12.111, 15.042, "Le Grand marché ; position d'après OpenStreetMap."),
					afrAt("ndjamena-nation", "Place de la Nation", "rue", 12.105, 15.05, "La grande place et son arc ; position d'après OpenStreetMap."),
					afrAt("ndjamena-aeroport", "Aéroport international Hassan-Djamous", "aeroport", 12.1337, 15.034, "L'aéroport de N'Djamena ; position d'après OpenStreetMap."),
					fictional("ndjamena-gare-routiere", "Gare routière de N'Djamena", "transport", "Centre", 12.10821, 15.04016),
					fictional("ndjamena-resto", "Restaurant La Boule du Chari", "restaurant", "Centre", 12.10081, 15.04552),
					fictional("ndjamena-the", "Le thé du Chari", "grin", "Centre", 12.10867, 15.04666),
				}},
		},
	},
	{
		ID: "bangui", Name: "Bangui", Country: "cf", Zoom: 11.8, Lat: 4.36351, Lng: 18.58359,
		Blurb: "La capitale de la Centrafrique, sur l'Oubangui : la cathédrale Notre-Dame, le PK5 et son marché, les rapides de l'Oubangui.",
		Admin: CityAdmin{Type: "ville", Region: "Bangui", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquebangui, srcOSM)},
		Communes: []Commune{
			{ID: "bangui-centre", Name: "Bangui centre", Lat: 4.36351, Lng: 18.58359, Blurb: "Le centre, la cathédrale, la place de la République.",
				Admin: Admin{Type: "commune", Parent: "Ville de Bangui", Mairie: "mairie-bangui-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebangui)},
				Places: []Place{
					townHall("bangui-centre", "Hôtel de ville de Bangui", "Commune de Bangui", 4.36352, 18.58359, srcAfriquebangui),
					afrAt("bangui-cathedrale", "Cathédrale Notre-Dame de Bangui", "worship", 4.36994, 18.578, "La cathédrale de briques rouges ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("bangui-boganda", "Musée Barthélemy-Boganda", "culture", 4.36408, 18.57702, "Le musée national ; position d'après OpenStreetMap."),
					afrAt("bangui-aeroport", "Aéroport international Bangui-M'Poko", "aeroport", 4.39592, 18.52333, "L'aéroport de Bangui ; position d'après OpenStreetMap."),
					fictional("bangui-gare-routiere", "Gare routière de Bangui", "transport", "Centre", 4.36502, 18.57935),
					fictional("bangui-marche", "Marché du PK5", "market", "PK5", 4.35762, 18.58471),
					fictional("bangui-resto", "Restaurant Le Gozo", "restaurant", "Centre", 4.36548, 18.58585),
				}},
		},
	},
	{
		ID: "malabo", Name: "Malabo", Country: "gq", Zoom: 11.8, Lat: 3.74188, Lng: 8.77407, Island: true,
		Blurb: "La capitale de la Guinée équatoriale, sur l'île de Bioko : la cathédrale Santa Isabel, la baie, le pic Basilé au-dessus.",
		Admin: CityAdmin{Type: "ville", Region: "Bioko Norte", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquemalabo, srcOSM)},
		Communes: []Commune{
			{ID: "malabo-centre", Name: "Malabo centre", Lat: 3.74188, Lng: 8.77407, Blurb: "La vieille ville espagnole, la cathédrale, la place de l'Indépendance.",
				Admin: Admin{Type: "commune", Parent: "Ville de Malabo", Mairie: "mairie-malabo-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquemalabo)},
				Places: []Place{
					townHall("malabo-centre", "Hôtel de ville de Malabo", "Ayuntamiento de Malabo", 3.73106, 8.7627, srcAfriquemalabo),
					afrAt("malabo-cathedrale", "Cathédrale Santa Isabel de Malabo", "worship", 3.75694, 8.78287, "La cathédrale néogothique ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("malabo-independance", "Place de l'Indépendance", "rue", 3.75722, 8.7844, "La grande place de Malabo ; position d'après OpenStreetMap."),
					afrAt("malabo-aeroport", "Aéroport international de Malabo", "aeroport", 3.75615, 8.7068, "L'aéroport de Malabo ; position d'après OpenStreetMap."),
					fictional("malabo-resto", "Restaurant La Baie de Bioko", "restaurant", "Centre", 3.74338, 8.76983),
					fictional("malabo-marche", "Marché de Malabo", "market", "Centre", 3.73598, 8.77519),
				}},
		},
	},
	{
		ID: "bata", Name: "Bata", Country: "gq", Zoom: 11.8, Lat: 1.86919, Lng: 9.77201,
		Blurb: "La grande ville du continent en Guinée équatoriale : le front de mer, la tour de la Liberté, le marché.",
		Admin: CityAdmin{Type: "ville", Region: "Litoral", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquebata, srcOSM)},
		Communes: []Commune{
			{ID: "bata-centre", Name: "Bata centre", Lat: 1.86919, Lng: 9.77201, Blurb: "Le paseo marítimo, la tour de la Liberté.",
				Admin: Admin{Type: "commune", Parent: "Ville de Bata", Mairie: "mairie-bata-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquebata)},
				Places: []Place{
					townHall("bata-centre", "Hôtel de ville de Bata", "Ayuntamiento de Bata", 1.86919, 9.77201, srcAfriquebata),
					afrAt("bata-tour", "Tour de la Liberté", "culture", 1.87044, 9.77058, "La tour du front de mer ; position d'après OpenStreetMap."),
					afrAt("bata-aeroport", "Aéroport de Bata", "aeroport", 1.90936, 9.80749, "L'aéroport de Bata ; position d'après OpenStreetMap."),
					fictional("bata-gare-routiere", "Gare routière de Bata", "transport", "Centre", 1.8707, 9.76777),
					fictional("bata-marche", "Marché de Bata", "market", "Centre", 1.86329, 9.77313),
					fictional("bata-resto", "Restaurant Le Paseo", "restaurant", "Centre", 1.87116, 9.77428),
					fictional("bata-plage", "Plage de Bata", "beach", "Centre", 1.87062, 9.76895),
				}},
		},
	},
	{
		ID: "rabat", Name: "Rabat", Country: "ma", Zoom: 11.8, Lat: 34.02185, Lng: -6.84089,
		Blurb: "La capitale du Maroc, à l'embouchure du Bouregreg : la tour Hassan et le mausolée Mohammed-V, la kasbah des Oudayas, la médina.",
		Admin: CityAdmin{Type: "ville", Region: "Rabat-Salé-Kénitra", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquerabat, srcOSM)},
		Communes: []Commune{
			{ID: "rabat-centre", Name: "Rabat centre", Lat: 34.02185, Lng: -6.84089, Blurb: "La tour Hassan, le mausolée, la kasbah des Oudayas, la médina.",
				Admin: Admin{Type: "commune", Parent: "Ville de Rabat", Mairie: "mairie-rabat-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquerabat)},
				Places: []Place{
					{ID: "mairie-rabat-centre", Name: "Hôtel de ville de Rabat", Kind: "mairie", Lat: 34.02305, Lng: -6.84179, Real: true, Approx: true, Operator: "Commune de Rabat", Source: game.Partial("La mairie ; position approximative.", srcAfriquerabat)},
					afrAt("rabat-hassan", "Tour Hassan", "culture", 34.02415, -6.8228, "Le minaret inachevé du XIIe siècle ; position d'après OpenStreetMap."),
					afrAt("rabat-mausolee", "Mausolée Mohammed-V", "culture", 34.02266, -6.82142, "Le mausolée face à la tour Hassan ; position d'après OpenStreetMap."),
					afrAt("rabat-oudayas", "Kasbah des Oudayas", "culture", 34.03166, -6.83585, "La kasbah blanche et bleue au-dessus de l'embouchure ; position d'après OpenStreetMap."),
					afrAt("rabat-aeroport", "Aéroport de Rabat-Salé", "aeroport", 34.05113, -6.74305, "L'aéroport de Rabat ; position d'après OpenStreetMap."),
					afrAt("rabat-gare-routiere", "Gare routière de Kamra", "transport", 33.99148, -6.86782, "La gare des cars de Rabat ; position d'après OpenStreetMap."),
					fictional("rabat-resto", "Restaurant Le Tajine des Oudayas", "restaurant", "Centre", 34.02335, -6.84513),
					fictional("rabat-cafe", "Café maure du Bouregreg", "grin", "Centre", 34.01595, -6.83977),
					fictional("rabat-hammam", "Hammam de la médina", "salon", "Centre", 34.02382, -6.83863),
				}},
		},
	},
	{
		ID: "casablanca", Name: "Casablanca", Country: "ma", Zoom: 11.8, Lat: 33.59451, Lng: -7.62003,
		Blurb: "La grande ville du Maroc : la mosquée Hassan-II sur l'océan, la Corniche, la vieille médina, les immeubles Art déco du centre.",
		Admin: CityAdmin{Type: "ville", Region: "Casablanca-Settat", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquecasablanca, srcOSM)},
		Communes: []Commune{
			{ID: "casablanca-centre", Name: "Casablanca centre", Lat: 33.59451, Lng: -7.62003, Blurb: "Le centre : la place Mohammed-V, les immeubles Art déco, l'ancienne médina, la mosquée Hassan-II.",
				Admin: Admin{Type: "commune", Parent: "Ville de Casablanca", Mairie: "mairie-casablanca-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquecasablanca)},
				Places: []Place{
					townHall("casablanca-centre", "Wilaya et hôtel de ville de Casablanca", "Commune de Casablanca", 33.59029, -7.61904, srcAfriquecasablanca),
					afrAt("casablanca-hassan2", "Mosquée Hassan-II", "worship", 33.60822, -7.63247, "La grande mosquée sur l'océan et son minaret de 210 mètres ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("casablanca-corniche", "Corniche d'Aïn Diab", "beach", 33.593, -7.668, "La corniche et les plages de Casablanca ; position d'après OpenStreetMap."),
					afrAt("casablanca-medina", "Ancienne médina", "market", 33.60072, -7.62033, "La vieille médina et ses souks ; position d'après OpenStreetMap."),
					afrAt("casablanca-place", "Place Mohammed-V", "rue", 33.5925, -7.617, "La grande place du centre et ses pigeons ; position d'après OpenStreetMap."),
					afrAt("casablanca-aeroport", "Aéroport international Mohammed-V", "aeroport", 33.36928, -7.58701, "L'aéroport de Casablanca ; position d'après OpenStreetMap."),
					afrAt("casablanca-gare-routiere", "Gare routière Ouled Ziane", "transport", 33.57326, -7.5876, "La gare des cars de Casablanca ; position d'après OpenStreetMap."),
					fictional("casablanca-resto", "Restaurant La Pastilla", "restaurant", "Centre", 33.59602, -7.62427),
					fictional("casablanca-club", "Club de la Corniche", "club", "Centre", 33.58862, -7.61891),
				}},
		},
	},
	{
		ID: "marrakech", Name: "Marrakech", Country: "ma", Zoom: 11.8, Lat: 31.62583, Lng: -7.98916,
		Blurb: "La ville rouge au pied de l'Atlas : la place Jemaa el-Fna, la Koutoubia, les souks, le jardin Majorelle.",
		Admin: CityAdmin{Type: "ville", Region: "Marrakech-Safi", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquemarrakech, srcOSM)},
		Communes: []Commune{
			{ID: "marrakech-centre", Name: "Marrakech centre", Lat: 31.62583, Lng: -7.98916, Blurb: "La médina : la Jemaa el-Fna, la Koutoubia, les souks, le palais de la Bahia.",
				Admin: Admin{Type: "commune", Parent: "Ville de Marrakech", Mairie: "mairie-marrakech-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquemarrakech)},
				Places: []Place{
					townHall("marrakech-centre", "Hôtel de ville de Marrakech", "Commune de Marrakech", 31.62763, -7.99812, srcAfriquemarrakech),
					afrAt("marrakech-jemaa", "Place Jemaa el-Fna", "rue", 31.62494, -7.98847, "La grande place des conteurs, des musiciens et des stands du soir ; position d'après OpenStreetMap."),
					afrAt("marrakech-majorelle", "Jardin Majorelle", "nature", 31.64147, -8.00291, "Le jardin bleu et ses cactus ; position d'après OpenStreetMap."),
					afrAt("marrakech-bahia", "Palais de la Bahia", "culture", 31.62163, -7.98194, "Le palais aux zelliges et aux jardins ; position d'après OpenStreetMap."),
					afrAt("marrakech-souks", "Souks de Marrakech", "market", 31.62792, -7.98809, "Les souks de la médina ; position d'après OpenStreetMap."),
					afrAt("marrakech-aeroport", "Aéroport de Marrakech-Ménara", "aeroport", 31.60587, -8.03246, "L'aéroport de Marrakech ; position d'après OpenStreetMap."),
					afrAt("marrakech-gare-routiere", "Gare routière de Bab Doukkala", "transport", 31.638, -7.999, "La gare des cars de Marrakech ; position d'après OpenStreetMap."),
					fictional("marrakech-resto", "Restaurant La Tanjia de la médina", "restaurant", "Centre", 31.62733, -7.9934),
					fictional("marrakech-hammam", "Hammam de la Kasbah", "salon", "Centre", 31.61993, -7.98804),
				}},
		},
	},
	{
		ID: "alger", Name: "Alger", Country: "dz", Zoom: 11.8, Lat: 36.77293, Lng: 3.05884,
		Blurb: "La capitale de l'Algérie, « Alger la Blanche » sur sa baie : la Casbah classée, le mémorial du Martyr, Notre-Dame d'Afrique, la grande mosquée.",
		Admin: CityAdmin{Type: "ville", Region: "Wilaya d'Alger", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquealger, srcOSM)},
		Communes: []Commune{
			{ID: "alger-centre", Name: "Alger centre", Lat: 36.77293, Lng: 3.05884, Blurb: "Le centre : la Grande Poste, la rue Didouche-Mourad, la Casbah au-dessus.",
				Admin: Admin{Type: "commune", Parent: "Ville d'Alger", Mairie: "mairie-alger-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquealger)},
				Places: []Place{
					{ID: "mairie-alger-centre", Name: "Hôtel de ville d'Alger", Kind: "mairie", Lat: 36.77413, Lng: 3.05794, Real: true, Approx: true, Operator: "Commune d'Alger-Centre", Source: game.Partial("La mairie ; position approximative.", srcAfriquealger)},
					afrAt("alger-casbah", "Casbah d'Alger", "culture", 36.78447, 3.05785, "La vieille ville ottomane, classée au patrimoine mondial ; position d'après OpenStreetMap."),
					afrAt("alger-martyr", "Mémorial du Martyr (Maqam Echahid)", "culture", 36.73693, 3.13996, "Le grand mémorial sur les hauteurs ; position d'après OpenStreetMap."),
					afrAt("alger-notre-dame", "Basilique Notre-Dame d'Afrique", "worship", 36.80193, 3.04277, "La basilique qui domine la baie ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("alger-grande-poste", "Grande Poste d'Alger", "culture", 36.77204, 3.05809, "Le bâtiment néo-mauresque du centre ; position d'après OpenStreetMap."),
					afrAt("alger-aeroport", "Aéroport d'Alger Houari-Boumédiène", "aeroport", 36.70141, 3.22933, "L'aéroport de Alger ; position d'après OpenStreetMap."),
					afrAt("alger-gare-routiere", "Gare routière du Caroubier", "transport", 36.74263, 3.10595, "La gare des cars de Alger ; position d'après OpenStreetMap."),
					fictional("alger-resto", "Restaurant Le Couscous de la Casbah", "restaurant", "Centre", 36.77444, 3.0546),
					fictional("alger-cafe", "Café Tlemcen", "grin", "Centre", 36.76704, 3.05996),
				}},
		},
	},
	{
		ID: "oran", Name: "Oran", Country: "dz", Zoom: 11.8, Lat: 35.70444, Lng: -0.6503,
		Blurb: "La grande ville de l'Ouest algérien, la ville du raï : le fort de Santa Cruz, la place du 1er-Novembre, le front de mer.",
		Admin: CityAdmin{Type: "ville", Region: "Wilaya d'Oran", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueoran, srcOSM)},
		Communes: []Commune{
			{ID: "oran-centre", Name: "Oran centre", Lat: 35.70444, Lng: -0.6503, Blurb: "La place du 1er-Novembre, le front de mer, le théâtre.",
				Admin: Admin{Type: "commune", Parent: "Ville d'Oran", Mairie: "mairie-oran-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueoran)},
				Places: []Place{
					townHall("oran-centre", "Hôtel de ville d'Oran", "Commune d'Oran", 35.68514, -0.64696, srcAfriqueoran),
					afrAt("oran-santa-cruz", "Fort de Santa Cruz", "culture", 35.70922, -0.66505, "Le fort sur le mont Murdjadjo ; position d'après OpenStreetMap."),
					afrAt("oran-place", "Place du 1er-Novembre", "rue", 35.699, -0.637, "La grande place d'Oran ; position d'après OpenStreetMap."),
					afrAt("oran-aeroport", "Aéroport d'Oran Ahmed-Ben-Bella", "aeroport", 35.62057, -0.62252, "L'aéroport de Oran ; position d'après OpenStreetMap."),
					fictional("oran-gare-routiere", "Gare routière d'Oran", "transport", "Centre", 35.70595, -0.65454),
					fictional("oran-rai", "Cabaret Le Raï", "club", "Centre", 35.69855, -0.64918),
					fictional("oran-resto", "Restaurant La Karantika", "restaurant", "Centre", 35.70641, -0.64804),
				}},
		},
	},
	{
		ID: "tunis", Name: "Tunis", Country: "tn", Zoom: 11.8, Lat: 36.8, Lng: 10.18,
		Blurb: "La capitale de la Tunisie : la médina et la mosquée Zitouna, l'avenue Bourguiba, le musée du Bardo ; Carthage et Sidi Bou Saïd au bord de la mer.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat de Tunis", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquetunis, srcOSM)},
		Communes: []Commune{
			{ID: "tunis-centre", Name: "Tunis centre", Lat: 36.7976, Lng: 10.1712, Blurb: "L'avenue Habib-Bourguiba, la médina, la mosquée Zitouna.",
				Admin: Admin{Type: "commune", Parent: "Ville de Tunis", Mairie: "mairie-tunis-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquetunis)},
				Places: []Place{
					{ID: "mairie-tunis-centre", Name: "Hôtel de ville de Tunis", Kind: "mairie", Lat: 36.7988, Lng: 10.1703, Real: true, Approx: true, Operator: "Commune de Tunis", Source: game.Partial("La mairie ; position approximative.", srcAfriquetunis)},
					afrAt("tunis-zitouna", "Mosquée Zitouna", "worship", 36.7976, 10.1712, "La grande mosquée de la médina ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("tunis-bourguiba", "Avenue Habib-Bourguiba", "rue", 36.8002, 10.1865, "La grande avenue de Tunis ; position d'après OpenStreetMap."),
					afrAt("tunis-bardo", "Musée national du Bardo", "culture", 36.8095, 10.1345, "Le musée et ses mosaïques romaines ; position d'après OpenStreetMap."),
					afrAt("tunis-aeroport", "Aéroport international de Tunis-Carthage", "aeroport", 36.851, 10.2272, "L'aéroport de Tunis ; position d'après OpenStreetMap."),
					afrAt("tunis-gare-routiere", "Gare routière de Bab Saadoun", "transport", 36.807, 10.165, "La gare des cars de Tunis ; position d'après OpenStreetMap."),
					fictional("tunis-resto", "Restaurant Le Couscous de la Médina", "restaurant", "Centre", 36.79911, 10.16696),
					fictional("tunis-cafe", "Café des Nattes", "grin", "Centre", 36.79171, 10.17232),
					fictional("tunis-hammam", "Hammam de la Médina", "salon", "Centre", 36.79957, 10.17346),
				}},
		},
	},
	{
		ID: "le-caire", Name: "Le Caire", Country: "eg", Zoom: 11.2, Lat: 30.0146, Lng: 31.22716,
		Blurb: "La capitale de l'Égypte, sur le Nil : la place Tahrir et le musée égyptien, le Caire islamique et le Khan el-Khalili ; à Gizeh, les pyramides et le Sphinx.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat du Caire", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquele_caire, srcOSM)},
		Communes: []Commune{
			{ID: "le-caire-centre", Name: "Le Caire centre", Lat: 30.0146, Lng: 31.22716, Blurb: "Le centre : la place Tahrir, le musée égyptien, la corniche du Nil.",
				Admin: Admin{Type: "commune", Parent: "Ville de Le Caire", Mairie: "mairie-le-caire-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquele_caire)},
				Places: []Place{
					{ID: "mairie-le-caire-centre", Name: "Gouvernorat du Caire", Kind: "mairie", Lat: 30.0158, Lng: 31.22626, Real: true, Approx: true, Operator: "Gouvernorat du Caire", Source: game.Partial("La mairie ; position approximative.", srcAfriquele_caire)},
					afrAt("le-caire-tahrir", "Place Tahrir", "rue", 30.0444, 31.2357, "La grande place du centre ; position d'après OpenStreetMap."),
					afrAt("le-caire-musee", "Musée égyptien", "culture", 30.04997, 31.26138, "Le musée des antiquités égyptiennes ; position d'après OpenStreetMap."),
					afrAt("le-caire-khan", "Khan el-Khalili", "market", 30.04774, 31.26151, "Le grand souk du Caire islamique ; position d'après OpenStreetMap."),
					afrAt("le-caire-tour", "Tour du Caire", "culture", 30.05396, 31.20939, "La tour sur l'île de Zamalek ; position d'après OpenStreetMap."),
					afrAt("le-caire-aeroport", "Aéroport international du Caire", "aeroport", 30.1219, 31.4056, "L'aéroport de Le Caire ; position d'après OpenStreetMap."),
					afrAt("le-caire-gare-routiere", "Gare routière de Turgoman", "transport", 30.056, 31.242, "La gare des cars de Le Caire ; position d'après OpenStreetMap."),
					fictional("le-caire-koshari", "Koshari El Nil", "restaurant", "Centre", 30.01611, 31.22292),
					fictional("le-caire-felouque", "Felouques de la corniche", "nature", "Centre", 30.00871, 31.22828),
					fictional("le-caire-cafe", "Café du Khan", "grin", "Centre", 30.01658, 31.22942),
				}},
		},
	},
	{
		ID: "gizeh", Name: "Gizeh", Country: "eg", Zoom: 11.8, Lat: 29.9792, Lng: 31.1342,
		Blurb: "La ville des pyramides, en face du Caire sur la rive ouest du Nil : Khéops, Khéphren, Mykérinos et le Sphinx sur le plateau, le Grand Musée égyptien.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat de Gizeh", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquegizeh, srcOSM)},
		Communes: []Commune{
			{ID: "gizeh-centre", Name: "Plateau de Gizeh", Lat: 29.9792, Lng: 31.1342, Blurb: "Le plateau de Gizeh : les trois grandes pyramides, le Sphinx, le Grand Musée égyptien.",
				Admin: Admin{Type: "commune", Parent: "Ville de Gizeh", Mairie: "mairie-gizeh-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquegizeh)},
				Places: []Place{
					{ID: "mairie-gizeh-centre", Name: "Gouvernorat de Gizeh", Kind: "mairie", Lat: 29.9804, Lng: 31.1333, Real: true, Approx: true, Operator: "Gouvernorat de Gizeh", Source: game.Partial("La mairie ; position approximative.", srcAfriquegizeh)},
					afrAt("gizeh-kheops", "Pyramide de Khéops", "culture", 29.9792, 31.1342, "La grande pyramide, la seule merveille du monde antique encore debout ; position d'après OpenStreetMap."),
					afrAt("gizeh-sphinx", "Grand Sphinx de Gizeh", "culture", 29.97439, 31.13852, "Le Sphinx au pied des pyramides ; position d'après OpenStreetMap."),
					afrAt("gizeh-gem", "Grand Musée égyptien", "culture", 29.9946, 31.1187, "Le grand musée face aux pyramides ; position d'après OpenStreetMap."),
					afrAt("gizeh-aeroport", "Aéroport international Sphinx", "aeroport", 30.1088, 30.8956, "L'aéroport de Gizeh ; position d'après OpenStreetMap."),
					fictional("gizeh-gare-routiere", "Gare routière de Gizeh", "transport", "Centre", 29.98071, 31.12996),
					fictional("gizeh-chameaux", "Balades à dos de chameau du plateau", "nature", "Centre", 29.97331, 31.13532),
					fictional("gizeh-resto", "Restaurant La Vue des Pyramides", "restaurant", "Centre", 29.98117, 31.13646),
				}},
		},
	},
	{
		ID: "alexandrie", Name: "Alexandrie", Country: "eg", Zoom: 11.8, Lat: 31.19524, Lng: 29.90119,
		Blurb: "La perle de la Méditerranée : la bibliothèque d'Alexandrie, la citadelle de Qaitbay à la place du Phare, la corniche.",
		Admin: CityAdmin{Type: "ville", Region: "Gouvernorat d'Alexandrie", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquealexandrie, srcOSM)},
		Communes: []Commune{
			{ID: "alexandrie-centre", Name: "Alexandrie centre", Lat: 31.19524, Lng: 29.90119, Blurb: "La corniche, la bibliothèque, la citadelle de Qaitbay.",
				Admin: Admin{Type: "commune", Parent: "Ville d'Alexandrie", Mairie: "mairie-alexandrie-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquealexandrie)},
				Places: []Place{
					{ID: "mairie-alexandrie-centre", Name: "Gouvernorat d'Alexandrie", Kind: "mairie", Lat: 31.19644, Lng: 29.90029, Real: true, Approx: true, Operator: "Gouvernorat d'Alexandrie", Source: game.Partial("La mairie ; position approximative.", srcAfriquealexandrie)},
					afrAt("alexandrie-bibliotheque", "Bibliothèque d'Alexandrie", "culture", 31.2089, 29.9092, "La grande bibliothèque moderne ; position d'après OpenStreetMap."),
					afrAt("alexandrie-qaitbay", "Citadelle de Qaitbay", "culture", 31.214, 29.8856, "La citadelle bâtie à la place du Phare ; position d'après OpenStreetMap."),
					afrAt("alexandrie-corniche", "Corniche d'Alexandrie", "beach", 31.26163, 29.98374, "La promenade du bord de mer ; position d'après OpenStreetMap."),
					afrAt("alexandrie-aeroport", "Aéroport international Borg el-Arab", "aeroport", 30.9177, 29.6964, "L'aéroport de Alexandrie ; position d'après OpenStreetMap."),
					fictional("alexandrie-gare-routiere", "Gare routière de Moharam Bek", "transport", "Centre", 31.19674, 29.89695),
					fictional("alexandrie-poisson", "Restaurant Le Poisson de la Corniche", "restaurant", "Centre", 31.18934, 29.9023),
					fictional("alexandrie-cafe", "Café du Port", "grin", "Centre", 31.19721, 29.90345),
				}},
		},
	},
	{
		ID: "tripoli", Name: "Tripoli", Country: "ly", Zoom: 11.8, Lat: 32.89667, Lng: 13.17779,
		Blurb: "La capitale de la Libye, sur la Méditerranée : la place des Martyrs, l'arc de Marc Aurèle, la médina et le château rouge.",
		Admin: CityAdmin{Type: "ville", Region: "Tripolitaine", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquetripoli, srcOSM)},
		Communes: []Commune{
			{ID: "tripoli-centre", Name: "Tripoli centre", Lat: 32.89667, Lng: 13.17779, Blurb: "La place des Martyrs, le château rouge, la médina.",
				Admin: Admin{Type: "commune", Parent: "Ville de Tripoli", Mairie: "mairie-tripoli-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquetripoli)},
				Places: []Place{
					{ID: "mairie-tripoli-centre", Name: "Conseil municipal de Tripoli", Kind: "mairie", Lat: 32.89787, Lng: 13.17689, Real: true, Approx: true, Operator: "Municipalité de Tripoli", Source: game.Partial("La mairie ; position approximative.", srcAfriquetripoli)},
					afrAt("tripoli-martyrs", "Place des Martyrs", "rue", 32.89621, 13.18224, "La grande place du centre ; position d'après OpenStreetMap."),
					afrAt("tripoli-marc-aurele", "Arc de Marc Aurèle", "culture", 32.8983, 13.1747, "L'arc romain de la vieille ville ; position d'après OpenStreetMap."),
					afrAt("tripoli-saraya", "Château rouge (Assaraya Al-Hamra)", "culture", 32.8955, 13.1808, "La forteresse et son musée ; position d'après OpenStreetMap."),
					afrAt("tripoli-aeroport", "Aéroport international de Mitiga", "aeroport", 32.8941, 13.276, "L'aéroport de Tripoli ; position d'après OpenStreetMap."),
					fictional("tripoli-gare-routiere", "Gare routière de Tripoli", "transport", "Centre", 32.89818, 13.17355),
					fictional("tripoli-resto", "Restaurant Le Bazin de Tripoli", "restaurant", "Centre", 32.89078, 13.17891),
					fictional("tripoli-cafe", "Café de la Médina", "grin", "Centre", 32.89864, 13.18005),
				}},
		},
	},
	{
		ID: "addis-abeba", Name: "Addis-Abeba", Country: "et", Zoom: 11.8, Lat: 9.03, Lng: 38.74,
		Blurb: "La capitale de l'Éthiopie et de l'Union africaine, sur ses hauts plateaux : la place Meskel, le musée national et Lucy, le Merkato, le café et l'injera.",
		Admin: CityAdmin{Type: "ville", Region: "Addis-Abeba", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueaddis_abeba, srcOSM)},
		Communes: []Commune{
			{ID: "addis-abeba-centre", Name: "Addis-Abeba centre", Lat: 9.03, Lng: 38.74, Blurb: "Le centre : la place Meskel, le siège de l'Union africaine, la cathédrale de la Sainte-Trinité.",
				Admin: Admin{Type: "commune", Parent: "Ville d'Addis-Abeba", Mairie: "mairie-addis-abeba-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueaddis_abeba)},
				Places: []Place{
					townHall("addis-abeba-centre", "Hôtel de ville d'Addis-Abeba", "Ville d'Addis-Abeba", 9.03503, 38.75087, srcAfriqueaddis_abeba),
					afrAt("addis-abeba-meskel", "Place Meskel", "rue", 9.0107, 38.7613, "La grande place des fêtes et des défilés ; position d'après OpenStreetMap."),
					afrAt("addis-abeba-musee", "Musée national d'Éthiopie", "culture", 9.039, 38.7616, "Le musée de Lucy, l'australopithèque ; position d'après OpenStreetMap."),
					afrAt("addis-abeba-merkato", "Merkato", "market", 9.035, 38.738, "Le plus grand marché à ciel ouvert d'Afrique ; position d'après OpenStreetMap."),
					afrAt("addis-abeba-trinite", "Cathédrale de la Sainte-Trinité", "worship", 9.0305, 38.766, "La grande cathédrale orthodoxe ; position d'après OpenStreetMap."),
					afrAt("addis-abeba-aeroport", "Aéroport international de Bole", "aeroport", 8.9779, 38.7993, "L'aéroport de Addis-Abeba ; position d'après OpenStreetMap."),
					fictional("addis-abeba-gare-routiere", "Gare routière de Lamberet", "transport", "Centre", 9.03151, 38.73576),
					fictional("addis-abeba-injera", "Restaurant L'Injera de Bole", "restaurant", "Centre", 9.02411, 38.74112),
					fictional("addis-abeba-cafe", "Cérémonie du café Buna", "grin", "Centre", 9.03197, 38.74226),
					fictional("addis-abeba-club", "Club Azmari", "club", "Centre", 9.03144, 38.73694),
				}},
		},
	},
	{
		ID: "nairobi", Name: "Nairobi", Country: "ke", Zoom: 11.8, Lat: -1.289, Lng: 36.81728,
		Blurb: "La capitale du Kenya : les girafes et les lions du parc national aux portes de la ville, le centre de conférences Kenyatta, le marché Maasai, les matatus colorés.",
		Admin: CityAdmin{Type: "ville", Region: "Comté de Nairobi", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquenairobi, srcOSM)},
		Communes: []Commune{
			{ID: "nairobi-centre", Name: "Nairobi centre", Lat: -1.289, Lng: 36.81728, Blurb: "Le centre : le KICC, la place du Parlement, le marché municipal.",
				Admin: Admin{Type: "commune", Parent: "Ville de Nairobi", Mairie: "mairie-nairobi-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquenairobi)},
				Places: []Place{
					townHall("nairobi-centre", "Hôtel de ville de Nairobi", "Nairobi City County", -1.2869, 36.82175, srcAfriquenairobi),
					afrAt("nairobi-kicc", "Centre international de conférences Kenyatta", "culture", -1.28853, 36.82343, "La tour du KICC et sa terrasse panoramique ; position d'après OpenStreetMap."),
					afrAt("nairobi-parc", "Parc national de Nairobi", "nature", -1.38628, 36.87367, "Le parc des lions et des girafes, avec la ville au fond ; position d'après OpenStreetMap."),
					afrAt("nairobi-girafes", "Centre des girafes", "zoo", -1.37656, 36.74459, "Le centre où l'on nourrit les girafes de Rothschild ; position d'après OpenStreetMap."),
					afrAt("nairobi-marche", "Marché municipal de Nairobi", "market", -1.28367, 36.81951, "Le marché couvert du centre ; position d'après OpenStreetMap."),
					afrAt("nairobi-aeroport", "Aéroport international Jomo-Kenyatta", "aeroport", -1.31695, 36.92886, "L'aéroport de Nairobi ; position d'après OpenStreetMap."),
					afrAt("nairobi-gare-routiere", "Gare routière de Machakos", "transport", -1.288, 36.832, "La gare des cars de Nairobi ; position d'après OpenStreetMap."),
					fictional("nairobi-nyama", "Nyama Choma Corner", "restaurant", "Centre", -1.28749, 36.81304),
					fictional("nairobi-club", "Club Westlands", "club", "Westlands", -1.2949, 36.8184),
				}},
		},
	},
	{
		ID: "mombasa", Name: "Mombasa", Country: "ke", Zoom: 11.8, Lat: -4.05052, Lng: 39.66717,
		Blurb: "Le grand port du Kenya sur l'océan Indien : la vieille ville swahilie, Fort Jesus, les défenses de l'avenue Moi, les plages.",
		Admin: CityAdmin{Type: "ville", Region: "Comté de Mombasa", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquemombasa, srcOSM)},
		Communes: []Commune{
			{ID: "mombasa-centre", Name: "Mombasa centre", Lat: -4.05052, Lng: 39.66717, Blurb: "La vieille ville, Fort Jesus, l'avenue Moi.",
				Admin: Admin{Type: "commune", Parent: "Ville de Mombasa", Mairie: "mairie-mombasa-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquemombasa)},
				Places: []Place{
					{ID: "mairie-mombasa-centre", Name: "Hôtel de ville de Mombasa", Kind: "mairie", Lat: -4.04932, Lng: 39.66627, Real: true, Approx: true, Operator: "Mombasa County", Source: game.Partial("La mairie ; position approximative.", srcAfriquemombasa)},
					afrAt("mombasa-fort-jesus", "Fort Jesus", "culture", -4.06263, 39.67964, "Le fort portugais du XVIe siècle ; position d'après OpenStreetMap."),
					afrAt("mombasa-defenses", "Les défenses de l'avenue Moi", "culture", -4.06163, 39.66606, "Les défenses d'aluminium au-dessus de l'avenue ; position d'après OpenStreetMap."),
					afrAt("mombasa-nyali", "Plage de Nyali", "beach", -4.04725, 39.71058, "La plage au nord de l'île ; position d'après OpenStreetMap."),
					afrAt("mombasa-aeroport", "Aéroport international Moi", "aeroport", -4.02652, 39.60072, "L'aéroport de Mombasa ; position d'après OpenStreetMap."),
					fictional("mombasa-gare-routiere", "Gare routière de Mombasa", "transport", "Centre", -4.04901, 39.66293),
					fictional("mombasa-resto", "Restaurant Swahili Pishi", "restaurant", "Centre", -4.05641, 39.66829),
					fictional("mombasa-dhow", "Balade en boutre", "nature", "Centre", -4.04855, 39.66943),
				}},
		},
	},
	{
		ID: "dar-es-salaam", Name: "Dar es Salaam", Country: "tz", Zoom: 11.8, Lat: -6.81608, Lng: 39.28036,
		Blurb: "La grande ville de la Tanzanie sur l'océan Indien : le marché de Kariakoo, le marché au poisson de Kivukoni, le musée national, le bac pour Zanzibar.",
		Admin: CityAdmin{Type: "ville", Region: "Région de Dar es Salaam", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquedar_es_salaam, srcOSM)},
		Communes: []Commune{
			{ID: "dar-es-salaam-centre", Name: "Dar es Salaam centre", Lat: -6.81608, Lng: 39.28036, Blurb: "Le centre : l'Askari Monument, Kivukoni, le port.",
				Admin: Admin{Type: "commune", Parent: "Ville de Dar es Salaam", Mairie: "mairie-dar-es-salaam-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquedar_es_salaam)},
				Places: []Place{
					townHall("dar-es-salaam-centre", "Hôtel de ville de Dar es Salaam", "Dar es Salaam City Council", -6.81238, 39.29548, srcAfriquedar_es_salaam),
					afrAt("dar-es-salaam-kariakoo", "Marché de Kariakoo", "market", -6.81929, 39.2753, "Le grand marché de Dar es Salaam ; position d'après OpenStreetMap."),
					afrAt("dar-es-salaam-askari", "Askari Monument", "culture", -6.81663, 39.28948, "La statue du soldat au centre-ville ; position d'après OpenStreetMap."),
					afrAt("dar-es-salaam-musee", "Musée national de Tanzanie", "culture", -6.81348, 39.29386, "Le musée national ; position d'après OpenStreetMap."),
					afrAt("dar-es-salaam-kivukoni", "Marché au poisson de Kivukoni", "market", -6.8181, 39.30026, "Le marché au poisson du port ; position d'après OpenStreetMap."),
					afrAt("dar-es-salaam-aeroport", "Aéroport international Julius-Nyerere", "aeroport", -6.87419, 39.20752, "L'aéroport de Dar es Salaam ; position d'après OpenStreetMap."),
					afrAt("dar-es-salaam-gare-routiere", "Gare routière de Magufuli", "transport", -6.78463, 39.10892, "La gare des cars de Dar es Salaam ; position d'après OpenStreetMap."),
					fictional("dar-es-salaam-resto", "Restaurant Chipsi Mayai", "restaurant", "Centre", -6.81458, 39.27612),
					fictional("dar-es-salaam-club", "Club Bongo Flava", "club", "Centre", -6.82198, 39.28148),
				}},
		},
	},
	{
		ID: "zanzibar", Name: "Zanzibar", Country: "tz", Zoom: 11.8, Lat: -6.16649, Lng: 39.20743, Island: true,
		Blurb: "L'île aux épices : Stone Town et ses portes sculptées, la maison des Merveilles, les jardins de Forodhani le soir, les plages.",
		Admin: CityAdmin{Type: "ville", Region: "Unguja", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquezanzibar, srcOSM)},
		Communes: []Commune{
			{ID: "zanzibar-centre", Name: "Stone Town", Lat: -6.16649, Lng: 39.20743, Blurb: "Stone Town, la vieille ville de pierre classée au patrimoine mondial.",
				Admin: Admin{Type: "commune", Parent: "Ville de Zanzibar", Mairie: "mairie-zanzibar-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquezanzibar)},
				Places: []Place{
					{ID: "mairie-zanzibar-centre", Name: "Conseil municipal de Zanzibar", Kind: "mairie", Lat: -6.16529, Lng: 39.20653, Real: true, Approx: true, Operator: "Zanzibar Municipal Council", Source: game.Partial("La mairie ; position approximative.", srcAfriquezanzibar)},
					afrAt("zanzibar-forodhani", "Jardins de Forodhani", "rue", -6.161, 39.188, "Les jardins du bord de mer et leur marché du soir ; position d'après OpenStreetMap."),
					afrAt("zanzibar-merveilles", "Maison des Merveilles", "culture", -6.16091, 39.18962, "Le palais du sultan sur le front de mer ; position d'après OpenStreetMap."),
					afrAt("zanzibar-cathedrale", "Cathédrale du Christ de Zanzibar", "worship", -6.16291, 39.19257, "La cathédrale bâtie sur l'ancien marché aux esclaves, lieu de mémoire ; position d'après OpenStreetMap.").withFaith("protestant"),
					afrAt("zanzibar-aeroport", "Aéroport international Abeid-Amani-Karume", "aeroport", -6.22412, 39.22409, "L'aéroport de Zanzibar ; position d'après OpenStreetMap."),
					fictional("zanzibar-epices", "Ferme aux épices", "nature", "Centre", -6.16498, 39.20319),
					fictional("zanzibar-resto", "Restaurant Pizza de Zanzibar", "restaurant", "Centre", -6.17239, 39.20855),
					fictional("zanzibar-plage", "Plage de Stone Town", "beach", "Centre", -6.16452, 39.20969),
				}},
		},
	},
	{
		ID: "kampala", Name: "Kampala", Country: "ug", Zoom: 11.8, Lat: 0.31771, Lng: 32.58135,
		Blurb: "La capitale de l'Ouganda, sur ses collines au bord du lac Victoria : la mosquée Gaddafi, les tombeaux de Kasubi, le marché d'Owino, les boda-bodas.",
		Admin: CityAdmin{Type: "ville", Region: "Région centrale", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquekampala, srcOSM)},
		Communes: []Commune{
			{ID: "kampala-centre", Name: "Kampala centre", Lat: 0.31771, Lng: 32.58135, Blurb: "Le centre, le vieux parc des taxis, la colline de Nakasero.",
				Admin: Admin{Type: "commune", Parent: "Ville de Kampala", Mairie: "mairie-kampala-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquekampala)},
				Places: []Place{
					townHall("kampala-centre", "Hôtel de ville de Kampala", "Kampala Capital City Authority", 0.3151, 32.58618, srcAfriquekampala),
					afrAt("kampala-mosquee", "Mosquée nationale de l'Ouganda", "worship", 0.3156, 32.56856, "La grande mosquée sur la colline d'Old Kampala ; position d'après OpenStreetMap.").withFaith("musulman"),
					afrAt("kampala-kasubi", "Tombeaux des rois du Buganda à Kasubi", "culture", 0.32914, 32.5533, "Les tombeaux royaux classés au patrimoine mondial ; position d'après OpenStreetMap."),
					afrAt("kampala-owino", "Marché d'Owino", "market", 0.3096, 32.57381, "Le grand marché de Kampala ; position d'après OpenStreetMap."),
					afrAt("kampala-aeroport", "Aéroport international d'Entebbe", "aeroport", 0.03909, 32.45407, "L'aéroport de Kampala ; position d'après OpenStreetMap."),
					fictional("kampala-gare-routiere", "Gare routière de Kampala", "transport", "Centre", 0.31922, 32.57711),
					fictional("kampala-rolex", "Rolex Corner (chapati-omelette)", "restaurant", "Centre", 0.31182, 32.58247),
					fictional("kampala-club", "Club Kabalagala", "club", "Centre", 0.31968, 32.58362),
				}},
		},
	},
	{
		ID: "kigali", Name: "Kigali", Country: "rw", Zoom: 11.8, Lat: -1.95344, Lng: 30.11401,
		Blurb: "La capitale du Rwanda, propre et verte sur ses mille collines : le mémorial du génocide de Gisozi, le centre de conventions, le marché de Kimironko.",
		Admin: CityAdmin{Type: "ville", Region: "Ville de Kigali", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquekigali, srcOSM)},
		Communes: []Commune{
			{ID: "kigali-centre", Name: "Kigali centre", Lat: -1.95344, Lng: 30.11401, Blurb: "Le centre, le rond-point, la colline de Kiyovu.",
				Admin: Admin{Type: "commune", Parent: "Ville de Kigali", Mairie: "mairie-kigali-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquekigali)},
				Places: []Place{
					townHall("kigali-centre", "Hôtel de ville de Kigali", "Ville de Kigali", -1.94839, 30.06024, srcAfriquekigali),
					afrAt("kigali-memorial", "Mémorial du génocide de Kigali", "culture", -1.9317, 30.06026, "Le mémorial des victimes du génocide contre les Tutsi, lieu de recueillement ; position d'après OpenStreetMap."),
					afrAt("kigali-convention", "Kigali Convention Centre", "culture", -1.95473, 30.09466, "Le dôme du centre de conventions, illuminé la nuit ; position d'après OpenStreetMap."),
					afrAt("kigali-kimironko", "Marché de Kimironko", "market", -1.94977, 30.12629, "Le grand marché de Kigali ; position d'après OpenStreetMap."),
					afrAt("kigali-aeroport", "Aéroport international de Kigali", "aeroport", -1.96836, 30.13807, "L'aéroport de Kigali ; position d'après OpenStreetMap."),
					afrAt("kigali-gare-routiere", "Gare routière de Nyabugogo", "transport", -1.94084, 30.04462, "La gare des cars de Kigali ; position d'après OpenStreetMap."),
					fictional("kigali-brochettes", "Brochettes de Nyamirambo", "restaurant", "Nyamirambo", -1.95193, 30.10977),
					fictional("kigali-cafe", "Café des Mille Collines", "restaurant", "Centre", -1.95933, 30.11513),
				}},
		},
	},
	{
		ID: "khartoum", Name: "Khartoum", Country: "sd", Zoom: 11.8, Lat: 15.5007, Lng: 32.5599,
		Blurb: "La capitale du Soudan, au confluent du Nil Blanc et du Nil Bleu : la pointe d'al-Mogran, Omdurman et son souk, le musée national.",
		Admin: CityAdmin{Type: "ville", Region: "État de Khartoum", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquekhartoum, srcOSM)},
		Communes: []Commune{
			{ID: "khartoum-centre", Name: "Khartoum centre", Lat: 15.612, Lng: 32.513, Blurb: "Le centre, la corniche du Nil, le confluent.",
				Admin: Admin{Type: "commune", Parent: "Ville de Khartoum", Mairie: "mairie-khartoum-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquekhartoum)},
				Places: []Place{
					{ID: "mairie-khartoum-centre", Name: "Gouvernorat de Khartoum", Kind: "mairie", Lat: 15.6132, Lng: 32.5121, Real: true, Approx: true, Operator: "État de Khartoum", Source: game.Partial("La mairie ; position approximative.", srcAfriquekhartoum)},
					afrAt("khartoum-mogran", "Confluent d'al-Mogran", "nature", 15.612, 32.513, "La pointe où le Nil Blanc et le Nil Bleu se rejoignent ; position d'après OpenStreetMap."),
					afrAt("khartoum-musee", "Musée national du Soudan", "culture", 15.604, 32.52, "Le musée national et ses temples de Nubie ; position d'après OpenStreetMap."),
					afrAt("khartoum-aeroport", "Aéroport international de Khartoum", "aeroport", 15.5895, 32.5532, "L'aéroport de Khartoum ; position d'après OpenStreetMap."),
					fictional("khartoum-gare-routiere", "Gare routière de Khartoum", "transport", "Centre", 15.61351, 32.50876),
					fictional("khartoum-souk", "Souk d'Omdurman", "market", "Centre", 15.60611, 32.51412),
					fictional("khartoum-ful", "Restaurant Le Ful du Nil", "restaurant", "Centre", 15.61397, 32.51526),
				}},
		},
	},
	{
		ID: "mogadiscio", Name: "Mogadiscio", Country: "so", Zoom: 11.8, Lat: 2.03566, Lng: 45.34167,
		Blurb: "La capitale de la Somalie, au bord de l'océan Indien : la plage du Lido, le marché de Bakaara, la vieille ville de Hamar Weyne.",
		Admin: CityAdmin{Type: "ville", Region: "Banaadir", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquemogadiscio, srcOSM)},
		Communes: []Commune{
			{ID: "mogadiscio-centre", Name: "Mogadiscio centre", Lat: 2.03566, Lng: 45.34167, Blurb: "Hamar Weyne, le Lido, la corniche.",
				Admin: Admin{Type: "commune", Parent: "Ville de Mogadiscio", Mairie: "mairie-mogadiscio-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquemogadiscio)},
				Places: []Place{
					{ID: "mairie-mogadiscio-centre", Name: "Hôtel de ville de Mogadiscio", Kind: "mairie", Lat: 2.03686, Lng: 45.34077, Real: true, Approx: true, Operator: "Banadir Regional Administration", Source: game.Partial("La mairie ; position approximative.", srcAfriquemogadiscio)},
					afrAt("mogadiscio-lido", "Plage du Lido", "beach", 2.0415, 45.36331, "La plage du Lido ; position d'après OpenStreetMap."),
					afrAt("mogadiscio-bakaara", "Marché de Bakaara", "market", 2.044, 45.327, "Le grand marché de Mogadiscio ; position d'après OpenStreetMap."),
					afrAt("mogadiscio-aeroport", "Aéroport international Aden-Adde", "aeroport", 2.0144, 45.3047, "L'aéroport de Mogadiscio ; position d'après OpenStreetMap."),
					fictional("mogadiscio-gare-routiere", "Gare routière de Mogadiscio", "transport", "Centre", 2.03717, 45.33743),
					fictional("mogadiscio-resto", "Restaurant Le Poisson du Lido", "restaurant", "Centre", 2.02976, 45.34279),
					fictional("mogadiscio-the", "Le shaah (thé) de Hamar Weyne", "grin", "Centre", 2.03763, 45.34393),
				}},
		},
	},
	{
		ID: "djibouti", Name: "Djibouti", Country: "dj", Zoom: 11.8, Lat: 11.589, Lng: 43.145,
		Blurb: "La capitale de Djibouti, sur le golfe de Tadjourah : la place Menelik, le marché central, le port, le lac Assal pas loin.",
		Admin: CityAdmin{Type: "ville", Region: "Djibouti", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquedjibouti, srcOSM)},
		Communes: []Commune{
			{ID: "djibouti-centre", Name: "Djibouti centre", Lat: 11.589, Lng: 43.145, Blurb: "La place Menelik, le quartier européen, le marché central.",
				Admin: Admin{Type: "commune", Parent: "Ville de Djibouti", Mairie: "mairie-djibouti-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquedjibouti)},
				Places: []Place{
					townHall("djibouti-centre", "Hôtel de ville de Djibouti", "Ville de Djibouti", 11.59443, 43.14804, srcAfriquedjibouti),
					afrAt("djibouti-menelik", "Place Menelik", "rue", 11.596, 43.146, "La grande place à arcades ; position d'après OpenStreetMap."),
					afrAt("djibouti-marche", "Marché central de Djibouti", "market", 11.5905, 43.1475, "Le marché central ; position d'après OpenStreetMap."),
					afrAt("djibouti-aeroport", "Aéroport international Ambouli", "aeroport", 11.5473, 43.1595, "L'aéroport de Djibouti ; position d'après OpenStreetMap."),
					fictional("djibouti-gare-routiere", "Gare routière de Djibouti", "transport", "Centre", 11.59051, 43.14076),
					fictional("djibouti-resto", "Restaurant Le Poisson yéménite", "restaurant", "Centre", 11.58311, 43.14612),
					fictional("djibouti-plage", "Plage de la Siesta", "beach", "Centre", 11.59097, 43.14846),
				}},
		},
	},
	{
		ID: "antananarivo", Name: "Antananarivo", Country: "mg", Zoom: 11.8, Lat: -18.91001, Lng: 47.52558, Island: true,
		Blurb: "La capitale de Madagascar, « Tana » sur ses collines : le palais de la Reine (Rova), le lac Anosy et ses jacarandas, le marché d'Analakely.",
		Admin: CityAdmin{Type: "ville", Region: "Analamanga", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueantananarivo, srcOSM)},
		Communes: []Commune{
			{ID: "antananarivo-centre", Name: "Antananarivo centre", Lat: -18.91001, Lng: 47.52558, Blurb: "Analakely, l'avenue de l'Indépendance, le lac Anosy, le Rova sur la colline.",
				Admin: Admin{Type: "commune", Parent: "Ville d'Antananarivo", Mairie: "mairie-antananarivo-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueantananarivo)},
				Places: []Place{
					townHall("antananarivo-centre", "Hôtel de ville d'Antananarivo", "Commune urbaine d'Antananarivo", -18.90522, 47.52371, srcAfriqueantananarivo),
					afrAt("antananarivo-rova", "Palais de la Reine (Rova)", "culture", -18.9238, 47.532, "Le palais royal au sommet de la ville ; position d'après OpenStreetMap."),
					afrAt("antananarivo-anosy", "Lac Anosy", "nature", -18.91565, 47.52038, "Le lac en forme de cœur et ses jacarandas ; position d'après OpenStreetMap."),
					afrAt("antananarivo-analakely", "Marché d'Analakely", "market", -18.90832, 47.52628, "Le grand marché du centre ; position d'après OpenStreetMap."),
					afrAt("antananarivo-aeroport", "Aéroport international d'Ivato", "aeroport", -18.79614, 47.47343, "L'aéroport de Antananarivo ; position d'après OpenStreetMap."),
					fictional("antananarivo-gare-routiere", "Gare routière de Tana", "transport", "Centre", -18.9085, 47.52134),
					fictional("antananarivo-romazava", "Hotely Le Romazava", "restaurant", "Centre", -18.91591, 47.5267),
					fictional("antananarivo-hira-gasy", "Scène de hira gasy", "culture", "Centre", -18.90804, 47.52784),
				}},
		},
	},
	{
		ID: "johannesburg", Name: "Johannesburg", Country: "za", Zoom: 11.8, Lat: -26.205, Lng: 28.04972,
		Blurb: "La grande ville d'Afrique du Sud, « Jozi » : Soweto et la maison de Mandela, le musée de l'Apartheid, Constitution Hill, les taxis minibus.",
		Admin: CityAdmin{Type: "ville", Region: "Gauteng", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquejohannesburg, srcOSM)},
		Communes: []Commune{
			{ID: "johannesburg-centre", Name: "Johannesburg centre", Lat: -26.205, Lng: 28.04972, Blurb: "Le centre : Constitution Hill, Newtown, la tour Hillbrow ; Soweto au sud-ouest.",
				Admin: Admin{Type: "commune", Parent: "Ville de Johannesburg", Mairie: "mairie-johannesburg-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquejohannesburg)},
				Places: []Place{
					townHall("johannesburg-centre", "Hôtel de ville de Johannesburg", "City of Johannesburg", -26.20441, 28.04108, srcAfriquejohannesburg),
					afrAt("johannesburg-mandela", "Maison de Mandela (Soweto)", "culture", -26.2385, 27.9088, "La maison de Nelson Mandela, rue Vilakazi ; position d'après OpenStreetMap."),
					afrAt("johannesburg-apartheid", "Musée de l'Apartheid", "culture", -26.23754, 28.00847, "Le musée de l'histoire de l'apartheid ; position d'après OpenStreetMap."),
					afrAt("johannesburg-constitution", "Constitution Hill", "culture", -26.18916, 28.0428, "L'ancienne prison devenue cour constitutionnelle ; position d'après OpenStreetMap."),
					afrAt("johannesburg-aeroport", "Aéroport international O.R.-Tambo", "aeroport", -26.13601, 28.24498, "L'aéroport de Johannesburg ; position d'après OpenStreetMap."),
					afrAt("johannesburg-gare-routiere", "Gare de Park Station", "transport", -26.19554, 28.04163, "La gare des cars de Johannesburg ; position d'après OpenStreetMap."),
					fictional("johannesburg-braai", "Braai Shisa Nyama", "restaurant", "Soweto", -26.20349, 28.04548),
					fictional("johannesburg-club", "Club Amapiano", "club", "Centre", -26.21089, 28.05084),
					fictional("johannesburg-kota", "Kota Corner", "restaurant", "Centre", -26.20303, 28.05198),
				}},
		},
	},
	{
		ID: "le-cap", Name: "Le Cap", Country: "za", Zoom: 11.8, Lat: -33.93184, Lng: 18.41859,
		Blurb: "La ville au pied de la montagne de la Table : le Waterfront, Robben Island au large, le quartier coloré de Bo-Kaap, le cap de Bonne-Espérance au sud.",
		Admin: CityAdmin{Type: "ville", Region: "Cap-Occidental", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquele_cap, srcOSM)},
		Communes: []Commune{
			{ID: "le-cap-centre", Name: "Le Cap centre", Lat: -33.93184, Lng: 18.41859, Blurb: "Le centre, le Waterfront, Bo-Kaap, la montagne de la Table au-dessus.",
				Admin: Admin{Type: "commune", Parent: "Ville de Le Cap", Mairie: "mairie-le-cap-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquele_cap)},
				Places: []Place{
					townHall("le-cap-centre", "Hôtel de ville du Cap", "City of Cape Town", -33.92538, 18.42367, srcAfriquele_cap),
					afrAt("le-cap-table", "Montagne de la Table", "nature", -33.95906, 18.40387, "La montagne plate au-dessus de la ville, et son téléphérique ; position d'après OpenStreetMap."),
					afrAt("le-cap-waterfront", "Waterfront Victoria & Alfred", "rue", -33.906, 18.41953, "Le port et ses quais animés ; position d'après OpenStreetMap."),
					afrAt("le-cap-bokaap", "Bo-Kaap", "rue", -33.92056, 18.41288, "Le quartier aux maisons colorées ; position d'après OpenStreetMap."),
					afrAt("le-cap-robben", "Embarcadère de Robben Island", "culture", -33.90645, 18.42252, "Le départ des bateaux pour l'île où Mandela fut prisonnier ; position d'après OpenStreetMap."),
					afrAt("le-cap-aeroport", "Aéroport international du Cap", "aeroport", -33.97185, 18.60211, "L'aéroport de Le Cap ; position d'après OpenStreetMap."),
					afrAt("le-cap-gare-routiere", "Gare du Cap", "transport", -33.92261, 18.42646, "La gare des cars de Le Cap ; position d'après OpenStreetMap."),
					fictional("le-cap-resto", "Restaurant Le Bobotie", "restaurant", "Centre", -33.93033, 18.41435),
					fictional("le-cap-plage", "Plage de Camps Bay", "beach", "Centre", -33.93773, 18.41971),
				}},
		},
	},
	{
		ID: "luanda", Name: "Luanda", Country: "ao", Zoom: 11.8, Lat: -8.82727, Lng: 13.24395,
		Blurb: "La capitale de l'Angola, sur sa baie : la Marginal, l'Ilha et ses plages, la forteresse de São Miguel, le mausolée d'Agostinho Neto, le kuduro et la semba.",
		Admin: CityAdmin{Type: "ville", Region: "Province de Luanda", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueluanda, srcOSM)},
		Communes: []Commune{
			{ID: "luanda-centre", Name: "Luanda centre", Lat: -8.82727, Lng: 13.24395, Blurb: "La Marginal, la baie, la forteresse, la Baixa.",
				Admin: Admin{Type: "commune", Parent: "Ville de Luanda", Mairie: "mairie-luanda-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueluanda)},
				Places: []Place{
					townHall("luanda-centre", "Gouvernement provincial de Luanda", "Province de Luanda", -8.82899, 13.22917, srcAfriqueluanda),
					afrAt("luanda-sao-miguel", "Forteresse de São Miguel", "culture", -8.80776, 13.2232, "La forteresse portugaise au-dessus de la baie ; position d'après OpenStreetMap."),
					afrAt("luanda-neto", "Mausolée d'Agostinho Neto", "culture", -8.826, 13.218, "Le mémorial du premier président ; position d'après OpenStreetMap."),
					afrAt("luanda-ilha", "Ilha de Luanda", "beach", -8.77673, 13.24698, "La presqu'île des plages et des restaurants ; position d'après OpenStreetMap."),
					afrAt("luanda-aeroport", "Aéroport international Quatro-de-Fevereiro", "aeroport", -8.86141, 13.22876, "L'aéroport de Luanda ; position d'après OpenStreetMap."),
					fictional("luanda-gare-routiere", "Gare routière de Luanda", "transport", "Centre", -8.82576, 13.23971),
					fictional("luanda-muamba", "Restaurant La Muamba de Galinha", "restaurant", "Centre", -8.83316, 13.24507),
					fictional("luanda-club", "Club Kuduro", "club", "Centre", -8.8253, 13.24621),
				}},
		},
	},
	{
		ID: "maputo", Name: "Maputo", Country: "mz", Zoom: 11.8, Lat: -25.96621, Lng: 32.56745,
		Blurb: "La capitale du Mozambique, sur sa baie : la gare aux allures de palais, la cathédrale blanche, le marché central, la Costa do Sol.",
		Admin: CityAdmin{Type: "ville", Region: "Ville de Maputo", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquemaputo, srcOSM)},
		Communes: []Commune{
			{ID: "maputo-centre", Name: "Maputo centre", Lat: -25.96621, Lng: 32.56745, Blurb: "La Baixa, la gare, le marché central, la cathédrale.",
				Admin: Admin{Type: "commune", Parent: "Ville de Maputo", Mairie: "mairie-maputo-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquemaputo)},
				Places: []Place{
					townHall("maputo-centre", "Hôtel de ville de Maputo", "Conselho Municipal de Maputo", -25.96804, 32.57381, srcAfriquemaputo),
					afrAt("maputo-gare", "Gare centrale de Maputo", "transport", -25.90256, 32.59267, "La gare et son dôme de métal ; position d'après OpenStreetMap."),
					afrAt("maputo-cathedrale", "Cathédrale Notre-Dame-de-l'Immaculée-Conception", "worship", -25.96892, 32.57447, "La cathédrale blanche de Maputo ; position d'après OpenStreetMap.").withFaith("catholique"),
					afrAt("maputo-marche", "Marché central de Maputo", "market", -25.972, 32.572, "Le marché central ; position d'après OpenStreetMap."),
					afrAt("maputo-aeroport", "Aéroport international de Maputo", "aeroport", -25.90636, 32.58265, "L'aéroport de Maputo ; position d'après OpenStreetMap."),
					fictional("maputo-gare-routiere", "Gare routière de Junta", "transport", "Centre", -25.96471, 32.56321),
					fictional("maputo-peri", "Restaurant Le Frango à la Zambeziana", "restaurant", "Centre", -25.97211, 32.56857),
					fictional("maputo-plage", "Plage de la Costa do Sol", "beach", "Centre", -25.96424, 32.56971),
				}},
		},
	},
	{
		ID: "lusaka", Name: "Lusaka", Country: "zm", Zoom: 11.8, Lat: -15.41634, Lng: 28.28184,
		Blurb: "La capitale de la Zambie : Cairo Road, le marché de Kamwala, le musée national, la cathédrale anglicane.",
		Admin: CityAdmin{Type: "ville", Region: "Province de Lusaka", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquelusaka, srcOSM)},
		Communes: []Commune{
			{ID: "lusaka-centre", Name: "Lusaka centre", Lat: -15.41634, Lng: 28.28184, Blurb: "Cairo Road, le centre, les marchés.",
				Admin: Admin{Type: "commune", Parent: "Ville de Lusaka", Mairie: "mairie-lusaka-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquelusaka)},
				Places: []Place{
					townHall("lusaka-centre", "Hôtel de ville de Lusaka", "Lusaka City Council", -15.42101, 28.30105, srcAfriquelusaka),
					afrAt("lusaka-cairo-road", "Cairo Road", "rue", -15.42346, 28.28273, "La grande rue commerçante de Lusaka ; position d'après OpenStreetMap."),
					afrAt("lusaka-musee", "Musée national de Lusaka", "culture", -15.42189, 28.29133, "Le musée national ; position d'après OpenStreetMap."),
					afrAt("lusaka-aeroport", "Aéroport international Kenneth-Kaunda", "aeroport", -15.3302, 28.4532, "L'aéroport de Lusaka ; position d'après OpenStreetMap."),
					afrAt("lusaka-gare-routiere", "Gare routière intercity de Lusaka", "transport", -15.417, 28.281, "La gare des cars de Lusaka ; position d'après OpenStreetMap."),
					fictional("lusaka-nshima", "Restaurant La Nshima", "restaurant", "Centre", -15.41483, 28.2776),
					fictional("lusaka-marche", "Marché de Soweto (Lusaka)", "market", "Centre", -15.42223, 28.28296),
				}},
		},
	},
	{
		ID: "harare", Name: "Harare", Country: "zw", Zoom: 11.8, Lat: -17.83177, Lng: 31.04569,
		Blurb: "La capitale du Zimbabwe, aux jacarandas mauves en octobre : les jardins de Harare, le marché de Mbare, la galerie nationale.",
		Admin: CityAdmin{Type: "ville", Region: "Province de Harare", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriqueharare, srcOSM)},
		Communes: []Commune{
			{ID: "harare-centre", Name: "Harare centre", Lat: -17.83177, Lng: 31.04569, Blurb: "Le centre, les jardins, la place de l'Unité africaine.",
				Admin: Admin{Type: "commune", Parent: "Ville de Harare", Mairie: "mairie-harare-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriqueharare)},
				Places: []Place{
					townHall("harare-centre", "Hôtel de ville de Harare", "City of Harare", -17.83191, 31.04611, srcAfriqueharare),
					afrAt("harare-jardins", "Jardins de Harare", "nature", -17.82406, 31.04676, "Le grand parc du centre ; position d'après OpenStreetMap."),
					afrAt("harare-galerie", "Galerie nationale du Zimbabwe", "culture", -17.8249, 31.04896, "La galerie nationale et ses sculptures de pierre shona ; position d'après OpenStreetMap."),
					afrAt("harare-aeroport", "Aéroport international Robert-Gabriel-Mugabe", "aeroport", -17.93326, 31.09071, "L'aéroport de Harare ; position d'après OpenStreetMap."),
					afrAt("harare-gare-routiere", "Gare routière de Mbare Musika", "transport", -17.85938, 31.03756, "La gare des cars de Harare ; position d'après OpenStreetMap."),
					fictional("harare-sadza", "Restaurant Le Sadza", "restaurant", "Centre", -17.83027, 31.04145),
					fictional("harare-marche", "Marché de Mbare", "market", "Mbare", -17.83767, 31.04681),
				}},
		},
	},
	{
		ID: "victoria-falls", Name: "Victoria Falls", Country: "zw", Zoom: 12.4, Lat: -17.93495, Lng: 25.82528,
		Blurb: "La ville des chutes Victoria, « la fumée qui gronde », sur le Zambèze, face à la Zambie.",
		Admin: CityAdmin{Type: "ville", Region: "Matabeleland Nord", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquevictoria_falls, srcOSM)},
		Communes: []Commune{
			{ID: "victoria-falls-centre", Name: "Victoria Falls centre", Lat: -17.93495, Lng: 25.82528, Blurb: "La petite ville, les chutes, le pont sur le Zambèze.",
				Admin: Admin{Type: "commune", Parent: "Ville de Victoria Falls", Mairie: "mairie-victoria-falls-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquevictoria_falls)},
				Places: []Place{
					{ID: "mairie-victoria-falls-centre", Name: "Conseil municipal de Victoria Falls", Kind: "mairie", Lat: -17.93375, Lng: 25.82438, Real: true, Approx: true, Operator: "Victoria Falls Municipality", Source: game.Partial("La mairie ; position approximative.", srcAfriquevictoria_falls)},
					afrAt("victoria-falls-chutes", "Chutes Victoria", "nature", -17.93495, 25.82528, "Les grandes chutes du Zambèze ; position d'après OpenStreetMap."),
					afrAt("victoria-falls-pont", "Pont des chutes Victoria", "rue", -17.92829, 25.85715, "Le pont de fer entre le Zimbabwe et la Zambie ; position d'après OpenStreetMap."),
					afrAt("victoria-falls-aeroport", "Aéroport international de Victoria Falls", "aeroport", -18.0969, 25.84199, "L'aéroport de Victoria Falls ; position d'après OpenStreetMap."),
					fictional("victoria-falls-gare-routiere", "Gare routière de Victoria Falls", "transport", "Centre", -17.93344, 25.82104),
					fictional("victoria-falls-resto", "Restaurant Le Zambèze", "restaurant", "Centre", -17.94084, 25.8264),
					fictional("victoria-falls-marche", "Marché d'artisanat", "market", "Centre", -17.93297, 25.82754),
				}},
		},
	},
	{
		ID: "windhoek", Name: "Windhoek", Country: "na", Zoom: 11.8, Lat: -22.57761, Lng: 17.07727,
		Blurb: "La capitale de la Namibie, sur les hauts plateaux : l'église du Christ, le musée de l'Indépendance, le marché de Katutura.",
		Admin: CityAdmin{Type: "ville", Region: "Khomas", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquewindhoek, srcOSM)},
		Communes: []Commune{
			{ID: "windhoek-centre", Name: "Windhoek centre", Lat: -22.57761, Lng: 17.07727, Blurb: "Le centre, l'église du Christ, le musée de l'Indépendance.",
				Admin: Admin{Type: "commune", Parent: "Ville de Windhoek", Mairie: "mairie-windhoek-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquewindhoek)},
				Places: []Place{
					townHall("windhoek-centre", "Hôtel de ville de Windhoek", "City of Windhoek", -22.61156, 17.11054, srcAfriquewindhoek),
					afrAt("windhoek-christuskirche", "Église du Christ", "worship", -22.56775, 17.08732, "L'église luthérienne du centre ; position d'après OpenStreetMap.").withFaith("protestant"),
					afrAt("windhoek-independance", "Musée de l'Indépendance", "culture", -22.56872, 17.088, "Le musée de l'Indépendance ; position d'après OpenStreetMap."),
					afrAt("windhoek-aeroport", "Aéroport international Hosea-Kutako", "aeroport", -22.4822, 17.47205, "L'aéroport de Windhoek ; position d'après OpenStreetMap."),
					fictional("windhoek-gare-routiere", "Gare routière de Windhoek", "transport", "Centre", -22.5761, 17.07303),
					fictional("windhoek-kapana", "Kapana du marché Single Quarters", "restaurant", "Katutura", -22.58351, 17.07839),
					fictional("windhoek-marche", "Marché de Katutura", "market", "Katutura", -22.57564, 17.07954),
				}},
		},
	},
	{
		ID: "gaborone", Name: "Gaborone", Country: "bw", Zoom: 11.8, Lat: -24.65814, Lng: 25.90885,
		Blurb: "La capitale du Botswana : le monument des Trois Dikgosi, le Main Mall, le Kgale Hill.",
		Admin: CityAdmin{Type: "ville", Region: "District du Sud-Est", Source: game.Partial("Ville de son pays ; positions d'après OpenStreetMap (Nominatim et Photon, 26 novembre 2026).", srcAfriquegaborone, srcOSM)},
		Communes: []Commune{
			{ID: "gaborone-centre", Name: "Gaborone centre", Lat: -24.65814, Lng: 25.90885, Blurb: "Le Main Mall, le monument des Trois Dikgosi, le Parlement.",
				Admin: Admin{Type: "commune", Parent: "Ville de Gaborone", Mairie: "mairie-gaborone-centre", Source: game.Partial("Quartier ou commune de la ville ; position d'après OpenStreetMap.", srcAfriquegaborone)},
				Places: []Place{
					townHall("gaborone-centre", "Hôtel de ville de Gaborone", "Gaborone City Council", -24.65802, 25.91961, srcAfriquegaborone),
					afrAt("gaborone-dikgosi", "Monument des Trois Dikgosi", "culture", -24.64489, 25.90738, "Les statues des trois chefs à l'origine du Botswana ; position d'après OpenStreetMap."),
					afrAt("gaborone-kgale", "Kgale Hill", "nature", -24.69588, 25.86709, "La colline au-dessus de la ville ; position d'après OpenStreetMap."),
					afrAt("gaborone-aeroport", "Aéroport international Sir-Seretse-Khama", "aeroport", -24.55339, 25.92497, "L'aéroport de Gaborone ; position d'après OpenStreetMap."),
					fictional("gaborone-gare-routiere", "Gare routière de Gaborone", "transport", "Centre", -24.65663, 25.90461),
					fictional("gaborone-seswaa", "Restaurant Le Seswaa", "restaurant", "Centre", -24.66403, 25.90997),
					fictional("gaborone-marche", "Marché de Gaborone", "market", "Centre", -24.65616, 25.91111),
				}},
		},
	},
}
