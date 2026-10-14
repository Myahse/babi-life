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
}

var chatTopics = []chatTopic{
	{"salut", "Saluer", "hand", 3, game.KidsUp, game.Needs{Social: 6}},
	{"gbairai", "Faire le gbairai", "messages-square", 15, game.KidsUp, game.Needs{Social: 18, Fun: 8}},
	{"drague", "Draguer", "heart", 10, game.Adults, game.Needs{Social: 6}},
	{"djai", "Demander un petit djai", "hand-coins", 5, game.TeensUp, game.Needs{}},
	{"numero", "Échanger les numéros", "smartphone", 5, game.TeensUp, game.Needs{Social: 10}},
}

// What they answer, by topic ({name} is them, {e} the feminine ending).
var chatReplies = map[string][]string{
	"salut": {
		"« Bonne arrivée ! On est ensemble. »",
		"« Ça va un peu, on est là, on se cherche. »",
		"« Bonjour ! Fais doucement avec la chaleur là. »",
		"« Y a pas drap, on se connaît ! »",
		"« On dit quoi ? Toi tu es mignon{e} aujourd'hui dèh ! »",
	},
	"gbairai": {
		"« Tu as appris ? Le fils de la tantie d'en face a eu son BAC ! Tout le quartier a dansé. »",
		"« Le prix du gbaka a encore monté, c'est pas facile hein. »",
		"« Les Éléphants vont gagner samedi, je te dis ! »",
		"« Il paraît qu'il y a un nouveau maquis vers le carrefour, le poulet est doux là-bas. »",
		"« Mon cousin dit qu'on recrute au marché, faut aller voir. »",
		"« Hier le courant est parti trois fois, on a mangé dans le noir. »",
		"« La voisine a fait un baptême, y avait l'attiéké jusqu'à tard la nuit. »",
	},
}

var (
	dragueYes = []string{
		"{name} rigole : « Toi tu es malin{e} hein ! Bon, on peut se voir au maquis. »",
		"{name} sourit : « Ok, ok… tu as gagné. On s'appelle. »",
	}
	dragueNo = []string{
		"{name} rigole : « Toi-même tu sais que c'est pas possible ! »",
		"{name} : « Faut aller travailler d'abord, après on va causer. »",
		"{name} t'a laissé{e} parler seul{e}. Ça arrive.",
	}
	djaiYes = []string{"{name} : « Prends ça pour ton transport, c'est pas grand-chose. »", "{name} : « Voilà, mais tu me rends samedi dèh ! »"}
	djaiNo  = []string{"{name} : « Moi-même je cherche, on est ensemble ! »", "{name} : « Fin du mois est loin, pardon. »"}
	numYes  = []string{"{name} te donne son numéro : « Bip-moi, on va se voir. »"}
	numNo   = []string{"{name} : « Mon téléphone est gâté, on va se croiser encore. »"}
)

// Surprises at the end of a chat in the street.
var chatSurprises = []game.RandomEvent{
	{Text: "En causant, on te présente quelqu'un qui cherche un coup de main : 1 500 F pour l'après-midi.", Money: 1500, Effect: game.Needs{Energy: -10}},
	{Text: "On t'a offert un sachet d'eau glacée. Ça fait du bien !", Effect: game.Needs{Hunger: 5, Fun: 5}},
	{Text: "Pendant que vous causiez, un pickpocket t'a soulagé·e de 500 F.", Money: -500},
	{Text: "On t'invite au baptême de samedi : « Faut venir, y aura à manger ! »", Effect: game.Needs{Social: 10, Fun: 10}},
	{Text: "Un vieux du quartier passe et te donne des conseils de la vie. Tu repars motivé·e.", Effect: game.Needs{Fun: 8}},
}

var errUnknownTopic = errors.New("on ne parle pas de ça")

type Passerby struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Gender string `json:"gender"`
	Seed   int    `json:"seed"`
}

func say(lines []string, p Passerby, rng *rand.Rand) string {
	l := lines[rng.IntN(len(lines))]
	e := ""
	if p.Gender == "femme" {
		e = "e"
	}
	return strings.NewReplacer("{name}", p.Name, "{e}", e).Replace(l)
}

// chat starts a talk with a passer-by and returns what they answer, and money given.
func (s *Sim) chat(p Passerby, topicID string, rng *rand.Rand) (string, int, error) {
	i := slices.IndexFunc(chatTopics, func(t chatTopic) bool { return t.id == topicID })
	if i < 0 {
		return "", 0, errUnknownTopic
	}
	if p.Name == "" || len(p.Name) > 30 || len(p.ID) > 60 {
		return "", 0, errors.New("personne à qui parler")
	}
	t := chatTopics[i]
	it := game.Interaction{ID: "chat-" + t.id, Label: t.label + " avec " + p.Name, Icon: t.icon, Minutes: t.minutes, Effect: t.effect, Ages: t.ages}
	if err := it.AllowedFor(s.stage().ID); err != nil {
		return "", 0, err
	}
	var reply string
	money := 0
	switch t.id {
	case "drague":
		if rng.Float64() < 0.4 {
			reply = say(dragueYes, p, rng)
			it.Effect = game.Needs{Social: 20, Fun: 15}
		} else {
			reply = say(dragueNo, p, rng)
			it.Effect = game.Needs{Social: 2, Fun: -5}
		}
	case "djai":
		if rng.Float64() < 0.35 {
			money = 500 * (1 + rng.IntN(4))
			reply = say(djaiYes, p, rng)
			it.Effect = game.Needs{Social: 4}
		} else {
			reply = say(djaiNo, p, rng)
			it.Effect = game.Needs{Social: -2}
		}
	case "numero":
		if s.findFriend("p-"+p.ID) == nil && len(s.Friends) < game.MaxFriends && rng.Float64() < 0.6 {
			reply = say(numYes, p, rng)
			s.Friends = append(s.Friends, game.Friend{ID: "p-" + p.ID, Name: p.Name, Gender: p.Gender, Seed: p.Seed, Commune: s.Commune, Friendship: 25, Met: s.GameMinutes, Seen: s.GameMinutes})
		} else {
			reply = say(numNo, p, rng)
		}
	default:
		reply = say(chatReplies[t.id], p, rng)
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
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		reply, money, err := s.chat(req.With, req.Topic, newRand())
		if err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: reply, Money: money}, nil, nil
	})
}
