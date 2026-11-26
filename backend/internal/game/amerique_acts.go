package game

// The great cities of America's own things to do (world/etats.go, world/amerique.go), each at its famous place
// (Interaction.Places): added to New York's and Montréal's (paysActs.go, whose init runs after this one and
// registers them with the updates « pays-usa » and « pays-canada »).

var usaMore = map[string][]Interaction{
	"culture": {
		{ID: "la-griffith-etoiles", Label: "Regarder les étoiles et le panneau Hollywood depuis l'observatoire Griffith", Icon: "telescope", Minutes: 60, Effect: Needs{Fun: 40, Social: 5}, MinHour: 12, MaxHour: 22, Places: []string{"los-angeles-observatoire-griffith"}},
		{ID: "denver-red-rocks-concert", Ages: TeensUp, Label: "Un concert sous les rochers rouges de Red Rocks", Icon: "music", Minutes: 2 * 60, Cost: 25000, Effect: Needs{Fun: 55, Social: 30, Energy: -15}, MinHour: 19, MaxHour: 23, Places: []string{"denver-red-rocks-amphitheatre"}},
		{ID: "miami-wynwood-graffiti", Label: "Se prendre en photo devant les fresques de Wynwood", Icon: "palette", Minutes: 30, Effect: Needs{Fun: 30, Social: 10}, MinHour: 10, MaxHour: 21, Places: []string{"miami-wynwood-walls"}},
		{ID: "atlanta-mlk-visite", Label: "Visiter la maison natale de Martin Luther King", Icon: "landmark", Minutes: 60, Effect: Needs{Fun: 25, Social: 10}, MinHour: 9, MaxHour: 17, Places: []string{"atlanta-centre-martin-luther-king"}},
		{ID: "atlanta-aquarium-requins", Label: "Voir les requins-baleines de l'aquarium", Icon: "fish", Minutes: 90, Cost: 25000, Effect: Needs{Fun: 50, Social: 10}, MinHour: 9, MaxHour: 21, Places: []string{"atlanta-aquarium-de-georgie"}},
		{ID: "chicago-bean-reflet", Label: "Se voir déformé dans le miroir du « Bean »", Icon: "camera", Minutes: 20, Effect: Needs{Fun: 30, Social: 10}, Places: []string{"chicago-cloud-gate-the-bean"}},
		{ID: "nola-jazz-preservation", Label: "Écouter du jazz à Preservation Hall", Icon: "music", Minutes: 60, Cost: 15000, Effect: Needs{Fun: 50, Social: 15}, MinHour: 17, MaxHour: 24, Places: []string{"new-orleans-preservation-hall"}},
		{ID: "detroit-motown-studio", Label: "Chanter dans le studio A de la Motown", Icon: "mic", Minutes: 60, Cost: 15000, Effect: Needs{Fun: 45, Social: 10}, MinHour: 10, MaxHour: 18, Places: []string{"detroit-musee-motown"}},
		{ID: "stl-arche-sommet", Label: "Monter au sommet de la Gateway Arch", Icon: "arrow-up", Minutes: 60, Cost: 12000, Effect: Needs{Fun: 45, Energy: -5}, MinHour: 8, MaxHour: 22, Places: []string{"st-louis-gateway-arch"}},
		{ID: "vegas-panneau-photo", Label: "La photo devant le panneau « Welcome to Fabulous Las Vegas »", Icon: "camera", Minutes: 20, Effect: Needs{Fun: 30, Social: 10}, Places: []string{"las-vegas-panneau-welcome-to-las-vegas"}},
		{ID: "philly-liberty-bell", Label: "Voir la cloche de la Liberté", Icon: "bell", Minutes: 30, Effect: Needs{Fun: 20, Social: 5}, MinHour: 9, MaxHour: 17, Places: []string{"philadelphia-liberty-bell"}},
		{ID: "philly-rocky-marches", Label: "Monter les marches du musée en courant, comme Rocky", Icon: "footprints", Minutes: 15, Effect: Needs{Fun: 35, Energy: -15, Hygiene: -5}, Places: []string{"philadelphia-marches-de-rocky-musee-d-art"}},
		{ID: "nashville-opry-show", Label: "Voir un show de country au Grand Ole Opry", Icon: "guitar", Minutes: 2 * 60, Cost: 30000, Effect: Needs{Fun: 50, Social: 20}, MinHour: 18, MaxHour: 23, Places: []string{"nashville-grand-ole-opry"}},
		{ID: "houston-fusee", Label: "Voir les fusées et la salle de contrôle de la NASA", Icon: "rocket", Minutes: 2 * 60, Cost: 25000, Effect: Needs{Fun: 50, Social: 10}, MinHour: 10, MaxHour: 17, Places: []string{"houston-space-center-houston"}},
		{ID: "seattle-needle-sommet", Label: "Monter en haut de la Space Needle", Icon: "building-2", Minutes: 45, Cost: 30000, Effect: Needs{Fun: 45, Social: 5}, MinHour: 9, MaxHour: 23, Places: []string{"seattle-space-needle"}},
		{ID: "dc-maison-blanche", Label: "Se prendre en photo devant la Maison-Blanche", Icon: "camera", Minutes: 20, Effect: Needs{Fun: 30, Social: 5}, MinHour: 7, MaxHour: 23, Places: []string{"washington-maison-blanche"}},
		{ID: "dc-lincoln-marches", Label: "S'asseoir sur les marches du Lincoln Memorial face au Mall", Icon: "landmark", Minutes: 30, Effect: Needs{Fun: 25, Energy: 10}, Places: []string{"washington-lincoln-memorial"}},
		{ID: "sf-alcatraz-visite", Label: "Visiter la prison d'Alcatraz", Icon: "lock", Minutes: 2 * 60, Cost: 28000, Effect: Needs{Fun: 45, Social: 10}, MinHour: 9, MaxHour: 18, Places: []string{"san-francisco-alcatraz"}},
		{ID: "dallas-reunion-sommet", Label: "Dîner tout en haut de la Reunion Tower", Icon: "utensils", Minutes: 90, Cost: 35000, Effect: Needs{Hunger: 50, Fun: 30, Social: 15}, MinHour: 17, MaxHour: 23, Places: []string{"dallas-reunion-tower"}},
		{ID: "alamo-visite", Label: "Visiter le fort Alamo", Icon: "castle", Minutes: 60, Effect: Needs{Fun: 25, Social: 5}, MinHour: 9, MaxHour: 17, Places: []string{"san-antonio-fort-alamo"}},
	},
	"nature": {
		{ID: "la-santa-monica-surf", Label: "Prendre une leçon de surf à Santa Monica", Icon: "waves", Minutes: 90, Cost: 20000, Effect: Needs{Fun: 50, Energy: -25, Hygiene: -10}, MinHour: 8, MaxHour: 18, Places: []string{"los-angeles-plage-de-santa-monica"}},
		{ID: "miami-south-beach-plage", Label: "Bronzer à South Beach", Icon: "sun", Minutes: 60, Effect: Needs{Fun: 35, Energy: 10, Hygiene: -10}, MinHour: 8, MaxHour: 19, Places: []string{"miami-south-beach"}},
		{ID: "honolulu-waikiki-surf", Label: "Surfer les vagues de Waikiki", Icon: "waves", Minutes: 90, Cost: 15000, Effect: Needs{Fun: 55, Energy: -25, Hygiene: -10}, MinHour: 7, MaxHour: 18, Places: []string{"honolulu-plage-de-waikiki"}},
		{ID: "honolulu-diamond-head-rando", Label: "Grimper au cratère de Diamond Head", Icon: "mountain", Minutes: 90, Effect: Needs{Fun: 40, Energy: -25}, MinHour: 6, MaxHour: 16, Places: []string{"honolulu-diamond-head"}},
		{ID: "rushmore-visite", Label: "Voir les quatre présidents sculptés du mont Rushmore", Icon: "mountain", Minutes: 60, Cost: 8000, Effect: Needs{Fun: 40, Social: 5}, MinHour: 8, MaxHour: 21, Places: []string{"rapid-city-mont-rushmore"}},
		{ID: "austin-zilker-baignade", Label: "Se baigner à la source de Barton Springs, dans Zilker Park", Icon: "waves", Minutes: 60, Cost: 3000, Effect: Needs{Fun: 40, Hygiene: 15, Energy: -10}, MinHour: 8, MaxHour: 21, Places: []string{"austin-parc-zilker"}},
		{ID: "sd-la-jolla-phoques", Label: "Regarder les phoques et les otaries de La Jolla", Icon: "fish", Minutes: 45, Effect: Needs{Fun: 35}, MinHour: 7, MaxHour: 19, Places: []string{"san-diego-plage-de-la-jolla"}},
	},
	"rue": {
		{ID: "la-walk-of-fame-etoile", Label: "Chercher l'étoile de ta star sur le Walk of Fame", Icon: "star", Minutes: 30, Effect: Needs{Fun: 30, Social: 10}, Places: []string{"los-angeles-hollywood-walk-of-fame"}},
		{ID: "miami-cafecito", Label: "Prendre un cafecito cubain sur la Calle Ocho", Icon: "coffee", Minutes: 15, Cost: 1500, Effect: Needs{Fun: 15, Energy: 15, Social: 10}, MinHour: 7, MaxHour: 23, Places: []string{"miami-little-havana"}},
		{ID: "chicago-navy-pier-roue", Label: "Faire un tour de grande roue à Navy Pier", Icon: "ferris-wheel", Minutes: 30, Cost: 10000, Effect: Needs{Fun: 40, Social: 10}, MinHour: 10, MaxHour: 22, Places: []string{"chicago-navy-pier"}},
		{ID: "nola-bourbon-parade", Ages: Adults, Label: "Suivre la fanfare sur Bourbon Street", Icon: "music", Minutes: 60, Cost: 5000, Effect: Needs{Fun: 50, Social: 30, Energy: -15}, MinHour: 18, MaxHour: 3, Places: []string{"new-orleans-quartier-francais-bourbon-st"}},
		{ID: "vegas-strip-fontaines", Label: "Regarder les fontaines dansantes du Strip", Icon: "sparkles", Minutes: 30, Effect: Needs{Fun: 40, Social: 10}, MinHour: 15, MaxHour: 24, Places: []string{"las-vegas-le-strip"}},
		{ID: "vegas-fremont-tyrolienne", Label: "Glisser en tyrolienne au-dessus de Fremont Street", Icon: "zap", Minutes: 20, Cost: 30000, Effect: Needs{Fun: 55, Energy: -5}, MinHour: 12, MaxHour: 24, Places: []string{"las-vegas-fremont-street"}},
		{ID: "nashville-honky-tonk", Ages: Adults, Label: "Danser la country dans un honky-tonk de Broadway", Icon: "music", Minutes: 90, Cost: 8000, Effect: Needs{Fun: 50, Social: 30, Energy: -20}, MinHour: 14, MaxHour: 3, Places: []string{"nashville-broadway-honky-tonks"}},
		{ID: "sf-golden-gate-velo", Label: "Traverser le Golden Gate à vélo", Icon: "bike", Minutes: 60, Cost: 10000, Effect: Needs{Fun: 45, Energy: -20}, MinHour: 7, MaxHour: 19, Places: []string{"san-francisco-golden-gate-bridge"}},
		{ID: "sf-clam-chowder", Label: "Manger une clam chowder dans un pain au levain", Icon: "soup", Minutes: 30, Cost: 9000, Effect: Needs{Hunger: 55, Fun: 10}, MinHour: 11, MaxHour: 22, Places: []string{"san-francisco-fisherman-s-wharf"}},
		{ID: "austin-6th-concert", Ages: TeensUp, Label: "Écouter un groupe live sur Sixth Street", Icon: "guitar", Minutes: 90, Cost: 6000, Effect: Needs{Fun: 45, Social: 25, Energy: -10}, MinHour: 18, MaxHour: 2, Places: []string{"austin-sixth-street"}},
		{ID: "sa-river-walk-bateau", Label: "Une balade en bateau sur le River Walk", Icon: "ship", Minutes: 40, Cost: 9000, Effect: Needs{Fun: 35, Social: 10}, MinHour: 9, MaxHour: 22, Places: []string{"san-antonio-river-walk"}},
	},
	"sport": {
		{ID: "chicago-cubs-match", Label: "Voir un match des Cubs à Wrigley Field", Icon: "trophy", Minutes: 3 * 60, Cost: 28000, Effect: Needs{Fun: 50, Social: 30, Energy: -10}, MinHour: 12, MaxHour: 22, Places: []string{"chicago-wrigley-field"}},
		{ID: "boston-red-sox-match", Label: "Voir les Red Sox à Fenway Park", Icon: "trophy", Minutes: 3 * 60, Cost: 30000, Effect: Needs{Fun: 50, Social: 30, Energy: -10}, MinHour: 12, MaxHour: 22, Places: []string{"boston-fenway-park"}},
		{ID: "dallas-cowboys-match", Label: "Voir un match de football américain des Cowboys", Icon: "trophy", Minutes: 3 * 60, Cost: 40000, Effect: Needs{Fun: 55, Social: 30, Energy: -10}, MinHour: 12, MaxHour: 23, Places: []string{"dallas-at-t-stadium"}},
		{ID: "seattle-seahawks-match", Label: "Crier avec le « 12e homme » des Seahawks", Icon: "trophy", Minutes: 3 * 60, Cost: 35000, Effect: Needs{Fun: 55, Social: 30, Energy: -15}, MinHour: 12, MaxHour: 23, Places: []string{"seattle-lumen-field"}},
	},
	"market": {
		{ID: "seattle-pike-poissons", Label: "Voir les poissonniers lancer les saumons à Pike Place", Icon: "fish", Minutes: 30, Effect: Needs{Fun: 35, Social: 15}, MinHour: 9, MaxHour: 18, Places: []string{"seattle-pike-place-market"}},
		{ID: "philly-cheesesteak", Label: "Manger un cheesesteak à Reading Terminal", Icon: "sandwich", Minutes: 25, Cost: 8000, Effect: Needs{Hunger: 60, Fun: 10}, MinHour: 8, MaxHour: 18, Places: []string{"philadelphia-reading-terminal-market"}},
		{ID: "boston-clam-faneuil", Label: "Goûter une soupe de palourdes à Faneuil Hall", Icon: "soup", Minutes: 25, Cost: 7000, Effect: Needs{Hunger: 45, Fun: 10}, MinHour: 10, MaxHour: 21, Places: []string{"boston-faneuil-hall"}},
	},
}

