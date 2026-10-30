package sims

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// The phone's camera and its gallery. The Sim takes a photo of what's in
// front of it, or a selfie; the app shrinks the picture from the game and
// sends it here. It's kept in the bucket (the same S3-compatible store as
// Babi Pub's files, under photos/) when one is set up, else in the database.
// From the gallery a photo can be posted on Tikitoko.

const (
	// GalleryMax: photos kept per Sim; the oldest go to make room.
	GalleryMax = 120
	// PhotosPerDay: photos a Sim may take in a day (real time).
	PhotosPerDay = 80
)

var (
	errNoSuchPhoto = errors.New("photo introuvable")
	errTooManyPics = errors.New("assez de photos pour aujourd'hui : la mémoire du téléphone chauffe")
)

// Photo is one picture of the gallery. URL: in the bucket (public); else
// Path: from the API, with the token.
type Photo struct {
	ID    int64     `json:"id"`
	URL   string    `json:"url,omitempty"`
	Path  string    `json:"path,omitempty"`
	Kind  string    `json:"kind"`
	Place string    `json:"place"`
	At    time.Time `json:"at"`
}

// phoneSim: the player's Sim, old enough to have a phone.
func (h *Handler) phoneSim(r *http.Request) (string, error) {
	var s Sim
	err := h.DB.QueryRow(r.Context(), `SELECT id, born_at, apps FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())).Scan(&s.ID, &s.BornAt, &s.Apps)
	if err != nil {
		return "", errNotFound
	}
	s.GameMinutes = game.MinuteOf(time.Now())
	if !s.hasPhone() {
		return "", errNoPhoneYet
	}
	return s.ID, nil
}

func (h *Handler) photoOf(sim string, id int64, key string) Photo {
	p := Photo{ID: id}
	if key != "" && h.Bucket.Ready() {
		p.URL = h.Bucket.Public(key)
	} else {
		p.Path = fmt.Sprintf("/sims/%s/photos/%d/raw", sim, id)
	}
	return p
}

func (h *Handler) photoFail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errNoSuchPhoto):
		httpx.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, errTooManyPics):
		httpx.Error(w, http.StatusTooManyRequests, err.Error())
	case errors.Is(err, errBadPhoto):
		httpx.Error(w, http.StatusBadRequest, err.Error())
	default:
		h.gbairaiFail(w, err)
	}
}

// photoTake: a new photo into the gallery.
func (h *Handler) photoTake(w http.ResponseWriter, r *http.Request) {
	sim, err := h.phoneSim(r)
	if err != nil {
		h.photoFail(w, err)
		return
	}
	var req struct {
		Photo   string `json:"photo"`
		Kind    string `json:"kind"`
		PlaceID string `json:"placeId"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	raw, mime, err := decodePhoto(req.Photo)
	if err != nil {
		h.photoFail(w, err)
		return
	}
	if req.Kind != "selfie" {
		req.Kind = "photo"
	}
	ctx := r.Context()
	var today int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM photos WHERE sim = $1 AND created_at > now() - interval '24 hours'`, sim).Scan(&today)
	if today >= PhotosPerDay {
		h.photoFail(w, errTooManyPics)
		return
	}
	place := "Dans la rue"
	if _, _, p, ok := world.FindPlace(req.PlaceID); ok {
		place = p.Name
	} else if req.PlaceID == "home" {
		place = "Chez moi"
	}
	key := ""
	var image []byte = raw
	if h.Bucket.Ready() {
		k := fmt.Sprintf("photos/%s/%s.%s", sim, randomKey(), map[string]string{"image/jpeg": "jpg", "image/png": "png"}[mime])
		if err := h.bucketPut(ctx, k, raw, mime); err == nil {
			key, image = k, nil
		}
	}
	var p Photo
	err = h.DB.QueryRow(ctx, `INSERT INTO photos (sim, key, image, mime, kind, place) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`, sim, key, image, mime, req.Kind, place).Scan(&p.ID, &p.At)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	full := h.photoOf(sim, p.ID, key)
	full.Kind, full.Place, full.At = req.Kind, place, p.At
	h.trimGallery(ctx, sim)
	httpx.JSON(w, http.StatusOK, map[string]any{"photo": full})
}

// trimGallery: past GalleryMax, the oldest photos go (and their files).
func (h *Handler) trimGallery(ctx context.Context, sim string) {
	rows, err := h.DB.Query(ctx, `DELETE FROM photos WHERE id IN (SELECT id FROM photos WHERE sim = $1 ORDER BY created_at DESC OFFSET $2) RETURNING key`, sim, GalleryMax)
	if err != nil {
		return
	}
	var keys []string
	for rows.Next() {
		var k string
		if rows.Scan(&k) == nil && k != "" {
			keys = append(keys, k)
		}
	}
	rows.Close()
	for _, k := range keys {
		_ = h.bucketDelete(ctx, k)
	}
}

func (h *Handler) photoList(w http.ResponseWriter, r *http.Request) {
	sim, err := h.phoneSim(r)
	if err != nil {
		h.photoFail(w, err)
		return
	}
	rows, err := h.DB.Query(r.Context(), `SELECT id, key, kind, place, created_at FROM photos WHERE sim = $1 ORDER BY created_at DESC LIMIT $2`, sim, GalleryMax)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	list := []Photo{}
	for rows.Next() {
		var (
			id               int64
			key, kind, place string
			at               time.Time
		)
		if err := rows.Scan(&id, &key, &kind, &place, &at); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		p := h.photoOf(sim, id, key)
		p.Kind, p.Place, p.At = kind, place, at
		list = append(list, p)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"photos": list})
}

// photoBytes: one of the Sim's own photos, from the database or the bucket.
func (h *Handler) photoBytes(ctx context.Context, sim string, id int64) ([]byte, string, error) {
	var (
		key, mime string
		raw       []byte
	)
	if err := h.DB.QueryRow(ctx, `SELECT key, image, mime FROM photos WHERE id = $1 AND sim = $2`, id, sim).Scan(&key, &raw, &mime); err != nil {
		return nil, "", errNoSuchPhoto
	}
	if key == "" {
		return raw, mime, nil
	}
	if !h.Bucket.Ready() {
		return nil, "", errNoSuchPhoto
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, h.Bucket.Presign(http.MethodGet, key, 5*time.Minute, time.Now()), nil)
	res, err := bucketClient.Do(req)
	if err != nil {
		return nil, "", errNoSuchPhoto
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, "", errNoSuchPhoto
	}
	raw, err = io.ReadAll(io.LimitReader(res.Body, MaxPhotoBytes+1))
	if err != nil || len(raw) > MaxPhotoBytes {
		return nil, "", errNoSuchPhoto
	}
	return raw, mime, nil
}

func (h *Handler) photoRaw(w http.ResponseWriter, r *http.Request) {
	sim, err := h.phoneSim(r)
	if err != nil {
		h.photoFail(w, err)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "photo"), 10, 64)
	raw, mime, err := h.photoBytes(r.Context(), sim, id)
	if err != nil {
		h.photoFail(w, err)
		return
	}
	servePhoto(w, raw, mime)
}

func (h *Handler) photoDelete(w http.ResponseWriter, r *http.Request) {
	sim, err := h.phoneSim(r)
	if err != nil {
		h.photoFail(w, err)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "photo"), 10, 64)
	var key string
	if err := h.DB.QueryRow(r.Context(), `DELETE FROM photos WHERE id = $1 AND sim = $2 RETURNING key`, id, sim).Scan(&key); err != nil {
		h.photoFail(w, errNoSuchPhoto)
		return
	}
	if key != "" {
		_ = h.bucketDelete(r.Context(), key)
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

var bucketClient = &http.Client{Timeout: 15 * time.Second}

func (h *Handler) bucketPut(ctx context.Context, key string, raw []byte, mime string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, h.Bucket.Presign(http.MethodPut, key, 5*time.Minute, time.Now()), bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", mime)
	req.ContentLength = int64(len(raw))
	res, err := bucketClient.Do(req)
	if err != nil {
		return err
	}
	res.Body.Close()
	if res.StatusCode/100 != 2 {
		return fmt.Errorf("bucket: %s", res.Status)
	}
	return nil
}

func (h *Handler) bucketDelete(ctx context.Context, key string) error {
	if !h.Bucket.Ready() {
		return nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, h.Bucket.Presign(http.MethodDelete, key, 5*time.Minute, time.Now()), nil)
	if err != nil {
		return err
	}
	res, err := bucketClient.Do(req)
	if err != nil {
		return err
	}
	res.Body.Close()
	return nil
}

// RemoveFiles: these files gone from the bucket (a deleted account's photos and videos, auth.Handler.Erase).
func (h *Handler) RemoveFiles(ctx context.Context, keys []string) {
	for _, k := range keys {
		_ = h.bucketDelete(ctx, k)
	}
}

func randomKey() string {
	b := make([]byte, 9)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
