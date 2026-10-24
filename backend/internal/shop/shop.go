// Package shop: la boutique, Djai bought with real money (F CFA, through
// GeniusPay). The game is played for free from start to end; a pack only
// brings Djai sooner. For accounts of 18 or over, a few packs at fixed
// prices (set here, never by the phone). A purchase's Djai are added to the
// Sim once GeniusPay says, when asked, that it's paid the right sum:
// whether the player comes back to the game, its webhook arrives, or the
// shop looks again by itself; and only once.
package shop

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Pack: Djai for a price in F CFA. The bigger ones give a little more per franc.
type Pack struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Price int    `json:"price"`
	Djai  int    `json:"djai"`
	// Bonus: what it gives beyond the smallest pack's rate, said on the card.
	Bonus string `json:"bonus,omitempty"`
}

var Packs = []Pack{
	{ID: "piece", Label: "La pièce", Price: 500, Djai: 40_000},
	{ID: "gombo", Label: "Le gombo", Price: 1000, Djai: 90_000, Bonus: "+12 %"},
	{ID: "djossi", Label: "Le djossi", Price: 2500, Djai: 240_000, Bonus: "+20 %"},
	{ID: "boss", Label: "Le boss", Price: 5000, Djai: 520_000, Bonus: "+30 %"},
	{ID: "grotto", Label: "Le grotto", Price: 10_000, Djai: 1_120_000, Bonus: "+40 %"},
}

func FindPack(id string) (Pack, bool) {
	for _, p := range Packs {
		if p.ID == id {
			return p, true
		}
	}
	return Pack{}, false
}

type Handler struct {
	DB *pgxpool.Pool
	// Pay: nil while GeniusPay's keys aren't set (the shop shows, shut).
	Pay *GeniusPay
	// Site: the game's address, where GeniusPay sends the player back; API: the API's own (for the webhook).
	Site, API string
	// Changed: the Sim's devices told (its money changed).
	Changed func(simID string)
}

// Routes: the player's (signed in).
func (h *Handler) Routes(r chi.Router) {
	r.Get("/sims/{id}/shop", h.view)
	r.Post("/sims/{id}/shop", h.buy)
	r.Post("/sims/{id}/shop/{purchase}", h.check)
}

// Purchase: one, as the player sees it.
type Purchase struct {
	ID       string    `json:"id"`
	Pack     string    `json:"pack"`
	Price    int       `json:"price"`
	Djai     int       `json:"djai"`
	Status   string    `json:"status"`
	Credited bool      `json:"credited"`
	At       time.Time `json:"at"`
}

type view struct {
	// Open: GeniusPay set up; Sandbox: its test keys (nothing really paid).
	Open      bool       `json:"open"`
	Sandbox   bool       `json:"sandbox,omitempty"`
	Adult     bool       `json:"adult"`
	Packs     []Pack     `json:"packs"`
	Purchases []Purchase `json:"purchases"`
}

var (
	errShut     = errors.New("la boutique ouvre bientôt")
	errMinor    = errors.New("les achats sont réservés aux 18 ans et plus")
	errNoSim    = errors.New("sim introuvable")
	errTooMany  = errors.New("trop d'achats en attente : termine ou attends ceux en cours")
	errNotFound = errors.New("achat introuvable")
)

// owner: the account's Sim (and whether the account is 18 or over, a tester's, its name and e-mail for the receipt).
func (h *Handler) owner(ctx context.Context, r *http.Request) (simID string, adult, tester bool, c Customer, err error) {
	simID = chi.URLParam(r, "id")
	err = h.DB.QueryRow(ctx, `SELECT u.adult_at IS NOT NULL, u.tester, u.name, u.email FROM sims s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.user_id = $2`,
		simID, auth.UserID(ctx)).Scan(&adult, &tester, &c.Name, &c.Email)
	if !strings.Contains(c.Email, "@") {
		c.Email = ""
	}
	return
}

