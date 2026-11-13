package game

import (
	"fmt"
	"slices"
)

// Le mode vie's next pillars (the update « mode-vie », sims/vie.go; web game/vie.ts): the moods a Sim is
// in (moodlets: small effects with a reason and a time), its skills (cuisine, charisme, forme…: levels 1
// to 10, earned by doing), its relationships (a friendship and a romance gauge per person, and what they
// are to each other). The catalogues are here; the server keeps them per Sim.

// Moodlet: one small effect on the mood: why (its label, and who or what: Reason), how much (Weight,
// -3..+3), until when (game minute). Need: it comes from a need that is low, and lasts while it is.
type Moodlet struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Icon   string `json:"icon"`
	Weight int    `json:"weight"`
	Until  int64  `json:"until"`
	Reason string `json:"reason,omitempty"`
	Need   bool   `json:"need,omitempty"`
}

// MoodletDef: what a moodlet is called, its icon, its weight and how long it lasts (game minutes).
type MoodletDef struct {
	Label   string
	Icon    string
	Weight  int
	Minutes int64
}

// Moodlets: every mood the server gives. The game's clock is the real one, and actions are short (a meal,
// a couple of minutes): a mood lasts an hour or a few.
var Moodlets = map[string]MoodletDef{
	// From what was done.
	"bien-mange":    {"A bien mangé", "utensils", 1, 90},
	"festin":        {"Un vrai festin", "chef-hat", 2, 150},
	"douche":        {"Douche fraîche", "shower-head", 1, 90},
	"bien-dormi":    {"Bien dormi", "bed-double", 1, 180},
	"belle-soiree":  {"Belle soirée au maquis", "beer", 2, 180},
	"salaire":       {"Salaire reçu", "banknote", 2, 120},
	"en-forme":      {"En forme après le sport", "dumbbell", 1, 90},
	"inspire":       {"Inspiré·e par la musique", "music", 1, 60},
	"fier":          {"Fier·e de progresser", "trophy", 2, 120},
	"maison-propre": {"Maison propre", "sparkles", 1, 180},
	"bon-moment":    {"Bon moment ensemble", "smile", 1, 60},
	"amoureux":      {"Amoureux·se", "heart", 2, 240},
	"envie":         {"Envie réalisée", "star", 1, 90},
	// The generations and the visitors (sims/famille.go).
	"anniversaire": {"Joyeux anniversaire", "cake", 3, 360},
	"enceinte":     {"Un bébé en route", "baby", 1, 0},
	"jeune-parent": {"Jeune parent", "baby", 2, 720},
	"bonne-visite": {"Belle visite", "door-open", 2, 180},
	"nouvelle-vie": {"La maison reprise", "house", 2, 720},
	"deuil":        {"En deuil", "flower", -2, 1440},
	"serein":       {"Serein·e", "sunset", 1, 0},
	// From what happened.
	"dispute":      {"Dispute", "frown", -2, 180},
	"chagrin":      {"Chagrin d'amour", "heart-crack", -3, 720},
	"rejete":       {"Vexé·e", "annoyed", -1, 60},
	"nuit-blanche": {"Nuit blanche", "moon", -2, 240},
	"maison-sale":  {"Maison sale", "trash-2", -1, 0},
	"pluie":        {"Pluie", "cloud-rain", -1, 0},
	// From the needs (they last while the need is low).
	"faim":    {"Affamé·e", "utensils-crossed", -2, 0},
	"fatigue": {"Épuisé·e", "battery-low", -2, 0},
	"sale":    {"Pas lavé·e", "droplets", -1, 0},
	"seul":    {"Seul·e", "user-x", -1, 0},
	"ennui":   {"S'ennuie", "meh", -1, 0},
	"repus":   {"Le ventre plein", "smile", 1, 0},
}

