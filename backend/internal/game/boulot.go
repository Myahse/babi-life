package game

import "math"

// Le mode vie's lived work day (the update « mode-vie », sims/boulot.go; web components/LifeWork.tsx): the
// shift (or a child's day at school) is lived from home. The Sim is picked up at the door (the gbaka, a
// woro-woro, the company's car, or on foot), is away for the shift, and the player chooses how it works
// (WorkStyles): the choice weighs on the performance, the needs and the colleagues. Once a shift, at
// most, something happens that asks for a choice (WorkEvents). Back home with the pay, a mood, the
// performance moved and maybe a promotion. All of it decided here and in sims/boulot.go.

// WorkStyle: one way of working through the shift. Over a whole shift in it: Perf points of performance
// (the promotion's), Effect on the needs on top of the job's own, Colleagues on their friendship.
type WorkStyle struct {
	ID         string  `json:"id"`
	Label      string  `json:"label"`
	Icon       string  `json:"icon"`
	Hint       string  `json:"hint"`
	Perf       float64 `json:"perf"`
	Effect     Needs   `json:"effect"`
	Colleagues int     `json:"colleagues"`
}

// The four ways of working, the same ids at work and at school (their words differ).
const (
	StyleHard    = "dur"
	StyleNormal  = "normal"
	StyleChat    = "collegues"
	StyleMinimum = "minimum"
)

// WorkStyles: at work.
var WorkStyles = []WorkStyle{
	{ID: StyleHard, Label: "Travailler dur", Icon: "flame", Hint: "La performance monte vite, mais c'est fatigant", Perf: 4, Effect: Needs{Energy: -15, Fun: -10}},
	{ID: StyleNormal, Label: "Normalement", Icon: "briefcase", Hint: "Ni trop ni trop peu", Perf: 1.5, Colleagues: 2},
	{ID: StyleChat, Label: "Discuter avec les collègues", Icon: "messages-square", Hint: "Les collègues t'apprécient, le travail attend", Perf: 0, Effect: Needs{Social: 20, Fun: 10}, Colleagues: 14},
	{ID: StyleMinimum, Label: "Faire le minimum", Icon: "coffee", Hint: "Moins fatigant, mais le chef le remarque", Perf: -2, Effect: Needs{Energy: 15, Fun: 6}},
}

// SchoolStyles: at school (children and teens).
var SchoolStyles = []WorkStyle{
	{ID: StyleHard, Label: "Bien écouter en classe", Icon: "book-open", Hint: "Les notes montent, mais c'est fatigant", Perf: 4, Effect: Needs{Energy: -10, Fun: -10}},
	{ID: StyleNormal, Label: "Normalement", Icon: "school", Hint: "Ni trop ni trop peu", Perf: 1.5, Colleagues: 2},
	{ID: StyleChat, Label: "Bavarder avec les copains", Icon: "messages-square", Hint: "Les copains t'adorent, le maître moins", Perf: 0, Effect: Needs{Social: 20, Fun: 12}, Colleagues: 14},
	{ID: StyleMinimum, Label: "Faire le minimum", Icon: "coffee", Hint: "Tranquille, mais les notes baissent", Perf: -2, Effect: Needs{Energy: 12, Fun: 6}},
}

// StyleOf: the style `id` at work or at school; the normal one for anything else.
func StyleOf(id string, school bool) WorkStyle {
	list := WorkStyles
	if school {
		list = SchoolStyles
	}
	for _, s := range list {
		if s.ID == id {
			return s
		}
	}
	return list[1]
}

// WorkChoice: one answer to a work event. Skill: a check on that skill's level (SkillChance); failed,
// the Fail* fields are what comes of it instead. Late: the shift goes on this many minutes more
// (the Sim stays late). Bonus: a share of the shift's pay on top.
type WorkChoice struct {
	Label      string  `json:"label"`
	Icon       string  `json:"icon"`
	Perf       float64 `json:"-"`
	Effect     Needs   `json:"-"`
	Colleagues int     `json:"-"`
	Mood       string  `json:"-"`
	Bonus      float64 `json:"-"`
	Late       int64   `json:"-"`
	Result     string  `json:"-"`
	Skill      string  `json:"skill,omitempty"`
	FailPerf   float64 `json:"-"`
	FailMood   string  `json:"-"`
	FailResult string  `json:"-"`
}

// WorkEvent: something that happens during the shift and asks the player what to do.
type WorkEvent struct {
	ID      string        `json:"id"`
	Text    string        `json:"text"`
	Icon    string        `json:"icon"`
	Choices [2]WorkChoice `json:"choices"`
}

