package sims

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"hash/fnv"
	"math/rand/v2"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Flashé, the snap app of the Store, built like the well-known apps of
// photos that vanish: it opens on the camera; a photo of the game (with a
// filter, a few words, stickers, the place's banner, baked by the app) sent
// to friends is seen once, a few seconds, then gone. Snaps sent both ways
// day after day light a flame (the streak), lost after a day without. The
// friends met in the game (game.Friend) snap back a few minutes later from
// where they are (no image: the app paints it, like Babigram's accounts),
// and now and then first. Stories are Gbairai's (stories.go): one's own and
// the player friends', 24 hours. Safety as elsewhere: player friends only, a
// block hides them both ways, captions are cleaned like messages, a snap can
// be reported (its photo is kept a day after it's opened, for moderation).

const (
	FlashPerDay = 60 // snaps sent a real day, at most
	FlashTo     = 10 // friends a snap goes to, at most
	// A friend met in the game snaps first now and then: one chance in flashNPCChance per slot of flashNPCSlot.
	flashNPCSlot     = 6 * time.Hour
	flashNPCChance   = 3
	flashNPCPerVisit = 3
)

var (
	errFlashTooMany = errors.New("60 snaps aujourd'hui : laisse un peu de place aux autres, reviens demain")
	errFlashNoOne   = errors.New("choisis au moins un ami (ou ta story)")
	errFlashTooWide = errors.New("10 amis à la fois, au plus")
	errFlashNoSnap  = errors.New("snap introuvable, ou déjà ouvert")
	errFlashNoNPC   = errors.New("cette personne n'est plus dans tes amis")
)

// FlashContact: a friend in Flashé, a player (id: their Sim) or one met in the game (id: "npc:" + Friend.ID).
type FlashContact struct {
	ID     string       `json:"id"`
	Name   string       `json:"name"`
	Gender string       `json:"gender"`
	Look   *Look        `json:"look,omitempty"`   // a player's
	Friend *game.Friend `json:"friend,omitempty"` // one met in the game: the app draws their face
	Online bool         `json:"online,omitempty"`
	// New: their snaps not opened yet; Last: the latest either way; Streak: the flame's days.
	New    int        `json:"new"`
	Last   *FlashLast `json:"last,omitempty"`
	Streak int        `json:"streak"`
}

type FlashLast struct {
	Mine   bool      `json:"mine"`
	Opened bool      `json:"opened"`
	At     time.Time `json:"at"`
}

// FlashSnap: a snap opened, to be seen now: a player's photo, or a scene the app paints.
type FlashSnap struct {
	ID      int64     `json:"id"`
	From    string    `json:"from"`
	Photo   string    `json:"photo,omitempty"`
	Scene   string    `json:"scene,omitempty"`
	Seed    int64     `json:"seed,omitempty"`
	Caption string    `json:"caption"`
	Place   string    `json:"place,omitempty"`
	Seconds int       `json:"seconds"`
	At      time.Time `json:"at"`
}

func (h *Handler) flashFail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errFlashNoSnap):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, errFlashTooMany):
		httpx.Error(w, http.StatusTooManyRequests, err.Error())
	default:
		h.gbairaiFail(w, err)
	}
}

// flashSim: the player's Sim with Flashé, read whole (its friends met in the game with it).
func (h *Handler) flashSim(r *http.Request) (Sim, error) {
	id, err := h.appSim(r, "flashe")
	if err != nil {
		return Sim{}, err
	}
	return scanSim(h.DB.QueryRow(r.Context(), `SELECT `+simColumns+` FROM sims WHERE id = $1`, id))
}

// flashFriends: the friends met in the game one can snap (the bande isn't anyone's).
func flashFriends(s *Sim) []game.Friend {
	out := []game.Friend{}
	for _, f := range s.Friends {
		if !f.Gang {
			out = append(out, f)
		}
	}
	return out
}

