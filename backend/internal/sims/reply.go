package sims

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
)

// Replying to one message (the update « repondre-message »): a Gbairai
// message, a message of the grin or a comment under a Tikitoko video can
// answer one other of the same chat, room or video (reply_to,
// 086_reply_to.sql). The answer comes with a short quote of it, so the app
// needn't fetch it; when the original is gone the quote says so.

const (
	ReplyKey   = "repondre-message"
	quoteRunes = 120
)

var errNoReplyTo = errors.New("ce message n'est pas dans cette discussion")

// Quote is what a reply shows of the message it answers.
type Quote struct {
	Name string `json:"name"`
	Body string `json:"body"`
	// Kind: "text" or "sticker" (its body is the sticker's code).
	Kind    string `json:"kind"`
	Mine    bool   `json:"mine,omitempty"`
	Deleted bool   `json:"deleted,omitempty"`
}

// replyOpen: the update is with the players (a reply is refused until then).
func replyOpen(ctx context.Context) bool {
	return features.Default.BlocksKey(ctx, ReplyKey) == ""
}

// quoteOf: the quote of the original as a LEFT JOIN found it (no name, no body: it's gone).
func quoteOf(replyTo *int64, name, body *string, mine bool) *Quote {
	if replyTo == nil {
		return nil
	}
	if body == nil {
		return &Quote{Deleted: true}
	}
	if name == nil {
		// Its author's account was deleted (098_deleted_chats.sql): the message stays.
		n := deletedName
		name = &n
	}
	if reSticker.MatchString(*body) {
		return &Quote{Name: *name, Body: *body, Kind: "sticker", Mine: mine}
	}
	return &Quote{Name: *name, Body: snippet(*body), Kind: "text", Mine: mine}
}

func snippet(s string) string {
	r := []rune(s)
	if len(r) <= quoteRunes {
		return s
	}
	return strings.TrimSpace(string(r[:quoteRunes])) + "…"
}

/* ---------- Gbairai ---------- */

// The messages with the one they answer (q) and its author's name (qs).
const messageSelect = `SELECT m.id, m.from_sim, m.body, m.created_at, m.read_at, m.reply_to, q.from_sim, qs.first_name, q.body
	FROM %s m LEFT JOIN messages q ON q.id = m.reply_to LEFT JOIN sims qs ON qs.id = q.from_sim`

func scanMessages(rows pgx.Rows, me string) ([]Message, error) {
	defer rows.Close()
	out := []Message{}
	for rows.Next() {
		var m Message
		// NULL: written by a deleted account.
		var from, qFrom, qName, qBody *string
		if err := rows.Scan(&m.ID, &from, &m.Body, &m.At, &m.ReadAt, &m.ReplyTo, &qFrom, &qName, &qBody); err != nil {
			return nil, err
		}
		m.Mine = from != nil && *from == me
		m.Quote = quoteOf(m.ReplyTo, qName, qBody, qFrom != nil && *qFrom == me)
		out = append(out, m)
	}
	return out, rows.Err()
}

// threadMessages: the last 60 messages between two Sims (those after `after`), oldest first.
func threadMessages(ctx context.Context, db queryer, me, other string, after int64) ([]Message, error) {
	x, y := pair(me, other)
	rows, err := db.Query(ctx, fmt.Sprintf(messageSelect, `(SELECT * FROM messages
		WHERE LEAST(from_sim, to_sim) = $1::uuid AND GREATEST(from_sim, to_sim) = $2::uuid AND id > $3
		ORDER BY id DESC LIMIT 60)`)+` ORDER BY m.id`, x, y, after)
	if err != nil {
		return nil, err
	}
	return scanMessages(rows, me)
}

// goneMessages: the same, in a conversation with a deleted account (gone, 098_deleted_chats.sql).
func goneMessages(ctx context.Context, db queryer, me, gone string, after int64) ([]Message, error) {
	rows, err := db.Query(ctx, fmt.Sprintf(messageSelect, `(SELECT * FROM messages
		WHERE gone = $1::uuid AND (from_sim = $2::uuid OR to_sim = $2::uuid) AND id > $3
		ORDER BY id DESC LIMIT 60)`)+` ORDER BY m.id`, gone, me, after)
	if err != nil {
		return nil, err
	}
	return scanMessages(rows, me)
}

