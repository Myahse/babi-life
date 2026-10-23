package sims

import (
	"context"
	"encoding/json"
	"errors"
	"math/rand/v2"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/myahse/babi-life/backend/internal/auth"
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
	// A greeting in one of the player's languages (game/languages.go): what they say comes from the phone, the answer from the passer-by's languages.
	{id: "langue", label: "Saluer dans sa langue", icon: "hand", minutes: 3, ages: game.KidsUp, effect: game.Needs{Social: 3}},
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
	{id: "compliment", label: "Faire un compliment", icon: "sparkles", minutes: 3, ages: game.KidsUp, effect: game.Needs{}, chance: 0.85, yes: []string{
		"{name} sourit jusqu'aux oreilles : « Ah toi, tu sais parler aux gens ! Merci dèh. »",
		"{name} se redresse : « C'est vrai ? C'est ma tantie qui a cousu ça. Je vais lui dire ! »",
		"{name} : « Merci {toi} ! Toi aussi tu es frais{e} aujourd'hui, on va pas mentir. »",
		"{name} rigole, gêné{e} : « Arrête, tu vas me faire gonfler la tête ! »",
		"{name} : « Ça fait plaisir, la journée était dure. Que Dieu te bénisse ! »",
	}, no: []string{
		"{name} plisse les yeux : « Hum… tu veux quoi exactement ? Parle franc ! »",
		"{name} : « Les compliments là, c'est pour demander l'argent après. Je te connais ! »",
	}, yesEffect: game.Needs{Social: 10, Fun: 4}, noEffect: game.Needs{Social: 1}},
	{id: "histoire", label: "Demander une histoire", icon: "book-open", minutes: 10, ages: game.KidsUp, effect: game.Needs{Social: 8, Fun: 12}, yes: []string{
		"« Un jour, Kacou Ananzè l'araignée a voulu garder toute la sagesse du monde dans une calebasse… Mais il l'a fait tomber. C'est pour ça que tout le monde en a un peu ! »",
		"« Mon grand-père disait qu'au bord de la lagune, la nuit, Mami Wata peigne ses cheveux. Si tu la vois, faut pas parler ! »",
		"« Tu connais l'histoire de la reine Abla Pokou ? Elle a traversé le fleuve sur le dos des hippopotames… C'est comme ça que les Baoulé sont arrivés. »",
		"« Une fois, un gbaka est parti d'Adjamé sans chauffeur. Je te jure ! Le frein à main. Il s'est arrêté dans le garba d'une tantie. »",
		"« Le lièvre a parié avec l'éléphant qu'il était plus fort. Il a attaché une corde… et l'hippopotame tirait de l'autre côté ! Malin, le lièvre. »",
		"« Quand j'étais petit{e}, on allait voler les mangues du vieux Koné. Un jour il nous attendait en haut de l'arbre ! »",
	}},
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
	{id: "aide", label: "Proposer un coup de main", icon: "hand-helping", minutes: 15, ages: game.KidsUp, effect: game.Needs{}, chance: 0.6, yes: []string{
		"Tu portes les sacs de {name} jusqu'au gbaka. « Toi tu es un{e} vrai{e} ! Prends ça pour ton sucré. »",
		"Vous poussez ensemble la moto de {name} qui ne démarre plus. Elle repart enfin ! « Merci {toi} ! »",
		"Tu aides {name} à monter son étal au marché. « Que Dieu te le rende ! » Et un petit billet en plus.",
	}, no: []string{
		"{name} : « Merci, merci, ça va aller. Garde ta force ! »",
		"{name} serre son sac : « Non non, je me débrouille. » On sait jamais, à Abidjan.",
	}, yesEffect: game.Needs{Social: 14, Energy: -8, Fun: 4}, noEffect: game.Needs{Social: 3}, money: [2]int{200, 1000}},
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
	{id: "defi", label: "Pierre-feuille-ciseaux", icon: "scissors", minutes: 4, ages: game.KidsUp, effect: game.Needs{}, chance: 0.5, yes: []string{
		"Tu fais pierre, {name} fait ciseaux. « Encore ! » Pierre contre ciseaux encore. Tu as gagné, {name} tape dans tes mains.",
		"Feuille contre pierre : gagné ! {name} : « Toi tu triches, je t'ai vu ! »",
		"Ciseaux contre feuille. {name} : « Deux sur trois ! » … Et tu gagnes encore. Respect.",
	}, no: []string{
		"Tu fais pierre, {name} fait feuille. « Ha ha ! Va t'entraîner d'abord ! »",
		"Ciseaux contre pierre : perdu. {name} fait le tour du carrefour en dansant.",
		"Trois fois feuille contre ciseaux. {name} : « On va dire quoi ? Je suis trop fort{e} ! »",
	}, yesEffect: game.Needs{Fun: 12, Social: 6}, noEffect: game.Needs{Fun: 6, Social: 6}},
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
	// Romance, between adults only (the Sim, the person met as an adult, and the
	// player who said they're 18 or over): asked of a friend whose number you
	// have. The answers are decided in chat (romance), not drawn here.
	{id: "sortir", label: "Lui demander de sortir ensemble", icon: "heart", minutes: 10, ages: game.Adults, effect: game.Needs{Social: 4}},
	{id: "emmenager", label: "Lui proposer de venir vivre chez toi", icon: "house-heart", minutes: 15, ages: game.Adults, effect: game.Needs{Social: 4}},
	{id: "rompre", label: "Rompre", icon: "heart-crack", minutes: 10, ages: game.Adults, effect: game.Needs{Social: -10, Fun: -10}},
}