// NewMoodlet: the moodlet `id` from now (game minute), for `reason` (a name, a place; "" for none).
func NewMoodlet(id, reason string, now int64) Moodlet {
	d := Moodlets[id]
	label := d.Label
	if reason != "" {
		switch id {
		case "dispute":
			label = fmt.Sprintf("Dispute avec %s", reason)
		case "bon-moment":
			label = fmt.Sprintf("Bon moment avec %s", reason)
		case "amoureux":
			label = fmt.Sprintf("Amoureux·se de %s", reason)
		case "chagrin":
			label = fmt.Sprintf("Chagrin : %s est parti·e", reason)
		case "fier":
			label = fmt.Sprintf("Fier·e : %s", reason)
		case "rejete":
			label = fmt.Sprintf("Vexé·e par %s", reason)
		case "envie":
			label = fmt.Sprintf("Envie réalisée : %s", reason)
		}
	}
	return Moodlet{ID: id, Label: label, Icon: d.Icon, Weight: d.Weight, Until: now + d.Minutes, Reason: reason}
}

// Mood: the overall mood, from the moodlets: their weights added (Score), and its level, what it's called.
type Mood struct {
	Score int    `json:"score"`
	Level string `json:"level"`
	Label string `json:"label"`
}

// MoodOf: the moodlets' weights, added, and what that makes.
func MoodOf(ms []Moodlet) Mood {
	sc := 0
	for _, m := range ms {
		sc += m.Weight
	}
	switch {
	case sc >= 4:
		return Mood{sc, "ravi", "Ravi·e"}
	case sc >= 2:
		return Mood{sc, "heureux", "Heureux·se"}
	case sc >= -1:
		return Mood{sc, "bien", "Ça va"}
	case sc >= -3:
		return Mood{sc, "contrarie", "Contrarié·e"}
	}
	return Mood{sc, "mal", "Au plus mal"}
}

// MoodFactor: what the mood does to an action's good (a little: -10 % at the worst, +10 % at the best).
func MoodFactor(score int) float64 {
	return 1 + 0.025*float64(max(-4, min(4, score)))
}

// LifeInteractions: the home's actions le mode vie brings (catalog.go), shut with it.
var LifeInteractions = []string{"faire-menage", "miroir-discours", "pompes", "footing", "jouer-balafon", "jouer-dames", "bricoler", "cuisiner-kedjenou", "concert-salon", "entrainement-intense"}

// Skill: one of the Sim's skills, what it's called and its icon.
type Skill struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	// Hint: how it rises (the skills panel).
	Hint string `json:"hint"`
}

var Skills = []Skill{
	{ID: "cuisine", Label: "Cuisine", Icon: "cooking-pot", Hint: "À la gazinière : attiéké, kédjénou…"},
	{ID: "charisme", Label: "Charisme", Icon: "sparkles", Hint: "Devant le miroir, et en causant avec les gens"},
	{ID: "forme", Label: "Forme", Icon: "dumbbell", Hint: "La salle de sport, le footing, les pompes, le foot"},
	{ID: "bricolage", Label: "Bricolage", Icon: "hammer", Hint: "Réparer, ranger, faire le ménage"},
	{ID: "musique", Label: "Musique", Icon: "music", Hint: "Le balafon et la guitare à la maison"},
	{ID: "logique", Label: "Logique", Icon: "brain", Hint: "Les dames, les devoirs, les cours"},
	{ID: "danse", Label: "Danse", Icon: "disc-3", Hint: "Le coupé-décalé au maquis, en soirée, dans la rue"},
}

// SkillMax: the highest level.
const SkillMax = 10

// SkillXP: the points a level needs, from nothing (level 1 at 0; 100 for 2, 220 for 3, … 1620 for 10).
func SkillXP(level int) int {
	level = max(1, min(SkillMax, level))
	return 10 * (level - 1) * (level + 8)
}

// SkillLevel: the level these points make (1..10).
func SkillLevel(xp int) int {
	l := 1
	for l < SkillMax && xp >= SkillXP(l+1) {
		l++
	}
	return l
}

