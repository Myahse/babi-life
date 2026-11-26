package game

// La France (world/france.go): the update that opens it, and its airports (Air Lagune flies there).
const FranceKey = "pays-france"

func init() {
	for id, a := range map[string]Airport{
		"paris":      {"paris", "paris-roissy", "paris-cdg", FranceKey},
		"marseille":  {"marseille", "marseille-centre", "marseille-aeroport", FranceKey},
		"lyon":       {"lyon", "lyon-centre", "lyon-aeroport", FranceKey},
		"toulouse":   {"toulouse", "toulouse-centre", "toulouse-aeroport", FranceKey},
		"bordeaux":   {"bordeaux", "bordeaux-centre", "bordeaux-aeroport", FranceKey},
		"lille":      {"lille", "lille-centre", "lille-aeroport", FranceKey},
		"nice":       {"nice", "nice-centre", "nice-aeroport", FranceKey},
		"strasbourg": {"strasbourg", "strasbourg-centre", "strasbourg-aeroport", FranceKey},
		"nantes":     {"nantes", "nantes-centre", "nantes-aeroport", FranceKey},
	} {
		Airports[id] = a
	}
}
