package game

import (
	"fmt"
	"math"
	"slices"
	"strings"
)

// The economy: where a Sim starts in life, where they live and what they do
// for a living. Rent and loan repayments fall due every Saturday.

// An Origin is drawn at random when a Sim is created.
type Origin struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Icon    string `json:"icon"`
	Hint    string `json:"hint"`
	Money   int    `json:"money"`   // FCFA in hand on day 1, loan included
	Loan    int    `json:"loan"`    // what is owed to the microfinance
	Housing string `json:"housing"` // starting home
}

var Origins = []Origin{
	{ID: "fils-a-papa", Label: "Enfant de riche", Icon: "gem", Money: 200000, Housing: "appart",
		Hint: "Papa a des relations. Appartement meublé et compte bien rempli… pour l'instant."},
	{ID: "debrouillard", Label: "Débrouillard·e", Icon: "hand-coins", Money: 65000, Loan: 60000, Housing: "entrer-coucher",
		Hint: "Un entrer-coucher et un microcrédit de 50 000F à rembourser. Ici on se bat."},
}

func FindOrigin(id string) (Origin, bool) {
	for _, o := range Origins {
		if o.ID == id {
			return o, true
		}
	}
	return Origin{}, false
}

// Housing is a home tier. Comfort scales the good effects of what the Sim
// does at home: a better bed, a better shower, a bigger TV.
type Housing struct {
	ID      string  `json:"id"`
	Label   string  `json:"label"`
	Icon    string  `json:"icon"`
	Hint    string  `json:"hint"`
	Rent    int     `json:"rent"` // FCFA per week
	Comfort float64 `json:"comfort"`
}

var Housings = []Housing{
	{ID: "entrer-coucher", Label: "Entrer-coucher", Icon: "door-open", Rent: 7000, Comfort: 0.7,
		Hint: "Une pièce, la douche dans la cour commune. Ça dépanne."},
	{ID: "studio", Label: "Studio", Icon: "bed-single", Rent: 15000, Comfort: 0.9,
		Hint: "Ta douche à toi, ton petit coin cuisine."},
	{ID: "appart", Label: "Appartement", Icon: "sofa", Rent: 30000, Comfort: 1.05,
		Hint: "Deux pièces : salon, chambre, la clim qui marche (des fois)."},
	{ID: "villa", Label: "Villa avec piscine", Icon: "castle", Rent: 75000, Comfort: 1.3,
		Hint: "Gardien, piscine, groupe électrogène. Le grand luxe."},
}

func FindHousing(id string) (Housing, bool) {
	for _, h := range Housings {
		if h.ID == id {
			return h, true
		}
	}
	return Housing{}, false
}

// DepositWeeks is the caution paid to the new landlord when moving.
const DepositWeeks = 2

func (h Housing) Deposit() int { return h.Rent * DepositWeeks }

// AtHome adapts a home interaction to the comfort of the Sim's home.
func (h Housing) AtHome(it Interaction) Interaction {
	scale := func(v float64) float64 {
		if v <= 0 {
			return v
		}
		return math.Round(v * h.Comfort)
	}
	e := it.Effect
	it.Effect = Needs{scale(e.Hunger), scale(e.Energy), scale(e.Hygiene), scale(e.Social), scale(e.Fun)}
	return it
}

// A Career is a ladder of jobs done at places of one kind.
type Career struct {
	ID     string  `json:"id"`
	Label  string  `json:"label"`
	Icon   string  `json:"icon"`
	Kind   string  `json:"kind"` // place kind where the Sim works
	Levels []Level `json:"levels"`
	// Shift hours: a shift can start in [MinHour, MaxHour).
	MinHour int   `json:"minHour"`
	MaxHour int   `json:"maxHour"`
	Minutes int64 `json:"minutes"`
	Effect  Needs `json:"effect"` // how a shift tires the Sim
	// Days a shift can start (0 = lundi); empty = every day.
	Days []int `json:"days,omitempty"`
	// Also: other kinds of place where the job is done.
	Also []string `json:"also,omitempty"`
	// Tasks: what's done during a shift, a tap at a time (jobs.go).
	Tasks []JobTask `json:"tasks"`
}

// WorksAt: whether the job is done at this kind of place.
func (c Career) WorksAt(kind string) bool {
	return c.Kind == kind || slices.Contains(c.Also, kind)
}

type Level struct {
	Title string `json:"title"`
	Pay   int    `json:"pay"` // FCFA per shift
}

