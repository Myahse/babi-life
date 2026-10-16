// Package ads is Babi Pub: the ads on the game's billboards. An advertiser
// contacts Babi Life first (WhatsApp, e-mail, social networks) and agrees the
// price (paid outside the game: Waye, Orange Money…); the admin then makes a
// send link (an invite, used once). With it, the advertiser sends the poster
// or video (straight into the bucket, s3.go) with where and when it should
// show; Babi Life checks it and approves it. The game shows the approved,
// paid ads of the day on the billboards of each commune, in turn, and counts
// how often they were seen (by commune and day: nobody is tracked).
package ads

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/myahse/babi-life/backend/internal/adminkey"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/waitlist"
	"github.com/myahse/babi-life/backend/internal/world"
)

// What may be sent, and how big (bytes).
var media = map[string]struct {
	kind string
	ext  string
	max  int64
}{
	"image/jpeg": {"image", "jpg", 5 << 20},
	"image/png":  {"image", "png", 5 << 20},
	"image/webp": {"image", "webp", 5 << 20},
	"video/mp4":  {"video", "mp4", 40 << 20},
}

// The longest a campaign may run, from its first day.
const maxDays = 92

type Handler struct {
	DB *pgxpool.Pool
	// Bucket keeps the files; nil or incomplete: uploads are refused (« pas encore branché »).
	Bucket *Bucket
	// AdminKey unlocks /ads/admin (ADS_ADMIN_KEY); empty: no admin.
	AdminKey string
	// Head checks a file in the bucket: its size and type (a plain HTTP HEAD on a signed URL by default).
	Head func(ctx context.Context, url string) (size int64, contentType string, err error)

	mu   sync.Mutex
	seen map[string][]time.Time // requests per IP and purpose, for the last hour
	live map[string]liveCache   // the day's ads by commune, a minute old at most
}

type liveCache struct {
	at  time.Time
	ads []LiveAd
}

// LiveAd is an ad as the game gets it.
type LiveAd struct {
	ID         string `json:"id"`
	Advertiser string `json:"advertiser"`
	Title      string `json:"title"`
	Type       string `json:"type"`
	URL        string `json:"url"`
}

// allow: at most n requests an hour from one address, for one purpose.
func (h *Handler) allow(r *http.Request, purpose string, n int) bool {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		ip = r.RemoteAddr
	}
	if f := r.Header.Get("X-Forwarded-For"); f != "" {
		ip = strings.TrimSpace(strings.Split(f, ",")[0])
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.seen == nil {
		h.seen = map[string][]time.Time{}
	}
	k := purpose + "|" + ip
	cut := time.Now().Add(-time.Hour)
	recent := h.seen[k][:0]
	for _, t := range h.seen[k] {
		if t.After(cut) {
			recent = append(recent, t)
		}
	}
	if len(recent) >= n {
		h.seen[k] = recent
		return false
	}
	h.seen[k] = append(recent, time.Now())
	return true
}

