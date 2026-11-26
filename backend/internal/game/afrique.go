package game

// L'Afrique (the update « pays-afrique », world/afrique.go): the airports of its cities (Air Lagune flies to
// each, priced on the distance), their gares routières and the companies of their coaches (game names, like
// every brand of the game), and what's done there, each tied to its place (Interaction.Places). Prices in
// francs as the game's money, in line with the real thing (a thiéboudiène in Dakar, a plate of jollof in Lagos,
// the entry to the pyramids' plateau); hours as the places keep them.

// AfriqueKey: the update that opens the continent.
const AfriqueKey = "pays-afrique"

// The coach companies of Africa (invented names): one a region (afriqueRegion).
var afriqueCompanies = map[string]CoachCompany{
	"ouest":  {ID: "corridor", Name: "Corridor Côtier Express", Body: "#fdf6e3", Stripe: "#e8590c"},
	"centre": {ID: "equateur", Name: "Équateur Cars", Body: "#e6f4ea", Stripe: "#2b8a3e"},
	"nord":   {ID: "atlas", Name: "Atlas Voyageurs", Body: "#fff4e6", Stripe: "#c92a2a"},
	"est":    {ID: "grandslacs", Name: "Grands Lacs Express", Body: "#e7f5ff", Stripe: "#1864ab"},
	"sud":    {ID: "zambeze", Name: "Zambèze Coaches", Body: "#f8f0fc", Stripe: "#5f3dc4"},
}

// afriqueCoach: who runs a coach line with one end in Africa beyond Côte d'Ivoire (coaches.go CoachCompanyOf):
// the region's company of that end.
func afriqueCoach(a, b string) (CoachCompany, bool) {
	for _, id := range []string{a, b} {
		if r, ok := afriqueRegion[id]; ok {
			return afriqueCompanies[r], true
		}
	}
	return CoachCompany{}, false
}

func init() {
	for id, a := range afriqueAirports {
		a.Key = AfriqueKey
		Airports[id] = a
	}
	for id, g := range afriqueGares {
		Gares[id] = g
	}
	for _, r := range []string{"ouest", "centre", "nord", "est", "sud"} {
		CoachCompanies = append(CoachCompanies, afriqueCompanies[r])
	}
	addActs(AfriqueActs)
	villeActs[AfriqueKey] = AfriqueActs
}

