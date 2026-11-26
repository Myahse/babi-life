package game

// Le Moyen-Orient (world/moyenOrient.go): the update that opens it, its airports (Air Lagune flies to each, priced
// on the distance: flights.go), its gares routières and its coach companies (invented names, like every brand of
// the game), and what's done in its cities, each tied to its place, behind the update (features.go). The holy
// cities' Omra and Hajj are done simply, with dignity: the tawaf and the sa'i, the day at Arafat, the night at
// Mina. Prices in francs as the game's money, in line with the real thing; hours as the places keep them.

// MoyenOrientKey: the closed update « pays-moyen-orient ».
const MoyenOrientKey = "pays-moyen-orient"

// The coach companies of the Middle East (invented names): the Gulf's and the Levant's and Iran's.
var moCoaches = []CoachCompany{
	{ID: "caravane", Name: "Caravane du Golfe", Body: "#fff8e1", Stripe: "#b08900"},
	{ID: "levant", Name: "Levant Express", Body: "#eef6ff", Stripe: "#1971c2"},
	{ID: "simorgh", Name: "Simorgh Lignes", Body: "#e6fcf5", Stripe: "#0b7285"},
}

// moCoach: who runs the coaches of a city of the region (coaches.go CoachCompanyOf, by RegionCoach).
func moCoach(city string) CoachCompany {
	switch city {
	case "teheran", "ispahan":
		return moCoaches[2]
	case "beyrouth", "damas", "amman", "petra", "jerusalem", "tel-aviv", "ramallah", "bethleem", "bagdad":
		return moCoaches[1]
	}
	return moCoaches[0]
}

func init() {
	for id, a := range map[string]Airport{
		"dubai": {"dubai", "dxb-deira", "dxb-aeroport", MoyenOrientKey},
		"abou-dhabi": {"abou-dhabi", "auh-zayed", "auh-aeroport", MoyenOrientKey},
		"riyad": {"riyad", "ryd-aeroport", "ryd-aeroport-kkia", MoyenOrientKey},
		"djeddah": {"djeddah", "jed-corniche", "jed-aeroport", MoyenOrientKey},
		"medine": {"medine", "medine-centre", "medine-aeroport", MoyenOrientKey},
		"doha": {"doha", "doha-centre", "doha-aeroport", MoyenOrientKey},
		"beyrouth": {"beyrouth", "bey-aeroport", "bey-aeroport-rhia", MoyenOrientKey},
		"tel-aviv": {"tel-aviv", "tlv-aeroport", "tlv-aeroport-bg", MoyenOrientKey},
		"amman": {"amman", "amman-aeroport", "amman-aeroport-qaia", MoyenOrientKey},
		"teheran": {"teheran", "teh-ika", "teh-aeroport", MoyenOrientKey},
		"ispahan": {"ispahan", "isf-centre", "isf-aeroport", MoyenOrientKey},
		"koweit": {"koweit", "koweit-centre", "koweit-aeroport", MoyenOrientKey},
		"manama": {"manama", "manama-centre", "manama-aeroport", MoyenOrientKey},
		"mascate": {"mascate", "mascate-centre", "mascate-aeroport", MoyenOrientKey},
		"bagdad": {"bagdad", "bagdad-centre", "bagdad-aeroport", MoyenOrientKey},
		"damas": {"damas", "damas-centre", "damas-aeroport", MoyenOrientKey},
		"sanaa": {"sanaa", "sanaa-centre", "sanaa-aeroport", MoyenOrientKey},
	} {
		Airports[id] = a
	}
	for id, g := range map[string]Gare{
		"dubai": {"dubai", "dxb-deira", "dxb-deira-gare"},
		"abou-dhabi": {"abou-dhabi", "auh-centre", "auh-centre-gare"},
		"riyad": {"riyad", "ryd-centre", "ryd-centre-gare"},
		"djeddah": {"djeddah", "jed-balad", "jed-balad-gare"},
		"la-mecque": {"la-mecque", "mecque-centre", "mecque-centre-gare"},
		"medine": {"medine", "medine-centre", "medine-centre-gare"},
		"doha": {"doha", "doha-centre", "doha-centre-gare"},
		"beyrouth": {"beyrouth", "bey-centre", "bey-centre-gare"},
		"jerusalem": {"jerusalem", "jlm-vieille-ville", "jlm-vieille-ville-gare"},
		"tel-aviv": {"tel-aviv", "tlv-centre", "tlv-centre-gare"},
		"amman": {"amman", "amman-centre", "amman-centre-gare"},
		"petra": {"petra", "petra-centre", "petra-centre-gare"},
		"teheran": {"teheran", "teh-centre", "teh-centre-gare"},
		"ispahan": {"ispahan", "isf-centre", "isf-centre-gare"},
		"koweit": {"koweit", "koweit-centre", "koweit-gare"},
		"manama": {"manama", "manama-centre", "manama-gare"},
		"mascate": {"mascate", "mascate-centre", "mascate-gare"},
		"bagdad": {"bagdad", "bagdad-centre", "bagdad-gare"},
		"damas": {"damas", "damas-centre", "damas-gare"},
		"sanaa": {"sanaa", "sanaa-centre", "sanaa-gare"},
		"ramallah": {"ramallah", "ramallah-centre", "ramallah-gare"},
		"bethleem": {"bethleem", "bethleem-centre", "bethleem-gare"},
	} {
		Gares[id] = g
		RegionCoach[id] = moCoach(id)
	}
	CoachCompanies = append(CoachCompanies, moCoaches...)
	addActs(MoyenOrientActs)
	villeActs[MoyenOrientKey] = MoyenOrientActs
}