func randomID(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// Upload gives a signed URL to put one file into the bucket.
func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	if !h.Bucket.Ready() {
		httpx.Error(w, http.StatusServiceUnavailable, "Babi Pub n'est pas encore branché : réessaie bientôt")
		return
	}
	var req struct {
		Code string `json:"code"`
		Type string `json:"type"`
		Size int64  `json:"size"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if !h.inviteOpen(r.Context(), req.Code) {
		httpx.Error(w, http.StatusForbidden, errNoInvite.Error())
		return
	}
	m, ok := media[req.Type]
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "envoie une image (JPG, PNG, WebP) ou une vidéo MP4")
		return
	}
	if req.Size <= 0 || req.Size > m.max {
		httpx.Error(w, http.StatusBadRequest, fmt.Sprintf("fichier trop lourd : %d Mo au plus", m.max>>20))
		return
	}
	if !h.allow(r, "upload", 20) {
		httpx.Error(w, http.StatusTooManyRequests, "trop d'envois depuis ce réseau : réessaie plus tard")
		return
	}
	key := "ads/" + time.Now().UTC().Format("2006-01") + "/" + randomID(12) + "." + m.ext
	httpx.JSON(w, http.StatusOK, map[string]string{"key": key, "url": h.Bucket.Presign("PUT", key, 15*time.Minute, time.Now())})
}

// Campaign is what an advertiser sends.
type Campaign struct {
	Code       string   `json:"code"` // the send link's invite
	Advertiser string   `json:"advertiser"`
	Contact    string   `json:"contact"`
	Title      string   `json:"title"`
	Key        string   `json:"key"`
	Type       string   `json:"type"` // the file's MIME type
	Communes   []string `json:"communes"`
	Starts     string   `json:"starts"` // 2026-11-01
	Ends       string   `json:"ends"`
}

// clean checks a campaign and puts it in shape: trimmed words, a real
// contact, known communes, dates from today to at most maxDays.
func (c *Campaign) clean(today time.Time) (starts, ends time.Time, err error) {
	c.Advertiser, c.Title = strings.TrimSpace(c.Advertiser), strings.TrimSpace(c.Title)
	if c.Advertiser == "" || utf8.RuneCountInString(c.Advertiser) > 80 {
		return starts, ends, errors.New("le nom de l'annonceur (80 caractères au plus)")
	}
	if c.Title == "" || utf8.RuneCountInString(c.Title) > 80 {
		return starts, ends, errors.New("un titre pour la pub (80 caractères au plus)")
	}
	contact, _, err := waitlist.Contact(c.Contact)
	if err != nil {
		return starts, ends, err
	}
	c.Contact = contact
	if _, ok := media[c.Type]; !ok || !strings.HasPrefix(c.Key, "ads/") || strings.Contains(c.Key, "..") || len(c.Key) > 120 {
		return starts, ends, errors.New("le fichier de la pub manque : renvoie-le")
	}
	known := world.CommuneIDs()
	slices.Sort(c.Communes)
	c.Communes = slices.Compact(c.Communes)
	for _, id := range c.Communes {
		if !known[id] {
			return starts, ends, fmt.Errorf("commune inconnue : %s", id)
		}
	}
	if starts, err = time.Parse("2006-01-02", c.Starts); err != nil {
		return starts, ends, errors.New("la date de début")
	}
	if ends, err = time.Parse("2006-01-02", c.Ends); err != nil {
		return starts, ends, errors.New("la date de fin")
	}
	day := today.UTC().Truncate(24 * time.Hour)
	switch {
	case starts.Before(day):
		return starts, ends, errors.New("le début ne peut pas être dans le passé")
	case ends.Before(starts):
		return starts, ends, errors.New("la fin vient avant le début")
	case ends.Sub(starts) > maxDays*24*time.Hour:
		return starts, ends, fmt.Errorf("%d jours au plus par campagne", maxDays)
	case starts.Sub(day) > 365*24*time.Hour:
		return starts, ends, errors.New("le début doit être dans l'année")
	}
	return starts, ends, nil
}

// Create records a campaign (pending until Babi Life approves it) and gives
// the advertiser the private link to follow it.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var c Campaign
	if err := httpx.Decode(r, &c); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	starts, ends, err := c.clean(time.Now())
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if !h.allow(r, "campaign", 10) {
		httpx.Error(w, http.StatusTooManyRequests, "trop de campagnes depuis ce réseau : réessaie plus tard")
		return
	}
	// The file must be in the bucket, of the type and size announced.
	if h.Bucket.Ready() && h.Head != nil {
		size, ct, err := h.Head(r.Context(), h.Bucket.Presign("HEAD", c.Key, 5*time.Minute, time.Now()))
		m := media[c.Type]
		if err != nil || size <= 0 || size > m.max || (ct != "" && !strings.HasPrefix(ct, c.Type)) {
			httpx.Error(w, http.StatusBadRequest, "le fichier n'est pas arrivé : renvoie-le")
			return
		}
	}
	// The invite is used up with the campaign, both or neither.
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "enregistrement impossible")
		return
	}
	defer tx.Rollback(r.Context())
	tag, err := tx.Exec(r.Context(), `UPDATE ad_invites SET used_at = now() WHERE code = $1 AND used_at IS NULL`, c.Code)
	if err != nil || tag.RowsAffected() != 1 {
		httpx.Error(w, http.StatusForbidden, errNoInvite.Error())
		return
	}
	token := randomID(18)
	var id string
	err = tx.QueryRow(r.Context(), `
		INSERT INTO ad_campaigns (token, advertiser, contact, title, media_key, media_type, communes, starts, ends)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
		token, c.Advertiser, c.Contact, c.Title, c.Key, media[c.Type].kind, c.Communes, starts, ends).Scan(&id)
	if err == nil {
		_, err = tx.Exec(r.Context(), `UPDATE ad_invites SET campaign_id = $2 WHERE code = $1`, c.Code, id)
	}
	if err == nil {
		err = tx.Commit(r.Context())
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "enregistrement impossible")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"id": id, "token": token, "status": "pending"})
}

