package sims

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Babi Direct, in the grin's « Tout Babi » room: what happens in the game,
// posted by the game itself, so everyone sees it. The communes' happenings
// (a wedding, a traffic jam, a power cut… a few per two-hour slot, each from
// a different commune), the stadiums' matches and concerts (the kick-off,
// the final score), the Babi league's results on Bet225 (a round every two hours),
// and the players' big moments: a baby born in Babi (a new Sim), a
// promotion, a house built or moved into, a new level on Tikitoko. Only what
// the game already shows of a player (the first name, the commune): no
// money, no message, nothing private.
//
// Nothing runs while nobody looks: the street, the stadiums and the virtual
// league are pure functions of the clock (game.HappeningAt, StadiumAgenda,
// MatchIn), so reading the feed catches up on what was missed (at most every
// 20 s per server, the last three hours at most), and the key makes each
// post once, whichever server writes it. The moments are written when they
// happen. Posts older than a week go. Players react with one emoji each.

const (
	DirectName     = "Babi Direct"
	DirectPage     = 50
	DirectBackfill = 3 * time.Hour
	DirectEvery    = 20 * time.Second
	// DirectPerSlot: the happenings told per two-hour slot, DirectGap minutes apart.
	DirectPerSlot = 3
	DirectGap     = 30
	// DirectBetEvery: one Bet225 round in this many is told (a round every
	// quarter of an hour: every two hours).
	DirectBetEvery = 8
)

// DirectReactions: what one can answer a post with.
var DirectReactions = []string{"❤️", "😂", "😮", "🔥", "🙏"}

var errNoDirectPost = errors.New("publication introuvable")

// directItem is a post before it's stored.
type directItem struct {
	Key, Kind, Emoji, Body, Commune string
	Sim                             string // a player's moment: whose
	At                              time.Time
}

// happeningEmoji: the picture in front of each happening.
var happeningEmoji = map[string]string{
	"mariage": "💍", "match": "📺", "concert": "🎶", "pluie": "🌧️", "delestage": "🔌", "embouteillage": "🚗", "controle": "👮",
	"foot": "⚽", "bapteme": "👶", "anniversaire": "🎂", "funerailles": "🕯️", "association": "🤝", "tontine": "💰", "salubrite": "🧹",
	"ouverture-boutique": "🛍️", "ligue1": "🏟️", "basket": "🏀", "inondation": "🌊", "femua": "🎤", "abissa": "🥁", "carnaval-bouake": "🎭",
	"fete-masques": "🎭", "fete-independance": "🇨🇮", "fete-paix": "🕊️", "fete-travail": "🛠️", "noel": "🎄", "nouvel-an": "🎆", "korite": "🌙", "tabaski": "🐑",
}

// inCommune: « à Yopougon », « au Plateau ».
func inCommune(name string) string {
	if name == "Plateau" {
		return "au Plateau"
	}
	return "à " + name
}

func directHash(s string) uint64 {
	f := fnv.New64a()
	f.Write([]byte(s))
	return f.Sum64()
}

// happeningPosts: the happenings that start in the slots overlapping
// (from, to], at most DirectPerSlot a slot, each a different happening in a
// different commune (the festivals and holidays first, then by the luck of
// the slot), told DirectGap minutes apart while they're on.
// (A game minute is a real minute: a slot is two real hours.)
func happeningPosts(from, to int64) []directItem {
	var out []directItem
	type cand struct {
		h       game.Happening
		city    world.City
		commune world.Commune
		roll    uint64
	}
	for slot := from / game.HappeningMinutes; slot*game.HappeningMinutes <= to; slot++ {
		start := slot * game.HappeningMinutes
		var cands []cand
		for _, c := range world.Cities {
			for _, cm := range c.Communes {
				h, s, ok := game.HappeningAt(c.ID, cm.ID, start)
				if ok && s == start {
					cands = append(cands, cand{h, c, cm, directHash(fmt.Sprint(cm.ID, slot))})
				}
			}
		}
		slices.SortFunc(cands, func(a, b cand) int {
			if a.h.Weight != b.h.Weight {
				return b.h.Weight - a.h.Weight
			}
			if a.roll < b.roll {
				return -1
			}
			return 1
		})
		seen := map[string]bool{}
		k := 0
		for _, c := range cands {
			if k >= DirectPerSlot {
				break
			}
			if seen[c.h.ID] {
				continue
			}
			seen[c.h.ID] = true
			at := start + int64(k*DirectGap)
			k++
			if at <= from || at > to {
				continue
			}
			emoji := happeningEmoji[c.h.ID]
			if emoji == "" {
				emoji = "📍"
			}
			out = append(out, directItem{
				Key: fmt.Sprintf("quartier:%s:%s:%d", c.city.ID, c.commune.ID, slot), Kind: "quartier", Emoji: emoji, Commune: c.commune.ID,
				Body: fmt.Sprintf("%s %s en ce moment ! %s", c.h.Label, inCommune(c.commune.Name), c.h.Text), At: game.TimeOf(at),
			})
		}
	}
	return out
}

