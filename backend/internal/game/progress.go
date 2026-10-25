package game

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"
)

// Progress: what playing builds up. Every activity done brings experience
// (XP), and with it a level; the skills it trains go up too, and their levels
// unlock things: new actions, and more from what they train (more fun from a
// dance, less fatigue at the gym, better luck when talking to people, a house
// built faster). Some skills open only at a level of the player. Nothing here
// pays: skills change the needs, the chances and what can be done, never the
// money (money.go).

type Progress struct {
	XP int `json:"xp"`
	// Skills: each skill's experience, by its id.
	Skills map[string]int `json:"skills,omitempty"`
}

// Skill: something the Sim gets better at by doing it.
type Skill struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	// Hint: what trains it.
	Hint string `json:"hint"`
	// Unlock: the player's level it opens at (0: from the start); before that it doesn't train.
	Unlock int    `json:"unlock,omitempty"`
	Perks  []Perk `json:"perks"`
}

// Perk: what a skill's level brings.
type Perk struct {
	Level int    `json:"level"`
	Text  string `json:"text"`
}

// The skills' ids.
const (
	SkillDanse     = "danse"
	SkillCuisine   = "cuisine"
	SkillForme     = "forme"
	SkillCharisme  = "charisme"
	SkillSavoir    = "savoir"
	SkillMixage    = "mixage"
	SkillBatisseur = "batisseur"
)

const (
	// MaxLevel: the player's; MaxSkill: a skill's.
	MaxLevel = 50
	MaxSkill = 10
	// SkillBoost: what each level of a skill adds to the needs its activities fill (or takes off the fatigue, for Forme).
	SkillBoost = 0.03
	// CharmLuck: what each level of Charisme adds to the chances when talking to people.
	CharmLuck = 0.02
	// BuildFaster: what each level of Bâtisseur takes off a building site's time.
	BuildFaster = 0.08
)

var Skills = []Skill{
	{ID: SkillDanse, Label: "Danse", Icon: "music", Hint: "Danser au maquis, en boîte, aux soirées, au cours collectif",
		Perks: []Perk{{1, "+3 % de plaisir par niveau en dansant"}, {2, "Monter danser sur le podium"}, {4, "Défier la piste au coupé-décalé"}}},
	{ID: SkillCuisine, Label: "Cuisine", Icon: "cooking-pot", Hint: "Cuisiner chez toi, aider au village",
		Perks: []Perk{{1, "+3 % de satiété par niveau en cuisinant"}, {3, "Préparer un garba maison"}}},
	{ID: SkillForme, Label: "Forme", Icon: "dumbbell", Hint: "La salle de sport, les matchs, courir",
		Perks: []Perk{{1, "-3 % de fatigue par niveau en faisant du sport"}, {2, "Faire des pompes et des abdos chez toi"}}},
	{ID: SkillCharisme, Label: "Charisme", Icon: "sparkles", Hint: "Parler aux gens, le gbairai, sortir entre amis, recevoir",
		Perks: []Perk{{1, "+2 % de chances par niveau quand tu parles aux gens"}, {3, "Ambiancer le maquis"}}},
	{ID: SkillSavoir, Label: "Savoir", Icon: "book-open", Hint: "L'école, l'université, les devoirs, les musées",
		Perks: []Perk{{1, "+3 % de plaisir par niveau en apprenant"}, {3, "Animer un débat dans l'amphi"}}},
	{ID: SkillMixage, Label: "Mixage", Icon: "disc-3", Hint: "Les platines des soirées, le métier Ambiance", Unlock: 3,
		Perks: []Perk{{0, "Passer derrière les platines aux soirées"}, {1, "+3 % de plaisir par niveau aux platines"}, {3, "Mixer en guest à la boîte"}}},
	{ID: SkillBatisseur, Label: "Bâtisseur", Icon: "hammer", Hint: "Construire et meubler ta maison", Unlock: 5,
		Perks: []Perk{{1, "Tes chantiers vont 8 % plus vite par niveau"}}},
}

// SkillNeeded: why an action isn't open yet: the skill's level it takes, or the player's level the skill opens at.
func SkillNeeded(id string, level int, locked bool) error {
	s, _ := FindSkill(id)
	if locked {
		return fmt.Errorf("la compétence %s s'ouvre au niveau %d", s.Label, s.Unlock)
	}
	return fmt.Errorf("il faut %s niveau %d (%s)", s.Label, level, strings.ToLower(s.Hint[:1])+s.Hint[1:])
}

