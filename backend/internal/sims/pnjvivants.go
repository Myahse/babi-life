package sims

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Les PNJ vivants (update « pnj-vivants »): the PNJ players (pnj.go) live like players where the
// others can see it, always shown as PNJ (the violet ring, « PNJ » after the name):
//
//   - in the grin (grin.go), now and then one answers a player's message (12 to 57 s after it), or just
//     reacts with an emoji, from a bank of lines keyed on what was written (a greeting, a question, foot,
//     the maquis, money, a joke…); and when a room has been quiet a while, one says something of the
//     hour, shares a Bet225 coupon (a real one: its matches are the league's, « Jouer le même » works),
//     a défi's score to beat, or the soirée it throws tonight. No model, no free text: banks of lines.
//   - one commune night in two, one of them throws a soirée at home (from 20h, three hours), in the
//     commune's soirées like a player's: anyone there can go and dance (nothing is paid to a PNJ);
//   - each has a life one sees on its card: a home in a quartier of the commune, a job, a partner,
//     kids, a car or a moto (or the woro-woro).
//
// Nothing runs on its own: a room is looked at when someone reads it (at most every PnjGrinLook per
// room and server: one small query), and the soirées and the lives are pure functions of the id and
// the clock. The rate stays low: a few lines per room and hour at most (PnjGrinPerHour…), never the
// same player answered twice in PnjSamePlayerGap, and every line is keyed so that it's written once.

// PnjVivantsKey: the update that opens all of it.
const PnjVivantsKey = "pnj-vivants"

const (
	// PnjGrinLook: how often a room is looked at, per server (on its reads only).
	PnjGrinLook = 15 * time.Second
	// The most PNJ lines in an hour, in « Tout Babi » and in a commune's room.
	PnjGrinPerHourBabi    = 6
	PnjGrinPerHourCommune = 4
	// An answer comes PnjAnswerMin + up to PnjAnswerSpread seconds after the message, if it is not
	// older than PnjAnswerWithin by then.
	PnjAnswerMin    = 12
	PnjAnswerSpread = 45
	PnjAnswerWithin = 3 * time.Minute
	// PnjSamePlayerGap: a player answered by a PNJ isn't answered again before this.
	PnjSamePlayerGap = 10 * time.Minute
	// A room quiet for this long gets a line (one chance per PnjIdleSlot, PnjIdleChance in a hundred),
	// from 7h to 23h, never within PnjIdleGap of the last PNJ line.
	PnjQuietBabi    = 15 * time.Minute
	PnjQuietCommune = 25 * time.Minute
	PnjIdleSlot     = 20 * time.Minute
	PnjIdleGap      = 15 * time.Minute
	PnjIdleChance   = 55
	// PnjSoireeFrom: a PNJ's soirée starts at this hour (plus up to an hour and a half), for PnjSoireeLen.
	PnjSoireeFrom = 20
	PnjSoireeLen  = 3 * time.Hour
	// pnjPartyPrefix: a PNJ's soirée id, « pnj-<commune>-<day> ».
	pnjPartyPrefix = "pnj-"
)

// pnjMix: pnjSeed's number, its bits mixed (splitmix64's finish), so that every slice of it is as good
// as another: the ids of a commune differ by one letter, and FNV leaves their high bits alike.
func pnjMix(parts ...string) uint64 {
	z := pnjSeed(parts...) + 0x9e3779b97f4a7c15
	z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9
	z = (z ^ (z >> 27)) * 0x94d049bb133111eb
	return z ^ (z >> 31)
}

// pnjVivantsOpen: the update is with the players.
func pnjVivantsOpen(ctx context.Context) bool {
	return features.Default.BlocksKey(ctx, PnjVivantsKey) == ""
}

// pnjOf: the persona a PNJ id names, its commune and its place in the cast.
func pnjOf(id string) (pnjPersona, string, int, bool) {
	rest, ok := strings.CutPrefix(id, PnjPrefix)
	if !ok {
		return pnjPersona{}, "", 0, false
	}
	i := strings.LastIndexByte(rest, '-')
	if i <= 0 {
		return pnjPersona{}, "", 0, false
	}
	n, err := strconv.Atoi(rest[i+1:])
	if err != nil || n < 0 || n >= len(pnjCast) {
		return pnjPersona{}, "", 0, false
	}
	return pnjCast[n], rest[:i], n, true
}

// pnjPlayer: a PNJ as a player, from its id alone (no activity).
func pnjPlayer(id string) (Player, bool) {
	who, commune, _, ok := pnjOf(id)
	if !ok {
		return Player{}, false
	}
	city := ""
	if c, _, ok := communeOf(commune); ok {
		city = c.ID
	}
	return Player{ID: id, FirstName: who.name, Username: who.user, Gender: who.gender, Look: who.look, Stage: game.StageAdulte, City: city, Commune: commune, Npc: true}, true
}

