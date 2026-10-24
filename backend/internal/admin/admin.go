// Package admin is the API of the /admin page (web/src/screens/Admin.tsx),
// behind ADMIN_KEY: the players' accounts, the activity log, announcements
// to every Sim, and WhatsApp messages to the wish list (whatsapp.go).
package admin

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/adminkey"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/ideas"
	"github.com/myahse/babi-life/backend/internal/sims"
)

type Handler struct {
	DB *pgxpool.Pool
	WA *WhatsApp
	// The players' ideas (the phone's Idées app): read and answered here.
	Ideas *ideas.Handler
}

func (h *Handler) Routes(r chi.Router) {
	r.Route("/admin", func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if !adminkey.OK(r, "") {
					httpx.Error(w, http.StatusUnauthorized, "clé admin requise")
					return
				}
				next.ServeHTTP(w, r)
			})
		})
		r.Get("/stats", h.stats)
		r.Get("/users", h.users)
		r.Get("/log", h.log)
		r.Get("/announcements", h.announcements)
		r.Post("/announcements", h.announce)
		r.Post("/money", h.giveMoney)
		r.Post("/users/{id}/tester", h.setTester)
		r.Post("/testers/reset", h.resetTesters)
		r.Get("/whatsapp", h.waStatus)
		r.Post("/whatsapp", h.waSend)
		r.Post("/whatsapp/{id}/stop", h.waStop)
		r.Post("/whatsapp/optout", h.waOptout)
		if h.Ideas != nil {
			h.Ideas.Admin(r)
		}
	})
}

// Log writes what the team did in the activity log.
func (h *Handler) Log(ctx context.Context, action, detail string) {
	_, _ = h.DB.Exec(ctx, `INSERT INTO admin_log (action, detail) VALUES ($1, $2)`, action, detail)
}

// stats: the headline numbers.
func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	var s struct {
		Users     int `json:"users"`
		Sims      int `json:"sims"`
		Online    int `json:"online"`
		Today     int `json:"today"`
		Waitlist  int `json:"waitlist"`
		Phones    int `json:"phones"`
		Reports   int `json:"reports"`
		Campaigns int `json:"campaigns"`
		Messages  int `json:"messages"`
		TikiPosts int `json:"tikiPosts"`
		// The players' ideas not read yet.
		Ideas int `json:"ideas"`
	}
	err := h.DB.QueryRow(r.Context(), `SELECT
		(SELECT count(*) FROM users),
		(SELECT count(*) FROM sims),
		(SELECT count(*) FROM sims WHERE last_tick > now() - interval '5 minutes'),
		(SELECT count(*) FROM users WHERE last_login_at > now() - interval '24 hours'),
		(SELECT count(*) FROM waitlist),
		(SELECT count(*) FROM waitlist WHERE kind = 'phone'),
		(SELECT count(*) FROM reports WHERE status = 'open'),
		(SELECT count(*) FROM ad_campaigns WHERE status = 'pending'),
		(SELECT count(*) FROM messages WHERE created_at > now() - interval '24 hours'),
		(SELECT count(*) FROM tiki_posts WHERE created_at > now() - interval '24 hours'),
		(SELECT count(*) FROM ideas WHERE status = 'new')`).
		Scan(&s.Users, &s.Sims, &s.Online, &s.Today, &s.Waitlist, &s.Phones, &s.Reports, &s.Campaigns, &s.Messages, &s.TikiPosts, &s.Ideas)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, s)
}

// User is a player's account, with their Sim.
type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Google    bool      `json:"google"`
	CreatedAt time.Time `json:"createdAt"`
	LastLogin time.Time `json:"lastLogin"`
	Sims      int       `json:"sims"`
	Sim       string    `json:"sim"`
	Commune   string    `json:"commune"`
	Money     int       `json:"money"`
	Online    bool      `json:"online"`
	Tester    bool      `json:"tester"`
}