// SkillOf: the skill an action trains, and how much a minute of it counts (1 = the ordinary pace).
func SkillOf(interactionID string) (skill string, rate float64) {
	// La cuisine ivoirienne's recipes (cuisine.go): cooked from scratch, they teach more.
	if _, ok := FindRecipe(interactionID); ok {
		return "cuisine", 1.3
	}
	switch interactionID {
	case "cook-attieke", "logement-cuisiner", "preparer-attieke":
		return "cuisine", 1
	case "cuisiner-kedjenou":
		return "cuisine", 1.4
	case "aider-maison":
		return "cuisine", 0.6
	case "miroir-discours":
		return "charisme", 1.2
	case "musculation", "cardio", "tractions", "boxe-sac", "corde-a-sauter", "cours-collectif", "stade-footing", "pompes", "footing":
		return "forme", 1
	case "entrainement-intense":
		return "forme", 1.5
	case "play-football", "play-basket", "nager", "jouer-cour":
		return "forme", 0.6
	case "bricoler":
		return "bricolage", 1.2
	case "faire-menage":
		return "bricolage", 0.5
	case "jouer-balafon":
		return "musique", 1.2
	case "concert-salon":
		return "musique", 1.5
	case "jouer-dames":
		return "logique", 1.2
	case "devoirs", "cours-du-soir", "amphi", "iugb-english":
		return "logique", 0.8
	case "dance-coupe-decale", "danser-soiree", "danser-rue", "dance":
		return "danse", 1
	}
	return "", 0
}

// SkillGain: the points an action done to its end brings: by its length (real minutes, game.Length),
// faster with the trait that goes with it, a little with a good mood, and with its game well played
// (score 0..100; 0: left to play by itself, as an ordinary game).
func SkillGain(interactionID string, minutes int64, traits []string, moodScore, score int) (string, int) {
	skill, rate := SkillOf(interactionID)
	if skill == "" {
		return "", 0
	}
	g := 15 * float64(max(1, minutes)) * rate
	lean := map[string]string{"cuisine": "gourmand", "forme": "sportif", "musique": "artiste", "danse": "ambianceur", "charisme": "dragueur", "logique": "travailleur"}
	if t := lean[skill]; t != "" && slices.Contains(traits, t) {
		g *= 1.25
	}
	g *= MoodFactor(moodScore)
	if score > 0 {
		g *= 0.6 + 0.6*float64(score)/100
	}
	return skill, max(1, int(g+0.5))
}

// SkillBonus: what a skill's level adds to the good of the actions that train it (+3 % a level above 1).
func SkillBonus(level int) float64 {
	return 1 + 0.03*float64(max(0, level-1))
}

// CareerSkill: the skill a career's promotions ask for (le mode vie).
var CareerSkill = map[string]string{
	"bureau": "logique", "droit": "logique", "mairie": "charisme", "enseignement": "logique", "sante": "logique", "pharmacie": "logique",
	"maquis": "cuisine", "hotellerie": "cuisine", "commerce": "charisme", "vente": "charisme", "caisse": "charisme", "coiffure": "charisme",
	"ambiance": "danse", "transport": "bricolage", "police": "forme", "maitre-nageur": "forme", "aerien": "charisme", "armee": "forme",
}

// PromotionSkill: the level of the career's skill needed to be promoted to the level `to` (0-based): none to
// the second rung, then 2, 4, 6, 8.
func PromotionSkill(to int) int {
	if to <= 1 {
		return 0
	}
	return 2 * (to - 1)
}

// errSkill: an action that asks for a skill's level the Sim doesn't have yet.
func errSkill(skill string, level int) error {
	return fmt.Errorf("il faut le niveau %d en %s", level, SkillLabel(skill))
}

// SkillLabel: the skill's name, "" for none.
func SkillLabel(id string) string {
	for _, s := range Skills {
		if s.ID == id {
			return s.Label
		}
	}
	return ""
}

// Rel: a relationship's gauges: friendship (0..100) and romance (0..100), and fallen out (enemies).
type Rel struct {
	Friendship int  `json:"friendship"`
	Romance    int  `json:"romance"`
	Enemy      bool `json:"enemy,omitempty"`
}

// The relationship statuses (the web's relationships panel names them).
const (
	RelConnaissance = "connaissance"
	RelAmi          = "ami"
	RelMeilleurAmi  = "meilleur-ami"
	RelEnnemi       = "ennemi"
	RelPartenaire   = "partenaire"
)

// RelStatus: what two people are to each other, from their gauges.
func RelStatus(friendship, romance int, enemy, partner bool) string {
	switch {
	case partner:
		return RelPartenaire
	case enemy:
		return RelEnnemi
	case friendship >= 80:
		return RelMeilleurAmi
	case friendship >= 40:
		return RelAmi
	}
	return RelConnaissance
}

