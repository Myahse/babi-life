package game

// The mentor (the update « mentor »): at 18, someone close to the family takes
// the Sim under their wing. Who they are follows the family's means, from the
// businessman of the debout to the old docker of the gnambro; what they give
// as a hand too (and always within the day's limits: money.go). They advise
// every time, help now and then.

type Mentor struct {
	Family string `json:"family"`
	Name   string `json:"name"`
	Gender string `json:"gender"`
	Title  string `json:"title"`
	// Intro: what they say the first time.
	Intro string `json:"intro"`
	// Help: the hand they give, in Djai (a range).
	Help [2]int `json:"help"`
}

var Mentors = []Mentor{
	{Family: "debout", Name: "Tonton Hamed", Gender: "homme", Title: "Homme d'affaires, ami de ton père", Intro: "Tu es un homme maintenant, ou une femme. Le nom de la famille ouvre des portes, mais c'est le travail qui les garde ouvertes.", Help: [2]int{8000, 15000}},
	{Family: "late", Name: "Madame Koffi", Gender: "femme", Title: "Directrice d'agence bancaire", Intro: "Je t'ai connu tout petit. Un compte, un budget, une ambition : voilà ce qu'il te faut maintenant.", Help: [2]int{6000, 12000}},
	{Family: "lagnon", Name: "Le vieux Diabaté", Gender: "homme", Title: "Grand commerçant d'Adjamé", Intro: "Au marché, on dit : petit à petit, l'oiseau fait son nid. Viens me voir quand tu veux, ma porte est ouverte.", Help: [2]int{4000, 8000}},
	{Family: "poignon", Name: "Tantie Rose", Gender: "femme", Title: "Couturière à son compte", Intro: "Moi j'ai commencé avec une machine à coudre et beaucoup de courage. Toi aussi tu vas y arriver.", Help: [2]int{2500, 5000}},
	{Family: "coule", Name: "Grand frère Seydou", Gender: "homme", Title: "Ancien apprenti gbaka, patron de trois gbakas", Intro: "J'ai commencé en criant « Adjamé ! » sur un marchepied. Aujourd'hui j'ai mes propres gbakas. Écoute-moi bien.", Help: [2]int{1500, 3500}},
	{Family: "gnambro", Name: "Vieux père Ali", Gender: "homme", Title: "Ancien docker du port", Intro: "On n'a pas grand-chose, mais on a la parole et la dignité. Je serai là pour toi.", Help: [2]int{1000, 2500}},
}

// MentorOf: the mentor of a family (the last, the old docker, for a family the game doesn't know).
func MentorOf(family string) Mentor {
	for _, m := range Mentors {
		if m.Family == family {
			return m
		}
	}
	return Mentors[len(Mentors)-1]
}

// MentorWeek: a game week between two hands.
const MentorWeek = 7 * 24 * 60

// MentorKey: the update the mentor comes with.
const MentorKey = "mentor"
