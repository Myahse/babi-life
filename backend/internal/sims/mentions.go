package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
)

// Tagging people in the grin (the update « mentions-grin »): « @pseudo » in a
// message names a player by their username. The server keeps the real
// players named (at most five, never oneself, nobody blocked either way) on
// the message (grin.mentions, 126_grin_mentions.sql), so the app lights them
// up, and tells each one: a notification on the phone and, the game open, a
// toast whose tap opens the grin at that message. Only those who can read the
// room are told: everyone for « Tout Babi », those in that commune now for
// « Ma commune », and never a Sim without Gbairai. One sender rings the same
// player at most once every two minutes (in memory: no table, no ticker). The
// box's suggestions (grinPeople) come from who wrote in the room lately, then
// friends, then any player by username.

const (
	MentionsKey = "mentions-grin"
	// MaxMentions: the players one message can name.
	MaxMentions = 5
	// mentionGap: one sender rings the same player at most this often.
	mentionGap = 2 * time.Minute
	// mentionExcerpt: the runes of the message quoted in the notification.
	mentionExcerpt = 80
	// peoplePerMinute: the box's searches an account may make (it asks as the name is typed, slowed down).
	peoplePerMinute = 60
)

var errPeopleTooFast = errors.New("doucement ! Attends un peu avant de chercher encore")

// mentionsOpen: the update is with the players.
func mentionsOpen(ctx context.Context) bool {
	return features.Default.BlocksKey(ctx, MentionsKey) == ""
}

// usernameRune: what a username is made of (auth: [A-Za-z0-9_.], 3 to 24).
func usernameRune(r rune) bool {
	return r < utf8.RuneSelf && (r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' || r == '.')
}

// wordRune: a rune that, just before an « @ », makes it part of a word (an e-mail address), not a mention.
func wordRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '.' || r == '@'
}

// parseMentions: the usernames a message names (« @kofi_225 »), in lower case, each once, in order,
// at most MaxMentions. An « @ » inside a word (« awa@mail.ci ») is no mention; a full stop after the name
// ends the sentence, not the name; a name running into a letter a username can't have (« @Amélie ») is
// no username at all.
func parseMentions(body string) []string {
	var out []string
	prev := ' '
	for i, r := range body {
		if r != '@' || wordRune(prev) {
			prev = r
			continue
		}
		prev = r
		j := i + 1
		for j < len(body) && usernameRune(rune(body[j])) {
			j++
		}
		if j < len(body) {
			if next, _ := utf8.DecodeRuneInString(body[j:]); unicode.IsLetter(next) || unicode.IsDigit(next) {
				continue
			}
		}
		name := strings.TrimRight(body[i+1:j], ".")
		if n := len(name); n < 3 || n > 24 {
			continue
		}
		name = strings.ToLower(name)
		if !containsStr(out, name) {
			out = append(out, name)
			if len(out) == MaxMentions {
				break
			}
		}
	}
	return out
}

func containsStr(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

// mentionGate: when each sender last rang each player, so a sender can't ring the same one over and over.
type mentionGate struct {
	mu   sync.Mutex
	last map[string]time.Time
}

var mentionRings mentionGate

// allow: whether from may ring to now (and, if so, counts it).
func (g *mentionGate) allow(from, to string, now time.Time) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.last == nil {
		g.last = map[string]time.Time{}
	}
	key := from + ">" + to
	if at, ok := g.last[key]; ok && now.Sub(at) < mentionGap {
		return false
	}
	// Forget the old pairs now and then, on the way (no ticker).
	if len(g.last) > 2000 {
		for k, at := range g.last {
			if now.Sub(at) >= mentionGap {
				delete(g.last, k)
			}
		}
	}
	g.last[key] = now
	return true
}

// mentioned: a player named in a message, as found.
type mentioned struct {
	Sim, Username, Commune string
	BornAt                 int64
	Apps                   []string
}