// communeOf: the city a commune is in, and the commune.
func communeOf(commune string) (world.City, world.Commune, bool) {
	for _, c := range world.Cities {
		for _, cm := range c.Communes {
			if cm.ID == commune {
				return c, cm, true
			}
		}
	}
	return world.City{}, world.Commune{}, false
}

/* ---------- The grin ---------- */

// grinRow: one of a room's last messages, as the PNJ read them.
type grinRow struct {
	id      int64
	sim     string // a player's (empty: a PNJ's, or a deleted account's)
	name    string // the player's first name
	pnj     string
	body    string
	at      time.Time
	replyTo *int64
}

// pnjLine: what a PNJ says in a room.
type pnjLine struct {
	who     Player
	body    string
	replyTo *int64
	key     string
}

// pnjGrinLooked: when this server last looked at each room (unix seconds).
var pnjGrinLooked sync.Map

// pnjGrin: on a read of the room, whether a PNJ says something now; written at once (the read that
// follows shows it).
func (h *Handler) pnjGrin(ctx context.Context, room string, now time.Time) {
	if !pnjVivantsOpen(ctx) {
		return
	}
	if last, ok := pnjGrinLooked.Load(room); ok && now.Unix()-last.(int64) < int64(PnjGrinLook/time.Second) {
		return
	}
	pnjGrinLooked.Store(room, now.Unix())
	rows, err := h.DB.Query(ctx, `SELECT g.id, COALESCE(g.sim::text, ''), COALESCE(s.first_name, ''), COALESCE(g.pnj, ''), g.body, g.created_at, g.reply_to,
			(SELECT count(*) FROM grin p WHERE p.room = $1 AND p.pnj IS NOT NULL AND p.created_at > now() - interval '1 hour')
		FROM grin g LEFT JOIN sims s ON s.id = g.sim
		WHERE g.room = $1 AND NOT g.hidden ORDER BY g.id DESC LIMIT 15`, room)
	if err != nil {
		return
	}
	var recent []grinRow
	hour := 0
	for rows.Next() {
		var r grinRow
		if rows.Scan(&r.id, &r.sim, &r.name, &r.pnj, &r.body, &r.at, &r.replyTo, &hour) == nil {
			recent = append(recent, r)
		}
	}
	rows.Close()
	line := pnjGrinLine(ctx, room, recent, hour, now)
	if line == nil {
		return
	}
	_, _ = h.DB.Exec(ctx, `INSERT INTO grin (room, pnj, pnj_name, body, reply_to, pnj_key) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (pnj_key) DO NOTHING`,
		room, line.who.ID, line.who.FirstName, line.body, line.replyTo, line.key)
}

// pnjSpeakers: the PNJ who may speak in a room now: the commune's, or for « Tout Babi » those of a
// few of Abidjan's communes (a different few every PnjIdleSlot).
func pnjSpeakers(ctx context.Context, room string, now time.Time) []Player {
	if room != "babi" {
		c, _, ok := communeOf(room)
		if !ok {
			return nil
		}
		return pnjAt(ctx, c.ID, room, now, 0)
	}
	c, ok := world.FindCity("abidjan")
	if !ok || len(c.Communes) == 0 {
		return nil
	}
	slot := now.Unix() / int64(PnjIdleSlot/time.Second)
	var out []Player
	for k := range 3 {
		cm := c.Communes[pnjMix("babi", fmt.Sprint(slot), fmt.Sprint(k))%uint64(len(c.Communes))]
		for _, p := range pnjAt(ctx, c.ID, cm.ID, now, 0) {
			if !containsPlayer(out, p.FirstName) {
				out = append(out, p)
			}
		}
	}
	return out
}

func containsPlayer(list []Player, name string) bool {
	for _, p := range list {
		if p.FirstName == name {
			return true
		}
	}
	return false
}

