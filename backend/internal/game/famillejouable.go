package game

// La famille jouable (the update « famille-jouable », sims/foyer.go; web game/household.ts): with le mode vie,
// each one of the house directed has a life of their own, not only the house's pieces. The child does its
// homework, plays ball in the yard, draws; the teenager revises for the bac, calls their friends, dances;
// the elder tells tales to the little ones, prays for the family, naps in the hammock; an adult of the house
// (the partner, papa, maman) cooks for everyone and cleans. Some are done with another of the house: helping
// with the homework, playing together, a hug, a word of advice. The children have their school average
// (Kid.Note, out of 20): the homework raises it, a child neglected (hungry, tired, bored) sees it fall;
// grown up, a good average is a mention at the bac, and renom for the family.

// FamilleJouableKey: the update.
const FamilleJouableKey = "famille-jouable"

// The roles of the house (sims/foyer.go memberRole).
const (
	RoleEnfant = "enfant"
	RoleAdo    = "ado"
	RoleAncien = "ancien"
	RoleAdulte = "adulte"
)

// MemberAct: what one of the house can do of their own.
type MemberAct struct {
	ID      string   `json:"id"`
	Label   string   `json:"label"`
	Icon    string   `json:"icon"`
	Minutes int      `json:"minutes"`
	Roles   []string `json:"roles"`
	// Effect: on the one doing it; Family: on each other one of the house; Sim: on the Sim.
	Effect Needs `json:"effect"`
	Family Needs `json:"-"`
	Sim    Needs `json:"-"`
	// Grade: points on the school average (a child or a teenager doing it).
	Grade float64 `json:"-"`
	// Clean: the house tidied (the Sim's « maison sale » gone).
	Clean bool `json:"-"`
	// Pair: done with another of the house (or the Sim: "self"), of these roles ("" any); Target on them, and
	// TargetGrade on their average.
	Pair        bool     `json:"pair,omitempty"`
	TargetRoles []string `json:"targetRoles,omitempty"`
	Target      Needs    `json:"-"`
	TargetGrade float64  `json:"-"`
	// Spot: where in the house it is done (a home spot's id), and how (a pose); web household.ts.
	Spot string `json:"spot"`
	Pose string `json:"pose"`
}

var (
	kids    = []string{RoleEnfant, RoleAdo}
	grownUp = []string{RoleAdulte, RoleAncien}
)

