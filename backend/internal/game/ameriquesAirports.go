package game

// Les Amériques (world/ameriques.go): the update « pays-ameriques » (Latin America and the Caribbean), and
// the airports of every city there and of Canada's beyond Montréal (« pays-canada »): Air Lagune flies to each.
const AmeriquesKey = "pays-ameriques"

func init() {
	for id, a := range map[string]Airport{
		"toronto":        {"toronto", "toronto-centre", "toronto-aeroport", CanadaKey},
		"ottawa":         {"ottawa", "ottawa-centre", "ottawa-aeroport", CanadaKey},
		"quebec":         {"quebec", "quebec-centre", "quebec-aeroport", CanadaKey},
		"vancouver":      {"vancouver", "vancouver-centre", "vancouver-aeroport", CanadaKey},
		"calgary":        {"calgary", "calgary-centre", "calgary-aeroport", CanadaKey},
		"edmonton":       {"edmonton", "edmonton-centre", "edmonton-aeroport", CanadaKey},
		"winnipeg":       {"winnipeg", "winnipeg-centre", "winnipeg-aeroport", CanadaKey},
		"halifax":        {"halifax", "halifax-centre", "halifax-aeroport", CanadaKey},
		"sao-paulo":      {"sao-paulo", "saopaulo-centro", "saopaulo-aeroport", AmeriquesKey},
		"rio-de-janeiro": {"rio-de-janeiro", "rio-centro", "rio-aeroport", AmeriquesKey},
		"salvador":       {"salvador", "salvador-pelourinho", "salvador-aeroport", AmeriquesKey},
		"brasilia":       {"brasilia", "brasilia-centre", "brasilia-aeroport", AmeriquesKey},
		"mexico":         {"mexico", "cdmx-centro", "cdmx-aeroport", AmeriquesKey},
		"cancun":         {"cancun", "cancun-zona-hotelera", "cancun-aeroport", AmeriquesKey},
		"port-au-prince": {"port-au-prince", "pap-centre", "pap-aeroport", AmeriquesKey},
		"cap-haitien":    {"cap-haitien", "cap-haitien-centre", "cap-haitien-aeroport", AmeriquesKey},
		"la-havane":      {"la-havane", "habana-vedado", "habana-aeroport", AmeriquesKey},
		"bogota":         {"bogota", "bogota-candelaria", "bogota-aeroport", AmeriquesKey},
		"carthagene":     {"carthagene", "cartagena-centro", "cartagena-aeroport", AmeriquesKey},
		"buenos-aires":   {"buenos-aires", "baires-centro", "baires-aeroport", AmeriquesKey},
		"lima":           {"lima", "lima-centre", "lima-aeroport", AmeriquesKey},
		"santiago":       {"santiago", "santiago-centre", "santiago-aeroport", AmeriquesKey},
		"caracas":        {"caracas", "caracas-centre", "caracas-aeroport", AmeriquesKey},
		"quito":          {"quito", "quito-centre", "quito-aeroport", AmeriquesKey},
		"guayaquil":      {"guayaquil", "guayaquil-centre", "guayaquil-aeroport", AmeriquesKey},
		"la-paz":         {"la-paz", "la-paz-centre", "la-paz-aeroport", AmeriquesKey},
		"santa-cruz":     {"santa-cruz", "santa-cruz-centre", "santa-cruz-aeroport", AmeriquesKey},
		"asuncion":       {"asuncion", "asuncion-centre", "asuncion-aeroport", AmeriquesKey},
		"montevideo":     {"montevideo", "montevideo-centre", "montevideo-aeroport", AmeriquesKey},
		"georgetown":     {"georgetown", "georgetown-centre", "georgetown-aeroport", AmeriquesKey},
		"paramaribo":     {"paramaribo", "paramaribo-centre", "paramaribo-aeroport", AmeriquesKey},
		"cayenne":        {"cayenne", "cayenne-centre", "cayenne-aeroport", AmeriquesKey},
		"kingston":       {"kingston", "kingston-centre", "kingston-aeroport", AmeriquesKey},
		"saint-domingue": {"saint-domingue", "saint-domingue-centre", "saint-domingue-aeroport", AmeriquesKey},
		"port-of-spain":  {"port-of-spain", "port-of-spain-centre", "port-of-spain-aeroport", AmeriquesKey},
		"san-juan":       {"san-juan", "san-juan-centre", "san-juan-aeroport", AmeriquesKey},
		"pointe-a-pitre": {"pointe-a-pitre", "pointe-a-pitre-centre", "pointe-a-pitre-aeroport", AmeriquesKey},
		"fort-de-france": {"fort-de-france", "fort-de-france-centre", "fort-de-france-aeroport", AmeriquesKey},
		"guatemala":      {"guatemala", "guatemala-centre", "guatemala-aeroport", AmeriquesKey},
		"san-jose":       {"san-jose", "san-jose-centre", "san-jose-aeroport", AmeriquesKey},
		"panama":         {"panama", "panama-centre", "panama-aeroport", AmeriquesKey},
		"tegucigalpa":    {"tegucigalpa", "tegucigalpa-centre", "tegucigalpa-aeroport", AmeriquesKey},
		"san-pedro-sula": {"san-pedro-sula", "san-pedro-sula-centre", "san-pedro-sula-aeroport", AmeriquesKey},
		"managua":        {"managua", "managua-centre", "managua-aeroport", AmeriquesKey},
		"san-salvador":   {"san-salvador", "san-salvador-centre", "san-salvador-aeroport", AmeriquesKey},
	} {
		Airports[id] = a
	}
}