// stadiums: the big stadiums of the map.
func stadiums() []world.Place {
	var out []world.Place
	for _, c := range world.Cities {
		for _, cm := range c.Communes {
			for _, p := range cm.Places {
				if p.Kind == game.StadiumKind {
					out = append(out, p)
				}
			}
		}
	}
	return out
}

// stadiumPosts: a match's kick-off and final score, a concert's start, in (from, to].
func stadiumPosts(from, to int64) []directItem {
	var out []directItem
	for _, p := range stadiums() {
		_, cm, _, _ := world.FindPlace(p.ID)
		for _, e := range game.StadiumAgenda(p.ID, to, from-game.FullTime, to+1) {
			if e.Kind == "concert" {
				if e.Start > from && e.Start <= to {
					out = append(out, directItem{Key: fmt.Sprintf("stade:%s:%d", p.ID, e.Start), Kind: "stade", Emoji: "🎤", Commune: cm.ID,
						Body: fmt.Sprintf("%s en concert au %s (%s) : ça commence ! Les billets sont au guichet.", e.Artist, p.Name, e.Genre), At: game.TimeOf(e.Start)})
				}
				continue
			}
			if e.Start > from && e.Start <= to {
				out = append(out, directItem{Key: fmt.Sprintf("stade:%s:%d", p.ID, e.Start), Kind: "stade", Emoji: "🏟️", Commune: cm.ID,
					Body: fmt.Sprintf("Coup d'envoi au %s : %s. Championnat de Babi !", p.Name, e.Title), At: game.TimeOf(e.Start)})
			}
			if end := e.Start + game.FullTime; end > from && end <= to {
				home, away := game.MatchGoals(e)
				out = append(out, directItem{Key: fmt.Sprintf("stade:%s:%d:fin", p.ID, e.Start), Kind: "stade", Emoji: "🏁", Commune: cm.ID,
					Body: fmt.Sprintf("Fin du match au %s : %s %d – %d %s.", p.Name, e.Home, len(home), len(away), e.Away), At: game.TimeOf(end)})
			}
		}
	}
	return out
}

// betPosts: the Babi league's results on Bet225, one round in DirectBetEvery, as it ends in (from, to].
func betPosts(from, to time.Time) []directItem {
	var out []directItem
	step := int64(game.RoundMinutes * 60)
	for round := from.Unix()/step - 1; round*step <= to.Unix(); round++ {
		if round%DirectBetEvery != 0 {
			continue
		}
		end := time.Unix(round*step+(game.OpenMinutes+game.PlayMinutes)*60, 0)
		if !end.After(from) || end.After(to) {
			continue
		}
		var lines []string
		for _, m := range game.Round("babi", round, end.Unix(), 0) {
			if m.Score != nil {
				lines = append(lines, fmt.Sprintf("%s %d – %d %s", m.Home, m.Score[0], m.Score[1], m.Away))
			}
		}
		if len(lines) == 0 {
			continue
		}
		out = append(out, directItem{Key: fmt.Sprintf("bet:%d", round), Kind: "bet", Emoji: "🎰",
			Body: "Foot virtuel sur Bet225, les résultats :\n" + strings.Join(lines, "\n"), At: end})
	}
	return out
}

// directPosts: everything the game tells between two instants, oldest first.
func directPosts(from, to time.Time) []directItem {
	f, t := game.MinuteOf(from), game.MinuteOf(to)
	out := append(happeningPosts(f, t), stadiumPosts(f, t)...)
	out = append(out, betPosts(from, to)...)
	slices.SortStableFunc(out, func(a, b directItem) int { return a.At.Compare(b.At) })
	return out
}

