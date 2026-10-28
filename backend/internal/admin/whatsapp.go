package admin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// WhatsApp to the wish list, through WhatsApp's official API (Meta's Cloud
// API: WHATSAPP_TOKEN and WHATSAPP_PHONE_ID on Render). WhatsApp only lets a
// business write first with a template it has approved (made in Meta's
// WhatsApp Manager), so a campaign sends a template, its {{1}} filled with
// the person's first name. People signed up « to hear when Babi Life
// opens », not for ads: the page says so, and keeps a list of the numbers
// that asked to stop (wa_optout), never written to again.
// Without the API, the page lists click-to-chat links (wa.me) to send by hand.

type WhatsApp struct {
	Token   string
	PhoneID string
	// API is the Graph API's address (tests point it elsewhere).
	API    string
	Client *http.Client
	// Gap between two messages: well under WhatsApp's rate limits.
	Gap time.Duration
}

func (wa *WhatsApp) Configured() bool { return wa != nil && wa.Token != "" && wa.PhoneID != "" }

var reTemplate = regexp.MustCompile(`^[a-z0-9_]{1,512}$`)
var reLang = regexp.MustCompile(`^[a-z]{2}(_[A-Z]{2})?$`)

// send: one template message to one number (digits, with or without +).
func (wa *WhatsApp) send(ctx context.Context, to, template, lang, firstName string) error {
	body := map[string]any{
		"messaging_product": "whatsapp",
		"to":                strings.TrimPrefix(to, "+"),
		"type":              "template",
		"template": map[string]any{
			"name":     template,
			"language": map[string]string{"code": lang},
		},
	}
	if firstName != "" {
		body["template"].(map[string]any)["components"] = []any{map[string]any{
			"type": "body", "parameters": []any{map[string]string{"type": "text", "text": firstName}},
		}}
	}
	raw, _ := json.Marshal(body)
	api := wa.API
	if api == "" {
		api = "https://graph.facebook.com/v21.0"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, api+"/"+wa.PhoneID+"/messages", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+wa.Token)
	req.Header.Set("Content-Type", "application/json")
	c := wa.Client
	if c == nil {
		c = &http.Client{Timeout: 15 * time.Second}
	}
	res, err := c.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		var e struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		b, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
		if json.Unmarshal(b, &e) == nil && e.Error.Message != "" {
			return errors.New(e.Error.Message)
		}
		return fmt.Errorf("WhatsApp a répondu %d", res.StatusCode)
	}
	return nil
}

type recipient struct {
	FirstName string `json:"firstName"`
	Contact   string `json:"contact"`
	Beta      bool   `json:"beta"`
}

