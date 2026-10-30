package admin

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Notifications from /admin (« Notifications »), modelled on the e-mails
// (email.go): a title, a text, a picture and a page of the game if wanted, a
// test to one account first, then to an audience in the background, one
// player at a time (all their phones and browsers: push.Deliver), followed
// live and stoppable. An update opened with « Prévenir les joueurs » goes the
// same way. A few a day at most: notifications that come too often get
// turned off, and then nothing reaches anyone.

// Pusher: what the page needs of the notifications (push.Service).
type Pusher interface {
	Ways() (web, app bool)
	Counts(ctx context.Context) (web, app, users int, err error)
	Deliver(ctx context.Context, user string, m push.Message) (delivered, failed int)
}

const (
	// PushPerDay: the campaigns to an audience (updates' notices included) in 24 hours.
	PushPerDay = 3
	// PushTestsPerDay: the tests to one account in 24 hours.
	PushTestsPerDay = 20
	// pushMaxDays: « actifs ces N derniers jours », N at most.
	pushMaxDays = 90
)

// pushGap: the pause between two players.
var pushGap = 40 * time.Millisecond

// pushAudiences: who a campaign goes to, as the page shows them (always among those who took the notifications).
var pushAudiences = map[string]string{
	"tous":     "tous ceux qui ont les notifications",
	"actifs":   "les joueurs actifs ces derniers jours",
	"commune":  "les joueurs d'une commune",
	"adultes":  "les adultes (18 ans et plus)",
	"testeurs": "les testeurs",
}

type pushRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	// Image: a picture sent from the page (the bucket's https address), "" for none.
	Image string `json:"image"`
	// URL: the page of the game a tap opens (/jeu, /jeu?app=gbairai…).
	URL      string `json:"url"`
	Audience string `json:"audience"`
	// Days: for « actifs »; Commune: for « commune ».
	Days    int    `json:"days"`
	Commune string `json:"commune"`
	// Test: only to this account (its e-mail, pseudo or ID).
	Test string `json:"test,omitempty"`
}

// clean: the words trimmed and checked, the link the game by default.
func (q *pushRequest) clean() error {
	q.Title, q.Body, q.Image, q.URL = strings.TrimSpace(q.Title), strings.TrimSpace(q.Body), strings.TrimSpace(q.Image), strings.TrimSpace(q.URL)
	if q.Title == "" || q.Body == "" {
		return fmt.Errorf("il faut un titre et un texte")
	}
	if utf8.RuneCountInString(q.Title) > 65 {
		return fmt.Errorf("titre trop long (65 caractères au plus)")
	}
	if utf8.RuneCountInString(q.Body) > 240 {
		return fmt.Errorf("texte trop long (240 caractères au plus)")
	}
	if q.URL == "" {
		q.URL = "/jeu"
	}
	if !strings.HasPrefix(q.URL, "/") || strings.HasPrefix(q.URL, "//") || len(q.URL) > 300 {
		return fmt.Errorf("le lien doit être une page du site (/jeu, /jeu?app=gbairai…)")
	}
	if q.Image != "" && (!strings.HasPrefix(q.Image, "https://") || len(q.Image) > 500) {
		return fmt.Errorf("l'image doit être envoyée d'ici (une adresse https://)")
	}
	return nil
}

// message: the notification of a campaign (its own tag: two campaigns don't replace each other).
func (q pushRequest) message(id int64) push.Message {
	return push.Message{Title: q.Title, Body: q.Body, URL: q.URL, Image: q.Image, Tag: "campagne-" + strconv.FormatInt(id, 10)}
}

// pushAudience: the query of an audience's players (those with at least one
// phone or browser that takes notifications), and what the campaign keeps of it.
func pushAudience(audience string, days int, commune string) (query string, args []any, detail string, err error) {
	var cond string
	switch audience {
	case "tous":
		cond = "true"
	case "actifs":
		if days < 1 || days > pushMaxDays {
			return "", nil, "", fmt.Errorf("le nombre de jours va de 1 à %d", pushMaxDays)
		}
		cond = `(u.last_login_at > now() - make_interval(days => $1::int)
			OR EXISTS (SELECT 1 FROM sims s WHERE s.user_id = u.id AND s.last_tick > now() - make_interval(days => $1::int)))`
		args, detail = []any{days}, strconv.Itoa(days)
	case "commune":
		if !world.CommuneIDs()[commune] {
			return "", nil, "", fmt.Errorf("commune inconnue")
		}
		cond = `EXISTS (SELECT 1 FROM sims s WHERE s.user_id = u.id AND s.home_commune = $1)`
		args, detail = []any{commune}, commune
	case "adultes":
		cond = "u.adult_at IS NOT NULL"
	case "testeurs":
		cond = "u.tester"
	default:
		return "", nil, "", fmt.Errorf("public inconnu")
	}
	return `SELECT DISTINCT p.user_id::text FROM push_subs p JOIN users u ON u.id = p.user_id WHERE ` + cond + ` ORDER BY 1`, args, detail, nil
}

