package admin

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"html"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/mail"
)

// E-mails of news from /admin (« E-mails »), through Brevo (package mail):
// one of the models (mail.Templates), its words changed if need be, a test
// to one address first, then to an audience in the background, one at a
// time, followed live and stoppable. Each e-mail carries its own « ne plus
// recevoir » link (GET /mail/stop, signed so nobody can unsubscribe someone
// else), and those addresses never get another one.

// Emails: what the page needs to send (set in main; nil Mail: not set up).
type Emails struct {
	Mail mail.Sender
	// Site: where the buttons lead (/jeu…); API: this API's own address, for the « ne plus recevoir » link.
	Site, API string
	// Secret signs the « ne plus recevoir » links.
	Secret []byte
	// Gap between two e-mails.
	Gap time.Duration
}

// Audiences: who a campaign goes to, as the page shows them.
var audiences = map[string]string{
	"liste":    "la liste d'attente",
	"beta":     "ceux qui veulent tester",
	"joueurs":  "les joueurs",
	"testeurs": "les testeurs",
	"tous":     "tout le monde",
}

type mailTo struct {
	FirstName string
	Email     string
}

// mailRecipients: the addresses of an audience (each once, lower case), minus those who asked to stop
// and, for a model (not ""), those it already went to (sent again the next day, it picks up where it stopped).
func (h *Handler) mailRecipients(ctx context.Context, audience, template string) ([]mailTo, error) {
	q := map[string]string{
		"liste":    `SELECT first_name, lower(contact) FROM waitlist WHERE kind = 'email'`,
		"beta":     `SELECT first_name, lower(contact) FROM waitlist WHERE kind = 'email' AND beta`,
		"joueurs":  `SELECT split_part(name, ' ', 1), lower(email) FROM users WHERE email LIKE '%@%.%'`,
		"testeurs": `SELECT split_part(name, ' ', 1), lower(email) FROM users WHERE tester AND email LIKE '%@%.%'`,
	}
	parts := []string{q[audience]}
	if audience == "tous" {
		parts = []string{q["liste"], q["joueurs"]}
	}
	if parts[0] == "" {
		return nil, fmt.Errorf("public inconnu")
	}
	rows, err := h.DB.Query(ctx, `SELECT DISTINCT ON (e) n, e FROM (`+strings.Join(parts, " UNION ALL ")+`) AS x(n, e)
		WHERE e LIKE '%@%' AND NOT EXISTS (SELECT 1 FROM mail_optout o WHERE o.email = x.e)
		AND NOT EXISTS (SELECT 1 FROM mail_sends s JOIN mail_campaigns c ON c.id = s.campaign WHERE s.email = x.e AND s.status = 'sent' AND c.template = $1)
		ORDER BY e, n DESC`, template)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []mailTo{}
	for rows.Next() {
		var m mailTo
		if err := rows.Scan(&m.FirstName, &m.Email); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// testName: the first name a test goes out with: the one the wish list or
// a player's account has for that address or number, else « Test ».
func (h *Handler) testName(ctx context.Context, contact string) string {
	var n string
	digits := strings.Map(func(c rune) rune {
		if c >= '0' && c <= '9' {
			return c
		}
		return -1
	}, contact)
	err := h.DB.QueryRow(ctx, `SELECT n FROM (
			SELECT first_name, 0 FROM waitlist WHERE lower(contact) = $1 OR ($2 <> '' AND kind = 'phone' AND regexp_replace(contact, '\D', '', 'g') = $2)
			UNION ALL SELECT split_part(name, ' ', 1), 1 FROM users WHERE lower(email) = $1
		) AS x(n, o) WHERE n <> '' ORDER BY o LIMIT 1`, strings.ToLower(strings.TrimSpace(contact)), digits).Scan(&n)
	if err != nil || n == "" {
		return "Test"
	}
	return n
}

// stopLink: the person's own « ne plus recevoir » link.
func (h *Handler) stopLink(email string) string {
	if h.Mail == nil || h.Mail.API == "" {
		return ""
	}
	return h.Mail.API + "/api/v1/mail/stop?e=" + url.QueryEscape(email) + "&t=" + h.stopToken(email)
}

func (h *Handler) stopToken(email string) string {
	m := hmac.New(sha256.New, h.Mail.Secret)
	m.Write([]byte("mail-stop:" + strings.ToLower(email)))
	return hex.EncodeToString(m.Sum(nil))[:32]
}

// filled: the model with the words the page changed.
func filled(id string, words *mail.Template) (mail.Template, error) {
	t, ok := mail.FindTemplate(id)
	if !ok {
		return t, fmt.Errorf("modèle inconnu")
	}
	if t.System {
		return t, fmt.Errorf("ce modèle est envoyé par le jeu lui-même")
	}
	if words != nil {
		for _, f := range []struct {
			to   *string
			from string
			max  int
		}{{&t.Subject, words.Subject, 150}, {&t.Preheader, words.Preheader, 200}, {&t.Title, words.Title, 80}, {&t.Text, words.Text, 5000}, {&t.Button, words.Button, 40}, {&t.Link, words.Link, 300}, {&t.Note, words.Note, 400}} {
			if len(f.from) > f.max {
				return t, fmt.Errorf("texte trop long (%d caractères au plus)", f.max)
			}
			*f.to = strings.TrimSpace(f.from)
		}
		// A link to elsewhere: the web only.
		if t.Link != "" && !strings.HasPrefix(t.Link, "/") && !strings.HasPrefix(t.Link, "https://") {
			return t, fmt.Errorf("le lien doit commencer par / ou https://")
		}
	}
	if strings.TrimSpace(t.Subject) == "" {
		return t, fmt.Errorf("il faut un objet")
	}
	return t, nil
}

func (h *Handler) site() string {
	if h.Mail != nil && h.Mail.Site != "" {
		return h.Mail.Site
	}
	return "https://www.lifeinbabi.com"
}

// mailStatus: set up or not, how many in each audience, the models, the campaigns.
func (h *Handler) mailStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	counts := map[string]int{}
	for a := range audiences {
		list, err := h.mailRecipients(ctx, a, r.URL.Query().Get("template"))
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		counts[a] = len(list)
	}
	type campaign struct {
		ID       int64     `json:"id"`
		Template string    `json:"template"`
		Subject  string    `json:"subject"`
		Audience string    `json:"audience"`
		Total    int       `json:"total"`
		Sent     int       `json:"sent"`
		Failed   int       `json:"failed"`
		Status   string    `json:"status"`
		At       time.Time `json:"at"`
		Errors   []string  `json:"errors,omitempty"`
	}
	camps := []campaign{}
	rows, err := h.DB.Query(ctx, `SELECT id, template, subject, audience, total, sent, failed, status, created_at FROM mail_campaigns ORDER BY id DESC LIMIT 20`)
	if err == nil {
		for rows.Next() {
			var c campaign
			if rows.Scan(&c.ID, &c.Template, &c.Subject, &c.Audience, &c.Total, &c.Sent, &c.Failed, &c.Status, &c.At) == nil {
				camps = append(camps, c)
			}
		}
		rows.Close()
	}
	for i := range camps {
		if camps[i].Failed == 0 {
			continue
		}
		er, err := h.DB.Query(ctx, `SELECT DISTINCT error FROM mail_sends WHERE campaign = $1 AND status = 'failed' LIMIT 3`, camps[i].ID)
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
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM mail_optout`).Scan(&optouts)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"configured": h.Mail != nil && h.Mail.Mail != nil, "counts": counts, "audiences": audiences, "optouts": optouts,
		"templates": mail.Templates, "campaigns": camps,
	})
}

type mailRequest struct {
	Template string         `json:"template"`
	Words    *mail.Template `json:"words,omitempty"`
	Audience string         `json:"audience"`
	// Test: only to this address.
	Test string `json:"test,omitempty"`
}

// mailPreview: the e-mail as it will look (for Awa), to show in the page.
func (h *Handler) mailPreview(w http.ResponseWriter, r *http.Request) {
	var req mailRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	t, ok := mail.FindTemplate(req.Template)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "modèle inconnu")
		return
	}
	if !t.System {
		var err error
		if t, err = filled(req.Template, req.Words); err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	unsub := ""
	if !t.System {
		unsub = h.site() + "/#ne-plus-recevoir"
	}
	m, err := mail.News(h.site(), t, "awa@example.com", "Awa", unsub)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"subject": m.Subject, "html": m.HTML, "text": m.Text})
}

// mailSend: a test to one address, or a campaign to an audience in the background.
func (h *Handler) mailSend(w http.ResponseWriter, r *http.Request) {
	var req mailRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if h.Mail == nil || h.Mail.Mail == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "l'e-mail n'est pas branché : BREVO_API_KEY et MAIL_FROM sur Render")
		return
	}
	t, err := filled(req.Template, req.Words)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx := r.Context()
	if req.Test != "" {
		to := strings.ToLower(strings.TrimSpace(req.Test))
		m, err := mail.News(h.site(), t, to, h.testName(ctx, to), h.stopLink(to))
		if err == nil {
			m.Subject = "[Test] " + m.Subject
			err = h.Mail.Mail.Send(ctx, m)
		}
		if err != nil {
			httpx.Error(w, http.StatusBadGateway, "envoi refusé : "+err.Error())
			return
		}
		h.Log(ctx, "E-mail : test envoyé", t.ID)
		httpx.JSON(w, http.StatusOK, map[string]string{"text": "E-mail de test envoyé à " + to + "."})
		return
	}
	if _, ok := audiences[req.Audience]; !ok {
		httpx.Error(w, http.StatusBadRequest, "public inconnu")
		return
	}
	var running bool
	_ = h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM mail_campaigns WHERE status = 'running')`).Scan(&running)
	if running {
		httpx.Error(w, http.StatusConflict, "un envoi est déjà en cours : attends qu'il finisse, ou arrête-le")
		return
	}
	list, err := h.mailRecipients(ctx, req.Audience, t.ID)
	if err != nil || len(list) == 0 {
		httpx.Error(w, http.StatusBadRequest, "personne à qui écrire dans ce public (ou tous l'ont déjà reçu)")
		return
	}
	var id int64
	if err := h.DB.QueryRow(ctx, `INSERT INTO mail_campaigns (template, subject, audience, total) VALUES ($1, $2, $3, $4) RETURNING id`, t.ID, t.Subject, req.Audience, len(list)).Scan(&id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	h.Log(ctx, "E-mail : envoi lancé", fmt.Sprintf("%s à %d adresses (%s)", t.ID, len(list), audiences[req.Audience]))
	go h.mailRun(id, t, list)
	httpx.JSON(w, http.StatusOK, map[string]any{"id": id, "total": len(list)})
}

// mailRun sends a campaign one e-mail at a time, and stops when asked.
func (h *Handler) mailRun(id int64, t mail.Template, list []mailTo) {
	ctx := context.Background()
	gap := h.Mail.Gap
	if gap == 0 {
		gap = 300 * time.Millisecond
	}
	for _, x := range list {
		var status string
		if h.DB.QueryRow(ctx, `SELECT status FROM mail_campaigns WHERE id = $1`, id).Scan(&status) != nil || status != "running" {
			return
		}
		m, err := mail.News(h.site(), t, x.Email, x.FirstName, h.stopLink(x.Email))
		if err == nil {
			err = h.Mail.Mail.Send(ctx, m)
		}
		if err != nil {
			_, _ = h.DB.Exec(ctx, `INSERT INTO mail_sends (campaign, email, status, error, sent_at) VALUES ($1, $2, 'failed', $3, now()) ON CONFLICT DO NOTHING`, id, x.Email, err.Error())
			_, _ = h.DB.Exec(ctx, `UPDATE mail_campaigns SET failed = failed + 1 WHERE id = $1`, id)
		} else {
			_, _ = h.DB.Exec(ctx, `INSERT INTO mail_sends (campaign, email, status, sent_at) VALUES ($1, $2, 'sent', now()) ON CONFLICT DO NOTHING`, id, x.Email)
			_, _ = h.DB.Exec(ctx, `UPDATE mail_campaigns SET sent = sent + 1 WHERE id = $1`, id)
		}
		time.Sleep(gap)
	}
	_, _ = h.DB.Exec(ctx, `UPDATE mail_campaigns SET status = 'done' WHERE id = $1 AND status = 'running'`, id)
	h.Log(ctx, "E-mail : envoi terminé", "campagne "+strconv.FormatInt(id, 10))
}

func (h *Handler) mailStop(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_, _ = h.DB.Exec(r.Context(), `UPDATE mail_campaigns SET status = 'stopped' WHERE id = $1 AND status = 'running'`, id)
	h.Log(r.Context(), "E-mail : envoi arrêté", "campagne "+strconv.FormatInt(id, 10))
	httpx.JSON(w, http.StatusOK, map[string]bool{"stopped": true})
}

// mailOptout: the team takes an address off (someone asked by another way).
func (h *Handler) mailOptout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := httpx.Decode(r, &req); err != nil || !strings.Contains(req.Email, "@") {
		httpx.Error(w, http.StatusBadRequest, "adresse invalide")
		return
	}
	e := strings.ToLower(strings.TrimSpace(req.Email))
	_, _ = h.DB.Exec(r.Context(), `INSERT INTO mail_optout (email) VALUES ($1) ON CONFLICT DO NOTHING`, e)
	h.Log(r.Context(), "E-mail : adresse retirée", e[:min(3, len(e))]+"•••")
	httpx.JSON(w, http.StatusOK, map[string]string{"email": e})
}

// MailStop: the « ne plus recevoir ces e-mails » link of an e-mail (public, signed per address).
func (h *Handler) MailStop(w http.ResponseWriter, r *http.Request) {
	e := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("e")))
	page := func(code int, title, text string) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(code)
		fmt.Fprintf(w, `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Babi Life</title>
<body style="margin:0;background:#efe4cc;font-family:Nunito,'Segoe UI',Arial,sans-serif;color:#2b1d14"><div style="max-width:520px;margin:0 auto;padding:40px 22px">
<div style="background:#1f8f88;color:#fbf5e6;padding:14px 18px;font:28px Impact,'Arial Black',sans-serif;text-transform:uppercase">Babi <span style="color:#dda233">Life</span></div>
<h1 style="font:34px Impact,'Arial Black',sans-serif;text-transform:uppercase;color:#b5432c">%s</h1><p style="font-size:17px;font-weight:700;line-height:1.5">%s</p>
<p><a href="%s" style="color:#1f8f88;font-weight:800">lifeinbabi.com</a></p></div></body></html>`, html.EscapeString(title), html.EscapeString(text), html.EscapeString(h.site()))
	}
	if h.Mail == nil || len(h.Mail.Secret) == 0 || !strings.Contains(e, "@") || !hmac.Equal([]byte(r.URL.Query().Get("t")), []byte(h.stopToken(e))) {
		page(http.StatusBadRequest, "Lien abîmé", "Ce lien ne marche pas. Réponds simplement à un de nos e-mails pour qu'on te retire de la liste.")
		return
	}
	_, _ = h.DB.Exec(r.Context(), `INSERT INTO mail_optout (email) VALUES ($1) ON CONFLICT DO NOTHING`, e)
	h.Log(r.Context(), "E-mail : désinscription", e[:min(3, len(e))]+"•••")
	page(http.StatusOK, "C'est noté", "Tu ne recevras plus nos e-mails de nouvelles. (Ceux de ton compte, comme le mot de passe oublié, arrivent toujours quand tu les demandes.)")
}