// WorkEvents: at work, in every job (said so it fits any of them).
var WorkEvents = []WorkEvent{
	{ID: "tard", Text: "Ton chef te demande de rester tard ce soir.", Icon: "clock", Choices: [2]WorkChoice{
		{Label: "Rester", Icon: "clock", Perf: 3, Effect: Needs{Energy: -12, Fun: -6}, Bonus: 0.15, Late: 1, Mood: "tard", Result: "Tu restes. Le chef te remercie : une prime t'attend."},
		{Label: "Refuser poliment", Icon: "hand", Perf: -1, Result: "« Une autre fois, chef. » Il fait la moue."},
	}},
	{ID: "aide", Text: "Un·e collègue est débordé·e et te demande un coup de main.", Icon: "handshake", Choices: [2]WorkChoice{
		{Label: "L'aider", Icon: "handshake", Perf: 1, Effect: Needs{Energy: -6}, Colleagues: 12, Result: "À deux, c'est vite fait. Ton collègue ne l'oubliera pas."},
		{Label: "« Pas le temps »", Icon: "x", Colleagues: -10, Result: "Tu gardes ton temps pour toi. Ambiance un peu froide."},
	}},
	{ID: "patron", Text: "Réunion surprise : le grand patron veut entendre tes idées.", Icon: "presentation", Choices: [2]WorkChoice{
		{Label: "Présenter tes idées", Icon: "sparkles", Skill: "charisme", Perf: 5, Mood: "fier", Result: "Le patron hoche la tête : « Très bien. On en reparle. »", FailPerf: -2, FailMood: "honte", FailResult: "Tu bafouilles devant tout le monde…"},
		{Label: "Rester discret·e", Icon: "eye-off", Result: "Tu notes tout sans un mot. Rien de gagné, rien de perdu."},
	}},
	{ID: "courant", Text: "Délestage ! Plus de courant pendant une heure.", Icon: "zap-off", Choices: [2]WorkChoice{
		{Label: "Continuer à la main", Icon: "pen-line", Perf: 2, Effect: Needs{Fun: -10}, Result: "Stylo et papier : le travail avance quand même."},
		{Label: "Pause café avec les collègues", Icon: "coffee", Perf: -1, Effect: Needs{Fun: 10, Social: 10}, Colleagues: 6, Result: "Café, rires et gbairai en attendant la CIE."},
	}},
	{ID: "client", Text: "Un client mécontent fait un scandale.", Icon: "megaphone", Choices: [2]WorkChoice{
		{Label: "Le calmer", Icon: "hand-heart", Skill: "charisme", Perf: 3, Result: "Tu trouves les mots. Il repart en souriant.", FailPerf: -1, FailMood: "rejete", FailResult: "Il crie encore plus fort. Le chef doit venir."},
		{Label: "Appeler le chef", Icon: "phone", Perf: -1, Result: "Le chef règle ça. Il aurait aimé que tu t'en charges."},
	}},
	{ID: "pot", Text: "Pot de départ d'un collègue à la pause.", Icon: "party-popper", Choices: [2]WorkChoice{
		{Label: "Y aller", Icon: "party-popper", Effect: Needs{Social: 20, Fun: 12, Hunger: 10}, Colleagues: 8, Mood: "bon-moment", Result: "Discours, gâteau et sucreries : bon moment."},
		{Label: "Continuer à travailler", Icon: "briefcase", Perf: 1, Colleagues: -3, Result: "Tu avances pendant que les autres trinquent."},
	}},
	{ID: "erreur", Text: "Tu découvres une erreur dans le travail d'un collègue.", Icon: "search", Choices: [2]WorkChoice{
		{Label: "La corriger discrètement", Icon: "eraser", Perf: 1, Colleagues: 10, Result: "Corrigé sans bruit. Ton collègue te doit une fière chandelle."},
		{Label: "Le dire au chef", Icon: "flag", Perf: 2, Colleagues: -12, Result: "Le chef apprécie. Ton collègue, beaucoup moins."},
	}},
}

