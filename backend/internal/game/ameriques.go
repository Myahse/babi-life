package game

// Les Amériques (world/ameriques.go): what's done in the cities there, each tied to its place
// (Interaction.Places). Canada's new cities' come with « pays-canada » (added to CanadaActs before
// paysActs.go hands them out: this file's init runs first), the rest with « pays-ameriques ». Prices in
// francs as the game's money, in line with the real thing (a tour up the CN Tower, an acarajé from the
// baiana, tacos al pastor, a griot, a ticket at the Maracanã); hours as the places keep them.

// canadaPlusActs: Toronto's, Ottawa's, Québec's, Vancouver's, Calgary's, Edmonton's, Winnipeg's, Halifax's.
var canadaPlusActs = map[string][]Interaction{
	"culture": {
		{ID: "toronto-tour-cn", Label: "Monter en haut de la tour CN et marcher sur le plancher de verre", Icon: "building-2", Minutes: 60, Cost: 20000, Effect: Needs{Fun: 50, Energy: -5}, MinHour: 9, MaxHour: 22, Places: []string{"toronto-tour-cn"}},
		{ID: "ottawa-parlement", Label: "Visiter le Parlement et monter à la tour de la Paix", Icon: "landmark", Minutes: 60, Effect: Needs{Fun: 30, Social: 5}, MinHour: 9, MaxHour: 17, Places: []string{"ottawa-parlement"}},
		{ID: "calgary-tour", Label: "Monter à la tour de Calgary voir les Rocheuses", Icon: "mountain", Minutes: 45, Cost: 8000, Effect: Needs{Fun: 35}, MinHour: 9, MaxHour: 22, Places: []string{"calgary-tour"}},
		{ID: "winnipeg-musee", Label: "Visiter le musée des droits de la personne", Icon: "landmark", Minutes: 75, Cost: 9000, Effect: Needs{Fun: 30, Social: 10}, MinHour: 10, MaxHour: 17, Places: []string{"winnipeg-droits-personne"}},
		{ID: "halifax-canon", Label: "Voir tirer le canon de midi à la Citadelle", Icon: "flag", Minutes: 45, Cost: 5000, Effect: Needs{Fun: 35, Social: 5}, MinHour: 11, MaxHour: 13, Places: []string{"halifax-citadelle"}},
		{ID: "halifax-quai21", Label: "Visiter le Quai 21, la porte des immigrants", Icon: "ship", Minutes: 60, Cost: 9000, Effect: Needs{Fun: 30, Social: 10}, MinHour: 9, MaxHour: 17, Places: []string{"halifax-quai-21"}},
	},
	"nature": {
		{ID: "ottawa-patin-canal", Label: "Patiner sur le canal Rideau gelé", Icon: "snowflake", Minutes: 60, Effect: Needs{Fun: 45, Energy: -20, Social: 10}, MinHour: 8, MaxHour: 22, Places: []string{"ottawa-canal-rideau"}},
		{ID: "quebec-plaines", Label: "Faire du ski de fond sur les plaines d'Abraham", Icon: "snowflake", Minutes: 60, Cost: 3000, Effect: Needs{Fun: 35, Energy: -20}, MinHour: 8, MaxHour: 20, Places: []string{"quebec-plaines"}},
		{ID: "vancouver-stanley", Label: "Faire le tour du parc Stanley à vélo", Icon: "bike", Minutes: 75, Cost: 6000, Effect: Needs{Fun: 40, Energy: -20}, MinHour: 7, MaxHour: 20, Places: []string{"vancouver-stanley-park"}},
		{ID: "edmonton-muttart", Label: "Visiter les pyramides de verre du conservatoire Muttart", Icon: "flower-2", Minutes: 60, Cost: 6000, Effect: Needs{Fun: 30, Energy: 5}, MinHour: 10, MaxHour: 17, Places: []string{"edmonton-muttart"}},
	},
	"rue": {
		{ID: "toronto-kensington", Label: "Chiner dans les friperies de Kensington Market", Icon: "shirt", Minutes: 45, Cost: 8000, Effect: Needs{Fun: 30, Social: 15}, MinHour: 10, MaxHour: 19, Places: []string{"toronto-kensington"}},
		{ID: "quebec-glissade", Label: "Descendre la glissade de la terrasse Dufferin", Icon: "snowflake", Minutes: 30, Cost: 2000, Effect: Needs{Fun: 45, Social: 10}, MinHour: 11, MaxHour: 22, Places: []string{"quebec-terrasse-dufferin"}},
		{ID: "quebec-petit-champlain", Label: "Flâner rue du Petit-Champlain", Icon: "footprints", Minutes: 40, Effect: Needs{Fun: 25, Social: 10}, MinHour: 9, MaxHour: 22, Places: []string{"quebec-vieux-quebec"}},
		{ID: "vancouver-horloge", Label: "Attendre le sifflet de l'horloge à vapeur de Gastown", Icon: "clock", Minutes: 20, Effect: Needs{Fun: 20, Social: 5}, Places: []string{"vancouver-horloge-vapeur"}},
		{ID: "winnipeg-forks", Label: "Patiner sur la rivière, au sentier de la Fourche", Icon: "snowflake", Minutes: 60, Effect: Needs{Fun: 40, Energy: -20, Social: 10}, MinHour: 9, MaxHour: 21, Places: []string{"winnipeg-forks"}},
	},
	"market": {
		{ID: "toronto-peameal", Label: "Manger un sandwich au bacon de dos au marché Saint-Laurent", Icon: "sandwich", Minutes: 20, Cost: 4500, Effect: Needs{Hunger: 45, Fun: 10}, MinHour: 8, MaxHour: 18, Places: []string{"toronto-marche-saint-laurent"}},
		{ID: "ottawa-marche-by", Label: "Faire le marché By", Icon: "shopping-basket", Minutes: 40, Cost: 5000, Effect: Needs{Hunger: 20, Fun: 20, Social: 15}, MinHour: 8, MaxHour: 18, Places: []string{"ottawa-marche-by"}},
		{ID: "vancouver-granville", Label: "Goûter de tout au marché de Granville Island", Icon: "fish", Minutes: 45, Cost: 7000, Effect: Needs{Hunger: 45, Fun: 20}, MinHour: 9, MaxHour: 19, Places: []string{"vancouver-granville"}},
	},
	"sport": {
		{ID: "calgary-stampede", Label: "Voir le rodéo du Stampede", Icon: "trophy", Minutes: 3 * 60, Cost: 18000, Effect: Needs{Fun: 50, Social: 25, Energy: -10}, MinHour: 13, MaxHour: 22, Places: []string{"calgary-stampede"}},
	},
	"restaurant": {
		{ID: "halifax-homard", Label: "Manger un sandwich au homard sur le port", Icon: "fish", Minutes: 30, Cost: 9000, Effect: Needs{Hunger: 50, Fun: 15}, MinHour: 11, MaxHour: 22, Places: []string{"halifax-diner"}},
		{ID: "quebec-tourtiere", Label: "Manger une tourtière et une tarte au sucre", Icon: "utensils", Minutes: 40, Cost: 8000, Effect: Needs{Hunger: 60, Fun: 10}, MinHour: 11, MaxHour: 23, Places: []string{"quebec-diner"}},
	},
}

