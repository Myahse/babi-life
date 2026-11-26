package game

// La France (world/france.go): what's done in Paris and the great cities, each tied to its place
// (Interaction.Places), behind « pays-france » (features.go Interactions). Prices in francs as the game's
// money, in line with the real thing in euros (one euro is 656 F: a café au comptoir, the tour Eiffel's
// summit, a match at the Stade de France, tresses in a Château-Rouge salon); hours as the places keep them.
// Played like every action (web components/defi/jeux/configs/pays.ts).

// The clubs of France's cities (world/france.go), for a night out.
var franceClubs = []string{"marseille-club", "lyon-club", "toulouse-club", "bordeaux-club", "lille-club", "nice-club", "strasbourg-club", "nantes-club"}

// FranceActs: Paris's and the great cities'.
var FranceActs = map[string][]Interaction{
	"culture": {
		{ID: "paris-eiffel-sommet", Label: "Monter au sommet de la tour Eiffel", Icon: "landmark", Minutes: 90, Cost: 23500, Effect: Needs{Fun: 55, Social: 5, Energy: -10}, MinHour: 9, MaxHour: 23, Places: []string{"paris-tour-eiffel"}},
		{ID: "paris-eiffel-scintille", Label: "Voir la tour Eiffel scintiller à l'heure pile", Icon: "sparkles", Minutes: 20, Effect: Needs{Fun: 35, Social: 10}, MinHour: 19, MaxHour: 24, Places: []string{"paris-tour-eiffel"}},
		{ID: "paris-louvre-joconde", Label: "Voir la Joconde au Louvre", Icon: "palette", Minutes: 2 * 60, Cost: 14500, Effect: Needs{Fun: 45, Energy: -10}, MinHour: 9, MaxHour: 18, Places: []string{"paris-louvre"}},
		{ID: "paris-arc-terrasse", Label: "Monter sur la terrasse de l'Arc de Triomphe", Icon: "landmark", Minutes: 45, Cost: 10500, Effect: Needs{Fun: 40, Energy: -10}, MinHour: 10, MaxHour: 23, Places: []string{"paris-arc-triomphe"}},
		{ID: "paris-moulin-photo", Label: "Se prendre en photo devant le Moulin Rouge", Icon: "camera", Minutes: 15, Effect: Needs{Fun: 20, Social: 5}, Places: []string{"paris-moulin-rouge"}},
		{ID: "paris-grande-arche-photo", Label: "Se prendre en photo sous la Grande Arche", Icon: "camera", Minutes: 20, Effect: Needs{Fun: 25, Social: 5}, MinHour: 7, MaxHour: 22, Places: []string{"paris-grande-arche"}},
		{ID: "marseille-mucem-visite", Label: "Visiter le MuCEM et marcher sur sa passerelle", Icon: "landmark", Minutes: 90, Cost: 7000, Effect: Needs{Fun: 40, Social: 5}, MinHour: 10, MaxHour: 19, Places: []string{"marseille-mucem"}},
		{ID: "toulouse-cite-espace", Label: "Visiter la Cité de l'espace et sa fusée Ariane", Icon: "sparkles", Minutes: 3 * 60, Cost: 18000, Effect: Needs{Fun: 55, Energy: -15}, MinHour: 10, MaxHour: 18, Places: []string{"toulouse-cite-espace"}},
		{ID: "nantes-elephant", Label: "Monter sur le dos du grand éléphant", Icon: "footprints", Minutes: 45, Cost: 6000, Effect: Needs{Fun: 50, Social: 10}, MinHour: 10, MaxHour: 18, Places: []string{"nantes-machines"}},
		{ID: "nantes-chateau-remparts", Label: "Faire le tour des remparts du château", Icon: "castle", Minutes: 40, Effect: Needs{Fun: 25, Energy: -5}, MinHour: 8, MaxHour: 22, Places: []string{"nantes-chateau"}},
		{ID: "lille-bouquinistes", Label: "Chiner un vieux livre dans la cour de la Vieille Bourse", Icon: "book-open", Minutes: 30, Cost: 3000, Effect: Needs{Fun: 25, Social: 10}, MinHour: 13, MaxHour: 19, Places: []string{"lille-vieille-bourse"}},
		{ID: "strasbourg-parlement-visite", Label: "Visiter l'hémicycle du Parlement européen", Icon: "landmark", Minutes: 60, Effect: Needs{Fun: 30, Social: 5}, MinHour: 9, MaxHour: 17, Days: Workweek, Places: []string{"strasbourg-parlement"}},
		{ID: "bordeaux-grand-theatre", Label: "Voir un ballet au Grand-Théâtre", Icon: "drama", Minutes: 2 * 60, Cost: 26000, Effect: Needs{Fun: 50, Social: 15}, MinHour: 19, MaxHour: 23, Places: []string{"bordeaux-grand-theatre"}},
	},
	"worship": {
		{ID: "paris-notre-dame-visite", Label: "Visiter Notre-Dame restaurée", Icon: "church", Minutes: 45, Effect: Needs{Fun: 35, Social: 5}, MinHour: 8, MaxHour: 19, Places: []string{"paris-notre-dame"}},
		{ID: "paris-sacre-coeur-marches", Label: "Monter les marches du Sacré-Cœur et regarder tout Paris", Icon: "footprints", Minutes: 40, Effect: Needs{Fun: 35, Energy: -15, Social: 5}, MinHour: 7, MaxHour: 22, Places: []string{"paris-sacre-coeur"}},
		{ID: "marseille-bonne-mere", Label: "Monter à la Bonne Mère, la vue sur toute la ville", Icon: "mountain", Minutes: 60, Effect: Needs{Fun: 40, Energy: -15}, MinHour: 7, MaxHour: 19, Places: []string{"marseille-bonne-mere"}},
		{ID: "lyon-fourviere-vue", Label: "Regarder Lyon depuis l'esplanade de Fourvière", Icon: "mountain", Minutes: 40, Effect: Needs{Fun: 35, Energy: -10}, MinHour: 7, MaxHour: 22, Places: []string{"lyon-fourviere"}},
		{ID: "strasbourg-plateforme", Label: "Monter les 332 marches de la cathédrale", Icon: "footprints", Minutes: 45, Cost: 5000, Effect: Needs{Fun: 35, Energy: -20}, MinHour: 9, MaxHour: 19, Places: []string{"strasbourg-cathedrale"}},
		{ID: "toulouse-saint-sernin", Label: "Visiter la basilique Saint-Sernin", Icon: "church", Minutes: 30, Effect: Needs{Fun: 20, Social: 5}, MinHour: 8, MaxHour: 19, Places: []string{"toulouse-saint-sernin"}},
	},
	"rue": {
		{ID: "paris-champs-balade", Label: "Flâner sur les Champs-Élysées", Icon: "footprints", Minutes: 45, Effect: Needs{Fun: 25, Social: 10, Energy: -5}, MinHour: 8, MaxHour: 24, Places: []string{"paris-champs-elysees"}},
		{ID: "paris-tertre-portrait", Label: "Se faire tirer le portrait place du Tertre", Icon: "palette", Minutes: 40, Cost: 20000, Effect: Needs{Fun: 35, Social: 15}, MinHour: 10, MaxHour: 20, Places: []string{"paris-place-tertre"}},
		{ID: "marseille-vieux-port-poisson", Label: "Voir les pêcheurs vendre leur poisson sur le Vieux-Port", Icon: "fish", Minutes: 30, Effect: Needs{Fun: 25, Social: 15}, MinHour: 7, MaxHour: 12, Places: []string{"marseille-vieux-port"}},
		{ID: "lyon-traboules", Label: "Chercher les traboules du Vieux Lyon", Icon: "signpost", Minutes: 45, Effect: Needs{Fun: 30, Energy: -5}, MinHour: 8, MaxHour: 20, Places: []string{"lyon-vieux-lyon"}},
		{ID: "bordeaux-miroir", Label: "Marcher dans le miroir d'eau", Icon: "droplets", Minutes: 20, Effect: Needs{Fun: 30, Hygiene: 5}, MinHour: 10, MaxHour: 22, Places: []string{"bordeaux-bourse"}},
		{ID: "lille-gaufre", Label: "Manger une gaufre sur la Grand-Place", Icon: "cookie", Minutes: 15, Cost: 3000, Effect: Needs{Hunger: 25, Fun: 15}, MinHour: 9, MaxHour: 21, Places: []string{"lille-grand-place"}},
		{ID: "strasbourg-petite-france", Label: "Se promener le long des maisons à colombages", Icon: "footprints", Minutes: 40, Effect: Needs{Fun: 30, Social: 5}, MinHour: 8, MaxHour: 22, Places: []string{"strasbourg-petite-france"}},
		{ID: "toulouse-garonne", Label: "Regarder le soleil se coucher sur la Garonne", Icon: "sunset", Minutes: 30, Effect: Needs{Fun: 30, Social: 10}, MinHour: 17, MaxHour: 21, Places: []string{"toulouse-pont-neuf"}},
		{ID: "nantes-pommeraye", Label: "Traverser le passage Pommeraye", Icon: "footprints", Minutes: 20, Effect: Needs{Fun: 20}, MinHour: 9, MaxHour: 20, Places: []string{"nantes-pommeraye"}},
	},
	"beach": {
		{ID: "nice-chaise-bleue", Label: "Se poser sur une chaise bleue face à la baie des Anges", Icon: "armchair", Minutes: 40, Effect: Needs{Fun: 30, Energy: 10, Social: 5}, MinHour: 7, MaxHour: 22, Places: []string{"nice-promenade"}},
	},
	"nature": {
		{ID: "paris-murs-peches", Label: "Se promener dans les murs à pêches", Icon: "trees", Minutes: 45, Effect: Needs{Fun: 25, Energy: -5}, MinHour: 10, MaxHour: 19, Days: Weekend, Places: []string{"paris-murs-peches"}},
		{ID: "nice-cascade", Label: "Monter à la cascade de la colline du Château", Icon: "mountain", Minutes: 45, Effect: Needs{Fun: 30, Energy: -15}, MinHour: 8, MaxHour: 20, Places: []string{"nice-chateau"}},
	},
	"market": {
		{ID: "paris-dejean-courses", Label: "Faire ses courses au marché Dejean : manioc, plantain, poisson", Icon: "shopping-basket", Minutes: 40, Cost: 10000, Effect: Needs{Fun: 15, Social: 25, Hunger: 10}, MinHour: 8, MaxHour: 20, Places: []string{"paris-marche-dejean"}},
		{ID: "paris-st-denis-marche", Label: "Faire le grand marché de Saint-Denis", Icon: "shopping-basket", Minutes: 45, Cost: 8000, Effect: Needs{Fun: 15, Social: 20, Hunger: 10}, MinHour: 8, MaxHour: 14, Places: []string{"paris-marche-st-denis"}},
		{ID: "paris-chavaux-chiner", Label: "Chiner au marché de la Croix-de-Chavaux", Icon: "shopping-bag", Minutes: 40, Cost: 5000, Effect: Needs{Fun: 20, Social: 15}, MinHour: 8, MaxHour: 14, Places: []string{"paris-croix-chavaux"}},
		{ID: "marseille-epices", Label: "Respirer les épices du marché de Noailles", Icon: "shopping-basket", Minutes: 30, Cost: 4000, Effect: Needs{Fun: 20, Social: 15}, MinHour: 8, MaxHour: 19, Places: []string{"marseille-noailles"}},
		{ID: "nice-fleurs", Label: "Acheter des fleurs au cours Saleya", Icon: "flower", Minutes: 20, Cost: 5000, Effect: Needs{Fun: 20, Social: 10}, MinHour: 6, MaxHour: 13, Places: []string{"nice-saleya"}},
	},
	// The maquis of Château-Rouge: the pays at the table, in Paris.
	"maquis": {
		{ID: "paris-maquis-garba", Label: "Manger un garba comme au pays", Icon: "fish", Minutes: 30, Cost: 6500, Effect: Needs{Hunger: 60, Social: 10, Fun: 10}, MinHour: 11, MaxHour: 24, Places: []string{"paris-maquis"}},
		{ID: "paris-maquis-alloco", Label: "Manger un alloco-poulet braisé", Icon: "drumstick", Minutes: 45, Cost: 9500, Effect: Needs{Hunger: 70, Social: 15, Fun: 10}, MinHour: 12, MaxHour: 24, Places: []string{"paris-maquis"}},
		{ID: "paris-maquis-match", Label: "Regarder le match des Éléphants avec la diaspora", Icon: "tv", Minutes: 2 * 60, Cost: 3000, Effect: Needs{Fun: 45, Social: 40}, MinHour: 17, MaxHour: 23, Places: []string{"paris-maquis"}},
	},
	"salon": {
		{ID: "paris-tresses", Label: "Se faire tresser au salon afro", Icon: "scissors", Minutes: 3 * 60, Cost: 50000, Effect: Needs{Fun: 25, Social: 30, Hygiene: 10, Energy: -10}, MinHour: 9, MaxHour: 20, Places: []string{"paris-coiffure"}},
	},
	"barbier": {
		{ID: "paris-degrade", Label: "Se faire faire un dégradé", Icon: "scissors", Minutes: 30, Cost: 13000, Effect: Needs{Fun: 15, Social: 15, Hygiene: 10}, MinHour: 9, MaxHour: 21, Places: []string{"montreuil-barbier"}},
	},
	"boutique": {
		{ID: "paris-wax-pagne", Label: "Acheter un pagne wax de six yards", Icon: "shopping-bag", Minutes: 30, Cost: 20000, Effect: Needs{Fun: 20, Social: 10}, MinHour: 9, MaxHour: 20, Places: []string{"paris-wax"}},
		{ID: "paris-epicerie", Label: "Acheter attiéké, gari et piment à l'épicerie africaine", Icon: "shopping-basket", Minutes: 20, Cost: 8000, Effect: Needs{Hunger: 15, Fun: 10}, MinHour: 8, MaxHour: 22, Places: []string{"paris-epicerie"}},
		{ID: "paris-comptoir", Label: "Boire un petit noir au comptoir du bar-tabac", Icon: "coffee", Minutes: 15, Cost: 1500, Effect: Needs{Social: 15, Fun: 5, Energy: 10}, MinHour: 6, MaxHour: 22, Places: []string{"paris-bartabac"}},
	},
	// The café, the boulangerie, the crêperie, the grill of Saint-Denis, the Mandingue; the brasseries of the cities.
	"restaurant": {
		{ID: "paris-cafe-terrasse", Label: "Prendre un café en terrasse et regarder passer les gens", Icon: "coffee", Minutes: 30, Cost: 2000, Effect: Needs{Fun: 20, Social: 15, Energy: 10}, MinHour: 7, MaxHour: 24, Places: []string{"paris-cafe"}},
		{ID: "paris-croissants", Label: "Acheter des croissants et une baguette toute chaude", Icon: "croissant", Minutes: 10, Cost: 2500, Effect: Needs{Hunger: 30, Fun: 5}, MinHour: 6, MaxHour: 20, Places: []string{"paris-boulangerie"}},
		{ID: "paris-crepe", Label: "Manger une crêpe au sucre", Icon: "cookie", Minutes: 15, Cost: 4000, Effect: Needs{Hunger: 25, Fun: 10}, MinHour: 11, MaxHour: 23, Places: []string{"montmartre-creperie"}},
		{ID: "paris-grec-frites", Label: "Manger un sandwich grec-frites", Icon: "sandwich", Minutes: 20, Cost: 5500, Effect: Needs{Hunger: 55, Fun: 5}, MinHour: 11, MaxHour: 24, Places: []string{"st-denis-grill"}},
		{ID: "paris-mafe", Label: "Manger un mafé et un jus de bissap au Mandingue", Icon: "utensils", Minutes: 40, Cost: 7000, Effect: Needs{Hunger: 65, Social: 15}, MinHour: 11, MaxHour: 23, Places: []string{"montreuil-resto"}},
		{ID: "marseille-bouillabaisse", Label: "Manger une bouillabaisse", Icon: "fish", Minutes: 60, Cost: 35000, Effect: Needs{Hunger: 70, Fun: 20, Social: 10}, MinHour: 12, MaxHour: 23, Places: []string{"marseille-brasserie"}},
		{ID: "lyon-bouchon", Label: "Manger dans un bouchon lyonnais", Icon: "utensils", Minutes: 60, Cost: 25000, Effect: Needs{Hunger: 70, Fun: 15, Social: 10}, MinHour: 12, MaxHour: 23, Places: []string{"lyon-brasserie"}},
		{ID: "toulouse-cassoulet", Label: "Manger un cassoulet", Icon: "cooking-pot", Minutes: 50, Cost: 15000, Effect: Needs{Hunger: 75, Fun: 10}, MinHour: 12, MaxHour: 23, Places: []string{"toulouse-brasserie"}},
		{ID: "bordeaux-caneles", Label: "Goûter des canelés", Icon: "cookie", Minutes: 15, Cost: 3000, Effect: Needs{Hunger: 20, Fun: 15}, MinHour: 8, MaxHour: 20, Places: []string{"bordeaux-brasserie"}},
		{ID: "lille-moules-frites", Label: "Manger des moules-frites", Icon: "utensils", Minutes: 45, Cost: 13000, Effect: Needs{Hunger: 65, Fun: 10, Social: 10}, MinHour: 12, MaxHour: 23, Places: []string{"lille-brasserie"}},
		{ID: "nice-socca", Label: "Manger une socca toute chaude", Icon: "utensils", Minutes: 15, Cost: 2500, Effect: Needs{Hunger: 30, Fun: 10}, MinHour: 9, MaxHour: 21, Places: []string{"nice-brasserie"}},
		{ID: "strasbourg-choucroute", Label: "Manger une choucroute et un bretzel", Icon: "utensils", Minutes: 50, Cost: 14000, Effect: Needs{Hunger: 70, Fun: 10}, MinHour: 12, MaxHour: 23, Places: []string{"strasbourg-brasserie"}},
		{ID: "nantes-galette", Label: "Manger une galette de sarrasin", Icon: "utensils", Minutes: 30, Cost: 8000, Effect: Needs{Hunger: 50, Fun: 10}, MinHour: 12, MaxHour: 23, Places: []string{"nantes-brasserie"}},
	},
	"sport": {
		{ID: "paris-bleus-match", Label: "Voir un match des Bleus au Stade de France", Icon: "trophy", Minutes: 3 * 60, Cost: 33000, Effect: Needs{Fun: 55, Social: 30, Energy: -10, Hunger: -10}, MinHour: 18, MaxHour: 23, Places: []string{"paris-stade-de-france"}},
		{ID: "marseille-virage", Label: "Chanter avec le virage au Vélodrome", Icon: "megaphone", Minutes: 3 * 60, Cost: 25000, Effect: Needs{Fun: 55, Social: 35, Energy: -15}, MinHour: 18, MaxHour: 23, Places: []string{"marseille-velodrome"}},
	},
	"club": {
		{ID: "paris-club-afro", Ages: Adults, Label: "Danser l'afrobeat et le coupé-décalé jusqu'au matin", Icon: "music", Minutes: 2 * 60, Cost: 15000, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 23, MaxHour: 5, Places: []string{"paris-club"}},
		{ID: "france-boite", Ages: Adults, Label: "Sortir en boîte", Icon: "music", Minutes: 2 * 60, Cost: 12000, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 23, MaxHour: 5, Places: franceClubs},
	},
}

func init() {
	addActs(FranceActs)
	villeActs[FranceKey] = FranceActs
}
