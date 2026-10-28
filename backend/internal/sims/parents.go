package sims

import (
	"errors"
	"math/rand/v2"
	"slices"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Talking with papa and maman, at the family's home while the Sim is still a
// child (web world3d/HomeInside Parents): a hug, babbling for a baby, the day
// told, advice, help with homework, asking to go out, a little pocket money.
// Said where one is: no outing of its own, the exchange counts at once.

// ParentPrefix: who they are in a chat ("parent:papa", "parent:maman").
const ParentPrefix = "parent:"

var (
	errNoParents  = errors.New("tes parents ne sont pas là")
	errNotParents = errors.New("ça ne se dit pas à ses parents")
)

// The topics anyone may bring up with their parents too.
var parentAlso = []string{"salut", "langue", "libre", "blague", "histoire"}

// {name} is Papa or Maman; {enfant} what they call the Sim (mon fils, ma fille).
var parentTopics = []chatTopic{
	{id: "parent-calin", label: "Faire un câlin", icon: "heart", minutes: 3, ages: game.Everyone, effect: game.Needs{Social: 18, Fun: 4}, yes: []string{
		"{name} te serre fort : « Mon bébé à moi ! »",
		"{name} t'embrasse sur le front : « Dieu merci pour toi, {enfant}. »",
		"{name} rit et te soulève : « Tu grandis trop vite, toi ! »",
		"{name} : « Viens là ! Un câlin, ça soigne tout. »",
	}},
	{id: "parent-babiller", label: "Babiller", icon: "baby", minutes: 3, ages: game.Babies, effect: game.Needs{Social: 10, Fun: 8}, yes: []string{
		"{name} répond en riant : « Areu, areu ! Oui, oui, c'est bien dit ! »",
		"{name} : « Tu as dit papa ? Il a dit papa ! » Toute la maison applaudit.",
		"{name} imite tes gazouillis et te chatouille le ventre.",
		"{name} : « Ba-ba-ba… Tu vas parler bientôt, toi. Tu vas parler beaucoup même ! »",
	}},
	{id: "parent-journee", label: "Raconter sa journée", icon: "messages-square", minutes: 8, ages: game.Kids, effect: game.Needs{Social: 12, Fun: 4}, yes: []string{
		"{name} t'écoute jusqu'au bout : « C'est bien, {enfant}. Je suis fier{e} de toi. »",
		"{name} rigole : « Et le maître a dit ça devant toute la classe ? Ah, ces enfants-là ! »",
		"{name} : « Tu t'es bagarré ? Hum… Raconte-moi depuis le début. »",
		"{name} : « Demain sera encore mieux. Va te laver, on mange bientôt. »",
	}},
	{id: "parent-conseil", label: "Demander un conseil", icon: "lightbulb", minutes: 6, ages: game.Kids, effect: game.Needs{Social: 10, Fun: 2}, yes: []string{
		"{name} : « Écoute, {enfant} : le respect d'abord. Celui qui respecte les gens, les gens le respectent. »",
		"{name} : « L'école, c'est ta richesse. Le reste viendra après. »",
		"{name} : « Choisis bien tes amis. Dis-moi qui tu fréquentes, je te dirai qui tu es. »",
		"{name} : « Petit à petit, l'oiseau fait son nid. Ne te presse pas. »",
		"{name} : « Si quelqu'un te dérange, tu viens me voir. On est là pour toi. »",
	}},
	{id: "parent-devoirs", label: "Demander de l'aide pour les devoirs", icon: "notebook-pen", minutes: 15, ages: game.Kids, effect: game.Needs{Social: 8, Fun: -2}, yes: []string{
		"{name} s'assoit à côté de toi : « Bon, les fractions. Une moitié d'attiéké plus une moitié, ça fait quoi ? Voilà ! »",
		"{name} relit ta dictée : « Trois fautes seulement. On recommence les accords, et c'est bon. »",
		"{name} : « Montre… Ah, la règle de trois ! Moi-même je l'ai oubliée. Attends, on cherche ensemble. »",
	}},
	{id: "parent-sortir", label: "Demander à sortir", icon: "door-open", minutes: 3, ages: game.Kids, effect: game.Needs{Social: 2}, chance: 0.6, yes: []string{
		"{name} : « D'accord, mais tu rentres avant la nuit. Pas une minute de plus ! »",
		"{name} : « Va, mais reste dans le quartier. Et salue les voisins. »",
		"{name} : « Tes devoirs sont finis ? Bon, va jouer un peu. »",
	}, no: []string{
		"{name} : « Sortir ? Avec les devoirs qui t'attendent ? Assieds-toi là. »",
		"{name} : « Non. Il est déjà tard, et on ne sait pas qui traîne dehors. »",
		"{name} : « On verra demain. Aujourd'hui tu aides à la maison. »",
	}, yesEffect: game.Needs{Social: 4, Fun: 6}, noEffect: game.Needs{Fun: -4}},
	{id: "parent-poche", label: "Demander l'argent de poche", icon: "hand-coins", minutes: 3, ages: game.Kids, effect: game.Needs{Social: 2}, chance: 0.45, money: [2]int{200, 800}, yes: []string{
		"{name} fouille dans sa poche : « Tiens. Pas de bonbons tous les jours hein ! »",
		"{name} : « Voilà pour ta semaine. Mets de côté, c'est comme ça qu'on devient grand. »",
		"{name} sourit : « Parce que tu as bien travaillé à l'école. Prends. »",
	}, no: []string{
		"{name} : « L'argent ne pousse pas sur les arbres, {enfant}. La semaine prochaine. »",
		"{name} : « Encore ? Tu as fait quoi avec celui de la dernière fois ? »",
		"{name} : « La fin du mois est dure. Patiente un peu. »",
	}, noEffect: game.Needs{Fun: -2}},
}

// Their answers when the same thing comes back, and when it's enough for now.
var (
	parentAgain = []string{"{name} : « Tu m'as déjà demandé ça, {enfant}. »", "{name} sourit : « Encore ? Toi tu es têtu{e2} ! »"}
	parentBye   = []string{"{name} : « Bon, va jouer maintenant. On parlera encore ce soir. »", "{name} : « J'ai à faire, {enfant}. Après, d'accord ? »"}
)

// parentsHome: the Sim still lives with its parents (a child, at the family's home, there now).
func (s *Sim) parentsHome() bool {
	return s.BornAt != 0 && s.age() < game.AdultAge && s.Housing != game.OwnHouse && s.City == s.HomeCity && s.Commune == s.HomeCommune
}

func sayParent(lines []string, p Passerby, s *Sim, rng *rand.Rand) string {
	e, enfant, e2 := "", "mon fils", ""
	if p.Gender == "femme" {
		e = "e"
	}
	if s.Gender == "femme" {
		enfant, e2 = "ma fille", "e"
	}
	return strings.NewReplacer("{name}", p.Name, "{e}", e, "{enfant}", enfant, "{e2}", e2).Replace(lines[rng.IntN(len(lines))])
}

// chatParent: something said to papa or maman, answered at once (no outing of its own): the
// needs, a little pocket money now and then (within the day's limits), the conversation's
// course kept on the Sim's activity if it's busy, or nowhere (a few words in passing).
func (s *Sim) chatParent(p Passerby, topicID string, rng *rand.Rand, free *chatAnswer) (chatAnswer, error) {
	if !s.parentsHome() {
		return chatAnswer{}, errNoParents
	}
	if p.Name != "Papa" && p.Name != "Maman" {
		return chatAnswer{}, errors.New("personne à qui parler")
	}
	i := slices.IndexFunc(parentTopics, func(t chatTopic) bool { return t.id == topicID })
	var t chatTopic
	switch {
	case i >= 0:
		t = parentTopics[i]
	case slices.Contains(parentAlso, topicID):
		j := slices.IndexFunc(chatTopics, func(t chatTopic) bool { return t.id == topicID })
		t = chatTopics[j]
	default:
		return chatAnswer{}, errNotParents
	}
	if (t.id == "libre") != (free != nil) {
		return chatAnswer{}, errUnknownTopic
	}
	if err := (game.Interaction{Ages: t.ages}).AllowedFor(s.stage().ID); err != nil {
		return chatAnswer{}, err
	}
	// The conversation so far, kept on what the Sim is doing (or started with this).
	if s.Activity != nil && s.Activity.ChatWith == p.ID {
		said := s.Activity.Said
		if len(said) >= chatTurns {
			return chatAnswer{Text: sayParent(parentBye, p, s, rng), Mood: "bye"}, nil
		}
		if slices.Contains(said, t.id) && t.id != "salut" && t.id != "libre" && t.id != "parent-calin" && t.id != "parent-babiller" {
			s.Activity.Said = append(slices.Clone(said), t.id)
			return chatAnswer{Text: sayParent(parentAgain, p, s, rng), Mood: "bad"}, nil
		}
	}
	effect := t.effect
	var ans chatAnswer
	switch {
	case free != nil:
		ans = chatAnswer{Text: free.Text, Mood: strings.TrimPrefix(free.Mood, "neutral")}
		switch free.Mood {
		case "good":
			effect = t.yesEffect
		case "bad":
			effect = t.noEffect
		}
	case (t.chance == 0 || rng.Float64() < t.chance) && !(t.money[0] > 0 && s.left(game.FromLuck) < 100):
		ans = chatAnswer{Text: sayParent(t.yes, p, s, rng), Mood: "good"}
		if t.yesEffect != (game.Needs{}) {
			effect = t.yesEffect
		}
		if t.money[0] > 0 {
			ans.Money = min((t.money[0]+rng.IntN(t.money[1]-t.money[0]+1))/100*100, s.left(game.FromLuck)/100*100)
		}
	default:
		ans = chatAnswer{Text: sayParent(t.no, p, s, rng), Mood: "bad"}
		effect = t.noEffect
	}
	// Generic lines (a joke, a story) speak of a passer-by's {toi}: said by a parent, it's their child.
	if i < 0 && free == nil {
		ans.Text = strings.NewReplacer("mon frère", "mon enfant", "ma sœur", "mon enfant", "mon gars", "mon enfant", "ma go", "mon enfant").Replace(ans.Text)
	}
	s.Needs = s.Needs.Add(effect)
	if ans.Money > 0 {
		ans.Money = s.earn(game.FromLuck, ans.Money)
	}
	if s.Activity != nil {
		if s.Activity.ChatWith != p.ID {
			s.Activity.ChatWith, s.Activity.Said = p.ID, nil
		}
		s.Activity.Said = append(slices.Clone(s.Activity.Said), t.id)
	}
	return ans, nil
}