// AfriqueActs: the continent's, city by city.
var AfriqueActs = map[string][]Interaction{
	"restaurant": {
		// Sénégal
		{ID: "sn-thieboudiene", Label: "Manger un thiéboudiène autour du grand plat", Icon: "cooking-pot", Minutes: 45, Cost: 2000, Effect: Needs{Hunger: 70, Social: 20}, MinHour: 12, MaxHour: 16, Places: []string{"dakar-thieb", "nouakchott-resto"}},
		{ID: "sn-dibiterie", Label: "Manger la dibi (agneau grillé) à la dibiterie", Icon: "drumstick", Minutes: 40, Cost: 3000, Effect: Needs{Hunger: 65, Social: 15}, MinHour: 18, MaxHour: 24, Places: []string{"dakar-dibiterie", "dakar-dibiterie-pikine"}},
		{ID: "sn-yassa", Label: "Manger un poulet yassa", Icon: "utensils", Minutes: 35, Cost: 2500, Effect: Needs{Hunger: 60, Fun: 5}, MinHour: 11, MaxHour: 23, Places: []string{"dakar-grillades", "saint-louis-resto", "saint-louis-grillade", "banjul-resto"}},
		// Mali, Guinée, Niger, Mauritanie
		{ID: "ml-to-feuilles", Label: "Manger un tô sauce feuilles", Icon: "cooking-pot", Minutes: 35, Cost: 700, Effect: Needs{Hunger: 60, Social: 10}, MinHour: 11, MaxHour: 22, Places: []string{"bamako-to", "sikasso-resto", "kankan-resto"}},
		{ID: "ml-capitaine", Label: "Manger un capitaine grillé du Niger", Icon: "fish", Minutes: 45, Cost: 5000, Effect: Needs{Hunger: 70, Fun: 10, Social: 10}, MinHour: 12, MaxHour: 23, Places: []string{"bamako-maquis", "bamako-brochettes"}},
		{ID: "gn-riz-feuille", Label: "Manger un riz sauce feuille", Icon: "utensils", Minutes: 30, Cost: 1500, Effect: Needs{Hunger: 60, Social: 5}, MinHour: 11, MaxHour: 22, Places: []string{"conakry-resto", "conakry-resto-matoto"}},
		{ID: "ne-kilichi", Label: "Goûter le kilichi (viande séchée) et le fura", Icon: "drumstick", Minutes: 25, Cost: 1500, Effect: Needs{Hunger: 45, Fun: 10}, MinHour: 10, MaxHour: 22, Places: []string{"niamey-resto", "agadez-the"}},
		// Ghana, Nigeria, Liberia, Sierra Leone
		{ID: "gh-fufu", Label: "Manger un fufu light soup au chop bar", Icon: "soup", Minutes: 40, Cost: 2000, Effect: Needs{Hunger: 70, Social: 15}, MinHour: 11, MaxHour: 22, Places: []string{"accra-chopbar", "kumasi-chopbar"}},
		{ID: "gh-waakye", Label: "Prendre un waakye au petit matin", Icon: "utensils", Minutes: 25, Cost: 1000, Effect: Needs{Hunger: 55}, MinHour: 6, MaxHour: 12, Places: []string{"accra-waakye"}},
		{ID: "gh-kelewele", Label: "Grignoter du kelewele (plantain épicé)", Icon: "flame", Minutes: 15, Cost: 500, Effect: Needs{Hunger: 25, Fun: 10}, MinHour: 16, MaxHour: 24, Places: []string{"accra-kelewele"}},
		{ID: "ng-jollof", Label: "Manger un jollof rice avec du poulet", Icon: "cooking-pot", Minutes: 30, Cost: 2500, Effect: Needs{Hunger: 65, Fun: 10}, MinHour: 11, MaxHour: 23, Places: []string{"lagos-buka", "lagos-amala", "abuja-suya", "kano-resto"}},
		{ID: "ng-suya", Label: "Manger des brochettes de suya", Icon: "drumstick", Minutes: 20, Cost: 1500, Effect: Needs{Hunger: 40, Fun: 15, Social: 10}, MinHour: 17, MaxHour: 24, Places: []string{"lagos-suya", "abuja-suya"}},
		{ID: "ng-amala", Label: "Manger un amala ewedu", Icon: "soup", Minutes: 30, Cost: 1500, Effect: Needs{Hunger: 60, Social: 10}, MinHour: 11, MaxHour: 21, Places: []string{"lagos-amala", "lagos-buka"}},
		{ID: "lr-cookshop", Label: "Manger un riz sauce palava au cookshop", Icon: "utensils", Minutes: 30, Cost: 1500, Effect: Needs{Hunger: 60, Social: 10}, MinHour: 11, MaxHour: 21, Places: []string{"monrovia-cookshop", "buchanan-cookshop", "freetown-cookery", "bo-cookery"}},
		// Cap-Vert, Guinée-Bissau
		{ID: "cv-cachupa", Label: "Manger une cachupa", Icon: "soup", Minutes: 35, Cost: 3000, Effect: Needs{Hunger: 65, Social: 10}, MinHour: 7, MaxHour: 22, Places: []string{"praia-cachupa", "mindelo-peixe", "bissau-resto", "bubaque-resto"}},
		// Afrique centrale
		{ID: "cm-ndole", Label: "Manger un ndolè aux crevettes et miondo", Icon: "cooking-pot", Minutes: 40, Cost: 3000, Effect: Needs{Hunger: 70, Social: 10}, MinHour: 11, MaxHour: 22, Places: []string{"yaounde-resto", "douala-resto"}},
		{ID: "cm-poisson-braise", Label: "Manger un poisson braisé et du bâton de manioc", Icon: "fish", Minutes: 40, Cost: 3500, Effect: Needs{Hunger: 65, Fun: 10, Social: 10}, MinHour: 17, MaxHour: 24, Places: []string{"douala-resto", "libreville-resto", "port-gentil-resto", "malabo-resto", "bata-resto", "pointe-noire-resto"}},
		{ID: "cd-liboke", Label: "Manger un liboké de poisson et du fufu", Icon: "fish", Minutes: 40, Cost: 3000, Effect: Needs{Hunger: 65, Social: 15}, MinHour: 11, MaxHour: 23, Places: []string{"kinshasa-nganda", "brazzaville-resto", "lubumbashi-resto", "bangui-resto"}},
		{ID: "td-boule", Label: "Manger la boule de mil sauce gombo", Icon: "cooking-pot", Minutes: 30, Cost: 1000, Effect: Needs{Hunger: 60, Social: 10}, MinHour: 11, MaxHour: 22, Places: []string{"ndjamena-resto", "khartoum-ful"}},
		// Afrique du Nord
		{ID: "ma-tajine", Label: "Manger un tajine et boire un thé à la menthe", Icon: "cooking-pot", Minutes: 50, Cost: 6000, Effect: Needs{Hunger: 70, Fun: 15, Social: 10}, MinHour: 12, MaxHour: 23, Places: []string{"rabat-resto", "casablanca-resto", "marrakech-resto"}},
		{ID: "ma-couscous-vendredi", Label: "Manger le couscous du vendredi", Icon: "utensils", Minutes: 50, Cost: 5000, Effect: Needs{Hunger: 75, Social: 25}, MinHour: 12, MaxHour: 16, Days: []int{Vendredi}, Places: []string{"rabat-resto", "casablanca-resto", "alger-resto", "tunis-resto"}},
		{ID: "eg-koshari", Label: "Manger un koshari", Icon: "utensils", Minutes: 20, Cost: 1500, Effect: Needs{Hunger: 60}, MinHour: 9, MaxHour: 24, Places: []string{"le-caire-koshari", "alexandrie-poisson"}},
		{ID: "ly-bazin", Label: "Goûter le bazin et la chorba", Icon: "soup", Minutes: 40, Cost: 4000, Effect: Needs{Hunger: 65, Social: 15}, MinHour: 12, MaxHour: 22, Places: []string{"tripoli-resto", "oran-resto"}},
		// Afrique de l'Est
		{ID: "et-injera", Label: "Partager une injera et ses wot à la main", Icon: "utensils", Minutes: 45, Cost: 3500, Effect: Needs{Hunger: 70, Social: 25}, MinHour: 11, MaxHour: 23, Places: []string{"addis-abeba-injera"}},
		{ID: "ke-nyama-choma", Label: "Manger un nyama choma avec l'ugali", Icon: "drumstick", Minutes: 50, Cost: 5000, Effect: Needs{Hunger: 75, Social: 20, Fun: 10}, MinHour: 12, MaxHour: 23, Places: []string{"nairobi-nyama", "mombasa-resto"}},
		{ID: "tz-chipsi-mayai", Label: "Manger un chipsi mayai (omelette-frites)", Icon: "egg", Minutes: 20, Cost: 1500, Effect: Needs{Hunger: 50, Fun: 5}, MinHour: 11, MaxHour: 23, Places: []string{"dar-es-salaam-resto", "zanzibar-resto"}},
		{ID: "ug-rolex", Label: "Manger un rolex (chapati roulé à l'omelette)", Icon: "egg", Minutes: 15, Cost: 800, Effect: Needs{Hunger: 45}, MinHour: 6, MaxHour: 24, Places: []string{"kampala-rolex"}},
		{ID: "rw-brochettes", Label: "Manger des brochettes de chèvre et des frites", Icon: "drumstick", Minutes: 35, Cost: 2500, Effect: Needs{Hunger: 55, Social: 20}, MinHour: 17, MaxHour: 24, Places: []string{"kigali-brochettes"}},
		{ID: "mg-romazava", Label: "Manger un romazava et son riz", Icon: "soup", Minutes: 30, Cost: 1500, Effect: Needs{Hunger: 60, Social: 5}, MinHour: 11, MaxHour: 22, Places: []string{"antananarivo-romazava"}},
		// Afrique australe
		{ID: "za-braai", Label: "Un braai au shisa nyama : viande grillée et pap", Icon: "flame", Minutes: 60, Cost: 6000, Effect: Needs{Hunger: 75, Social: 30, Fun: 15}, MinHour: 12, MaxHour: 23, Places: []string{"johannesburg-braai"}},
		{ID: "za-kota", Label: "Manger un kota (pain farci) au coin de la rue", Icon: "sandwich", Minutes: 15, Cost: 2000, Effect: Needs{Hunger: 50, Fun: 5}, MinHour: 9, MaxHour: 23, Places: []string{"johannesburg-kota"}},
		{ID: "za-bobotie", Label: "Manger un bobotie du Cap malais", Icon: "utensils", Minutes: 40, Cost: 7000, Effect: Needs{Hunger: 65, Fun: 10}, MinHour: 12, MaxHour: 22, Places: []string{"le-cap-resto"}},
		{ID: "zm-nshima", Label: "Manger la nshima (sadza, pap) avec la sauce", Icon: "cooking-pot", Minutes: 30, Cost: 1500, Effect: Needs{Hunger: 60, Social: 10}, MinHour: 11, MaxHour: 21, Places: []string{"lusaka-nshima", "harare-sadza", "gaborone-seswaa", "windhoek-kapana", "victoria-falls-resto"}},
		{ID: "ao-muamba", Label: "Manger une muamba de galinha", Icon: "drumstick", Minutes: 40, Cost: 5000, Effect: Needs{Hunger: 70, Social: 10}, MinHour: 12, MaxHour: 22, Places: []string{"luanda-muamba", "maputo-peri"}},
	},
	"maquis": {
		{ID: "tg-fufu", Label: "Manger un foufou pilé sauce arachide", Icon: "cooking-pot", Minutes: 40, Cost: 1500, Effect: Needs{Hunger: 70, Social: 15}, MinHour: 11, MaxHour: 22, Places: []string{"lome-maquis", "lome-akoume", "kara-maquis"}},
		{ID: "tg-akoume", Label: "Manger une pâte (akoumé) sauce gombo", Icon: "utensils", Minutes: 30, Cost: 800, Effect: Needs{Hunger: 60, Social: 10}, MinHour: 11, MaxHour: 22, Places: []string{"lome-akoume", "cotonou-maquis", "cotonou-maquis-porto", "parakou-maquis"}},
		{ID: "bj-wagashi", Label: "Goûter le wagashi (fromage peul) frit", Icon: "utensils", Minutes: 20, Cost: 1000, Effect: Needs{Hunger: 35, Fun: 10}, MinHour: 11, MaxHour: 22, Places: []string{"parakou-maquis", "cotonou-maquis"}},
		{ID: "tg-tchoukoutou", Ages: Adults, Label: "Boire le tchoukoutou (bière de mil) entre amis", Icon: "beer", Minutes: 45, Cost: 300, Effect: Needs{Social: 30, Fun: 20, Energy: -5}, MinHour: 15, MaxHour: 23, Places: []string{"kara-maquis", "parakou-maquis"}},
	},
	"market": {
		{ID: "sn-sandaga", Label: "Marchander au marché Sandaga", Icon: "hand-coins", Minutes: 45, Cost: 2000, Effect: Needs{Fun: 20, Social: 25}, MinHour: 8, MaxHour: 19, Places: []string{"dakar-sandaga", "dakar-marche"}},
		{ID: "sn-soumbedioune", Label: "Voir rentrer les pirogues de Soumbédioune", Icon: "fish", Minutes: 40, Effect: Needs{Fun: 25, Social: 10}, MinHour: 16, MaxHour: 19, Places: []string{"dakar-soumbedioune", "saint-louis-poisson", "nouakchott-poisson"}},
		{ID: "gh-kente", Label: "Acheter un kente tissé", Icon: "shopping-bag", Minutes: 40, Cost: 25000, Effect: Needs{Fun: 30, Social: 10}, MinHour: 9, MaxHour: 18, Places: []string{"accra-arts", "kumasi-kejetia"}},
		{ID: "gh-makola", Label: "Se perdre dans le marché Makola", Icon: "shopping-basket", Minutes: 45, Cost: 1500, Effect: Needs{Fun: 20, Social: 25, Energy: -5}, MinHour: 7, MaxHour: 18, Places: []string{"accra-makola", "kumasi-kejetia"}},
		{ID: "tg-nana-benz", Label: "Acheter un pagne chez les Nana Benz du Grand marché", Icon: "shopping-bag", Minutes: 40, Cost: 12000, Effect: Needs{Fun: 25, Social: 15}, MinHour: 8, MaxHour: 18, Places: []string{"lome-grand-marche"}},
		{ID: "bj-dantokpa", Label: "Faire le tour du marché Dantokpa", Icon: "shopping-basket", Minutes: 60, Cost: 2000, Effect: Needs{Fun: 25, Social: 25, Energy: -10}, MinHour: 7, MaxHour: 19, Places: []string{"cotonou-dantokpa", "parakou-marche"}},
		{ID: "ng-balogun", Label: "Chiner des tissus au marché Balogun", Icon: "shopping-bag", Minutes: 50, Cost: 8000, Effect: Needs{Fun: 25, Social: 20, Energy: -5}, MinHour: 8, MaxHour: 18, Places: []string{"lagos-balogun", "kano-kurmi"}},
		{ID: "ng-computer-village", Label: "Chercher un téléphone à Computer Village", Icon: "smartphone", Minutes: 40, Cost: 3000, Effect: Needs{Fun: 20, Social: 15}, MinHour: 9, MaxHour: 18, Places: []string{"lagos-computer-village"}},
		{ID: "ml-grand-marche", Label: "Marchander au Grand marché", Icon: "hand-coins", Minutes: 45, Cost: 1500, Effect: Needs{Fun: 20, Social: 25}, MinHour: 7, MaxHour: 18, Places: []string{"bamako-grand-marche", "sikasso-marche", "niamey-grand-marche", "conakry-niger", "kankan-marche", "ndjamena-grand-marche", "kinshasa-grand-marche", "mogadiscio-bakaara", "djibouti-marche"}},
		{ID: "ma-souks", Label: "Flâner dans les souks", Icon: "shopping-bag", Minutes: 60, Cost: 5000, Effect: Needs{Fun: 35, Social: 15, Energy: -10}, MinHour: 9, MaxHour: 20, Places: []string{"marrakech-souks", "casablanca-medina", "le-caire-khan"}},
		{ID: "et-merkato", Label: "Se faufiler dans le Merkato", Icon: "shopping-basket", Minutes: 60, Cost: 2000, Effect: Needs{Fun: 25, Social: 20, Energy: -10}, MinHour: 8, MaxHour: 18, Places: []string{"addis-abeba-merkato", "kampala-owino", "kigali-kimironko", "dar-es-salaam-kariakoo", "antananarivo-analakely"}},
		{ID: "cm-mokolo", Label: "Marchander au marché Mokolo", Icon: "hand-coins", Minutes: 45, Cost: 2000, Effect: Needs{Fun: 20, Social: 25}, MinHour: 7, MaxHour: 18, Places: []string{"yaounde-mokolo", "libreville-mont-bouet", "brazzaville-marche", "bangui-marche", "lubumbashi-marche"}},
	},
	"culture": {
		{ID: "sn-renaissance", Label: "Monter au sommet du monument de la Renaissance africaine", Icon: "landmark", Minutes: 50, Cost: 3000, Effect: Needs{Fun: 40, Energy: -10}, MinHour: 9, MaxHour: 19, Places: []string{"dakar-renaissance"}},
		{ID: "sn-goree-memoire", Label: "Visiter la Maison des Esclaves et sa porte du voyage sans retour", Icon: "landmark", Minutes: 50, Cost: 2000, Effect: Needs{Fun: 10, Social: 15}, MinHour: 10, MaxHour: 18, Places: []string{"dakar-esclaves"}},
		{ID: "bj-non-retour", Label: "Suivre la Route des Esclaves jusqu'à la Porte du Non-Retour", Icon: "footprints", Minutes: 60, Cost: 1000, Effect: Needs{Fun: 10, Social: 15, Energy: -10}, MinHour: 8, MaxHour: 18, Places: []string{"cotonou-non-retour"}},
		{ID: "gh-nkrumah", Label: "Visiter le mausolée de Kwame Nkrumah", Icon: "landmark", Minutes: 45, Cost: 2000, Effect: Needs{Fun: 25, Social: 5}, MinHour: 9, MaxHour: 17, Places: []string{"accra-nkrumah"}},
		{ID: "gh-manhyia", Label: "Visiter le palais de l'Asantehene", Icon: "crown", Minutes: 50, Cost: 3000, Effect: Needs{Fun: 30, Social: 5}, MinHour: 9, MaxHour: 17, Days: Workweek, Places: []string{"kumasi-manhyia"}},
		{ID: "ng-freedom-park", Label: "Un concert le soir à Freedom Park", Icon: "music", Minutes: 2 * 60, Cost: 4000, Effect: Needs{Fun: 45, Social: 25, Energy: -10}, MinHour: 18, MaxHour: 23, Places: []string{"lagos-freedom-park"}},
		{ID: "ng-nike-art", Label: "Visiter les quatre étages de la galerie Nike", Icon: "palette", Minutes: 50, Effect: Needs{Fun: 30, Social: 5}, MinHour: 10, MaxHour: 18, Places: []string{"lagos-nike"}},
		{ID: "ml-musee", Label: "Visiter le musée national du Mali", Icon: "landmark", Minutes: 60, Cost: 2500, Effect: Needs{Fun: 30, Social: 5}, MinHour: 9, MaxHour: 17, Places: []string{"bamako-musee", "niamey-musee", "conakry-musee", "nouakchott-musee", "banjul-musee", "freetown-musee"}},
		{ID: "lr-providence", Label: "Se recueillir à Providence Island", Icon: "landmark", Minutes: 40, Cost: 1000, Effect: Needs{Fun: 15, Social: 10}, MinHour: 9, MaxHour: 17, Places: []string{"monrovia-providence"}},
		{ID: "cm-reunification", Label: "Visiter le monument de la Réunification", Icon: "landmark", Minutes: 40, Cost: 1000, Effect: Needs{Fun: 25, Social: 5}, MinHour: 8, MaxHour: 18, Places: []string{"yaounde-reunification", "douala-pagode", "brazzaville-memorial", "kinshasa-echangeur"}},
		{ID: "ma-hassan", Label: "Voir la tour Hassan et la relève de la garde du mausolée", Icon: "landmark", Minutes: 45, Effect: Needs{Fun: 30, Social: 5}, MinHour: 9, MaxHour: 18, Places: []string{"rabat-hassan", "rabat-mausolee"}},
		{ID: "ma-oudayas", Label: "Se perdre dans les ruelles bleues des Oudayas", Icon: "footprints", Minutes: 45, Effect: Needs{Fun: 30, Social: 10}, MinHour: 8, MaxHour: 20, Places: []string{"rabat-oudayas", "alger-casbah"}},
		{ID: "ma-bahia", Label: "Visiter le palais de la Bahia", Icon: "landmark", Minutes: 50, Cost: 2000, Effect: Needs{Fun: 35}, MinHour: 9, MaxHour: 17, Places: []string{"marrakech-bahia"}},
		{ID: "eg-pyramides", Label: "Marcher au pied des pyramides de Gizeh", Icon: "landmark", Minutes: 90, Cost: 8000, Effect: Needs{Fun: 55, Energy: -20, Hunger: -10}, MinHour: 7, MaxHour: 17, Places: []string{"gizeh-kheops"}},
		{ID: "eg-sphinx", Label: "Se prendre en photo face au Sphinx", Icon: "camera", Minutes: 20, Effect: Needs{Fun: 30, Social: 10}, MinHour: 7, MaxHour: 17, Places: []string{"gizeh-sphinx"}},
		{ID: "eg-son-lumiere", Label: "Le spectacle son et lumière des pyramides", Icon: "sparkles", Minutes: 60, Cost: 9000, Effect: Needs{Fun: 50, Social: 10}, MinHour: 18, MaxHour: 22, Places: []string{"gizeh-sphinx"}},
		{ID: "eg-musee", Label: "Voir les trésors de Toutânkhamon", Icon: "landmark", Minutes: 90, Cost: 9000, Effect: Needs{Fun: 45, Energy: -10}, MinHour: 9, MaxHour: 18, Places: []string{"gizeh-gem", "le-caire-musee"}},
		{ID: "eg-bibliotheque", Label: "Lire sous le grand toit de la bibliothèque d'Alexandrie", Icon: "book-open", Minutes: 60, Cost: 1500, Effect: Needs{Fun: 25, Energy: -5}, MinHour: 10, MaxHour: 19, Places: []string{"alexandrie-bibliotheque", "tunis-bardo", "tripoli-saraya"}},
		{ID: "et-lucy", Label: "Voir Lucy au musée national", Icon: "landmark", Minutes: 50, Cost: 1000, Effect: Needs{Fun: 30, Social: 5}, MinHour: 9, MaxHour: 17, Places: []string{"addis-abeba-musee", "dar-es-salaam-musee", "khartoum-musee"}},
		{ID: "rw-memorial", Label: "Se recueillir au mémorial du génocide", Icon: "flower", Minutes: 60, Effect: Needs{Social: 10}, MinHour: 8, MaxHour: 17, Places: []string{"kigali-memorial"}},
		{ID: "za-soweto", Label: "Visiter la maison de Mandela à Soweto", Icon: "house", Minutes: 50, Cost: 5000, Effect: Needs{Fun: 30, Social: 10}, MinHour: 9, MaxHour: 17, Places: []string{"johannesburg-mandela"}},
		{ID: "za-apartheid", Label: "Visiter le musée de l'Apartheid", Icon: "landmark", Minutes: 90, Cost: 5000, Effect: Needs{Fun: 15, Social: 10, Energy: -10}, MinHour: 9, MaxHour: 17, Places: []string{"johannesburg-apartheid", "johannesburg-constitution"}},
		{ID: "za-robben", Label: "Prendre le bateau pour Robben Island", Icon: "ship", Minutes: 3 * 60, Cost: 15000, Effect: Needs{Fun: 30, Social: 10, Energy: -15}, MinHour: 9, MaxHour: 15, Places: []string{"le-cap-robben"}},
		{ID: "mg-rova", Label: "Monter au palais de la Reine", Icon: "crown", Minutes: 50, Cost: 2000, Effect: Needs{Fun: 30, Energy: -10}, MinHour: 9, MaxHour: 17, Places: []string{"antananarivo-rova"}},
		{ID: "tz-stone-town", Label: "Admirer les portes sculptées de Stone Town", Icon: "door-open", Minutes: 45, Effect: Needs{Fun: 30, Social: 5}, MinHour: 8, MaxHour: 19, Places: []string{"zanzibar-merveilles"}},
		{ID: "ke-fort-jesus", Label: "Visiter Fort Jesus", Icon: "castle", Minutes: 50, Cost: 3000, Effect: Needs{Fun: 30}, MinHour: 8, MaxHour: 18, Places: []string{"mombasa-fort-jesus", "bissau-fortaleza", "praia-fort", "luanda-sao-miguel", "oran-santa-cruz", "le-caire-tour"}},
	},
	"worship": {
		{ID: "sn-divinite-visite", Label: "Visiter la mosquée de la Divinité au bord de l'océan", Icon: "landmark", Minutes: 30, Effect: Needs{Fun: 20, Social: 10}, MinHour: 9, MaxHour: 18, Places: []string{"dakar-divinite"}},
		{ID: "ma-hassan2-visite", Label: "Visiter la mosquée Hassan-II", Icon: "landmark", Minutes: 60, Cost: 8000, Effect: Needs{Fun: 40, Social: 10}, MinHour: 9, MaxHour: 16, Places: []string{"casablanca-hassan2"}},
		{ID: "ng-mosquee-nationale", Label: "Admirer les coupoles dorées de la mosquée nationale", Icon: "landmark", Minutes: 30, Effect: Needs{Fun: 20, Social: 5}, MinHour: 9, MaxHour: 17, Places: []string{"abuja-mosquee", "conakry-mosquee", "cotonou-mosquee", "agadez-mosquee", "kampala-mosquee"}},
		{ID: "ci-basilique-visite", Label: "Visiter la basilique et ses vitraux", Icon: "church", Minutes: 30, Effect: Needs{Fun: 20, Social: 5}, MinHour: 8, MaxHour: 18, Places: []string{"yaounde-mvolye", "brazzaville-sainte-anne", "alger-notre-dame", "cotonou-basilique", "cotonou-cathedrale", "saint-louis-cathedrale", "addis-abeba-trinite"}},
	},
	"nature": {
		{ID: "lekki-canopee", Label: "Marcher sur la passerelle dans les arbres de Lekki", Icon: "trees", Minutes: 60, Cost: 3000, Effect: Needs{Fun: 40, Energy: -15}, MinHour: 8, MaxHour: 17, Places: []string{"lagos-conservation"}},
		{ID: "ng-aso-rock", Label: "Regarder le soleil se coucher sur Aso Rock", Icon: "mountain", Minutes: 40, Effect: Needs{Fun: 25, Social: 5}, MinHour: 17, MaxHour: 19, Places: []string{"abuja-aso-rock", "abuja-millennium"}},
		{ID: "gm-crocodiles", Label: "Voir les crocodiles sacrés de Kachikally", Icon: "eye", Minutes: 40, Cost: 2000, Effect: Needs{Fun: 35}, MinHour: 9, MaxHour: 18, Places: []string{"banjul-crocodiles"}},
		{ID: "ke-safari-ville", Label: "Un safari au parc national, les tours de la ville au fond", Icon: "binoculars", Minutes: 3 * 60, Cost: 30000, Effect: Needs{Fun: 60, Social: 10, Energy: -15}, MinHour: 6, MaxHour: 18, Places: []string{"nairobi-parc"}},
		{ID: "za-table-mountain", Label: "Monter à la montagne de la Table en téléphérique", Icon: "mountain", Minutes: 90, Cost: 20000, Effect: Needs{Fun: 55, Energy: -10}, MinHour: 8, MaxHour: 19, Places: []string{"le-cap-table"}},
		{ID: "zw-chutes", Label: "Se faire tremper par l'embrun des chutes Victoria", Icon: "waves", Minutes: 90, Cost: 25000, Effect: Needs{Fun: 60, Hygiene: -10, Energy: -10}, MinHour: 6, MaxHour: 18, Places: []string{"victoria-falls-chutes"}},
		{ID: "ma-majorelle", Label: "Se promener dans le jardin Majorelle", Icon: "flower-2", Minutes: 45, Cost: 10000, Effect: Needs{Fun: 35}, MinHour: 8, MaxHour: 18, Places: []string{"marrakech-majorelle"}},
		{ID: "eg-chameau", Label: "Faire le tour du plateau à dos de chameau", Icon: "footprints", Minutes: 60, Cost: 10000, Effect: Needs{Fun: 45, Energy: -10}, MinHour: 7, MaxHour: 17, Places: []string{"gizeh-chameaux"}},
		{ID: "eg-felouque", Label: "Une felouque sur le Nil au coucher du soleil", Icon: "sailboat", Minutes: 60, Cost: 6000, Effect: Needs{Fun: 45, Social: 15}, MinHour: 16, MaxHour: 21, Places: []string{"le-caire-felouque"}},
		{ID: "sd-confluent", Label: "Regarder les deux Nils se rejoindre", Icon: "waves", Minutes: 30, Effect: Needs{Fun: 25}, MinHour: 7, MaxHour: 19, Places: []string{"khartoum-mogran"}},
		{ID: "tz-epices", Label: "Visiter une ferme aux épices", Icon: "leaf", Minutes: 90, Cost: 8000, Effect: Needs{Fun: 35, Hunger: 10}, MinHour: 9, MaxHour: 16, Places: []string{"zanzibar-epices"}},
		{ID: "ke-boutre", Label: "Une balade en boutre au coucher du soleil", Icon: "sailboat", Minutes: 90, Cost: 15000, Effect: Needs{Fun: 50, Social: 15}, MinHour: 16, MaxHour: 20, Places: []string{"mombasa-dhow"}},
		{ID: "mg-anosy", Label: "Faire le tour du lac Anosy sous les jacarandas", Icon: "trees", Minutes: 40, Effect: Needs{Fun: 25, Social: 5}, MinHour: 7, MaxHour: 19, Places: []string{"antananarivo-anosy", "harare-jardins", "gaborone-kgale"}},
	},
	"beach": {
		{ID: "sn-surf", Label: "Une session de surf aux Almadies", Icon: "waves", Minutes: 90, Cost: 8000, Effect: Needs{Fun: 50, Energy: -25, Hygiene: -10}, MinHour: 7, MaxHour: 18, Places: []string{"dakar-ngor", "le-cap-plage"}},
		{ID: "gh-labadi", Label: "Danser sur le sable de Labadi le dimanche", Icon: "music", Minutes: 90, Cost: 1000, Effect: Needs{Fun: 45, Social: 30, Energy: -15}, MinHour: 13, MaxHour: 21, Days: []int{Dimanche}, Places: []string{"accra-labadi", "lagos-plage", "lome-plage", "cotonou-fidjrosse"}},
		{ID: "cv-plage", Label: "Se baigner dans l'eau claire de l'Atlantique", Icon: "waves", Minutes: 60, Effect: Needs{Fun: 40, Hygiene: -5, Energy: -10}, MinHour: 8, MaxHour: 19, Places: []string{"praia-quebra-canela", "mindelo-laginha", "bubaque-plage", "zanzibar-plage", "mombasa-nyali", "luanda-ilha", "maputo-plage"}},
	},
	"rue": {
		{ID: "ma-jemaa-soir", Label: "Le soir sur la place Jemaa el-Fna : conteurs, musiciens et stands", Icon: "sparkles", Minutes: 90, Cost: 3000, Effect: Needs{Fun: 55, Social: 30, Hunger: 25}, MinHour: 18, MaxHour: 24, Places: []string{"marrakech-jemaa"}},
		{ID: "gh-black-star", Label: "Passer sous la porte de l'Étoile noire", Icon: "star", Minutes: 25, Effect: Needs{Fun: 25, Social: 5}, MinHour: 7, MaxHour: 20, Places: []string{"accra-independance"}},
		{ID: "gh-oxford-street", Label: "Sortir le soir sur Oxford Street", Icon: "footprints", Minutes: 60, Cost: 2000, Effect: Needs{Fun: 35, Social: 25}, MinHour: 17, MaxHour: 24, Places: []string{"accra-oxford"}},
		{ID: "sn-pont-faidherbe", Label: "Traverser le pont Faidherbe au coucher du soleil", Icon: "footprints", Minutes: 30, Effect: Needs{Fun: 25, Social: 5}, MinHour: 17, MaxHour: 20, Places: []string{"saint-louis-pont"}},
		{ID: "za-bokaap", Label: "Se photographier devant les maisons colorées de Bo-Kaap", Icon: "camera", Minutes: 30, Effect: Needs{Fun: 30, Social: 10}, MinHour: 8, MaxHour: 19, Places: []string{"le-cap-bokaap", "le-cap-waterfront"}},
		{ID: "tz-forodhani", Label: "Le marché du soir des jardins de Forodhani", Icon: "drumstick", Minutes: 60, Cost: 3000, Effect: Needs{Hunger: 45, Fun: 30, Social: 20}, MinHour: 18, MaxHour: 23, Places: []string{"zanzibar-forodhani"}},
		{ID: "et-meskel", Label: "Flâner sur la place Meskel", Icon: "footprints", Minutes: 30, Effect: Needs{Fun: 15, Social: 15}, MinHour: 7, MaxHour: 20, Places: []string{"addis-abeba-meskel", "le-caire-tahrir", "tunis-bourguiba", "casablanca-place", "kinshasa-trente-juin", "lusaka-cairo-road", "djibouti-menelik", "tripoli-martyrs"}},
	},
	"club": {
		{ID: "ng-shrine", Ages: Adults, Label: "Une nuit d'afrobeat au Shrine", Icon: "music", Minutes: 3 * 60, Cost: 5000, Effect: Needs{Fun: 55, Social: 35, Energy: -30}, MinHour: 21, MaxHour: 5, Places: []string{"lagos-shrine", "lagos-club", "abuja-club"}},
		{ID: "sn-mbalax", Ages: Adults, Label: "Danser le mbalax jusqu'au matin", Icon: "music", Minutes: 2 * 60, Cost: 5000, Effect: Needs{Fun: 50, Social: 30, Energy: -25}, MinHour: 23, MaxHour: 5, Places: []string{"dakar-club", "saint-louis-jazz", "banjul-club"}},
		{ID: "gh-highlife", Ages: Adults, Label: "Danser sur du highlife et de l'azonto", Icon: "music", Minutes: 2 * 60, Cost: 3000, Effect: Needs{Fun: 50, Social: 30, Energy: -25}, MinHour: 21, MaxHour: 4, Places: []string{"accra-club", "kumasi-club", "lome-club", "cotonou-club", "freetown-club", "monrovia-club"}},
		{ID: "cv-morna", Ages: Adults, Label: "Écouter la morna, un verre à la main", Icon: "music", Minutes: 90, Cost: 4000, Effect: Needs{Fun: 40, Social: 25, Energy: -10}, MinHour: 20, MaxHour: 2, Places: []string{"praia-morna", "mindelo-morna", "bissau-club"}},
		{ID: "cd-rumba", Ages: Adults, Label: "Danser la rumba et le ndombolo", Icon: "music", Minutes: 2 * 60, Cost: 3000, Effect: Needs{Fun: 50, Social: 30, Energy: -25}, MinHour: 21, MaxHour: 4, Places: []string{"kinshasa-club", "brazzaville-club", "yaounde-club", "douala-club", "libreville-club", "luanda-club"}},
		{ID: "za-amapiano", Ages: Adults, Label: "Danser sur l'amapiano", Icon: "music", Minutes: 2 * 60, Cost: 5000, Effect: Needs{Fun: 50, Social: 30, Energy: -25}, MinHour: 21, MaxHour: 4, Places: []string{"johannesburg-club", "nairobi-club", "dar-es-salaam-club", "kampala-club", "addis-abeba-club"}},
		{ID: "ml-djembe", Ages: Adults, Label: "Écouter les griots et la kora", Icon: "music", Minutes: 2 * 60, Cost: 3000, Effect: Needs{Fun: 45, Social: 30, Energy: -15}, MinHour: 20, MaxHour: 3, Places: []string{"bamako-club", "conakry-club", "niamey-club", "oran-rai", "casablanca-club"}},
	},
	"grin": {
		{ID: "sn-ataya", Label: "Les trois thés (ataya) avec les amis", Icon: "coffee", Minutes: 60, Cost: 300, Effect: Needs{Social: 35, Fun: 15}, MinHour: 14, MaxHour: 24, Places: []string{"bamako-grin", "conakry-grin", "niamey-grin", "agadez-the", "nouakchott-the", "lome-grin", "ndjamena-the", "mogadiscio-the"}},
		{ID: "et-buna", Label: "La cérémonie du café en trois tasses", Icon: "coffee", Minutes: 60, Cost: 500, Effect: Needs{Social: 35, Fun: 15, Energy: 10}, MinHour: 8, MaxHour: 20, Places: []string{"addis-abeba-cafe"}},
		{ID: "ma-cafe-maure", Label: "Un thé à la menthe au café, à regarder passer la ville", Icon: "coffee", Minutes: 45, Cost: 800, Effect: Needs{Social: 25, Fun: 15}, MinHour: 8, MaxHour: 23, Places: []string{"rabat-cafe", "alger-cafe", "tunis-cafe", "le-caire-cafe", "alexandrie-cafe", "tripoli-cafe"}},
	},
	"sport": {
		{ID: "sn-lutte", Label: "Voir un combat de lutte sénégalaise à l'arène", Icon: "trophy", Minutes: 3 * 60, Cost: 5000, Effect: Needs{Fun: 55, Social: 35, Energy: -10}, MinHour: 15, MaxHour: 21, Days: []int{Dimanche}, Places: []string{"dakar-arene"}},
		{ID: "gn-syli", Label: "Voir le Syli national au stade du 28-Septembre", Icon: "trophy", Minutes: 2 * 60, Cost: 3000, Effect: Needs{Fun: 50, Social: 35, Energy: -10}, MinHour: 15, MaxHour: 21, Places: []string{"conakry-stade"}},
	},
	"boutique": {
		{ID: "ne-croix-agadez", Label: "Acheter une croix d'Agadez en argent", Icon: "gem", Minutes: 30, Cost: 10000, Effect: Needs{Fun: 25, Social: 10}, MinHour: 8, MaxHour: 18, Places: []string{"agadez-orfevre"}},
	},
	"couture": {
		{ID: "sn-grand-boubou", Label: "Se faire coudre un grand boubou brodé", Icon: "scissors", Minutes: 60, Cost: 25000, Effect: Needs{Fun: 30, Social: 15}, MinHour: 9, MaxHour: 19, Places: []string{"dakar-tailleur"}},
	},
	"salon": {
		{ID: "ma-hammam", Label: "Un hammam et un gommage au savon noir", Icon: "droplets", Minutes: 75, Cost: 4000, Effect: Needs{Hygiene: 60, Fun: 20, Energy: 10}, MinHour: 8, MaxHour: 22, Places: []string{"rabat-hammam", "marrakech-hammam", "tunis-hammam"}},
	},
}