// Status is a campaign as its advertiser (or the admin) sees it.
type Status struct {
	ID         string         `json:"id"`
	Token      string         `json:"token,omitempty"`
	Advertiser string         `json:"advertiser"`
	Contact    string         `json:"contact,omitempty"`
	Title      string         `json:"title"`
	Type       string         `json:"type"`
	URL        string         `json:"url"`
	Communes   []string       `json:"communes"`
	Starts     string         `json:"starts"`
	Ends       string         `json:"ends"`
	Status     string         `json:"status"`
	Paid       bool           `json:"paid"`
	Price      int            `json:"price"`
	Note       string         `json:"note"`
	Views      int            `json:"views"`
	ByCommune  map[string]int `json:"byCommune"`
	CreatedAt  time.Time      `json:"createdAt"`
}

const statusColumns = `c.id, c.token, c.advertiser, c.contact, c.title, c.media_type, c.media_key, c.communes, c.starts, c.ends, c.status, c.paid, c.price, c.note, c.created_at`

func (h *Handler) scanStatus(row pgx.Row) (Status, error) {
	var s Status
	var key string
	var starts, ends time.Time
	if err := row.Scan(&s.ID, &s.Token, &s.Advertiser, &s.Contact, &s.Title, &s.Type, &key, &s.Communes, &starts, &ends, &s.Status, &s.Paid, &s.Price, &s.Note, &s.CreatedAt); err != nil {
		return s, err
	}
	s.Starts, s.Ends = starts.Format("2006-01-02"), ends.Format("2006-01-02")
	if h.Bucket.Ready() {
		s.URL = h.Bucket.Public(key)
	}
	return s, nil
}

// views: the views of some campaigns, in total and by commune.
func (h *Handler) views(ctx context.Context, list []Status) error {
	if len(list) == 0 {
		return nil
	}
	ids := make([]string, len(list))
	at := map[string]*Status{}
	for i := range list {
		ids[i] = list[i].ID
		list[i].ByCommune = map[string]int{}
		at[list[i].ID] = &list[i]
	}
	rows, err := h.DB.Query(ctx, `SELECT campaign_id::text, commune, sum(views) FROM ad_views WHERE campaign_id = ANY($1::uuid[]) GROUP BY 1, 2`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id, commune string
		var n int
		if err := rows.Scan(&id, &commune, &n); err != nil {
			return err
		}
		at[id].ByCommune[commune] = n
		at[id].Views += n
	}
	return rows.Err()
}

// Follow shows a campaign to whoever has its private link.
func (h *Handler) Follow(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if len(token) < 20 {
		httpx.Error(w, http.StatusNotFound, "campagne introuvable")
		return
	}
	s, err := h.scanStatus(h.DB.QueryRow(r.Context(), `SELECT `+statusColumns+` FROM ad_campaigns c WHERE c.token = $1`, token))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "campagne introuvable")
		return
	}
	list := []Status{s}
	if err := h.views(r.Context(), list); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "vues indisponibles")
		return
	}
	list[0].Token, list[0].Contact = "", ""
	httpx.JSON(w, http.StatusOK, list[0])
}

// Shows: does an ad run in this commune on this day?
func Shows(status string, paid bool, communes []string, starts, ends time.Time, commune string, day time.Time) bool {
	d := day.UTC().Truncate(24 * time.Hour)
	return status == "approved" && paid && !d.Before(starts) && !d.After(ends) && (len(communes) == 0 || slices.Contains(communes, commune))
}

