package sims

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/myahse/babi-life/backend/internal/adminkey"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
)

// Gbairai, the phone's messaging app: write to the players your Sim has made
// friends with in the game (a bond, from meeting in the street), and only
// to them. To keep it safe for everyone (young players too):
// - only friends made in the game, never a stranger;
// - links and phone numbers are masked, so nobody is drawn out of the game;
// - anyone can block a friend (no more messages either way) or report a
//   message; reports go to the moderation list (GET /moderation/reports,
//   with MODERATION_KEY), which can also delete a message;
// - short messages (500 characters), at most 20 a minute.
// The app asks for new messages every few seconds while a chat is open.

const (
	MaxMessage    = 500
	MessagesBurst = 20 // a minute
)

var (
	errNotFriends = errors.New("tu ne peux écrire qu'à tes amis du jeu")
	errBlocked    = errors.New("vous ne pouvez plus vous écrire")
	errEmpty      = errors.New("message vide")
	errTooLong    = errors.New("message trop long (500 caractères au plus)")
	errTooFast    = errors.New("doucement ! Attends un peu avant d'écrire encore")
	errNoGbairai  = errors.New("installe d'abord Gbairai depuis le Store")
	errNoReason   = errors.New("dis ce qui ne va pas")
	errNoSuchMsg  = errors.New("message introuvable")
	errNotFound   = errors.New("sim introuvable")
	reLink        = regexp.MustCompile(`(?i)\b((https?://|www\.)\S+|[a-z0-9-]+\.(com|net|org|ci|fr|io|me|app|link|ly|gg|tv)\b(/\S*)?)`)
	rePhone       = regexp.MustCompile(`(\+?\d[\d .-]{6,}\d)`)
	reSticker     = regexp.MustCompile(`^\[sticker:[a-z0-9-]+\]$`)
	reportReasons = game.ReportReasons
)

// cleanMessage: trimmed, control characters out, links and phone numbers masked.
func cleanMessage(body string) (string, error) {
	body = strings.Map(func(r rune) rune {
		if r == '\n' {
			return r
		}
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, strings.TrimSpace(body))
	if body == "" {
		return "", errEmpty
	}
	if len([]rune(body)) > MaxMessage {
		return "", errTooLong
	}
	body = reLink.ReplaceAllString(body, "[lien masqué]")
	body = rePhone.ReplaceAllStringFunc(body, func(m string) string {
		digits := 0
		for _, r := range m {
			if unicode.IsDigit(r) {
				digits++
			}
		}
		if digits < 8 {
			return m // a price, a time…
		}
		return "[numéro masqué]"
	})
	return body, nil
}

// Message is one message of a chat, as the app gets it.
type Message struct {
	ID     int64      `json:"id"`
	Mine   bool       `json:"mine"`
	Body   string     `json:"body"`
	At     time.Time  `json:"at"`
	ReadAt *time.Time `json:"readAt,omitempty"`
}

// Chat is a friend in the list, with the last message.
type Chat struct {
	Friend  Player   `json:"friend"`
	Last    *Message `json:"last,omitempty"`
	Unread  int      `json:"unread"`
	Blocked bool     `json:"blocked,omitempty"`
}

// texter: the player's Sim, which must have a phone and Gbairai.
func (h *Handler) texter(r *http.Request) (string, error) { return h.appSim(r, "gbairai") }

// appSim: the player's Sim, which must have a phone and this app.
func (h *Handler) appSim(r *http.Request, app string) (string, error) {
	var s Sim
	err := h.DB.QueryRow(r.Context(), `SELECT id, born_at, apps FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())).Scan(&s.ID, &s.BornAt, &s.Apps)
	if err != nil {
		return "", errNotFound
	}
	s.GameMinutes = game.MinuteOf(time.Now())
	// Gbairai from the cradle (update « gbairai-bebe »): the little ones write to their friends too, without a phone of their own.
	if app == "gbairai" && features.Default.BlocksKey(r.Context(), "gbairai-bebe") == "" {
		return s.ID, nil
	}
	if !s.hasPhone() {
		return "", errNoPhoneYet
	}
	if !s.hasApp(app) {
		if app == "gbairai" {
			return "", errNoGbairai
		}
		return "", needApp(&s, app)
	}
	return s.ID, nil
}

// canWrite: friends in the game, and neither has blocked the other.
func canWrite(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, me, to string) error {
	x, y := pair(me, to)
	var friends, blocked bool
	if err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM bonds WHERE sim_a = $1 AND sim_b = $2 AND friends),
		EXISTS(SELECT 1 FROM blocks WHERE (sim = $3 AND blocked = $4) OR (sim = $4 AND blocked = $3))`, x, y, me, to).Scan(&friends, &blocked); err != nil {
		return err
	}
	if !friends {
		return errNotFriends
	}
	if blocked {
		return errBlocked
	}
	return nil
}

func (h *Handler) gbairaiFail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errNotFound):
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
	case errors.Is(err, errTooFast):
		httpx.Error(w, http.StatusTooManyRequests, err.Error())
	case errors.Is(err, errNotFriends), errors.Is(err, errBlocked), errors.Is(err, errNoGbairai), errors.Is(err, errNoPhoneYet), strings.HasPrefix(err.Error(), "installe d'abord"):
		httpx.Error(w, http.StatusForbidden, err.Error())
	case errors.Is(err, errEmpty), errors.Is(err, errTooLong), errors.Is(err, errNoReason), errors.Is(err, errNoSuchMsg):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	default:
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
	}
}

