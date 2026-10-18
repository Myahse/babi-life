package world

import (
	"math"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The phone's store. The apps carry invented names; each works like the real
// service it is modelled on (sources in the notes). Fees are taken from those
// services where they are published; menus and the rest are game rules.
const (
	srcWaveFees  = "https://kolonell.com/fr/blog/wave-vs-orange-money-vs-moov-frais-cote-divoire-2026"
	srcWaveFees2 = "https://lesafriques.com/2026/09/mobile-money-banques-cote-ivoire-france-2026/"
	srcGlovo     = "https://www.financialafrik.com/2019/04/18/glovo-lappli-phare-de-livraison-a-la-demande-en-europe-amerique-du-sud-et-afrique-debarque-a-abidjan"
	srcGlovo2    = "https://www.financialafrik.com/2019/10/07/cote-divoire-glovo-connecte-60-du-marche-abidjanais/"
)

type PhoneApp struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Tagline  string `json:"tagline"`
	About    string `json:"about"`
	Category string `json:"category"`
	SizeMB   int    `json:"sizeMB"`
	// Preinstalled apps come with the phone (they can still be removed).
	Preinstalled bool         `json:"preinstalled,omitempty"`
	Source       *game.Source `json:"source"`
}

var PhoneApps = []PhoneApp{
	{ID: "waye", Name: "Waye", Tagline: "L'argent mobile, simple", Category: "Finance", SizeMB: 38, Preinstalled: true,
		About:  "Ton porte-monnaie : envoie de l'argent (1 % de frais, plafonnés à 5 000 Djai), paie sans frais.",
		Source: inspired("Appli du jeu inspirée de Wave : envoi facturé 1 % (frais plafonnés à 5 000 F), dépôt, retrait et paiements gratuits selon les comparatifs.", srcWaveFees, srcWaveFees2)},
	{ID: "gnango", Name: "Gnango", Tagline: "Un chauffeur, prix fixé", Category: "Transport", SizeMB: 64,
		About: "Commande une voiture à Abidjan ou Bouaké. Le prix est fixé à la commande.", Source: RideApps[0].Source},
	{ID: "idrive", Name: "iDrive", Tagline: "Tu proposes ton prix", Category: "Transport", SizeMB: 71,
		About: "Propose ton prix, un chauffeur accepte… ou pas.", Source: RideApps[1].Source},
	{ID: "gbairai", Name: "Gbairai", Tagline: "Écris à tes amis du jeu", Category: "Messages", SizeMB: 46,
		About:  "Discute avec les joueurs devenus tes amis dans le jeu. Liens et numéros masqués ; tu peux bloquer et signaler.",
		Source: &game.Source{Status: game.StatusFictional, Checked: game.Checked, Note: "Appli du jeu : messagerie entre amis du jeu, sur le modèle des messageries de téléphone. Les règles (amis seulement, liens et numéros masqués, blocage, signalement) sont celles du jeu."}},
	{ID: "tikitoko", Name: "Tikitoko", Tagline: "Filme, poste, deviens influenceur", Category: "Vidéo", SizeMB: 88,
		About:  "Filme ce qui se passe dans le jeu : danse, garba, stade, sketch… Gagne des fans ; dès 1 000 fans, les marques te paient. Pas de commentaires : des likes et des abonnés.",
		Source: &game.Source{Status: game.StatusFictional, Checked: game.Checked, Note: "Appli du jeu sur le modèle des applis de vidéos courtes. Le public, les fans et les partenariats sont des règles du jeu."}},
	{ID: "bet225", Name: "Bet225", Tagline: "Le foot virtuel, toutes les cotes", Category: "Paris", SizeMB: 74,
		About:  "Paris sur le foot virtuel de Babi : un tour de 6 matchs tous les quarts d'heure. 1N2, plus ou moins de 2,5 buts, les deux équipes marquent, combinés avec boost. Argent du jeu seulement, dès 18 ans.",
		Source: &game.Source{Status: game.StatusFictional, Checked: game.Checked, Note: "Appli du jeu sur le modèle des sites de paris sportifs. Le championnat, les cotes et les résultats sont des règles du jeu ; aucun argent réel."}},
	{ID: "parisfoot", Name: "ParisFoot", Tagline: "Parie simple, gagne vite", Category: "Paris", SizeMB: 58,
		About:  "Le foot virtuel de Babi en simple : choisis ton match, ta cote, ta mise. Des cotes un peu meilleures sur les paris simples. Argent du jeu seulement, dès 18 ans.",
		Source: &game.Source{Status: game.StatusFictional, Checked: game.Checked, Note: "Appli du jeu sur le modèle des sites de paris sportifs. Le championnat, les cotes et les résultats sont des règles du jeu ; aucun argent réel."}},
	{ID: "golvo", Name: "Golvo", Tagline: "Les maquis livrés chez toi", Category: "Repas", SizeMB: 52,
		About:  "Commande au maquis, au resto ou en boîte : un livreur à moto t'apporte ça où tu es dans Abidjan.",
		Source: inspired("Appli du jeu inspirée de Glovo, à Abidjan depuis 2019 : livraison de repas par des coursiers à moto, frais de 500 F au lancement.", srcGlovo, srcGlovo2)},
}

