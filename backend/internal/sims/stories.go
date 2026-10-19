package sims

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Stories, in Gbairai: a photo of what's happening in the game (the app
// takes it from the 3D), with a few words, seen by the Sim's friends for 24
// hours, then gone. A photo from the phone itself (« la vraie vie ») only
// when the server allows it (STORIES_REAL_PHOTOS=true), once moderation is
// staffed. Friends only, a block hides them both ways, a story can be
// reported (moderation sees the photo and can delete it).

const (
	MaxStories = 5 // up at once
	MaxCaption = 150
)

var (
	errTooManyStories = errors.New("tu as déjà 5 stories en ligne : attends qu'une expire, ou supprime-en une")
	errNoRealPhotos   = errors.New("les photos de la vraie vie ne sont pas encore ouvertes : prends une photo dans le jeu")
	errNoStory        = errors.New("story introuvable ou expirée")
)

// cleanCaption: like a message, shorter, and it may be empty.
func cleanCaption(c string) (string, error) {
	if strings.TrimSpace(c) == "" {
		return "", nil
	}
	if len([]rune(strings.TrimSpace(c))) > MaxCaption {
		return "", errors.New("légende trop longue (150 caractères au plus)")
	}
	return cleanMessage(strings.ReplaceAll(c, "\n", " "))
}

type Story struct {
	ID        int64     `json:"id"`
	Caption   string    `json:"caption"`
	Source    string    `json:"source"`
	At        time.Time `json:"at"`
	ExpiresAt time.Time `json:"expiresAt"`
	Seen      bool      `json:"seen"`
	Views     int       `json:"views,omitempty"` // mine only
}

type StoryRing struct {
	Sim     StoryAuthor `json:"sim"`
	Mine    bool        `json:"mine"`
	Stories []Story     `json:"stories"`
}

type StoryAuthor struct {
	ID        string `json:"id"`
	FirstName string `json:"firstName"`
	Gender    string `json:"gender"`
	Look      Look   `json:"look"`
}