// users: every account, newest first, 50 a page (?q= searches name, username, e-mail; ?page=).
func (h *Handler) users(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	rows, err := h.DB.Query(r.Context(), `
		SELECT u.id, u.name, COALESCE(u.username, ''), u.email, u.google_sub IS NOT NULL, u.created_at, u.last_login_at,
			(SELECT count(*) FROM sims s WHERE s.user_id = u.id),
			COALESCE(f.first_name || ' ' || f.last_name, ''), COALESCE(f.commune, ''), COALESCE(f.money, 0),
			COALESCE(f.last_tick > now() - interval '5 minutes', false), u.tester,
			count(*) OVER ()
		FROM users u
		LEFT JOIN LATERAL (SELECT * FROM sims s WHERE s.user_id = u.id ORDER BY s.created_at LIMIT 1) f ON true
		WHERE $1 = '' OR u.name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%' OR COALESCE(u.username, '') ILIKE '%' || $1 || '%'
		ORDER BY u.created_at DESC LIMIT 50 OFFSET $2`, q, max(0, page)*50)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	out := []User{}
	total := 0
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Name, &u.Username, &u.Email, &u.Google, &u.CreatedAt, &u.LastLogin, &u.Sims, &u.Sim, &u.Commune, &u.Money, &u.Online, &u.Tester, &total); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		out = append(out, u)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"users": out, "total": total})
}

// Entry is a line of the activity log.
type Entry struct {
	Kind string    `json:"kind"`
	Text string    `json:"text"`
	At   time.Time `json:"at"`
}

// log: what happened lately, all together: sign-ups, logins, new Sims, the
// wish list, reports, ads, the players' ideas, and what the team did. ?kind= keeps one kind.
func (h *Handler) log(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	rows, err := h.DB.Query(r.Context(), `SELECT kind, text, at FROM (
		SELECT 'inscription' AS kind, name || ' a créé son compte' || CASE WHEN google_sub IS NOT NULL THEN ' (Google)' ELSE '' END AS text, created_at AS at FROM users
		UNION ALL SELECT 'connexion', name || ' s''est connecté·e', last_login_at FROM users WHERE last_login_at > created_at + interval '1 minute'
		-- Where the Sim was born is in its birth line (« Awa est née à Cocody, dans… »): its home now may be elsewhere.
		UNION ALL SELECT 'perso', COALESCE((SELECT split_part(e.text, ',', 1) FROM sim_events e WHERE e.sim_id = s.id AND e.text LIKE s.first_name || ' est n%' ORDER BY e.id LIMIT 1), s.first_name || ' ' || s.last_name || ' a créé son perso') || ' (' || u.name || ')', s.created_at FROM sims s JOIN users u ON u.id = s.user_id
		UNION ALL SELECT 'liste', first_name || ' s''est inscrit·e sur la liste d''attente' || CASE WHEN commune <> '' THEN ' (' || commune || ')' ELSE '' END || CASE WHEN beta THEN ', veut tester' ELSE '' END, created_at FROM waitlist
		UNION ALL SELECT 'signalement', 'Signalement : ' || reason, created_at FROM reports
		UNION ALL SELECT 'pub', 'Campagne de pub reçue : ' || title || ' (' || advertiser || ')', created_at FROM ad_campaigns
		UNION ALL SELECT 'idee', 'Idée de ' || u.name || CASE WHEN i.sim_name <> '' THEN ' (' || i.sim_name || ')' ELSE '' END || ' : ' || left(i.text, 90) || CASE WHEN length(i.text) > 90 THEN '…' ELSE '' END, i.created_at FROM ideas i JOIN users u ON u.id = i.user_id
		UNION ALL SELECT 'admin', action || CASE WHEN detail <> '' THEN ' : ' || detail ELSE '' END, created_at FROM admin_log
	) x WHERE $1 = '' OR kind = $1 ORDER BY at DESC LIMIT 200`, kind)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	out := []Entry{}
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.Kind, &e.Text, &e.At); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		out = append(out, e)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// MaxAnnouncement: an announcement's length.
const MaxAnnouncement = 400

