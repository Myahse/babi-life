package world

import "github.com/myahse/babi-life/backend/internal/game"

// L'espace on Earth (the update « espace », game/espace.go Spaceports): the four towns the rockets leave from,
// each with its spaceport's commune (the pad, the visitor centre), hidden while « espace » is closed
// (features.go). Sassandra is the hub, Côte d'Ivoire's, its spaceport invented for the game (it launches south,
// over the Gulf of Guinea); Kourou (Guyane), Cap Canaveral (Florida) and Baïkonour (Kazakhstan) are real
// launch towns, with their region's update too (« pays-ameriques », « pays-usa », « pays-asie »). Their pads
// are the agency's own, invented: no real launcher, agency or company named. The towns' real places are
// positioned from OpenStreetMap (Nominatim, 27 November 2026) where it found them, else where they are known
// to be (Approx); the maquis, hotels and clubs are the game's.

const (
	srcSassandra  = "https://fr.wikipedia.org/wiki/Sassandra"
	srcKourou     = "https://fr.wikipedia.org/wiki/Kourou"
	srcCocoaBeach = "https://en.wikipedia.org/wiki/Cocoa_Beach,_Florida"
	srcTitusville = "https://en.wikipedia.org/wiki/Titusville,_Florida"
	srcBaikonour  = "https://fr.wikipedia.org/wiki/Ba%C3%AFkonour"
)

// spaceInvented: the agency's places on Earth, the game's own.
var spaceInvented = &game.Source{Status: game.StatusFictional, Note: "Installation de l'agence spatiale du jeu (Astrélia), inventée ; aucune agence, aucun lanceur ni aucune entreprise réels."}

// spaceAdmin: the spaceport's own « mairie », its direction (invented).
func spaceAdmin(communeID, name string, lat, lng float64) Place {
	return Place{ID: "mairie-" + communeID, Name: name, Kind: "mairie", Lat: lat, Lng: lng, Operator: game.Agency, Source: spaceInvented}
}

// spaceZone: a spaceport's commune: a real stretch of land, its installations the game's.
func spaceZone(note, src string) *game.Source { return game.Partial(note, src) }

func spaceAt(id, name, kind string, lat, lng float64) Place {
	return Place{ID: id, Name: name, Kind: kind, Lat: lat, Lng: lng, Approx: true, Operator: game.Agency, Source: spaceInvented}
}

// realApprox: a real place whose position is where it is known to be, to survey.
func realApprox(id, name, kind string, lat, lng float64, note, src string) Place {
	return Place{ID: id, Name: name, Kind: kind, Lat: lat, Lng: lng, Real: true, Approx: true, Source: game.Partial(note, src)}
}