// pnjGrinLine: what a PNJ says in the room now, from its last messages (newest first) and how many
// PNJ lines it had in the last hour; nil: nothing.
func pnjGrinLine(ctx context.Context, room string, recent []grinRow, hourCount int, now time.Time) *pnjLine {
	limit := PnjGrinPerHourCommune
	quiet := PnjQuietCommune
	if room == "babi" {
		limit, quiet = PnjGrinPerHourBabi, PnjQuietBabi
	}
	if hourCount >= limit {
		return nil
	}
	byID := map[int64]grinRow{}
	for _, r := range recent {
		byID[r.id] = r
	}
	var lastPnj time.Time
	answered := map[string]time.Time{} // a player -> when a PNJ last answered them
	for _, r := range recent {
		if r.pnj == "" {
			continue
		}
		if lastPnj.IsZero() {
			lastPnj = r.at
		}
		if r.replyTo != nil {
			if q, ok := byID[*r.replyTo]; ok && q.sim != "" && r.at.After(answered[q.sim]) {
				answered[q.sim] = r.at
			}
		}
	}
	// A player's message, the last of the room: answered now and then, after a little while.
	if len(recent) > 0 && recent[0].sim != "" {
		m := recent[0]
		age := now.Sub(m.at)
		delay := time.Duration(PnjAnswerMin+int(pnjMix("delay", fmt.Sprint(m.id))%PnjAnswerSpread)) * time.Second
		if age < delay {
			return nil // its answer may still come: nothing else meanwhile
		}
		if age <= PnjAnswerWithin && (answered[m.sim].IsZero() || now.Sub(answered[m.sim]) >= PnjSamePlayerGap) {
			return pnjAnswerTo(ctx, room, m, byID, now)
		}
	}
	// A quiet room: something of the hour, a coupon, a défi, a soirée.
	if len(recent) > 0 && now.Sub(recent[0].at) < quiet {
		return nil
	}
	if !lastPnj.IsZero() && now.Sub(lastPnj) < PnjIdleGap {
		return nil
	}
	hour := game.HourOf(game.MinuteOf(now))
	if hour < 7 || hour >= 23 {
		return nil
	}
	slot := now.Unix() / int64(PnjIdleSlot/time.Second)
	seed := pnjMix("idle", room, fmt.Sprint(slot))
	if seed%100 >= PnjIdleChance {
		return nil
	}
	speakers := pnjSpeakers(ctx, room, now)
	if len(speakers) == 0 {
		return nil
	}
	who := speakers[(seed/100)%uint64(len(speakers))]
	line := &pnjLine{who: who, key: fmt.Sprintf("idle:%s:%d", room, slot)}
	switch pick := (seed >> 16) % 100; {
	case pick < 15:
		line.body = pnjCoupon(who.ID, now)
	case pick < 28:
		line.body = pnjDefi(seed)
	case pick < 40:
		if p, ok := pnjParty(who.City, who.Commune, now, true); ok && features.Default.BlocksKey(ctx, "soiree") == "" {
			host, _ := pnjPlayer(p.Host)
			line.who = host
			line.body = pnjSoireeLine(p, seed)
		}
	}
	if line.body == "" {
		line.body = pnjChatter(who, room == "babi", hour, seed)
	}
	return line
}

// pnjAnswerTo: a PNJ's answer to a player's message, or nothing (the dice said no).
func pnjAnswerTo(ctx context.Context, room string, m grinRow, byID map[int64]grinRow, now time.Time) *pnjLine {
	seed := pnjMix("answer", fmt.Sprint(m.id))
	topic := pnjTopic(m.body)
	// Talking to a PNJ: the one it answers, else one named.
	var who Player
	if m.replyTo != nil {
		if q, ok := byID[*m.replyTo]; ok && q.pnj != "" {
			who, _ = pnjPlayer(q.pnj)
			topic.addressed = true
		}
	}
	speakers := pnjSpeakers(ctx, room, now)
	if who.ID == "" {
		low := fold(m.body)
		for _, p := range speakers {
			if strings.Contains(low, fold(p.FirstName)) {
				who, topic.addressed = p, true
				break
			}
		}
	}
	if who.ID == "" {
		if len(speakers) == 0 {
			return nil
		}
		who = speakers[(seed/100)%uint64(len(speakers))]
	}
	if int(seed%100) >= topic.chance() {
		return nil
	}
	id := m.id
	return &pnjLine{who: who, body: pnjAnswerBody(topic, m.name, who, seed), replyTo: &id, key: fmt.Sprintf("ans:%d", m.id)}
}

// pnjTopicOf: what a message is about, as the PNJ hear it.
type pnjTopicOf struct {
	kind      string // "salut", "pnj", "foot", "maquis", "argent", "boulot", "amour", "rire", "fatigue", "soiree", "transport", "meteo", "carte", "question", ""
	question  bool
	addressed bool
}

// chance: in a hundred, that a PNJ answers it.
func (t pnjTopicOf) chance() int {
	switch {
	case t.addressed, t.kind == "pnj":
		return 85
	case t.kind == "salut":
		return 60
	case t.question:
		return 50
	case t.kind != "":
		return 40
	}
	return 20
}