// sendMessage: the message in the database; replyTo, when set, must be one of this chat.
func sendMessage(ctx context.Context, db queryer, me, to, body string, replyTo *int64) (Message, error) {
	if replyTo != nil {
		x, y := pair(me, to)
		var ok bool
		if err := db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM messages WHERE id = $1
			AND LEAST(from_sim, to_sim) = $2::uuid AND GREATEST(from_sim, to_sim) = $3::uuid)`, *replyTo, x, y).Scan(&ok); err != nil {
			return Message{}, err
		}
		if !ok {
			return Message{}, errNoReplyTo
		}
	}
	var id int64
	if err := db.QueryRow(ctx, `INSERT INTO messages (from_sim, to_sim, body, reply_to) VALUES ($1, $2, $3, $4) RETURNING id`, me, to, body, replyTo).Scan(&id); err != nil {
		return Message{}, err
	}
	rows, err := db.Query(ctx, fmt.Sprintf(messageSelect, "messages")+` WHERE m.id = $1`, id)
	if err != nil {
		return Message{}, err
	}
	ms, err := scanMessages(rows, me)
	if err != nil || len(ms) == 0 {
		return Message{}, errors.Join(err, errNoSuchMsg)
	}
	return ms[0], nil
}

/* ---------- The grin ---------- */

// grinQuote: the quote of a message of the grin (hidden, gone after a week, or by someone blocked: deleted).
func grinQuote(ctx context.Context, db queryer, me string, replyTo *int64) *Quote {
	if replyTo == nil {
		return nil
	}
	var name, body, from *string
	_ = db.QueryRow(ctx, `SELECT s.first_name, g.body, g.sim FROM grin g LEFT JOIN sims s ON s.id = g.sim
		WHERE g.id = $1 AND NOT g.hidden
			AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $2 AND k.blocked = g.sim) OR (k.sim = g.sim AND k.blocked = $2))`, *replyTo, me).Scan(&name, &body, &from)
	return quoteOf(replyTo, name, body, from != nil && *from == me)
}

// sayInGrin: the message in the room; replyTo, when set, must be one of this room.
func sayInGrin(ctx context.Context, db queryer, me, room, body string, replyTo *int64) (int64, error) {
	if replyTo != nil {
		var ok bool
		if err := db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM grin WHERE id = $1 AND room = $2 AND NOT hidden)`, *replyTo, room).Scan(&ok); err != nil {
			return 0, err
		}
		if !ok {
			return 0, errNoReplyTo
		}
	}
	var id int64
	err := db.QueryRow(ctx, `INSERT INTO grin (room, sim, body, reply_to) VALUES ($1, $2, $3, $4) RETURNING id`, room, me, body, replyTo).Scan(&id)
	return id, err
}

/* ---------- Tikitoko's comments ---------- */

// tikiCommentList: the players' comments under a post (a game creator's when post < 0, ids with an « n »),
// newest first, each with the one it answers; owner is the post's author.
func tikiCommentList(ctx context.Context, db queryer, me string, post int64, owner string) ([]TikiComment, error) {
	table, prefix, likes := "tiki_comments", "", `(SELECT count(*) FROM tiki_comment_likes l WHERE l.comment = c.id),
			EXISTS(SELECT 1 FROM tiki_comment_likes l WHERE l.comment = c.id AND l.sim = $2)`
	if post < 0 {
		table, prefix, likes = "tiki_npc_comments", "n", "0, false"
	}
	rows, err := db.Query(ctx, `
		SELECT c.id, o.id, o.first_name, o.gender, o.look, COALESCE(u.username, ''), c.body, c.created_at, `+likes+`,
			c.reply_to, q.sim, qs.first_name, COALESCE(qu.username, ''), q.body
		FROM `+table+` c JOIN sims o ON o.id = c.sim JOIN users u ON u.id = o.user_id
			LEFT JOIN `+table+` q ON q.id = c.reply_to LEFT JOIN sims qs ON qs.id = q.sim LEFT JOIN users qu ON qu.id = qs.user_id
		WHERE c.post = $1
			AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $2 AND k.blocked = c.sim) OR (k.sim = c.sim AND k.blocked = $2))
		ORDER BY c.created_at DESC LIMIT 200`, post, me)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TikiComment{}
	for rows.Next() {
		var c TikiComment
		var a StoryAuthor
		var cid int64
		var username, qUser string
		var replyTo *int64
		var qSim, qName, qBody *string
		if err := rows.Scan(&cid, &a.ID, &a.FirstName, &a.Gender, &a.Look, &username, &c.Body, &c.At, &c.Likes, &c.Liked, &replyTo, &qSim, &qName, &qUser, &qBody); err != nil {
			return nil, err
		}
		c.ID, c.Author, c.Name, c.Handle = prefix+strconv.FormatInt(cid, 10), &a, a.FirstName, tikiHandle(username, a.FirstName)
		c.Mine, c.ByCreator = a.ID == me, a.ID == owner
		c.CanDelete = c.Mine || owner == me
		if replyTo != nil {
			c.ReplyTo = prefix + strconv.FormatInt(*replyTo, 10)
			if qName != nil {
				handle := tikiHandle(qUser, *qName)
				qName = &handle
			}
			c.Quote = quoteOf(replyTo, qName, qBody, qSim != nil && *qSim == me)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// addTikiComment: the comment under the post; replyTo (an id as the app has it), when set, must be one of this post's.
func addTikiComment(ctx context.Context, db queryer, me string, post int64, body, replyTo string) (string, error) {
	table, prefix := "tiki_comments", ""
	if post < 0 {
		table, prefix = "tiki_npc_comments", "n"
	}
	var parent *int64
	if replyTo != "" {
		raw, ok := strings.CutPrefix(replyTo, prefix)
		id, err := strconv.ParseInt(raw, 10, 64)
		if !ok || err != nil {
			return "", errNoReplyTo
		}
		var found bool
		if err := db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM `+table+` WHERE id = $1 AND post = $2)`, id, post).Scan(&found); err != nil {
			return "", err
		}
		if !found {
			return "", errNoReplyTo
		}
		parent = &id
	}
	var cid int64
	if err := db.QueryRow(ctx, `INSERT INTO `+table+` (post, sim, body, reply_to) VALUES ($1, $2, $3, $4) RETURNING id`, post, me, body, parent).Scan(&cid); err != nil {
		return "", err
	}
	return prefix + strconv.FormatInt(cid, 10), nil
}
