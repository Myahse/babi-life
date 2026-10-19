package sims

import (
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"math/rand/v2"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Tikitoko, the short-video app: the Sim films something (a dance, a garba
// tasting, the stands at the stadium…), the app takes the picture from the
// game, and it's seen by every player. Beyond the players' own follows and
// likes, the game brings an audience: views and new fans, more when the
// theme fits where the Sim is (a dance at the club, the match at the
// stadium), more with fans already, more for an ambianceur. From 1 000 fans
// the brands pay for each post: the Sim becomes an influenceur. To keep it
// safe for everyone: the pictures come from the game only, the captions are
// cleaned like messages, there are no comments (likes and follows only),
// and a post can be reported.

type tikiTheme struct {
	ID, Label string
	Appeal    float64
	Places    []string // place kinds where it works best
}

var tikiThemes = []tikiTheme{
	{"danse", "Challenge de danse", 1.2, []string{"club", "maquis", game.StadiumKind}},
	{"garba", "Dégustation : ce qu'on mange à Babi", 1.0, []string{"maquis", "restaurant", "market"}},
	{"stade", "L'ambiance au stade", 1.3, []string{game.StadiumKind, "sport"}},
	{"vlog", "Vlog dans mon quartier", 0.8, nil},
	{"zoo", "Les animaux du zoo", 1.1, []string{"zoo"}},
	{"humour", "Sketch humour", 1.1, nil},
	{"mode", "Mon look du jour", 0.9, []string{"boutique", "couture", "salon", "barbier", "mall"}},
	{"sport", "Ma séance de sport", 0.9, []string{"gym", "sport", "beach"}},
}

// TikiTiers: the names of the audience's levels.
var TikiTiers = []struct {
	Fans  int
	Label string
}{{0, "Débutant·e"}, {1000, "Créateur·rice"}, {10000, "Influenceur·se"}, {100000, "Star de Babi"}}

func tikiTier(fans int) string {
	t := TikiTiers[0].Label
	for _, x := range TikiTiers {
		if fans >= x.Fans {
			t = x.Label
		}
	}
	return t
}

const (
	TikiMinutes  = 30 // filming and editing
	TikiPerDay   = 10 // posts a real day, at most
	TikiDealFrom = 1000
)

var (
	errTikiTheme   = errors.New("choisis ce que tu filmes")
	errTikiTooMany = errors.New("10 vidéos aujourd'hui, c'est assez : reviens demain")
	errNoPost      = errors.New("vidéo introuvable")
)

// tikiAudience: what a post brings, from the Sim's fans, the theme, where
// it's filmed and the Sim's traits: views, likes, new fans and the brand's pay.
func tikiAudience(fans int, th tikiTheme, placeKind string, traits []string, rng *rand.Rand) (views, likes, newFans, pay int) {
	fit := 1.0
	if slices.Contains(th.Places, placeKind) {
		fit = 1.8
	}
	if slices.Contains(traits, "ambianceur") {
		fit *= 1.25
	}
	luck := 0.6 + rng.Float64()*0.8
	// One post in twenty goes viral.
	if rng.IntN(20) == 0 {
		luck *= 6
	}
	base := 40 + float64(fans)*1.6
	views = int(base * th.Appeal * fit * luck)
	likes = int(float64(views) * (0.06 + rng.Float64()*0.06))
	// A first post brings a few (the friends, the quarter); then about one view in twenty.
	newFans = max(1, int(math.Round(float64(views)*0.05*fit/(1+float64(fans)/50000))))
	if fans >= TikiDealFrom {
		pay = min(100000, fans/4)
	}
	return views, likes, newFans, pay
}

func findTheme(id string) (tikiTheme, bool) {
	for _, t := range tikiThemes {
		if t.ID == id {
			return t, true
		}
	}
	return tikiTheme{}, false
}

func tikiRand(parts ...string) *rand.Rand {
	f := fnv.New64a()
	for _, p := range parts {
		_, _ = f.Write([]byte(p))
	}
	return rand.New(rand.NewPCG(f.Sum64(), uint64(time.Now().UnixNano())))
}

// tikiPost: film and post. It's an activity of half an hour.
func (h *Handler) tikiPost(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Photo   string `json:"photo"`
		Caption string `json:"caption"`
		Theme   string `json:"theme"`
		PlaceID string `json:"placeId"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	raw, mime, err := decodePhoto(req.Photo)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	caption, err := cleanCaption(req.Caption)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	th, ok := findTheme(req.Theme)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, errTikiTheme.Error())
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := needApp(s, "tikitoko"); err != nil {
			return game.Outcome{}, nil, err
		}
		var today int
		_ = tx.QueryRow(ctx, `SELECT count(*) FROM tiki_posts WHERE sim = $1 AND created_at > now() - interval '24 hours'`, s.ID).Scan(&today)
		if today >= TikiPerDay {
			return game.Outcome{}, nil, errTikiTooMany
		}
		// Where it's filmed: a place of the Sim's commune (the app sends the nearest).
		kind, placeName := "", "Dans la rue"
		if city, cm, p, ok := world.FindPlace(req.PlaceID); ok && city.ID == s.City && cm.ID == s.Commune {
			kind, placeName = p.Kind, p.Name
		}
		var fans int
		if err := tx.QueryRow(ctx, `SELECT tiki_fans FROM sims WHERE id = $1`, s.ID).Scan(&fans); err != nil {
			return game.Outcome{}, nil, err
		}
		views, likes, newFans, pay := tikiAudience(fans, th, kind, s.Traits, tikiRand(s.ID, th.ID))
		it := game.Interaction{ID: "tiki-" + th.ID, Label: "Tourner une vidéo Tikitoko : " + th.Label, Icon: "camera", Minutes: TikiMinutes, Cost: -pay, Effect: game.Needs{Fun: 12, Social: 6, Energy: -6}}
		if err := s.start(it, "tikitoko", "tikitoko", placeName, nil, ""); err != nil {
			return game.Outcome{}, nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO tiki_posts (sim, image, mime, caption, theme, place, views, likes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			s.ID, raw, mime, caption, th.ID, placeName, views, likes); err != nil {
			return game.Outcome{}, nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE sims SET tiki_fans = tiki_fans + $2 WHERE id = $1`, s.ID, newFans); err != nil {
			return game.Outcome{}, nil, err
		}
		text := fmt.Sprintf("Vidéo postée sur Tikitoko : %s. Elle va faire environ %s vues, +%d fans.", th.Label, compact(views), newFans)
		events := []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}
		if pay > 0 {
			events = append(events, Event{Kind: "money", Text: fmt.Sprintf("Partenariat : une marque te paie %d Djai pour cette vidéo.", pay), Money: pay, GameTime: s.GameMinutes})
		}
		before, after := tikiTier(fans), tikiTier(fans+newFans)
		if after != before {
			events = append(events, Event{Kind: "social", Text: fmt.Sprintf("Sur Tikitoko, tu passes « %s » !", after), GameTime: s.GameMinutes})
		}
		return game.Outcome{Text: text, Money: pay}, events, nil
	})
}