// Live gives the game the ads of the day for a commune.
func (h *Handler) Live(w http.ResponseWriter, r *http.Request) {
	commune := r.URL.Query().Get("commune")
	if !world.CommuneIDs()[commune] || !h.Bucket.Ready() {
		httpx.JSON(w, http.StatusOK, []LiveAd{})
		return
	}
	h.mu.Lock()
	c, ok := h.live[commune]
	h.mu.Unlock()
	if ok && time.Since(c.at) < time.Minute {
		httpx.JSON(w, http.StatusOK, c.ads)
		return
	}
	rows, err := h.DB.Query(r.Context(), `
		SELECT id::text, advertiser, title, media_type, media_key, status, paid, communes, starts, ends FROM ad_campaigns
		WHERE status = 'approved' AND paid AND starts <= current_date AND ends >= current_date ORDER BY created_at`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "pubs indisponibles")
		return
	}
	defer rows.Close()
	ads := []LiveAd{}
	for rows.Next() {
		var a LiveAd
		var key, status string
		var paid bool
		var communes []string
		var starts, ends time.Time
		if err := rows.Scan(&a.ID, &a.Advertiser, &a.Title, &a.Type, &key, &status, &paid, &communes, &starts, &ends); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "pubs indisponibles")
			return
		}
		if Shows(status, paid, communes, starts, ends, commune, time.Now()) {
			a.URL = h.Bucket.Public(key)
			ads = append(ads, a)
		}
	}
	h.mu.Lock()
	if h.live == nil {
		h.live = map[string]liveCache{}
	}
	h.live[commune] = liveCache{time.Now(), ads}
	h.mu.Unlock()
	httpx.JSON(w, http.StatusOK, ads)
}

// Viewed adds the views a player's game counted: {commune, views: {campaign id: n}}.
func (h *Handler) Viewed(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Commune string         `json:"commune"`
		Views   map[string]int `json:"views"`
	}
	if err := httpx.Decode(r, &req); err != nil || !world.CommuneIDs()[req.Commune] || len(req.Views) > 20 {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if !h.allow(r, "views", 240) {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	for id, n := range req.Views {
		// A minute of play shows a board a few times, not hundreds.
		n = min(max(n, 0), 30)
		if n == 0 {
			continue
		}
		_, _ = h.DB.Exec(r.Context(), `
			INSERT INTO ad_views (campaign_id, commune, day, views)
			SELECT id, $2, current_date, $3 FROM ad_campaigns WHERE id::text = $1 AND status = 'approved'
			ON CONFLICT (campaign_id, commune, day) DO UPDATE SET views = ad_views.views + EXCLUDED.views`, id, req.Commune, n)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) admin(w http.ResponseWriter, r *http.Request) bool {
	if !adminkey.OK(r, h.AdminKey) {
		httpx.Error(w, http.StatusUnauthorized, "clé admin invalide")
		return false
	}
	return true
}

// AdminList: every campaign, newest first, with its views.
func (h *Handler) AdminList(w http.ResponseWriter, r *http.Request) {
	if !h.admin(w, r) {
		return
	}
	rows, err := h.DB.Query(r.Context(), `SELECT `+statusColumns+` FROM ad_campaigns c ORDER BY c.created_at DESC LIMIT 500`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "liste indisponible")
		return
	}
	list := []Status{}
	for rows.Next() {
		s, err := h.scanStatus(rows)
		if err != nil {
			rows.Close()
			httpx.Error(w, http.StatusInternalServerError, "liste indisponible")
			return
		}
		list = append(list, s)
	}
	rows.Close()
	if err := h.views(r.Context(), list); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "vues indisponibles")
		return
	}
	httpx.JSON(w, http.StatusOK, list)
}