// chats: the friends to write to, the last message with each, what's unread.
func (h *Handler) chats(w http.ResponseWriter, r *http.Request) {
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	friends, err := h.players(ctx, game.MinuteOf(time.Now()), `
		SELECT o.id, o.first_name, COALESCE(u.username, ''), o.gender, o.look, o.born_at, o.activity, b.friendship, o.city, o.commune, o.last_tick > $2, true, ''
		FROM bonds b
		JOIN sims o ON o.id = CASE WHEN b.sim_a = $1::uuid THEN b.sim_b ELSE b.sim_a END
		JOIN users u ON u.id = o.user_id
		WHERE (b.sim_a = $1::uuid OR b.sim_b = $1::uuid) AND b.friends
		LIMIT 200`, me, time.Now().Add(-OnlineWindow))
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	out := make([]Chat, 0, len(friends))
	for _, f := range friends {
		c := Chat{Friend: f}
		var m Message
		var from string
		err := h.DB.QueryRow(ctx, `SELECT id, from_sim, body, created_at, read_at FROM messages
			WHERE LEAST(from_sim, to_sim) = LEAST($1::uuid, $2::uuid) AND GREATEST(from_sim, to_sim) = GREATEST($1::uuid, $2::uuid)
			ORDER BY id DESC LIMIT 1`, me, f.ID).Scan(&m.ID, &from, &m.Body, &m.At, &m.ReadAt)
		if err == nil {
			m.Mine = from == me
			c.Last = &m
		}
		_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM messages WHERE to_sim = $1 AND from_sim = $2 AND read_at IS NULL`, me, f.ID).Scan(&c.Unread)
		_ = h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM blocks WHERE sim = $1 AND blocked = $2)`, me, f.ID).Scan(&c.Blocked)
		out = append(out, c)
	}
	// The latest conversations first, then the others by friendship.
	sortChats(out)
	httpx.JSON(w, http.StatusOK, out)
}

func sortChats(c []Chat) {
	key := func(x Chat) int64 {
		if x.Last != nil {
			return x.Last.At.UnixNano()
		}
		return int64(x.Friend.Friendship)
	}
	for i := 1; i < len(c); i++ {
		for j := i; j > 0 && key(c[j]) > key(c[j-1]); j-- {
			c[j], c[j-1] = c[j-1], c[j]
		}
	}
}

