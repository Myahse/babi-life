package sims

import (
	"context"
	"errors"
	"log"
	"math/rand/v2"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/npcchat"
	"github.com/myahse/babi-life/backend/internal/push"
)

// Writing to papa and maman in Gbairai (update « gbairai-parents »): from 3,
// long before a phone of its own, a child texts its parents, and only them
// (its friends too once « gbairai-bebe » is open). They are the game's
// characters, not players: their answers come from the free-chat model when
// « parler-libre » is open and its key set (npcchat.AnswerParent), else from
// the canned lines below, picked by what the child wrote and its day (school,
// hunger, sleep, the hour). Always kind and right for a child: anything
// out of place gets a gentle word and another subject, never the model.
// The answer is written a few seconds after (« en train d'écrire… »).

const parentsKey = "gbairai-parents"

var (
	errParentsSoon  = errors.New("Bientôt : une mise à jour arrive.")
	errTooSmallText = errors.New("à 3 ans, tu pourras écrire à papa et maman")
	errGrownText    = errors.New("tu as grandi : papa et maman, tu les appelles maintenant")
	errNoSuchParent = errors.New("personne à qui écrire")
)

// ParentChat: papa or maman in the list, with the last message.
type ParentChat struct {
	Who    string   `json:"who"`
	Name   string   `json:"name"`
	Gender string   `json:"gender"`
	Last   *Message `json:"last,omitempty"`
	Unread int      `json:"unread"`
	Typing bool     `json:"typing,omitempty"`
}

// canTextParents: a child (enfant or ado, still living with them), not a baby.
func (s *Sim) canTextParents() error {
	if s.BornAt == 0 || !s.minor() {
		return errGrownText
	}
	if s.stage().ID == game.StageBebe {
		return errTooSmallText
	}
	return nil
}

// parentsOpen: the update is there (nil store in tests: everything is).
func parentsOpen(ctx context.Context) bool {
	return features.Default.BlocksKey(ctx, parentsKey) == ""
}

// parentChild: the player's Sim, a child who may text its parents, as it is now.
func (h *Handler) parentChild(r *http.Request) (Sim, error) {
	ctx := r.Context()
	if !parentsOpen(ctx) {
		return Sim{}, errParentsSoon
	}
	s, err := scanSim(h.DB.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(ctx)))
	if err != nil {
		return Sim{}, errNotFound
	}
	s.advance(time.Now(), newRand()) // to know its day now; nothing saved
	return s, s.canTextParents()
}

func parentFail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errNotFound):
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
	case errors.Is(err, errTooFast):
		httpx.Error(w, http.StatusTooManyRequests, err.Error())
	case errors.Is(err, errParentsSoon), errors.Is(err, errTooSmallText), errors.Is(err, errGrownText):
		httpx.Error(w, http.StatusForbidden, err.Error())
	case errors.Is(err, errEmpty), errors.Is(err, errTooLong), errors.Is(err, errNoSuchParent):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	default:
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
	}
}

func parentName(who string) string {
	if who == "maman" {
		return "Maman"
	}
	return "Papa"
}

