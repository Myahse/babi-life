package sims

import (
	"errors"
	"math/rand/v2"
	"net/http"
	"slices"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Talking with the people in the street. A passer-by has a first name, and
// what you say to them gets an answer: a greeting, the gbairai (the news of
// the quarter), a try at flirting, a little loan, or their number (and a new
// friend). What they answer is drawn at random; the chat itself is a short
// activity, which can end with a surprise of its own.

type chatTopic struct {
	id, label, icon string
	minutes         int64
	ages            []string
	effect          game.Needs
	// How it can go: with this chance, the yes lines, the effect and the
	// money (a range, given or spent); otherwise the no lines and effect.
	// No chance (0): it always goes the first way.
	chance     float64
	yes, no    []string
	yesEffect  game.Needs
	noEffect   game.Needs
	money      [2]int
	yesMinutes int64
}

// The street, in Abidjan's words. {name} is the passer-by, {e} their
// feminine ending; {toi} what they call your Sim (mon frère, ma sœur), {go}
// the familiar one (mon gars, ma go).
var chatTopics = []chatTopic{
	// Saluer
	{id: "salut", label: "Saluer", icon: "hand", minutes: 3, ages: game.KidsUp, effect: game.Needs{Social: 6}, yes: []string{
		"« Bonne arrivée ! On est ensemble. »",
		"« Ça va un peu, on est là, on se cherche. »",
		"« Bonjour ! Fais doucement avec la chaleur là. »",
		"« Y a pas drap, on se connaît ! »",
		"« Ça dit quoi ? Toi tu es en forme aujourd'hui dèh ! »",
		"« C'est comment ? Ça va aller hein, {toi}. »",
		"« Y a fohi, on est là ! Et toi ? »",
		"« Ça dit quoi ? Tu es où depuis ? On t'a pas vu ! »",
		"« Eh {go} ! C'est toi ? Ça fait un bail ! »",
		"« On est ensemble, {toi}. Dieu est grand. »",
		"« Ça va, ça va. On gère petit à petit. »",
		"« Bonjour ! Ton vieux père va bien ? Dis-lui bonjour pour moi. »",
		"« Eh fiscalité ! C'est comment ? Ça va un peu ? »",
		"« On est là ou bien ? Rien ne va, mais tout va ! »",
	}},
	{id: "dioula", label: "Saluer en dioula", icon: "hand", minutes: 3, ages: game.KidsUp, effect: game.Needs{Social: 8, Fun: 4}, yes: []string{
		"« I ni sɔgɔma ! » — « Nba ! Hɛrɛ sira wa ? » — « Hɛrɛ dɔrɔn ! » {name} rigole : « Toi tu parles bien dèh ! »",
		"« I ni ce ! » — « Nse ! I ka kɛnɛ wa ? » — « Tɔɔrɔ si tɛ ! » Vous vous serrez la main en riant.",
		"« I ni wula ! » {name} répond « Nba ! » et te tape dans la main : « Tu es de la famille, toi ! »",
	}},
	// Causer
	{id: "famille", label: "Demander la famille", icon: "users", minutes: 8, ages: game.KidsUp, effect: game.Needs{Social: 12}, yes: []string{
		"« La famille va bien, grâce à Dieu. Le petit a commencé l'école, il veut déjà être président ! »",
		"« Ah, la famille… la vieille est un peu malade, mais ça va aller. On prie. »",
		"« Ma femme a accouché la semaine passée ! Un garçon. Tu vas venir au baptême hein. »",
		"« Mon grand frère est rentré du village avec des ignames, toute la cour a mangé. »",
		"« Tout le monde est là, on se bat. La petite a eu son CEPE ! »",
		"« La famille ? On est nombreux, chaque jour y a un problème, mais on est ensemble. »",
		"« Mon fils est parti chercher l'aventure en France. Il appelle le dimanche. »",
	}},
	{id: "gbairai", label: "Faire le gbairai", icon: "messages-square", minutes: 15, ages: game.KidsUp, effect: game.Needs{Social: 18, Fun: 8}, yes: []string{
		"« Tu as appris ? Le fils de la tantie d'en face a eu son BAC ! Tout le quartier a dansé. »",
		"« Le prix du gbaka a encore monté, c'est pas facile hein. »",
		"« Il paraît qu'il y a un nouveau maquis vers le carrefour, le poulet est doux là-bas. »",
		"« Mon cousin dit qu'on recrute au marché, faut aller voir. »",
		"« Hier le courant est parti trois fois, on a mangé dans le noir. »",
		"« La voisine a fait un baptême, y avait l'attiéké jusqu'à tard la nuit. »",
		"« Tu connais le boutiquier ? Il a mis sa boutique en crédit, tout le quartier lui doit ! »",
		"« Le vieux du coin s'est remarié, à son âge ! On a tous dit doucement… »",
		"« Les enfants du quartier ont monté un groupe de zouglou. Ils répètent toute la nuit. »",
		"« Y a un gars qui fait des broutages là-bas, il a acheté une voiture. Ça va finir mal. »",
	}},
	{id: "foot", label: "Parler foot", icon: "trophy", minutes: 12, ages: game.KidsUp, effect: game.Needs{Social: 10, Fun: 10}, chance: 0.75, yes: []string{
		"« Les Éléphants vont gagner samedi, je te dis ! On a les meilleurs joueurs. »",
		"« La CAN chez nous, c'était trop fort ! Tout Abidjan était dehors. »",
		"« Asec Mimosas, c'est l'équipe du peuple. Le reste, c'est du bruit. »",
		"« Tu as vu le match d'hier ? Le gardien a sauvé trois buts, c'est un mur ! »",
		"« Le petit du quartier joue en centre de formation. Dans cinq ans il est en Europe ! »",
	}, no: []string{
		"« Quoi ? L'Africa ? Laisse ça ! » Vous vous disputez dix minutes devant tout le monde.",
		"« Toi tu ne connais rien au foot, va jouer aux billes ! »",
	}, noEffect: game.Needs{Social: 4, Fun: -3}},
	{id: "blague", label: "Lancer une blague", icon: "laugh", minutes: 6, ages: game.KidsUp, effect: game.Needs{Social: 6, Fun: 15}, chance: 0.75, yes: []string{
		"{name} explose de rire : « Ah toi, tu vas me tuer ! Faut faire comédien ! »",
		"{name} tape dans tes mains : « Weeh ! Celle-là je vais la raconter au grin ! »",
		"{name} rit tellement que les gens se retournent : « Arrête, arrête ! »",
		"{name} : « Hihi ! Toi tu es un vrai gaou… mais elle est bonne ! »",
	}, no: []string{
		"{name} te regarde sans rire : « C'est fini ? Bon. »",
		"{name} : « Celle-là, mon grand-père la racontait déjà ! »",
	}, noEffect: game.Needs{Fun: -4}},
	{id: "route", label: "Demander le chemin", icon: "map-pin", minutes: 4, ages: game.KidsUp, effect: game.Needs{Social: 4}, yes: []string{
		"« Tu descends tout droit, au carrefour là où y a la vendeuse d'alloco, tu prends à gauche. Tu peux pas rater. »",
		"« C'est pas loin ! Tu prends woro-woro, tu dis au chauffeur de te déposer au feu. »",
		"« Ah, c'est derrière la pharmacie. Si tu vois le maquis tu as dépassé. »",
		"« Moi-même je suis pas d'ici, mais demande à la tantie là-bas, elle connaît tout le monde. »",
	}},
	// Demander
	{id: "tombe", label: "« Tombe sur moi ! »", icon: "utensils", minutes: 10, ages: game.KidsUp, effect: game.Needs{Social: 2}, chance: 0.3, yes: []string{
		"{name} rigole : « Bon, viens, je te paie un garba. Mais demain c'est toi ! »",
		"{name} : « Pour toi seulement ! » Et voilà une sucrerie bien fraîche.",
		"{name} te paie un alloco : « Mange, tu as faim, ça se voit. »",
	}, no: []string{
		"{name} : « Tombe sur toi-même ! Moi aussi je suis fauché. »",
		"{name} : « Eh ! Toi tu tombes sur tout le monde. Ça va pas commencer avec moi ! »",
		"{name} retourne ses poches vides : « Regarde, c'est la fin du mois. »",
	}, yesEffect: game.Needs{Hunger: 20, Fun: 8, Social: 8}, noEffect: game.Needs{Fun: -2}},
	{id: "djai", label: "Demander un petit djai", icon: "hand-coins", minutes: 5, ages: game.TeensUp, effect: game.Needs{}, chance: 0.35, yes: []string{
		"{name} : « Prends ça pour ton transport, c'est pas grand-chose. »",
		"{name} : « Voilà, mais tu me rends samedi dèh ! »",
	}, no: []string{
		"{name} : « Moi-même je cherche, on est ensemble ! »",
		"{name} : « Fin du mois est loin, pardon. »",
	}, yesEffect: game.Needs{Social: 4}, noEffect: game.Needs{Social: -2}, money: [2]int{500, 2000}},
	{id: "boulot", label: "Demander un petit boulot", icon: "briefcase", minutes: 5, ages: game.TeensUp, effect: game.Needs{}, chance: 0.3, yes: []string{
		"{name} : « Viens m'aider à décharger les sacs, je te donne quelque chose. » Une heure plus tard, tu as gagné ta part.",
		"{name} : « Ma boutique a besoin d'un coup de peinture. Tu fais ça, je te paie. »",
		"{name} : « Va livrer ce colis à Siporex pour moi. Voilà pour toi. »",
	}, no: []string{
		"{name} : « Y a rien, {toi}. C'est la crise partout. »",
		"{name} : « Repasse la semaine prochaine, on va voir. »",
	}, yesEffect: game.Needs{Energy: -20, Fun: 5}, money: [2]int{1000, 3500}, yesMinutes: 60},
	{id: "conseil", label: "Demander conseil", icon: "lightbulb", minutes: 10, ages: game.KidsUp, effect: game.Needs{Social: 8, Fun: 4}, yes: []string{
		"« Doucement on va loin. Celui qui court trop tombe. »",
		"« L'argent c'est bien, mais la famille d'abord. Un jour tu vas comprendre. »",
		"« Petit à petit l'oiseau fait son nid. Faut pas regarder la vie des autres. »",
		"« Quand tu as un peu, aide un peu. Dieu voit tout. »",
		"« Faut toujours saluer les vieux du quartier. C'est eux qui te protègent sans que tu saches. »",
		"« Ne laisse personne te dire que tu ne peux pas. Mais travaille d'abord ! »",
	}},
	// Proposer
	{id: "grin", label: "Proposer le thé au grin", icon: "coffee", minutes: 30, ages: game.TeensUp, effect: game.Needs{Social: 3}, chance: 0.65, yes: []string{
		"{name} s'assoit : « Le premier thé est amer comme la vie, le deuxième doux comme l'amour… » Vous refaites le monde.",
		"{name} : « On va causer ! » Trois verres plus tard, vous connaissez tout le quartier.",
	}, no: []string{
		"{name} : « Je suis pressé{e}, je dois aller au boulot. Une autre fois ! »",
	}, yesEffect: game.Needs{Social: 22, Fun: 12}},
	{id: "maquis", label: "Inviter au maquis", icon: "beer", minutes: 5, ages: game.Adults, effect: game.Needs{}, chance: 0.5, yes: []string{
		"{name} : « On va s'enjailler ! » Vous partagez un poulet braisé et deux sucreries.",
		"{name} : « Toi tu es un vrai, tu sais vivre ! » Le maquis était chaud.",
	}, no: []string{
		"{name} : « Ce soir non, y a match. Garde ton argent ! »",
		"{name} : « Ma femme va me tuer. Une autre fois ! »",
	}, yesEffect: game.Needs{Social: 25, Fun: 25, Hunger: 25}, money: [2]int{-3000, -2000}, yesMinutes: 75},
	{id: "numero", label: "Échanger les numéros", icon: "smartphone", minutes: 5, ages: game.TeensUp, effect: game.Needs{Social: 10}},
	// Taquiner
	{id: "chambrer", label: "Chambrer", icon: "smile", minutes: 5, ages: game.KidsUp, effect: game.Needs{}, chance: 0.6, yes: []string{
		"{name} : « Toi aussi, regarde ta tête d'abord ! » Vous rigolez tous les deux.",
		"{name} : « C'est ta chemise là que tu as mise depuis lundi ? » Touché.",
		"{name} se défend en riant : « Faut pas me fatiguer, je suis pas ton camarade ! »",
	}, no: []string{
		"{name} n'a pas aimé : « Tu me prends pour qui ? Va chambrer ta sœur ! »",
		"{name} : « Faut respecter les gens dèh. » Et s'en va.",
	}, yesEffect: game.Needs{Fun: 14, Social: 8}, noEffect: game.Needs{Social: -6, Fun: -3}},
	{id: "drague", label: "Draguer", icon: "heart", minutes: 10, ages: game.Adults, effect: game.Needs{}, chance: 0.4, yes: []string{
		"{name} rigole : « Toi tu es malin{e} hein ! Bon, on peut se voir au maquis. »",
		"{name} sourit : « Ok, ok… tu as gagné. On s'appelle. »",
		"{name} : « Tu parles bien… Je vais réfléchir. Donne ton numéro. »",
	}, no: []string{
		"{name} rigole : « Toi-même tu sais que c'est pas possible ! »",
		"{name} : « Faut aller travailler d'abord, après on va causer. »",
		"{name} t'a laissé{e} parler seul{e}. Ça arrive.",
		"{name} : « Mon chéri est jaloux, il est juste derrière toi. »",
	}, yesEffect: game.Needs{Social: 20, Fun: 15}, noEffect: game.Needs{Social: 2, Fun: -5}},
}

var (
	numYes = []string{"{name} te donne son numéro : « Bip-moi, on va se voir. »", "{name} : « Note ça. Appelle-moi quand tu passes dans le quartier. »"}
	numNo  = []string{"{name} : « Mon téléphone est gâté, on va se croiser encore. »", "{name} : « Je donne pas mon numéro au premier venu, faut d'abord qu'on se connaisse. »"}
)

// Surprises at the end of a chat in the street.
var chatSurprises = []game.RandomEvent{
	{Text: "En causant, on te présente quelqu'un qui cherche un coup de main : 1 500 F pour l'après-midi.", Money: 1500, Effect: game.Needs{Energy: -10}},
	{Text: "On t'a offert un sachet d'eau glacée. Ça fait du bien !", Effect: game.Needs{Hunger: 5, Fun: 5}},
	{Text: "Pendant que vous causiez, un pickpocket t'a soulagé·e de 500 F.", Money: -500},
	{Text: "On t'invite au baptême de samedi : « Faut venir, y aura à manger ! »", Effect: game.Needs{Social: 10, Fun: 10}},
	{Text: "Un vieux du quartier passe et te donne des conseils de la vie. Tu repars motivé·e.", Effect: game.Needs{Fun: 8}},
	{Text: "Une moto passe dans une flaque : vous voilà tous les deux trempés. Fou rire.", Effect: game.Needs{Hygiene: -10, Fun: 8}},
	{Text: "Une vendeuse passe avec son plateau : « Les beignets sont chauds ! » On partage.", Money: -200, Effect: game.Needs{Hunger: 10}},
}

var errUnknownTopic = errors.New("on ne parle pas de ça")

type Passerby struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Gender string `json:"gender"`
	Seed   int    `json:"seed"`
}