// thread: the messages with a friend (the last 60, or those after ?after=),
// marked read.
func (h *Handler) thread(w http.ResponseWriter, r *http.Request) {
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	other := chi.URLParam(r, "other")
	x, y := pair(me, other)
	var friends bool
	if err := h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM bonds WHERE sim_a = $1 AND sim_b = $2 AND friends)`, x, y).Scan(&friends); err != nil || !friends {
		h.gbairaiFail(w, errNotFriends)
		return
	}
	after, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
	rows, err := h.DB.Query(ctx, `SELECT id, from_sim, body, created_at, read_at FROM (
		SELECT * FROM messages
		WHERE LEAST(from_sim, to_sim) = $1::uuid AND GREATEST(from_sim, to_sim) = $2::uuid AND id > $3
		ORDER BY id DESC LIMIT 60) m ORDER BY id`, x, y, after)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	msgs := []Message{}
	for rows.Next() {
		var m Message
		var from string
		if err := rows.Scan(&m.ID, &from, &m.Body, &m.At, &m.ReadAt); err != nil {
			rows.Close()
			h.gbairaiFail(w, err)
			return
		}
		m.Mine = from == me
		msgs = append(msgs, m)
	}
	rows.Close()
	_, _ = h.DB.Exec(ctx, `UPDATE messages SET read_at = now() WHERE to_sim = $1 AND from_sim = $2 AND read_at IS NULL`, me, other)
	httpx.JSON(w, http.StatusOK, msgs)
}

// Who is writing to whom right now (« from>to » → when last heard), in this process's
// memory like the live hub: it lasts seconds, and a restart only loses a few dots.
var writing sync.Map

// TypingFor: how long « … écrit » stays after the last keystroke heard.
const TypingFor = 5 * time.Second

// typing: ?writing=1 says this player is writing to the friend (anything else: stopped);
// the answer says whether the friend is writing back. A GET, like the thread marking
// messages read: a write would tell every device of both players that their Sim changed.
func (h *Handler) typing(w http.ResponseWriter, r *http.Request) {
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	other := chi.URLParam(r, "other")
	if r.URL.Query().Get("writing") == "1" {
		writing.Store(me+">"+other, time.Now())
	} else {
		writing.Delete(me + ">" + other)
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"typing": isWriting(other, me)})
}

// isWriting: from is writing to to (heard within TypingFor); a stale mark is dropped.
func isWriting(from, to string) bool {
	v, ok := writing.Load(from + ">" + to)
	if !ok {
		return false
	}
	if time.Since(v.(time.Time)) > TypingFor {
		writing.Delete(from + ">" + to)
		return false
	}
	return true
}

// write: send a message to a friend.
func (h *Handler) write(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Body string `json:"body"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	body, err := cleanMessage(req.Body)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	to := chi.URLParam(r, "other")
	if err := canWrite(ctx, h.DB, me, to); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	var recent int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM messages WHERE from_sim = $1 AND created_at > now() - interval '1 minute'`, me).Scan(&recent)
	if recent >= MessagesBurst {
		h.gbairaiFail(w, errTooFast)
		return
	}
	m := Message{Mine: true, Body: body}
	if err := h.DB.QueryRow(ctx, `INSERT INTO messages (from_sim, to_sim, body) VALUES ($1, $2, $3) RETURNING id, created_at`, me, to, body).Scan(&m.ID, &m.At); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	// Sent: no longer writing.
	writing.Delete(me + ">" + to)
	// On the other's phone: who wrote, and what (the latest from the same friend replaces the one before).
	var name string
	_ = h.DB.QueryRow(ctx, `SELECT first_name FROM sims WHERE id = $1`, me).Scan(&name)
	preview := body
	if reSticker.MatchString(body) {
		preview = "a envoyé un sticker"
	}
	h.Push.ToSim(to, push.Message{Title: name + " · Gbairai", Body: preview, URL: "/jeu?app=gbairai", Tag: "gbairai-" + me})
	httpx.JSON(w, http.StatusOK, m)
}

// block: stop (or allow again) messages with a friend.
func (h *Handler) block(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Blocked bool `json:"blocked"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	other := chi.URLParam(r, "other")
	if req.Blocked {
		_, err = h.DB.Exec(r.Context(), `INSERT INTO blocks (sim, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING`, me, other)
	} else {
		_, err = h.DB.Exec(r.Context(), `DELETE FROM blocks WHERE sim = $1 AND blocked = $2`, me, other)
	}
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"blocked": req.Blocked})
}

