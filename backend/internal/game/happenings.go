package game

import (
	"hash/fnv"
	"slices"
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
	// famille, fête, culture, sport, communauté, commerce, saison, incident.
	Category string `json:"category"`
	// It can start in [MinHour, MaxHour); 0, 0 = any time. Wraps past midnight.
	MinHour int `json:"minHour,omitempty"`
	MaxHour int `json:"maxHour,omitempty"`
	// Where and when it can happen; empty = anywhere, any month, any day.
	Cities   []string `json:"cities,omitempty"`
	Communes []string `json:"communes,omitempty"`
	Months   []int    `json:"months,omitempty"` // 1 = janvier
	Days     []int    `json:"days,omitempty"`   // 0 = lundi
	// Holiday: only on that public holiday (an ID from Holidays).
	Holiday string `json:"holiday,omitempty"`
	// Weight makes it more likely than ordinary happenings (default 1).
	Weight int `json:"weight,omitempty"`
	// Join is what a Sim can do there, nil when there is nothing to join.
	Join      *Interaction  `json:"join,omitempty"`
	Surprises []RandomEvent `json:"-"`
	Source    *Source       `json:"source"`
}

// HappeningMinutes is how long a happening lasts (2 game hours = 2 real minutes).
const HappeningMinutes = 120

// HappeningChance is the share of time slots with something going on, and
// HolidayChance the share on a public holiday, when the whole country celebrates.
const (
	HappeningChance = 0.6
	HolidayChance   = 0.85
)

// JoinHappeningID is the interaction id used to join the current happening.
const JoinHappeningID = "join"