var (
	numYes = []string{"{name} te donne son numéro : « Bip-moi, on va se voir. »", "{name} : « Note ça. Appelle-moi quand tu passes dans le quartier. »"}
	numNo  = []string{"{name} : « Mon téléphone est gâté, on va se croiser encore. »", "{name} : « Je donne pas mon numéro au premier venu, faut d'abord qu'on se connaisse. »"}
)

// Surprises at the end of a chat in the street.
var chatSurprises = []game.RandomEvent{
	{Text: "En causant, on te présente quelqu'un qui cherche un coup de main : 1 500 Djai pour l'après-midi.", Money: 1500, Effect: game.Needs{Energy: -10}},
	{Text: "On t'a offert un sachet d'eau glacée. Ça fait du bien !", Effect: game.Needs{Hunger: 5, Fun: 5}},
	{Text: "Pendant que vous causiez, un pickpocket t'a soulagé·e de 500 Djai.", Money: -500},
	{Text: "On t'invite au baptême de samedi : « Faut venir, y aura à manger ! »", Effect: game.Needs{Social: 10, Fun: 10}},
	{Text: "Un vieux du quartier passe et te donne des conseils de la vie. Tu repars motivé·e.", Effect: game.Needs{Fun: 8}},
	{Text: "Une moto passe dans une flaque : vous voilà tous les deux trempés. Fou rire.", Effect: game.Needs{Hygiene: -10, Fun: 8}},
	{Text: "Une vendeuse passe avec son plateau : « Les beignets sont chauds ! » On partage.", Money: -200, Effect: game.Needs{Hunger: 10}},
}

var errUnknownTopic = errors.New("on ne parle pas de ça")

var (
	errNotAdult      = errors.New("réservé aux joueurs de 18 ans et plus")
	errNotAcquainted = errors.New("faites d'abord connaissance : échangez vos numéros")
	errNotTogether   = errors.New("vous n'êtes pas ensemble")

	sortirYes = []string{
		"{name} sourit, gêné{e} : « Je croyais que tu allais jamais demander… Oui ! On est ensemble. »",
		"{name} rigole et te prend la main : « Toi tu es têtu{e} hein. Bon… c'est oui. »",
		"{name} : « Depuis le temps ! Oui, on se met ensemble. Mais faut pas me fatiguer dèh ! »",
	}
	sortirNo = []string{
		"{name} : « Tu es gentil{e}, mais on est mieux en amis, non ? »",
		"{name} : « Doucement ! On se connaît à peine. Faut qu'on se voie encore. »",
		"{name} sourit : « Pas maintenant… On va voir. »",
	}
	sortirTaken  = []string{"{name} croise les bras : « Et ta chérie là ? Tu me prends pour qui ? »"}
	sortirAgain  = []string{"{name} rigole : « Mais on est déjà ensemble, mon cœur ! »"}
	emmenagerYes = []string{
		"{name} saute de joie : « Chez toi ? Pour de vrai ? Je fais mes bagages ce soir ! »",
		"{name} : « On va vivre ensemble… Oui ! Mais c'est moi qui choisis les rideaux. »",
	}
	emmenagerNo = []string{
		"{name} : « C'est trop tôt pour vivre ensemble. Laisse-moi un peu de temps. »",
		"{name} : « Ma mère va dire quoi ? Attendons encore un peu. »",
	}
	emmenagerAgain = []string{"{name} : « Je vis déjà chez toi, tu as oublié ou bien ? »"}
	emmenagerTaken = []string{"{name} : « Chez toi ? Et la personne qui dort déjà là-bas, on la met où ? »"}
	// flirtHeard: the partner hears the Sim was flirting.
	flirtHeard  = []string{"Quelqu'un est allé raconter à {name} que tu draguais. {Pronoun} te fait la tête.", "{name} a su que tu draguais encore. Ça va chauffer à la maison."}
	rompreLines = []string{
		"{name} baisse les yeux : « Ok… Si c'est comme ça. Prends soin de toi. »",
		"{name} se fâche : « Après tout ce que j'ai fait pour toi ? Va-t'en ! »",
		"{name} soupire : « Je l'ai vu venir. Bonne chance, {toi}. »",
	}
)