// recipients: the wish list's WhatsApp numbers (all, or those who want to test), minus those who said stop,
// and (for a template) those it already went to: a campaign sent again picks up where it stopped.
func (h *Handler) recipients(ctx context.Context, audience string, template ...string) ([]recipient, error) {
	tpl := ""
	if len(template) > 0 {
		tpl = template[0]
	}
	rows, err := h.DB.Query(ctx, `SELECT first_name, contact, beta FROM waitlist w
		WHERE kind = 'phone' AND ($1 <> 'beta' OR beta) AND NOT EXISTS(SELECT 1 FROM wa_optout o WHERE o.contact = w.contact)
			AND NOT EXISTS(SELECT 1 FROM wa_sends s JOIN wa_campaigns c ON c.id = s.campaign WHERE $2 <> '' AND c.template = $2 AND s.contact = w.contact AND s.status = 'sent')
		ORDER BY created_at`, audience, tpl)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []recipient{}
	for rows.Next() {
		var x recipient
		if err := rows.Scan(&x.FirstName, &x.Contact, &x.Beta); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

// waStatus: is the API set up, how many numbers, the campaigns; ?numbers=1 adds the list (for sending by hand).
func (h *Handler) waStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	list, err := h.recipients(ctx, "liste")
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	beta := 0
	for _, x := range list {
		if x.Beta {
			beta++
		}
	}
	type campaign struct {
		ID       int64     `json:"id"`
		Template string    `json:"template"`
		Audience string    `json:"audience"`
		Total    int       `json:"total"`
		Sent     int       `json:"sent"`
		Failed   int       `json:"failed"`
		Status   string    `json:"status"`
		At       time.Time `json:"at"`
		Errors   []string  `json:"errors,omitempty"`
		// A campaign set for later: when it starts by itself.
		SendAt *time.Time `json:"sendAt,omitempty"`
	}
	camps := []campaign{}
	rows, err := h.DB.Query(ctx, `SELECT id, template, audience, total, sent, failed, status, created_at, send_at FROM wa_campaigns ORDER BY id DESC LIMIT 20`)
	if err == nil {
		for rows.Next() {
			var c campaign
			if rows.Scan(&c.ID, &c.Template, &c.Audience, &c.Total, &c.Sent, &c.Failed, &c.Status, &c.At, &c.SendAt) == nil {
				camps = append(camps, c)
			}
		}
		rows.Close()
	}
	for i := range camps {
		if camps[i].Failed == 0 {
			continue
		}
		er, err := h.DB.Query(ctx, `SELECT DISTINCT error FROM wa_sends WHERE campaign = $1 AND status = 'failed' LIMIT 3`, camps[i].ID)
		if err == nil {
			for er.Next() {
				var s string
				if er.Scan(&s) == nil {
					camps[i].Errors = append(camps[i].Errors, s)
				}
			}
			er.Close()
		}
	}
	var optouts int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM wa_optout`).Scan(&optouts)
	out := map[string]any{"configured": h.WA.Configured(), "numbers": len(list), "beta": beta, "optouts": optouts, "campaigns": camps}
	if r.URL.Query().Get("numbers") == "1" {
		out["list"] = list
	}
	httpx.JSON(w, http.StatusOK, out)
}

// waSend: a test to one number (« test »), or a campaign to the wish list in the background.
func (h *Handler) waSend(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Template string `json:"template"`
		Lang     string `json:"lang"`
		Audience string `json:"audience"` // 'liste' | 'beta'
		Test     string `json:"test"`     // a number: only to it
		// Later, by itself (RFC 3339): the game's opening, say. Empty: now.
		At string `json:"at"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if !h.WA.Configured() {
		httpx.Error(w, http.StatusServiceUnavailable, "WhatsApp n'est pas branché : ajoute WHATSAPP_TOKEN et WHATSAPP_PHONE_ID sur Render")
		return
	}
	if req.Lang == "" {
		req.Lang = "fr"
	}
	if !reTemplate.MatchString(req.Template) || !reLang.MatchString(req.Lang) {
		httpx.Error(w, http.StatusBadRequest, "nom du modèle (minuscules, chiffres, _) ou langue (fr, en_US…) invalide")
		return
	}
	ctx := r.Context()
	if req.Test != "" {
		num := "+" + strings.Map(func(c rune) rune {
			if c >= '0' && c <= '9' {
				return c
			}
			return -1
		}, req.Test)
		if len(num) < 9 {
			httpx.Error(w, http.StatusBadRequest, "numéro de test invalide")
			return
		}
		if err := h.WA.send(ctx, num, req.Template, req.Lang, h.testName(ctx, num)); err != nil {
			httpx.Error(w, http.StatusBadGateway, "WhatsApp : "+err.Error())
			return
		}
		h.Log(ctx, "WhatsApp : test envoyé", req.Template)
		httpx.JSON(w, http.StatusOK, map[string]string{"text": "Message de test envoyé."})
		return
	}
	if req.Audience != "beta" {
		req.Audience = "liste"
	}
	if req.At != "" {
		at, err := time.Parse(time.RFC3339, req.At)
		if err != nil || at.Before(time.Now()) || at.After(time.Now().Add(60*24*time.Hour)) {
			httpx.Error(w, http.StatusBadRequest, "la date d'envoi doit être dans l'avenir (60 jours au plus)")
			return
		}
		list, err := h.recipients(ctx, req.Audience, req.Template)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		var id int64
		if err := h.DB.QueryRow(ctx, `INSERT INTO wa_campaigns (template, lang, audience, total, status, send_at) VALUES ($1, $2, $3, $4, 'scheduled', $5) RETURNING id`, req.Template, req.Lang, req.Audience, len(list), at).Scan(&id); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		h.Log(ctx, "WhatsApp : envoi programmé", fmt.Sprintf("%s le %s", req.Template, at.Format("02/01 15:04 MST")))
		httpx.JSON(w, http.StatusOK, map[string]any{"id": id, "total": len(list), "at": at})
		return
	}
	var running bool
	_ = h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM wa_campaigns WHERE status = 'running')`).Scan(&running)
	if running {
		httpx.Error(w, http.StatusConflict, "un envoi est déjà en cours : attends qu'il finisse, ou arrête-le")
		return
	}
	list, err := h.recipients(ctx, req.Audience, req.Template)
	if err != nil || len(list) == 0 {
		httpx.Error(w, http.StatusBadRequest, "aucun numéro WhatsApp à qui écrire")
		return
	}
	var id int64
	if err := h.DB.QueryRow(ctx, `INSERT INTO wa_campaigns (template, lang, audience, total) VALUES ($1, $2, $3, $4) RETURNING id`, req.Template, req.Lang, req.Audience, len(list)).Scan(&id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	h.Log(ctx, "WhatsApp : envoi lancé", fmt.Sprintf("%s à %d numéros", req.Template, len(list)))
	go h.run(id, req.Template, req.Lang, list)
	httpx.JSON(w, http.StatusOK, map[string]any{"id": id, "total": len(list)})
}

// WatchWhatsApp starts the campaigns set for later when their time comes (one at a time, after any
// running one), to the numbers then on the list that haven't had that template yet.
func (h *Handler) WatchWhatsApp(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		if !h.WA.Configured() {
			continue
		}
		var id int64
		var template, lang, audience string
		err := h.DB.QueryRow(ctx, `UPDATE wa_campaigns SET status = 'running' WHERE id = (
				SELECT id FROM wa_campaigns WHERE status = 'scheduled' AND send_at <= now()
					AND NOT EXISTS (SELECT 1 FROM wa_campaigns WHERE status = 'running')
				ORDER BY send_at LIMIT 1)
			RETURNING id, template, lang, audience`).Scan(&id, &template, &lang, &audience)
		if err != nil {
			continue
		}
		list, err := h.recipients(ctx, audience, template)
		if err != nil {
			_, _ = h.DB.Exec(ctx, `UPDATE wa_campaigns SET status = 'scheduled' WHERE id = $1`, id)
			continue
		}
		_, _ = h.DB.Exec(ctx, `UPDATE wa_campaigns SET total = $2 WHERE id = $1`, id, len(list))
		h.Log(ctx, "WhatsApp : envoi programmé lancé", fmt.Sprintf("%s à %d numéros", template, len(list)))
		go h.run(id, template, lang, list)
	}
}

// run sends a campaign one message at a time, and stops when asked.
func (h *Handler) run(id int64, template, lang string, list []recipient) {
	ctx := context.Background()
	gap := h.WA.Gap
	if gap == 0 {
		gap = 250 * time.Millisecond
	}
	for _, x := range list {
		var status string
		if h.DB.QueryRow(ctx, `SELECT status FROM wa_campaigns WHERE id = $1`, id).Scan(&status) != nil || status != "running" {
			return
		}
		err := h.WA.send(ctx, x.Contact, template, lang, x.FirstName)
		if err != nil {
			_, _ = h.DB.Exec(ctx, `INSERT INTO wa_sends (campaign, contact, status, error, sent_at) VALUES ($1, $2, 'failed', $3, now()) ON CONFLICT DO NOTHING`, id, x.Contact, err.Error())
			_, _ = h.DB.Exec(ctx, `UPDATE wa_campaigns SET failed = failed + 1 WHERE id = $1`, id)
		} else {
			_, _ = h.DB.Exec(ctx, `INSERT INTO wa_sends (campaign, contact, status, sent_at) VALUES ($1, $2, 'sent', now()) ON CONFLICT DO NOTHING`, id, x.Contact)
			_, _ = h.DB.Exec(ctx, `UPDATE wa_campaigns SET sent = sent + 1 WHERE id = $1`, id)
		}
		time.Sleep(gap)
	}
	_, _ = h.DB.Exec(ctx, `UPDATE wa_campaigns SET status = 'done' WHERE id = $1 AND status = 'running'`, id)
	h.Log(ctx, "WhatsApp : envoi terminé", "campagne "+strconv.FormatInt(id, 10))
}

func (h *Handler) waStop(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_, _ = h.DB.Exec(r.Context(), `UPDATE wa_campaigns SET status = 'stopped' WHERE id = $1 AND status IN ('running', 'scheduled')`, id)
	h.Log(r.Context(), "WhatsApp : envoi arrêté", "campagne "+strconv.FormatInt(id, 10))
	httpx.JSON(w, http.StatusOK, map[string]bool{"stopped": true})
}

// waOptout: someone asked not to be written to again (« STOP »).
func (h *Handler) waOptout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Contact string `json:"contact"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	num := "+" + strings.Map(func(c rune) rune {
		if c >= '0' && c <= '9' {
			return c
		}
		return -1
	}, req.Contact)
	if len(num) < 9 {
		httpx.Error(w, http.StatusBadRequest, "numéro invalide")
		return
	}
	_, _ = h.DB.Exec(r.Context(), `INSERT INTO wa_optout (contact) VALUES ($1) ON CONFLICT DO NOTHING`, num)
	h.Log(r.Context(), "WhatsApp : numéro retiré", num[:len(num)-4]+"••••")
	httpx.JSON(w, http.StatusOK, map[string]string{"contact": num})
}
