package game

import (
	"hash/fnv"
	"strconv"
)

// Happenings are things going on in a commune that everyone there can see:
// a wedding procession, a match on a big screen, a power cut… They are not
// stored anywhere: which one is on is a pure function of the commune and the
// game clock, so every player in a commune sees the same street.

type Happening struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	Text  string `json:"text"`
	// It can start in [MinHour, MaxHour); 0, 0 = any time. Wraps past midnight.
	MinHour int `json:"minHour,omitempty"`
	MaxHour int `json:"maxHour,omitempty"`
	// Join is what a Sim can do there, nil when there is nothing to join.
	Join      *Interaction  `json:"join,omitempty"`
	Surprises []RandomEvent `json:"-"`
}

// HappeningMinutes is how long a happening lasts (2 game hours = 2 real minutes).
const HappeningMinutes = 120

// HappeningChance is the share of time slots with something going on.
const HappeningChance = 0.6

// JoinHappeningID is the interaction id used to join the current happening.
const JoinHappeningID = "join"

var Happenings = []Happening{
	{ID: "mariage", Label: "Mariage dans la rue", Icon: "heart", MinHour: 10, MaxHour: 19,
		Text: "Un cortège de mariage passe en klaxonnant ! Les tantes sont toutes en pagne assorti.",
		Join: &Interaction{ID: JoinHappeningID, Label: "Danser avec le cortège", Icon: "music", Minutes: 60, Effect: Needs{Social: 35, Fun: 30, Energy: -10}},
		Surprises: []RandomEvent{
			{Text: "La maman de la mariée te sert une grosse assiette de riz gras.", Effect: Needs{Hunger: 40, Social: 10}},
			{Text: "On te prend pour un cousin : tu finis sur toutes les photos.", Effect: Needs{Fun: 15, Social: 15}},
		}},
	{ID: "match", Label: "Match des Éléphants", Icon: "trophy", MinHour: 15, MaxHour: 23,
		Text: "Les Éléphants jouent ! Tout le quartier est devant l'écran géant.",
		Join: &Interaction{ID: JoinHappeningID, Label: "Regarder le match", Icon: "tv", Minutes: 100, Cost: 200, Effect: Needs{Fun: 40, Social: 30}},
		Surprises: []RandomEvent{
			{Text: "BUT ! Tout le monde saute, un inconnu te prend dans ses bras.", Effect: Needs{Fun: 25, Social: 20}},
			{Text: "Défaite… Le quartier est triste, même le vendeur de garba.", Effect: Needs{Fun: -20}},
		}},
	{ID: "concert", Label: "Concert de coupé-décalé", Icon: "disc-3", MinHour: 18, MaxHour: 2,
		Text: "Un DJ a installé ses baffles dans la rue : ça va chauffer !",
		Join: &Interaction{ID: JoinHappeningID, Label: "Aller danser", Icon: "music", Minutes: 90, Effect: Needs{Fun: 45, Social: 30, Energy: -20, Hygiene: -10}},
		Surprises: []RandomEvent{
			{Text: "Le DJ crie ton nom au micro. Tu es une star !", Effect: Needs{Fun: 20, Social: 15}},
			{Text: "Tu « travailles » un peu trop : quelques billets volent.", Money: -2000, Effect: Needs{Fun: 15}},
		}},
	{ID: "pluie", Label: "Grosse pluie", Icon: "cloud-rain",
		Text: "Le ciel se fâche : une averse tropicale tombe sur le quartier !",
		Join: &Interaction{ID: JoinHappeningID, Label: "S'abriter sous un auvent", Icon: "umbrella", Minutes: 30, Effect: Needs{Social: 10}},
		Surprises: []RandomEvent{
			{Text: "Un gbaka passe dans la flaque : tu es trempé·e de la tête aux pieds.", Effect: Needs{Hygiene: -25, Fun: -10}},
		}},
	{ID: "delestage", Label: "Délestage", Icon: "zap-off", MinHour: 19, MaxHour: 24,
		Text: "Coupure de courant ! La CIE a encore frappé, tout le quartier est dans le noir.",
		Join: &Interaction{ID: JoinHappeningID, Label: "Causer avec les voisins à la lampe", Icon: "flame", Minutes: 45, Effect: Needs{Social: 30, Fun: 10}},
		Surprises: []RandomEvent{
			{Text: "Le vieux du quartier raconte des histoires de l'ancien temps.", Effect: Needs{Fun: 20, Social: 10}},
		}},
	{ID: "embouteillage", Label: "Embouteillage", Icon: "car", MinHour: 6, MaxHour: 21,
		Text: "Gros embouteillage sur le boulevard : les gbakas klaxonnent dans tous les sens."},
	{ID: "controle", Label: "Contrôle de police", Icon: "shield", MinHour: 6, MaxHour: 23,
		Text: "Barrage de police au carrefour : « Bonjour, vos papiers ! »",
		Join: &Interaction{ID: JoinHappeningID, Label: "Montrer ses papiers", Icon: "id-card", Minutes: 15, Effect: Needs{Fun: -5}},
		Surprises: []RandomEvent{
			{Text: "« Laisse quelque chose pour le café… » Tu donnes 1 000F.", Money: -1000, Effect: Needs{Fun: -10}},
			{Text: "Tout est en règle : « Bonne route, mon frère ! »", Effect: Needs{Fun: 5}},
		}},
	{ID: "foot", Label: "Match de foot de quartier", Icon: "volleyball", MinHour: 8, MaxHour: 19,
		Text: "Les petits du quartier ont sorti les cages : match de rue sur le boulevard !",
		Join: &Interaction{ID: JoinHappeningID, Label: "Jouer avec eux", Icon: "volleyball", Minutes: 60, Effect: Needs{Fun: 35, Social: 25, Energy: -20, Hygiene: -20}},
		Surprises: []RandomEvent{
			{Text: "Tu marques un but de l'extérieur du pied. Les petits t'appellent « Drogba ».", Effect: Needs{Fun: 25, Social: 10}},
		}},
}

func FindHappening(id string) (Happening, bool) {
	for _, h := range Happenings {
		if h.ID == id {
			return h, true
		}
	}
	return Happening{}, false
}

// HappeningAt returns what is going on in a commune at a game minute, with
// the slot's start, or ok=false when the street is quiet.
func HappeningAt(commune string, gameMinutes int64) (h Happening, start int64, ok bool) {
	if gameMinutes < 0 {
		return Happening{}, 0, false
	}
	slot := gameMinutes / HappeningMinutes
	start = slot * HappeningMinutes
	roll := hash(commune, slot, "on")
	if float64(roll%1000)/1000 >= HappeningChance {
		return Happening{}, start, false
	}
	hour := HourOf(start)
	var open []Happening
	for _, c := range Happenings {
		if (Interaction{MinHour: c.MinHour, MaxHour: c.MaxHour}).Available(hour) {
			open = append(open, c)
		}
	}
	if len(open) == 0 {
		return Happening{}, start, false
	}
	return open[hash(commune, slot, "which")%uint64(len(open))], start, true
}

func hash(commune string, slot int64, salt string) uint64 {
	f := fnv.New64a()
	f.Write([]byte(commune + "|" + strconv.FormatInt(slot, 10) + "|" + salt))
	return f.Sum64()
}

// Kind turns a happening into a place kind, so joining it runs through Perform.
func (h Happening) Kind() PlaceKind {
	return PlaceKind{ID: "happening", Label: h.Label, Icon: h.Icon, Events: h.Surprises}
}