// SchoolEvents: at school.
var SchoolEvents = []WorkEvent{
	{ID: "question", Text: "La maîtresse pose une question difficile à la classe.", Icon: "circle-help", Choices: [2]WorkChoice{
		{Label: "Lever le doigt", Icon: "hand", Skill: "logique", Perf: 4, Mood: "fier", Result: "Bonne réponse ! La maîtresse te félicite.", FailPerf: -1, FailMood: "honte", FailResult: "Mauvaise réponse… la classe rigole."},
		{Label: "Se faire tout petit", Icon: "eye-off", Result: "Elle interroge quelqu'un d'autre. Ouf."},
	}},
	{ID: "video", Text: "Ton voisin de table veut te montrer une vidéo pendant le cours.", Icon: "smartphone", Choices: [2]WorkChoice{
		{Label: "Regarder en cachette", Icon: "smartphone", Perf: -2, Effect: Needs{Fun: 12}, Colleagues: 6, Result: "Trop drôle… jusqu'à ce que le maître vous regarde."},
		{Label: "Rester concentré·e", Icon: "book-open", Perf: 1, Result: "Tu suis le cours. Ton voisin boude un peu."},
	}},
	{ID: "interro", Text: "Interro surprise !", Icon: "file-pen-line", Choices: [2]WorkChoice{
		{Label: "Tout donner", Icon: "brain", Skill: "logique", Perf: 4, Effect: Needs{Energy: -6}, Result: "Tu connais tout. Ça sent la bonne note.", FailPerf: -2, FailMood: "honte", FailResult: "Trou noir… ça sent la mauvaise note."},
		{Label: "Répondre au hasard", Icon: "dices", Perf: -1, Result: "Advienne que pourra."},
	}},
	{ID: "recre", Text: "À la récré, les copains t'invitent à jouer au foot.", Icon: "volleyball", Choices: [2]WorkChoice{
		{Label: "Jouer", Icon: "volleyball", Effect: Needs{Social: 15, Fun: 15, Energy: -8, Hygiene: -8}, Colleagues: 8, Result: "Deux buts ! Tu rentres en classe en sueur et content·e."},
		{Label: "Réviser la leçon", Icon: "book-open", Perf: 1, Result: "Tu relis ta leçon au calme."},
	}},
}

// EventOf: the event `id`, at work or at school.
func EventOf(id string, school bool) (WorkEvent, bool) {
	list := WorkEvents
	if school {
		list = SchoolEvents
	}
	for _, e := range list {
		if e.ID == id {
			return e, true
		}
	}
	return WorkEvent{}, false
}

// SkillChance: how likely a check on a skill passes at its level (1..10): 42 % to 95 %.
func SkillChance(level int) float64 {
	return math.Min(0.95, 0.35+0.07*float64(max(1, level)))
}

// Shift: the work day lived (le mode vie), kept on the activity while it lasts: how the Sim rides there
// (Ride: gbaka, woro, voiture (the company's), marche, car-ecole), the style it works in now since when
// (game minute) and the minutes spent in each before; the event drawn for this shift (Event, from the
// minute EventAt), the choice made (Choice: 0, 1; -1 not yet) and its result; what the choices added
// (Perf, Bonus: a share of the pay, Coll: the colleagues' friendship).
type Shift struct {
	School  bool             `json:"school,omitempty"`
	Ride    string           `json:"ride"`
	Style   string           `json:"style"`
	Since   int64            `json:"since"`
	Spent   map[string]int64 `json:"spent,omitempty"`
	Event   string           `json:"event,omitempty"`
	EventAt int64            `json:"eventAt,omitempty"`
	Choice  int              `json:"choice"`
	Result  string           `json:"result,omitempty"`
	Perf    float64          `json:"perf,omitempty"`
	Bonus   float64          `json:"bonus,omitempty"`
	Coll    int              `json:"coll,omitempty"`
	Late    bool             `json:"late,omitempty"`
}

// StylePerf: what the styles worked in add to the performance over the shift's length (minutes).
func StylePerf(spent map[string]int64, school bool, length int64) (perf float64, coll int, effect Needs) {
	length = max(1, length)
	for id, m := range spent {
		st := StyleOf(id, school)
		k := math.Min(1, float64(m)/float64(length))
		perf += st.Perf * k
		coll += int(math.Round(float64(st.Colleagues) * k))
		effect = effect.Add(st.Effect.Scale(k))
	}
	return perf, coll, effect
}

// Grade: a child's « performance scolaire » (0..100) said as a mark (A to F).
func Grade(g int) string {
	switch {
	case g >= 85:
		return "A"
	case g >= 70:
		return "B"
	case g >= 50:
		return "C"
	case g >= 30:
		return "D"
	}
	return "F"
}

// GradeStart: where a child's grade starts.
const GradeStart = 50

// GradePerPoint: how much a point of the day's performance moves the grade.
const GradePerPoint = 4