// pnjWords: the words that say a topic (folded: lower case, no accents).
var pnjWords = []struct {
	kind  string
	words []string
}{
	{"pnj", []string{"pnj", "bot", "robot", " ia ", "faux joueur", "vrai joueur"}},
	{"carte", []string{"[ticket:", "[defi:", "[jeu:"}},
	{"salut", []string{"bonjour", "bonsoir", "salut", "slt", "coucou", "hello", "bjr", "bsr", "on dit quoi", "ca dit quoi", "y a quoi", "akwaba", "yo ", "cc ", "la famille", "wesh"}},
	{"foot", []string{"foot", "match", "but ", "ballon", "equipe", "elephant", "can ", "championnat", "sporting", "yop city", "goal"}},
	{"maquis", []string{"maquis", "garba", "alloco", "attieke", "poisson", "poulet", "biere", "manger", "faim", "kedjenou", "placali", "foutou", "bouffe", "dje"}},
	{"argent", []string{"djai", "argent", "wari", "gombo", "sous", "dja", "pari", "bet225", "coupon", "loto", "riche", "fauche", "money", "cote"}},
	{"boulot", []string{"boulot", "travail", "taf", "patron", "bureau", "service", "job", "chomage"}},
	{"amour", []string{"amour", "cherie", "love", "coeur", "celib", "go ", "ma go", "mon gars", "mariage", "crush"}},
	{"rire", []string{"mdr", "lol", "ptdr", "haha", "hihi", "😂", "🤣", "dêh", "deh", "blague"}},
	{"fatigue", []string{"fatigue", "dormir", "sommeil", "malade", "stress", "triste", "dur dur", "pas facile"}},
	{"soiree", []string{"soiree", "ambiance", "boite", "danser", "coupe-decale", "coupe decale", "zouglou", "fete", "enjaille"}},
	{"transport", []string{"woro", "gbaka", "embouteillage", "taxi", "bouchon", "moto", "voiture"}},
	{"meteo", []string{"pluie", "il pleut", "soleil", "chaud", "chaleur", "orage"}},
}

// fold: lower case, without accents, padded (so « yo » alone matches « yo »).
func fold(s string) string {
	r := strings.NewReplacer("é", "e", "è", "e", "ê", "e", "ë", "e", "à", "a", "â", "a", "î", "i", "ï", "i", "ô", "o", "ö", "o", "ù", "u", "û", "u", "ü", "u", "ç", "c", "’", "'")
	return " " + r.Replace(strings.ToLower(s)) + " "
}

func pnjTopic(body string) pnjTopicOf {
	low := fold(body)
	t := pnjTopicOf{question: strings.Contains(body, "?")}
	for _, q := range []string{" comment ", " pourquoi ", " qui ", " ou ", " quand ", " c'est quoi ", " combien ", " vous ", " quelqu'un "} {
		if strings.HasPrefix(low, q) {
			t.question = true
		}
	}
	for _, w := range pnjWords {
		for _, x := range w.words {
			if strings.Contains(low, x) {
				t.kind = w.kind
				return t
			}
		}
	}
	return t
}

// pnjEmoji: the reactions to a topic (an answer of an emoji alone, PnjEmojiShare in a hundred).
var pnjEmoji = map[string][]string{
	"salut": {"👋🏾", "🙌🏾", "🤝🏾"}, "rire": {"😂", "🤣", "😂😂"}, "foot": {"⚽🔥", "⚽", "🔥🔥"}, "maquis": {"😋", "🤤", "🍗😋"},
	"argent": {"💸", "🤑", "💰"}, "amour": {"😍", "🥰", "❤️"}, "fatigue": {"🫂", "💪🏾", "🙏🏾"}, "soiree": {"🎉", "💃🏾", "🕺🏾🔥"},
	"carte": {"🔥", "💪🏾", "👀"}, "transport": {"😩", "🚕", "😅"}, "meteo": {"☀️", "🌧️", "🥵"}, "": {"👍🏾", "🔥", "💯", "😄"},
}

// PnjEmojiShare: of the answers that may be an emoji, how many in a hundred are one.
const PnjEmojiShare = 30