var Careers = []Career{
	{ID: "bureau", Label: "Bureau", Icon: "briefcase", Kind: "office", MinHour: 7, MaxHour: 11, Minutes: 8 * 60,
		Effect: Needs{Energy: -35, Fun: -20, Hunger: -20, Social: 10},
		Levels: []Level{{"Stagiaire", 2500}, {"Assistant·e", 4000}, {"Chef de service", 5900}, {"Directeur·rice général·e (DG)", 8400}, {"PDG", 10500}}},
	{ID: "maquis", Label: "Restauration", Icon: "chef-hat", Kind: "maquis", MinHour: 10, MaxHour: 18, Minutes: 6 * 60,
		Effect: Needs{Energy: -30, Hygiene: -20, Hunger: 10, Social: 15},
		Levels: []Level{{"Plongeur·se", 1700}, {"Serveur·se", 2300}, {"Cuisinier·ère", 3200}, {"Chef du maquis", 4200}, {"Patron·ne de maquis", 5200}}},
	{ID: "commerce", Label: "Commerce", Icon: "store", Kind: "market", MinHour: 6, MaxHour: 12, Minutes: 6 * 60,
		Effect: Needs{Energy: -25, Hygiene: -15, Social: 20, Fun: -5},
		Levels: []Level{{"Vendeur·se ambulant·e", 1900}, {"Petite table", 2600}, {"Boutiquier·ère", 3800}, {"Grossiste", 5200}, {"Roi·Reine du marché", 6800}}},
	{ID: "transport", Label: "Transport", Icon: "bus", Kind: "transport", MinHour: 5, MaxHour: 14, Minutes: 7 * 60,
		Effect: Needs{Energy: -30, Hygiene: -20, Fun: -10, Social: 10},
		Levels: []Level{{"Apprenti gbaka", 1700}, {"Chauffeur de woro-woro", 3000}, {"Chauffeur de car", 4100}, {"Chef de gare", 5000}, {"Propriétaire de flotte", 6300}}},
	{ID: "ambiance", Label: "Ambiance", Icon: "disc-3", Kind: "club", MinHour: 21, MaxHour: 2, Minutes: 5 * 60,
		Effect: Needs{Energy: -40, Hygiene: -15, Fun: 20, Social: 25},
		Levels: []Level{{"DJ de quartier", 2100}, {"Animateur·rice", 3300}, {"DJ de la Rue Princesse", 4900}, {"Artiste coupé-décalé", 6700}, {"Star internationale", 9000}}},
	// Public service careers, at the new places; pay is a game balance, not a real salary grid.
	{ID: "mairie", Label: "Service municipal", Icon: "landmark", Kind: "mairie", MinHour: 7, MaxHour: 10, Minutes: 8 * 60, Days: Weekdays,
		Effect: Needs{Energy: -30, Fun: -15, Hunger: -20, Social: 20},
		Levels: []Level{{"Agent d'accueil", 2300}, {"Agent d'état civil", 3300}, {"Chef de service", 4900}, {"Secrétaire général·e", 6300}, {"Maire", 7500}}},
	{ID: "enseignement", Label: "Enseignement", Icon: "graduation-cap", Kind: "school", Also: []string{"universite"}, MinHour: 7, MaxHour: 10, Minutes: 6 * 60, Days: Workweek,
		Effect: Needs{Energy: -30, Fun: -5, Hunger: -15, Social: 20},
		Levels: []Level{{"Surveillant·e", 2100}, {"Professeur·e contractuel·le", 3100}, {"Professeur·e titulaire", 4300}, {"Proviseur·e", 5500}, {"Président·e d'université", 6800}}},
	{ID: "coiffure", Label: "Coiffure", Icon: "scissors", Kind: "salon", Also: []string{"barbier"}, MinHour: 8, MaxHour: 14, Minutes: 6 * 60, Days: Workweek,
		Effect: Needs{Energy: -25, Fun: 5, Hunger: -15, Social: 30},
		Levels: []Level{{"Apprenti·e", 1500}, {"Coiffeur·se", 2300}, {"Coiffeur·se reconnu·e", 3200}, {"Patron·ne de salon", 4200}, {"Coiffeur·se des stars", 5700}}},
	{ID: "sante", Label: "Santé", Icon: "stethoscope", Kind: "health", MinHour: 6, MaxHour: 20, Minutes: 8 * 60,
		Effect: Needs{Energy: -40, Hygiene: -10, Fun: -10, Social: 15},
		Levels: []Level{{"Aide-soignant·e", 2500}, {"Infirmier·ère", 3600}, {"Sage-femme / Major", 4600}, {"Médecin", 6300}, {"Professeur·e de médecine", 7800}}},
	// The tills of the supermarkets (in the shopping centres), the shops' counters, the hotels, the lawyers'
	// chambers (in the office towers), the pharmacies, the police stations, the airports.
	{ID: "caisse", Label: "Caisse", Icon: "shopping-cart", Kind: "mall", MinHour: 7, MaxHour: 14, Minutes: 7 * 60,
		Effect: Needs{Energy: -30, Fun: -15, Hunger: -15, Social: 15},
		Levels: []Level{{"Caissier·ère stagiaire", 1700}, {"Caissier·ère", 2300}, {"Chef de caisse", 3200}, {"Responsable de magasin", 4600}, {"Directeur·rice d'hypermarché", 6000}}},
	{ID: "vente", Label: "Vente en boutique", Icon: "shopping-bag", Kind: "boutique", Also: []string{"mall"}, MinHour: 8, MaxHour: 13, Minutes: 7 * 60,
		Effect: Needs{Energy: -25, Fun: -5, Hunger: -15, Social: 25},
		Levels: []Level{{"Vendeur·se", 1900}, {"Conseiller·ère de vente", 2600}, {"Responsable de boutique", 3800}, {"Gérant·e", 5000}, {"Patron·ne d'une chaîne de boutiques", 6300}}},
	{ID: "hotellerie", Label: "Hôtellerie", Icon: "hotel", Kind: "hotel", MinHour: 6, MaxHour: 16, Minutes: 8 * 60,
		Effect: Needs{Energy: -30, Fun: -5, Hunger: -15, Social: 20},
		Levels: []Level{{"Bagagiste", 1900}, {"Réceptionniste", 3000}, {"Chef de réception", 4300}, {"Directeur·rice d'hôtel", 6300}, {"Propriétaire d'hôtels", 8200}}},
	{ID: "droit", Label: "Droit", Icon: "gavel", Kind: "office", MinHour: 8, MaxHour: 11, Minutes: 8 * 60, Days: Weekdays,
		Effect: Needs{Energy: -35, Fun: -15, Hunger: -20, Social: 10},
		Levels: []Level{{"Stagiaire en cabinet", 2500}, {"Avocat·e collaborateur·rice", 4600}, {"Avocat·e associé·e", 7000}, {"Bâtonnier·ère", 9400}, {"Ténor du barreau", 11200}}},
	{ID: "pharmacie", Label: "Pharmacie", Icon: "pill", Kind: "pharmacie", MinHour: 7, MaxHour: 15, Minutes: 8 * 60,
		Effect: Needs{Energy: -25, Fun: -10, Hunger: -15, Social: 15},
		Levels: []Level{{"Vendeur·se en pharmacie", 2100}, {"Préparateur·rice", 2800}, {"Pharmacien·ne assistant·e", 4100}, {"Pharmacien·ne titulaire", 5900}, {"Propriétaire de pharmacies", 7200}}},
	{ID: "police", Label: "Police", Icon: "shield", Kind: "police", MinHour: 6, MaxHour: 20, Minutes: 8 * 60,
		Effect: Needs{Energy: -35, Hygiene: -10, Fun: -10, Social: 10},
		Levels: []Level{{"Gardien·ne de la paix", 2500}, {"Brigadier·ère", 3300}, {"Lieutenant·e", 4600}, {"Commissaire", 6300}, {"Directeur·rice général·e de la police", 7800}}},
	{ID: "aerien", Label: "Aéroport", Icon: "plane", Kind: "aeroport", MinHour: 4, MaxHour: 16, Minutes: 8 * 60,
		Effect: Needs{Energy: -30, Fun: -5, Hunger: -15, Social: 15},
		Levels: []Level{{"Agent·e d'escale", 2500}, {"Hôte·sse d'enregistrement", 3300}, {"Chef d'escale", 4900}, {"Directeur·rice des opérations", 6700}, {"Directeur·rice général·e de l'aéroport", 8700}}},
}