// report: flag a message (or the friend) for moderation; blocks them too.
func (h *Handler) report(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MessageID int64  `json:"messageId"`
		Reason    string `json:"reason"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	if !validReason(req.Reason) {
		h.gbairaiFail(w, errNoReason)
		return
	}
	ctx := r.Context()
	other := chi.URLParam(r, "other")
	var excerpt string
	var msg *int64
	if req.MessageID != 0 {
		// Only a message the friend sent to me.
		if err := h.DB.QueryRow(ctx, `SELECT body FROM messages WHERE id = $1 AND from_sim = $2 AND to_sim = $3`, req.MessageID, other, me).Scan(&excerpt); err != nil {
			h.gbairaiFail(w, errNoSuchMsg)
			return
		}
		msg = &req.MessageID
	}
	if _, err := h.DB.Exec(ctx, `INSERT INTO reports (reporter, reported, message_id, excerpt, reason) VALUES ($1, $2, $3, $4, $5)`, me, other, msg, excerpt, req.Reason); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	_, _ = h.DB.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING`, me, other)
	httpx.JSON(w, http.StatusOK, map[string]string{"text": "Merci. C'est signalé : on va regarder. Cette personne est bloquée."})
}

func validReason(r string) bool {
	for _, x := range reportReasons {
		if x == r {
			return true
		}
	}
	return false
}

// Moderation: the open reports, and what to do with them (MODERATION_KEY).
type Moderation struct {
	H   *Handler
	Key string
}

func (m *Moderation) ok(w http.ResponseWriter, r *http.Request) bool {
	if !adminkey.OK(r, m.Key) {
		httpx.Error(w, http.StatusUnauthorized, "clé admin requise")
		return false
	}
	return true
}