func (h *Handler) announcements(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `SELECT id, text, reached, created_at FROM announcements ORDER BY id DESC LIMIT 30`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	type a struct {
		ID      int64     `json:"id"`
		Text    string    `json:"text"`
		Reached int       `json:"reached"`
		At      time.Time `json:"at"`
	}
	out := []a{}
	for rows.Next() {
		var x a
		if err := rows.Scan(&x.ID, &x.Text, &x.Reached, &x.At); err == nil {
			out = append(out, x)
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}

// announce: a message from Babi Life in every Sim's journal (the phone's
// Messages, shown on arrival like the rest of the news).
func (h *Handler) announce(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Text string `json:"text"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	text := strings.TrimSpace(req.Text)
	if text == "" || utf8.RuneCountInString(text) > MaxAnnouncement {
		httpx.Error(w, http.StatusBadRequest, "écris l'annonce (400 caractères au plus)")
		return
	}
	ctx := r.Context()
	tag, err := h.DB.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) SELECT id, 'annonce', $1, 0, $2 FROM sims`,
		"Babi Life : "+text, game.MinuteOf(time.Now()))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "envoi impossible")
		return
	}
	n := int(tag.RowsAffected())
	_, _ = h.DB.Exec(ctx, `INSERT INTO announcements (text, reached) VALUES ($1, $2)`, text, n)
	h.Log(ctx, "Annonce envoyée", strconv.Itoa(n)+" persos")
	httpx.JSON(w, http.StatusOK, map[string]int{"reached": n})
}

// MaxGift: the most Djai the team gives each Sim at once.
const MaxGift = 10_000_000

// giveMoney: Djai for every Sim (or one player's Sims, with userId), with a
// line in each Sim's journal saying who gave it and why.
func (h *Handler) giveMoney(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Amount int    `json:"amount"`
		Note   string `json:"note"`
		UserID string `json:"userId"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	note := strings.TrimSpace(req.Note)
	if req.Amount < 1 || req.Amount > MaxGift || utf8.RuneCountInString(note) > 200 {
		httpx.Error(w, http.StatusBadRequest, "un montant de 1 à 10 000 000 Djai (et un mot de 200 caractères au plus)")
		return
	}
	text := "Babi Life t'offre " + game.FCFA(req.Amount) + "."
	if note != "" {
		text += " " + note
	}
	ctx := r.Context()
	tag, err := h.DB.Exec(ctx, `WITH given AS (UPDATE sims SET money = money + $1 WHERE $2 = '' OR user_id::text = $2 RETURNING id)
		INSERT INTO sim_events (sim_id, kind, text, money, game_time) SELECT id, 'annonce', $3, $1, $4 FROM given`,
		req.Amount, req.UserID, text, game.MinuteOf(time.Now()))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "envoi impossible")
		return
	}
	n := int(tag.RowsAffected())
	who := "tous les persos"
	if req.UserID != "" {
		who = "un joueur"
	}
	h.Log(ctx, "Djai offerts", game.FCFA(req.Amount)+" à "+who+" ("+strconv.Itoa(n)+" persos)")
	httpx.JSON(w, http.StatusOK, map[string]int{"reached": n})
}

// setTester: makes an account a tester's (the toolbox in the game), or not.
func (h *Handler) setTester(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Tester bool `json:"tester"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	var name string
	if err := h.DB.QueryRow(r.Context(), `UPDATE users SET tester = $2, tester_off = tester_off AND NOT $2 WHERE id::text = $1 RETURNING name`, chi.URLParam(r, "id"), req.Tester).Scan(&name); err != nil {
		httpx.Error(w, http.StatusNotFound, "compte introuvable")
		return
	}
	action := "Compte testeur retiré"
	if req.Tester {
		action = "Compte testeur ajouté"
	}
	h.Log(r.Context(), action, name)
	httpx.JSON(w, http.StatusOK, map[string]bool{"tester": req.Tester})
}

// resetTesters: before launch, every tester's Sim goes back to just after it
// was created, and the accounts become ordinary players (sims.ResetTesters).
func (h *Handler) resetTesters(w http.ResponseWriter, r *http.Request) {
	n, err := sims.ResetTesters(r.Context(), h.DB)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "remise à zéro impossible")
		return
	}
	h.Log(r.Context(), "Testeurs remis à zéro", strconv.Itoa(n)+" persos")
	httpx.JSON(w, http.StatusOK, map[string]int{"reset": n})
}
