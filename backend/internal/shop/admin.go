package shop

import (
	"context"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The admin's « Paiements » tab (web screens/Admin.tsx): every purchase, begun or paid, who made
// it and how it stands, the totals, and a purchase asked again of GeniusPay (or Google Play) by
// hand. Mounted under /admin, behind the admin key (admin.Handler.Shop).

// AdminPurchase: one purchase as the team sees it.
type AdminPurchase struct {
	ID       string     `json:"id"`
	At       time.Time  `json:"at"`
	Updated  time.Time  `json:"updated"`
	Kind     string     `json:"kind"`
	Item     string     `json:"item"`
	Price    int        `json:"price"`
	Djai     int        `json:"djai"`
	Status   string     `json:"status"`
	Credited *time.Time `json:"credited,omitempty"`
	Sandbox  bool       `json:"sandbox"`
	// Via: geniuspay or play; Reference: GeniusPay's (or Google's order number).
	Via       string `json:"via"`
	Reference string `json:"reference,omitempty"`
	User      string `json:"user,omitempty"`
	Name      string `json:"name,omitempty"`
	Username  string `json:"username,omitempty"`
	Email     string `json:"email,omitempty"`
	Sim       string `json:"sim,omitempty"`
}

// AdminTotals: how many purchases stand where, and the money really received (real ones, given).
type AdminTotals struct {
	Begun    int            `json:"begun"`
	Paid     int            `json:"paid"`
	Waiting  int            `json:"waiting"`
	Check    int            `json:"check"`
	Failed   int            `json:"failed"`
	Revenue  int            `json:"revenue"`
	Today    int            `json:"today"`
	Week     int            `json:"week"`
	ByStatus map[string]int `json:"byStatus"`
}

// Admin mounts the tab's routes (already behind the admin key).
func (h *Handler) Admin(r chi.Router) {
	r.Get("/purchases", h.adminPurchases)
	r.Post("/purchases/{id}/check", h.adminCheck)
}

const adminColumns = `p.id, p.created_at, p.updated_at, p.kind, COALESCE(NULLIF(p.item, ''), p.pack), p.price, p.djai, p.status, p.credited_at, p.sandbox,
	CASE WHEN p.play_token IS NOT NULL THEN 'play' ELSE 'geniuspay' END, COALESCE(p.reference, p.play_order, ''),
	COALESCE(u.id::text, ''), COALESCE(u.name, ''), COALESCE(u.username, ''), COALESCE(u.email, ''), COALESCE(s.first_name, '')`

func scanAdmin(row pgx.Row) (AdminPurchase, error) {
	var p AdminPurchase
	err := row.Scan(&p.ID, &p.At, &p.Updated, &p.Kind, &p.Item, &p.Price, &p.Djai, &p.Status, &p.Credited, &p.Sandbox, &p.Via, &p.Reference, &p.User, &p.Name, &p.Username, &p.Email, &p.Sim)
	return p, err
}

// adminPurchases: the latest purchases (?status= one status, or « paid », « waiting », « check »;
// ?q= a name, e-mail, username or reference; ?days= how far back), and the totals.
func (h *Handler) adminPurchases(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()
	where := []string{"p.kind IS DISTINCT FROM 'pub'"}
	args := []any{}
	arg := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	switch st := q.Get("status"); st {
	case "", "all":
	case "paid":
		where = append(where, "p.credited_at IS NOT NULL")
	case "waiting":
		where = append(where, "p.credited_at IS NULL AND p.status IN ('created', 'pending', 'processing')")
	case "check":
		where = append(where, "p.credited_at IS NULL AND p.status = 'mismatch'")
	default:
		where = append(where, "p.status = "+arg(st))
	}
	if s := strings.TrimSpace(q.Get("q")); s != "" {
		like := arg("%" + strings.ToLower(s) + "%")
		where = append(where, "(lower(u.name) LIKE "+like+" OR lower(u.email) LIKE "+like+" OR lower(u.username) LIKE "+like+" OR lower(COALESCE(p.reference, '')) LIKE "+like+" OR lower(COALESCE(p.play_order, '')) LIKE "+like+" OR p.id::text LIKE "+like+")")
	}
	if d, err := strconv.Atoi(q.Get("days")); err == nil && d > 0 {
		where = append(where, "p.created_at > now() - make_interval(days => "+arg(d)+")")
	}
	rows, err := h.DB.Query(ctx, `SELECT `+adminColumns+` FROM purchases p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN sims s ON s.id = p.sim_id
		WHERE `+strings.Join(where, " AND ")+` ORDER BY p.created_at DESC LIMIT 300`, args...)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	list, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (AdminPurchase, error) { return scanAdmin(row) })
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	t := AdminTotals{ByStatus: map[string]int{}}
	st, err := h.DB.Query(ctx, `SELECT status, credited_at IS NOT NULL, count(*) FROM purchases WHERE kind IS DISTINCT FROM 'pub' GROUP BY 1, 2`)
	if err == nil {
		for st.Next() {
			var s string
			var given bool
			var n int
			if st.Scan(&s, &given, &n) != nil {
				continue
			}
			t.Begun += n
			t.ByStatus[s] += n
			switch {
			case given:
				t.Paid += n
			case s == "created" || s == "pending" || s == "processing":
				t.Waiting += n
			case s == "mismatch":
				t.Check += n
			case s == "failed" || s == "error":
				t.Failed += n
			}
		}
		st.Close()
	}
	_ = h.DB.QueryRow(ctx, `SELECT COALESCE(sum(price), 0),
		COALESCE(sum(price) FILTER (WHERE credited_at > now() - interval '1 day'), 0),
		COALESCE(sum(price) FILTER (WHERE credited_at > now() - interval '7 days'), 0)
		FROM purchases WHERE credited_at IS NOT NULL AND NOT sandbox AND status <> 'refunded' AND kind IS DISTINCT FROM 'pub'`).Scan(&t.Revenue, &t.Today, &t.Week)
	httpx.JSON(w, http.StatusOK, map[string]any{"purchases": list, "totals": t, "geniuspay": h.Pay != nil, "sandbox": h.Pay != nil && h.Pay.Sandbox(), "play": h.Play != nil})
}

