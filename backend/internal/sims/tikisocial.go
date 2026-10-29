package sims

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Tikitoko like TikTok: comments under each video (the players', cleaned like
// messages, and the game's audience, written from the views), favourites,
// shares, and every creator's profile.

const (
	TikiCommentsPerHour = 30
	tikiNPCPerViews     = 350 // one audience comment for so many views
	tikiNPCMax          = 40
)

var (
	errTikiComment     = errors.New("écris ton commentaire (150 caractères au plus)")
	errTikiTooChatty   = errors.New("beaucoup de commentaires d'un coup : souffle un peu")
	errNoComment       = errors.New("commentaire introuvable")
	errTikiCantComment = errors.New("tu ne peux pas commenter cette vidéo")
)

// tikiHandle: the @pseudo, or the first name when none was chosen.
func tikiHandle(username, firstName string) string {
	if username != "" {
		return username
	}
	return strings.ToLower(strings.ReplaceAll(firstName, " ", ""))
}

// npcComments: how many of the game's audience have commented, from the views.
func npcComments(views int) int { return min(tikiNPCMax, views/tikiNPCPerViews) }

// What the audience says, by theme, and anywhere.
var tikiSays = map[string][]string{
	"": {
		"Ça c'est Babi 🔥🔥", "On dit quoi ? Tu gères !", "Mdrrr je suis mort 😂", "Première fois que je vois ça, c'est fort",
		"Ahi, c'est trop doux", "La suite stp 🙏", "Qui est là en 2026 ?", "Je partage direct", "Le son là c'est quel son ?",
		"Tu es où exactement ?", "Abonné·e ✅", "Ça donne envie d'aller là-bas", "Vrai de vrai 💯", "C'est chaud ici 😭",
		"Mon quartier 😍", "Il faut faire un live", "Prends-moi avec toi la prochaine fois", "Pourquoi c'est pas viral ça ?",
	},
	"danse":  {"Les pas là c'est quoi ? 💃", "Coupé-décalé ou rien !", "Apprends-moi stp", "Le refrain là me tue", "Tu bouges trop bien"},
	"garba":  {"Garba-choco c'est la vie 🤤", "Attiéké bien chaud là", "C'est combien le plat ?", "J'ai faim maintenant 😭", "Ajoute piment 🌶️"},
	"stade":  {"Allez les Éléphants 🐘🇨🇮", "L'ambiance là c'est fou", "J'étais là aussi !", "Tribune en feu 🔥", "But ! But ! But !"},
	"vlog":   {"Je connais ce coin !", "Babi la nuit c'est autre chose", "Montre-nous le maquis d'à côté", "Le quartier est propre hein"},
	"zoo":    {"Le lion là me regarde mal 😂", "Les enfants vont kiffer", "C'est le zoo de Cocody ?", "L'éléphant 😍"},
	"humour": {"Je suis mort 😂😂😂", "C'est mon oncle ça", "Tu as trop raison", "Encore encore !", "Le dernier passage 😭"},
	"mode":   {"Le style là ! 🔥", "C'est quel couturier ?", "Wax propre", "Tu es trop frais·che", "Dix sur dix"},
	"sport":  {"Motivation 💪", "Je commence demain promis", "Le coach là !", "Respect pour la discipline"},
}

var tikiNPCNames = []string{"Awa", "Koffi", "Aya", "Moussa", "Fatou", "Yao", "Mariam", "Serge", "Adjoua", "Ibrahim", "Grâce", "Junior", "Salimata", "Didier", "Akissi", "Lassina", "Nadège", "Konan", "Ruth", "Arouna", "Ange", "Fabrice"}
var tikiNPCTags = []string{"225", "_ci", "babi", "dabidjan", "officiel", "_yop", "cocody", "lavraie", "_abj", "07"}

// TikiComment is a comment under a video; Author is nil for the game's audience.
type TikiComment struct {
	ID        string       `json:"id"`
	Author    *StoryAuthor `json:"author,omitempty"`
	Name      string       `json:"name"`
	Handle    string       `json:"handle"`
	Body      string       `json:"body"`
	Likes     int          `json:"likes"`
	Liked     bool         `json:"liked"`
	Mine      bool         `json:"mine"`
	ByCreator bool         `json:"byCreator"`
	CanDelete bool         `json:"canDelete"`
	At        time.Time    `json:"at"`
	// The comment it answers (update « repondre-message », reply.go), and a short quote of it.
	ReplyTo string `json:"replyTo,omitempty"`
	Quote   *Quote `json:"quote,omitempty"`
}

// npcCommentList: the audience's comments on a post, always the same for a post.
func npcCommentList(post int64, theme string, n int, at time.Time) []TikiComment {
	rng := rand.New(rand.NewPCG(uint64(post), 0x7171))
	pool := append(slices.Clone(tikiSays[""]), tikiSays[theme]...)
	out := make([]TikiComment, 0, n)
	for i := range n {
		name := tikiNPCNames[rng.IntN(len(tikiNPCNames))]
		handle := strings.ToLower(name) + tikiNPCTags[rng.IntN(len(tikiNPCTags))]
		out = append(out, TikiComment{
			ID:     fmt.Sprintf("npc-%d-%d", post, i),
			Name:   name,
			Handle: strings.NewReplacer("é", "e", "è", "e", "ï", "i", "â", "a").Replace(handle),
			Body:   pool[rng.IntN(len(pool))],
			Likes:  int(rng.ExpFloat64() * 40),
			At:     at.Add(time.Duration(10+rng.IntN(360)) * time.Minute),
		})
	}
	return out
}

// visiblePost: the post, its author and theme, if this Sim may see it.
func (h *Handler) visiblePost(r *http.Request, me string) (id int64, owner, theme string, views int, at time.Time, err error) {
	id, _ = strconv.ParseInt(chi.URLParam(r, "post"), 10, 64)
	// A game creator's post (tikinpc.go): no owner among the players.
	if id < 0 {
		p, ok := h.gamePost(r.Context(), me, id)
		if !ok {
			return id, "", "", 0, at, errNoPost
		}
		return id, "", p.Theme, p.Views, p.At, nil
	}
	err = h.DB.QueryRow(r.Context(), `SELECT p.sim, p.theme, p.views + (SELECT count(*) FROM tiki_likes l WHERE l.post = p.id), p.created_at FROM tiki_posts p WHERE p.id = $1
		AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $2 AND k.blocked = p.sim) OR (k.sim = p.sim AND k.blocked = $2))`, id, me).Scan(&owner, &theme, &views, &at)
	if err != nil {
		err = errNoPost
	}
	return
}

func (h *Handler) tikiComments(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	id, owner, theme, views, at, err := h.visiblePost(r, me)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	// On the game's posts the players' comments are in their own table, and
	// their ids carry an « n » (their hearts stay on the screen, like the audience's).
	out, err := tikiCommentList(r.Context(), h.DB, me, id, owner)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	// The audience under the players, the most liked first.
	npc := npcCommentList(id, theme, npcComments(grown(views, at, time.Now())), at)
	slices.SortFunc(npc, func(a, b TikiComment) int { return b.Likes - a.Likes })
	httpx.JSON(w, http.StatusOK, append(out, npc...))
}

func (h *Handler) tikiComment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Body    string `json:"body"`
		ReplyTo string `json:"replyTo"`
	}
	if err := httpx.Decode(r, &req); err != nil || strings.TrimSpace(req.Body) == "" {
		httpx.Error(w, http.StatusBadRequest, errTikiComment.Error())
		return
	}
	if req.ReplyTo != "" && !replyOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	body, err := cleanCaption(req.Body)
	if err != nil || body == "" {
		httpx.Error(w, http.StatusBadRequest, errTikiComment.Error())
		return
	}
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	id, _, _, _, _, err := h.visiblePost(r, me)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, errTikiCantComment.Error())
		return
	}
	ctx := r.Context()
	var lately int
	_ = h.DB.QueryRow(ctx, `SELECT (SELECT count(*) FROM tiki_comments WHERE sim = $1 AND created_at > now() - interval '1 hour')
		+ (SELECT count(*) FROM tiki_npc_comments WHERE sim = $1 AND created_at > now() - interval '1 hour')`, me).Scan(&lately)
	if lately >= TikiCommentsPerHour {
		httpx.Error(w, http.StatusTooManyRequests, errTikiTooChatty.Error())
		return
	}
	cid, err := addTikiComment(ctx, h.DB, me, id, body, req.ReplyTo)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"id": cid, "body": body, "replyTo": req.ReplyTo})
}