// AdminUpdate: approve, refuse or pause a campaign, mark it paid, set its price, leave a note.
func (h *Handler) AdminUpdate(w http.ResponseWriter, r *http.Request) {
	if !h.admin(w, r) {
		return
	}
	var req struct {
		Status *string `json:"status"`
		Paid   *bool   `json:"paid"`
		Price  *int    `json:"price"`
		Note   *string `json:"note"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if req.Status != nil && !slices.Contains([]string{"pending", "approved", "rejected", "paused"}, *req.Status) {
		httpx.Error(w, http.StatusBadRequest, "statut inconnu")
		return
	}
	if req.Price != nil && (*req.Price < 0 || *req.Price > 100_000_000) {
		httpx.Error(w, http.StatusBadRequest, "prix invalide")
		return
	}
	tag, err := h.DB.Exec(r.Context(), `
		UPDATE ad_campaigns SET status = COALESCE($2, status), paid = COALESCE($3, paid), price = COALESCE($4, price), note = COALESCE($5, note)
		WHERE id::text = $1`, chi.URLParam(r, "id"), req.Status, req.Paid, req.Price, req.Note)
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "campagne introuvable")
		return
	}
	// The game sees the change within the minute.
	h.mu.Lock()
	h.live = nil
	h.mu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

var errNoInvite = errors.New("ce lien d'envoi n'est pas (ou plus) valable : contacte Babi Life")

// inviteOpen: is this a send link that hasn't been used yet?
func (h *Handler) inviteOpen(ctx context.Context, code string) bool {
	if len(code) < 12 || len(code) > 64 {
		return false
	}
	var ok bool
	err := h.DB.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM ad_invites WHERE code = $1 AND used_at IS NULL)`, code).Scan(&ok)
	return err == nil && ok
}

// Invite tells the send page whether its link still works, and for whom.
func (h *Handler) Invite(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if !h.allow(r, "invite", 120) || !h.inviteOpen(r.Context(), code) {
		httpx.Error(w, http.StatusNotFound, errNoInvite.Error())
		return
	}
	var label string
	_ = h.DB.QueryRow(r.Context(), `SELECT label FROM ad_invites WHERE code = $1`, code).Scan(&label)
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "label": label, "ready": h.Bucket.Ready()})
}

// InviteRow is a send link, as the admin sees it.
type InviteRow struct {
	Code      string     `json:"code"`
	Label     string     `json:"label"`
	CreatedAt time.Time  `json:"createdAt"`
	UsedAt    *time.Time `json:"usedAt"`
	Campaign  *string    `json:"campaign"`
}

// AdminInvites: the send links, newest first.
func (h *Handler) AdminInvites(w http.ResponseWriter, r *http.Request) {
	if !h.admin(w, r) {
		return
	}
	rows, err := h.DB.Query(r.Context(), `SELECT code, label, created_at, used_at, campaign_id::text FROM ad_invites ORDER BY created_at DESC LIMIT 200`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "liste indisponible")
		return
	}
	defer rows.Close()
	list := []InviteRow{}
	for rows.Next() {
		var i InviteRow
		if err := rows.Scan(&i.Code, &i.Label, &i.CreatedAt, &i.UsedAt, &i.Campaign); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "liste indisponible")
			return
		}
		list = append(list, i)
	}
	httpx.JSON(w, http.StatusOK, list)
}

// AdminInvite makes a send link for an advertiser Babi Life has agreed with.
func (h *Handler) AdminInvite(w http.ResponseWriter, r *http.Request) {
	if !h.admin(w, r) {
		return
	}
	var req struct {
		Label string `json:"label"`
	}
	if err := httpx.Decode(r, &req); err != nil || utf8.RuneCountInString(strings.TrimSpace(req.Label)) > 120 {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	code := randomID(15)
	if _, err := h.DB.Exec(r.Context(), `INSERT INTO ad_invites (code, label) VALUES ($1, $2)`, code, strings.TrimSpace(req.Label)); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "création impossible")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"code": code})
}

// HeadHTTP checks a file with a plain HEAD request.
func HeadHTTP(ctx context.Context, url string) (int64, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
	if err != nil {
		return 0, "", err
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, "", err
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return 0, "", fmt.Errorf("HEAD %d", res.StatusCode)
	}
	return res.ContentLength, res.Header.Get("Content-Type"), nil
}