// resolveMentions: the players behind the names: a username's latest Sim, not one of mine, nobody blocked either way.
func resolveMentions(ctx context.Context, db queryer, me string, names []string) ([]mentioned, error) {
	if len(names) == 0 {
		return nil, nil
	}
	rows, err := db.Query(ctx, `SELECT x.id, x.username, x.commune, x.born_at, x.apps FROM (
			SELECT DISTINCT ON (u.id) s.id, lower(u.username) AS username, s.commune, s.born_at, s.apps
			FROM users u JOIN sims s ON s.user_id = u.id
			WHERE lower(u.username) = ANY($2) AND u.id <> (SELECT user_id FROM sims WHERE id = $1)
			ORDER BY u.id, s.last_tick DESC) x
		WHERE NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $1 AND k.blocked = x.id) OR (k.sim = x.id AND k.blocked = $1))`, me, names)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []mentioned
	for rows.Next() {
		var m mentioned
		if err := rows.Scan(&m.Sim, &m.Username, &m.Commune, &m.BornAt, &m.Apps); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	// In the message's order.
	ordered := make([]mentioned, 0, len(out))
	for _, n := range names {
		for _, m := range out {
			if m.Username == n {
				ordered = append(ordered, m)
			}
		}
	}
	return ordered, rows.Err()
}

// canReadRoom: whether a Sim named can read the room: « Tout Babi » everyone with Gbairai, a commune's
// room those in it now.
func (m mentioned) canReadRoom(ctx context.Context, room string) bool {
	if room != "babi" && m.Commune != room {
		return false
	}
	s := Sim{ID: m.Sim, BornAt: m.BornAt, Apps: m.Apps, GameMinutes: game.MinuteOf(time.Now())}
	return friendsGbairai(ctx, &s) == nil
}

// mentionExcerptOf: the start of the message, for the notification.
func mentionExcerptOf(body string) string {
	body = strings.Join(strings.Fields(body), " ")
	r := []rune(body)
	if len(r) <= mentionExcerpt {
		return body
	}
	return strings.TrimSpace(string(r[:mentionExcerpt])) + "…"
}

// mentionGrin: the players a new message names, kept on it, and told. Returns their usernames.
func (h *Handler) mentionGrin(ctx context.Context, me, room string, id int64, body string) []string {
	if !mentionsOpen(ctx) {
		return nil
	}
	names := parseMentions(body)
	if len(names) == 0 {
		return nil
	}
	found, err := resolveMentions(ctx, h.DB, me, names)
	if err != nil || len(found) == 0 {
		return nil
	}
	kept := make([]string, len(found))
	for i, m := range found {
		kept[i] = m.Username
	}
	if _, err := h.DB.Exec(ctx, `UPDATE grin SET mentions = $2 WHERE id = $1`, id, kept); err != nil {
		return nil
	}
	var name string
	_ = h.DB.QueryRow(ctx, `SELECT first_name FROM sims WHERE id = $1`, me).Scan(&name)
	kind := "babi"
	if room != "babi" {
		kind = "commune"
	}
	text := mentionExcerptOf(body)
	now := time.Now()
	for _, m := range found {
		if !m.canReadRoom(ctx, room) || !mentionRings.allow(me, m.Sim, now) {
			continue
		}
		h.Push.ToSim(m.Sim, push.Message{Title: "Babi Life · Grin", Body: fmt.Sprintf("%s t'a mentionné·e au grin : « %s »", name, text), URL: fmt.Sprintf("/jeu?grin=%s&msg=%d", kind, id), Tag: "grin-" + me})
		h.notify(m.Sim, map[string]any{"t": "mention", "room": kind, "id": id, "name": name, "text": text})
	}
	return kept
}

// MentionPick is a player the box suggests after « @ ».
type MentionPick struct {
	Sim       string `json:"sim"`
	Username  string `json:"username"`
	FirstName string `json:"firstName"`
	Gender    string `json:"gender"`
	Look      Look   `json:"look"`
	Friend    bool   `json:"friend"`
	// Recent: wrote in this room lately.
	Recent bool `json:"recent"`
}

// peopleQuota: the box's searches, per account and minute (in memory).
type peopleQuota struct {
	mu    sync.Mutex
	start time.Time
	n     map[string]int
}

var peopleAsked peopleQuota

func (q *peopleQuota) take(user string, now time.Time) bool {
	q.mu.Lock()
	defer q.mu.Unlock()
	if now.Sub(q.start) >= time.Minute || q.n == nil {
		q.start, q.n = now, map[string]int{}
	}
	if q.n[user] >= peoplePerMinute {
		return false
	}
	q.n[user]++
	return true
}

// mentionQuery: what's typed after « @ », as a LIKE prefix (a username's characters only, « _ » escaped).
func mentionQuery(q string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(q)) {
		if !usernameRune(r) {
			continue
		}
		if r == '_' {
			b.WriteByte('\\')
		}
		b.WriteRune(r)
		if b.Len() >= 30 {
			break
		}
	}
	return b.String()
}