// pnjAnswers: what a PNJ answers, by topic (%s, when there is one: the player's first name).
var pnjAnswers = map[string][]string{
	"pnj": {
		"Oui, moi je suis PNJ, le jeu m'a mis là pour mettre l'ambiance. Mais je réponds quand même 😄",
		"Je suis un PNJ, c'est vrai ! Les vrais joueurs ont leur nom sans « PNJ ». Moi je suis là pour causer un peu.",
		"PNJ oui, mais PNJ enjaillé ! On est ensemble %s.",
		"C'est moi le PNJ du coin. Si tu cherches de vrais joueurs, regarde la liste « Ici » : ils n'ont pas l'anneau violet.",
	},
	"salut": {
		"On dit quoi %s ! Bonne arrivée au grin 👋🏾",
		"Salut %s ! Ça va un peu ?",
		"Yo %s ! C'est comment ?",
		"Bonne arrivée %s, assieds-toi, le thé est chaud ☕",
		"%s ! Ça fait plaisir. On est ensemble.",
		"Akwaba %s ! Tu es dans quel coin ?",
		"Bonjour %s ! Ici c'est l'ambiance, mets-toi à l'aise.",
	},
	"question": {
		"Bonne question %s… Moi je dirais de regarder dans le téléphone, tout est dedans.",
		"Hum, je sais pas trop, mais demande aux vrais joueurs, eux ils savent.",
		"Ça dépend dèh. Toi tu penses quoi ?",
		"Ah ça, faut demander aux anciens du grin !",
		"Moi je dis oui. Mais bon, c'est moi hein 😅",
		"Si tu cherches quoi faire, « Où aller ? » t'emmène partout dans Abidjan.",
	},
	"foot": {
		"Le foot ? Moi c'est Babi Sporting jusqu'à la mort ⚽",
		"Ce soir y a match sur Bet225, on va voir qui est fort !",
		"Yop City FC va gagner, je te dis. Note ça.",
		"Le foot à la console, tu me bats pas %s 😂",
		"Faut qu'on fasse un petit foot de quartier un de ces jours.",
		"Cocody Olympique joue bien cette saison hein.",
	},
	"maquis": {
		"Un garba bien chaud là, ça règle tout 😋",
		"Faut pas parler de maquis, j'ai déjà faim moi.",
		"Le poulet braisé du maquis du coin, c'est le meilleur, je te dis.",
		"Alloco-poisson ce soir, qui est chaud ?",
		"Attiéké, poisson, piment : la vraie vie.",
		"%s tu payes la tournée ou bien ? 😄",
	},
	"argent": {
		"L'argent, faut le gagner au boulot d'abord, après tu joues petit petit.",
		"Moi j'ai fait mon coupon ce matin, on verra ce soir 🤞🏾",
		"Waye-moi un peu là %s 😂 Je blague hein.",
		"Le gombo est dur ces temps-ci, mais ça va aller.",
		"Ne mets pas tout sur un seul ticket hein, c'est conseil.",
		"Les Djai ça vient, ça part. Faut économiser un peu.",
	},
	"boulot": {
		"Le boulot c'est dur mais faut tenir. Courage %s !",
		"Moi je sors du service, je suis cuit.",
		"L'appli Boulot, un service par jour, et tu montes en grade petit petit.",
		"Le patron là il me fatigue, mais bon, c'est le gombo.",
		"Courage, le week-end arrive !",
	},
	"amour": {
		"Ah l'amour… faut pas me parler de ça aujourd'hui 😂",
		"Hum, %s est amoureux·se ? Raconte !",
		"Faut l'inviter au maquis, c'est comme ça que ça commence.",
		"Le cœur a ses raisons hein.",
		"On veut les noms %s 👀",
	},
	"rire": {
		"Tu m'as tué %s 😂",
		"Hahaha c'est trop !",
		"Dèh, vous êtes pas sérieux ici 🤣",
		"Laisse-moi rire un peu, c'est gratuit.",
		"Mdr, le grin est chaud aujourd'hui.",
	},
	"fatigue": {
		"Repose-toi bien %s, demain c'est un autre jour.",
		"Courage, ça va aller 🙏🏾",
		"Un bon dodo, et tout repart.",
		"On est ensemble, tu n'es pas seul·e.",
		"Prends ton temps, la vie c'est pas une course.",
	},
	"soiree": {
		"Soirée ? Je suis partant, envoie l'adresse !",
		"Coupé-décalé toute la nuit 💃🏾",
		"Faut pas me laisser hein, je viens danser.",
		"Ce soir on va s'enjailler, c'est sûr.",
		"Si y a soirée dans ta commune, elle s'affiche sur la carte. On se retrouve là-bas !",
	},
	"transport": {
		"Les embouteillages de Babi, c'est notre sport national 😩",
		"Le woro-woro m'a laissé en route ce matin, dèh.",
		"Moi je prends le gbaka, c'est moins cher.",
		"À moto ça passe partout, mais faut faire attention.",
	},
	"meteo": {
		"Il fait chaud dèh, un bissap glacé et ça ira.",
		"La pluie là, elle a encore tout inondé chez nous.",
		"Ce soleil-là, c'est pas pour les faibles 🥵",
	},
	"carte": {
		"Bien joué %s, je regarde ça.",
		"Ah tu es fort hein !",
		"Je vais essayer de te battre, attends-moi 😤",
		"Joli ! Bonne chance %s 🤞🏾",
	},
	"": {
		"C'est vrai ça %s.",
		"Je suis d'accord avec toi.",
		"Hum, on dit quoi encore ?",
		"Ah bon ? Raconte un peu.",
		"Voilà ! C'est ça même.",
		"Y a pas drap 😄",
		"C'est comme ça Babi.",
	},
}

// pnjAnswerBody: the answer's words (an emoji now and then).
func pnjAnswerBody(t pnjTopicOf, name string, who Player, seed uint64) string {
	kind := t.kind
	if kind == "" && t.question {
		kind = "question"
	}
	if kind != "pnj" && kind != "question" && !t.addressed && (seed>>8)%100 < PnjEmojiShare {
		e := pnjEmoji[kind]
		if len(e) == 0 {
			e = pnjEmoji[""]
		}
		return e[(seed>>16)%uint64(len(e))]
	}
	bank := pnjAnswers[kind]
	if len(bank) == 0 {
		bank = pnjAnswers[""]
	}
	return withName(bank[(seed>>16)%uint64(len(bank))], name)
}