// spatioports: the four towns, added to Cities (pays.go).
var spatioports = []City{
	/* ---------- Sassandra (Côte d'Ivoire) ---------- */
	{
		ID: "sassandra", Name: "Sassandra", Zoom: 12.5, Lat: 4.94900, Lng: -6.09217,
		Blurb: "La petite ville de pêcheurs au bord du golfe de Guinée, l'embouchure du fleuve Sassandra, et le spatioport d'Astrélia d'où les fusées Calao partent vers le sud, au-dessus de la mer.",
		Admin: CityAdmin{Type: "commune", Region: "Gbôklé, Bas-Sassandra", Source: game.Verified("Chef-lieu du département de Sassandra, dans la région du Gbôklé.", srcSassandra)},
		Communes: []Commune{
			{ID: "sassandra-centre", Name: "Sassandra centre", Lat: 4.94900, Lng: -6.09217, Blurb: "Le vieux quartier de Batélébré, la plage, les pirogues des pêcheurs et la baie.",
				Admin: Admin{Type: "commune", Parent: "Département de Sassandra", Mairie: "mairie-sassandra-centre", Source: game.Partial("La commune de Sassandra.", srcSassandra)},
				Places: []Place{
					townHall("sassandra-centre", "Mairie de Sassandra", "Commune de Sassandra", 4.94521, -6.09580, srcSassandra),
					osmAt("sassandra-aeroport", "Aérodrome de Sassandra", "aeroport", "", 4.93031, -6.13043, "Le petit aérodrome de Sassandra, à l'ouest de la ville."),
					osmAt("sassandra-batelebre", "Batélébré", "rue", "Batélébré", 4.94492, -6.09119, "Le vieux quartier de Sassandra, au-dessus de la baie."),
					realApprox("sassandra-plage", "Plage de Sassandra", "beach", 4.94300, -6.08550, "La plage de la baie de Sassandra, où les pêcheurs tirent leurs pirogues.", srcSassandra),
					realApprox("sassandra-embouchure", "Embouchure du fleuve Sassandra", "nature", 4.95700, -6.08000, "Le fleuve Sassandra se jette dans le golfe de Guinée à la ville.", srcSassandra),
					fictional("sassandra-gare", "Gare routière de Sassandra", "transport", "", 4.95250, -6.09000),
					fictional("sassandra-maquis", "Maquis La Baie", "maquis", "Batélébré", 4.94650, -6.08800),
					fictional("sassandra-hotel", "Hôtel Les Cocotiers", "hotel", "", 4.94200, -6.09300),
					fictional("sassandra-club", "Le Compte à rebours", "club", "", 4.95050, -6.09550),
				}},
			{ID: "sassandra-spatioport", Name: "Spatioport Astrélia", Lat: 4.98500, Lng: -6.05000, Blurb: "Le pas de tir de la Calao, sa tour, le centre des visiteurs et le centre d'entraînement des astronautes d'Astrélia.",
				Admin: Admin{Type: "zone spatiale", Parent: "Département de Sassandra", Mairie: "mairie-sassandra-spatioport", Source: spaceZone("La côte à l'est de Sassandra ; le spatioport y est inventé pour le jeu.", srcSassandra)},
				Places: []Place{
					spaceAdmin("sassandra-spatioport", "Direction du spatioport Astrélia", 4.98350, -6.05300),
					spaceAt("sassandra-pas-de-tir", "Pas de tir Calao de Sassandra", game.SpatioportKind, 4.98800, -6.04700),
					spaceAt("sassandra-visiteurs", "Centre des visiteurs Astrélia", "culture", 4.98200, -6.05500),
					spaceAt(game.EntrainementID, "Centre d'entraînement Astrélia", game.EntrainementKind, 4.98450, -6.05650),
					spaceAt("sassandra-plage-lancements", "La plage des lancements", "nature", 4.97900, -6.04400),
				}},
		},
	},
	/* ---------- Kourou (Guyane) ---------- */
	{
		ID: "kourou", Name: "Kourou", Country: "gf", Zoom: 12, Lat: 5.15798, Lng: -52.64242,
		Blurb: "La ville des fusées de Guyane, au bord de l'Atlantique, face aux îles du Salut : l'ensemble de lancement Calao d'Astrélia y est voisin du Centre spatial guyanais.",
		Admin: CityAdmin{Type: "commune", Region: "Guyane", Source: game.Verified("Commune de Guyane, ville du Centre spatial guyanais.", srcKourou)},
		Communes: []Commune{
			{ID: "kourou-centre", Name: "Kourou centre", Lat: 5.15798, Lng: -52.64242, Blurb: "Le Vieux Bourg, la plage, l'avenue des Roches et la vue sur les îles du Salut.",
				Admin: Admin{Type: "commune", Parent: "Collectivité territoriale de Guyane", Mairie: "mairie-kourou-centre", Source: game.Partial("La commune de Kourou.", srcKourou)},
				Places: []Place{
					townHall("kourou-centre", "Hôtel de ville de Kourou", "Commune de Kourou", 5.15809, -52.64186, srcKourou),
					// Kourou has no airport of its own: the game's air terminal, its shuttles to Cayenne-Félix-Éboué.
					fictional("kourou-aeroport", "Terminal aérien de Kourou (navettes vers Cayenne-Félix-Éboué)", "aeroport", "", 5.16150, -52.64900),
					osmAt("kourou-iles-salut", "Îles du Salut", "nature", "", 5.28702, -52.58956, "L'île Royale, l'île Saint-Joseph et l'île du Diable, au large de Kourou."),
					realApprox("kourou-vieux-bourg", "Vieux Bourg de Kourou", "rue", 5.15100, -52.63900, "Le vieux quartier de Kourou, au bord du fleuve.", srcKourou),
					realApprox("kourou-plage", "Plage de Kourou", "beach", 5.16500, -52.63300, "La plage de Kourou, sur l'Atlantique.", srcKourou),
					fictional("kourou-snack", "Snack du Vieux Bourg", "restaurant", "Vieux Bourg", 5.15250, -52.63750),
					fictional("kourou-hotel", "Hôtel Comète", "hotel", "", 5.16000, -52.64500),
					fictional("kourou-club", "Club Orbite", "club", "", 5.15600, -52.64700),
				}},
			{ID: "kourou-spatioport", Name: "Ensemble de lancement Calao", Lat: 5.23000, Lng: -52.73000, Blurb: "Le pas de tir d'Astrélia en Guyane, dans la savane entre Kourou et Sinnamary.",
				Admin: Admin{Type: "zone spatiale", Parent: "Commune de Kourou", Mairie: "mairie-kourou-spatioport", Source: spaceZone("La savane au nord-ouest de Kourou ; l'ensemble de lancement Calao y est inventé pour le jeu.", srcKourou)},
				Places: []Place{
					spaceAdmin("kourou-spatioport", "Direction de l'ensemble de lancement Calao", 5.22800, -52.72800),
					spaceAt("kourou-pas-de-tir", "Pas de tir Calao de Kourou", game.SpatioportKind, 5.25500, -52.78500),
					spaceAt("kourou-visiteurs", "Centre des visiteurs Astrélia de Kourou", "culture", 5.22500, -52.73500),
				}},
		},
	},
	/* ---------- Cap Canaveral (Floride) ---------- */
	{
		ID: "cap-canaveral", Name: "Cap Canaveral", Country: "us", Zoom: 11, Lat: 28.39200, Lng: -80.60770,
		Blurb: "La « Space Coast » de Floride : Cocoa Beach et sa jetée, Merritt Island, les plages de Playalinda, et le pas de tir Calao d'Astrélia au bout du cap.",
		Admin: CityAdmin{Type: "ville", Region: "Comté de Brevard, Floride", Source: game.Verified("La côte de l'espace, comté de Brevard.", srcCocoaBeach)},
		Communes: []Commune{
			{ID: "canaveral-cocoa", Name: "Cocoa Beach", Lat: 28.31841, Lng: -80.60950, Blurb: "La ville des surfeurs : la jetée, les motels, les diners et les fusées qui passent au-dessus de la plage.",
				Admin: Admin{Type: "ville", Parent: "Comté de Brevard", Mairie: "mairie-canaveral-cocoa", Source: game.Partial("Cocoa Beach, sur l'île-barrière.", srcCocoaBeach)},
				Places: []Place{
					townHall("canaveral-cocoa", "Hôtel de ville de Cocoa Beach", "Ville de Cocoa Beach", 28.31759, -80.61022, srcCocoaBeach),
					osmAt("canaveral-jetee", "Jetée de Cocoa Beach", "beach", "", 28.36775, -80.60180, "La grande jetée de Cocoa Beach, sur l'Atlantique."),
					fictional("canaveral-diner", "Diner Compte à rebours", "restaurant", "", 28.32300, -80.60850),
					fictional("canaveral-motel", "Motel Orbite", "hotel", "", 28.31200, -80.60700),
					fictional("canaveral-club", "Club Apogée", "club", "", 28.32700, -80.60900),
				}},
			{ID: "canaveral-titusville", Name: "Titusville", Lat: 28.61220, Lng: -80.80760, Blurb: "La ville au bord de l'Indian River, son aéroport régional et la route des plages de Playalinda.",
				Admin: Admin{Type: "ville", Parent: "Comté de Brevard", Mairie: "mairie-canaveral-titusville", Source: game.Partial("Titusville, sur l'Indian River.", srcTitusville)},
				Places: []Place{
					{ID: "mairie-canaveral-titusville", Name: "Hôtel de ville de Titusville", Kind: "mairie", Lat: 28.61100, Lng: -80.80900, Real: true, Approx: true, Operator: "Ville de Titusville", Source: game.Partial("L'hôtel de ville de Titusville ; position à relever.", srcTitusville)},
					osmAt("canaveral-aeroport", "Aéroport régional de la Space Coast", "aeroport", "", 28.51421, -80.79901, "L'aéroport régional de Titusville."),
					osmAt("canaveral-playalinda", "Plage de Playalinda", "beach", "", 28.67732, -80.64722, "La longue plage sauvage au nord du cap."),
					fictional("titusville-diner", "Indian River Diner", "restaurant", "", 28.61500, -80.80500),
				}},
			{ID: "canaveral-merritt", Name: "Le cap", Lat: 28.45000, Lng: -80.62000, Blurb: "Merritt Island et le bout du cap : le pas de tir Calao d'Astrélia et son centre des visiteurs.",
				Admin: Admin{Type: "zone spatiale", Parent: "Comté de Brevard", Mairie: "mairie-canaveral-merritt", Source: spaceZone("Merritt Island et le cap Canaveral ; le pas de tir Calao y est inventé pour le jeu.", srcCocoaBeach)},
				Places: []Place{
					spaceAdmin("canaveral-merritt", "Direction du pas de tir Calao", 28.44800, -80.62500),
					spaceAt("canaveral-pas-de-tir", "Pas de tir Calao de Canaveral", game.SpatioportKind, 28.49000, -80.57500),
					spaceAt("canaveral-visiteurs", "Centre des visiteurs Astrélia de Floride", "culture", 28.42000, -80.66000),
				}},
		},
	},
	/* ---------- Baïkonour (Kazakhstan) ---------- */
	{
		ID: "baikonour", Name: "Baïkonour", Country: "kz", Zoom: 12, Lat: 45.63220, Lng: 63.32092,
		Blurb: "La ville de la steppe kazakhe au bord du Syr-Daria, née avec son cosmodrome : c'est d'ici que Youri Gagarine est parti en 1961, premier homme dans l'espace.",
		Admin: CityAdmin{Type: "ville", Region: "Oblys de Kyzylorda", Source: game.Verified("Ville de la steppe du Kazakhstan, au bord du Syr-Daria.", srcBaikonour)},
		Communes: []Commune{
			{ID: "baikonour-centre", Name: "Baïkonour centre", Lat: 45.63220, Lng: 63.32092, Blurb: "Les avenues, les immeubles, les fusées en monument sur les places, et les rives du Syr-Daria.",
				Admin: Admin{Type: "ville", Parent: "Oblys de Kyzylorda", Mairie: "mairie-baikonour-centre", Source: game.Partial("La ville de Baïkonour.", srcBaikonour)},
				Places: []Place{
					{ID: "mairie-baikonour-centre", Name: "Administration de la ville de Baïkonour", Kind: "mairie", Lat: 45.62500, Lng: 63.31100, Real: true, Approx: true, Operator: "Ville de Baïkonour", Source: game.Partial("L'administration de la ville ; position à relever.", srcBaikonour)},
					osmAt("baikonour-aeroport", "Aéroport de Baïkonour (Krayniy)", "aeroport", "", 45.62122, 63.21455, "L'aéroport de la ville, à l'ouest."),
					realApprox("baikonour-syr-daria", "Rives du Syr-Daria", "nature", 45.61500, 63.29500, "Le fleuve qui longe la ville, au sud.", srcBaikonour),
					fictional("baikonour-cafe", "Café de la Steppe", "restaurant", "", 45.63000, 63.31800),
					fictional("baikonour-hotel", "Hôtel Étoile de la steppe", "hotel", "", 45.63400, 63.32400),
					fictional("baikonour-club", "Club Apogée", "club", "", 45.62800, 63.32600),
				}},
			{ID: "baikonour-steppe", Name: "Le cosmodrome", Lat: 45.92000, Lng: 63.34000, Blurb: "La steppe à perte de vue, le musée de l'histoire du cosmodrome et le pas de tir Calao d'Astrélia.",
				Admin: Admin{Type: "zone spatiale", Parent: "Ville de Baïkonour", Mairie: "mairie-baikonour-steppe", Source: spaceZone("La steppe du cosmodrome, au nord de la ville ; le pas de tir Calao y est inventé pour le jeu.", srcBaikonour)},
				Places: []Place{
					spaceAdmin("baikonour-steppe", "Direction du pas de tir Calao des steppes", 45.91800, 63.34500),
					osmAt("baikonour-musee", "Musée de l'histoire du cosmodrome", "culture", "", 45.90950, 63.31747, "Le musée raconte l'histoire du cosmodrome, d'où Youri Gagarine est parti le 12 avril 1961."),
					spaceAt("baikonour-pas-de-tir", "Pas de tir Calao de Baïkonour", game.SpatioportKind, 45.95000, 63.42000),
				}},
		},
	},
}

// SpaceportCommunes: the spaceports' communes and the agency's places on Earth (the update « espace » hides
// them, features.go): the whole of Sassandra, the three others' spaceport communes, the siège at the Plateau.
func SpaceportCommunes() []string {
	out := []string{game.AstreliaSiegeID}
	for _, c := range spatioports {
		for _, cm := range c.Communes {
			if c.ID == "sassandra" || cm.ID == game.Spaceports[c.ID].Commune {
				out = append(out, cm.ID)
			}
		}
	}
	return out
}

func init() {
	// The agency's siège, at the Plateau (Abidjan): its own place, the mission control's one day.
	for i, c := range Cities {
		if c.ID != "abidjan" {
			continue
		}
		for j, cm := range c.Communes {
			if cm.ID == "plateau" {
				Cities[i].Communes[j].Places = append(Cities[i].Communes[j].Places, Place{ID: game.AstreliaSiegeID, Name: game.AgencySiege, Kind: game.SiegeKind, Lat: 5.32650, Lng: -4.02080, Approx: true, Operator: game.Agency, Source: spaceInvented})
			}
		}
	}
}