func (h *Handler) postStory(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Photo   string `json:"photo"`
		Caption string `json:"caption"`
		Source  string `json:"source"`
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
	if req.Source != "reel" {
		req.Source = "jeu"
	}
	if req.Source == "reel" && !h.RealPhotos {
		httpx.Error(w, http.StatusForbidden, errNoRealPhotos.Error())
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
	ctx := r.Context()
	_, _ = h.DB.Exec(ctx, `DELETE FROM stories WHERE expires_at < now()`)
	var up int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM stories WHERE sim = $1`, me).Scan(&up)
	if up >= MaxStories {
		httpx.Error(w, http.StatusTooManyRequests, errTooManyStories.Error())
		return
	}
	var s Story
	if err := h.DB.QueryRow(ctx, `INSERT INTO stories (sim, image, mime, caption, source) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, expires_at`,
		me, raw, mime, caption, req.Source).Scan(&s.ID, &s.At, &s.ExpiresAt); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	s.Caption, s.Source, s.Seen = caption, req.Source, true
	httpx.JSON(w, http.StatusOK, s)
}

// stories: mine first, then my friends' (not blocked either way), unseen first.
func (h *Handler) stories(w http.ResponseWriter, r *http.Request) {
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	_, _ = h.DB.Exec(ctx, `DELETE FROM stories WHERE expires_at < now()`)
	rows, err := h.DB.Query(ctx, `
		SELECT s.id, s.caption, s.source, s.created_at, s.expires_at, o.id, o.first_name, o.gender, o.look,
			EXISTS(SELECT 1 FROM story_views v WHERE v.story = s.id AND v.viewer = $1),
			(SELECT count(*) FROM story_views v WHERE v.story = s.id)
		FROM stories s JOIN sims o ON o.id = s.sim
		WHERE s.expires_at > now() AND (s.sim = $1 OR (
			EXISTS(SELECT 1 FROM bonds b WHERE b.sim_a = LEAST(s.sim, $1::uuid) AND b.sim_b = GREATEST(s.sim, $1::uuid) AND b.friends)
			AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $1 AND k.blocked = s.sim) OR (k.sim = s.sim AND k.blocked = $1))))
		ORDER BY s.created_at`, me)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	defer rows.Close()
	rings := []StoryRing{}
	at := map[string]int{}
	for rows.Next() {
		var s Story
		var a StoryAuthor
		if err := rows.Scan(&s.ID, &s.Caption, &s.Source, &s.At, &s.ExpiresAt, &a.ID, &a.FirstName, &a.Gender, &a.Look, &s.Seen, &s.Views); err != nil {
			h.gbairaiFail(w, err)
			return
		}
		mine := a.ID == me
		if mine {
			s.Seen = true
		} else {
			s.Views = 0
		}
		i, ok := at[a.ID]
		if !ok {
			i = len(rings)
			at[a.ID] = i
			rings = append(rings, StoryRing{Sim: a, Mine: mine})
		}
		rings[i].Stories = append(rings[i].Stories, s)
	}
	sortRings(rings)
	httpx.JSON(w, http.StatusOK, rings)
}

// sortRings: mine first, then those with something unseen.
func sortRings(r []StoryRing) {
	rank := func(x StoryRing) int {
		if x.Mine {
			return 0
		}
		for _, s := range x.Stories {
			if !s.Seen {
				return 1
			}
		}
		return 2
	}
	for i := 1; i < len(r); i++ {
		for j := i; j > 0 && rank(r[j]) < rank(r[j-1]); j-- {
			r[j], r[j-1] = r[j-1], r[j]
		}
	}
}

// storyPhoto: the photo, for its author or a friend; seen once opened.
func (h *Handler) storyPhoto(w http.ResponseWriter, r *http.Request) {
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	id, _ := strconv.ParseInt(chi.URLParam(r, "story"), 10, 64)
	var owner, mime string
	var raw []byte
	err = h.DB.QueryRow(ctx, `SELECT sim, image, mime FROM stories WHERE id = $1 AND expires_at > now()`, id).Scan(&owner, &raw, &mime)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, errNoStory.Error())
		return
	}
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	if owner != me {
		if err := canWrite(ctx, h.DB, me, owner); err != nil {
			httpx.Error(w, http.StatusNotFound, errNoStory.Error())
			return
		}
		_, _ = h.DB.Exec(ctx, `INSERT INTO story_views (story, viewer) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, me)
	}
	servePhoto(w, raw, mime)
}

func (h *Handler) deleteStory(w http.ResponseWriter, r *http.Request) {
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "story"), 10, 64)
	if _, err := h.DB.Exec(r.Context(), `DELETE FROM stories WHERE id = $1 AND sim = $2`, id, me); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// reportStory: flag a friend's story; they're blocked too.
func (h *Handler) reportStory(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Reason string `json:"reason"`
	}
	if err := httpx.Decode(r, &req); err != nil || !validReason(req.Reason) {
		h.gbairaiFail(w, errNoReason)
		return
	}
	me, err := h.texter(r)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	id, _ := strconv.ParseInt(chi.URLParam(r, "story"), 10, 64)
	var owner, caption string
	if err := h.DB.QueryRow(ctx, `SELECT sim, caption FROM stories WHERE id = $1`, id).Scan(&owner, &caption); err != nil || owner == me {
		httpx.Error(w, http.StatusNotFound, errNoStory.Error())
		return
	}
	if _, err := h.DB.Exec(ctx, `INSERT INTO reports (reporter, reported, story_id, excerpt, reason) VALUES ($1, $2, $3, $4, $5)`, me, owner, id, caption, req.Reason); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	_, _ = h.DB.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING`, me, owner)
	httpx.JSON(w, http.StatusOK, map[string]string{"text": "Merci. C'est signalé : on va regarder. Cette personne est bloquée."})
}