// Social: what can be said or done with someone in le mode vie's wheel, and what it asks of the relationship.
type Social struct {
	Topic string `json:"topic"`
	// MinFriendship / MinRomance: the gauges needed (0: anyone); Known: someone already met; Adult: between adults.
	MinFriendship int  `json:"minFriendship,omitempty"`
	MinRomance    int  `json:"minRomance,omitempty"`
	Known         bool `json:"known,omitempty"`
	Adult         bool `json:"adult,omitempty"`
	// Friendship / Romance: what it does to the gauges when it goes well (and Bad, when it goes badly).
	Friendship, Romance       int
	BadFriendship, BadRomance int
}

// Socials: the street's chat topics (sims/chat.go), with what each asks of the relationship and does to it.
var Socials = []Social{
	{Topic: "salut", Friendship: 2},
	{Topic: "libre", Friendship: 3, BadFriendship: -2},
	{Topic: "blague", Friendship: 4, BadFriendship: -2},
	{Topic: "compliment", Friendship: 4, Romance: 1, BadFriendship: -1},
	{Topic: "gbairai", Known: true, MinFriendship: 15, Friendship: 5},
	{Topic: "chambrer", Known: true, MinFriendship: 25, Friendship: 4, BadFriendship: -6},
	{Topic: "conseil", Known: true, MinFriendship: 20, Friendship: 4},
	{Topic: "confier", Known: true, MinFriendship: 40, Friendship: 8, BadFriendship: -2},
	{Topic: "calin", Known: true, MinFriendship: 40, Friendship: 5, Romance: 1},
	{Topic: "drague", Known: true, Adult: true, MinFriendship: 25, Romance: 12, BadRomance: -4, BadFriendship: -2},
	{Topic: "embrasser", Known: true, Adult: true, MinRomance: 60, Romance: 10, Friendship: 2, BadRomance: -5},
	{Topic: "sortir", Known: true, Adult: true, MinRomance: 40, Romance: 15, BadRomance: -6},
	{Topic: "disputer", Known: true, Friendship: -15, BadFriendship: -15, BadRomance: -5},
	{Topic: "excuser", Known: true, Friendship: 12, BadFriendship: 2},
}

// SocialOf: what the topic asks and does, false for a topic with no gauge.
func SocialOf(topic string) (Social, bool) {
	i := slices.IndexFunc(Socials, func(x Social) bool { return x.Topic == topic })
	if i < 0 {
		return Social{}, false
	}
	return Socials[i], true
}

// SocialWhy: why this can't be said to them now ("" if it can), from their gauges (known: met before).
func SocialWhy(x Social, known bool, r Rel, adults bool) string {
	switch {
	case x.Adult && !adults:
		return "Entre adultes seulement"
	case x.Known && !known:
		return "Vous ne vous connaissez pas encore : discute d'abord"
	case r.Enemy && x.Topic != "excuser" && x.Topic != "disputer" && x.Topic != "salut":
		return "Vous êtes fâché·e·s : excuse-toi d'abord"
	case r.Friendship < x.MinFriendship:
		if x.MinFriendship >= 40 {
			return "Il faut être ami·e·s"
		}
		return "Vous ne vous connaissez pas assez"
	case r.Romance < x.MinRomance:
		return "Pas encore assez d'attirance"
	}
	return ""
}

// Clamp100: a gauge kept within 0..100.
func Clamp100(v int) int { return max(0, min(100, v)) }

// Apply: the gauges after this went well or badly; whether they're enemies now (a quarrel that leaves the
// friendship low), or not any more (made up, the friendship back).
func (r Rel) Apply(x Social, good bool) Rel {
	f, ro := x.Friendship, x.Romance
	if !good {
		f, ro = x.BadFriendship, x.BadRomance
	}
	r.Friendship, r.Romance = Clamp100(r.Friendship+f), Clamp100(r.Romance+ro)
	if x.Topic == "disputer" && r.Friendship < 20 {
		r.Enemy = true
	}
	if r.Enemy && r.Friendship >= 30 {
		r.Enemy = false
	}
	return r
}