// flashScenes: what a friend met in the game snaps, by the hour: the studio is a selfie.
func flashScene(f game.Friend, at time.Time, rng *rand.Rand) string {
	h := at.Hour() // Abidjan is on UTC
	if h >= 20 || h < 4 {
		return []string{"nuit", "maquis", "studio", "maquis"}[rng.IntN(4)]
	}
	own := gramPersonScenes[(f.Seed%len(gramPersonScenes)+len(gramPersonScenes))%len(gramPersonScenes)]
	if rng.IntN(5) < 2 {
		return "studio"
	}
	return own[rng.IntN(len(own))]
}

// What a friend met in the game writes on a snap: back to one taken at a kind of place, or of their own.
var (
	flashBack = map[string][]string{
		"maquis":     {"Tu es au maquis sans moi ?? 😤", "Garde-moi une place, j'arrive 🍻", "Le poulet braisé là, c'est pour qui ? 😋", "Ambiance maquis 🔥", "Commande l'alloco pour moi 😂"},
		"club":       {"Babi by night 🕺", "Tu vas danser jusqu'au matin hein 😂", "Le DJ là est chaud 🔥", "Envoie la localisation 👀"},
		"beach":      {"La plage là, ça donne envie 🌊", "Et moi je suis au bureau 😩", "Bassam ou Port-Bouët ? 🏖️", "Le soleil là ☀️😍"},
		"stadium":    {"Allez les Éléphants ! 🐘", "C'est quel score ? ⚽", "Je regarde à la télé 📺"},
		"restaurant": {"Ça a l'air bon dêh 😋", "Tu manges seul·e ? 😂", "Envoie l'adresse 👀"},
		"market":     {"Achète-moi quelque chose 😂", "Le marché là est chaud aujourd'hui", "Négocie bien hein 💪"},
	}
	flashOwn     = []string{"On dit quoi ? 😄", "C'est comment ?", "Y a quoi ?", "Tu es dans quoi là ?", "Wê wê wê 😂", "Môgô ! 🔥", "Je suis dans le gbaka là 😩", "On se voit quand ?", "Tu me manques hein 🥺", "Pardon envoie encore 😍", "Ça va aller 😂", "Regarde-moi ça 👀", "Journée longue dêh 😮‍💨", "Babi c'est doux 💛", "Le garba de ce matin 😋", "Ma tête du jour 😎", ""}
	flashReplies = []string{"Hahaha 😂", "Toi aussi 😂", "Trop beau 😍", "Où ça ?", "Ah ça c'est fort 🔥", "Tu gères 👏", "Je viens ! 🏃", "Hmm 👀"}
)

// flashCaption: a friend's snap: back to one taken at a kind of place (often about it), or of their own.
func flashCaption(placeKind string, reply bool, rng *rand.Rand) string {
	if back := flashBack[placeKind]; reply && len(back) > 0 && rng.IntN(3) > 0 {
		return back[rng.IntN(len(back))]
	}
	if reply && rng.IntN(2) == 0 {
		return flashReplies[rng.IntN(len(flashReplies))]
	}
	return flashOwn[rng.IntN(len(flashOwn))]
}

func flashRand(parts ...string) *rand.Rand {
	f := fnv.New64a()
	for _, p := range parts {
		_, _ = f.Write([]byte(p))
	}
	return rand.New(rand.NewPCG(f.Sum64(), 0x5ea1))
}

// flashStreak: the flame with a friend: the days in a row, up to today or yesterday, both sent a snap.
func flashStreak(mine, theirs map[string]bool, now time.Time) int {
	day := now.UTC()
	both := func(t time.Time) bool { k := t.Format("2006-01-02"); return mine[k] && theirs[k] }
	if !both(day) {
		day = day.AddDate(0, 0, -1)
	}
	n := 0
	for both(day) {
		n++
		day = day.AddDate(0, 0, -1)
	}
	return n
}