func FindPhoneApp(id string) (PhoneApp, bool) {
	for _, a := range PhoneApps {
		if a.ID == id {
			return a, true
		}
	}
	return PhoneApp{}, false
}

// Waye: who you can send money to, and what it does for the Sim.
type Contact struct {
	ID     string     `json:"id"`
	Name   string     `json:"name"`
	Note   string     `json:"note"`
	Effect game.Needs `json:"effect"` // for a 5 000 Djai transfer; scaled with the amount
}

var Contacts = []Contact{
	{ID: "maman", Name: "Maman", Note: "Au village. Elle prie pour toi.", Effect: game.Needs{Social: 15}},
	{ID: "petit-frere", Name: "Ton petit frère", Note: "Pour l'école, il dit.", Effect: game.Needs{Social: 10}},
	{ID: "ami", Name: "Un ami", Note: "Il te remboursera « demain ».", Effect: game.Needs{Social: 8, Fun: 2}},
}

// SendFee is Waye's fee: 1 % of the amount, rounded up, at most 5 000 F.
func SendFee(amount int) int {
	return min(5000, int(math.Ceil(float64(amount)/100)))
}

// Golvo menus, by kind of place. Prices and effects are game rules.
type Dish struct {
	ID      string     `json:"id"`
	Label   string     `json:"label"`
	Icon    string     `json:"icon"`
	Price   int        `json:"price"`
	Minutes int64      `json:"minutes"` // to eat it
	Effect  game.Needs `json:"effect"`
	MinHour int        `json:"minHour,omitempty"`
	MaxHour int        `json:"maxHour,omitempty"`
}

var Menus = map[string][]Dish{
	"maquis": {
		{ID: "garba", Label: "Garba (attiéké-thon)", Icon: "fish", Price: 1000, Minutes: 20, Effect: game.Needs{Hunger: 40}, MinHour: 9, MaxHour: 2},
		{ID: "alloco-oeuf", Label: "Alloco-œuf", Icon: "egg", Price: 1000, Minutes: 15, Effect: game.Needs{Hunger: 30}, MinHour: 9, MaxHour: 2},
		{ID: "poulet-braise", Label: "Poulet braisé, attiéké", Icon: "drumstick", Price: 4000, Minutes: 30, Effect: game.Needs{Hunger: 60, Fun: 5}, MinHour: 11, MaxHour: 2},
		{ID: "poisson-braise", Label: "Poisson braisé, alloco", Icon: "fish", Price: 4500, Minutes: 30, Effect: game.Needs{Hunger: 65, Fun: 5}, MinHour: 11, MaxHour: 2},
	},
	"club": {
		{ID: "brochettes", Label: "Brochettes de bœuf", Icon: "beef", Price: 2500, Minutes: 20, Effect: game.Needs{Hunger: 35, Fun: 5}, MinHour: 20, MaxHour: 4},
		{ID: "plateau", Label: "Plateau à partager", Icon: "party-popper", Price: 9000, Minutes: 45, Effect: game.Needs{Hunger: 55, Social: 15, Fun: 10}, MinHour: 20, MaxHour: 4},
	},
	"restaurant": {
		{ID: "menu-burger", Label: "Menu burger-frites", Icon: "hamburger", Price: 5000, Minutes: 25, Effect: game.Needs{Hunger: 55, Fun: 10}, MinHour: 10, MaxHour: 23},
		{ID: "menu-poulet", Label: "Menu poulet croustillant", Icon: "drumstick", Price: 4500, Minutes: 25, Effect: game.Needs{Hunger: 50, Fun: 8}, MinHour: 10, MaxHour: 23},
	},
}

// DeliveryBase: Glovo's fee when it opened in Abidjan.
const DeliveryBase = 500

// DeliveryQuote: the fee and how long the courier takes, from the place's
// commune to the Sim's, on the roads. Beyond 3 km each km adds 100 F; times
// are shortened like trips.
func DeliveryQuote(city string, from, to string) (fee int, minutes int64, ok bool) {
	km := 1.5 // same commune
	if from != to {
		p, found := RouteIn(city, from, to)
		if !found {
			return 0, 0, false
		}
		km = p.Km
	}
	return DeliveryBase + 100*max(0, int(km)-3), 6 + int64(math.Round(km*0.5)), true
}
