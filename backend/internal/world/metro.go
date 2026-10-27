package world

import "github.com/myahse/babi-life/backend/internal/game"

// The métro d'Abidjan, line 1: north to south, Anyama to Port-Bouët by
// Abobo, Adjamé, the Plateau, Treichville, Marcory and Koumassi (the real
// line, in works, about 37 km). In the game one station a commune, at its
// heart; closed until the team opens the update « metro » (it can be given
// a date in the admin: it opens by itself then). The fare and the times are
// the game's.

type MetroStation struct {
	Commune string `json:"commune"`
	Name    string `json:"name"`
}

type MetroLine struct {
	Name     string         `json:"name"`
	Stations []MetroStation `json:"stations"`
	// Fare: one ticket, whatever the stops (Djai); PerStop and Wait: game minutes.
	Fare    int          `json:"fare"`
	PerStop int          `json:"perStop"`
	Wait    int          `json:"wait"`
	Source  *game.Source `json:"source,omitempty"`
}

var Metro = MetroLine{
	Name: "Ligne 1",
	Stations: []MetroStation{
		{"anyama", "Anyama"},
		{"abobo", "Abobo Gare"},
		{"adjame", "Adjamé Gare routière"},
		{"plateau", "Plateau Cité administrative"},
		{"treichville", "Treichville Gare de Bassam"},
		{"marcory", "Marcory Anoumabo"},
		{"koumassi", "Koumassi Grand Marché"},
		{"port-bouet", "Port-Bouët Aéroport"},
	},
	Fare: 500, PerStop: 3, Wait: 6,
	Source: &game.Source{Status: game.StatusPartial, Checked: game.Checked, Note: "La ligne 1 du métro d'Abidjan (Anyama – Port-Bouët, en travaux) existe ; dans le jeu une station par commune, des noms de stations, un prix et des temps qui sont des règles du jeu."},
}

// stopOf: where a commune is on the line, or -1.
func stopOf(commune string) int {
	for i, s := range Metro.Stations {
		if s.Commune == commune {
			return i
		}
	}
	return -1
}

// MetroQuote: from one station's commune to another's, in Abidjan; the way
// it goes by the stations between (points as [lng, lat]).
func MetroQuote(city City, from, to Commune) (minutes int64, fare int, path Path, ok bool) {
	a, b := stopOf(from.ID), stopOf(to.ID)
	if city.ID != "abidjan" || a < 0 || b < 0 || a == b {
		return 0, 0, Path{}, false
	}
	step := 1
	if b < a {
		step = -1
	}
	for i := a; ; i += step {
		if c, ok := city.Commune(Metro.Stations[i].Commune); ok {
			path.Points = append(path.Points, [2]float64{c.Lng, c.Lat})
		}
		if i == b {
			break
		}
	}
	stops := (b - a) * step
	return int64(Metro.Wait + stops*Metro.PerStop), Metro.Fare, path, true
}