// partner: the Sim's boyfriend or girlfriend, if any.
func (s *Sim) partner() *game.Friend {
	for i := range s.Friends {
		if s.Friends[i].Partner {
			return &s.Friends[i]
		}
	}
	return nil
}

// romance answers the three adult topics; ok false when topic isn't one of them.
func (s *Sim) romance(t chatTopic, friend *game.Friend, adult bool, said int, rng *rand.Rand, p Passerby, it *game.Interaction) (ans chatAnswer, ok bool, err error) {
	if t.id != "sortir" && t.id != "emmenager" && t.id != "rompre" {
		return chatAnswer{}, false, nil
	}
	if !adult {
		return chatAnswer{}, true, errNotAdult
	}
	if friend == nil || !friend.Adult {
		return chatAnswer{}, true, errNotAcquainted
	}
	switch t.id {
	case "sortir":
		if friend.Partner {
			return chatAnswer{Text: say(sortirAgain, p, s, rng), Mood: "good"}, true, nil
		}
		// Already with someone: half the time they know (the quarter talks), else they may say yes, and it's cheating (cheating.go).
		if s.partner() != nil && rng.Float64() < 0.5 {
			friend.Friendship = max(0, friend.Friendship-5)
			return chatAnswer{Text: say(sortirTaken, p, s, rng), Mood: "bad"}, true, nil
		}
		// The closer you are, the likelier; a good chat first helps a little.
		chance := min(0.9, max(0.05, float64(friend.Friendship-35)/60+0.02*float64(said)))
		if rng.Float64() < chance {
			friend.Partner = true
			friend.Friendship = min(100, friend.Friendship+10)
			it.Effect = game.Needs{Social: 25, Fun: 20}
			ans := chatAnswer{Text: say(sortirYes, p, s, rng), Mood: "good"}
			if news := s.caught(friend, caughtNew, rng); news != "" {
				ans.Text += " " + news
			}
			return ans, true, nil
		}
		return chatAnswer{Text: say(sortirNo, p, s, rng), Mood: "bad"}, true, nil
	case "emmenager":
		if !friend.Partner {
			return chatAnswer{}, true, errNotTogether
		}
		if friend.Home {
			return chatAnswer{Text: say(emmenagerAgain, p, s, rng), Mood: "good"}, true, nil
		}
		// Someone else already lives there.
		for _, o := range s.partners() {
			if o.Home && o.ID != friend.ID {
				return chatAnswer{Text: say(emmenagerTaken, p, s, rng), Mood: "bad"}, true, nil
			}
		}
		chance := 0.2
		if friend.Friendship >= 70 {
			chance = 0.85
		}
		if rng.Float64() < chance {
			friend.Home = true
			friend.Friendship = min(100, friend.Friendship+8)
			it.Effect = game.Needs{Social: 30, Fun: 20}
			return chatAnswer{Text: say(emmenagerYes, p, s, rng), Mood: "good"}, true, nil
		}
		return chatAnswer{Text: say(emmenagerNo, p, s, rng), Mood: "bad"}, true, nil
	default: // rompre
		if !friend.Partner {
			return chatAnswer{}, true, errNotTogether
		}
		friend.Partner, friend.Home = false, false
		friend.Friendship = max(0, friend.Friendship-35)
		return chatAnswer{Text: say(rompreLines, p, s, rng), Mood: "bad"}, true, nil
	}
}

type Passerby struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Gender string `json:"gender"`
	Seed   int    `json:"seed"`
	// Look: their face and clothes as the phone drew them, kept with them once
	// they're a friend, so they look the same at the Sim's side and at home.
	Look json.RawMessage `json:"look,omitempty"`
}

// maxLook: a look is a dozen short fields; anything bigger isn't one.
const maxLook = 1024

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

// What they say when the same thing comes up twice, and when they have to go.
var (
	chatAgain = []string{"{name} : « Tu l'as déjà dit ça ! Tu dors ou bien ? »", "{name} rigole : « Encore ? Change de disque un peu ! »", "{name} : « On a déjà parlé de ça, {toi}. »"}
	chatBye   = []string{"{name} regarde l'heure : « Eh, on a trop causé ! Je dois y aller. On se voit ! »", "{name} : « Bon, je te laisse, le travail m'attend. À plus ! »", "{name} : « La nuit va tomber, je rentre. Bonne soirée {toi} ! »"}
)