// pushUsers: the players of an audience.
func (h *Handler) pushUsers(ctx context.Context, audience string, days int, commune string) ([]string, error) {
	q, args, _, err := pushAudience(audience, days, commune)
	if err != nil {
		return nil, err
	}
	rows, err := h.DB.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// pushLimit: refused past the day's campaigns (or tests).
func (h *Handler) pushLimit(ctx context.Context, test bool) error {
	var n int
	if err := h.DB.QueryRow(ctx, `SELECT count(*) FROM push_campaigns WHERE test = $1 AND created_at > now() - interval '24 hours'`, test).Scan(&n); err != nil {
		return fmt.Errorf("database unavailable")
	}
	return overLimit(n, test)
}

// overLimit: n sent in the last 24 hours, one more is too many.
func overLimit(n int, test bool) error {
	if test && n >= PushTestsPerDay {
		return fmt.Errorf("déjà %d tests en 24 h : réessaie plus tard", n)
	}
	if !test && n >= PushPerDay {
		return fmt.Errorf("déjà %d notifications envoyées en 24 h : c'est le maximum, pour que les joueurs ne les coupent pas (réessaie demain)", n)
	}
	return nil
}

func (h *Handler) pushReady() bool {
	if h.Push == nil {
		return false
	}
	web, app := h.Push.Ways()
	return web || app
}

const pushOff = "les notifications ne sont pas branchées : VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY (le site), FCM_SERVICE_ACCOUNT (l'appli Android) sur Render"

func (h *Handler) notifyRoutes(r chi.Router) {
	r.Get("/notify", h.notifyStatus)
	r.Post("/notify", h.notifySend)
	r.Post("/notify/{id}/stop", h.notifyStop)
	r.Post("/media", h.mediaUpload)
	r.Post("/media/{id}/poster", h.mediaPoster)
}

type pushCampaign struct {
	ID       int64     `json:"id"`
	Title    string    `json:"title"`
	Body     string    `json:"body"`
	Image    string    `json:"image,omitempty"`
	URL      string    `json:"url"`
	Audience string    `json:"audience"`
	Detail   string    `json:"detail,omitempty"`
	Source   string    `json:"source"`
	Test     bool      `json:"test"`
	Total    int       `json:"total"`
	Sent     int       `json:"sent"`
	Failed   int       `json:"failed"`
	Devices  int       `json:"devices"`
	Status   string    `json:"status"`
	At       time.Time `json:"at"`
}

// notifyStatus: GET /admin/notify?days=&commune=: what's set up, the subscriptions, each audience's players, the last campaigns.
func (h *Handler) notifyStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	out := map[string]any{"audiences": pushAudiences, "limit": PushPerDay, "testsLimit": PushTestsPerDay}
	if h.Push != nil {
		web, app := h.Push.Ways()
		out["web"], out["app"] = web, app
		sw, sa, su, err := h.Push.Counts(ctx)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		out["subs"] = map[string]int{"web": sw, "app": sa, "users": su}
	}
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days == 0 {
		days = 7
	}
	commune := r.URL.Query().Get("commune")
	counts := map[string]int{}
	for a := range pushAudiences {
		q, args, _, err := pushAudience(a, days, commune)
		if err != nil {
			continue
		}
		var n int
		if h.DB.QueryRow(ctx, `SELECT count(*) FROM (`+q+`) x`, args...).Scan(&n) == nil {
			counts[a] = n
		}
	}
	out["counts"] = counts
	// Every commune, the players with notifications in each.
	byCommune := map[string]int{}
	if rows, err := h.DB.Query(ctx, `SELECT s.home_commune, count(DISTINCT p.user_id) FROM push_subs p JOIN sims s ON s.user_id = p.user_id GROUP BY 1`); err == nil {
		for rows.Next() {
			var c string
			var n int
			if rows.Scan(&c, &n) == nil {
				byCommune[c] = n
			}
		}
		rows.Close()
	}
	type commune_ struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Players int    `json:"players"`
	}
	communes := []commune_{}
	for _, c := range world.Cities {
		for _, cm := range c.Communes {
			communes = append(communes, commune_{ID: cm.ID, Name: cm.Name, Players: byCommune[cm.ID]})
		}
	}
	sort.Slice(communes, func(i, j int) bool { return communes[i].Name < communes[j].Name })
	out["communes"] = communes
	camps := []pushCampaign{}
	if rows, err := h.DB.Query(ctx, `SELECT id, title, body, image, url, audience, detail, source, test, total, sent, failed, devices, status, created_at FROM push_campaigns ORDER BY id DESC LIMIT 20`); err == nil {
		for rows.Next() {
			var c pushCampaign
			if rows.Scan(&c.ID, &c.Title, &c.Body, &c.Image, &c.URL, &c.Audience, &c.Detail, &c.Source, &c.Test, &c.Total, &c.Sent, &c.Failed, &c.Devices, &c.Status, &c.At) == nil {
				camps = append(camps, c)
			}
		}
		rows.Close()
	}
	out["campaigns"] = camps
	var today, tests int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FILTER (WHERE NOT test), count(*) FILTER (WHERE test) FROM push_campaigns WHERE created_at > now() - interval '24 hours'`).Scan(&today, &tests)
	out["today"], out["tests"] = today, tests
	httpx.JSON(w, http.StatusOK, out)
}

// notifySend: POST /admin/notify: a test to one account, or a campaign to an audience in the background.
func (h *Handler) notifySend(w http.ResponseWriter, r *http.Request) {
	var req pushRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if !h.pushReady() {
		httpx.Error(w, http.StatusServiceUnavailable, pushOff)
		return
	}
	if err := req.clean(); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx := r.Context()
	if req.Test != "" {
		text, code, err := h.pushTest(ctx, req)
		if err != nil {
			httpx.Error(w, code, err.Error())
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]string{"text": text})
		return
	}
	id, total, code, err := h.pushStart(ctx, req, "admin")
	if err != nil {
		httpx.Error(w, code, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"id": id, "total": total})
}

// pushTest: the notification to one account only, now.
func (h *Handler) pushTest(ctx context.Context, req pushRequest) (string, int, error) {
	who := strings.TrimSpace(req.Test)
	var user, name string
	err := h.DB.QueryRow(ctx, `SELECT id::text, name FROM users WHERE id::text = $1 OR lower(email) = lower($1) OR lower(username) = lower($1) ORDER BY (id::text = $1) DESC LIMIT 1`, who).Scan(&user, &name)
	if err != nil {
		return "", http.StatusNotFound, fmt.Errorf("aucun compte avec cette adresse, ce pseudo ou cet identifiant")
	}
	if err := h.pushLimit(ctx, true); err != nil {
		return "", http.StatusTooManyRequests, err
	}
	var subs int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM push_subs WHERE user_id = $1`, user).Scan(&subs)
	if subs == 0 {
		return "", http.StatusBadRequest, fmt.Errorf("%s n'a activé les notifications sur aucun téléphone ni navigateur : ouvre le jeu avec ce compte et touche « Activer »", name)
	}
	var id int64
	if err := h.DB.QueryRow(ctx, `INSERT INTO push_campaigns (title, body, image, url, audience, detail, source, test, total) VALUES ($1, $2, $3, $4, 'test', $5, 'admin', true, 1) RETURNING id`,
		req.Title, req.Body, req.Image, req.URL, name).Scan(&id); err != nil {
		return "", http.StatusInternalServerError, fmt.Errorf("database unavailable")
	}
	m := req.message(id)
	m.Title = "[Test] " + m.Title
	got, bad := h.Push.Deliver(ctx, user, m)
	sent, failed := 0, 0
	if got > 0 {
		sent = 1
	} else {
		failed = 1
	}
	_, _ = h.DB.Exec(ctx, `UPDATE push_campaigns SET sent = $2, failed = $3, devices = $4, status = 'done' WHERE id = $1`, id, sent, failed, got)
	h.Log(ctx, "Notification : test envoyé", req.Title)
	if got == 0 {
		return "", http.StatusBadGateway, fmt.Errorf("aucun appareil n'a pris la notification (%d refusés : l'abonnement a peut-être expiré, réactive les notifications dans le jeu)", bad)
	}
	text := fmt.Sprintf("Notification de test envoyée à %s sur %d appareil(s).", name, got)
	if bad > 0 {
		text += fmt.Sprintf(" %d autre(s) l'ont refusée.", bad)
	}
	return text, http.StatusOK, nil
}