// AmeriquesActs: Latin America's and the Caribbean's (the update « pays-ameriques »).
var AmeriquesActs = map[string][]Interaction{
	"restaurant": {
		{ID: "saopaulo-pastel", Label: "Manger un pastel et boire un jus de canne", Icon: "sandwich", Minutes: 20, Cost: 1500, Effect: Needs{Hunger: 35, Fun: 10}, MinHour: 7, MaxHour: 23, Places: []string{"saopaulo-pastel", "saopaulo-lanchonete"}},
		{ID: "rio-agua-coco", Label: "Boire une eau de coco au kiosque de la plage", Icon: "cup-soda", Minutes: 15, Cost: 1000, Effect: Needs{Hunger: 10, Fun: 15, Energy: 5}, MinHour: 8, MaxHour: 23, Places: []string{"rio-quiosque"}},
		{ID: "rio-feijoada", Label: "Manger une feijoada du samedi au boteco", Icon: "cooking-pot", Minutes: 60, Cost: 6000, Effect: Needs{Hunger: 75, Social: 20, Energy: -5}, MinHour: 12, MaxHour: 17, Days: []int{Samedi}, Places: []string{"rio-boteco"}},
		{ID: "salvador-acaraje", Label: "Manger un acarajé de la baiana", Icon: "flame", Minutes: 20, Cost: 1500, Effect: Needs{Hunger: 45, Fun: 10}, MinHour: 15, MaxHour: 22, Places: []string{"salvador-acaraje"}},
		{ID: "salvador-moqueca", Label: "Manger une moqueca baiana au lait de coco", Icon: "fish", Minutes: 50, Cost: 7000, Effect: Needs{Hunger: 70, Social: 10}, MinHour: 11, MaxHour: 23, Places: []string{"salvador-moqueca"}},
		{ID: "cdmx-tacos", Label: "Manger des tacos al pastor", Icon: "utensils", Minutes: 20, Cost: 2000, Effect: Needs{Hunger: 50, Fun: 10}, MinHour: 12, MaxHour: 3, Places: []string{"cdmx-taqueria", "cancun-taqueria"}},
		{ID: "cdmx-churros", Label: "Manger des churros au chocolat chaud", Icon: "cookie", Minutes: 20, Cost: 1500, Effect: Needs{Hunger: 30, Fun: 15}, MinHour: 8, MaxHour: 23, Places: []string{"cdmx-churreria"}},
		{ID: "pap-griot", Label: "Manger un griot avec du pikliz et des bananes pesées", Icon: "drumstick", Minutes: 40, Cost: 2500, Effect: Needs{Hunger: 65, Fun: 10, Social: 10}, MinHour: 11, MaxHour: 22, Places: []string{"pap-restaurant", "pap-griot", "cap-haitien-diner"}},
		{ID: "habana-ropa-vieja", Label: "Manger une ropa vieja au paladar", Icon: "utensils", Minutes: 45, Cost: 4000, Effect: Needs{Hunger: 65, Social: 10}, MinHour: 12, MaxHour: 23, Places: []string{"habana-paladar"}},
		{ID: "habana-helado", Label: "Faire la queue pour une glace", Icon: "ice-cream-cone", Minutes: 40, Cost: 300, Effect: Needs{Hunger: 15, Fun: 15, Social: 15}, MinHour: 10, MaxHour: 22, Places: []string{"habana-heladeria"}},
		{ID: "bogota-ajiaco", Label: "Manger un ajiaco santafereño", Icon: "soup", Minutes: 40, Cost: 3000, Effect: Needs{Hunger: 65, Energy: 5}, MinHour: 11, MaxHour: 17, Places: []string{"bogota-ajiaco"}},
		{ID: "baires-asado", Label: "Manger un asado à la parrilla", Icon: "beef", Minutes: 60, Cost: 9000, Effect: Needs{Hunger: 80, Social: 15}, MinHour: 12, MaxHour: 24, Places: []string{"baires-parrilla", "montevideo-diner"}},
		{ID: "baires-mate", Label: "Partager un maté et des medialunas au café", Icon: "coffee", Minutes: 40, Cost: 2000, Effect: Needs{Hunger: 20, Social: 25, Energy: 10}, MinHour: 7, MaxHour: 20, Places: []string{"baires-cafe", "asuncion-diner"}},
		{ID: "lima-ceviche", Label: "Manger un ceviche", Icon: "fish", Minutes: 40, Cost: 5000, Effect: Needs{Hunger: 55, Fun: 15}, MinHour: 11, MaxHour: 17, Places: []string{"lima-diner"}},
		{ID: "caracas-arepa", Label: "Manger une arepa reina pepiada", Icon: "sandwich", Minutes: 20, Cost: 1500, Effect: Needs{Hunger: 45}, MinHour: 6, MaxHour: 23, Places: []string{"caracas-diner"}},
		{ID: "la-paz-saltena", Label: "Manger une salteña le matin", Icon: "croissant", Minutes: 15, Cost: 800, Effect: Needs{Hunger: 35}, MinHour: 7, MaxHour: 12, Places: []string{"la-paz-diner", "santa-cruz-diner"}},
		{ID: "guayaquil-encebollado", Label: "Manger un encebollado de poisson", Icon: "soup", Minutes: 25, Cost: 2000, Effect: Needs{Hunger: 55, Energy: 10}, MinHour: 6, MaxHour: 14, Places: []string{"guayaquil-diner", "quito-diner"}},
		{ID: "kingston-jerk", Label: "Manger un poulet jerk au fumoir", Icon: "flame", Minutes: 30, Cost: 3000, Effect: Needs{Hunger: 60, Fun: 10}, MinHour: 11, MaxHour: 24, Places: []string{"kingston-diner"}},
		{ID: "port-of-spain-doubles", Label: "Manger des doubles au coin de la rue", Icon: "sandwich", Minutes: 15, Cost: 800, Effect: Needs{Hunger: 35, Fun: 10}, MinHour: 6, MaxHour: 13, Places: []string{"port-of-spain-diner"}},
		{ID: "san-juan-mofongo", Label: "Manger un mofongo", Icon: "utensils", Minutes: 40, Cost: 5000, Effect: Needs{Hunger: 65}, MinHour: 11, MaxHour: 23, Places: []string{"san-juan-diner"}},
		{ID: "saint-domingue-bandera", Label: "Manger « la bandera » : riz, haricots et viande", Icon: "utensils", Minutes: 30, Cost: 2500, Effect: Needs{Hunger: 65}, MinHour: 11, MaxHour: 16, Places: []string{"saint-domingue-diner"}},
		{ID: "antilles-bokit", Label: "Manger un bokit", Icon: "sandwich", Minutes: 20, Cost: 2000, Effect: Needs{Hunger: 50, Fun: 5}, MinHour: 11, MaxHour: 24, Places: []string{"pointe-a-pitre-diner"}},
		{ID: "antilles-colombo", Label: "Manger un colombo de poulet", Icon: "cooking-pot", Minutes: 40, Cost: 4500, Effect: Needs{Hunger: 65}, MinHour: 11, MaxHour: 22, Places: []string{"fort-de-france-diner", "pointe-a-pitre-diner", "cayenne-diner"}},
		{ID: "georgetown-pepperpot", Label: "Manger un pepperpot", Icon: "cooking-pot", Minutes: 40, Cost: 3000, Effect: Needs{Hunger: 65}, MinHour: 11, MaxHour: 22, Places: []string{"georgetown-diner"}},
		{ID: "paramaribo-roti", Label: "Manger un roti au poulet", Icon: "utensils", Minutes: 30, Cost: 2500, Effect: Needs{Hunger: 60}, MinHour: 11, MaxHour: 22, Places: []string{"paramaribo-diner"}},
		{ID: "centramerica-pupusas", Label: "Manger des pupusas au fromage et aux haricots", Icon: "utensils", Minutes: 25, Cost: 1000, Effect: Needs{Hunger: 50, Social: 5}, MinHour: 16, MaxHour: 22, Places: []string{"san-salvador-diner"}},
		{ID: "centramerica-baleada", Label: "Manger une baleada", Icon: "sandwich", Minutes: 15, Cost: 800, Effect: Needs{Hunger: 40}, MinHour: 6, MaxHour: 22, Places: []string{"tegucigalpa-diner", "san-pedro-sula-diner"}},
		{ID: "centramerica-gallo-pinto", Label: "Manger un gallo pinto au petit déjeuner", Icon: "egg", Minutes: 25, Cost: 1500, Effect: Needs{Hunger: 50, Energy: 10}, MinHour: 6, MaxHour: 11, Places: []string{"san-jose-diner", "managua-diner"}},
		{ID: "guatemala-pepian", Label: "Manger un pepián", Icon: "soup", Minutes: 40, Cost: 2500, Effect: Needs{Hunger: 60}, MinHour: 11, MaxHour: 20, Places: []string{"guatemala-diner"}},
		{ID: "panama-sancocho", Label: "Manger un sancocho panaméen", Icon: "soup", Minutes: 35, Cost: 2500, Effect: Needs{Hunger: 60, Energy: 5}, MinHour: 11, MaxHour: 21, Places: []string{"panama-diner"}},
		{ID: "santiago-pastel-choclo", Label: "Manger un pastel de choclo", Icon: "utensils", Minutes: 40, Cost: 4000, Effect: Needs{Hunger: 65}, MinHour: 12, MaxHour: 22, Places: []string{"santiago-diner"}},
	},
	"club": {
		{ID: "saopaulo-roda-samba", Ages: Adults, Label: "Écouter une roda de samba au Bixiga", Icon: "music", Minutes: 2 * 60, Cost: 4000, Effect: Needs{Fun: 45, Social: 30, Energy: -20}, MinHour: 20, MaxHour: 2, Places: []string{"saopaulo-bar", "rio-roda"}},
		{ID: "salvador-tambours", Label: "Jouer du tambour avec un bloco afro", Icon: "drum", Minutes: 90, Cost: 3000, Effect: Needs{Fun: 50, Social: 30, Energy: -20}, MinHour: 17, MaxHour: 23, Places: []string{"salvador-bloco"}},
		{ID: "cdmx-danzon", Label: "Danser le danzón au salon de bal", Icon: "music", Minutes: 90, Cost: 3000, Effect: Needs{Fun: 40, Social: 30, Energy: -15}, MinHour: 17, MaxHour: 23, Places: []string{"cdmx-salon"}},
		{ID: "pap-konpa", Ages: Adults, Label: "Danser le konpa", Icon: "music", Minutes: 2 * 60, Cost: 2500, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 21, MaxHour: 3, Places: []string{"pap-club", "cap-haitien-club"}},
		{ID: "habana-son", Label: "Écouter un groupe de son cubain", Icon: "music", Minutes: 90, Cost: 3000, Effect: Needs{Fun: 45, Social: 20, Energy: -10}, MinHour: 18, MaxHour: 24, Places: []string{"habana-son"}},
		{ID: "habana-salsa", Label: "Prendre un cours de salsa", Icon: "music", Minutes: 60, Cost: 4000, Effect: Needs{Fun: 40, Social: 25, Energy: -20}, MinHour: 16, MaxHour: 22, Places: []string{"habana-casa-musica", "bogota-salsa"}},
		{ID: "cartagena-champeta", Ages: Adults, Label: "Danser la champeta à Getsemaní", Icon: "music", Minutes: 2 * 60, Cost: 3000, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 21, MaxHour: 3, Places: []string{"cartagena-champeta"}},
		{ID: "baires-tango", Label: "Apprendre le tango à la milonga", Icon: "music", Minutes: 90, Cost: 4000, Effect: Needs{Fun: 40, Social: 30, Energy: -15}, MinHour: 19, MaxHour: 2, Places: []string{"baires-milonga"}},
		{ID: "montevideo-candombe", Label: "Suivre les tambours du candombe", Icon: "drum", Minutes: 60, Cost: 1000, Effect: Needs{Fun: 40, Social: 25, Energy: -10}, MinHour: 18, MaxHour: 23, Days: Weekend, Places: []string{"montevideo-club"}},
		{ID: "port-of-spain-steelpan", Label: "Jouer du steelpan au pan yard", Icon: "drum", Minutes: 90, Cost: 2000, Effect: Needs{Fun: 45, Social: 25, Energy: -10}, MinHour: 17, MaxHour: 23, Places: []string{"port-of-spain-club"}},
		{ID: "saint-domingue-merengue", Ages: Adults, Label: "Danser le merengue et la bachata", Icon: "music", Minutes: 2 * 60, Cost: 3000, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 21, MaxHour: 3, Places: []string{"saint-domingue-club", "san-juan-club"}},
		{ID: "antilles-gwoka", Label: "Danser au son du gwoka et du zouk", Icon: "drum", Minutes: 90, Cost: 2500, Effect: Needs{Fun: 45, Social: 25, Energy: -20}, MinHour: 19, MaxHour: 2, Places: []string{"pointe-a-pitre-club", "fort-de-france-club", "cayenne-club"}},
		{ID: "kingston-dancehall", Ages: Adults, Label: "Danser au sound system du dancehall", Icon: "speaker", Minutes: 2 * 60, Cost: 2500, Effect: Needs{Fun: 45, Social: 30, Energy: -25}, MinHour: 22, MaxHour: 4, Places: []string{"kingston-club"}},
	},
	"culture": {
		{ID: "rio-cristo", Label: "Monter voir le Christ Rédempteur par le petit train du Corcovado", Icon: "mountain", Minutes: 90, Cost: 9000, Effect: Needs{Fun: 55, Energy: -10}, MinHour: 8, MaxHour: 19, Places: []string{"rio-cristo"}},
		{ID: "rio-selaron", Label: "Se prendre en photo sur l'escalier Selarón", Icon: "camera", Minutes: 20, Effect: Needs{Fun: 25, Social: 5}, MinHour: 7, MaxHour: 21, Places: []string{"rio-selaron"}},
		{ID: "saopaulo-masp", Label: "Visiter le MASP et ses tableaux sur chevalets de verre", Icon: "palette", Minutes: 75, Cost: 5000, Effect: Needs{Fun: 35, Social: 5}, MinHour: 10, MaxHour: 18, Places: []string{"saopaulo-masp"}},
		{ID: "salvador-por-do-sol", Label: "Applaudir le coucher du soleil au phare de Barra", Icon: "sunset", Minutes: 40, Effect: Needs{Fun: 35, Social: 15}, MinHour: 16, MaxHour: 19, Places: []string{"salvador-farol"}},
		{ID: "cdmx-frida", Label: "Visiter la Casa Azul de Frida Kahlo", Icon: "palette", Minutes: 75, Cost: 6000, Effect: Needs{Fun: 40, Social: 5}, MinHour: 10, MaxHour: 18, Places: []string{"cdmx-casa-azul"}},
		{ID: "cdmx-bellas-artes", Label: "Voir le ballet folklorique au palais des Beaux-Arts", Icon: "drama", Minutes: 2 * 60, Cost: 12000, Effect: Needs{Fun: 50, Social: 15, Energy: -5}, MinHour: 19, MaxHour: 22, Days: []int{Mercredi, Dimanche}, Places: []string{"cdmx-bellas-artes"}},
		{ID: "cdmx-templo-mayor", Label: "Visiter le Templo Mayor aztèque", Icon: "landmark", Minutes: 60, Cost: 1500, Effect: Needs{Fun: 35}, MinHour: 9, MaxHour: 17, Places: []string{"cdmx-templo-mayor"}},
		{ID: "cdmx-antropologia", Label: "Voir la pierre du Soleil au musée d'Anthropologie", Icon: "landmark", Minutes: 90, Cost: 2500, Effect: Needs{Fun: 40, Energy: -5}, MinHour: 9, MaxHour: 18, Places: []string{"cdmx-antropologia"}},
		{ID: "cancun-museo-maya", Label: "Visiter le musée maya et les ruines de San Miguelito", Icon: "landmark", Minutes: 75, Cost: 4000, Effect: Needs{Fun: 35}, MinHour: 9, MaxHour: 17, Places: []string{"cancun-museo-maya"}},
		{ID: "pap-mupanah", Label: "Visiter le MUPANAH et l'ancre de la Santa María", Icon: "landmark", Minutes: 60, Cost: 1000, Effect: Needs{Fun: 35, Social: 5}, MinHour: 9, MaxHour: 16, Places: []string{"pap-mupanah"}},
		{ID: "pap-marron", Label: "S'arrêter devant le Marron inconnu", Icon: "flag", Minutes: 15, Effect: Needs{Fun: 15, Social: 10}, MinHour: 7, MaxHour: 20, Places: []string{"pap-marron"}},
		{ID: "pap-galerie", Label: "Regarder les peintres d'art naïf au travail", Icon: "palette", Minutes: 45, Effect: Needs{Fun: 30, Social: 10}, MinHour: 9, MaxHour: 18, Places: []string{"pap-galerie"}},
		{ID: "caphaitien-citadelle", Label: "Monter à la Citadelle Laferrière", Icon: "castle", Minutes: 3 * 60, Cost: 3000, Effect: Needs{Fun: 55, Energy: -30, Social: 10}, MinHour: 8, MaxHour: 16, Places: []string{"cap-haitien-citadelle"}},
		{ID: "caphaitien-sans-souci", Label: "Visiter les ruines du palais Sans-Souci", Icon: "landmark", Minutes: 60, Cost: 1500, Effect: Needs{Fun: 35}, MinHour: 8, MaxHour: 17, Places: []string{"cap-haitien-sans-souci"}},
		{ID: "habana-capitolio", Label: "Visiter le Capitole de La Havane", Icon: "landmark", Minutes: 60, Cost: 2500, Effect: Needs{Fun: 30}, MinHour: 9, MaxHour: 17, Places: []string{"habana-capitolio"}},
		{ID: "bogota-museo-oro", Label: "Visiter le musée de l'Or", Icon: "gem", Minutes: 75, Cost: 1000, Effect: Needs{Fun: 40}, MinHour: 9, MaxHour: 18, Places: []string{"bogota-museo-oro"}},
		{ID: "cartagena-san-felipe", Label: "Visiter le château San Felipe et ses souterrains", Icon: "castle", Minutes: 75, Cost: 6000, Effect: Needs{Fun: 40, Energy: -10}, MinHour: 8, MaxHour: 18, Places: []string{"cartagena-san-felipe"}},
		{ID: "baires-colon", Label: "Visiter le Teatro Colón", Icon: "drama", Minutes: 60, Cost: 10000, Effect: Needs{Fun: 40}, MinHour: 9, MaxHour: 17, Places: []string{"baires-colon"}},
		{ID: "panama-miraflores", Label: "Regarder un cargo passer les écluses de Miraflores", Icon: "ship", Minutes: 60, Cost: 6000, Effect: Needs{Fun: 40}, MinHour: 8, MaxHour: 18, Places: []string{"panama-miraflores"}},
		{ID: "kingston-bob-marley", Label: "Visiter la maison de Bob Marley", Icon: "music", Minutes: 60, Cost: 8000, Effect: Needs{Fun: 40, Social: 5}, MinHour: 9, MaxHour: 17, Places: []string{"kingston-bob-marley"}},
		{ID: "pointe-a-pitre-memorial", Label: "Visiter le Mémorial ACTe", Icon: "landmark", Minutes: 90, Cost: 7000, Effect: Needs{Fun: 30, Social: 10}, MinHour: 9, MaxHour: 18, Places: []string{"pointe-a-pitre-memorial"}},
		{ID: "san-juan-morro", Label: "Faire voler un cerf-volant sur la pelouse du Morro", Icon: "flag", Minutes: 60, Cost: 1500, Effect: Needs{Fun: 40, Social: 10}, MinHour: 9, MaxHour: 18, Places: []string{"san-juan-morro"}},
	},
	"nature": {
		{ID: "rio-bondinho", Label: "Monter au Pain de Sucre en téléphérique", Icon: "mountain", Minutes: 90, Cost: 18000, Effect: Needs{Fun: 55, Energy: -5}, MinHour: 8, MaxHour: 21, Places: []string{"rio-pao-de-acucar"}},
		{ID: "saopaulo-ibirapuera", Label: "Courir au parc Ibirapuera", Icon: "footprints", Minutes: 45, Effect: Needs{Fun: 20, Energy: -20, Hygiene: -15}, MinHour: 5, MaxHour: 22, Places: []string{"saopaulo-ibirapuera"}},
		{ID: "bogota-monserrate", Label: "Monter à Monserrate en téléphérique", Icon: "mountain", Minutes: 90, Cost: 5000, Effect: Needs{Fun: 45, Energy: -10}, MinHour: 6, MaxHour: 21, Places: []string{"bogota-monserrate"}},
		{ID: "cartagena-murallas", Label: "Marcher sur les remparts au coucher du soleil", Icon: "sunset", Minutes: 45, Effect: Needs{Fun: 35, Social: 10}, MinHour: 16, MaxHour: 20, Places: []string{"cartagena-murallas"}},
	},
	"beach": {
		{ID: "rio-futevolei", Label: "Jouer au foot-volley sur la plage de Copacabana", Icon: "volleyball", Minutes: 45, Effect: Needs{Fun: 40, Social: 25, Energy: -25, Hygiene: -15}, MinHour: 7, MaxHour: 19, Places: []string{"rio-copacabana", "rio-ipanema"}},
		{ID: "cancun-letras", Label: "Se prendre en photo devant les grandes lettres de Cancún", Icon: "camera", Minutes: 20, Effect: Needs{Fun: 25, Social: 5}, MinHour: 7, MaxHour: 19, Places: []string{"cancun-delfines"}},
	},
	"rue": {
		{ID: "saopaulo-paulista-dimanche", Label: "Se promener sur l'avenue Paulista fermée aux voitures", Icon: "footprints", Minutes: 60, Effect: Needs{Fun: 35, Social: 20}, MinHour: 9, MaxHour: 18, Days: []int{Dimanche}, Places: []string{"saopaulo-paulista"}},
		{ID: "cdmx-bandera", Label: "Voir lever le drapeau géant sur le Zócalo", Icon: "flag", Minutes: 30, Effect: Needs{Fun: 25, Social: 10}, MinHour: 7, MaxHour: 9, Places: []string{"cdmx-zocalo"}},
		{ID: "cancun-marquesita", Label: "Manger une marquesita au parc des Palapas", Icon: "cookie", Minutes: 20, Cost: 800, Effect: Needs{Hunger: 25, Fun: 15, Social: 10}, MinHour: 17, MaxHour: 23, Places: []string{"cancun-palapas"}},
		{ID: "habana-malecon", Label: "S'asseoir sur le Malecón au coucher du soleil", Icon: "sunset", Minutes: 45, Effect: Needs{Fun: 30, Social: 20}, MinHour: 17, MaxHour: 23, Places: []string{"habana-malecon"}},
		{ID: "habana-vieille-voiture", Label: "Faire un tour en vieille voiture décapotable", Icon: "car", Minutes: 60, Cost: 15000, Effect: Needs{Fun: 45, Social: 10}, MinHour: 9, MaxHour: 20, Places: []string{"habana-prado"}},
		{ID: "bogota-fresques", Label: "Faire le tour des fresques de la Candelaria", Icon: "palette", Minutes: 60, Effect: Needs{Fun: 30, Social: 10, Energy: -10}, MinHour: 9, MaxHour: 17, Places: []string{"bogota-plaza-bolivar"}},
		{ID: "baires-caminito", Label: "Regarder danser le tango dans le Caminito", Icon: "music", Minutes: 40, Effect: Needs{Fun: 30, Social: 10}, MinHour: 10, MaxHour: 19, Places: []string{"baires-caminito"}},
	},
	"market": {
		{ID: "saopaulo-mortadela", Label: "Manger le sandwich à la mortadelle du Mercadão", Icon: "sandwich", Minutes: 30, Cost: 3500, Effect: Needs{Hunger: 60, Fun: 10}, MinHour: 7, MaxHour: 18, Places: []string{"saopaulo-mercadao"}},
		{ID: "pap-marche-fer", Label: "Marchander au Marché en fer", Icon: "hand-coins", Minutes: 45, Cost: 2000, Effect: Needs{Fun: 20, Social: 25, Hunger: 5}, MinHour: 7, MaxHour: 17, Places: []string{"pap-marche-fer", "pap-marche-pv"}},
		{ID: "la-paz-brujas", Label: "Flâner au marché des Sorcières", Icon: "sparkles", Minutes: 40, Cost: 1500, Effect: Needs{Fun: 25, Social: 10}, MinHour: 9, MaxHour: 19, Places: []string{"la-paz-brujas"}},
	},
	"worship": {
		{ID: "salvador-fitas", Label: "Nouer un ruban du Bonfim et faire trois vœux", Icon: "sparkles", Minutes: 20, Cost: 500, Effect: Needs{Fun: 20, Social: 10}, MinHour: 6, MaxHour: 18, Places: []string{"salvador-bonfim"}},
		{ID: "salvador-sao-francisco", Label: "Visiter l'église dorée de São Francisco", Icon: "church", Minutes: 40, Cost: 3000, Effect: Needs{Fun: 30}, MinHour: 9, MaxHour: 17, Places: []string{"salvador-sao-francisco"}},
	},
	"gym": {
		{ID: "salvador-capoeira", Label: "Prendre un cours de capoeira au berimbau", Icon: "music", Minutes: 60, Cost: 4000, Effect: Needs{Fun: 40, Social: 20, Energy: -25, Hygiene: -15}, MinHour: 9, MaxHour: 21, Places: []string{"salvador-capoeira"}},
	},
	"transport": {
		{ID: "salvador-lacerda", Label: "Prendre l'ascenseur Lacerda vers la ville basse", Icon: "chevrons-up", Minutes: 15, Cost: 100, Effect: Needs{Fun: 15}, MinHour: 6, MaxHour: 23, Places: []string{"salvador-lacerda"}},
	},
	"sport": {
		{ID: "rio-maracana", Label: "Voir un match au Maracanã", Icon: "trophy", Minutes: 2 * 60, Cost: 12000, Effect: Needs{Fun: 50, Social: 30, Energy: -10}, MinHour: 15, MaxHour: 22, Places: []string{"rio-maracana"}},
		{ID: "baires-bombonera", Label: "Voir un match à la Bombonera", Icon: "trophy", Minutes: 2 * 60, Cost: 20000, Effect: Needs{Fun: 55, Social: 30, Energy: -10}, MinHour: 15, MaxHour: 22, Places: []string{"baires-bombonera"}},
		{ID: "bogota-tejo", Ages: Adults, Label: "Jouer au tejo : lancer le palet sur les mèches", Icon: "target", Minutes: 60, Cost: 2000, Effect: Needs{Fun: 40, Social: 30, Energy: -10}, MinHour: 15, MaxHour: 23, Places: []string{"bogota-tejo"}},
	},
	"boutique": {
		{ID: "cartagena-frutas", Label: "Acheter une salade de fruits tropicaux", Icon: "citrus", Minutes: 15, Cost: 1500, Effect: Needs{Hunger: 25, Fun: 10}, MinHour: 8, MaxHour: 19, Places: []string{"cartagena-frutas"}},
	},
}

func init() {
	for kind, acts := range canadaPlusActs {
		CanadaActs[kind] = append(CanadaActs[kind], acts...)
	}
	addActs(AmeriquesActs)
	villeActs[AmeriquesKey] = AmeriquesActs
}
