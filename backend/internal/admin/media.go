package admin

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The campaigns' pictures and videos (« E-mails », « Notifications »): the
// page puts each file straight into Babi Pub's bucket (ads.Bucket, ADS_S3_*
// and ADS_PUBLIC_URL) under campagnes/, with a short-lived signed URL, as the
// advertisers do. A picture is then read from the bucket's public address; a
// video has its own page on the site (/regarder/<id>, web screens/Watch.tsx),
// which reads it from GET /media/{id}: an e-mail shows its poster and links there.

// campaignMedia: what may be sent, and how big (bytes).
var campaignMedia = map[string]struct {
	kind, ext string
	max       int64
}{
	"image/jpeg": {"image", "jpg", 5 << 20},
	"image/png":  {"image", "png", 5 << 20},
	"image/webp": {"image", "webp", 5 << 20},
	"video/mp4":  {"video", "mp4", 40 << 20},
}

// videoPage: a video's page as an e-mail links to it.
var videoPage = regexp.MustCompile(`^/regarder/[A-Za-z0-9_-]{8,32}$`)

func mediaID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// mediaUpload: POST /admin/media {type, size, title}: where to put the file (a signed PUT), and where it'll be read.
func (h *Handler) mediaUpload(w http.ResponseWriter, r *http.Request) {
	if !h.Bucket.Ready() {
		httpx.Error(w, http.StatusServiceUnavailable, "le stockage des fichiers n'est pas branché : ADS_S3_* et ADS_PUBLIC_URL sur Render (comme Babi Pub)")
		return
	}
	var req struct {
		Type  string `json:"type"`
		Size  int64  `json:"size"`
		Title string `json:"title"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	m, ok := campaignMedia[req.Type]
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "envoie une image (JPG, PNG, WebP) ou une vidéo MP4")
		return
	}
	if req.Size <= 0 || req.Size > m.max {
		httpx.Error(w, http.StatusBadRequest, fmt.Sprintf("fichier trop lourd : %d Mo au plus", m.max>>20))
		return
	}
	id := mediaID()
	key := "campagnes/" + time.Now().UTC().Format("2006-01") + "/" + id + "." + m.ext
	url := h.Bucket.Public(key)
	title := strings.TrimSpace(req.Title)
	if len(title) > 120 {
		title = title[:120]
	}
	if _, err := h.DB.Exec(r.Context(), `INSERT INTO campaign_media (id, kind, url, title) VALUES ($1, $2, $3, $4)`, id, m.kind, url, title); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	out := map[string]string{"id": id, "kind": m.kind, "put": h.Bucket.Presign(http.MethodPut, key, 15*time.Minute, time.Now()), "url": url}
	if m.kind == "video" {
		out["page"] = "/regarder/" + id
	}
	httpx.JSON(w, http.StatusOK, out)
}

// mediaPoster: POST /admin/media/{id}/poster {url}: a video's poster (a picture sent here first).
func (h *Handler) mediaPoster(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL string `json:"url"`
	}
	if err := httpx.Decode(r, &req); err != nil || !strings.HasPrefix(req.URL, "https://") || len(req.URL) > 500 {
		httpx.Error(w, http.StatusBadRequest, "image invalide")
		return
	}
	tag, err := h.DB.Exec(r.Context(), `UPDATE campaign_media SET poster = $2 WHERE id = $1 AND kind = 'video'`, chi.URLParam(r, "id"), req.URL)
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "vidéo introuvable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Media: GET /media/{id} (public): a campaign's video, for its page on the site.
func (h *Handler) Media(w http.ResponseWriter, r *http.Request) {
	var kind, url, poster, title string
	err := h.DB.QueryRow(r.Context(), `SELECT kind, url, poster, title FROM campaign_media WHERE id = $1`, chi.URLParam(r, "id")).Scan(&kind, &url, &poster, &title)
	if err == pgx.ErrNoRows || (err == nil && kind != "video") {
		httpx.Error(w, http.StatusNotFound, "vidéo introuvable")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=300")
	httpx.JSON(w, http.StatusOK, map[string]string{"url": url, "poster": poster, "title": title})
}