var flashSwept atomic.Int64

// flashSweep: the photos opened a day ago (or a month unopened) go, the lines after two months; every ten minutes at most.
func (h *Handler) flashSweep(ctx context.Context) {
	now := time.Now().Unix()
	last := flashSwept.Load()
	if now-last < 600 || !flashSwept.CompareAndSwap(last, now) {
		return
	}
	_, _ = h.DB.Exec(ctx, `UPDATE snaps SET image = NULL WHERE image IS NOT NULL AND (opened_at < now() - interval '1 day' OR created_at < now() - interval '30 days')
		AND NOT EXISTS(SELECT 1 FROM reports p WHERE p.snap_id = snaps.id AND p.status = 'open')`)
	_, _ = h.DB.Exec(ctx, `DELETE FROM snaps WHERE created_at < now() - interval '60 days'`)
}

// flashFirst: the friends met in the game who snap first in this slot (one chance in three each, the
// same on every server, written once: none from them since the slot began).
func (h *Handler) flashFirst(ctx context.Context, s *Sim, now time.Time) {
	slot := now.Truncate(flashNPCSlot)
	made := 0
	for _, f := range flashFriends(s) {
		if made >= flashNPCPerVisit || f.Friendship < 20 {
			continue
		}
		rng := flashRand(s.ID, f.ID, strconv.FormatInt(slot.Unix(), 10))
		if rng.IntN(flashNPCChance) != 0 {
			continue
		}
		at := slot.Add(time.Duration(rng.IntN(int(flashNPCSlot/time.Minute))) * time.Minute)
		if at.After(now) || at.Before(game.TimeOf(f.Met)) {
			continue
		}
		var had bool
		_ = h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM snaps WHERE from_sim = $1 AND npc = $2 AND npc_sent AND created_at >= $3)`, s.ID, f.ID, slot).Scan(&had)
		if had {
			continue
		}
		if _, err := h.DB.Exec(ctx, `INSERT INTO snaps (from_sim, npc, npc_sent, scene, seed, caption, seconds, created_at) VALUES ($1, $2, true, $3, $4, $5, $6, $7)`,
			s.ID, f.ID, flashScene(f, at, rng), rng.Int64N(1<<40), flashCaption("", false, rng), 3+rng.IntN(6), at); err == nil {
			made++
		}
	}
}

// flashInbox: the friends (the latest snaps first), what's new from each, the flames, the snaps left today.
func (h *Handler) flashInbox(w http.ResponseWriter, r *http.Request) {
	s, err := h.flashSim(r)
	if err != nil {
		h.flashFail(w, err)
		return
	}
	ctx := r.Context()
	now := time.Now()
	h.flashSweep(ctx)
	h.flashFirst(ctx, &s, now)
	players, err := h.players(ctx, game.MinuteOf(now), `
		SELECT o.id, o.first_name, COALESCE(u.username, ''), o.gender, o.look, o.born_at, o.activity, b.friendship, o.city, o.commune, o.last_tick > $2, true, ''
		FROM bonds b
		JOIN sims o ON o.id = CASE WHEN b.sim_a = $1::uuid THEN b.sim_b ELSE b.sim_a END
		JOIN users u ON u.id = o.user_id
		WHERE (b.sim_a = $1::uuid OR b.sim_b = $1::uuid) AND b.friends
			AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $1 AND k.blocked = o.id) OR (k.sim = o.id AND k.blocked = $1))
		LIMIT 200`, s.ID, now.Add(-OnlineWindow))
	if err != nil {
		h.flashFail(w, err)
		return
	}
	contacts := []FlashContact{}
	at := map[string]int{}
	for _, p := range players {
		look := p.Look
		at[p.ID] = len(contacts)
		contacts = append(contacts, FlashContact{ID: p.ID, Name: p.FirstName, Gender: p.Gender, Look: &look, Online: p.Online})
	}
	for _, f := range flashFriends(&s) {
		f := f
		at["npc:"+f.ID] = len(contacts)
		contacts = append(contacts, FlashContact{ID: "npc:" + f.ID, Name: f.Name, Gender: f.Gender, Friend: &f})
	}
	// The last two months, newest first: what's new, the latest, the days each way.
	rows, err := h.DB.Query(ctx, `
		SELECT CASE WHEN npc IS NOT NULL THEN 'npc:' || npc WHEN from_sim = $1 THEN to_sim::text ELSE from_sim::text END,
			from_sim = $1 AND NOT npc_sent, opened_at IS NOT NULL AND opened_at <= now(), created_at
		FROM snaps WHERE (from_sim = $1 OR to_sim = $1) AND created_at <= now()
		ORDER BY created_at DESC LIMIT 3000`, s.ID)
	if err != nil {
		h.flashFail(w, err)
		return
	}
	days := map[string][2]map[string]bool{}
	for rows.Next() {
		var who string
		var mine, opened bool
		var when time.Time
		if err := rows.Scan(&who, &mine, &opened, &when); err != nil {
			rows.Close()
			h.flashFail(w, err)
			return
		}
		i, ok := at[who]
		if !ok {
			continue
		}
		c := &contacts[i]
		if c.Last == nil {
			c.Last = &FlashLast{Mine: mine, Opened: opened, At: when}
		}
		if !mine && !opened {
			c.New++
		}
		d, ok := days[who]
		if !ok {
			d = [2]map[string]bool{{}, {}}
			days[who] = d
		}
		k := 1
		if mine {
			k = 0
		}
		d[k][when.UTC().Format("2006-01-02")] = true
	}
	rows.Close()
	for who, d := range days {
		contacts[at[who]].Streak = flashStreak(d[0], d[1], now)
	}
	// The latest snaps first, then the others by name.
	slices.SortStableFunc(contacts, func(a, b FlashContact) int {
		switch {
		case a.Last != nil && b.Last != nil:
			return b.Last.At.Compare(a.Last.At)
		case a.Last != nil:
			return -1
		case b.Last != nil:
			return 1
		}
		return strings.Compare(a.Name, b.Name)
	})
	var sent int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM snaps WHERE from_sim = $1 AND NOT npc_sent AND created_at > now() - interval '24 hours'`, s.ID).Scan(&sent)
	httpx.JSON(w, http.StatusOK, map[string]any{"contacts": contacts, "left": max(0, FlashPerDay-sent)})
}