// pushStart: a campaign to an audience, in the background; its id, its players, or why not (and the status to answer).
func (h *Handler) pushStart(ctx context.Context, req pushRequest, source string) (int64, int, int, error) {
	if !h.pushReady() {
		return 0, 0, http.StatusServiceUnavailable, fmt.Errorf("%s", pushOff)
	}
	_, _, detail, err := pushAudience(req.Audience, req.Days, req.Commune)
	if err != nil {
		return 0, 0, http.StatusBadRequest, err
	}
	var running bool
	// (One left « running » by a restart of the API, hours ago, is over.)
	_, _ = h.DB.Exec(ctx, `UPDATE push_campaigns SET status = 'stopped' WHERE status = 'running' AND created_at < now() - interval '2 hours'`)
	_ = h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM push_campaigns WHERE status = 'running' AND NOT test)`).Scan(&running)
	if running {
		return 0, 0, http.StatusConflict, fmt.Errorf("un envoi est déjà en cours : attends qu'il finisse, ou arrête-le")
	}
	if err := h.pushLimit(ctx, false); err != nil {
		return 0, 0, http.StatusTooManyRequests, err
	}
	users, err := h.pushUsers(ctx, req.Audience, req.Days, req.Commune)
	if err != nil {
		return 0, 0, http.StatusInternalServerError, fmt.Errorf("database unavailable")
	}
	if len(users) == 0 {
		return 0, 0, http.StatusBadRequest, fmt.Errorf("personne dans ce public n'a activé les notifications")
	}
	var id int64
	if err := h.DB.QueryRow(ctx, `INSERT INTO push_campaigns (title, body, image, url, audience, detail, source, total) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
		req.Title, req.Body, req.Image, req.URL, req.Audience, detail, source, len(users)).Scan(&id); err != nil {
		return 0, 0, http.StatusInternalServerError, fmt.Errorf("database unavailable")
	}
	h.Log(ctx, "Notification : envoi lancé", fmt.Sprintf("« %s » à %d joueurs (%s)", req.Title, len(users), pushAudiences[req.Audience]))
	go h.pushRun(id, req.message(id), users)
	return id, len(users), http.StatusOK, nil
}