// compact: 1 234 → « 1,2 k ».
func compact(n int) string {
	switch {
	case n >= 1_000_000:
		return strconv.FormatFloat(math.Round(float64(n)/100_000)/10, 'f', -1, 64) + " M"
	case n >= 1000:
		return strconv.FormatFloat(math.Round(float64(n)/100)/10, 'f', -1, 64) + " k"
	}
	return strconv.Itoa(n)
}

// TikiPost is a video in a feed.
type TikiPost struct {
	ID       int64       `json:"id"`
	Author   StoryAuthor `json:"author"`
	Handle   string      `json:"handle"` // @pseudo
	Fans     int         `json:"fans"`
	Tier     string      `json:"tier"`
	Followed bool        `json:"followed"`
	Mine     bool        `json:"mine"`
	Caption  string      `json:"caption"`
	Theme    string      `json:"theme"`
	Place    string      `json:"place"`
	Views    int         `json:"views"`
	Likes    int         `json:"likes"`
	Liked    bool        `json:"liked"`
	Comments int         `json:"comments"`
	Saves    int         `json:"saves"`
	Saved    bool        `json:"saved"`
	Shares   int         `json:"shares"`
	At       time.Time   `json:"at"`
}

// The game's audience comes over six hours, not at once.
func grown(n int, at, now time.Time) int {
	k := min(1, now.Sub(at).Hours()/6)
	return int(float64(n) * (0.08 + 0.92*k))
}