// The players' moments, as posts.

func bornWord(gender, m, f string) string {
	if gender == "femme" {
		return f
	}
	return m
}

func communeName(city, commune string) string {
	if _, cm, ok := world.FindCommune(city, commune); ok && cm.Name != "" {
		return cm.Name
	}
	return commune
}

// birthMoment: a new Sim is born in Babi.
func birthMoment(s Sim) directItem {
	return directItem{Key: "naissance:" + s.ID, Kind: "joueur", Emoji: "👶", Sim: s.ID, Commune: s.HomeCommune,
		Body: fmt.Sprintf("%s %s : bienvenue à %s dans Babi !", bornWord(s.Gender, "Un petit garçon est né", "Une petite fille est née"), inCommune(communeName(s.HomeCity, s.HomeCommune)), s.FirstName)}
}

// promotionMoment: the Sim has gone up a level at work.
func promotionMoment(s *Sim) (directItem, bool) {
	c, ok := game.FindCareer(s.Career)
	if !ok || s.CareerLevel <= 0 || s.CareerLevel >= len(c.Levels) {
		return directItem{}, false
	}
	return directItem{Key: fmt.Sprintf("promotion:%s:%s:%d", s.ID, s.Career, s.CareerLevel), Kind: "joueur", Emoji: "💼", Sim: s.ID, Commune: s.Commune,
		Body: fmt.Sprintf("Promotion ! %s devient %s (%s). Bravo !", s.FirstName, c.Levels[s.CareerLevel].Title, c.Label)}, true
}

// houseMoment: built (the masons are done) or moved in, on a lot.
func houseMoment(s *Sim, moved bool, city, commune string) directItem {
	where := inCommune(communeName(city, commune))
	if moved {
		return directItem{Key: fmt.Sprintf("maison:%s:%s:%s", s.ID, city, commune), Kind: "joueur", Emoji: "🏠", Sim: s.ID, Commune: commune,
			Body: fmt.Sprintf("%s emménage dans sa propre maison %s. Plus de loyer ! Chez soi, c'est doux.", s.FirstName, where)}
	}
	return directItem{Key: fmt.Sprintf("chantier:%s:%s:%s:%d", s.ID, city, commune, s.GameMinutes/(24*60)), Kind: "joueur", Emoji: "🧱", Sim: s.ID, Commune: commune,
		Body: fmt.Sprintf("%s a fini de bâtir sa maison %s. Les maçons ont bien travaillé !", s.FirstName, where)}
}

// tikiMoment: a new level on Tikitoko.
func tikiMoment(s *Sim, tier string) directItem {
	return directItem{Key: fmt.Sprintf("tiki:%s:%s", s.ID, tier), Kind: "joueur", Emoji: "📱", Sim: s.ID, Commune: s.Commune,
		Body: fmt.Sprintf("%s passe « %s » sur Tikitoko ! Abonnez-vous, on dit quoi ?", s.FirstName, tier)}
}

type batcher interface {
	SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults
}

// storeDirect writes posts; one already there (same key) stays as it is.
func storeDirect(ctx context.Context, db batcher, items []directItem) error {
	if len(items) == 0 {
		return nil
	}
	b := &pgx.Batch{}
	for _, it := range items {
		var sim *string
		if it.Sim != "" {
			sim = &it.Sim
		}
		at := it.At
		if at.IsZero() {
			at = time.Now()
		}
		b.Queue(`INSERT INTO babi_direct (key, kind, emoji, body, commune, sim, at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (key) DO NOTHING`,
			it.Key, it.Kind, it.Emoji, it.Body, it.Commune, sim, at)
	}
	return db.SendBatch(ctx, b).Close()
}

// postMoments: a request's moments, once it's saved (a failure loses only the post).
func (h *Handler) postMoments(ctx context.Context, items []directItem) {
	if len(items) > 0 {
		_ = storeDirect(ctx, h.DB, items)
	}
}

var direct struct {
	sync.Mutex
	done, last time.Time
}