func say(lines []string, p Passerby, sim *Sim, rng *rand.Rand) string {
	l := lines[rng.IntN(len(lines))]
	e := ""
	if p.Gender == "femme" {
		e = "e"
	}
	toi, gars := "mon frère", "mon gars"
	if sim.Gender == "femme" {
		toi, gars = "ma sœur", "ma go"
	}
	return strings.NewReplacer("{name}", p.Name, "{e}", e, "{toi}", toi, "{go}", gars).Replace(l)
}

// chat starts a talk with a passer-by and returns what they answer, and
// money given (or spent). `said` is the greeting the player picked, if any.
func (s *Sim) chat(p Passerby, topicID, said string, rng *rand.Rand) (string, int, error) {
	i := slices.IndexFunc(chatTopics, func(t chatTopic) bool { return t.id == topicID })
	if i < 0 {
		return "", 0, errUnknownTopic
	}
	if p.Name == "" || len(p.Name) > 30 || len(p.ID) > 60 || len(said) > 60 {
		return "", 0, errors.New("personne à qui parler")
	}
	t := chatTopics[i]
	label := t.label + " avec " + p.Name
	if said != "" {
		label = "« " + said + " » à " + p.Name
	}
	it := game.Interaction{ID: "chat-" + t.id, Label: label, Icon: t.icon, Minutes: t.minutes, Effect: t.effect, Ages: t.ages}
	if err := it.AllowedFor(s.stage().ID); err != nil {
		return "", 0, err
	}
	var reply string
	money := 0
	switch {
	case t.id == "numero":
		if s.findFriend("p-"+p.ID) == nil && len(s.Friends) < game.MaxFriends && rng.Float64() < 0.6 {
			reply = say(numYes, p, s, rng)
			s.Friends = append(s.Friends, game.Friend{ID: "p-" + p.ID, Name: p.Name, Gender: p.Gender, Seed: p.Seed, Commune: s.Commune, Friendship: 25, Met: s.GameMinutes, Seen: s.GameMinutes})
		} else {
			reply = say(numNo, p, s, rng)
		}
	case t.chance == 0 || rng.Float64() < t.chance:
		reply = say(t.yes, p, s, rng)
		if t.yesEffect != (game.Needs{}) {
			it.Effect = t.yesEffect
		}
		if t.yesMinutes > 0 {
			it.Minutes = t.yesMinutes
		}
		if t.money != [2]int{} {
			// Rounded to 100 F, like any note or coin in the street.
			money = (t.money[0] + rng.IntN(t.money[1]-t.money[0]+1)) / 100 * 100
			if money < 0 && s.Money+money < 0 {
				// Inviting someone you can't pay for: they pay, laughing.
				money = 0
				reply += " (C'est {name} qui a payé, tu étais à sec.)"
				reply = say([]string{reply}, p, s, rng)
			}
		}
	default:
		reply = say(t.no, p, s, rng)
		it.Effect = t.noEffect
	}
	if err := s.start(it, "", "chat", p.Name, chatSurprises, ""); err != nil {
		return "", 0, err
	}
	s.Money += money
	return reply, money, nil
}

func (h *Handler) chatHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		With  Passerby `json:"with"`
		Topic string   `json:"topic"`
		Said  string   `json:"said"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		reply, money, err := s.chat(req.With, req.Topic, req.Said, newRand())
		if err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: reply, Money: money}, nil, nil
	})
}