// ChantierMinutes: how long the masons take to raise a house of so many blocks from a plan (real
// minutes: a quarter of an hour for a small one, an hour at most), less with the owner's Bâtisseur level.
func ChantierMinutes(blocks, batisseur int) int {
	m := float64(min(60, max(15, 10+blocks/15)))
	return max(5, int(m*max(0.4, 1-BuildFaster*float64(max(0, batisseur)))+0.5))
}

// FindSkill: a skill by its id.
func FindSkill(id string) (Skill, bool) {
	for _, s := range Skills {
		if s.ID == id {
			return s, true
		}
	}
	return Skill{}, false
}

// LevelSize: the experience from one level to the next (100 to reach level 2, 40 more for each one after).
func LevelSize(level int) int { return 100 + 40*(level-1) }

// LevelOf: the level an amount of experience gives, the part of it done, and its size.
func LevelOf(xp int) (level, into, size int) {
	level, into = 1, max(0, xp)
	for level < MaxLevel && into >= LevelSize(level) {
		into -= LevelSize(level)
		level++
	}
	return level, into, LevelSize(level)
}

// SkillLevelOf: a skill's level for its experience (60, 180, 360, 600… for levels 1, 2, 3, 4…), the part done of the next and its size.
func SkillLevelOf(xp int) (level, into, size int) {
	for level < MaxSkill && xp >= 60*(level+1)*(level+2)/2 {
		level++
	}
	from := 60 * level * (level + 1) / 2
	return level, xp - from, 60 * (level + 1)
}

// Level: the player's level.
func (p Progress) Level() int {
	l, _, _ := LevelOf(p.XP)
	return l
}

// SkillLevel: a skill's level (0 while locked).
func (p Progress) SkillLevel(id string) int {
	l, _, _ := SkillLevelOf(p.Skills[id])
	return l
}

// Unlocked: whether a skill is open at the player's level.
func (p Progress) Unlocked(id string) bool {
	s, ok := FindSkill(id)
	return ok && p.Level() >= s.Unlock
}

// Levels: every skill's level, for the requirement checks.
func (p Progress) Levels() map[string]int {
	out := map[string]int{}
	for _, s := range Skills {
		if p.Unlocked(s.ID) {
			out[s.ID] = p.SkillLevel(s.ID)
		} else {
			out[s.ID] = -1
		}
	}
	return out
}

// ActivityXP: the experience an activity brings, from its length as the catalog writes it (an hour: 20), at most 60.
func ActivityXP(minutes int64) int { return int(min(60, max(2, minutes/3))) }

// danceIDs, …: which activities train which skill, by their id (and place kind, for the work at the club).
var (
	danceWords   = []string{"dance", "danse", "danser", "podium", "slow", "party", "cours-collectif"}
	cookWords    = []string{"cook", "cuisin", "attieke", "garba-maison"}
	sportWords   = []string{"play-football", "play-basket", "street-", "footing", "swim", "pompes", "manoeuvre", "musculation", "cardio", "tractions", "boxe", "corde"}
	charmWords   = []string{"gbairai", "drink-with-friends", "recevoir-soiree", "atalaku", "ambiancer", "bargain", "tournee", "travaillement", "anniversaire"}
	learnWords   = []string{"devoirs", "amphi", "partiel", "cours", "biblio", "conference", "visite-musee", "visite-guidee", "exposition", "debat", "aller-ecole"}
	mixWords     = []string{"mixer-soiree", "set-guest"}
	trainedKinds = map[string]string{"gym": SkillForme, "sport": SkillForme, "chat": SkillCharisme, "social": SkillCharisme, "school": SkillSavoir, "universite": SkillSavoir}
)

// Trains: the skills an activity trains (its id, its place kind, the career it's a shift of).
func Trains(id, kind, career string) []string {
	var out []string
	add := func(s string) {
		if !slices.Contains(out, s) {
			out = append(out, s)
		}
	}
	has := func(words []string) bool {
		return slices.ContainsFunc(words, func(w string) bool { return strings.Contains(id, w) })
	}
	if career == "ambiance" || has(mixWords) {
		add(SkillMixage)
	}
	if career != "" {
		return out
	}
	if has(danceWords) || kind == "club" && id != "bouteille-whisky" && id != "champagne-vip" {
		add(SkillDanse)
	}
	if has(cookWords) {
		add(SkillCuisine)
	}
	if has(sportWords) {
		add(SkillForme)
	}
	if has(charmWords) {
		add(SkillCharisme)
	}
	if has(learnWords) {
		add(SkillSavoir)
	}
	if s, ok := trainedKinds[kind]; ok {
		add(s)
	}
	return out
}

