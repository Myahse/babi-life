package game

import (
	"fmt"
	"math"
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
}

type Level struct {
	Title string `json:"title"`
	Pay   int    `json:"pay"` // FCFA per shift
}

var Careers = []Career{
	{ID: "bureau", Label: "Bureau", Icon: "briefcase", Kind: "office", MinHour: 7, MaxHour: 11, Minutes: 8 * 60,
		Effect: Needs{Energy: -35, Fun: -20, Hunger: -20, Social: 10},
		Levels: []Level{{"Stagiaire", 6000}, {"Assistant·e", 12000}, {"Chef de service", 22000}, {"Directeur·rice", 40000}, {"PDG", 70000}}},
	{ID: "maquis", Label: "Restauration", Icon: "chef-hat", Kind: "maquis", MinHour: 10, MaxHour: 18, Minutes: 6 * 60,
		Effect: Needs{Energy: -30, Hygiene: -20, Hunger: 10, Social: 15},
		Levels: []Level{{"Plongeur·se", 4000}, {"Serveur·se", 7000}, {"Cuisinier·ère", 12000}, {"Chef du maquis", 20000}, {"Patron·ne de maquis", 35000}}},
	{ID: "commerce", Label: "Commerce", Icon: "store", Kind: "market", MinHour: 6, MaxHour: 12, Minutes: 6 * 60,
		Effect: Needs{Energy: -25, Hygiene: -15, Social: 20, Fun: -5},
		Levels: []Level{{"Vendeur·se ambulant·e", 4500}, {"Petite table", 8000}, {"Boutiquier·ère", 14000}, {"Grossiste", 25000}, {"Roi·Reine du marché", 45000}}},
	{ID: "transport", Label: "Transport", Icon: "bus", Kind: "transport", MinHour: 5, MaxHour: 14, Minutes: 7 * 60,
		Effect: Needs{Energy: -30, Hygiene: -20, Fun: -10, Social: 10},
		Levels: []Level{{"Apprenti gbaka", 4000}, {"Chauffeur de woro-woro", 9000}, {"Chauffeur de car", 15000}, {"Chef de gare", 24000}, {"Propriétaire de flotte", 42000}}},
	{ID: "ambiance", Label: "Ambiance", Icon: "disc-3", Kind: "club", MinHour: 21, MaxHour: 2, Minutes: 5 * 60,
		Effect: Needs{Energy: -40, Hygiene: -15, Fun: 20, Social: 25},
		Levels: []Level{{"DJ de quartier", 5000}, {"Animateur·rice", 10000}, {"DJ de la Rue Princesse", 18000}, {"Artiste coupé-décalé", 32000}, {"Star internationale", 60000}}},
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
		Minutes: c.Minutes, Cost: -l.Pay, Effect: c.Effect, MinHour: c.MinHour, MaxHour: c.MaxHour,
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
	if l.Money >= due {
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