const (
	// chatTurns: how many things can be said in one conversation before they have to go.
	chatTurns = 8
	// A friend listens better.
	friendBonus = 0.15
)

type chatAnswer struct {
	Text  string
	Money int
	// "good" or "bad" (how they took it), "bye" (they're off).
	Mood string
}

// chat says something to a passer-by and returns what they answer, money
// given (or spent), and how they took it. `said` is the greeting the player
// picked, if any. Talking on with the same person carries on the same
// conversation (what's been said is remembered: twice the same thing, and
// they notice; after a while, they have to go).
func (s *Sim) chat(p Passerby, topicID, said string, adult bool, rng *rand.Rand) (chatAnswer, error) {
	return s.chatIn(p, topicID, said, "", adult, rng)
}

// chatIn is chat, with the language a greeting is said in (topic « langue »).
func (s *Sim) chatIn(p Passerby, topicID, said, lang string, adult bool, rng *rand.Rand) (chatAnswer, error) {
	i := slices.IndexFunc(chatTopics, func(t chatTopic) bool { return t.id == topicID })
	if i < 0 {
		return chatAnswer{}, errUnknownTopic
	}
	// (What the Sim says can be a whole joke, a few lines.)
	if p.Name == "" || len(p.Name) > 30 || len(p.ID) > 60 || len(said) > 400 {
		return chatAnswer{}, errors.New("personne à qui parler")
	}
	if len(p.Look) > maxLook || (len(p.Look) > 0 && !json.Valid(p.Look)) {
		p.Look = nil
	}
	t := chatTopics[i]
	label := t.label + " avec " + p.Name
	// A greeting, a question: the activity is what was said; a joke is told, not quoted whole there.
	if said != "" && utf8.RuneCountInString(said) <= 60 {
		label = "« " + said + " » à " + p.Name
	}
	it := game.Interaction{ID: "chat-" + t.id, Label: label, Icon: t.icon, Minutes: t.minutes, Effect: t.effect, Ages: t.ages}
	if err := it.AllowedFor(s.stage().ID); err != nil {
		return chatAnswer{}, err
	}
	// Already talking with them: the same conversation goes on.
	var before []string
	// Busy at something else (dancing at the maquis, eating, at the club):
	// one talks with the people around all the same. An aside: what's done
	// goes on, the exchange counts at once (needs, money, friendship).
	aside := false
	if a := s.Activity; a != nil && a.Kind == "do" && a.PlaceKind != "chat" {
		aside = true
		if a.ChatWith == p.ID {
			if len(a.Said) >= chatTurns {
				return chatAnswer{Text: say(chatBye, p, s, rng), Mood: "bye"}, nil
			}
			before = a.Said
			if slices.Contains(before, t.id) && t.id != "salut" {
				it.ID, it.Minutes, it.Effect = "chat-again", 2, game.Needs{Social: -1}
			}
		}
	}
	if a := s.Activity; !aside && a != nil && a.Kind == "do" && a.PlaceKind == "chat" && a.PlaceName == p.Name {
		if len(a.Said) >= chatTurns {
			return chatAnswer{Text: say(chatBye, p, s, rng), Mood: "bye"}, nil
		}
		before = a.Said
		if slices.Contains(before, t.id) && t.id != "salut" {
			// Twice the same: a short « you said that already ».
			it.ID, it.Minutes, it.Effect = "chat-again", 2, game.Needs{Social: -1}
		}
		// What the last exchange was worth, at once, and on to the next.
		s.Needs = a.Progress(s.Needs, s.GameMinutes, a.End)
		s.Activity = nil
	}
	friend := s.findFriend("p-" + p.ID)
	chance := t.chance
	if friend != nil && chance > 0 {
		chance = min(0.95, chance+friendBonus)
	}
	var ans chatAnswer
	romantic, isRomance, err := s.romance(t, friend, adult, len(before), rng, p, &it)
	if err != nil {
		return chatAnswer{}, err
	}
	switch {
	case isRomance:
		ans = romantic
	case t.id == "langue" && it.ID != "chat-again":
		a, effect, err := s.greetIn(lang, p, rng)
		if err != nil {
			return chatAnswer{}, err
		}
		ans, it.Effect = a, effect
	case it.ID == "chat-again":
		ans = chatAnswer{Text: say(chatAgain, p, s, rng), Mood: "bad"}
	case t.id == "numero":
		if friend == nil && len(s.Friends) < game.MaxFriends && rng.Float64() < 0.6+0.03*float64(len(before)) {
			ans = chatAnswer{Text: say(numYes, p, s, rng), Mood: "good"}
			s.Friends = append(s.Friends, game.Friend{ID: "p-" + p.ID, Name: p.Name, Gender: p.Gender, Seed: p.Seed, Commune: s.Commune, Friendship: 25 + 2*len(before), Met: s.GameMinutes, Seen: s.GameMinutes, Adult: true, Look: p.Look})
			friend = nil
		} else if friend != nil {
			ans = chatAnswer{Text: say([]string{"{name} : « Tu as déjà mon numéro, {toi} ! Appelle-moi au lieu de demander encore. »"}, p, s, rng), Mood: "good"}
		} else {
			ans = chatAnswer{Text: say(numNo, p, s, rng), Mood: "bad"}
		}
	case chance == 0 || rng.Float64() < chance:
		ans = chatAnswer{Text: say(t.yes, p, s, rng), Mood: "good"}
		if t.yesEffect != (game.Needs{}) {
			it.Effect = t.yesEffect
		}
		if t.yesMinutes > 0 {
			it.Minutes = t.yesMinutes
		}
		if t.money != [2]int{} {
			// Rounded to 100 F, like any note or coin in the street.
			ans.Money = (t.money[0] + rng.IntN(t.money[1]-t.money[0]+1)) / 100 * 100
			if ans.Money < 0 && s.Money+ans.Money < 0 {
				// Inviting someone you can't pay for: they pay, laughing.
				ans.Money = 0
				ans.Text = say([]string{ans.Text + " (C'est {name} qui a payé, tu étais à sec.)"}, p, s, rng)
			}
		}
	default:
		ans = chatAnswer{Text: say(t.no, p, s, rng), Mood: "bad"}
		it.Effect = t.noEffect
	}
	// Flirting while together with someone: word may get back to them.
	if t.id == "drague" && ans.Mood == "good" {
		if mine := s.partner(); mine != nil && rng.Float64() < caughtFlirt {
			mine.Friendship = max(0, mine.Friendship-15)
			ans.Text += " " + strings.NewReplacer("{name}", mine.Name, "{Pronoun}", pronoun(mine)).Replace(flirtHeard[rng.IntN(len(flirtHeard))])
		}
	}
	if aside {
		s.Needs = s.Needs.Add(it.Effect)
		s.Activity.ChatWith, s.Activity.Said = p.ID, append(slices.Clone(before), t.id)
	} else {
		if err := s.start(it, "", "chat", p.Name, chatSurprises, ""); err != nil {
			return chatAnswer{}, err
		}
		s.Activity.Said = append(slices.Clone(before), t.id)
	}
	s.Money += ans.Money
	// A friend: seen today, and closer (or not) for how it went.
	if friend != nil {
		friend.Seen = s.GameMinutes
		// A friend made before looks were kept: from now on, the face they have.
		if len(friend.Look) == 0 {
			friend.Look = p.Look
		}
		switch ans.Mood {
		case "good":
			friend.Friendship = min(100, friend.Friendship+2)
		case "bad":
			friend.Friendship = max(0, friend.Friendship-2)
		}
	}
	return ans, nil
}