// tikiFeed: ?tab=pour-toi (every player's videos, the liked and fresh ones
// first, as TikTok ranks them), abonnements (the creators one follows),
// favoris (the videos one saved), auteur&author= (one creator's videos).
func (h *Handler) tikiFeed(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	tab, author := r.URL.Query().Get("tab"), r.URL.Query().Get("author")
	switch tab {
	case "abonnements", "favoris", "auteur":
	default:
		tab = "pour-toi"
	}
	ctx := r.Context()
	rows, err := h.DB.Query(ctx, `
		SELECT p.id, o.id, o.first_name, o.gender, o.look, COALESCE(u.username, ''),
			o.tiki_fans + (SELECT count(*) FROM tiki_follows f WHERE f.followed = o.id),
			EXISTS(SELECT 1 FROM tiki_follows f WHERE f.follower = $1 AND f.followed = o.id),
			p.caption, p.theme, p.place, p.views, p.likes, (SELECT count(*) FROM tiki_likes l WHERE l.post = p.id),
			EXISTS(SELECT 1 FROM tiki_likes l WHERE l.post = p.id AND l.sim = $1),
			(SELECT count(*) FROM tiki_comments c WHERE c.post = p.id),
			(SELECT count(*) FROM tiki_saves v WHERE v.post = p.id),
			EXISTS(SELECT 1 FROM tiki_saves v WHERE v.post = p.id AND v.sim = $1),
			p.shares, p.created_at
		FROM tiki_posts p JOIN sims o ON o.id = p.sim JOIN users u ON u.id = o.user_id
		WHERE NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $1 AND k.blocked = p.sim) OR (k.sim = p.sim AND k.blocked = $1))
			AND CASE $2::text
				WHEN 'abonnements' THEN EXISTS(SELECT 1 FROM tiki_follows f WHERE f.follower = $1 AND f.followed = p.sim)
				WHEN 'favoris' THEN EXISTS(SELECT 1 FROM tiki_saves v WHERE v.post = p.id AND v.sim = $1)
				WHEN 'auteur' THEN p.sim::text = $3
				ELSE true END
		ORDER BY CASE WHEN $2::text = 'pour-toi'
				THEN (p.likes + 1 + 5 * (SELECT count(*) FROM tiki_likes l WHERE l.post = p.id)) / power(extract(epoch FROM now() - p.created_at) / 3600 + 2, 1.3)
				ELSE 0 END DESC,
			p.created_at DESC
		LIMIT 60`, me, tab, author)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	defer rows.Close()
	now := time.Now()
	out := []TikiPost{}
	for rows.Next() {
		var p TikiPost
		var players int
		if err := rows.Scan(&p.ID, &p.Author.ID, &p.Author.FirstName, &p.Author.Gender, &p.Author.Look, &p.Handle, &p.Fans, &p.Followed,
			&p.Caption, &p.Theme, &p.Place, &p.Views, &p.Likes, &players, &p.Liked, &p.Comments, &p.Saves, &p.Saved, &p.Shares, &p.At); err != nil {
			h.gbairaiFail(w, err)
			return
		}
		p.Mine = p.Author.ID == me
		p.Tier = tikiTier(p.Fans)
		p.Handle = tikiHandle(p.Handle, p.Author.FirstName)
		p.Views, p.Likes = grown(p.Views, p.At, now)+players, grown(p.Likes, p.At, now)+players
		// The game's audience comments too (tikisocial.go).
		p.Comments += npcComments(p.Views)
		p.Saves += p.Likes / 25
		p.Shares += p.Likes / 40
		out = append(out, p)
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) tikiMe(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	var fans, follows, posts, views int
	err = h.DB.QueryRow(r.Context(), `SELECT tiki_fans, (SELECT count(*) FROM tiki_follows WHERE followed = $1),
		(SELECT count(*) FROM tiki_posts WHERE sim = $1), (SELECT COALESCE(sum(views), 0) FROM tiki_posts WHERE sim = $1)
		FROM sims WHERE id = $1`, me).Scan(&fans, &follows, &posts, &views)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	total := fans + follows
	next := 0
	for _, t := range TikiTiers {
		if t.Fans > total {
			next = t.Fans
			break
		}
	}
	themes := make([]map[string]string, len(tikiThemes))
	for i, t := range tikiThemes {
		themes[i] = map[string]string{"id": t.ID, "label": t.Label}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"fans": total, "players": follows, "posts": posts, "views": views, "tier": tikiTier(total), "next": next, "dealFrom": TikiDealFrom, "themes": themes})
}