// tikiUncomment: one's own comment, or any comment under one's own video.
func (h *Handler) tikiUncomment(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	if raw, ok := strings.CutPrefix(chi.URLParam(r, "comment"), "n"); ok {
		// On a game creator's post: one's own only (the creator isn't a player).
		cid, _ := strconv.ParseInt(raw, 10, 64)
		if _, err := h.DB.Exec(r.Context(), `DELETE FROM tiki_npc_comments WHERE id = $1 AND sim = $2`, cid, me); err != nil {
			h.gbairaiFail(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	cid, _ := strconv.ParseInt(chi.URLParam(r, "comment"), 10, 64)
	if _, err := h.DB.Exec(r.Context(), `DELETE FROM tiki_comments c WHERE c.id = $1
		AND (c.sim = $2 OR EXISTS(SELECT 1 FROM tiki_posts p WHERE p.id = c.post AND p.sim = $2))`, cid, me); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) tikiCommentLike(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Liked bool `json:"liked"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	cid, _ := strconv.ParseInt(chi.URLParam(r, "comment"), 10, 64)
	if req.Liked {
		_, err = h.DB.Exec(r.Context(), `INSERT INTO tiki_comment_likes (comment, sim) SELECT id, $2 FROM tiki_comments WHERE id = $1 ON CONFLICT DO NOTHING`, cid, me)
	} else {
		_, err = h.DB.Exec(r.Context(), `DELETE FROM tiki_comment_likes WHERE comment = $1 AND sim = $2`, cid, me)
	}
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"liked": req.Liked})
}

// tikiCommentReport: flags a comment for the moderators; its author is blocked for the reporter.
func (h *Handler) tikiCommentReport(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Reason string `json:"reason"`
	}
	if err := httpx.Decode(r, &req); err != nil || !validReason(req.Reason) {
		h.gbairaiFail(w, errNoReason)
		return
	}
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	if raw, ok := strings.CutPrefix(chi.URLParam(r, "comment"), "n"); ok {
		// Under a game creator's post: the comment has no row in tiki_comments, the report keeps its words.
		cid, _ := strconv.ParseInt(raw, 10, 64)
		var author, body string
		if err := h.DB.QueryRow(ctx, `SELECT sim, body FROM tiki_npc_comments WHERE id = $1`, cid).Scan(&author, &body); err != nil || author == me {
			httpx.Error(w, http.StatusNotFound, errNoComment.Error())
			return
		}
		if _, err := h.DB.Exec(ctx, `INSERT INTO reports (reporter, reported, excerpt, reason) VALUES ($1, $2, $3, $4)`, me, author, body, req.Reason); err != nil {
			h.gbairaiFail(w, err)
			return
		}
		_, _ = h.DB.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING`, me, author)
		httpx.JSON(w, http.StatusOK, map[string]string{"text": "Merci. C'est signalé : on va regarder. Tu ne verras plus ce joueur."})
		return
	}
	cid, _ := strconv.ParseInt(chi.URLParam(r, "comment"), 10, 64)
	var author, body string
	var post int64
	if err := h.DB.QueryRow(ctx, `SELECT sim, body, post FROM tiki_comments WHERE id = $1`, cid).Scan(&author, &body, &post); err != nil || author == me {
		httpx.Error(w, http.StatusNotFound, errNoComment.Error())
		return
	}
	if _, err := h.DB.Exec(ctx, `INSERT INTO reports (reporter, reported, post_id, comment_id, excerpt, reason) VALUES ($1, $2, $3, $4, $5, $6)`, me, author, post, cid, body, req.Reason); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	_, _ = h.DB.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING`, me, author)
	httpx.JSON(w, http.StatusOK, map[string]string{"text": "Merci. C'est signalé : on va regarder. Tu ne verras plus ce joueur."})
}

// tikiSave: a video in one's favourites (Favoris, on one's profile), or out.
func (h *Handler) tikiSave(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Saved bool `json:"saved"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	id, _, _, _, _, err := h.visiblePost(r, me)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if id < 0 {
		err = h.npcMark(r, me, id, "save", req.Saved)
	} else if req.Saved {
		_, err = h.DB.Exec(r.Context(), `INSERT INTO tiki_saves (post, sim) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, me)
	} else {
		_, err = h.DB.Exec(r.Context(), `DELETE FROM tiki_saves WHERE post = $1 AND sim = $2`, id, me)
	}
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"saved": req.Saved})
}

// tikiShare counts a share (the app then sends the video in Gbairai).
func (h *Handler) tikiShare(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	id, _, _, _, _, err := h.visiblePost(r, me)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if id > 0 {
		_, _ = h.DB.Exec(r.Context(), `UPDATE tiki_posts SET shares = shares + 1 WHERE id = $1`, id)
	}
	w.WriteHeader(http.StatusNoContent)
}

// TikiProfile is a creator's page: who, the counters, whether one follows them.
type TikiProfile struct {
	Author    StoryAuthor `json:"author"`
	Handle    string      `json:"handle"`
	Tier      string      `json:"tier"`
	Following int         `json:"following"`
	Fans      int         `json:"fans"`
	Likes     int         `json:"likes"`
	Posts     int         `json:"posts"`
	Followed  bool        `json:"followed"`
	Mine      bool        `json:"mine"`
	// A game creator (tikinpc.go): the seed of their look.
	NPC *TikiNPC `json:"npc,omitempty"`
}

func (h *Handler) tikiProfile(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	other := chi.URLParam(r, "other")
	if strings.HasPrefix(other, "friend-") {
		p, ok := friendProfile(me, h.simFriends(r.Context(), me), other, time.Now())
		if !ok {
			httpx.Error(w, http.StatusNotFound, "ami·e introuvable")
			return
		}
		httpx.JSON(w, http.StatusOK, p)
		return
	}
	if strings.HasPrefix(other, "npc-") {
		p, ok := npcProfile(other, time.Now())
		if !ok {
			httpx.Error(w, http.StatusNotFound, "créateur introuvable")
			return
		}
		httpx.JSON(w, http.StatusOK, p)
		return
	}
	var p TikiProfile
	var username string
	var likes, players int
	err = h.DB.QueryRow(r.Context(), `
		SELECT o.id, o.first_name, o.gender, o.look, COALESCE(u.username, ''),
			(SELECT count(*) FROM tiki_follows f WHERE f.follower = o.id),
			o.tiki_fans + (SELECT count(*) FROM tiki_follows f WHERE f.followed = o.id),
			COALESCE((SELECT sum(p.likes) FROM tiki_posts p WHERE p.sim = o.id), 0),
			(SELECT count(*) FROM tiki_likes l JOIN tiki_posts p ON p.id = l.post WHERE p.sim = o.id),
			(SELECT count(*) FROM tiki_posts p WHERE p.sim = o.id),
			EXISTS(SELECT 1 FROM tiki_follows f WHERE f.follower = $2 AND f.followed = o.id)
		FROM sims o JOIN users u ON u.id = o.user_id
		WHERE o.id::text = $1
			AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $2 AND k.blocked = o.id) OR (k.sim = o.id AND k.blocked = $2))`, other, me).
		Scan(&p.Author.ID, &p.Author.FirstName, &p.Author.Gender, &p.Author.Look, &username, &p.Following, &p.Fans, &likes, &players, &p.Posts, &p.Followed)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "créateur introuvable")
		return
	}
	p.Handle, p.Tier, p.Likes, p.Mine = tikiHandle(username, p.Author.FirstName), tikiTier(p.Fans), likes+players, p.Author.ID == me
	httpx.JSON(w, http.StatusOK, p)
}

// npcMark: a like or a favourite on a game creator's post (or taken back).
func (h *Handler) npcMark(r *http.Request, me string, id int64, kind string, on bool) error {
	if _, ok := h.gamePost(r.Context(), me, id); !ok {
		return errNoPost
	}
	if on {
		_, err := h.DB.Exec(r.Context(), `INSERT INTO tiki_npc_marks (post, sim, kind) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, id, me, kind)
		return err
	}
	_, err := h.DB.Exec(r.Context(), `DELETE FROM tiki_npc_marks WHERE post = $1 AND sim = $2 AND kind = $3`, id, me, kind)
	return err
}