// grinPeople: GET ?room=&q=: who « @q » may name: who wrote in the room lately first, then friends, then any player by username.
func (h *Handler) grinPeople(w http.ResponseWriter, r *http.Request) {
	if !mentionsOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	if !peopleAsked.take(auth.UserID(r.Context()), time.Now()) {
		httpx.Error(w, http.StatusTooManyRequests, errPeopleTooFast.Error())
		return
	}
	room, err := h.grinRoom(r, me, r.URL.Query().Get("room"))
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	q := mentionQuery(r.URL.Query().Get("q"))
	rows, err := h.DB.Query(r.Context(), `WITH cand AS (
			SELECT g.sim AS id, max(g.id) AS recent FROM grin g
			WHERE g.room = $2 AND g.sim IS NOT NULL AND NOT g.hidden AND g.created_at > now() - interval '2 days' GROUP BY g.sim
			UNION ALL
			SELECT CASE WHEN b.sim_a = $1 THEN b.sim_b ELSE b.sim_a END, 0 FROM bonds b WHERE (b.sim_a = $1 OR b.sim_b = $1) AND b.friends
			UNION ALL
			(SELECT s.id, 0 FROM users u JOIN sims s ON s.user_id = u.id
				WHERE $3 <> '' AND lower(u.username) LIKE $3 || '%' ESCAPE '\' ORDER BY s.last_tick DESC LIMIT 30)
		), agg AS (SELECT id, max(recent) AS recent FROM cand GROUP BY id)
		SELECT s.id, u.username, s.first_name, s.gender, s.look, COALESCE(b.friends, false), a.recent > 0
		FROM agg a JOIN sims s ON s.id = a.id JOIN users u ON u.id = s.user_id
			LEFT JOIN bonds b ON b.sim_a = LEAST(s.id, $1::uuid) AND b.sim_b = GREATEST(s.id, $1::uuid)
		WHERE COALESCE(u.username, '') <> '' AND s.user_id <> (SELECT user_id FROM sims WHERE id = $1)
			AND ($3 = '' OR lower(u.username) LIKE $3 || '%' ESCAPE '\' OR lower(s.first_name) LIKE $3 || '%' ESCAPE '\')
			AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $1 AND k.blocked = s.id) OR (k.sim = s.id AND k.blocked = $1))
		ORDER BY a.recent > 0 DESC, a.recent DESC, COALESCE(b.friends, false) DESC, s.last_tick DESC
		LIMIT 12`, me, room, q)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	defer rows.Close()
	out := []MentionPick{}
	for rows.Next() {
		var p MentionPick
		if err := rows.Scan(&p.Sim, &p.Username, &p.FirstName, &p.Gender, &p.Look, &p.Friend, &p.Recent); err != nil {
			h.gbairaiFail(w, err)
			return
		}
		// A player with two Sims: once.
		if !slicesHasUser(out, p.Username) && len(out) < 8 {
			out = append(out, p)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"people": out})
}

func slicesHasUser(list []MentionPick, username string) bool {
	for _, p := range list {
		if strings.EqualFold(p.Username, username) {
			return true
		}
	}
	return false
}