func (h *Handler) tikiPhoto(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "post"), 10, 64)
	var raw []byte
	var mime string
	err = h.DB.QueryRow(r.Context(), `SELECT p.image, p.mime FROM tiki_posts p WHERE p.id = $1
		AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $2 AND k.blocked = p.sim) OR (k.sim = p.sim AND k.blocked = $2))`, id, me).Scan(&raw, &mime)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, errNoPost.Error())
		return
	}
	servePhoto(w, raw, mime)
}

func (h *Handler) tikiLike(w http.ResponseWriter, r *http.Request) {
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
	id, _ := strconv.ParseInt(chi.URLParam(r, "post"), 10, 64)
	if req.Liked {
		_, err = h.DB.Exec(r.Context(), `INSERT INTO tiki_likes (post, sim) SELECT id, $2 FROM tiki_posts WHERE id = $1 AND sim <> $2 ON CONFLICT DO NOTHING`, id, me)
	} else {
		_, err = h.DB.Exec(r.Context(), `DELETE FROM tiki_likes WHERE post = $1 AND sim = $2`, id, me)
	}
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"liked": req.Liked})
}

func (h *Handler) tikiFollow(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Follow bool `json:"follow"`
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
	other := chi.URLParam(r, "other")
	if other == me {
		httpx.Error(w, http.StatusBadRequest, "tu ne peux pas t'abonner à toi-même")
		return
	}
	if req.Follow {
		_, err = h.DB.Exec(r.Context(), `INSERT INTO tiki_follows (follower, followed) SELECT $1, id FROM sims WHERE id = $2 ON CONFLICT DO NOTHING`, me, other)
	} else {
		_, err = h.DB.Exec(r.Context(), `DELETE FROM tiki_follows WHERE follower = $1 AND followed = $2`, me, other)
	}
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"follow": req.Follow})
}

func (h *Handler) tikiDelete(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "post"), 10, 64)
	if _, err := h.DB.Exec(r.Context(), `DELETE FROM tiki_posts WHERE id = $1 AND sim = $2`, id, me); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// tikiReport: flag a post; its author is blocked for the reporter (gone from the feed).
func (h *Handler) tikiReport(w http.ResponseWriter, r *http.Request) {
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
	id, _ := strconv.ParseInt(chi.URLParam(r, "post"), 10, 64)
	var owner, caption string
	if err := h.DB.QueryRow(ctx, `SELECT sim, caption FROM tiki_posts WHERE id = $1`, id).Scan(&owner, &caption); err != nil || owner == me {
		httpx.Error(w, http.StatusNotFound, errNoPost.Error())
		return
	}
	if _, err := h.DB.Exec(ctx, `INSERT INTO reports (reporter, reported, post_id, excerpt, reason) VALUES ($1, $2, $3, $4, $5)`, me, owner, id, caption, req.Reason); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	_, _ = h.DB.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING`, me, owner)
	httpx.JSON(w, http.StatusOK, map[string]string{"text": "Merci. C'est signalé : on va regarder. Tu ne verras plus ses vidéos."})
}
