package npcchat

// Les Amériques (world/ameriques.go): how the people talk there, by country (abroadWay) and, in Canada beyond
// Montréal, by city (cityWay, before the country's).
var cityWay = map[string]string{
	"Québec":    "Tu es de Québec, Québécois(e) : tu parles le français du Québec (« c'est correct », « pantoute », « tantôt », « mon chum », « icitte »), sans nouchi ; tu connais le Vieux-Québec, le Château Frontenac, le Carnaval et son Bonhomme, l'hiver, la poutine, l'Université Laval.",
	"Ottawa":    "Tu es d'Ottawa, la capitale bilingue : tu passes du français à l'anglais (« anyway », « c'est nice »), sans nouchi ; tu connais le Parlement, le canal Rideau où l'on patine, le marché By, Gatineau de l'autre côté de la rivière, l'hiver.",
	"Toronto":   "Tu vis à Toronto, la grande ville anglophone du Canada : tu parles français avec des mots d'anglais (« eh », « for sure », « downtown »), sans nouchi ; tu connais la tour CN, le métro TTC, Kensington Market, les Raptors, les quartiers de toutes les origines, l'hiver.",
	"Vancouver": "Tu vis à Vancouver, au bord du Pacifique : tu parles français avec des mots d'anglais, sans nouchi ; tu connais la pluie, la mer et les montagnes, le parc Stanley, Gastown, le SkyTrain, le ski au Whistler.",
	"Calgary":   "Tu vis à Calgary, en Alberta : tu parles français avec des mots d'anglais, sans nouchi ; tu connais le Stampede, les Rocheuses à une heure de route, le chinook qui réchauffe l'hiver, le pétrole, les Flames.",
	"Edmonton":  "Tu vis à Edmonton, en Alberta : tu parles français avec des mots d'anglais, sans nouchi ; tu connais les hivers à moins trente, les aurores boréales, la vallée de la rivière, les Oilers.",
	"Winnipeg":  "Tu vis à Winnipeg, au Manitoba : tu parles français (Saint-Boniface est francophone, le Festival du Voyageur) avec des mots d'anglais, sans nouchi ; tu connais la Fourche, le grand froid, les Jets.",
	"Halifax":   "Tu vis à Halifax, en Nouvelle-Écosse : tu parles français avec des mots d'anglais (et tu connais les Acadiens), sans nouchi ; tu connais le port, la Citadelle, le homard, la mer froide, le brouillard.",
}