var canadaMore = map[string][]Interaction{
	"culture": {
		{ID: "toronto-cn-plancher-verre", Label: "Marcher sur le plancher de verre de la tour CN", Icon: "building-2", Minutes: 60, Cost: 30000, Effect: Needs{Fun: 50, Energy: -5}, MinHour: 9, MaxHour: 22, Places: []string{"toronto-tour-cn"}},
		{ID: "ottawa-releve-garde", Label: "Voir la relève de la garde sur la colline du Parlement", Icon: "landmark", Minutes: 45, Effect: Needs{Fun: 30, Social: 10}, MinHour: 9, MaxHour: 12, Places: []string{"ottawa-colline-du-parlement"}},
		{ID: "quebec-frontenac-terrasse", Label: "Se promener sur la terrasse Dufferin, au pied du Château Frontenac", Icon: "castle", Minutes: 45, Effect: Needs{Fun: 35, Social: 10}, Places: []string{"quebec-chateau-frontenac"}},
		{ID: "calgary-stampede-rodeo", Label: "Voir le rodéo du Stampede", Icon: "trophy", Minutes: 2 * 60, Cost: 25000, Effect: Needs{Fun: 50, Social: 25, Energy: -10}, MinHour: 12, MaxHour: 22, Places: []string{"calgary-parc-du-stampede"}},
	},
	"nature": {
		{ID: "ottawa-canal-patin", Label: "Patiner sur le canal Rideau gelé", Icon: "snowflake", Minutes: 60, Cost: 3000, Effect: Needs{Fun: 45, Energy: -15, Social: 10}, MinHour: 8, MaxHour: 22, Places: []string{"ottawa-canal-rideau"}},
		{ID: "vancouver-stanley-velo", Label: "Faire le tour du parc Stanley à vélo, sur la digue", Icon: "bike", Minutes: 90, Cost: 8000, Effect: Needs{Fun: 40, Energy: -20}, MinHour: 7, MaxHour: 20, Places: []string{"vancouver-parc-stanley"}},
		{ID: "quebec-plaines-glissade", Label: "Glisser en traîne sauvage sur les plaines d'Abraham", Icon: "snowflake", Minutes: 45, Effect: Needs{Fun: 45, Energy: -10, Social: 10}, MinHour: 9, MaxHour: 20, Places: []string{"quebec-plaines-d-abraham"}},
	},
	"rue": {
		{ID: "quebec-petit-champlain", Label: "Flâner dans la rue du Petit-Champlain", Icon: "footprints", Minutes: 40, Effect: Needs{Fun: 30, Social: 10}, MinHour: 9, MaxHour: 22, Places: []string{"quebec-rue-du-petit-champlain"}},
		{ID: "vancouver-horloge-vapeur", Label: "Attendre le sifflet de l'horloge à vapeur de Gastown", Icon: "clock", Minutes: 15, Effect: Needs{Fun: 20, Social: 5}, Places: []string{"vancouver-gastown"}},
		{ID: "toronto-distillerie-balade", Label: "Se balader dans les rues pavées du quartier de la Distillerie", Icon: "footprints", Minutes: 40, Effect: Needs{Fun: 30, Social: 10}, MinHour: 10, MaxHour: 22, Places: []string{"toronto-quartier-de-la-distillerie"}},
	},
	"market": {
		{ID: "ottawa-queue-castor", Label: "Manger une queue de castor au marché By", Icon: "cookie", Minutes: 15, Cost: 3500, Effect: Needs{Hunger: 30, Fun: 15}, MinHour: 9, MaxHour: 22, Places: []string{"ottawa-marche-by"}},
		{ID: "vancouver-granville-fruits-mer", Label: "Goûter les fruits de mer du marché de Granville Island", Icon: "fish", Minutes: 40, Cost: 12000, Effect: Needs{Hunger: 50, Fun: 15}, MinHour: 9, MaxHour: 19, Places: []string{"vancouver-marche-de-granville-island"}},
	},
}

func init() {
	for k, acts := range usaMore {
		USAActs[k] = append(USAActs[k], acts...)
	}
	for k, acts := range canadaMore {
		CanadaActs[k] = append(CanadaActs[k], acts...)
	}
}
