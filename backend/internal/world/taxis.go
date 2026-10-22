package world

import (
	"math"
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Abidjan's street taxis: the red-orange taxi compteur goes anywhere and is
// paid by the meter; the woro-woro (taxi communal) wears its commune's colour.
// The colours are sourced; fares and times are game rules.
const (
	srcWoroGuide   = "https://france-volontaires.org/wp-content/uploads/2022/07/france-volontaires.org-cote-divoire-cote-divoire-guide-du-volontaire.pdf"
	srcWoro360     = "https://afrique.le360.ma/cote-divoire/economie/2021/12/27/36497-cote-divoire-les-woro-woro-ces-taxis-communaux-populaires-dabidjan-36497/"
	srcWoroMemoire = "https://www.memoireonline.com/03/22/12858/m_Socio-histoire-dune-offre-alternative-de-transport-urbain-etude-du-cas-des-woro-woro-de-y83.html"
	srcCompteur    = "https://news.abidjan.net/articles/465455/le-calvaire-des-abidjanais-a-commence-les-woro-woro-banalises-interdits-au-plateau"
)

// Woro is the look of a commune's woro-woro. None: the commune has none (the
// Plateau), so you take a taxi compteur from there.
type Woro struct {
	Color  string       `json:"color,omitempty"`
	Trim   string       `json:"trim,omitempty"`
	Label  string       `json:"label,omitempty"`
	None   bool         `json:"none,omitempty"`
	Source *game.Source `json:"source"`
}

// Compteur is the red-orange metered taxi, in Abidjan.
var Compteur = struct {
	Color  string       `json:"color"`
	Cities []string     `json:"cities"`
	Source *game.Source `json:"source"`
}{"#ff7a00", []string{"abidjan"}, game.Verified("Taxis-compteurs rouge tirant vers l'orange, payés au compteur ; ce sont eux qui dominent au Plateau.", srcWoroGuide, srcCompteur)}

const (
	woroBlue, woroYellow, woroGreen, woroWhite = "#2a6cf0", "#f2b705", "#00a862", "#f1f3f5"
)

var woros = map[string]Woro{
	"yopougon":    {Color: woroBlue, Label: "bleu", Source: game.Verified("Woro-woro bleus à Yopougon.", srcWoroGuide, srcWoro360)},
	"cocody":      {Color: woroYellow, Label: "jaune", Source: game.Verified("Woro-woro jaunes à Cocody.", srcWoroGuide, srcWoro360)},
	"abobo":       {Color: "#e3cfa4", Trim: "#7a4a24", Label: "beige à bandes marron", Source: game.Verified("Beige à deux bandes marron à Abobo.", srcWoroGuide, srcWoro360)},
	"marcory":     {Color: woroGreen, Label: "vert", Source: game.Verified("Woro-woro verts à Marcory.", srcWoroGuide, srcWoro360)},
	"koumassi":    {Color: woroGreen, Label: "vert", Source: game.Verified("Woro-woro verts à Koumassi.", srcWoroGuide, srcWoro360)},
	"adjame":      {Color: woroGreen, Label: "vert", Source: game.Partial("Vert selon un seul article (2021).", srcWoro360)},
	"attecoube":   {Color: woroGreen, Label: "vert", Source: game.Partial("Vert selon un seul article (2021).", srcWoro360)},
	"port-bouet":  {Color: woroYellow, Trim: woroBlue, Label: "jaune, bas de caisse bleu", Source: game.Partial("Selon un seul article (2021).", srcWoro360)},
	"plateau":     {None: true, Source: game.Partial("Pas de woro-woro communal au Plateau, quartier des affaires.", srcWoro360, srcCompteur)},
	"treichville": {Color: woroWhite, Label: "blanc", Source: game.Unverified("Couleur non trouvée ; blanc par défaut.")},
	"anyama":      {Color: woroWhite, Label: "blanc", Source: game.Unverified("Couleur non trouvée ; blanc par défaut.")},
	"bingerville": {Color: woroWhite, Label: "blanc", Source: game.Unverified("Couleur non trouvée ; blanc par défaut.")},
	"songon":      {Color: woroWhite, Label: "blanc", Source: game.Unverified("Couleur non trouvée ; blanc par défaut.")},
}

func init() {
	for i := range Cities {
		if Cities[i].ID != "abidjan" {
			continue
		}
		for j := range Cities[i].Communes {
			if w, ok := woros[Cities[i].Communes[j].ID]; ok {
				Cities[i].Communes[j].Woro = &w
			}
		}
	}
}

// HasWoro: a woro-woro can be hailed in this commune.
func (c Commune) HasWoro() bool { return c.Woro != nil && !c.Woro.None }

// CompteurQuote: the metered taxi goes straight there, a little quicker than
// the shared woro-woro, and costs about twice as much.
func CompteurQuote(city City, from, to Commune) (minutes int64, fare int, ok bool) {
	if !slices.Contains(Compteur.Cities, city.ID) || from.ID == to.ID {
		return 0, 0, false
	}
	m, f, path := TripPath(city, from, city, to)
	return int64(math.Round(float64(m) * 0.85)), withToll(f, path.Bridges, 2, 500, 50), true
}

// GbakaQuote: the minibus stops all along the way for whoever waves (the
// apprenti shouting where it goes), slower than the woro-woro; a seat costs
// less, its share of the toll included.
func GbakaQuote(city City, from, to Commune) (minutes int64, fare int, ok bool) {
	if !slices.Contains(Compteur.Cities, city.ID) || from.ID == to.ID {
		return 0, 0, false
	}
	m, f, _ := TripPath(city, from, city, to)
	return int64(math.Round(float64(m) * 1.25)), max(200, roundTo(float64(f)*0.7, 50)), true
}

// MotoQuote: the moto-taxi weaves between the cars, the quickest in town; one
// passenger behind the driver, who pays the toll of a bridge.
func MotoQuote(city City, from, to Commune) (minutes int64, fare int, ok bool) {
	if from.ID == to.ID {
		return 0, 0, false
	}
	m, f, path := TripPath(city, from, city, to)
	return int64(math.Round(float64(m) * 0.7)), withToll(f, path.Bridges, 1.5, 300, 50), true
}