// withName: a line with the player's name where it has a %s (« toi » when there's none).
func withName(line, name string) string {
	if !strings.Contains(line, "%s") {
		return line
	}
	if name == "" {
		name = "toi"
	}
	return fmt.Sprintf(line, name)
}

// pnjMorning, pnjNoon…: what a PNJ says in a quiet room, by the hour.
var pnjChat = map[string][]string{
	"matin": {
		"Bonjour le grin ! On est debout ou bien ?",
		"Le premier café de la journée, c'est sacré ☕",
		"Les gbakas sont déjà pleins ce matin dèh.",
		"Bonne journée à tous, que Dieu nous garde 🙏🏾",
		"Qui va au boulot ce matin ? Courage à vous.",
		"Le marché est déjà chaud à cette heure-là.",
	},
	"midi": {
		"C'est l'heure du garba ! Qui mange avec moi ?",
		"Midi pile, mon ventre a sonné 😂",
		"Le maquis est plein, mais l'attiéké vaut la peine.",
		"Pause déjeuner, enfin.",
	},
	"aprem": {
		"L'après-midi est calme, qui fait quoi ?",
		"Il fait chaud dèh, je cherche un coin d'ombre.",
		"Quelqu'un pour un défi à la console ?",
		"Le grin est calme aujourd'hui, ou bien c'est moi ?",
		"Ce soir y a quoi comme programme ?",
	},
	"soir": {
		"Bonsoir la famille ! Ça dit quoi ce soir ?",
		"La journée est finie, place à l'ambiance 🎶",
		"Qui est au maquis ce soir ?",
		"Ce soir c'est poulet braisé et causerie.",
		"Le quartier bouge ce soir, sortez un peu !",
		"Bonne soirée à tous, on est ensemble.",
	},
}

// pnjCommuneChat: a line about the commune (%s: its name, « à Yopougon »).
var pnjCommuneChat = []string{
	"Ça bouge comment %s aujourd'hui ?",
	"Je suis %s, si y en a qui sont dans le coin, faites signe.",
	"%s c'est calme aujourd'hui, ou bien ?",
}

// pnjDoingChat: a line about what the PNJ is doing (%s: the place, then the activity).
var pnjDoingChat = []string{
	"Je suis à %s en ce moment : %s. Qui vient me rejoindre ?",
	"Là je suis à %s, %s. Venez on est ensemble !",
}

// pnjChatter: a quiet room's line: what it's doing, its commune, or the hour.
func pnjChatter(who Player, babi bool, hour int, seed uint64) string {
	pick := (seed >> 24) % 10
	if who.Activity != nil && pick < 3 {
		return fmt.Sprintf(pnjDoingChat[pick%uint64(len(pnjDoingChat))], who.Activity.PlaceName, lowerFirst(who.Activity.Label))
	}
	if pick < 5 {
		if _, cm, ok := communeOf(who.Commune); ok {
			return fmt.Sprintf(pnjCommuneChat[(seed>>32)%uint64(len(pnjCommuneChat))], inCommune(cm.Name))
		}
	}
	part := "soir"
	switch {
	case hour < 11:
		part = "matin"
	case hour < 14:
		part = "midi"
	case hour < 18:
		part = "aprem"
	}
	bank := pnjChat[part]
	return bank[(seed>>32)%uint64(len(bank))]
}

// pnjDefis: the défis a PNJ challenges the room to (open to all, played on their own).
var pnjDefis = []string{"the", "courses", "garba", "alloco", "bar", "foot"}

// pnjDefi: a défi's score to beat, as a card.
func pnjDefi(seed uint64) string {
	return fmt.Sprintf("[defi:%s:%d]", pnjDefis[(seed>>24)%uint64(len(pnjDefis))], 68+int((seed>>32)%30))
}

/* ---------- The coupons ---------- */

// pnjCouponRef: a PNJ's coupon is its Bet225 round and its place in the cast (ticket « pnj »).
func pnjCouponRef(round int64, idx int) int64 { return round*int64(len(pnjCast)) + int64(idx) }

// pnjCoupon: a PNJ's coupon on the next round still open, as a card.
func pnjCoupon(id string, now time.Time) string {
	_, _, idx, ok := pnjOf(id)
	if !ok {
		return ""
	}
	round := game.RoundAt(now.Unix())
	if m, ok := game.MatchIn("babi", round, 0, now.Unix(), 0); !ok || now.Unix() >= m.Kickoff-60 {
		round++
	}
	return TicketRef("pnj", pnjCouponRef(round, idx))
}