// pushRun sends a campaign one player at a time, and stops when asked.
func (h *Handler) pushRun(id int64, m push.Message, users []string) {
	ctx := context.Background()
	for _, u := range users {
		var status string
		if h.DB.QueryRow(ctx, `SELECT status FROM push_campaigns WHERE id = $1`, id).Scan(&status) != nil || status != "running" {
			return
		}
		one, cancel := context.WithTimeout(ctx, 30*time.Second)
		got, _ := h.Push.Deliver(one, u, m)
		cancel()
		if got > 0 {
			_, _ = h.DB.Exec(ctx, `UPDATE push_campaigns SET sent = sent + 1, devices = devices + $2 WHERE id = $1`, id, got)
		} else {
			_, _ = h.DB.Exec(ctx, `UPDATE push_campaigns SET failed = failed + 1 WHERE id = $1`, id)
		}
		time.Sleep(pushGap)
	}
	_, _ = h.DB.Exec(ctx, `UPDATE push_campaigns SET status = 'done' WHERE id = $1 AND status = 'running'`, id)
	h.Log(ctx, "Notification : envoi terminé", "campagne "+strconv.FormatInt(id, 10))
}

func (h *Handler) notifyStop(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_, _ = h.DB.Exec(r.Context(), `UPDATE push_campaigns SET status = 'stopped' WHERE id = $1 AND status = 'running'`, id)
	h.Log(r.Context(), "Notification : envoi arrêté", "campagne "+strconv.FormatInt(id, 10))
	httpx.JSON(w, http.StatusOK, map[string]bool{"stopped": true})
}

// featureNotify: « Prévenir les joueurs » when an update opens (off by default: it can open silently).
type featureNotify struct {
	Send  bool   `json:"send"`
	Title string `json:"title"`
	Body  string `json:"body"`
	Image string `json:"image"`
}

// featureNotice: the notification an update's opening sends, if asked: its
// words as written (its name and its « about » when left empty), to everyone,
// opening its app when it is one.
func featureNotice(f features.Feature, open bool, n *featureNotify) (pushRequest, bool) {
	if !open || n == nil || !n.Send {
		return pushRequest{}, false
	}
	q := pushRequest{Title: strings.TrimSpace(n.Title), Body: strings.TrimSpace(n.Body), Image: n.Image, Audience: "tous", URL: "/jeu"}
	if q.Title == "" {
		q.Title = cut("Nouveau : "+f.Label, 65)
	}
	if q.Body == "" {
		q.Body = cut(f.About, 240)
	}
	for _, k := range f.Keys {
		if app, ok := strings.CutPrefix(k, "app:"); ok {
			q.URL = "/jeu?app=" + url.QueryEscape(app)
			break
		}
	}
	return q, true
}

// cut: at most n letters, « … » at the end when cut.
func cut(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n-1]) + "…"
}

// noticeOnOpen: an update just opened, its players told if asked (the campaigns' path, its limit too): what to tell the team.
func (h *Handler) noticeOnOpen(ctx context.Context, f features.Feature, open bool, n *featureNotify) string {
	q, ok := featureNotice(f, open, n)
	if !ok {
		return ""
	}
	if err := q.clean(); err != nil {
		return "Notification non envoyée : " + err.Error()
	}
	_, total, _, err := h.pushStart(ctx, q, "maj:"+f.ID)
	if err != nil {
		return "Notification non envoyée : " + err.Error()
	}
	return fmt.Sprintf("Notification en route vers %d joueurs.", total)
}