func FindCareer(id string) (Career, bool) {
	for _, c := range Careers {
		if c.ID == id {
			return c, true
		}
	}
	return Career{}, false
}

// WorkInteractionID is the interaction a Sim performs at their workplace.
const WorkInteractionID = "work"

// PerformanceToPromote is how many points a level needs, times the level.
const PerformanceToPromote = 10

// Shift returns the work interaction for the given level (0-based).
func (c Career) Shift(level int) Interaction {
	l := c.Levels[level]
	return Interaction{
		ID: WorkInteractionID, Label: fmt.Sprintf("Aller au travail (%s)", l.Title), Icon: c.Icon,
		Minutes: c.Minutes, Cost: -l.Pay, Effect: c.Effect, MinHour: c.MinHour, MaxHour: c.MaxHour, Days: c.Days,
	}
}

// ShiftPerformance is what one shift adds to the Sim's performance: a happy
// Sim works better, and hard workers get a bonus.
func ShiftPerformance(mood float64, hardWorker bool) int {
	p := int(mood / 25) // 0..4
	if hardWorker {
		p++
	}
	return p
}

// NeededToPromote is the performance needed to leave the given level.
func NeededToPromote(level int) int { return PerformanceToPromote * (level + 1) }

// Weekly charges fall due at 00:00 every Saturday.
const (
	saturday         = 5 // day index, Monday is 0
	minutesPerDay    = 24 * 60
	minutesPerWeek   = 7 * minutesPerDay
	LoanInstallment  = 10000
	EvictionArrears  = 2 // weeks of unpaid rent before eviction
	firstSaturdayMin = saturday * minutesPerDay
)