// pnjBet: the coupon itself, as it stands: two to four of the round's matches, the PNJ's picks
// (mostly the favourite), its stake.
func pnjBet(ref int64, now int64) (BetView, string, bool) {
	n := int64(len(pnjCast))
	round, idx := ref/n, int(ref%n)
	if ref < 0 || round <= 0 {
		return BetView{}, "", false
	}
	a := betApps["bet225"]
	seed := pnjMix("coupon", fmt.Sprint(ref))
	matches := game.Round(a.League, round, now, a.Margin)
	if len(matches) == 0 {
		return BetView{}, "", false
	}
	legs := 2 + int(seed%3)
	b := BetView{App: a.ID, Stake: []int{500, 1000, 1000, 2000, 2000, 5000}[(seed>>4)%6], Status: "open", At: time.Unix(matches[0].Kickoff-int64(game.OpenMinutes*60), 0)}
	odds, each := 1.0, []float64{}
	for k := 0; k < legs && k < len(matches); k++ {
		m := matches[(int(seed>>8)+k)%len(matches)]
		pick := "1"
		switch r := (seed >> (16 + 4*k)) % 10; {
		case r < 2:
			pick = "plus"
		case r < 3:
			pick = "btsOui"
		case r < 4:
			pick = "N"
		default:
			if m.Odds.Away < m.Odds.Home {
				pick = "2"
			}
		}
		o, ok := game.PickOdds(m.Odds, pick)
		if !ok {
			continue
		}
		leg := betLeg{Match: m.Key, Label: m.Home + " – " + m.Away, Pick: pick, Odds: o}
		legNow(a.ID, &leg, now)
		b.Legs = append(b.Legs, leg)
		odds *= o
		each = append(each, o)
	}
	b.Odds = min(MaxOdds, float64(int(odds*boostOf(a, each)*100+0.5))/100)
	won := true
	for _, l := range b.Legs {
		switch {
		case l.Won == nil:
			won = false
		case !*l.Won:
			b.Status = "lost"
		}
	}
	if b.Status == "open" && won {
		b.Status, b.Payout = "won", int(float64(b.Stake)*b.Odds)
	}
	return b, pnjCast[idx].name + " (PNJ)", true
}

/* ---------- The soirées ---------- */

// pnjParty: the soirée a PNJ of the commune throws at home tonight, if there's one (one commune night
// in two), going on now, or (soon) coming within two hours.
func pnjParty(city, commune string, now time.Time, soon bool) (Party, bool) {
	minute := game.MinuteOf(now)
	day := game.DayOf(minute)
	for _, d := range []int64{day, day - 1} {
		p, ok := pnjPartyOn(city, commune, d)
		if !ok {
			continue
		}
		from := p.Starts
		if soon {
			from = from.Add(-2 * time.Hour)
		}
		if !now.Before(from) && now.Before(p.Ends) {
			p.Guests = min(15, 3+int(pnjMix(p.ID)%5)+int(max(0, now.Sub(p.Starts))/(20*time.Minute)))
			return p, true
		}
	}
	return Party{}, false
}

// pnjPartyOn: the soirée of a commune's game day, if that night has one.
func pnjPartyOn(city, commune string, day int64) (Party, bool) {
	seed := pnjMix("soiree", city, commune, fmt.Sprint(day))
	if seed%2 != 0 {
		return Party{}, false
	}
	idx := int((seed >> 8) % uint64(len(pnjCast)))
	theme := PartyThemes[(seed>>16)%uint64(len(PartyThemes))]
	start := game.Epoch.Add(time.Duration(day*24*60+PnjSoireeFrom*60+int64((seed>>24)%90)) * time.Minute)
	host := fmt.Sprintf("%s%s-%d", PnjPrefix, commune, idx)
	return Party{ID: fmt.Sprintf("%s%s-%d", pnjPartyPrefix, commune, day), Host: host, HostName: pnjCast[idx].name + " (PNJ)", Theme: theme.ID, Title: theme.Label,
		City: city, Commune: commune, Starts: start, Ends: start.Add(PnjSoireeLen), Free: true}, true
}

// pnjPartyByID: a PNJ's soirée by its id, going on now.
func pnjPartyByID(id string, now time.Time) (Party, bool) {
	rest, ok := strings.CutPrefix(id, pnjPartyPrefix)
	i := strings.LastIndexByte(rest, '-')
	if !ok || i <= 0 {
		return Party{}, false
	}
	c, _, ok := communeOf(rest[:i])
	if !ok {
		return Party{}, false
	}
	p, ok := pnjParty(c.ID, rest[:i], now, false)
	return p, ok && p.ID == id
}