var Happenings = []Happening{
	{ID: "mariage", Category: "famille", Source: Fictional, Label: "Mariage dans la rue", Icon: "heart", MinHour: 10, MaxHour: 19,
		Text: "Un cortège de mariage passe en klaxonnant ! Les tantes sont toutes en pagne assorti.",
		Join: &Interaction{ID: JoinHappeningID, Label: "Danser avec le cortège", Icon: "music", Minutes: 60, Effect: Needs{Social: 35, Fun: 30, Energy: -10}},
		Surprises: []RandomEvent{
			{Text: "La maman de la mariée te sert une grosse assiette de riz gras.", Effect: Needs{Hunger: 40, Social: 10}},
			{Text: "On te prend pour un cousin : tu finis sur toutes les photos.", Effect: Needs{Fun: 15, Social: 15}},
		}},
	{ID: "match", Category: "sport", Source: Fictional, Label: "Match des Éléphants", Icon: "trophy", MinHour: 15, MaxHour: 23,
		Text: "Les Éléphants jouent ! Tout le quartier est devant l'écran géant.",
		Join: &Interaction{ID: JoinHappeningID, Label: "Regarder le match", Icon: "tv", Minutes: 100, Cost: 200, Effect: Needs{Fun: 40, Social: 30}},
		Surprises: []RandomEvent{
			{Text: "BUT ! Tout le monde saute, un inconnu te prend dans ses bras.", Effect: Needs{Fun: 25, Social: 20}},
			{Text: "Défaite… Le quartier est triste, même le vendeur de garba.", Effect: Needs{Fun: -20}},
		}},
	{ID: "concert", Category: "culture", Source: Fictional, Label: "Concert de coupé-décalé", Icon: "disc-3", MinHour: 18, MaxHour: 2,
		Text: "Un DJ a installé ses baffles dans la rue : ça va chauffer !",
		Join: &Interaction{ID: JoinHappeningID, Label: "Aller danser", Icon: "music", Minutes: 90, Effect: Needs{Fun: 45, Social: 30, Energy: -20, Hygiene: -10}},
		Surprises: []RandomEvent{
			{Text: "Le DJ crie ton nom au micro. Tu es une star !", Effect: Needs{Fun: 20, Social: 15}},
			{Text: "Tu « travailles » un peu trop : quelques billets volent.", Money: -2000, Effect: Needs{Fun: 15}},
		}},
	{ID: "pluie", Category: "saison", Source: Fictional, Label: "Grosse pluie", Icon: "cloud-rain",
		Text: "Le ciel se fâche : une averse tropicale tombe sur le quartier !",
		Join: &Interaction{ID: JoinHappeningID, Label: "S'abriter sous un auvent", Icon: "umbrella", Minutes: 30, Effect: Needs{Social: 10}},
		Surprises: []RandomEvent{
			{Text: "Un gbaka passe dans la flaque : tu es trempé·e de la tête aux pieds.", Effect: Needs{Hygiene: -25, Fun: -10}},
		}},
	{ID: "delestage", Category: "incident", Source: Fictional, Label: "Délestage", Icon: "zap-off", MinHour: 19, MaxHour: 24,
		Text: "Coupure de courant ! La CIE a encore frappé, tout le quartier est dans le noir.",
		Join: &Interaction{ID: JoinHappeningID, Label: "Causer avec les voisins à la lampe", Icon: "flame", Minutes: 45, Effect: Needs{Social: 30, Fun: 10}},
		Surprises: []RandomEvent{
			{Text: "Le vieux du quartier raconte des histoires de l'ancien temps.", Effect: Needs{Fun: 20, Social: 10}},
		}},
	{ID: "embouteillage", Category: "incident", Source: Fictional, Label: "Embouteillage", Icon: "car", MinHour: 6, MaxHour: 21,
		Text: "Gros embouteillage sur le boulevard : les gbakas klaxonnent dans tous les sens."},
	{ID: "controle", Category: "incident", Source: Fictional, Label: "Contrôle de police", Icon: "shield", MinHour: 6, MaxHour: 23,
		Text: "Barrage de police au carrefour : « Bonjour, vos papiers ! »",
		Join: &Interaction{ID: JoinHappeningID, Label: "Montrer ses papiers", Icon: "id-card", Minutes: 15, Effect: Needs{Fun: -5}},
		Surprises: []RandomEvent{
			{Text: "« Laisse quelque chose pour le café… » Tu donnes 1 000F.", Money: -1000, Effect: Needs{Fun: -10}},
			{Text: "Tout est en règle : « Bonne route, mon frère ! »", Effect: Needs{Fun: 5}},
		}},
	{ID: "foot", Category: "sport", Source: Fictional, Label: "Match de foot de quartier", Icon: "volleyball", MinHour: 8, MaxHour: 19,
		Text: "Les petits du quartier ont sorti les cages : match de rue sur le boulevard !",
		Join: &Interaction{ID: JoinHappeningID, Label: "Jouer avec eux", Icon: "volleyball", Minutes: 60, Effect: Needs{Fun: 35, Social: 25, Energy: -20, Hygiene: -20}},
		Surprises: []RandomEvent{
			{Text: "Tu marques un but de l'extérieur du pied. Les petits t'appellent « Drogba ».", Effect: Needs{Fun: 25, Social: 10}},
		}},
	// Family and neighbourhood life: everyday scenes, no real event behind them.
	{ID: "bapteme", Category: "famille", Source: Fictional, Label: "Baptême dans la cour", Icon: "baby", MinHour: 9, MaxHour: 15, Days: []int{Samedi, Dimanche},
		Text:      "On présente le bébé au quartier : bâches, chaises en plastique et grandes marmites.",
		Join:      &Interaction{ID: JoinHappeningID, Label: "Féliciter les parents", Icon: "gift", Minutes: 60, Cost: 1000, Effect: Needs{Social: 30, Fun: 15, Hunger: 15}},
		Surprises: []RandomEvent{{Text: "La grand-mère te confie le bébé pour une photo. Tu ne bouges plus.", Effect: Needs{Fun: 15, Social: 10}}}},
	{ID: "anniversaire", Category: "famille", Source: Fictional, Label: "Anniversaire chez les voisins", Icon: "cake", MinHour: 16, MaxHour: 23,
		Text: "Les voisins fêtent un anniversaire : musique, gâteau et beaucoup de bruit.",
		Join: &Interaction{ID: JoinHappeningID, Label: "Chanter « Joyeux anniversaire »", Icon: "cake", Minutes: 60, Effect: Needs{Fun: 25, Social: 25, Hunger: 10}}},
	{ID: "funerailles", Category: "famille", Source: Fictional, Label: "Veillée funéraire", Icon: "flower-2", MinHour: 17, MaxHour: 24, Days: []int{Vendredi, Samedi, Dimanche},
		Text:      "Une famille du quartier est en deuil : bâches, chorale et veillée jusque tard.",
		Join:      &Interaction{ID: JoinHappeningID, Label: "Présenter ses condoléances", Icon: "hand-heart", Minutes: 60, Cost: 2000, Effect: Needs{Social: 30, Fun: -10, Energy: -10}},
		Surprises: []RandomEvent{{Text: "La famille te remercie d'être venu·e. On ne t'oubliera pas.", Effect: Needs{Social: 15}}}},
	{ID: "association", Category: "communauté", Source: Fictional, Label: "Réunion des ressortissants", Icon: "users", MinHour: 9, MaxHour: 13, Days: []int{Dimanche},
		Text: "L'association des ressortissants du village tient sa réunion sous l'apatam.",
		Join: &Interaction{ID: JoinHappeningID, Label: "Assister à la réunion et cotiser", Icon: "users", Minutes: 90, Cost: 1000, Effect: Needs{Social: 30, Fun: 5}, Requires: &Requirement{Resident: true}}},
	{ID: "tontine", Category: "communauté", Source: Fictional, Label: "Jour de tontine", Icon: "piggy-bank", MinHour: 10, MaxHour: 18, Days: []int{Samedi, Dimanche},
		Text:      "C'est le jour de la tontine : chacun apporte sa part, une personne ramasse tout.",
		Join:      &Interaction{ID: JoinHappeningID, Label: "Cotiser à la tontine", Icon: "piggy-bank", Minutes: 30, Cost: 5000, Effect: Needs{Social: 20}, Requires: &Requirement{Resident: true}},
		Surprises: []RandomEvent{{Text: "C'est ton tour de ramasser la tontine !", Money: 25000, Effect: Needs{Fun: 25}}}},
	{ID: "salubrite", Category: "communauté", Source: Fictional, Label: "Journée de salubrité", Icon: "brush-cleaning", MinHour: 7, MaxHour: 11, Days: []int{Samedi},
		Text: "Balais, râteaux et brouettes : tout le quartier nettoie les caniveaux.",
		Join: &Interaction{ID: JoinHappeningID, Label: "Donner un coup de main", Icon: "brush-cleaning", Minutes: 90, Effect: Needs{Social: 30, Fun: 5, Hygiene: -20, Energy: -15}}},
	{ID: "ouverture-boutique", Category: "commerce", Source: Fictional, Label: "Ouverture d'une boutique", Icon: "store", MinHour: 9, MaxHour: 18, Days: Workweek,
		Text:      "Nouvelle boutique dans la rue : ballons, sono et promotions d'ouverture.",
		Join:      &Interaction{ID: JoinHappeningID, Label: "Passer voir les promos", Icon: "store", Minutes: 30, Effect: Needs{Fun: 15, Social: 10}},
		Surprises: []RandomEvent{{Text: "Tu gagnes la tombola d'ouverture : un bon d'achat !", Money: 2000, Effect: Needs{Fun: 15}}}},
	{ID: "ligue1", Category: "sport", Label: "Match de Ligue 1", Icon: "trophy", MinHour: 15, MaxHour: 21, Communes: []string{"plateau", "treichville", "adjame"},
		Source: &Source{Status: StatusFictional, Note: "Supporters génériques au stade ; aucun calendrier réel n'est simulé."},
		Text:   "Jour de match au stade : les supporters chantent dans les rues avec drapeaux et tambours.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Aller au stade", Icon: "trophy", Minutes: 120, Cost: 1000, Effect: Needs{Fun: 40, Social: 30, Energy: -10}}},
	{ID: "basket", Category: "sport", Label: "Tournoi de basket", Icon: "trophy", MinHour: 14, MaxHour: 21, Communes: []string{"treichville", "cocody", "yakro-centre"},
		Source: Fictional,
		Text:   "Tournoi de basket du quartier : dunks, musique et commentateur au micro.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Jouer un match", Icon: "trophy", Minutes: 60, Effect: Needs{Fun: 35, Social: 20, Energy: -25, Hygiene: -25}}},
	{ID: "inondation", Category: "saison", Label: "Rue inondée", Icon: "cloud-rain", Cities: []string{"abidjan"}, Months: []int{5, 6, 7},
		Source: Unverified("Pluies diluviennes de la grande saison des pluies à Abidjan ; période à confirmer avec une source météo officielle (SODEXAM)."),
		Text:   "Après l'averse, la rue est sous l'eau : les taxis refusent de passer.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Aider à déboucher le caniveau", Icon: "shovel", Minutes: 45, Effect: Needs{Social: 25, Hygiene: -25, Energy: -10}}},

	// Festivals: real, recurring; the exact dates change every year, so only the month is simulated.
	{ID: "femua", Category: "culture", Label: "FEMUA à Anoumabo", Icon: "music", MinHour: 16, MaxHour: 24, Communes: []string{"marcory"}, Months: []int{4, 5}, Weight: 6,
		Source: Partial("Festival des musiques urbaines d'Anoumabo, fondé en 2008 par A'Salfo (Magic System), annuel, entrée gratuite. Dates fixées chaque année (25–30 avril en 2023) : le jeu le place en avril–mai.", SrcFEMUA, SrcFEMUA2023),
		Text:   "C'est le FEMUA ! La grande scène d'Anoumabo accueille des artistes de toute l'Afrique.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Aller au concert du FEMUA", Icon: "music", Minutes: 180, Effect: Needs{Fun: 55, Social: 35, Energy: -25, Hygiene: -15}}},
	{ID: "abissa", Category: "culture", Label: "Abissa", Icon: "drum", MinHour: 9, MaxHour: 22, Cities: []string{"grand-bassam"}, Months: []int{10, 11}, Weight: 6,
		Source: Partial("Fête annuelle des N'zima à Grand-Bassam, fin octobre selon les sources ; dates fixées chaque année.", SrcAbissa),
		Text:   "C'est l'Abissa : tambours et danses du peuple N'zima envahissent Grand-Bassam.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Danser avec la foule", Icon: "drum", Minutes: 120, Effect: Needs{Fun: 45, Social: 35, Energy: -20}}},
	{ID: "carnaval-bouake", Category: "culture", Label: "Carnaval de Bouaké", Icon: "party-popper", MinHour: 10, MaxHour: 22, Cities: []string{"bouake"}, Months: []int{3}, Weight: 6,
		Source: Partial("Grand carnaval annuel de Bouaké, en mars selon Lonely Planet ; dates à confirmer chaque année.", SrcLonelyFestivals),
		Text:   "Le Carnaval de Bouaké défile : chars, masques et fanfares dans les rues.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Suivre le défilé", Icon: "party-popper", Minutes: 120, Effect: Needs{Fun: 45, Social: 30, Energy: -15}}},
	{ID: "fete-masques", Category: "culture", Label: "Fête des masques", Icon: "drama", MinHour: 9, MaxHour: 19, Cities: []string{"man"}, Months: []int{2, 11}, Weight: 4,
		Source: Unverified("Fête des masques dans la région de Man ; les sources divergent sur la période (février ou novembre)."),
		Text:   "Les masques dansent sur la place : échassiers et percussions de la région de Man.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Regarder les masques", Icon: "drama", Minutes: 90, Effect: Needs{Fun: 40, Social: 20}}},

	// Public holidays (real dates); what happens in the street is simulated.
	{ID: "fete-independance", Category: "fête", Label: "Fête de l'Indépendance", Icon: "flag", Holiday: "fete-nationale", Weight: 10, MinHour: 8, MaxHour: 24,
		Source: Partial("Le 7 août est la fête nationale (décret n° 96-205) ; l'ambiance de quartier est simulée.", SrcHolidaysDecree),
		Text:   "7 août : drapeaux orange-blanc-vert partout, la rue fête l'Indépendance.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Fêter avec le quartier", Icon: "flag", Minutes: 90, Effect: Needs{Fun: 40, Social: 35}}},
	{ID: "fete-paix", Category: "fête", Label: "Journée de la Paix", Icon: "bird", Holiday: "paix", Weight: 10, MinHour: 9, MaxHour: 20,
		Source: Partial("Le 15 novembre est la Journée nationale de la Paix ; l'animation est simulée.", SrcPeaceDay),
		Text:   "15 novembre : messages de paix et rencontres entre voisins.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Partager un moment avec les voisins", Icon: "hand-heart", Minutes: 60, Effect: Needs{Social: 35, Fun: 15}}},
	{ID: "fete-travail", Category: "fête", Label: "Fête du Travail", Icon: "hammer", Holiday: "fete-travail", Weight: 10, MinHour: 8, MaxHour: 14,
		Source: Partial("Le 1er mai est férié (décret n° 96-205) ; la scène est simulée.", SrcHolidaysDecree),
		Text:   "1er mai : jour chômé, les travailleurs se retrouvent entre collègues.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Se joindre aux collègues", Icon: "users", Minutes: 60, Effect: Needs{Social: 30, Fun: 20}}},
	{ID: "noel", Category: "fête", Label: "Noël dans le quartier", Icon: "gift", Holiday: "noel", Weight: 10, MinHour: 10, MaxHour: 24,
		Source: Partial("Le 25 décembre est férié (décret n° 96-205) ; la scène est simulée.", SrcHolidaysDecree),
		Text:   "Noël : les enfants en habits neufs font le tour du quartier.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Offrir des bonbons aux enfants", Icon: "gift", Minutes: 45, Cost: 1000, Effect: Needs{Fun: 30, Social: 30}}},
	{ID: "nouvel-an", Category: "fête", Label: "Bonne année !", Icon: "sparkles", Holiday: "nouvel-an", Weight: 10,
		Source: Partial("Le 1er janvier est férié (décret n° 96-205) ; la scène est simulée.", SrcHolidaysDecree),
		Text:   "1er janvier : on se souhaite la bonne année de cour en cour.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Faire la tournée des vœux", Icon: "sparkles", Minutes: 60, Effect: Needs{Social: 40, Fun: 20, Hunger: 15}}},
	{ID: "korite", Category: "fête", Label: "Korité", Icon: "moon", Holiday: "korite", Weight: 10, MinHour: 8, MaxHour: 22,
		Source: Partial("Fin du Ramadan, fériée ; date déclarée chaque année. La scène est simulée.", SrcHolidaysDecree),
		Text:   "Korité : boubous neufs, prière du matin et repas partagés avec les voisins.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Partager le repas de fête", Icon: "utensils", Minutes: 60, Effect: Needs{Social: 40, Hunger: 40, Fun: 15}}},
	{ID: "tabaski", Category: "fête", Label: "Tabaski", Icon: "moon", Holiday: "tabaski", Weight: 10, MinHour: 8, MaxHour: 22,
		Source: Partial("Aïd el-Kébir, fériée ; date déclarée chaque année. La scène est simulée.", SrcHolidaysDecree),
		Text:   "Tabaski : on partage la viande du mouton avec les voisins et les amis.",
		Join:   &Interaction{ID: JoinHappeningID, Label: "Partager le repas de fête", Icon: "utensils", Minutes: 60, Effect: Needs{Social: 40, Hunger: 45, Fun: 15}}},
}