// Reports: the open reports, newest first.
func (m *Moderation) Reports(w http.ResponseWriter, r *http.Request) {
	if !m.ok(w, r) {
		return
	}
	rows, err := m.H.DB.Query(r.Context(), `SELECT p.id, p.reporter, a.first_name, p.reported, b.first_name, p.message_id, p.story_id, p.post_id, p.grin_id, p.gram_post_id, p.gram_comment_id, p.snap_id, p.excerpt, p.reason, p.created_at
		FROM reports p JOIN sims a ON a.id = p.reporter JOIN sims b ON b.id = p.reported
		WHERE p.status = 'open' ORDER BY p.created_at DESC LIMIT 100`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	type report struct {
		ID           int64  `json:"id"`
		Reporter     string `json:"reporter"`
		ReporterName string `json:"reporterName"`
		Reported     string `json:"reported"`
		ReportedName string `json:"reportedName"`
		MessageID    *int64 `json:"messageId,omitempty"`
		// A story or a Tikitoko post: its photo at /moderation/photo?story= (or ?post=).
		StoryID *int64 `json:"storyId,omitempty"`
		PostID  *int64 `json:"postId,omitempty"`
		// A message of the grin (the public chat).
		GrinID *int64 `json:"grinId,omitempty"`
		// A Babigram photo (its picture at /moderation/photo?gram=), or a comment under one.
		GramPostID    *int64 `json:"gramPostId,omitempty"`
		GramCommentID *int64 `json:"gramCommentId,omitempty"`
		// A Flashé snap (its picture at /moderation/photo?snap=, kept while the report is open).
		SnapID  *int64    `json:"snapId,omitempty"`
		Excerpt string    `json:"excerpt"`
		Reason  string    `json:"reason"`
		At      time.Time `json:"at"`
	}
	out := []report{}
	for rows.Next() {
		var p report
		if err := rows.Scan(&p.ID, &p.Reporter, &p.ReporterName, &p.Reported, &p.ReportedName, &p.MessageID, &p.StoryID, &p.PostID, &p.GrinID, &p.GramPostID, &p.GramCommentID, &p.SnapID, &p.Excerpt, &p.Reason, &p.At); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		out = append(out, p)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// Photo: the photo of a reported story or post (?story= or ?post=).
func (m *Moderation) Photo(w http.ResponseWriter, r *http.Request) {
	if !m.ok(w, r) {
		return
	}
	var raw []byte
	var mime string
	var err error
	if id, e := strconv.ParseInt(r.URL.Query().Get("story"), 10, 64); e == nil {
		err = m.H.DB.QueryRow(r.Context(), `SELECT image, mime FROM stories WHERE id = $1`, id).Scan(&raw, &mime)
	} else if id, e := strconv.ParseInt(r.URL.Query().Get("snap"), 10, 64); e == nil {
		err = m.H.DB.QueryRow(r.Context(), `SELECT image, mime FROM snaps WHERE id = $1 AND image IS NOT NULL`, id).Scan(&raw, &mime)
	} else if id, e := strconv.ParseInt(r.URL.Query().Get("gram"), 10, 64); e == nil {
		err = m.H.DB.QueryRow(r.Context(), `SELECT image, mime FROM gram_posts WHERE id = $1 AND image IS NOT NULL`, id).Scan(&raw, &mime)
	} else {
		id, _ := strconv.ParseInt(r.URL.Query().Get("post"), 10, 64)
		err = m.H.DB.QueryRow(r.Context(), `SELECT image, mime FROM tiki_posts WHERE id = $1`, id).Scan(&raw, &mime)
	}
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "photo introuvable")
		return
	}
	servePhoto(w, raw, mime)
}

// Resolve: close a report; with deleteMessage (or delete), what was reported goes too.
func (m *Moderation) Resolve(w http.ResponseWriter, r *http.Request) {
	if !m.ok(w, r) {
		return
	}
	var req struct {
		DeleteMessage bool `json:"deleteMessage"`
		Delete        bool `json:"delete"`
	}
	_ = httpx.Decode(r, &req)
	id, _ := strconv.ParseInt(chi.URLParam(r, "report"), 10, 64)
	ctx := r.Context()
	var msg, story, post, grin, gram, gramComment, snap *int64
	if err := m.H.DB.QueryRow(ctx, `UPDATE reports SET status = 'done' WHERE id = $1 RETURNING message_id, story_id, post_id, grin_id, gram_post_id, gram_comment_id, snap_id`, id).Scan(&msg, &story, &post, &grin, &gram, &gramComment, &snap); err != nil {
		httpx.Error(w, http.StatusNotFound, "signalement introuvable")
		return
	}
	if req.DeleteMessage || req.Delete {
		if msg != nil {
			_, _ = m.H.DB.Exec(ctx, `DELETE FROM messages WHERE id = $1`, *msg)
		}
		if story != nil {
			_, _ = m.H.DB.Exec(ctx, `DELETE FROM stories WHERE id = $1`, *story)
		}
		if post != nil {
			// A Tikitoko clip in the bucket goes with its post.
			var key string
			if m.H.DB.QueryRow(ctx, `DELETE FROM tiki_posts WHERE id = $1 RETURNING video_key`, *post).Scan(&key) == nil && key != "" {
				_ = m.H.bucketDelete(ctx, key)
			}
		}
		if grin != nil {
			_, _ = m.H.DB.Exec(ctx, `UPDATE grin SET hidden = true WHERE id = $1`, *grin)
		}
		if snap != nil {
			_, _ = m.H.DB.Exec(ctx, `UPDATE snaps SET image = NULL WHERE id = $1`, *snap)
		}
		// A reported comment goes alone; its photo stays.
		if gramComment != nil {
			_, _ = m.H.DB.Exec(ctx, `DELETE FROM gram_comments WHERE id = $1`, *gramComment)
		} else if gram != nil {
			_, _ = m.H.DB.Exec(ctx, `DELETE FROM gram_posts WHERE id = $1 AND sim IS NOT NULL`, *gram)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"done": true})
}