// pnjParties: the commune's PNJ soirée going on now, for around (both updates open).
func pnjParties(ctx context.Context, city, commune string, now time.Time) []Party {
	if !pnjVivantsOpen(ctx) || features.Default.BlocksKey(ctx, "soiree") != "" {
		return nil
	}
	if p, ok := pnjParty(city, commune, now, false); ok {
		return []Party{p}
	}
	return nil
}

// pnjSoireeLines: the soirée told in the grin (%s: its title, then where, then the hour).
var pnjSoireeLines = []string{
	"%s chez moi %s ce soir, à partir de %s ! Venez on va s'enjailler 🎉",
	"Ce soir c'est %s chez moi, %s, dès %s. Tout le monde est invité, c'est gratuit 💃🏾",
	"%s %s ce soir (%s) : la sono est prête, il manque que vous !",
}

func pnjSoireeLine(p Party, seed uint64) string {
	where := ""
	if _, cm, ok := communeOf(p.Commune); ok {
		where = inCommune(cm.Name)
	}
	at := p.Starts.UTC().Format("15h04") // Abidjan is on UTC
	return fmt.Sprintf(pnjSoireeLines[(seed>>24)%uint64(len(pnjSoireeLines))], p.Title, where, at)
}

/* ---------- Their lives ---------- */

// PnjLife: what a PNJ's card tells of its life (made up from its id, the same every time).
type PnjLife struct {
	// Home: the kind of home; Quarter: its quartier of the commune ("": the commune only).
	Home    string `json:"home"`
	Quarter string `json:"quarter,omitempty"`
	// Job: its trade and its grade.
	Job   string `json:"job,omitempty"`
	Level string `json:"level,omitempty"`
	// Partner: who it lives with ("": single).
	Partner string   `json:"partner,omitempty"`
	Kids    []PnjKid `json:"kids,omitempty"`
	// Ride: its vehicle (a model of Bolide's), its kind and colour; none: the woro-woro.
	Ride      string `json:"ride,omitempty"`
	RideKind  string `json:"rideKind,omitempty"`
	RideColor string `json:"rideColor,omitempty"`
}

// PnjKid: one of its children.
type PnjKid struct {
	Name   string `json:"name"`
	Gender string `json:"gender"`
	Age    int    `json:"age"`
}

var pnjHomes = []string{"Une chambre-salon", "Un studio", "Un deux-pièces", "Un appartement", "Une cour commune", "Une villa basse", "Une villa à étage"}

var pnjKidNames = map[string][]string{
	"homme": {"Junior", "Yannick", "Ange", "Désiré", "Chris", "Wilfried", "Ismaël", "Samuel", "Bienvenu", "Elie"},
	"femme": {"Princesse", "Emmanuella", "Ruth", "Aïcha", "Esther", "Océane", "Merveille", "Divine", "Grâce", "Sarah"},
}

// pnjLife: a PNJ's life, from its id.
func pnjLife(id string) *PnjLife {
	who, commune, _, ok := pnjOf(id)
	if !ok {
		return nil
	}
	seed := pnjMix("vie", id)
	l := &PnjLife{Home: pnjHomes[seed%uint64(len(pnjHomes))]}
	if _, cm, ok := communeOf(commune); ok {
		var quarters []string
		for _, p := range cm.Places {
			if p.Quarter != "" && !containsStage(quarters, p.Quarter) {
				quarters = append(quarters, p.Quarter)
			}
		}
		if len(quarters) > 0 {
			l.Quarter = quarters[(seed>>4)%uint64(len(quarters))]
		}
	}
	if c := game.Careers[(seed>>8)%uint64(len(game.Careers))]; len(c.Levels) > 0 {
		l.Job, l.Level = c.Label, c.Levels[(seed>>12)%uint64(len(c.Levels))].Title
	}
	if (seed>>16)%2 == 0 {
		other := "homme"
		if who.gender == "homme" {
			other = "femme"
		}
		var names []string
		for _, p := range pnjCast {
			if p.gender == other {
				names = append(names, p.name)
			}
		}
		l.Partner = names[(seed>>20)%uint64(len(names))]
	}
	kids := []int{0, 0, 0, 1, 1, 1, 2, 2, 3, 3}[(seed>>24)%10]
	for k := range kids {
		g := []string{"homme", "femme"}[(seed>>(28+k))%2]
		names := pnjKidNames[g]
		l.Kids = append(l.Kids, PnjKid{Name: names[(seed>>(32+3*k))%uint64(len(names))], Gender: g, Age: 1 + int((seed>>(44+4*k))%15)})
	}
	if (seed>>56)%10 >= 3 {
		var rides []game.VehicleModel
		for _, m := range game.VehicleModels {
			if m.Price <= 17000000 {
				rides = append(rides, m)
			}
		}
		m := rides[(seed>>60)%uint64(len(rides))]
		l.Ride, l.RideKind, l.RideColor = m.Name, m.Kind, m.Colors[(seed>>40)%uint64(len(m.Colors))]
	}
	return l
}