func FindHappening(id string) (Happening, bool) {
	for _, h := range Happenings {
		if h.ID == id {
			return h, true
		}
	}
	return Happening{}, false
}

// HappeningAt returns what is going on in a commune of a city at a game
// minute, with the slot's start, or ok=false when the street is quiet. On a
// public holiday the street is busier and its own happening is likelier. The
// same happening never runs twice in a row in a commune.
func HappeningAt(city, commune string, gameMinutes int64) (h Happening, start int64, ok bool) {
	if gameMinutes < 0 {
		return Happening{}, 0, false
	}
	slot := gameMinutes / HappeningMinutes
	start = slot * HappeningMinutes
	if _, _, ok := rawHappening(city, commune, slot); !ok {
		return Happening{}, start, false
	}
	// Cooldown: never the happening that ran in the slot before. Replay from
	// the last quiet slot (a short chain: most slots are quiet) so each slot
	// is compared with what actually ran before it.
	first := slot
	for first > slot-maxChain {
		if _, _, ok := rawHappening(city, commune, first-1); !ok {
			break
		}
		first--
	}
	prev := ""
	for s := first; s <= slot; s++ {
		h, open, _ := rawHappening(city, commune, s)
		quiet := false
		if h.ID == prev {
			// Nothing else can start then: better a quiet street than a rerun.
			quiet = len(open) == 1
			for i, c := range open {
				if c.ID == h.ID {
					h = open[(i+1)%len(open)]
					break
				}
			}
		}
		if s == slot {
			return h, start, !quiet
		}
		prev = h.ID
		if quiet {
			prev = ""
		}
	}
	return Happening{}, start, false
}