func (h *Handler) view(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	_, adult, tester, _, err := h.owner(ctx, r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, errNoSim.Error())
		return
	}
	rows, err := h.DB.Query(ctx, `SELECT id, pack, price, djai, status, credited_at IS NOT NULL, created_at FROM purchases
		WHERE user_id = $1 AND status <> 'created' ORDER BY created_at DESC LIMIT 10`, auth.UserID(ctx))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	list, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Purchase, error) {
		var p Purchase
		return p, row.Scan(&p.ID, &p.Pack, &p.Price, &p.Djai, &p.Status, &p.Credited, &p.At)
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	// Test keys: nothing is really paid, so only the team's accounts buy (else anyone would get Djai for free).
	sandbox := h.Pay != nil && h.Pay.Sandbox()
	httpx.JSON(w, http.StatusOK, view{Open: h.Pay != nil && (!sandbox || tester), Sandbox: sandbox, Adult: adult, Packs: Packs, Purchases: list})
}

// buy: a payment opened at GeniusPay for the pack; the player is sent to its page.
func (h *Handler) buy(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Pack string `json:"pack"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	pack, ok := FindPack(req.Pack)
	if !ok {
		httpx.Error(w, http.StatusUnprocessableEntity, "pack inconnu")
		return
	}
	if h.Pay == nil {
		httpx.Error(w, http.StatusServiceUnavailable, errShut.Error())
		return
	}
	ctx := r.Context()
	simID, adult, tester, customer, err := h.owner(ctx, r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, errNoSim.Error())
		return
	}
	if h.Pay.Sandbox() && !tester {
		httpx.Error(w, http.StatusServiceUnavailable, errShut.Error())
		return
	}
	if !adult {
		httpx.Error(w, http.StatusForbidden, errMinor.Error())
		return
	}
	user := auth.UserID(ctx)
	var waiting int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM purchases WHERE user_id = $1 AND credited_at IS NULL AND status IN ('created', 'pending', 'processing') AND created_at > now() - interval '15 minutes'`, user).Scan(&waiting)
	if waiting >= 5 {
		httpx.Error(w, http.StatusTooManyRequests, errTooMany.Error())
		return
	}
	var id string
	if err := h.DB.QueryRow(ctx, `INSERT INTO purchases (user_id, sim_id, pack, price, djai, sandbox) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		user, simID, pack.ID, pack.Price, pack.Djai, h.Pay.Sandbox()).Scan(&id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	back := h.Site + "/jeu?achat=" + id
	np := NewPayment{
		Amount: pack.Price, Currency: "XOF", Description: fmt.Sprintf("Babi Life · %s Djai (%s)", thousands(pack.Djai), pack.Label),
		SuccessURL: back, ErrorURL: back + "&echec=1",
		Metadata: map[string]string{"purchase": id, "sim": simID, "pack": pack.ID},
	}
	if customer.Name != "" || customer.Email != "" {
		np.Customer = &customer
	}
	if h.API != "" {
		np.WebhookURL = h.API + "/api/v1/shop/geniuspay"
	}
	pay, err := h.Pay.Create(ctx, np)
	if err != nil || pay.URL() == "" {
		log.Printf("shop: payment not created for %s: %v", id, err)
		_, _ = h.DB.Exec(ctx, `UPDATE purchases SET status = 'error', updated_at = now() WHERE id = $1`, id)
		httpx.Error(w, http.StatusBadGateway, "GeniusPay ne répond pas : réessaie dans un instant")
		return
	}
	if _, err := h.DB.Exec(ctx, `UPDATE purchases SET reference = $2, status = 'pending', updated_at = now() WHERE id = $1`, id, pay.Reference); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"id": id, "url": pay.URL()})
}

// check: back from GeniusPay's page (or waiting on it): the purchase as GeniusPay says it now.
func (h *Handler) check(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var p Purchase
	var ref *string
	err := h.DB.QueryRow(ctx, `SELECT id, pack, price, djai, status, credited_at IS NOT NULL, created_at, reference FROM purchases WHERE id = $1 AND user_id = $2 AND sim_id = $3`,
		chi.URLParam(r, "purchase"), auth.UserID(ctx), chi.URLParam(r, "id")).Scan(&p.ID, &p.Pack, &p.Price, &p.Djai, &p.Status, &p.Credited, &p.At, &ref)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, errNotFound.Error())
		return
	}
	if !p.Credited && ref != nil && h.Pay != nil && open(p.Status) {
		if p.Status, p.Credited, err = h.settle(ctx, p.ID, *ref); err != nil {
			log.Printf("shop: check %s: %v", p.ID, err)
		}
	}
	httpx.JSON(w, http.StatusOK, p)
}

// open: GeniusPay hasn't said its last word yet.
func open(status string) bool { return status == "pending" || status == "processing" }

// Paid: GeniusPay's words for a payment received.
func paid(status string) bool {
	switch status {
	case "completed", "success", "succeeded", "paid":
		return true
	}
	return false
}

// settle asks GeniusPay how the payment stands and, paid the right sum, adds the Djai (once).
func (h *Handler) settle(ctx context.Context, id, reference string) (status string, credited bool, err error) {
	pay, err := h.Pay.Get(ctx, reference)
	if err != nil {
		return "pending", false, err
	}
	status = strings.ToLower(pay.Status)
	if paid(status) {
		return h.credit(ctx, id, pay)
	}
	switch status {
	case "pending", "processing", "failed", "expired", "cancelled":
	case "refunded":
		return status, false, h.refund(ctx, id)
	default:
		status = "processing"
	}
	_, err = h.DB.Exec(ctx, `UPDATE purchases SET status = $2, updated_at = now() WHERE id = $1 AND credited_at IS NULL`, id, status)
	return status, false, err
}

// credit adds a paid purchase's Djai to its Sim, with a line in its journal; done once (credited_at).
func (h *Handler) credit(ctx context.Context, id string, pay Payment) (string, bool, error) {
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return "pending", false, err
	}
	defer tx.Rollback(ctx)
	var simID *string
	var user, packID string
	var price, djai int
	var already bool
	if err := tx.QueryRow(ctx, `SELECT sim_id, user_id, pack, price, djai, credited_at IS NOT NULL FROM purchases WHERE id = $1 FOR UPDATE`, id).Scan(&simID, &user, &packID, &price, &djai, &already); err != nil {
		return "pending", false, err
	}
	if already {
		return "completed", true, nil
	}
	// Not the sum sold, or a test payment while the shop sells for real: nothing added (looked at by hand).
	if int(pay.Amount) != price || pay.Currency != "" && !strings.EqualFold(pay.Currency, "XOF") || !h.Pay.Sandbox() && strings.EqualFold(pay.Environment, "sandbox") {
		log.Printf("shop: purchase %s paid %v %s, sold %d XOF: not credited", id, float64(pay.Amount), pay.Currency, price)
		_, err := tx.Exec(ctx, `UPDATE purchases SET status = 'mismatch', updated_at = now() WHERE id = $1`, id)
		if err == nil {
			err = tx.Commit(ctx)
		}
		return "mismatch", false, err
	}
	// Its Sim gone since: the account's (the oldest one, the one the game plays).
	if simID == nil {
		var s string
		if err := tx.QueryRow(ctx, `SELECT id FROM sims WHERE user_id = $1 ORDER BY created_at LIMIT 1`, user).Scan(&s); err != nil {
			return "pending", false, err
		}
		simID = &s
	}
	var minutes int64
	if err := tx.QueryRow(ctx, `UPDATE sims SET money = money + $2 WHERE id = $1 RETURNING game_minutes`, *simID, djai).Scan(&minutes); err != nil {
		return "pending", false, err
	}
	pack, _ := FindPack(packID)
	text := fmt.Sprintf("Boutique : %s Djai (%s), merci !", thousands(djai), pack.Label)
	if _, err := tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) VALUES ($1, 'transfer', $2, $3, $4)`, *simID, text, djai, minutes); err != nil {
		return "pending", false, err
	}
	if _, err := tx.Exec(ctx, `UPDATE purchases SET status = 'completed', credited_at = now(), sim_id = $2, updated_at = now() WHERE id = $1`, id, *simID); err != nil {
		return "pending", false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return "pending", false, err
	}
	if h.Changed != nil {
		h.Changed(*simID)
	}
	return "completed", true, nil
}