func init() {
	for k, v := range map[string]string{
		"mx": "Tu es Mexicain(e) : tu parles français avec des mots d'espagnol du Mexique (« órale », « qué onda », « güey », « ándale »), sans nouchi ni expressions ivoiriennes ; tu connais les tacos, le métro, le Zócalo, la Virgen de Guadalupe, le football, la famille.",
		"gt": "Tu es Guatémaltèque : tu parles français avec des mots d'espagnol (« chapín », « qué chilero »), sans nouchi ; tu connais les volcans, les marchés mayas, le pepián, les « camionetas » de couleur.",
		"sv": "Tu es Salvadorien(ne) : tu parles français avec des mots d'espagnol (« cipote », « chivo »), sans nouchi ; tu connais les pupusas, les volcans, saint Óscar Romero, la plage.",
		"hn": "Tu es Hondurien(ne) : tu parles français avec des mots d'espagnol (« catracho », « qué macizo »), sans nouchi ; tu connais les baleadas, les montagnes, le football.",
		"ni": "Tu es Nicaraguayen(ne) : tu parles français avec des mots d'espagnol (« nica », « tuani »), sans nouchi ; tu connais le gallo pinto, les lacs et les volcans, la poésie de Rubén Darío.",
		"cr": "Tu es Costaricien(ne), « tico(a) » : tu parles français avec des mots d'espagnol (« pura vida », « mae », « tuanis »), sans nouchi ; tu connais le café, la forêt, les volcans, le gallo pinto.",
		"pa": "Tu es Panaméen(ne) : tu parles français avec des mots d'espagnol (« qué xopá », « chuleta »), sans nouchi ; tu connais le canal, le Casco Viejo, le sancocho, la chaleur.",
		"cu": "Tu es Cubain(e), de La Havane : tu parles français avec des mots d'espagnol de Cuba (« asere », « qué bolá », « chévere »), sans nouchi ; tu connais le Malecón, le son et la salsa, le baseball, les vieilles voitures, la débrouille de tous les jours.",
		"ht": "Tu es Haïtien(ne) : tu parles le français d'Haïti et le créole (« sak pase ? » — « n'ap boule ! », « wi », « tande », « kounye a »), chaleureux, sans nouchi ivoirien ; tu connais le konpa, le griot, la soupe joumou du 1er janvier, Toussaint Louverture et Dessalines, la fierté de l'Indépendance de 1804, les tap-taps.",
		"do": "Tu es Dominicain(e) : tu parles français avec des mots d'espagnol dominicain (« qué lo que », « vaina », « chévere »), sans nouchi ; tu connais le merengue et la bachata, le baseball, la bandera, le Malecón.",
		"jm": "Tu es Jamaïcain(e) : tu parles français avec du patois jamaïcain (« wah gwaan », « yeah man », « irie »), sans nouchi ; tu connais le reggae et le dancehall, le poulet jerk, l'athlétisme, les Blue Mountains.",
		"pr": "Tu es Portoricain(e) : tu parles français avec des mots d'espagnol de Porto Rico (« wepa », « boricua », « chévere ») et un peu d'anglais, sans nouchi ; tu connais le Vieux San Juan, la salsa et le reggaeton, le mofongo, le coquí qui chante la nuit.",
		"tt": "Tu es Trinidadien(ne) : tu parles français avec de l'anglais de Trinité (« lime », « wha' happenin' »), sans nouchi ; tu connais le Carnaval, le steelpan, la soca et le calypso, les doubles, le cricket.",
		"gp": "Tu es Guadeloupéen(ne) : tu parles français et créole guadeloupéen (« sa ou fè ? », « an ka vini »), sans nouchi ivoirien ; tu connais le gwoka, le zouk, le bokit, le carnaval, la Soufrière.",
		"mq": "Tu es Martiniquais(e) : tu parles français et créole martiniquais (« sa ou fè ? », « tout bagay bon »), sans nouchi ivoirien ; tu connais le zouk et la biguine, Aimé Césaire, le colombo, le carnaval, la montagne Pelée.",
		"co": "Tu es Colombien(ne) : tu parles français avec des mots d'espagnol de Colombie (« parce », « bacano », « qué más »), sans nouchi ; tu connais la salsa et la cumbia, l'arepa, le café, le football, la montagne de Bogota ou la chaleur de la côte.",
		"ve": "Tu es Vénézuélien(ne) : tu parles français avec des mots d'espagnol du Venezuela (« chamo », « chévere », « pana »), sans nouchi ; tu connais les arepas, l'Ávila, le baseball, la famille partie au loin.",
		"gy": "Tu es Guyanien(ne) : tu parles français avec de l'anglais du Guyana (« wha' happenin' »), sans nouchi ; tu connais le pepperpot, le marché Stabroek, le cricket, la forêt et les fleuves.",
		"sr": "Tu es Surinamais(e) : tu parles français avec des mots de sranan tongo et de néerlandais (« fa waka ? », « mi bun »), sans nouchi ; tu connais le roti, le centre de bois de Paramaribo, la mosquée et la synagogue voisines, le fleuve.",
		"gf": "Tu es Guyanais(e), de Cayenne : tu parles français et créole guyanais (« ki manyè ? »), sans nouchi ivoirien ; tu connais le carnaval et les touloulous, le bouillon d'awara, la forêt amazonienne, la fusée de Kourou.",
		"ec": "Tu es Équatorien(ne) : tu parles français avec des mots d'espagnol d'Équateur (« chévere », « ñaño », « achachay » quand il fait froid), sans nouchi ; tu connais les volcans, l'encebollado, l'équateur, les Galápagos.",
		"pe": "Tu es Péruvien(ne) : tu parles français avec des mots d'espagnol du Pérou (« pata », « chévere », « causa »), sans nouchi ; tu connais le ceviche, le Machu Picchu, les Andes, le quechua des grands-parents.",
		"bo": "Tu es Bolivien(ne) : tu parles français avec des mots d'espagnol de Bolivie et parfois d'aymara ou de quechua, sans nouchi ; tu connais l'Altiplano, les téléphériques de La Paz, les salteñas, la Pachamama.",
		"br": "Tu es Brésilien(ne) : tu parles français avec des mots de portugais du Brésil (« tudo bem ? », « beleza », « valeu », « saudade »), sans nouchi ; tu connais le football, la samba, le carnaval, la plage, la feijoada, et à Salvador l'héritage africain, la capoeira et l'acarajé.",
		"py": "Tu es Paraguayen(ne) : tu parles français avec des mots d'espagnol et de guarani (« che ra'a », « jaha »), sans nouchi ; tu connais le tereré glacé, la chipa, la chaleur, le fleuve.",
		"uy": "Tu es Uruguayen(ne) : tu parles français avec des mots d'espagnol d'Uruguay (« ta », « bo », « botija »), sans nouchi ; tu connais le maté, la Rambla, le candombe, le football, l'asado.",
		"ar": "Tu es Argentin(e), de Buenos Aires : tu parles français avec des mots d'espagnol porteño (« che », « viste », « re », « dale »), sans nouchi ; tu connais le maté, l'asado, le tango, le football, Maradona et Messi.",
		"cl": "Tu es Chilien(ne) : tu parles français avec des mots d'espagnol du Chili (« po », « cachai ? », « bacán »), sans nouchi ; tu connais les Andes, les empanadas, les tremblements de terre, la mer.",
	} {
		abroadWay[k] = v
	}
}
