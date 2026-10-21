package sims

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Tikitoko's clips: the app records the 3D scene round the Sim for a few
// seconds (MediaRecorder: MP4 on Safari, WebM elsewhere) with one of the
// game's own sounds mixed in, and sends it with a first-frame poster in a
// multipart form (the JSON bodies are capped at 1 MB). The clip goes to the
// bucket when one is set up, else in the database, which is why the size is
// capped hard. It's played back from GET …/video, Range included: iOS
// Safari won't play a video it can't seek in.

const (
	// TikiVideoMax: a clip's bytes at most (15 s at ~1.2 Mbit/s is ~2.3 MB).
	TikiVideoMax = 4 << 20
	// A clip's length, in milliseconds.
	tikiMinMs = 1000
	tikiMaxMs = 16000
)

// tikiSounds: the sounds a clip can carry (the app synthesizes them,
// web/src/lib/tikiSounds.ts); "" is the « son original », no music.
var tikiSounds = []string{"", "decale", "afro", "zouglou", "lagune"}

var (
	errTikiVideo = errors.New("vidéo illisible (MP4 ou WebM, 4 Mo et 16 secondes au plus)")
	errTikiSound = errors.New("ce son n'existe pas")
)

// sniffVideo: the clip's type from its first bytes, whatever the browser
// claimed (a WebM starts with the EBML magic, an MP4 with an ftyp box).
func sniffVideo(raw []byte) (string, bool) {
	switch {
	case len(raw) >= 4 && bytes.Equal(raw[:4], []byte{0x1A, 0x45, 0xDF, 0xA3}):
		return "video/webm", true
	case len(raw) >= 12 && string(raw[4:8]) == "ftyp":
		return "video/mp4", true
	}
	return "", false
}

// tikiInput is what's posted: the picture (the poster, or the whole post
// for a photo), and the clip when there's one.
type tikiInput struct {
	Photo, Caption, Theme, PlaceID, Sound string
	PhotoID                               int64
	Video                                 []byte
	VideoMime                             string
	DurationMs                            int
}

// readTikiInput: a JSON body (a photo post, as before) or a multipart form
// with the clip.
func readTikiInput(w http.ResponseWriter, r *http.Request) (tikiInput, error) {
	var in tikiInput
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		var req struct {
			Photo   string `json:"photo"`
			Caption string `json:"caption"`
			Theme   string `json:"theme"`
			PlaceID string `json:"placeId"`
			PhotoID int64  `json:"photoId"`
		}
		if err := httpx.Decode(r, &req); err != nil {
			return in, errors.New("requête invalide")
		}
		return tikiInput{Photo: req.Photo, Caption: req.Caption, Theme: req.Theme, PlaceID: req.PlaceID, PhotoID: req.PhotoID}, nil
	}
	// The clip, the poster (a data URL, ≤ 300 KB) and a few short fields.
	r.Body = http.MaxBytesReader(w, r.Body, TikiVideoMax+(1<<20))
	if err := r.ParseMultipartForm(TikiVideoMax + (1 << 20)); err != nil {
		return in, errTikiVideo
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()
	in.Photo, in.Caption, in.Theme, in.PlaceID, in.Sound = r.FormValue("poster"), r.FormValue("caption"), r.FormValue("theme"), r.FormValue("placeId"), r.FormValue("sound")
	if !slices.Contains(tikiSounds, in.Sound) {
		return in, errTikiSound
	}
	ms, err := strconv.Atoi(r.FormValue("durationMs"))
	if err != nil || ms < tikiMinMs || ms > tikiMaxMs {
		return in, errTikiVideo
	}
	in.DurationMs = ms
	f, _, err := r.FormFile("video")
	if err != nil {
		return in, errTikiVideo
	}
	defer f.Close()
	raw, err := io.ReadAll(io.LimitReader(f, TikiVideoMax+1))
	if err != nil || len(raw) > TikiVideoMax {
		return in, errTikiVideo
	}
	mime, ok := sniffVideo(raw)
	if !ok {
		return in, errTikiVideo
	}
	in.Video, in.VideoMime = raw, mime
	return in, nil
}

// storeTikiVideo: the clip into the bucket (its key), or kept for the
// database (the bytes) when there's no bucket or it failed.
func (h *Handler) storeTikiVideo(r *http.Request, sim string, in tikiInput) (key string, inDB []byte) {
	if in.Video == nil {
		return "", nil
	}
	if h.Bucket.Ready() {
		k := fmt.Sprintf("tiki/%s/%s.%s", sim, randomKey(), map[string]string{"video/mp4": "mp4", "video/webm": "webm"}[in.VideoMime])
		if err := h.bucketPut(r.Context(), k, in.Video, in.VideoMime); err == nil {
			return k, nil
		}
	}
	return "", in.Video
}

// tikiVideoURL: where the app reads a post's clip: the bucket's public
// address, else "" (it then fetches …/video with its token).
func (h *Handler) tikiVideoURL(key string) string {
	if key != "" && h.Bucket.Ready() {
		return h.Bucket.Public(key)
	}
	return ""
}

func (h *Handler) tikiVideo(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "tikitoko")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "post"), 10, 64)
	var (
		key, mime string
		raw       []byte
		at        time.Time
	)
	err = h.DB.QueryRow(r.Context(), `SELECT p.video_key, p.video, p.video_mime, p.created_at FROM tiki_posts p WHERE p.id = $1 AND p.video_mime <> ''
		AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $2 AND k.blocked = p.sim) OR (k.sim = p.sim AND k.blocked = $2))`, id, me).Scan(&key, &raw, &mime, &at)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, errNoPost.Error())
		return
	}
	if u := h.tikiVideoURL(key); u != "" {
		http.Redirect(w, r, u, http.StatusFound)
		return
	}
	if raw == nil {
		httpx.Error(w, http.StatusNotFound, errNoPost.Error())
		return
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "private, max-age=86400")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	// ServeContent answers Range requests (206), which iOS Safari needs to play it.
	http.ServeContent(w, r, "", at, bytes.NewReader(raw))
}