// refund: paid back by GeniusPay: the Djai it brought taken back (what's left of them).
func (h *Handler) refund(ctx context.Context, id string) error {
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var simID *string
	var djai int
	var credited bool
	if err := tx.QueryRow(ctx, `SELECT sim_id, djai, credited_at IS NOT NULL FROM purchases WHERE id = $1 AND status <> 'refunded' FOR UPDATE`, id).Scan(&simID, &djai, &credited); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	if credited && simID != nil {
		var minutes int64
		if err := tx.QueryRow(ctx, `UPDATE sims SET money = money - LEAST(GREATEST(money, 0), $2) WHERE id = $1 RETURNING game_minutes`, *simID, djai).Scan(&minutes); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) VALUES ($1, 'transfer', 'Boutique : achat remboursé, ses Djai repris.', $2, $3)`, *simID, -djai, minutes); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE purchases SET status = 'refunded', updated_at = now() WHERE id = $1`, id); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	if credited && simID != nil && h.Changed != nil {
		h.Changed(*simID)
	}
	return nil
}

// Webhook: GeniusPay telling a payment changed (POST /shop/geniuspay, not signed in). Its
// signature checked, the payment is asked of GeniusPay itself before anything is done.
func (h *Handler) Webhook(w http.ResponseWriter, r *http.Request) {
	if h.Pay == nil {
		httpx.Error(w, http.StatusServiceUnavailable, errShut.Error())
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64<<10))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if !h.Pay.Signed(body, r.Header, time.Now()) {
		httpx.Error(w, http.StatusUnauthorized, "invalid signature")
		return
	}
	var hook struct {
		Event string `json:"event"`
		Data  struct {
			Reference string `json:"reference"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &hook); err != nil || hook.Data.Reference == "" {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ignored"})
		return
	}
	ctx := r.Context()
	var id string
	var credited bool
	err = h.DB.QueryRow(ctx, `SELECT id, credited_at IS NOT NULL FROM purchases WHERE reference = $1`, hook.Data.Reference).Scan(&id, &credited)
	if err != nil {
		// Not one of ours (another site on the same account, a test): nothing to do.
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "unknown"})
		return
	}
	if credited && !strings.Contains(hook.Event, "refund") {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "completed"})
		return
	}
	status, _, err := h.settle(ctx, id, hook.Data.Reference)
	if err != nil {
		// GeniusPay sends it again later.
		log.Printf("shop: webhook %s: %v", id, err)
		httpx.Error(w, http.StatusBadGateway, "try again")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": status})
}

// Watch: now and then, the purchases still waiting asked again (a webhook lost, a player who
// paid and never came back): a day at most, after that GeniusPay's page has expired.
func (h *Handler) Watch(ctx context.Context, every time.Duration) {
	if h.Pay == nil {
		return
	}
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		rows, err := h.DB.Query(ctx, `SELECT id, reference FROM purchases WHERE credited_at IS NULL AND status IN ('pending', 'processing')
			AND reference IS NOT NULL AND created_at > now() - interval '25 hours' AND updated_at < now() - interval '2 minutes' ORDER BY created_at LIMIT 50`)
		if err != nil {
			continue
		}
		type open struct{ id, ref string }
		list, _ := pgx.CollectRows(rows, func(row pgx.CollectableRow) (open, error) {
			var o open
			return o, row.Scan(&o.id, &o.ref)
		})
		for _, o := range list {
			if _, _, err := h.settle(ctx, o.id, o.ref); err != nil {
				log.Printf("shop: watch %s: %v", o.id, err)
			}
		}
		// Past a day, a page never paid: expired.
		_, _ = h.DB.Exec(ctx, `UPDATE purchases SET status = 'expired', updated_at = now() WHERE credited_at IS NULL AND status IN ('created', 'pending', 'processing') AND created_at < now() - interval '25 hours'`)
	}
}

// thousands: 40 000, as the game writes amounts.
func thousands(n int) string {
	s := fmt.Sprint(n)
	var b strings.Builder
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteString(" ")
		}
		b.WriteRune(c)
	}
	return b.String()
}