// adminCheck: one purchase asked again now, of GeniusPay (its status and the sum it says was paid)
// or of Google Play; given if it's paid (once), as the game would. What the provider said comes back.
func (h *Handler) adminCheck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	var ref, token, product *string
	if err := h.DB.QueryRow(ctx, `SELECT reference, play_token, play_product FROM purchases WHERE id::text = $1`, id).Scan(&ref, &token, &product); err != nil {
		httpx.Error(w, http.StatusNotFound, errNotFound.Error())
		return
	}
	said, err := h.recheck(ctx, id, ref, token, product)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	p, err := scanAdmin(h.DB.QueryRow(ctx, `SELECT `+adminColumns+` FROM purchases p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN sims s ON s.id = p.sim_id WHERE p.id::text = $1`, id))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	_, _ = h.DB.Exec(ctx, `INSERT INTO admin_log (action, detail) VALUES ('Paiement vérifié', $1)`, id+" : "+said)
	httpx.JSON(w, http.StatusOK, map[string]any{"purchase": p, "said": said})
}

func (h *Handler) recheck(ctx context.Context, id string, ref, token, product *string) (string, error) {
	switch {
	case token != nil:
		if h.Play == nil {
			return "", errors.New("Google Play n'est pas configuré sur ce serveur")
		}
		pr, ok := FindPlay(deref(product))
		if !ok {
			return "", errors.New("produit Google Play inconnu")
		}
		pp, err := h.Play.Get(ctx, pr.ID, *token)
		if err != nil {
			return "", errors.New("Google Play ne répond pas : " + err.Error())
		}
		if err := h.playApply(ctx, id, pr, *token, pp); err != nil {
			return "", err
		}
		state := map[int]string{0: "payé", 1: "annulé ou remboursé", 2: "en attente (paiement en espèces)"}[pp.PurchaseState]
		if pp.Test() {
			state += ", achat de test"
		}
		return "Google Play : " + state, nil
	case ref != nil:
		if h.Pay == nil {
			return "", errors.New("GeniusPay n'est pas configuré sur ce serveur")
		}
		pay, err := h.Pay.Get(ctx, *ref)
		if err != nil {
			return "", errors.New("GeniusPay ne répond pas : " + err.Error())
		}
		if _, _, err := h.settleWith(ctx, id, pay); err != nil {
			return "", err
		}
		said := "GeniusPay : « " + cmpOr(pay.Status, "?") + " »"
		if pay.Amount > 0 {
			said += ", " + thousands(int(math.Round(float64(pay.Amount)))) + " " + cmpOr(pay.Currency, "XOF")
		}
		if pay.Environment != "" {
			said += " (" + pay.Environment + ")"
		}
		return said, nil
	}
	return "", errors.New("aucun paiement ouvert chez GeniusPay pour cet achat (la page n'a jamais été créée)")
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func cmpOr(s, or string) string {
	if s == "" {
		return or
	}
	return s
}