// catchUpDirect writes what the game told since the last time (DirectBackfill at most).
func (h *Handler) catchUpDirect(ctx context.Context) {
	now := time.Now()
	direct.Lock()
	if now.Sub(direct.last) < DirectEvery {
		direct.Unlock()
		return
	}
	direct.last = now
	from := direct.done
	direct.Unlock()
	if from.IsZero() || now.Sub(from) > DirectBackfill {
		from = now.Add(-DirectBackfill)
	}
	if err := storeDirect(ctx, h.DB, directPosts(from, now)); err != nil {
		return
	}
	_, _ = h.DB.Exec(ctx, `DELETE FROM babi_direct WHERE at < now() - interval '7 days'`)
	direct.Lock()
	if now.After(direct.done) {
		direct.done = now
	}
	direct.Unlock()
}

// DirectPost is a post of Babi Direct, as the app gets it.
type DirectPost struct {
	ID        int64          `json:"id"`
	Kind      string         `json:"kind"`
	Emoji     string         `json:"emoji"`
	Body      string         `json:"body"`
	Commune   string         `json:"commune"`
	At        time.Time      `json:"at"`
	Reactions map[string]int `json:"reactions"`
	Mine      string         `json:"mine"` // my reaction, if any
}

// directFeed: GET /sims/{id}/grin/direct — the last posts (or those after
// ?after=), oldest first; a player's moment doesn't show to someone they
// blocked or who blocked them.
func (h *Handler) directFeed(w http.ResponseWriter, r *http.Request) {
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	h.catchUpDirect(ctx)
	after, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
	rows, err := h.DB.Query(ctx, `SELECT * FROM (
		SELECT d.id, d.kind, d.emoji, d.body, d.commune, d.at,
			COALESCE((SELECT jsonb_object_agg(x.emoji, x.n) FROM (SELECT emoji, count(*) n FROM babi_direct_reactions WHERE post = d.id GROUP BY emoji) x), '{}'::jsonb),
			COALESCE((SELECT emoji FROM babi_direct_reactions WHERE post = d.id AND sim = $1), '')
		FROM babi_direct d
		WHERE d.id > $2 AND d.at <= now() + interval '1 minute'
			AND (d.sim IS NULL OR NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $1 AND k.blocked = d.sim) OR (k.sim = d.sim AND k.blocked = $1)))
		ORDER BY d.at DESC, d.id DESC LIMIT $3) x ORDER BY at, id`, me, after, DirectPage)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	defer rows.Close()
	out := []DirectPost{}
	for rows.Next() {
		var p DirectPost
		if err := rows.Scan(&p.ID, &p.Kind, &p.Emoji, &p.Body, &p.Commune, &p.At, &p.Reactions, &p.Mine); err != nil {
			h.gbairaiFail(w, err)
			return
		}
		out = append(out, p)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"name": DirectName, "reactions": DirectReactions, "posts": out})
}

// reactDirect: POST /sims/{id}/grin/direct/{post}/react {"emoji": "❤️"} —
// one reaction a player, changed by sending another, taken back with "".
func (h *Handler) reactDirect(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Emoji string `json:"emoji"`
	}
	if err := httpx.Decode(r, &req); err != nil || (req.Emoji != "" && !slices.Contains(DirectReactions, req.Emoji)) {
		httpx.Error(w, http.StatusBadRequest, "réaction invalide")
		return
	}
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	id, _ := strconv.ParseInt(chi.URLParam(r, "post"), 10, 64)
	var exists bool
	if err := h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM babi_direct WHERE id = $1)`, id).Scan(&exists); err != nil || !exists {
		httpx.Error(w, http.StatusNotFound, errNoDirectPost.Error())
		return
	}
	if req.Emoji == "" {
		_, err = h.DB.Exec(ctx, `DELETE FROM babi_direct_reactions WHERE post = $1 AND sim = $2`, id, me)
	} else {
		_, err = h.DB.Exec(ctx, `INSERT INTO babi_direct_reactions (post, sim, emoji) VALUES ($1, $2, $3) ON CONFLICT (post, sim) DO UPDATE SET emoji = $3`, id, me, req.Emoji)
	}
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	reactions := map[string]int{}
	_ = h.DB.QueryRow(ctx, `SELECT COALESCE(jsonb_object_agg(emoji, n), '{}'::jsonb) FROM (SELECT emoji, count(*) n FROM babi_direct_reactions WHERE post = $1 GROUP BY emoji) x`, id).Scan(&reactions)
	httpx.JSON(w, http.StatusOK, map[string]any{"reactions": reactions, "mine": req.Emoji})
}