// Boost: what an activity does with the levels of the skills it trains: more of
// what it fills (a dance, more fun; a meal cooked, more hunger filled), less
// fatigue from sport.
func (p Progress) Boost(e Needs, skills []string) Needs {
	for _, id := range skills {
		l := p.SkillLevel(id)
		if l <= 0 || !p.Unlocked(id) {
			continue
		}
		k := 1 + SkillBoost*float64(l)
		up := func(v float64) float64 {
			if v > 0 {
				return v * k
			}
			return v
		}
		switch id {
		case SkillForme:
			if e.Energy < 0 {
				e.Energy *= max(0.5, 1-SkillBoost*float64(l))
			}
			e.Fun = up(e.Fun)
		case SkillCuisine:
			e.Hunger = up(e.Hunger)
		case SkillCharisme:
			e.Social = up(e.Social)
		default:
			e.Fun = up(e.Fun)
		}
	}
	return e
}

// Gain: the experience added (to the player, to each skill open), and what went up.
type Gain struct {
	XP        int
	LevelUp   int            // the new level, 0 if none
	Opened    []string       // skills opened by the new level
	SkillUps  []string       // « Danse niveau 2 : Monter danser sur le podium »
	SkillsXP  []string       // the skills trained
	Raised    map[string]int // the skills that went up a level, and to which
	BeforeLvl int
}

// Add: experience in, for the player and the skills given (only those open).
func (p *Progress) Add(xp int, skills []string) Gain {
	g := Gain{XP: xp, BeforeLvl: p.Level(), Raised: map[string]int{}}
	if xp <= 0 {
		return g
	}
	if p.Skills == nil {
		p.Skills = map[string]int{}
	}
	for _, id := range skills {
		if !p.Unlocked(id) {
			continue
		}
		before := p.SkillLevel(id)
		p.Skills[id] += xp
		g.SkillsXP = append(g.SkillsXP, id)
		if after := p.SkillLevel(id); after > before {
			g.Raised[id] = after
			s, _ := FindSkill(id)
			line := fmt.Sprintf("%s niveau %d", s.Label, after)
			for _, pk := range s.Perks {
				if pk.Level > before && pk.Level <= after && pk.Level > 1 {
					line += " : " + pk.Text
				}
			}
			g.SkillUps = append(g.SkillUps, line)
		}
	}
	p.XP += xp
	if after := p.Level(); after > g.BeforeLvl {
		g.LevelUp = after
		for _, s := range Skills {
			if s.Unlock > g.BeforeLvl && s.Unlock <= after {
				g.Opened = append(g.Opened, s.Label)
			}
		}
	}
	return g
}

// ProgressView: the progress as the game shows it (the level, its bar, each skill's).
type ProgressView struct {
	XP     int         `json:"xp"`
	Level  int         `json:"level"`
	Into   int         `json:"into"`
	Next   int         `json:"next"`
	Skills []SkillView `json:"skills"`
}

type SkillView struct {
	ID       string `json:"id"`
	Level    int    `json:"level"`
	Into     int    `json:"into"`
	Next     int    `json:"next"`
	Unlocked bool   `json:"unlocked"`
}

// View: the progress as sent to the game.
func (p Progress) View() ProgressView {
	l, into, next := LevelOf(p.XP)
	v := ProgressView{XP: p.XP, Level: l, Into: into, Next: next}
	for _, s := range Skills {
		sl, sin, snext := SkillLevelOf(p.Skills[s.ID])
		v.Skills = append(v.Skills, SkillView{ID: s.ID, Level: sl, Into: sin, Next: snext, Unlocked: l >= s.Unlock})
	}
	return v
}

// MarshalJSON: sent to the game as its view (levels and bars); kept in the database as it is (Stored).
func (p Progress) MarshalJSON() ([]byte, error) { return json.Marshal(p.View()) }

// StoredProgress: the progress as the database keeps it.
type StoredProgress struct {
	XP     int            `json:"xp"`
	Skills map[string]int `json:"skills,omitempty"`
}

// Stored: what the database keeps.
func (p Progress) Stored() StoredProgress { return StoredProgress(p) }