// flashSend: a snap (the photo baked by the app) to friends, and/or to one's story.
func (h *Handler) flashSend(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Photo   string   `json:"photo"`
		Caption string   `json:"caption"`
		Seconds int      `json:"seconds"`
		To      []string `json:"to"`
		Story   bool     `json:"story"`
		PlaceID string   `json:"placeId"`
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
	req.Seconds = min(10, max(1, req.Seconds))
	to := []string{}
	for _, t := range req.To {
		if t != "" && !slices.Contains(to, t) {
			to = append(to, t)
		}
	}
	if len(to) == 0 && !req.Story {
		httpx.Error(w, http.StatusBadRequest, errFlashNoOne.Error())
		return
	}
	if len(to) > FlashTo {
		httpx.Error(w, http.StatusBadRequest, errFlashTooWide.Error())
		return
	}
	ctx := r.Context()
	var pushTo []string
	var name string
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := needApp(s, "flashe"); err != nil {
			return game.Outcome{}, nil, err
		}
		var sent int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM snaps WHERE from_sim = $1 AND NOT npc_sent AND created_at > now() - interval '24 hours'`, s.ID).Scan(&sent); err != nil {
			return game.Outcome{}, nil, err
		}
		if sent+len(to) > FlashPerDay {
			return game.Outcome{}, nil, errFlashTooMany
		}
		// Where it's taken: a place of the Sim's commune (the app sends the nearest).
		kind, place := "", ""
		if city, cm, p, ok := world.FindPlace(req.PlaceID); ok && city.ID == s.City && cm.ID == s.Commune {
			kind, place = p.Kind, p.Name
		}
		now := time.Now()
		names := []string{}
		for _, id := range to {
			if npc, ok := strings.CutPrefix(id, "npc:"); ok {
				i := slices.IndexFunc(s.Friends, func(f game.Friend) bool { return f.ID == npc && !f.Gang })
				if i < 0 {
					return game.Outcome{}, nil, errFlashNoNPC
				}
				f := s.Friends[i]
				names = append(names, f.Name)
				rng := flashRand(s.ID, f.ID, strconv.FormatInt(now.UnixNano(), 10))
				// Seen a few minutes later (no photo kept: nobody else will see it)…
				seen := now.Add(time.Duration(1+rng.IntN(12)) * time.Minute)
				if _, err := tx.Exec(ctx, `INSERT INTO snaps (from_sim, npc, caption, place, seconds, created_at, opened_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
					s.ID, f.ID, caption, place, req.Seconds, now, seen); err != nil {
					return game.Outcome{}, nil, err
				}
				// …and snapped back, mostly (a close friend always).
				if rng.IntN(100) < 60+f.Friendship/2 {
					back := seen.Add(time.Duration(1+rng.IntN(8)) * time.Minute)
					if _, err := tx.Exec(ctx, `INSERT INTO snaps (from_sim, npc, npc_sent, scene, seed, caption, seconds, created_at) VALUES ($1, $2, true, $3, $4, $5, $6, $7)`,
						s.ID, f.ID, flashScene(f, back, rng), rng.Int64N(1<<40), flashCaption(kind, true, rng), 3+rng.IntN(6), back); err != nil {
						return game.Outcome{}, nil, err
					}
				}
				continue
			}
			if err := canWrite(ctx, tx, s.ID, id); err != nil {
				return game.Outcome{}, nil, err
			}
			var first string
			if err := tx.QueryRow(ctx, `SELECT first_name FROM sims WHERE id = $1`, id).Scan(&first); err != nil {
				return game.Outcome{}, nil, err
			}
			names = append(names, first)
			if _, err := tx.Exec(ctx, `INSERT INTO snaps (from_sim, to_sim, image, mime, caption, place, seconds) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				s.ID, id, raw, mime, caption, place, req.Seconds); err != nil {
				return game.Outcome{}, nil, err
			}
			pushTo = append(pushTo, id)
		}
		if req.Story {
			var up int
			if err := tx.QueryRow(ctx, `SELECT count(*) FROM stories WHERE sim = $1 AND expires_at > now()`, s.ID).Scan(&up); err != nil {
				return game.Outcome{}, nil, err
			}
			if up >= MaxStories {
				return game.Outcome{}, nil, errTooManyStories
			}
			if _, err := tx.Exec(ctx, `INSERT INTO stories (sim, image, mime, caption, source) VALUES ($1, $2, $3, $4, 'jeu')`, s.ID, raw, mime, caption); err != nil {
				return game.Outcome{}, nil, err
			}
		}
		name = s.FirstName
		s.Needs = s.Needs.Add(game.Needs{Social: 3, Fun: 2})
		text := "Snap ajouté à ta story."
		if len(names) > 0 {
			text = "Snap envoyé à " + flashNames(names)
			if req.Story {
				text += ", et dans ta story"
			}
			text += "."
		}
		return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
	})
	for _, id := range pushTo {
		h.Push.ToSim(id, push.Message{Title: name + " · Flashé", Body: "📸 t'a envoyé un snap", URL: "/jeu?app=flashe", Tag: "flashe-" + id})
	}
}

// flashNames: « Awa, Koffi et Yao », or « Awa, Koffi et 3 autres » past three.
func flashNames(n []string) string {
	if len(n) <= 3 {
		return listNames(n)
	}
	return fmt.Sprintf("%s, %s et %d autres", n[0], n[1], len(n)-2)
}

// flashOpen: a snap received, seen now and once: marked opened, its photo handed over with it.
func (h *Handler) flashOpen(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "flashe")
	if err != nil {
		h.flashFail(w, err)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "snap"), 10, 64)
	var (
		snap    = FlashSnap{ID: id}
		from    string
		npc     *string
		raw     []byte
		mime    string
		npcSent bool
	)
	err = h.DB.QueryRow(r.Context(), `UPDATE snaps SET opened_at = now()
		WHERE id = $1 AND opened_at IS NULL AND created_at <= now() AND (to_sim = $2 OR (from_sim = $2 AND npc_sent))
		RETURNING from_sim, npc, npc_sent, image, mime, scene, seed, caption, place, seconds, created_at`, id, me).
		Scan(&from, &npc, &npcSent, &raw, &mime, &snap.Scene, &snap.Seed, &snap.Caption, &snap.Place, &snap.Seconds, &snap.At)
	if errors.Is(err, pgx.ErrNoRows) {
		h.flashFail(w, errFlashNoSnap)
		return
	}
	if err != nil {
		h.flashFail(w, err)
		return
	}
	snap.From = from
	if npc != nil {
		snap.From = "npc:" + *npc
	}
	if len(raw) > 0 {
		snap.Photo = "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(raw)
	}
	httpx.JSON(w, http.StatusOK, snap)
}

// flashNext: the snaps from a friend not opened yet, oldest first (their ids: each is opened in turn).
func (h *Handler) flashNext(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "flashe")
	if err != nil {
		h.flashFail(w, err)
		return
	}
	other, _ := url.PathUnescape(chi.URLParam(r, "other"))
	var rows pgx.Rows
	if npc, ok := strings.CutPrefix(other, "npc:"); ok {
		rows, err = h.DB.Query(r.Context(), `SELECT id FROM snaps WHERE from_sim = $1 AND npc = $2 AND npc_sent AND opened_at IS NULL AND created_at <= now() ORDER BY created_at LIMIT 30`, me, npc)
	} else {
		rows, err = h.DB.Query(r.Context(), `SELECT id FROM snaps WHERE to_sim = $1 AND from_sim::text = $2 AND opened_at IS NULL AND created_at <= now() ORDER BY created_at LIMIT 30`, me, other)
	}
	if err != nil {
		h.flashFail(w, err)
		return
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	if err != nil {
		h.flashFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ids": ids})
}

// flashReport: a player's snap reported (kept for moderation); its sender is blocked.
func (h *Handler) flashReport(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Reason string `json:"reason"`
	}
	if err := httpx.Decode(r, &req); err != nil || !validReason(req.Reason) {
		h.gbairaiFail(w, errNoReason)
		return
	}
	me, err := h.appSim(r, "flashe")
	if err != nil {
		h.flashFail(w, err)
		return
	}
	ctx := r.Context()
	id, _ := strconv.ParseInt(chi.URLParam(r, "snap"), 10, 64)
	var from, caption string
	if err := h.DB.QueryRow(ctx, `SELECT from_sim, caption FROM snaps WHERE id = $1 AND to_sim = $2`, id, me).Scan(&from, &caption); err != nil {
		h.flashFail(w, errFlashNoSnap)
		return
	}
	if _, err := h.DB.Exec(ctx, `INSERT INTO reports (reporter, reported, snap_id, excerpt, reason) VALUES ($1, $2, $3, $4, $5)`, me, from, id, caption, req.Reason); err != nil {
		h.flashFail(w, err)
		return
	}
	_, _ = h.DB.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING`, me, from)
	httpx.JSON(w, http.StatusOK, map[string]string{"text": "Merci. C'est signalé : on va regarder. Cette personne est bloquée."})
}