// maxChain bounds the replay: back-to-back happenings for 4 days in a row
// are vanishingly rare, and the rule is only about variety.
const maxChain = 48

// rawHappening is a slot's draw before the cooldown, with what else could start.
func rawHappening(city, commune string, slot int64) (Happening, []Happening, bool) {
	if slot < 0 {
		return Happening{}, nil, false
	}
	start := slot * HappeningMinutes
	holiday, isHoliday := HolidayOn(start)
	chance := HappeningChance
	if isHoliday {
		chance = HolidayChance
	}
	if float64(hash(commune, slot, "on")%1000)/1000 >= chance {
		return Happening{}, nil, false
	}
	open := openHappenings(city, commune, start, holiday.ID)
	h, ok := weighted(open, hash(commune, slot, "which"))
	return h, open, ok
}

// openHappenings lists what can start in a commune at a time.
func openHappenings(city, commune string, start int64, holiday string) []Happening {
	month := int(DateOf(start).Month())
	var open []Happening
	for _, c := range Happenings {
		if c.Holiday != "" && c.Holiday != holiday {
			continue
		}
		if len(c.Cities) > 0 && !slices.Contains(c.Cities, city) {
			continue
		}
		if len(c.Communes) > 0 && !slices.Contains(c.Communes, commune) {
			continue
		}
		if len(c.Months) > 0 && !slices.Contains(c.Months, month) {
			continue
		}
		if !(Interaction{MinHour: c.MinHour, MaxHour: c.MaxHour, Days: c.Days}).OpenAt(start) {
			continue
		}
		open = append(open, c)
	}
	return open
}

func weighted(open []Happening, roll uint64) (Happening, bool) {
	total := 0
	for _, c := range open {
		total += max(1, c.Weight)
	}
	if total == 0 {
		return Happening{}, false
	}
	n := int(roll % uint64(total))
	for _, c := range open {
		if n -= max(1, c.Weight); n < 0 {
			return c, true
		}
	}
	return open[len(open)-1], true
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