// Saturdays counts the Saturday midnights in (from, to].
func Saturdays(from, to int64) int {
	if to <= from {
		return 0
	}
	count := func(m int64) int64 {
		if m < firstSaturdayMin {
			return 0
		}
		return (m-firstSaturdayMin)/minutesPerWeek + 1
	}
	return int(count(to) - count(from))
}

// Ledger is the money side of a Sim that weekly charges touch.
type Ledger struct {
	Money       int    `json:"money"`
	Loan        int    `json:"loan"`
	RentArrears int    `json:"rentArrears"`
	Housing     string `json:"housing"`
}

// A Charge is one line of what happened on a Saturday, for the journal.
type Charge struct {
	Text  string
	Money int
}

// WeekEnd settles one Saturday: rent first, then a loan installment.
// Rent that can't be paid piles up; too much and the landlord evicts the Sim
// to the cheaper tier.
func WeekEnd(l Ledger) (Ledger, []Charge) {
	var out []Charge
	h, _ := FindHousing(l.Housing)

	due := h.Rent + l.RentArrears
	if l.Housing == OwnHouse && l.RentArrears == 0 {
		// One's own house: no landlord on Saturday.
	} else if l.Money >= due {
		l.Money -= due
		l.RentArrears = 0
		out = append(out, Charge{fmt.Sprintf("Samedi : loyer de ton %s payé.", LowerFirst(h.Label)), -due})
	} else {
		paid := max(l.Money, 0)
		l.Money -= paid
		l.RentArrears = due - paid
		if paid > 0 {
			out = append(out, Charge{fmt.Sprintf("Samedi : tu donnes ce que tu as au propriétaire. Il manque encore %s.", FCFA(l.RentArrears)), -paid})
		} else {
			out = append(out, Charge{fmt.Sprintf("Samedi : le propriétaire frappe à la porte. Tu lui dois %s.", FCFA(l.RentArrears)), 0})
		}
		if l.RentArrears >= EvictionArrears*h.Rent {
			if lowerTier, ok := tierBelow(h.ID); ok {
				l.Housing = lowerTier.ID
				l.RentArrears = 0
				out = append(out, Charge{fmt.Sprintf("Expulsé·e ! Tu dois te replier dans un %s.", LowerFirst(lowerTier.Label)), 0})
			}
		}
	}

	if l.Loan > 0 {
		pay := min(LoanInstallment, l.Loan, max(l.Money, 0))
		if pay > 0 {
			l.Money -= pay
			l.Loan -= pay
			out = append(out, Charge{fmt.Sprintf("L'agent de la microfinance passe : %s remboursés. Reste %s.", FCFA(pay), FCFA(l.Loan)), -pay})
		} else {
			out = append(out, Charge{"L'agent de la microfinance repart les mains vides… il reviendra.", 0})
		}
	}
	return l, out
}

func tierBelow(id string) (Housing, bool) {
	for i, h := range Housings {
		if h.ID == id && i > 0 {
			return Housings[i-1], true
		}
	}
	return Housing{}, false
}

// LowerFirst lowercases the first letter, for labels used mid-sentence.
func LowerFirst(s string) string {
	if s == "" {
		return s
	}
	r := []rune(s)
	if r[0] >= 'A' && r[0] <= 'Z' {
		r[0] += 'a' - 'A'
	}
	return string(r)
}

// FCFA formats an amount the French way, as the journal writes it: 10 000F.
func FCFA(n int) string {
	s := fmt.Sprint(n)
	neg := strings.HasPrefix(s, "-")
	s = strings.TrimPrefix(s, "-")
	var b strings.Builder
	for i, r := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteRune(' ') // narrow no-break space
		}
		b.WriteRune(r)
	}
	if neg {
		return "-" + b.String() + "F"
	}
	return b.String() + "F"
}