// MemberActs: all of them.
var MemberActs = []MemberAct{
	{ID: "devoirs", Label: "Faire ses devoirs", Icon: "pencil", Minutes: 45, Roles: kids, Effect: Needs{Fun: -8}, Grade: 0.5, Spot: "golvo", Pose: "write"},
	{ID: "jouer-cour", Label: "Jouer au ballon dans la cour", Icon: "volleyball", Minutes: 40, Roles: []string{RoleEnfant}, Effect: Needs{Fun: 45, Social: 10, Energy: -10, Hygiene: -10}, Spot: "jouer-cour", Pose: "kick"},
	{ID: "dessiner", Label: "Dessiner", Icon: "palette", Minutes: 30, Roles: []string{RoleEnfant}, Effect: Needs{Fun: 30}, Spot: "seat", Pose: "write"},
	{ID: "reviser", Label: "Réviser le bac", Icon: "book-open", Minutes: 60, Roles: []string{RoleAdo}, Effect: Needs{Fun: -12, Energy: -5}, Grade: 0.7, Spot: "golvo", Pose: "write"},
	{ID: "tel-amis", Label: "Causer avec ses amis au téléphone", Icon: "smartphone", Minutes: 30, Roles: []string{RoleAdo}, Effect: Needs{Social: 45, Fun: 15}, Spot: "seat", Pose: "call"},
	{ID: "danser", Label: "Danser sur du coupé-décalé", Icon: "music", Minutes: 20, Roles: []string{RoleAdo, RoleEnfant}, Effect: Needs{Fun: 40, Energy: -5}, Spot: "free", Pose: "dance"},
	{ID: "conter", Label: "Raconter un conte à la famille", Icon: "book-open", Minutes: 30, Roles: []string{RoleAncien}, Effect: Needs{Social: 30, Fun: 10}, Family: Needs{Fun: 15, Social: 15}, Sim: Needs{Fun: 10, Social: 10}, Spot: "seat", Pose: "talk"},
	{ID: "prier", Label: "Prier pour la famille", Icon: "sparkles", Minutes: 20, Roles: grownUp, Effect: Needs{Fun: 15}, Family: Needs{Fun: 5}, Spot: "seat", Pose: "pray"},
	{ID: "hamac", Label: "Faire la sieste dans le hamac", Icon: "bed", Minutes: 60, Roles: []string{RoleAncien}, Effect: Needs{Energy: 50}, Spot: "seat", Pose: "sit"},
	{ID: "cuisiner", Label: "Préparer le repas pour tous", Icon: "chef-hat", Minutes: 60, Roles: []string{RoleAdulte, RoleAncien, RoleAdo}, Effect: Needs{Hunger: 30, Energy: -8}, Family: Needs{Hunger: 40}, Sim: Needs{Hunger: 35}, Spot: "cook-attieke", Pose: "cook"},
	{ID: "menage", Label: "Faire le ménage", Icon: "sparkles", Minutes: 45, Roles: []string{RoleAdulte, RoleAdo}, Effect: Needs{Energy: -8, Hygiene: -5}, Sim: Needs{Fun: 5}, Clean: true, Spot: "free", Pose: "brush"},
	{ID: "aider-devoirs", Label: "Aider aux devoirs", Icon: "graduation-cap", Minutes: 40, Roles: []string{RoleAdulte, RoleAncien, RoleAdo}, Effect: Needs{Social: 15}, Pair: true, TargetRoles: kids, Target: Needs{Social: 15}, TargetGrade: 0.8, Spot: "golvo", Pose: "talk"},
	{ID: "jouer-ensemble", Label: "Jouer ensemble", Icon: "gamepad-2", Minutes: 30, Roles: []string{RoleEnfant, RoleAdo, RoleAdulte, RoleAncien}, Effect: Needs{Fun: 25, Social: 15}, Pair: true, TargetRoles: []string{RoleEnfant, RoleAdo}, Target: Needs{Fun: 30, Social: 15}, Spot: "free", Pose: "cheer"},
	{ID: "calin", Label: "Faire un câlin", Icon: "heart", Minutes: 5, Roles: []string{RoleEnfant, RoleAdo, RoleAdulte, RoleAncien}, Effect: Needs{Social: 25}, Pair: true, Target: Needs{Social: 25}, Spot: "free", Pose: "hug"},
	{ID: "conseil", Label: "Donner un conseil", Icon: "message-circle", Minutes: 15, Roles: grownUp, Effect: Needs{Social: 15}, Pair: true, TargetRoles: []string{RoleAdo}, Target: Needs{Social: 20}, TargetGrade: 0.3, Spot: "seat", Pose: "talk"},
}

// FindMemberAct: one by its id.
func FindMemberAct(id string) (MemberAct, bool) {
	for _, a := range MemberActs {
		if a.ID == id {
			return a, true
		}
	}
	return MemberAct{}, false
}

// For: whether one of this role does it.
func (a MemberAct) For(role string) bool { return roleIn(a.Roles, role) }

// With: whether it's done with one of this role.
func (a MemberAct) With(role string) bool {
	return len(a.TargetRoles) == 0 || roleIn(a.TargetRoles, role)
}

func roleIn(rs []string, r string) bool {
	for _, x := range rs {
		if x == r {
			return true
		}
	}
	return false
}

// The school average.
const (
	// NoteStart: a child's average before anything; NoteMax its top.
	NoteStart = 12.0
	NoteMax   = 20.0
	// NoteDayGain: what it can gain at most a game day (the homework done ten times isn't ten times better).
	NoteDayGain = 1.5
	// NoteNeglect: what it loses a game day the child is neglected (its needs on average under NeglectUnder).
	NoteNeglect  = 0.6
	NeglectUnder = 35.0
	// MentionAt: a mention at the bac from this average (Mention, etudes.go: « Assez bien »); MentionRenom:
	// the family's renom for it.
	MentionAt    = 12.0
	MentionRenom = 5
)