func (h *Handler) chatHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		With  Passerby `json:"with"`
		Topic string   `json:"topic"`
		Said  string   `json:"said"`
		Lang  string   `json:"lang"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		adult, err := accountAdult(r.Context(), tx)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		before := s.findFriend("p-" + req.With.ID)
		wasPartner := before != nil && before.Partner
		rng := newRand()
		ans, err := s.chatIn(req.With, req.Topic, req.Said, req.Lang, adult, rng)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		// Together now with someone met in the game, while together with a player: word may reach them (couple.go).
		if f := s.findFriend("p-" + req.With.ID); f != nil && f.Partner && !wasPartner {
			if news := h.gossip(r.Context(), tx, s, f.Name, caughtNew, rng); news != "" {
				ans.Text += " " + news
			}
		}
		return game.Outcome{Text: ans.Text, Money: ans.Money, Mood: ans.Mood}, nil, nil
	})
}

// accountAdult: the player said they're 18 or over (users.adult_at, migration 035).
func accountAdult(ctx context.Context, tx pgx.Tx) (bool, error) {
	var adult bool
	err := tx.QueryRow(ctx, `SELECT adult_at IS NOT NULL FROM users WHERE id = $1`, auth.UserID(ctx)).Scan(&adult)
	return adult, err
}