// parentChats: papa and maman, with the last message and what's unread.
func (h *Handler) parentChats(w http.ResponseWriter, r *http.Request) {
	s, err := h.parentChild(r)
	if err != nil {
		parentFail(w, err)
		return
	}
	ctx := r.Context()
	out := []ParentChat{{Who: "papa", Name: "Papa", Gender: "homme"}, {Who: "maman", Name: "Maman", Gender: "femme"}}
	for i := range out {
		c := &out[i]
		var m Message
		if h.DB.QueryRow(ctx, `SELECT id, mine, body, created_at, read_at FROM parent_messages WHERE sim_id = $1 AND parent = $2 ORDER BY id DESC LIMIT 1`, s.ID, c.Who).Scan(&m.ID, &m.Mine, &m.Body, &m.At, &m.ReadAt) == nil {
			c.Last = &m
		}
		_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM parent_messages WHERE sim_id = $1 AND parent = $2 AND NOT mine AND read_at IS NULL`, s.ID, c.Who).Scan(&c.Unread)
		c.Typing = parentWriting(s.ID, c.Who)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// parentThread: the messages with papa or maman (the last 60, or those after ?after=), read;
// and whether they're writing back.
func (h *Handler) parentThread(w http.ResponseWriter, r *http.Request) {
	s, err := h.parentChild(r)
	if err != nil {
		parentFail(w, err)
		return
	}
	who := chi.URLParam(r, "who")
	if who != "papa" && who != "maman" {
		parentFail(w, errNoSuchParent)
		return
	}
	after, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
	msgs, err := parentMessages(r.Context(), h.DB, s.ID, who, after, 60)
	if err != nil {
		parentFail(w, err)
		return
	}
	_, _ = h.DB.Exec(r.Context(), `UPDATE parent_messages SET read_at = now() WHERE sim_id = $1 AND parent = $2 AND NOT mine AND read_at IS NULL`, s.ID, who)
	httpx.JSON(w, http.StatusOK, map[string]any{"messages": msgs, "typing": parentWriting(s.ID, who)})
}

func parentMessages(ctx context.Context, db queryer, sim, who string, after int64, n int) ([]Message, error) {
	rows, err := db.Query(ctx, `SELECT id, mine, body, created_at, read_at FROM (
		SELECT * FROM parent_messages WHERE sim_id = $1 AND parent = $2 AND id > $3 ORDER BY id DESC LIMIT $4) m ORDER BY id`, sim, who, after, n)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Message{}
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.Mine, &m.Body, &m.At, &m.ReadAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// Papa or maman writing back right now (« sim>who » → since when), in this process's memory
// like the friends' typing: a restart only loses an answer on its way.
var parentTyping sync.Map

func parentWriting(sim, who string) bool {
	v, ok := parentTyping.Load(sim + ">" + who)
	return ok && time.Since(v.(time.Time)) < time.Minute
}

// parentWrite: the child writes to papa or maman; their answer follows a few seconds later.
func (h *Handler) parentWrite(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Body string `json:"body"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	s, err := h.parentChild(r)
	if err != nil {
		parentFail(w, err)
		return
	}
	who := chi.URLParam(r, "who")
	if who != "papa" && who != "maman" {
		parentFail(w, errNoSuchParent)
		return
	}
	body, err := cleanMessage(req.Body)
	if err != nil {
		parentFail(w, err)
		return
	}
	ctx := r.Context()
	var recent int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM parent_messages WHERE sim_id = $1 AND mine AND created_at > now() - interval '1 minute'`, s.ID).Scan(&recent)
	if recent >= MessagesBurst {
		parentFail(w, errTooFast)
		return
	}
	var m Message
	if err := h.DB.QueryRow(ctx, `INSERT INTO parent_messages (sim_id, parent, mine, body) VALUES ($1, $2, true, $3) RETURNING id, created_at`, s.ID, who, body).Scan(&m.ID, &m.At); err != nil {
		parentFail(w, err)
		return
	}
	m.Mine, m.Body = true, body
	// One answer on its way at a time: it reads everything the child wrote meanwhile.
	if _, busy := parentTyping.LoadOrStore(s.ID+">"+who, time.Now()); !busy {
		go h.parentAnswerLater(s, who, auth.UserID(ctx))
	}
	httpx.JSON(w, http.StatusOK, m)
}

// parentAnswerLater: the answer, written after a little while, as long as the child's last word waits for one.
func (h *Handler) parentAnswerLater(s Sim, who, user string) {
	defer parentTyping.Delete(s.ID + ">" + who)
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	for range 3 {
		start := time.Now()
		text, err := h.parentAnswer(ctx, &s, who, user)
		if err != nil || text == "" {
			return
		}
		// Reading, then typing: a second and a half, more for a longer answer.
		wait := min(5*time.Second, 1500*time.Millisecond+time.Duration(len([]rune(text)))*35*time.Millisecond)
		select {
		case <-time.After(wait - time.Since(start)):
		case <-ctx.Done():
			return
		}
		if err := saveParentAnswer(ctx, h.DB, s.ID, who, text); err != nil {
			log.Printf("gbairai-parents: %v", err)
			return
		}
		h.Push.ToSim(s.ID, push.Message{Title: parentName(who) + " · Gbairai", Body: text, URL: "/jeu?app=gbairai", Tag: "gbairai-" + who})
	}
}

func saveParentAnswer(ctx context.Context, db interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}, sim, who, text string) error {
	if _, err := db.Exec(ctx, `UPDATE parent_messages SET read_at = now() WHERE sim_id = $1 AND parent = $2 AND mine AND read_at IS NULL`, sim, who); err != nil {
		return err
	}
	_, err := db.Exec(ctx, `INSERT INTO parent_messages (sim_id, parent, mine, body) VALUES ($1, $2, false, $3)`, sim, who, text)
	return err
}

// parentAnswer: what papa or maman says to the child's last messages ("" when the last word is theirs).
func (h *Handler) parentAnswer(ctx context.Context, s *Sim, who, user string) (string, error) {
	msgs, err := parentMessages(ctx, h.DB, s.ID, who, 0, freeBefore+1)
	if err != nil || len(msgs) == 0 || !msgs[len(msgs)-1].Mine {
		return "", err
	}
	// The child's messages since the last answer, said as one.
	i := len(msgs)
	for i > 0 && msgs[i-1].Mine {
		i--
	}
	var said []string
	for _, m := range msgs[i:] {
		said = append(said, stickerWords(m.Body))
	}
	text := strings.Join(said, "\n")
	var before []npcchat.Line
	for _, m := range msgs[:i] {
		l := npcchat.Line{Who: "them", Text: m.Body}
		if m.Mine {
			l = npcchat.Line{Who: "me", Text: stickerWords(m.Body)}
		}
		before = append(before, l)
	}
	if h.Talk != nil && features.Default.BlocksKey(ctx, "chat-libre") == "" && !unfitForChild(text) && quota.take(user, time.Now()) == nil {
		r, err := h.Talk.AnswerParent(ctx, npcchat.Parent{Who: who, Family: s.family().Hint}, childOf(s), before, text)
		if err == nil && !unfitForChild(r.Text) {
			return clip(r.Text, 400), nil
		}
		if err != nil {
			log.Printf("npcchat (parents): %v", err)
		}
	}
	// What the parent said lately: never the same line twice in a row.
	var lately []string
	for _, m := range msgs[:i] {
		if !m.Mine {
			lately = append(lately, m.Body)
		}
	}
	if len(lately) > 4 {
		lately = lately[len(lately)-4:]
	}
	return cannedParent(who, s, text, newRand(), lately...), nil
}

// stickerWords: a sticker, said in words for the parent reading it.
func stickerWords(body string) string {
	if reSticker.MatchString(body) {
		return "(un sticker « " + strings.TrimSuffix(strings.TrimPrefix(body, "[sticker:"), "]") + " »)"
	}
	return body
}

var dayNames = [7]string{"lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"}

// childOf: the child and the simple facts of its day.
func childOf(s *Sim) npcchat.Child {
	k := npcchat.Child{FirstName: s.FirstName, Gender: s.Gender, Age: s.age(),
		Hour: strconv.Itoa(game.HourOf(s.GameMinutes)) + " h " + pad2(int(s.GameMinutes%60)), Day: dayNames[game.WeekdayOf(s.GameMinutes)],
		Hungry: s.Needs.Hunger < 35, Tired: s.Needs.Energy < 25}
	if s.Activity != nil {
		if s.Activity.Kind == "travel" {
			k.Doing = "en route"
		} else {
			k.Doing = s.Activity.Interaction.Label
		}
	}
	return k
}

func pad2(n int) string {
	if n < 10 {
		return "0" + strconv.Itoa(n)
	}
	return strconv.Itoa(n)
}

/* ---------- The canned answers ---------- */

// plainWords: lower case, no accents, words apart (« Ç'est l'ÉCOLE ! » → " c est l ecole ").
func plainWords(s string) string {
	s = strings.NewReplacer("é", "e", "è", "e", "ê", "e", "ë", "e", "à", "a", "â", "a", "ä", "a", "î", "i", "ï", "i", "ô", "o", "ö", "o", "ù", "u", "û", "u", "ü", "u", "ç", "c", "œ", "oe").Replace(strings.ToLower(s))
	var b strings.Builder
	b.WriteByte(' ')
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else {
			b.WriteByte(' ')
		}
	}
	b.WriteByte(' ')
	return strings.Join(strings.Fields(b.String()), " ")
}

// says: any of the words in what was written; "mang*" is a word's start, "je t aime" a phrase.
func says(n string, words ...string) bool {
	padded := " " + n + " "
	for _, w := range words {
		if stem, ok := strings.CutSuffix(w, "*"); ok {
			if strings.Contains(padded, " "+stem) {
				return true
			}
		} else if strings.Contains(padded, " "+w+" ") {
			return true
		}
	}
	return false
}

// Words a child's parent never writes, and that get a gentle word when the child does.
var unfitWords = []string{"sexe", "sexy", "sexuel*", "porno*", "nue", "nues", "toute nue", "tout nu", "bite", "zizi", "seins", "baise", "coucher avec",
	"pute", "putain", "salope", "connard", "connasse", "encule*", "fdp", "ntm", "nique", "niquer", "batard", "merde", "con", "conne",
	"drogue*", "cannabis", "beuh", "joint", "cocaine", "alcool*", "biere", "whisky", "vodka", "cigarette*", "fumer",
	"arme", "armes", "pistolet", "fusil", "tuer", "flingue", "broute*"}

func unfitForChild(s string) bool { return says(plainWords(s), unfitWords...) }

type cannedTopic struct {
	words []string
	lines []string
}

// What a child asks of its real life (where it lives, a number, a password): never written here.
var privateWords = []string{"adresse", "mot de passe", "password", "numero", "ton num", "whatsapp", "insta*", "snap*", "facebook", "tiktok", "ou tu habites", "ou j habite", "ma vraie", "mon vrai", "photo de moi", "en vrai"}

// Worried, sad, scared: comfort, and someone close to talk to.
var worriedWords = []string{"triste", "peur", "pleur*", "j ai mal", "mal au", "malade", "bless*", "mourir", "suicide", "frappe*", "harcel*", "tout seul", "toute seule", "mechant*", "embete*"}

// {enfant} what they call the child, {moi} papa or maman, {e} the child's feminine ending.
var cannedTopics = []cannedTopic{
	{words: []string{"je t aime", "t aime", "je t adore", "bisou*", "calin*", "tu me manques", "manque"}, lines: []string{
		"Moi aussi je t'aime fort, {enfant}. Plus que l'attiéké-poisson, c'est pour te dire !",
		"Ohhh ! {Moi} t'aime gros comme le Plateau. Gros bisou.",
		"Dieu merci pour toi, {enfant}. Viens me faire un câlin tout à l'heure.",
		"Toi tu sais parler à ton {moi} dèh ! Je t'aime aussi.",
	}},
	{words: []string{"bonjour", "bonsoir", "salut", "coucou", "cc", "slt", "hello", "ca va", "cv", "on dit quoi", "c est comment", "yo"}, lines: []string{
		"Coucou {enfant} ! Ça va bien ? Tu es sage ?",
		"Bonjour mon bébé ! Tu as bien dormi ?",
		"Eh, c'est mon enfant qui m'écrit ! Ça va, {enfant} ?",
		"On est là, {enfant}. Et toi, ta journée se passe bien ?",
	}},
	{words: []string{"faim", "mang*", "repas", "manger", "garba", "attieke", "alloco", "foutou", "riz", "goute*", "bouffe*", "cuisine", "soif"}, lines: []string{
		"On mange {repas}, ne traîne pas dehors !",
		"Il y a de l'attiéké dans la cuisine. Lave tes mains d'abord, hein.",
		"Patience, la sauce est sur le feu. Mets la table en attendant.",
		"Encore faim ? Toi tu vas finir la marmite ! Prends une banane.",
	}},
	{words: []string{"ecole", "devoir*", "lecon*", "maitre*", "classe", "note", "notes", "cahier*", "dictee", "calcul", "math*", "exam*", "interro*", "bac", "cepe"}, lines: []string{
		"Tu as fini tes devoirs ? Les cahiers d'abord, le jeu après.",
		"L'école, c'est ta richesse, {enfant}. Travaille bien, je suis {fier} de toi.",
		"Montre-moi ton cahier ce soir, on regarde ensemble.",
		"Le maître a dit quoi aujourd'hui ? Raconte-moi tout à la maison.",
	}},
	{words: []string{"joue*", "jouer", "jouons", "foot", "ballon", "jeu", "jeux", "console", "copain*", "copine*", "ami", "amis", "amie", "s amuser"}, lines: []string{
		"Va jouer un peu, mais tu rentres avant la nuit. Pas une minute de plus !",
		"Joue doucement, ne te salis pas trop. La lessive, c'est pas toi qui la fais !",
		"D'accord pour jouer, mais les devoirs d'abord, hein.",
		"Amuse-toi bien avec tes amis. Et sois {gentil} avec tout le monde.",
	}},
	{words: []string{"argent", "sous", "wari", "francs", "fcfa", "acheter", "achete", "bonbon*", "payer", "cadeau*", "poche"}, lines: []string{
		"L'argent ne pousse pas sur les arbres, {enfant} ! On en reparle à la maison.",
		"Des bonbons encore ? Tes dents vont partir en vacances !",
		"Tu veux acheter quoi ? Explique-moi ça ce soir, on verra.",
		"Mets de côté ce que tu as, c'est comme ça qu'on devient grand.",
	}},
	{words: []string{"sortir", "sors", "dehors", "aller", "partir", "quartier", "maquis", "plage"}, lines: []string{
		"Sortir ? Tu restes dans le quartier, et tu salues les voisins.",
		"Pas trop loin hein ! Et tu rentres avant qu'il fasse noir.",
		"Tu as demandé la permission ? Bon… d'accord, mais pas longtemps.",
		"On ne traîne pas dehors, {enfant}. Le soir, tout le monde à la maison.",
	}},
	{words: []string{"fatigue*", "dormir", "dodo", "sommeil", "lit", "couche*", "nuit"}, lines: []string{
		"Va te coucher, {enfant}. Demain il y a l'école.",
		"Fatigué{e} ? Une douche et au lit, sans discuter !",
		"Dors bien mon bébé. Que Dieu veille sur toi.",
	}},
	{words: []string{"merci", "mrc", "mci"}, lines: []string{
		"De rien {enfant}, c'est pour ça qu'on est là.",
		"Merci à toi d'être sage. Ça fait plaisir à {moi}.",
	}},
	{words: []string{"ou es tu", "ou tu es", "t es ou", "tu es ou", "tu fais quoi", "tu rentres", "quand"}, lines: []string{
		"Je suis à la maison, {enfant}. Tu me trouves au salon.",
		"Je rentre bientôt, ne t'inquiète pas. Sois sage en attendant.",
		"Je fais mes affaires, je suis là tout à l'heure.",
	}},
}

var (
	unfitLines = []string{
		"Eh ! On ne parle pas comme ça, {enfant}. Dis-moi plutôt comment s'est passée ta journée.",
		"Hum… Ces mots-là, on les laisse dehors. Tu as fini tes devoirs ?",
		"Doucement, {enfant} ! Un enfant poli, c'est la fierté de la maison. Raconte-moi ton jeu.",
	}
	privateLines = []string{
		"Ces choses-là, on ne les écrit pas sur le téléphone, {enfant}. Ni à {moi}, ni à personne. Raconte-moi plutôt ta journée !",
		"Les numéros, les adresses, les mots de passe : on ne les donne jamais, même pas à moi ici. Tu es bien, toi ?",
	}
	worriedLines = []string{
		"Oh mon bébé… Viens me voir, on va parler. Et si quelque chose ne va pas en vrai, dis-le à un grand de confiance près de toi.",
		"Ça va aller, {enfant}. {Moi} est là. Si tu as peur pour de vrai, parle à un adulte de confiance à côté de toi, d'accord ?",
		"Je te fais un gros câlin. Personne n'a le droit de te faire du mal : tu en parles à un grand près de toi, tout de suite.",
	}
	stickerLines = []string{
		"Hahaha ! Toi et tes stickers là !",
		"Il est joli ton sticker. Tu as fini tes devoirs ?",
		"Ah, tu me fais rire, {enfant} !",
	}
	lateLines = []string{
		"Il est tard, {enfant} ! Pose le téléphone et au lit.",
		"Encore debout ? Demain tu vas dormir en classe. Au lit !",
	}
	classLines = []string{
		"Tu écris pendant la classe ? Range ce téléphone et écoute le maître !",
		"On se parle après l'école, {enfant}. Concentre-toi.",
	}
	hungryLines = []string{
		"Tu as l'air d'avoir faim, toi. Passe à la cuisine, il y a à manger.",
		"Viens manger un peu, {enfant}. Le ventre vide, la tête ne marche pas !",
	}
	tiredLines = []string{
		"Tu es fatigué{e}, je le sens. Va te reposer un peu.",
	}
	anyLines = []string{
		"D'accord {enfant}. Sois sage, hein.",
		"Hum, je vois. On en parle à la maison ce soir.",
		"Tu es mon champion{ne}, toi. Continue comme ça.",
		"Ah bon ? Raconte-moi ça tout à l'heure.",
		"C'est bien, {enfant}. N'oublie pas de ranger ta chambre.",
		"Ok ok. Tu as bu de l'eau aujourd'hui ? Il fait chaud dèh.",
	}
)

// cannedParent: papa's or maman's answer, by what the child wrote, then by its day; not one of
// the lines said lately when there's another.
func cannedParent(who string, s *Sim, said string, rng *rand.Rand, lately ...string) string {
	n := plainWords(said)
	hour := game.HourOf(s.GameMinutes)
	atSchool := s.Activity != nil && s.Activity.Interaction.ID == "aller-ecole"
	pick := func(lines []string) string {
		var line string
		for range 12 {
			line = sayToChild(lines[rng.IntN(len(lines))], who, s, rng)
			if !slices.Contains(lately, line) {
				break
			}
		}
		return line
	}
	// Out of place, private, or a worry: that first, whatever the hour.
	switch {
	case says(n, unfitWords...):
		return pick(unfitLines)
	case says(n, privateWords...):
		return pick(privateLines)
	case says(n, worriedWords...):
		return pick(worriedLines)
	}
	var lines []string
	if strings.HasPrefix(said, "(un sticker") {
		lines = stickerLines
	}
	for _, t := range cannedTopics {
		if lines == nil && says(n, t.words...) {
			lines = t.lines
		}
	}
	// The child's day: at school, up late, hungry or tired (now and then even when it says something else).
	day := lines == nil || rng.IntN(2) == 0
	switch {
	case atSchool && day:
		lines = classLines
	case (hour >= 22 || hour < 5) && day:
		lines = lateLines
	case lines != nil:
	case s.Needs.Hunger < 35:
		lines = hungryLines
	case s.Needs.Energy < 25:
		lines = tiredLines
	default:
		lines = anyLines
	}
	return pick(lines)
}

func sayToChild(line, who string, s *Sim, rng *rand.Rand) string {
	enfant := []string{"mon fils", "mon bébé", "mon grand", "mon chéri"}
	e2, ne := "", ""
	if s.Gender == "femme" {
		enfant = []string{"ma fille", "mon bébé", "ma grande", "ma chérie"}
		e2, ne = "e", "ne"
	}
	gentil := map[bool]string{true: "gentille", false: "gentil"}[s.Gender == "femme"]
	fier := map[bool]string{true: "fière", false: "fier"}[who == "maman"]
	repas := "tout à l'heure"
	switch h := game.HourOf(s.GameMinutes); {
	case h < 12:
		repas = "à midi"
	case h < 19:
		repas = "à 19 h"
	}
	moi := parentName(who)
	return strings.NewReplacer("{enfant}", enfant[rng.IntN(len(enfant))], "{Moi}", moi, "{moi}", strings.ToLower(moi), "{e}", e2, "{ne}", ne,
		"{gentil}", gentil, "{fier}", fier, "{repas}", repas).Replace(line)
}
