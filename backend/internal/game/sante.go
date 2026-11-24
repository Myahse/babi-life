package game

import "math"

// La santé (the update « cycle-vie », sims/sante.go; web components/Sante.tsx): a Sim can fall ill, as in
// life in Abidjan: the palu (the mosquitoes, at night, without a net), the flu (worn out), the typhoid and
// the stomach ache (the hygiene let go), the sprain (the sport). Ill, it's tired faster and in a low mood;
// left untreated, it gets worse each day (« sérieux », then « grave »: the hospital). The pharmacy's
// medicines treat a light illness, the health centre's consultation any. A mosquito net keeps the palu away.

// CycleVieKey: the update (illness; the funerals, funerailles.go).
const CycleVieKey = "cycle-vie"

// MoustiquaireID: the mosquito net bought at the pharmacy (an interaction of its own).
const MoustiquaireID = "moustiquaire"

// Sickness: an illness one can catch.
type Sickness struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	// Feel: what the Sim feels (its first line); Worse: once it's serious.
	Feel  string `json:"feel"`
	Worse string `json:"worse"`
	// Drain: what it takes an hour on top of the usual (energy, fun), at « léger »; twice serious, thrice grave.
	Drain Needs `json:"-"`
}

// Sicknesses: what can be caught.
var Sicknesses = []Sickness{
	{ID: "palu", Label: "Paludisme", Icon: "thermometer", Feel: "Des frissons, la fièvre, mal à la tête… c'est le palu. Va à la pharmacie ou au centre de santé.", Worse: "Le palu s'aggrave : la fièvre ne tombe plus. Il faut voir un médecin, vite.", Drain: Needs{Energy: 6, Fun: 3, Hunger: 2}},
	{ID: "grippe", Label: "Grippe", Icon: "thermometer", Feel: "Le nez qui coule, la gorge qui gratte, les courbatures : une bonne grippe.", Worse: "La grippe ne passe pas : tu tousses toute la nuit.", Drain: Needs{Energy: 4, Fun: 3}},
	{ID: "typhoide", Label: "Fièvre typhoïde", Icon: "thermometer", Feel: "Mal au ventre, la fièvre : la typhoïde, sans doute l'eau ou les mains sales. Soigne-toi et lave-toi.", Worse: "La typhoïde t'épuise : tu ne tiens plus debout.", Drain: Needs{Energy: 5, Hunger: 4, Fun: 3}},
	{ID: "ventre", Label: "Mal de ventre", Icon: "pill", Feel: "Ton ventre gargouille… quelque chose n'est pas passé.", Worse: "Le mal de ventre empire : tu passes ta vie aux toilettes.", Drain: Needs{Hunger: 4, Hygiene: 3, Fun: 2}},
	{ID: "entorse", Label: "Entorse", Icon: "bone", Feel: "Ta cheville a tourné : elle gonfle. Pas de sport pour l'instant.", Worse: "L'entorse ne guérit pas seule : tu boites partout.", Drain: Needs{Energy: 3, Fun: 4}},
}

// FindSickness: an illness by its id.
func FindSickness(id string) (Sickness, bool) {
	for _, s := range Sicknesses {
		if s.ID == id {
			return s, true
		}
	}
	return Sickness{}, false
}

// The stages, and their rules.
const (
	SickLight   = 1
	SickSerious = 2
	SickGrave   = 3
	// SickWorseAfter: real hours untreated before it goes up a stage.
	SickWorseAfter = 24
	// SickCheckMax: the hours counted at most for catching something (the game left closed a week isn't a week of risk).
	SickCheckMax = 8
	// SickHealsAfter: a light illness goes away by itself after so many hours (the flu, the stomach), the others don't.
	SickHealsAfter = 36
)

// SickRisk: the chance an hour of catching something, and what, from how the Sim is: its needs, its age (a
// senior catches more), the net over its bed, the hour (the mosquitoes bite at night).
func SickRisk(n Needs, senior, net, night bool) map[string]float64 {
	r := map[string]float64{
		// The palu: a little all the time, more at night, a lot less under a net.
		"palu":     0.0025,
		"grippe":   0.001,
		"typhoide": 0,
		"ventre":   0,
	}
	if night {
		r["palu"] *= 2
	}
	if net {
		r["palu"] *= 0.15
	}
	if n.Energy < 25 {
		r["grippe"] += 0.006
	}
	if n.Hygiene < 25 {
		r["typhoide"] += 0.003
		r["ventre"] += 0.006
	}
	if senior {
		for k := range r {
			r[k] *= 1.6
		}
	}
	return r
}

// SickRoll: what's caught over `hours` (one roll an hour, the first that comes), or "".
func SickRoll(risk map[string]float64, hours float64, roll func() float64) string {
	hours = math.Min(hours, SickCheckMax)
	order := []string{"palu", "grippe", "typhoide", "ventre"}
	for h := 0.0; h < hours; h++ {
		share := math.Min(1, hours-h)
		for _, id := range order {
			if roll() < risk[id]*share {
				return id
			}
		}
	}
	return ""
}

// SportIDs: the activities a sprain can come from (one in SprainChance, done to the end).
var SportIDs = []string{"play-football", "play-basket", "street-foot", "street-basket", "play-foot11", "stade-footing", "beach-foot", "gym-boxe", "beach-volley"}

const SprainChance = 0.05

// Cures: the activity that treats an illness up to a stage (the pharmacy's medicines a light one, the
// consultation any). Done to the end.
var Cures = map[string]int{"medicaments": SickLight, "consultation": SickGrave}

// SickDrain: what an illness at a stage takes over `hours`.
func SickDrain(s Sickness, stage int, hours float64) Needs {
	k := float64(stage) * hours
	return Needs{Hunger: -s.Drain.Hunger * k, Energy: -s.Drain.Energy * k, Hygiene: -s.Drain.Hygiene * k, Social: -s.Drain.Social * k, Fun: -s.Drain.Fun * k}
}

func init() {
	// The mosquito net, at the pharmacy (hidden while the update is closed: features.go lists it).
	k := Kinds["pharmacie"]
	k.Interactions = append(k.Interactions, Interaction{ID: MoustiquaireID, Label: "Acheter une moustiquaire imprégnée", Icon: "shield", Minutes: 5, Cost: 3000, Effect: Needs{Fun: 2}})
	Kinds["pharmacie"] = k
}