// MoyenOrientActs: the cities' own, by kind, each tied to its place.
var MoyenOrientActs = map[string][]Interaction{
	"culture": {
		{ID: "mo-burj-khalifa", Label: "Monter au sommet de la Burj Khalifa", Icon: "building-2", Minutes: 75, Cost: 45000, Effect: Needs{Social: 10, Fun: 55, Energy: -5}, MinHour: 9, MaxHour: 23, Places: []string{"dxb-burj-khalifa"}},
		{ID: "mo-opera", Label: "Voir un spectacle à l'opéra de Dubaï", Icon: "music", Minutes: 120, Cost: 35000, Effect: Needs{Social: 15, Fun: 45, Energy: -5}, MinHour: 19, MaxHour: 23, Places: []string{"dxb-opera"}},
		{ID: "mo-musee-futur", Label: "Visiter le musée du Futur", Icon: "sparkles", Minutes: 75, Cost: 25000, Effect: Needs{Social: 5, Fun: 45, Energy: -5}, MinHour: 10, MaxHour: 21, Places: []string{"dxb-musee-futur"}},
		{ID: "mo-al-fahidi", Label: "Se promener entre les tours à vent d'Al Fahidi", Icon: "landmark", Minutes: 45, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 8, MaxHour: 22, Places: []string{"dxb-deira-al-fahidi"}},
		{ID: "mo-burj-al-arab", Label: "Se prendre en photo devant la Burj Al Arab", Icon: "camera", Minutes: 15, Effect: Needs{Social: 5, Fun: 25}, MinHour: 7, MaxHour: 22, Places: []string{"dxb-jumeirah-burj-al-arab"}},
		{ID: "mo-louvre-ad", Label: "Visiter le Louvre d'Abou Dhabi sous sa pluie de lumière", Icon: "landmark", Minutes: 90, Cost: 18000, Effect: Needs{Social: 5, Fun: 45, Energy: -5}, MinHour: 10, MaxHour: 20, Places: []string{"auh-louvre"}},
		{ID: "mo-qasr-al-watan", Label: "Visiter le palais Qasr al-Watan", Icon: "castle", Minutes: 75, Cost: 20000, Effect: Needs{Social: 5, Fun: 40, Energy: -5}, MinHour: 10, MaxHour: 19, Places: []string{"auh-qasr-al-watan"}},
		{ID: "mo-qasr-al-hosn", Label: "Visiter le vieux fort Qasr al-Hosn", Icon: "castle", Minutes: 45, Cost: 4000, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 9, MaxHour: 20, Places: []string{"auh-qasr-al-hosn"}},
		{ID: "mo-kingdom-centre", Label: "Traverser le pont du ciel du Kingdom Centre", Icon: "building-2", Minutes: 45, Cost: 15000, Effect: Needs{Social: 5, Fun: 45, Energy: -5}, MinHour: 10, MaxHour: 23, Places: []string{"ryd-kingdom-centre"}},
		{ID: "mo-masmak", Label: "Visiter le fort de Masmak", Icon: "castle", Minutes: 45, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 8, MaxHour: 21, Places: []string{"ryd-masmak"}},
		{ID: "mo-musee-riyad", Label: "Visiter le musée national", Icon: "landmark", Minutes: 75, Cost: 2500, Effect: Needs{Social: 5, Fun: 35, Energy: -5}, MinHour: 9, MaxHour: 20, Places: []string{"ryd-musee"}},
		{ID: "mo-turaif", Label: "Se promener dans les ruelles de terre d'At-Turaif", Icon: "landmark", Minutes: 75, Cost: 9000, Effect: Needs{Social: 5, Fun: 40, Energy: -5}, MinHour: 16, MaxHour: 23, Places: []string{"ryd-diriyah-turaif"}},
		{ID: "mo-nassif", Label: "Visiter la maison Nassif d'Al-Balad", Icon: "landmark", Minutes: 45, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 9, MaxHour: 22, Places: []string{"jed-balad-nassif"}},
		{ID: "mo-horloge", Label: "Regarder la tour de l'Horloge s'allumer", Icon: "clock", Minutes: 15, Effect: Needs{Social: 5, Fun: 20}, MinHour: 18, MaxHour: 24, Places: []string{"mecque-horloge"}},
		{ID: "mo-mia", Label: "Visiter le musée d'Art islamique", Icon: "landmark", Minutes: 90, Effect: Needs{Social: 5, Fun: 40, Energy: -5}, MinHour: 9, MaxHour: 19, Places: []string{"doha-mia"}},
		{ID: "mo-katara", Label: "Flâner à Katara entre l'amphithéâtre et les galeries", Icon: "landmark", Minutes: 60, Effect: Needs{Social: 10, Fun: 30, Energy: -5}, MinHour: 10, MaxHour: 23, Places: []string{"doha-katara"}},
		{ID: "mo-musee-bey", Label: "Visiter le musée national de Beyrouth", Icon: "landmark", Minutes: 75, Cost: 2000, Effect: Needs{Social: 5, Fun: 35, Energy: -5}, MinHour: 9, MaxHour: 17, Places: []string{"bey-musee"}},
		{ID: "mo-remparts", Label: "Faire le tour des remparts depuis la porte de Jaffa", Icon: "castle", Minutes: 75, Cost: 3500, Effect: Needs{Social: 5, Fun: 35, Energy: -15}, MinHour: 9, MaxHour: 17, Places: []string{"jlm-porte-jaffa"}},
		{ID: "mo-jaffa", Label: "Descendre les ruelles de Jaffa jusqu'au vieux port", Icon: "landmark", Minutes: 45, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 8, MaxHour: 23, Places: []string{"tlv-jaffa-horloge", "tlv-jaffa-port"}},
		{ID: "mo-musee-palestinien", Label: "Visiter le musée palestinien", Icon: "landmark", Minutes: 60, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 10, MaxHour: 18, Places: []string{"ramallah-musee"}},
		{ID: "mo-citadelle", Label: "Monter à la citadelle d'Amman", Icon: "castle", Minutes: 60, Cost: 1500, Effect: Needs{Social: 5, Fun: 35, Energy: -10}, MinHour: 8, MaxHour: 19, Places: []string{"amman-citadelle"}},
		{ID: "mo-theatre", Label: "S'asseoir sur les gradins du théâtre romain", Icon: "landmark", Minutes: 30, Cost: 1000, Effect: Needs{Social: 5, Fun: 25, Energy: -5}, MinHour: 8, MaxHour: 19, Places: []string{"amman-theatre"}},
		{ID: "mo-khazneh", Label: "Marcher dans le Siq jusqu'au Trésor de Pétra", Icon: "landmark", Minutes: 120, Cost: 55000, Effect: Needs{Social: 10, Fun: 55, Energy: -20}, MinHour: 6, MaxHour: 18, Places: []string{"petra-tresor", "petra-siq"}},
		{ID: "mo-monastere", Label: "Monter les 800 marches jusqu'au Monastère", Icon: "mountain", Minutes: 150, Effect: Needs{Social: 5, Fun: 45, Energy: -35}, MinHour: 6, MaxHour: 17, Places: []string{"petra-monastere"}},
		{ID: "mo-golestan", Label: "Visiter le palais du Golestan et sa salle des miroirs", Icon: "castle", Minutes: 75, Cost: 3000, Effect: Needs{Social: 5, Fun: 40, Energy: -5}, MinHour: 9, MaxHour: 17, Places: []string{"teh-golestan"}},
		{ID: "mo-azadi", Label: "Se prendre en photo sous la tour Azadi", Icon: "camera", Minutes: 20, Effect: Needs{Social: 5, Fun: 25}, MinHour: 6, MaxHour: 23, Places: []string{"teh-azadi-tour"}},
		{ID: "mo-milad", Label: "Monter à la tour Milad", Icon: "building-2", Minutes: 60, Cost: 6000, Effect: Needs{Social: 5, Fun: 40, Energy: -5}, MinHour: 9, MaxHour: 23, Places: []string{"teh-milad"}},
		{ID: "mo-ali-qapu", Label: "Monter à la terrasse du palais Ali Qapu", Icon: "castle", Minutes: 40, Cost: 2000, Effect: Needs{Social: 5, Fun: 35, Energy: -5}, MinHour: 9, MaxHour: 18, Places: []string{"isf-ali-qapu"}},
		{ID: "mo-tours-koweit", Label: "Monter dans la sphère des tours du Koweït", Icon: "building-2", Minutes: 45, Cost: 3000, Effect: Needs{Social: 5, Fun: 35, Energy: -5}, MinHour: 9, MaxHour: 23, Places: []string{"koweit-tours"}},
		{ID: "mo-fort-bahrein", Label: "Visiter le fort de Bahreïn au coucher du soleil", Icon: "castle", Minutes: 60, Effect: Needs{Social: 5, Fun: 35, Energy: -5}, MinHour: 8, MaxHour: 20, Places: []string{"manama-fort"}},
		{ID: "mo-opera-mascate", Label: "Écouter un concert à l'opéra royal", Icon: "music", Minutes: 120, Cost: 25000, Effect: Needs{Social: 15, Fun: 45}, MinHour: 19, MaxHour: 23, Places: []string{"mascate-opera"}},
		{ID: "mo-mustansiriya", Label: "Visiter l'école Al-Mustansiriya", Icon: "landmark", Minutes: 45, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 9, MaxHour: 17, Places: []string{"bagdad-mustansiriya"}},
		{ID: "mo-azem", Label: "Visiter le palais Azem", Icon: "castle", Minutes: 45, Cost: 1500, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 9, MaxHour: 17, Places: []string{"damas-azem"}},
		{ID: "mo-vieille-sanaa", Label: "Regarder les maisons-tours de la vieille Sanaa", Icon: "landmark", Minutes: 60, Effect: Needs{Social: 5, Fun: 40, Energy: -5}, MinHour: 7, MaxHour: 19, Places: []string{"sanaa-vieille-ville", "sanaa-bab"}},
	},
	"mall": {
		{ID: "mo-dubai-mall", Label: "Faire le tour du Dubai Mall et de son aquarium", Icon: "shopping-bag", Minutes: 90, Effect: Needs{Social: 15, Fun: 35, Energy: -10}, MinHour: 10, MaxHour: 24, Places: []string{"dxb-mall"}},
		{ID: "mo-patinoire", Label: "Patiner sur la glace au Dubai Mall", Icon: "snowflake", Minutes: 45, Cost: 9000, Effect: Needs{Social: 10, Fun: 40, Energy: -15}, MinHour: 10, MaxHour: 23, Places: []string{"dxb-mall"}},
	},
	"rue": {
		{ID: "mo-fontaine", Label: "Regarder la fontaine danser au pied de la tour", Icon: "waves", Minutes: 20, Effect: Needs{Social: 10, Fun: 35}, MinHour: 18, MaxHour: 23, Places: []string{"dxb-fontaine"}},
		{ID: "mo-fontaine-fahd", Label: "Regarder la fontaine du roi Fahd monter dans le ciel", Icon: "waves", Minutes: 20, Effect: Needs{Social: 10, Fun: 30}, MinHour: 17, MaxHour: 24, Places: []string{"jed-corniche-fontaine"}},
		{ID: "mo-dhow-doha", Label: "Faire un tour de boutre dans la baie", Icon: "sailboat", Minutes: 45, Cost: 5000, Effect: Needs{Social: 15, Fun: 35}, MinHour: 16, MaxHour: 23, Places: []string{"doha-corniche"}},
		{ID: "mo-corniche-bey", Label: "Marcher sur la corniche jusqu'aux rochers de Raouché", Icon: "waves", Minutes: 60, Effect: Needs{Social: 15, Fun: 30, Energy: -10}, MinHour: 6, MaxHour: 23, Places: []string{"bey-hamra-corniche", "bey-hamra-raouche"}},
		{ID: "mo-gemmayze", Label: "Prendre un café sur les marches de Gemmayzé", Icon: "coffee", Minutes: 40, Cost: 2000, Effect: Needs{Social: 25, Fun: 20}, MinHour: 8, MaxHour: 24, Places: []string{"bey-gemmayze"}},
		{ID: "mo-bauhaus", Label: "Se promener sous les arbres du boulevard Rothschild", Icon: "trees", Minutes: 40, Effect: Needs{Social: 10, Fun: 20, Energy: -5}, MinHour: 6, MaxHour: 24, Places: []string{"tlv-rothschild"}},
		{ID: "mo-naghsh", Label: "Faire le tour de la place Naghsh-e Jahan en calèche", Icon: "landmark", Minutes: 40, Cost: 3000, Effect: Needs{Social: 10, Fun: 40, Energy: -5}, MinHour: 8, MaxHour: 23, Places: []string{"isf-place"}},
		{ID: "mo-khaju-chant", Label: "Écouter chanter sous les arches du pont Khadju", Icon: "music", Minutes: 45, Effect: Needs{Social: 25, Fun: 35}, MinHour: 19, MaxHour: 24, Places: []string{"isf-khaju", "isf-si-o-se"}},
	},
	"market": {
		{ID: "mo-souk-or", Label: "Regarder les vitrines du souk de l'or", Icon: "gem", Minutes: 40, Effect: Needs{Social: 10, Fun: 25}, MinHour: 10, MaxHour: 22, Places: []string{"dxb-deira-souk-or"}},
		{ID: "mo-souk-epices", Label: "Sentir le safran et l'encens au souk des épices", Icon: "shopping-basket", Minutes: 30, Cost: 3000, Effect: Needs{Social: 15, Fun: 25}, MinHour: 9, MaxHour: 22, Places: []string{"dxb-deira-souk-epices"}},
		{ID: "mo-naif-gros", Label: "Acheter en gros au souk de Naïf pour la boutique au pays", Icon: "package", Minutes: 90, Cost: 50000, Effect: Needs{Social: 25, Fun: 20, Energy: -10}, MinHour: 9, MaxHour: 22, Places: []string{"dxb-deira-naif"}},
		{ID: "mo-batha", Label: "Faire les étals du souk de Batha", Icon: "shopping-bag", Minutes: 60, Effect: Needs{Social: 25, Fun: 25, Energy: -5}, MinHour: 9, MaxHour: 23, Places: []string{"ryd-batha"}},
		{ID: "mo-alawi", Label: "Flâner dans le souk d'Al-Alawi", Icon: "shopping-bag", Minutes: 45, Effect: Needs{Social: 20, Fun: 25}, MinHour: 9, MaxHour: 24, Places: []string{"jed-balad-souk"}},
		{ID: "mo-souq-waqif", Label: "Se promener le soir au souq Waqif", Icon: "shopping-bag", Minutes: 60, Effect: Needs{Social: 25, Fun: 30}, MinHour: 16, MaxHour: 24, Places: []string{"doha-souq-waqif"}},
		{ID: "mo-faucons", Label: "Voir les faucons et leur hôpital", Icon: "bird", Minutes: 30, Effect: Needs{Social: 10, Fun: 30}, MinHour: 9, MaxHour: 21, Places: []string{"doha-faucons"}},
		{ID: "mo-souk-jlm", Label: "Se perdre dans les souks de la vieille ville", Icon: "shopping-bag", Minutes: 60, Effect: Needs{Social: 20, Fun: 30, Energy: -5}, MinHour: 8, MaxHour: 20, Places: []string{"jlm-souk"}},
		{ID: "mo-carmel", Label: "Faire le marché du Carmel", Icon: "shopping-basket", Minutes: 45, Cost: 5000, Effect: Needs{Hunger: 10, Social: 20, Fun: 25}, MinHour: 8, MaxHour: 19, Days: Workweek, Places: []string{"tlv-carmel"}},
		{ID: "mo-bazar-teh", Label: "Se perdre dans le Grand Bazar de Téhéran", Icon: "shopping-bag", Minutes: 75, Effect: Needs{Social: 25, Fun: 30, Energy: -10}, MinHour: 9, MaxHour: 18, Days: Workweek, Places: []string{"teh-bazar"}},
		{ID: "mo-mubarakiya", Label: "Manger un poisson grillé au souk Al-Mubarakiya", Icon: "fish", Minutes: 45, Cost: 7000, Effect: Needs{Hunger: 60, Social: 20, Fun: 10}, MinHour: 10, MaxHour: 23, Places: []string{"koweit-mubarakiya"}},
		{ID: "mo-bab-bahrein", Label: "Passer Bab el-Bahreïn et faire le souk", Icon: "shopping-bag", Minutes: 60, Effect: Needs{Social: 20, Fun: 25}, MinHour: 9, MaxHour: 22, Places: []string{"manama-bab"}},
		{ID: "mo-mutrah", Label: "Acheter de l'encens au souk de Mutrah", Icon: "shopping-basket", Minutes: 45, Cost: 4000, Effect: Needs{Social: 20, Fun: 25}, MinHour: 9, MaxHour: 22, Places: []string{"mascate-mutrah"}},
		{ID: "mo-mutanabbi", Label: "Chercher des livres rue Al-Mutanabbi le vendredi", Icon: "book-open", Minutes: 60, Cost: 3000, Effect: Needs{Social: 25, Fun: 30}, MinHour: 8, MaxHour: 14, Places: []string{"bagdad-mutanabbi"}},
		{ID: "mo-hamidiyya", Label: "Remonter le souk Al-Hamidiyya", Icon: "shopping-bag", Minutes: 60, Effect: Needs{Social: 25, Fun: 30, Energy: -5}, MinHour: 9, MaxHour: 21, Places: []string{"damas-hamidiyya"}},
	},
	"transport": {
		{ID: "mo-abra", Label: "Traverser la Creek en abra pour un dirham", Icon: "sailboat", Minutes: 15, Cost: 300, Effect: Needs{Social: 10, Fun: 30}, MinHour: 6, MaxHour: 24, Places: []string{"dxb-deira-abra"}},
	},
	"boutique": {
		{ID: "mo-wax-dubai", Label: "Négocier du wax et des téléphones avec les commerçants africains", Icon: "hand-coins", Minutes: 45, Cost: 15000, Effect: Needs{Social: 30, Fun: 20}, MinHour: 9, MaxHour: 22, Places: []string{"dxb-deira-wax"}},
		{ID: "mo-oud", Label: "Choisir un parfum d'oud", Icon: "sparkles", Minutes: 30, Cost: 25000, Effect: Needs{Social: 5, Fun: 25}, MinHour: 10, MaxHour: 22, Places: []string{"dxb-deira-parfums"}},
		{ID: "mo-dattes", Label: "Acheter des dattes de Qassim et d'Ajwa", Icon: "shopping-basket", Minutes: 20, Cost: 5000, Effect: Needs{Hunger: 10, Social: 10, Fun: 10}, MinHour: 8, MaxHour: 23, Places: []string{"ryd-centre-dattes", "medine-centre-dattes", "mecque-centre-dattes"}},
		{ID: "mo-librairie", Label: "Chercher un livre en français rue Hamra", Icon: "book-open", Minutes: 30, Cost: 6000, Effect: Needs{Social: 5, Fun: 20}, MinHour: 9, MaxHour: 21, Places: []string{"bey-hamra-librairie"}},
		{ID: "mo-olivier", Label: "Acheter une crèche en bois d'olivier", Icon: "gift", Minutes: 20, Cost: 8000, Effect: Needs{Social: 10, Fun: 20}, MinHour: 9, MaxHour: 19, Places: []string{"bethleem-artisan"}},
		{ID: "mo-tapis", Label: "Regarder les tapis persans du bazar", Icon: "gem", Minutes: 45, Effect: Needs{Social: 20, Fun: 25}, MinHour: 9, MaxHour: 18, Places: []string{"teh-centre-tapis"}},
		{ID: "mo-gaz", Label: "Acheter du gaz, le nougat d'Ispahan", Icon: "gift", Minutes: 15, Cost: 3000, Effect: Needs{Hunger: 10, Fun: 15}, MinHour: 9, MaxHour: 21, Places: []string{"isf-centre-gaz"}},
		{ID: "mo-halwa", Label: "Goûter la halwa au safran et à l'eau de rose", Icon: "cake", Minutes: 15, Cost: 2000, Effect: Needs{Hunger: 20, Social: 5, Fun: 15}, MinHour: 8, MaxHour: 22, Places: []string{"manama-halwa", "mascate-halwa"}},
	},
	"restaurant": {
		{ID: "mo-attieke-dubai", Label: "Manger un attiéké poisson chez les Ivoiriens de Deira", Icon: "fish", Minutes: 40, Cost: 8000, Effect: Needs{Hunger: 60, Social: 25, Fun: 15}, MinHour: 11, MaxHour: 23, Places: []string{"dxb-deira-resto-africain"}},
		{ID: "mo-biryani", Label: "Manger un biryani au poulet", Icon: "cooking-pot", Minutes: 30, Cost: 5000, Effect: Needs{Hunger: 65, Social: 10, Fun: 5}, MinHour: 11, MaxHour: 24, Places: []string{"dxb-deira-biryani", "ryd-centre-kabsa"}},
		{ID: "mo-shawarma", Label: "Manger un shawarma", Icon: "sandwich", Minutes: 15, Cost: 2500, Effect: Needs{Hunger: 45, Social: 5, Fun: 5}, MinHour: 10, MaxHour: 24, Places: []string{"dxb-downtown-shawarma", "damas-shawarma"}},
		{ID: "mo-karak", Label: "Boire un thé karak et manger un chapati", Icon: "coffee", Minutes: 15, Cost: 800, Effect: Needs{Hunger: 20, Social: 15, Fun: 10}, MinHour: 6, MaxHour: 24, Places: []string{"dxb-downtown-karak", "doha-centre-karak"}},
		{ID: "mo-machboos", Label: "Manger un machboos au poulet", Icon: "cooking-pot", Minutes: 40, Cost: 6000, Effect: Needs{Hunger: 65, Social: 15, Fun: 5}, MinHour: 11, MaxHour: 23, Places: []string{"auh-centre-machboos", "doha-centre-machboos", "koweit-machboos"}},
		{ID: "mo-kabsa", Label: "Manger une kabsa au poulet", Icon: "cooking-pot", Minutes: 40, Cost: 6000, Effect: Needs{Hunger: 70, Social: 20, Fun: 5}, MinHour: 12, MaxHour: 24, Places: []string{"ryd-centre-kabsa", "mecque-centre-resto", "medine-centre-resto"}},
		{ID: "mo-gahwa", Label: "Boire le café arabe à la cardamome avec des dattes", Icon: "coffee", Minutes: 30, Cost: 2000, Effect: Needs{Hunger: 10, Social: 25, Fun: 10}, MinHour: 7, MaxHour: 24, Places: []string{"ryd-centre-cafe", "ryd-diriyah-cafe", "auh-centre-cafe"}},
		{ID: "mo-foul", Label: "Manger un foul et du pain tamees au petit matin", Icon: "utensils", Minutes: 20, Cost: 1500, Effect: Needs{Hunger: 55, Social: 10, Fun: 5}, MinHour: 5, MaxHour: 11, Places: []string{"jed-balad-foul"}},
		{ID: "mo-poisson-mer-rouge", Label: "Manger un poisson grillé de la mer Rouge", Icon: "fish", Minutes: 45, Cost: 9000, Effect: Needs{Hunger: 65, Social: 15, Fun: 10}, MinHour: 12, MaxHour: 24, Places: []string{"jed-balad-poisson"}},
		{ID: "mo-mezze", Label: "Partager des mezzés : houmous, taboulé, moutabal", Icon: "utensils", Minutes: 75, Cost: 14000, Effect: Needs{Hunger: 65, Social: 30, Fun: 15}, MinHour: 12, MaxHour: 24, Places: []string{"bey-centre-mezze"}},
		{ID: "mo-manakish", Label: "Manger une manouché au zaatar sortie du four", Icon: "sandwich", Minutes: 15, Cost: 1500, Effect: Needs{Hunger: 40, Social: 5, Fun: 5}, MinHour: 6, MaxHour: 14, Places: []string{"bey-centre-manakish"}},
		{ID: "mo-abidjan-beyrouth", Label: "Manger un attiéké-kebbé au café Abidjan–Beyrouth, et parler de Marcory", Icon: "utensils", Minutes: 50, Cost: 9000, Effect: Needs{Hunger: 60, Social: 35, Fun: 20}, MinHour: 11, MaxHour: 24, Places: []string{"bey-hamra-abidjan"}},
		{ID: "mo-falafel", Label: "Manger un sandwich falafel", Icon: "sandwich", Minutes: 15, Cost: 1500, Effect: Needs{Hunger: 45, Social: 5, Fun: 5}, MinHour: 9, MaxHour: 24, Places: []string{"bey-hamra-falafel", "amman-centre-falafel", "jlm-vieille-ville-falafel", "bethleem-falafel"}},
		{ID: "mo-patisserie-libanaise", Label: "Goûter les pâtisseries libanaises : baklava, maamoul", Icon: "cake", Minutes: 20, Cost: 3000, Effect: Needs{Hunger: 25, Social: 5, Fun: 20}, MinHour: 8, MaxHour: 23, Places: []string{"bey-centre-patisserie"}},
		{ID: "mo-houmous", Label: "Manger un houmous tout chaud avec du pain", Icon: "utensils", Minutes: 25, Cost: 3000, Effect: Needs{Hunger: 55, Social: 10, Fun: 5}, MinHour: 7, MaxHour: 16, Places: []string{"jlm-vieille-ville-houmous", "tlv-jaffa-houmous"}},
		{ID: "mo-kaak", Label: "Manger un ka'ak au sésame", Icon: "cake", Minutes: 10, Cost: 800, Effect: Needs{Hunger: 30, Social: 5, Fun: 5}, MinHour: 6, MaxHour: 20, Places: []string{"jlm-vieille-ville-pain", "tlv-jaffa-boulangerie"}},
		{ID: "mo-sabich", Label: "Manger un sabich", Icon: "sandwich", Minutes: 15, Cost: 2500, Effect: Needs{Hunger: 50, Social: 5, Fun: 5}, MinHour: 9, MaxHour: 23, Places: []string{"tlv-centre-sabich"}},
		{ID: "mo-shakshuka", Label: "Manger une shakshuka", Icon: "egg", Minutes: 30, Cost: 5000, Effect: Needs{Hunger: 55, Social: 10, Fun: 5}, MinHour: 7, MaxHour: 15, Places: []string{"tlv-centre-shakshuka"}},
		{ID: "mo-injera", Label: "Manger une injera chez les Érythréens", Icon: "utensils", Minutes: 40, Cost: 5000, Effect: Needs{Hunger: 65, Social: 20, Fun: 10}, MinHour: 11, MaxHour: 23, Places: []string{"tlv-centre-erythree", "melbourne-injera"}},
		{ID: "mo-musakhan", Label: "Manger un musakhan au poulet et à l'oignon", Icon: "drumstick", Minutes: 45, Cost: 5000, Effect: Needs{Hunger: 65, Social: 20, Fun: 10}, MinHour: 12, MaxHour: 22, Places: []string{"ramallah-musakhan"}},
		{ID: "mo-knafeh", Label: "Manger un knafeh chaud au fromage", Icon: "cake", Minutes: 15, Cost: 1500, Effect: Needs{Hunger: 30, Social: 10, Fun: 20}, MinHour: 9, MaxHour: 24, Places: []string{"amman-centre-knafeh", "ramallah-knafeh"}},
		{ID: "mo-mansaf", Label: "Manger le mansaf, l'agneau au yaourt jameed", Icon: "cooking-pot", Minutes: 60, Cost: 9000, Effect: Needs{Hunger: 75, Social: 25, Fun: 10}, MinHour: 12, MaxHour: 22, Places: []string{"amman-centre-mansaf"}},
		{ID: "mo-zarb", Label: "Manger le zarb cuit sous le sable", Icon: "drumstick", Minutes: 60, Cost: 8000, Effect: Needs{Hunger: 70, Social: 20, Fun: 15}, MinHour: 18, MaxHour: 23, Places: []string{"petra-centre-resto"}},
		{ID: "mo-chelo-kebab", Label: "Manger un chelo kebab au riz safrané", Icon: "drumstick", Minutes: 40, Cost: 4000, Effect: Needs{Hunger: 70, Social: 15, Fun: 5}, MinHour: 11, MaxHour: 23, Places: []string{"teh-centre-kebab", "teh-azadi-resto"}},
		{ID: "mo-dizi", Label: "Manger un dizi qu'on écrase soi-même au pilon", Icon: "cooking-pot", Minutes: 45, Cost: 3000, Effect: Needs{Hunger: 70, Social: 15, Fun: 15}, MinHour: 11, MaxHour: 16, Places: []string{"teh-centre-dizi"}},
		{ID: "mo-tchai", Label: "Boire un thé avec un sucre au safran dans une maison de thé", Icon: "coffee", Minutes: 30, Cost: 800, Effect: Needs{Hunger: 5, Social: 25, Fun: 15}, MinHour: 8, MaxHour: 24, Places: []string{"teh-centre-tchai", "isf-centre-tchai"}},
		{ID: "mo-ash", Label: "Manger un ash reshteh", Icon: "soup", Minutes: 20, Cost: 1500, Effect: Needs{Hunger: 50, Social: 10, Fun: 5}, MinHour: 10, MaxHour: 22, Places: []string{"teh-tajrish-ash"}},
		{ID: "mo-beryani-isf", Label: "Manger un beryani d'Ispahan dans son pain", Icon: "sandwich", Minutes: 30, Cost: 3000, Effect: Needs{Hunger: 60, Social: 10, Fun: 10}, MinHour: 11, MaxHour: 22, Places: []string{"isf-centre-beryani"}},
		{ID: "mo-shuwa", Label: "Manger le shuwa, l'agneau cuit deux jours sous terre", Icon: "drumstick", Minutes: 60, Cost: 9000, Effect: Needs{Hunger: 75, Social: 25, Fun: 15}, MinHour: 12, MaxHour: 23, Places: []string{"mascate-shuwa"}},
		{ID: "mo-masgouf", Label: "Manger un masgouf, la carpe grillée au feu de bois", Icon: "fish", Minutes: 60, Cost: 8000, Effect: Needs{Hunger: 70, Social: 25, Fun: 15}, MinHour: 17, MaxHour: 24, Places: []string{"bagdad-masgouf"}},
		{ID: "mo-shabandar", Label: "Boire un thé au café Shabandar", Icon: "coffee", Minutes: 40, Cost: 800, Effect: Needs{Social: 30, Fun: 15}, MinHour: 7, MaxHour: 18, Places: []string{"bagdad-tchai"}},
		{ID: "mo-booza", Label: "Manger une glace booza pilée à la pistache", Icon: "ice-cream-cone", Minutes: 15, Cost: 1500, Effect: Needs{Hunger: 15, Social: 5, Fun: 25}, MinHour: 10, MaxHour: 24, Places: []string{"damas-glaces"}},
		{ID: "mo-saltah", Label: "Manger une saltah bouillonnante", Icon: "cooking-pot", Minutes: 30, Cost: 2000, Effect: Needs{Hunger: 65, Social: 15, Fun: 10}, MinHour: 11, MaxHour: 16, Places: []string{"sanaa-saltah"}},
		{ID: "mo-moka", Label: "Boire un café du Yémen, le vrai moka", Icon: "coffee", Minutes: 30, Cost: 1500, Effect: Needs{Social: 20, Fun: 15, Energy: 10}, MinHour: 6, MaxHour: 22, Places: []string{"sanaa-cafe"}},
	},
	"barbier": {
		{ID: "mo-coupe-dubai", Label: "Se faire raser à l'ancienne chez le barbier de Deira", Icon: "scissors", Minutes: 30, Cost: 4000, Effect: Needs{Social: 20, Fun: 5, Hygiene: 15}, MinHour: 9, MaxHour: 23, Places: []string{"dxb-deira-barbier"}},
		{ID: "mo-tete-rasee", Label: "Se faire raser la tête à la fin de la Omra", Icon: "scissors", Minutes: 20, Cost: 3000, Effect: Needs{Social: 15, Fun: 15, Hygiene: 15}, Places: []string{"mecque-centre-barbier"}},
	},
	"beach": {
		{ID: "mo-jumeirah", Label: "Se baigner à la plage de Jumeirah", Icon: "waves", Minutes: 90, Effect: Needs{Social: 10, Fun: 40, Energy: -15, Hygiene: -5}, MinHour: 7, MaxHour: 20, Places: []string{"dxb-jumeirah-plage"}},
		{ID: "mo-corniche-ad", Label: "Se baigner sur la plage de la corniche", Icon: "waves", Minutes: 90, Cost: 2000, Effect: Needs{Social: 10, Fun: 35, Energy: -15, Hygiene: -5}, MinHour: 8, MaxHour: 20, Places: []string{"auh-corniche"}},
		{ID: "mo-corniche-jed", Label: "Marcher le soir sur la corniche de Djeddah", Icon: "waves", Minutes: 60, Effect: Needs{Social: 20, Fun: 30, Energy: -5}, MinHour: 16, MaxHour: 24, Places: []string{"jed-corniche-plage"}},
		{ID: "mo-katara-plage", Label: "Se baigner à la plage de Katara", Icon: "waves", Minutes: 90, Cost: 4000, Effect: Needs{Social: 10, Fun: 35, Energy: -15, Hygiene: -5}, MinHour: 9, MaxHour: 19, Places: []string{"doha-katara-plage"}},
		{ID: "mo-gordon", Label: "Jouer aux matkot sur la plage de Tel-Aviv", Icon: "waves", Minutes: 90, Effect: Needs{Social: 20, Fun: 40, Energy: -15, Hygiene: -5}, MinHour: 7, MaxHour: 20, Places: []string{"tlv-plage"}},
	},
	"worship": {
		{ID: "mo-jumeirah-visite", Label: "Visiter la mosquée de Jumeirah avec un guide", Icon: "landmark", Minutes: 60, Cost: 5000, Effect: Needs{Social: 15, Fun: 30, Energy: -5}, MinHour: 10, MaxHour: 12, Places: []string{"dxb-jumeirah-mosquee"}},
		{ID: "mo-zayed-visite", Label: "Visiter la grande mosquée Cheikh Zayed", Icon: "landmark", Minutes: 75, Effect: Needs{Social: 10, Fun: 40, Energy: -5}, MinHour: 9, MaxHour: 22, Places: []string{"auh-grande-mosquee"}},
		{ID: "mo-omra", Label: "Accomplir la Omra : le tawaf autour de la Kaaba, le sa'i entre Safa et Marwa", Icon: "moon", Minutes: 240, Effect: Needs{Social: 30, Fun: 40, Energy: -35, Hygiene: -10}, Places: []string{"mecque-masjid-al-haram"}},
		{ID: "mo-zamzam", Label: "Boire l'eau de Zamzam", Icon: "droplet", Minutes: 10, Effect: Needs{Hunger: 5, Fun: 15, Energy: 5}, Places: []string{"mecque-masjid-al-haram"}},
		{ID: "mo-hajj-arafat", Label: "Se tenir à Arafat pendant le Hajj, en prière jusqu'au coucher du soleil", Icon: "moon", Minutes: 300, Effect: Needs{Social: 40, Fun: 45, Energy: -40}, MinHour: 6, MaxHour: 19, Places: []string{"mecque-arafat"}},
		{ID: "mo-hajj-mina", Label: "Passer la nuit sous les tentes de Mina avec les pèlerins", Icon: "bed", Minutes: 480, Effect: Needs{Social: 40, Fun: 25, Energy: 30}, MinHour: 20, MaxHour: 8, Places: []string{"mecque-mina"}},
		{ID: "mo-nabawi", Label: "Prier à la mosquée du Prophète", Icon: "moon", Minutes: 60, Effect: Needs{Social: 20, Fun: 30, Energy: 5}, Places: []string{"medine-masjid-nabawi"}},
		{ID: "mo-quba", Label: "Prier deux rakats à la mosquée de Quba", Icon: "moon", Minutes: 30, Effect: Needs{Social: 10, Fun: 25, Energy: 5}, MinHour: 5, MaxHour: 23, Places: []string{"medine-quba"}},
		{ID: "mo-mur", Label: "Glisser un vœu dans le mur des Lamentations", Icon: "landmark", Minutes: 20, Effect: Needs{Social: 5, Fun: 25}, Places: []string{"jlm-mur"}},
		{ID: "mo-dome-rocher", Label: "Admirer le Dôme du Rocher depuis l'esplanade", Icon: "landmark", Minutes: 30, Effect: Needs{Social: 5, Fun: 30}, MinHour: 7, MaxHour: 11, Days: Workweek, Places: []string{"jlm-dome-rocher"}},
		{ID: "mo-sepulcre", Label: "Visiter la basilique du Saint-Sépulcre", Icon: "church", Minutes: 45, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 5, MaxHour: 20, Places: []string{"jlm-saint-sepulcre"}},
		{ID: "mo-nativite", Label: "Descendre dans la grotte de la Nativité", Icon: "church", Minutes: 45, Effect: Needs{Social: 5, Fun: 35, Energy: -5}, MinHour: 6, MaxHour: 19, Places: []string{"bethleem-nativite"}},
		{ID: "mo-mosquee-imam", Label: "Lever les yeux sous la coupole de la mosquée de l'Imam", Icon: "landmark", Minutes: 45, Cost: 2000, Effect: Needs{Social: 5, Fun: 45, Energy: -5}, MinHour: 9, MaxHour: 18, Places: []string{"isf-mosquee-imam", "isf-lotfollah"}},
		{ID: "mo-vank", Label: "Visiter la cathédrale arménienne de Vank", Icon: "church", Minutes: 40, Cost: 2000, Effect: Needs{Social: 5, Fun: 30, Energy: -5}, MinHour: 9, MaxHour: 17, Places: []string{"isf-vank"}},
		{ID: "mo-sultan-qabous", Label: "Visiter la grande mosquée Sultan-Qabous", Icon: "landmark", Minutes: 60, Effect: Needs{Social: 10, Fun: 40, Energy: -5}, MinHour: 8, MaxHour: 11, Days: Workweek, Places: []string{"mascate-grande-mosquee"}},
		{ID: "mo-omeyyades", Label: "Visiter la cour de marbre de la mosquée des Omeyyades", Icon: "landmark", Minutes: 45, Effect: Needs{Social: 5, Fun: 40, Energy: -5}, MinHour: 8, MaxHour: 20, Places: []string{"damas-omeyyades"}},
	},
	"club": {
		{ID: "mo-dubai-club", Ages: Adults, Label: "Danser sur un toit de Business Bay", Icon: "music", Minutes: 120, Cost: 25000, Effect: Needs{Social: 30, Fun: 45, Energy: -25}, MinHour: 22, MaxHour: 3, Places: []string{"dxb-downtown-club"}},
		{ID: "mo-mar-mikhael", Ages: Adults, Label: "Sortir à Mar Mikhaël", Icon: "music", Minutes: 120, Cost: 15000, Effect: Needs{Social: 30, Fun: 45, Energy: -25}, MinHour: 22, MaxHour: 4, Places: []string{"bey-centre-club"}},
		{ID: "mo-florentin", Ages: Adults, Label: "Danser jusqu'au matin à Florentin", Icon: "music", Minutes: 180, Cost: 15000, Effect: Needs{Social: 30, Fun: 50, Energy: -30}, MinHour: 23, MaxHour: 6, Places: []string{"tlv-centre-club"}},
	},
	"sport": {
		{ID: "mo-match-riyad", Label: "Voir un match de la Saudi League au stade", Icon: "trophy", Minutes: 150, Cost: 15000, Effect: Needs{Social: 30, Fun: 50, Energy: -10}, MinHour: 18, MaxHour: 23, Places: []string{"ryd-stade"}},
		{ID: "mo-khalifa", Label: "Voir un match au stade de la Coupe du monde", Icon: "trophy", Minutes: 150, Cost: 12000, Effect: Needs{Social: 30, Fun: 50, Energy: -10}, MinHour: 18, MaxHour: 23, Places: []string{"doha-khalifa"}},
		{ID: "mo-azadi-match", Label: "Voir un derby Persépolis–Esteghlal au stade Azadi", Icon: "trophy", Minutes: 150, Cost: 4000, Effect: Needs{Social: 35, Fun: 55, Energy: -15}, MinHour: 16, MaxHour: 22, Places: []string{"teh-azadi-stade"}},
	},
	"nature": {
		{ID: "mo-uhud", Label: "Monter voir le mont Uhud", Icon: "mountain", Minutes: 60, Effect: Needs{Social: 10, Fun: 25, Energy: -15}, MinHour: 6, MaxHour: 19, Places: []string{"medine-uhud"}},
		{ID: "mo-oliviers", Label: "Regarder la vieille ville depuis le mont des Oliviers", Icon: "camera", Minutes: 45, Effect: Needs{Social: 5, Fun: 35, Energy: -10}, MinHour: 6, MaxHour: 19, Places: []string{"jlm-mont-oliviers"}},
		{ID: "mo-olives", Label: "Aider à la cueillette des olives", Icon: "trees", Minutes: 120, Effect: Needs{Social: 30, Fun: 20, Energy: -25}, MinHour: 7, MaxHour: 16, Places: []string{"ramallah-oliviers"}},
		{ID: "mo-darband", Label: "Monter à Darband et manger des brochettes au bord du torrent", Icon: "mountain", Minutes: 120, Cost: 5000, Effect: Needs{Hunger: 30, Social: 20, Fun: 40, Energy: -20}, MinHour: 8, MaxHour: 22, Places: []string{"teh-tajrish-darband"}},
	},
}
