package shop

// Google Play Billing: the Android app (native/, on the Play Store) sells
// the shop's things through Google Play, as Google wants for what's digital
// in a Play app; the website keeps GeniusPay. The app buys a product (its ID
// is the catalogue's PlayID), then sends its purchase token here
// (POST /shop/play). The token is believed only once Google's Developer API
// (androidpublisher v3, purchases.products.get) says it's purchased, for this
// app and this product: then what was bought is given, once (purchases.
// play_token and play_order are unique), and the purchase is consumed (it
// can be bought again: Djai, the Pass, a boost, growing up) or acknowledged
// (kept for good: the crown, a piece of clothing). A cash payment can wait
// (purchaseState 2): recorded pending, and given when Google says it's paid
// (its real-time notification, POST /shop/play/rtdn, or WatchPlay asking
// again). Behind the update « paiement-google ».

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/oauth2/google"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// PlayKey: the update that opens Google Play's purchases in the app (features.List, web lib/features.ts).
const PlayKey = "paiement-google"

// PlayPackage: the Android app on the Play Store (native/app.json android.package).
const PlayPackage = "com.lifeinbabi.babi_life"

const playScope = "https://www.googleapis.com/auth/androidpublisher"

// Play: Google Play's Developer API, with the service account's token.
type Play struct {
	Package string
	// Base: the API's address (a fake one in the tests).
	Base   string
	Client *http.Client
	// RTDNToken: when set, the real-time notifications must bring it (?token=…, the Pub/Sub push's address).
	RTDNToken string
}

// PlayFromEnv: Google Play with the service account in GOOGLE_PLAY_SERVICE_ACCOUNT (its JSON, raw or in
// base64), or nil (not set: the app's purchases refused, said not set up).
func PlayFromEnv() (*Play, error) {
	sa := strings.TrimSpace(os.Getenv("GOOGLE_PLAY_SERVICE_ACCOUNT"))
	if sa == "" {
		return nil, nil
	}
	p, err := NewPlay(sa)
	if p != nil {
		p.RTDNToken = os.Getenv("GOOGLE_PLAY_RTDN_TOKEN")
	}
	return p, err
}

// NewPlay: Google Play with this service account's JSON (raw or base64).
func NewPlay(serviceAccount string) (*Play, error) {
	raw, err := serviceAccountJSON(serviceAccount)
	if err != nil {
		return nil, err
	}
	conf, err := google.JWTConfigFromJSON(raw, playScope)
	if err != nil {
		return nil, fmt.Errorf("GOOGLE_PLAY_SERVICE_ACCOUNT: %w", err)
	}
	if conf.Email == "" || len(conf.PrivateKey) == 0 {
		return nil, errors.New("GOOGLE_PLAY_SERVICE_ACCOUNT: no client_email or private_key (a service account's key, as JSON)")
	}
	c := conf.Client(context.Background())
	c.Timeout = 20 * time.Second
	return &Play{Package: PlayPackage, Base: "https://androidpublisher.googleapis.com", Client: c}, nil
}

// serviceAccountJSON: the JSON as it is, or decoded from base64 (an environment that won't take it raw).
func serviceAccountJSON(s string) ([]byte, error) {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "{") {
		return []byte(s), nil
	}
	for _, enc := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		if b, err := enc.DecodeString(s); err == nil && json.Valid(b) {
			return b, nil
		}
	}
	return nil, errors.New("GOOGLE_PLAY_SERVICE_ACCOUNT: neither a service account's JSON nor its base64")
}

// PlayPurchase: Google's word on a one-time product's purchase (purchases.products.get).
type PlayPurchase struct {
	// PurchaseState: 0 purchased, 1 cancelled (or refunded), 2 pending.
	PurchaseState int `json:"purchaseState"`
	// ConsumptionState: 0 not consumed yet, 1 consumed.
	ConsumptionState int `json:"consumptionState"`
	// AcknowledgementState: 0 not acknowledged yet (refunded by Google after 3 days), 1 acknowledged.
	AcknowledgementState int    `json:"acknowledgementState"`
	OrderID              string `json:"orderId"`
	// PurchaseType: absent for a real purchase; 0 a license tester's (nothing really paid), 1 a promo code, 2 rewarded.
	PurchaseType *int `json:"purchaseType"`
	// ObfuscatedExternalAccountID: the account that bought, as the app said it (our user's ID).
	ObfuscatedExternalAccountID string `json:"obfuscatedExternalAccountId"`
	PurchaseTimeMillis          string `json:"purchaseTimeMillis"`
	RegionCode                  string `json:"regionCode"`
}

// Test: a license tester's purchase (nothing really paid).
func (p PlayPurchase) Test() bool { return p.PurchaseType != nil && *p.PurchaseType == 0 }

// errPlayUnknown: Google doesn't know this token (or not for this product): a 4xx.
var errPlayUnknown = errors.New("google play: purchase not found")

func (p *Play) url(productID, token, action string) string {
	return fmt.Sprintf("%s/androidpublisher/v3/applications/%s/purchases/products/%s/tokens/%s%s",
		strings.TrimRight(p.Base, "/"), url.PathEscape(p.Package), url.PathEscape(productID), url.PathEscape(token), action)
}

func (p *Play) do(ctx context.Context, method, u string, out any) error {
	var body io.Reader
	if method == http.MethodPost {
		body = bytes.NewReader([]byte("{}"))
	}
	req, err := http.NewRequestWithContext(ctx, method, u, body)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := p.Client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	switch {
	case res.StatusCode == http.StatusBadRequest || res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusGone:
		return fmt.Errorf("%w (%d: %.300s)", errPlayUnknown, res.StatusCode, b)
	case res.StatusCode >= 300:
		return fmt.Errorf("google play: %d: %.300s", res.StatusCode, b)
	}
	if out != nil {
		return json.Unmarshal(b, out)
	}
	return nil
}

// Get: Google's word on this purchase.
func (p *Play) Get(ctx context.Context, productID, token string) (PlayPurchase, error) {
	var pp PlayPurchase
	err := p.do(ctx, http.MethodGet, p.url(productID, token, ""), &pp)
	return pp, err
}

// Consume: bought again later (and acknowledged with it).
func (p *Play) Consume(ctx context.Context, productID, token string) error {
	return p.do(ctx, http.MethodPost, p.url(productID, token, ":consume"), nil)
}

// Acknowledge: kept for good, and not refunded by Google after 3 days.
func (p *Play) Acknowledge(ctx context.Context, productID, token string) error {
	return p.do(ctx, http.MethodPost, p.url(productID, token, ":acknowledge"), nil)
}

// PlayProduct: one in-app product on Google Play, and what it is in the shop.
type PlayProduct struct {
	ID    string `json:"id"`
	Kind  string `json:"kind"`
	Item  string `json:"item"`
	Price int    `json:"price"`
	Djai  int    `json:"djai,omitempty"`
	// Once: kept for good (acknowledged, never consumed: Google says « already owned » if bought again).
	Once bool `json:"once,omitempty"`
}

// GrowPlayID: the product for growing up at once to this stage, at its price (it depends on the stage it starts from).
func GrowPlayID(to string, price int) string {
	return fmt.Sprintf("grandir_%s_%d", to, price)
}

// PlayProducts: every in-app product to create in the Play Console (native/README.md), from the catalogue.
func PlayProducts() []PlayProduct {
	var list []PlayProduct
	for _, p := range Packs {
		list = append(list, PlayProduct{ID: p.PlayID, Kind: "djai", Item: p.ID, Price: p.Price, Djai: p.Djai})
	}
	stages := []string{game.StageBebe, game.StageEnfant, game.StageAdo, game.StageAdulte}
	for _, it := range Items {
		if it.Grow == "" {
			list = append(list, PlayProduct{ID: it.PlayID, Kind: kindOf(it), Item: it.ID, Price: it.Price, Once: it.Once})
			continue
		}
		seen := map[int]bool{}
		for _, from := range stages {
			if price := GrowPrice(from, it.Grow); price > 0 && !seen[price] {
				seen[price] = true
				list = append(list, PlayProduct{ID: GrowPlayID(it.Grow, price), Kind: "grandir", Item: it.ID, Price: price})
			}
		}
	}
	return list
}

// FindPlay: the product of this ID.
func FindPlay(id string) (PlayProduct, bool) {
	for _, p := range PlayProducts() {
		if p.ID == id {
			return p, true
		}
	}
	return PlayProduct{}, false
}

var (
	errPlayOff      = errors.New("le paiement Google Play n'est pas encore configuré sur le serveur")
	errPlayShut     = errors.New("les achats dans l'appli arrivent bientôt")
	errPlayNotFound = errors.New("Google Play ne reconnaît pas cet achat")
	errPlayOther    = errors.New("cet achat Google Play appartient à un autre compte")
	errPlayDown     = errors.New("Google Play ne répond pas : réessaie dans un instant (ton achat n'est pas perdu)")
)

// play: the app's purchase on Google Play (POST /shop/play, signed in): {productId, purchaseToken, sim?}.
// Checked with Google, then given (once), pending or refused; the purchase as the shop shows it.
func (h *Handler) play(w http.ResponseWriter, r *http.Request) {
	if h.Play == nil {
		httpx.Error(w, http.StatusServiceUnavailable, errPlayOff.Error())
		return
	}
	ctx := r.Context()
	if features.Default.BlocksKey(ctx, PlayKey) != "" {
		httpx.Error(w, http.StatusServiceUnavailable, errPlayShut.Error())
		return
	}
	var req struct {
		ProductID     string `json:"productId"`
		PurchaseToken string `json:"purchaseToken"`
		// Sim: the one playing (none: the account's first, as for a purchase whose Sim is gone).
		Sim string `json:"sim,omitempty"`
	}
	if err := httpx.Decode(r, &req); err != nil || req.PurchaseToken == "" || len(req.PurchaseToken) > 1024 {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	product, ok := FindPlay(req.ProductID)
	if !ok {
		httpx.Error(w, http.StatusUnprocessableEntity, "article inconnu")
		return
	}
	user := auth.UserID(ctx)
	var adult bool
	if err := h.DB.QueryRow(ctx, `SELECT adult_at IS NOT NULL FROM users WHERE id = $1`, user).Scan(&adult); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	// (A minor's purchase never acknowledged: Google refunds it by itself after 3 days.)
	if !adult {
		httpx.Error(w, http.StatusForbidden, errMinor.Error())
		return
	}
	var sim *string
	if req.Sim != "" {
		var mine bool
		if err := h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sims WHERE id::text = $1 AND user_id = $2)`, req.Sim, user).Scan(&mine); err != nil || !mine {
			httpx.Error(w, http.StatusNotFound, errNoSim.Error())
			return
		}
		sim = &req.Sim
	}
	p, err := h.playSettle(ctx, product, req.PurchaseToken, &user, sim)
	switch {
	case errors.Is(err, errPlayUnknown):
		httpx.Error(w, http.StatusUnprocessableEntity, errPlayNotFound.Error())
	case errors.Is(err, errPlayOther):
		httpx.Error(w, http.StatusConflict, errPlayOther.Error())
	case err != nil:
		log.Printf("shop: play %s: %v", product.ID, err)
		httpx.Error(w, http.StatusBadGateway, errPlayDown.Error())
	default:
		httpx.JSON(w, http.StatusOK, p)
	}
}

// playSettle: this token asked of Google and its purchase recorded (for this user, or the one Google
// says bought it when nil), given once paid, then consumed or acknowledged.
func (h *Handler) playSettle(ctx context.Context, product PlayProduct, token string, user, sim *string) (Purchase, error) {
	// Already known: its account must be this one.
	var id string
	var owner *string
	err := h.DB.QueryRow(ctx, `SELECT id, user_id::text FROM purchases WHERE play_token = $1`, token).Scan(&id, &owner)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return Purchase{}, err
	}
	known := err == nil
	if known && user != nil && (owner == nil || *owner != *user) {
		return Purchase{}, errPlayOther
	}
	pp, err := h.Play.Get(ctx, product.ID, token)
	if err != nil {
		return Purchase{}, err
	}
	// The account the app said bought it (our user's ID): it must be this one.
	if pp.ObfuscatedExternalAccountID != "" && user != nil && pp.ObfuscatedExternalAccountID != *user {
		return Purchase{}, errPlayOther
	}
	if user == nil && !known {
		// Told by Google alone (its notification): the account the app gave when buying, or nobody to give it to.
		if pp.ObfuscatedExternalAccountID == "" {
			return Purchase{}, errPlayUnknown
		}
		var u string
		if err := h.DB.QueryRow(ctx, `SELECT id::text FROM users WHERE id::text = $1`, pp.ObfuscatedExternalAccountID).Scan(&u); err != nil {
			return Purchase{}, errPlayUnknown
		}
		user = &u
	}
	if !known {
		// Recorded once (two calls at once: the token's uniqueness keeps one).
		_, err := h.DB.Exec(ctx, `INSERT INTO purchases (user_id, sim_id, kind, item, pack, price, djai, sandbox, status, play_token, play_product)
			VALUES ($1, $2, $3, $4, $4, $5, $6, $7, 'pending', $8, $9) ON CONFLICT (play_token) DO NOTHING`,
			user, sim, product.Kind, product.Item, product.Price, product.Djai, pp.Test(), token, product.ID)
		if err != nil {
			return Purchase{}, err
		}
		if err := h.DB.QueryRow(ctx, `SELECT id FROM purchases WHERE play_token = $1`, token).Scan(&id); err != nil {
			return Purchase{}, err
		}
	}
	if err := h.playApply(ctx, id, product, token, pp); err != nil {
		return Purchase{}, err
	}
	var p Purchase
	err = h.DB.QueryRow(ctx, `SELECT id, kind, item, price, djai, status, credited_at IS NOT NULL, created_at FROM purchases WHERE id = $1`, id).
		Scan(&p.ID, &p.Kind, &p.Item, &p.Price, &p.Djai, &p.Status, &p.Credited, &p.At)
	return p, err
}

// playApply: what Google says of a recorded purchase, done: given (once) and finished, still pending, or cancelled.
func (h *Handler) playApply(ctx context.Context, id string, product PlayProduct, token string, pp PlayPurchase) error {
	switch pp.PurchaseState {
	case 0:
		if pp.OrderID != "" {
			// The order's number, unique: one order given once, whatever token it came with.
			if _, err := h.DB.Exec(ctx, `UPDATE purchases SET play_order = $2 WHERE id = $1 AND play_order IS NULL`, id, pp.OrderID); err != nil {
				log.Printf("shop: play %s: order %s already recorded: %v", id, pp.OrderID, err)
				_, err = h.DB.Exec(ctx, `UPDATE purchases SET status = 'mismatch', updated_at = now() WHERE id = $1 AND credited_at IS NULL`, id)
				return err
			}
		}
		if _, _, err := h.creditIf(ctx, id, nil); err != nil {
			return err
		}
		return h.playFinish(ctx, id, product, token, pp)
	case 2:
		_, err := h.DB.Exec(ctx, `UPDATE purchases SET status = 'pending', updated_at = now() WHERE id = $1 AND credited_at IS NULL`, id)
		return err
	default:
		// Cancelled before it was paid, or refunded after: what it brought taken back.
		var credited bool
		if err := h.DB.QueryRow(ctx, `SELECT credited_at IS NOT NULL FROM purchases WHERE id = $1`, id).Scan(&credited); err != nil {
			return err
		}
		if credited {
			return h.refund(ctx, id)
		}
		_, err := h.DB.Exec(ctx, `UPDATE purchases SET status = 'cancelled', updated_at = now() WHERE id = $1 AND credited_at IS NULL`, id)
		return err
	}
}

// playFinish: a given purchase consumed (bought again later) or acknowledged (kept), once (play_finished).
func (h *Handler) playFinish(ctx context.Context, id string, product PlayProduct, token string, pp PlayPurchase) error {
	var err error
	switch {
	case product.Once && pp.AcknowledgementState == 0:
		err = h.Play.Acknowledge(ctx, product.ID, token)
	case !product.Once && pp.ConsumptionState == 0:
		err = h.Play.Consume(ctx, product.ID, token)
	}
	if err != nil {
		// Given all the same; WatchPlay finishes it later (Google refunds what's left unacknowledged 3 days).
		log.Printf("shop: play %s: finishing %s: %v", id, product.ID, err)
		return nil
	}
	_, err = h.DB.Exec(ctx, `UPDATE purchases SET play_finished = true, updated_at = now() WHERE id = $1`, id)
	return err
}

// PlayNotification: Google Play's real-time developer notification (POST /shop/play/rtdn, a Pub/Sub
// push, not signed in). It only says « go and look »: the token is asked of Google before anything.
func (h *Handler) PlayNotification(w http.ResponseWriter, r *http.Request) {
	if h.Play == nil {
		httpx.Error(w, http.StatusServiceUnavailable, errPlayOff.Error())
		return
	}
	if h.Play.RTDNToken != "" && r.URL.Query().Get("token") != h.Play.RTDNToken {
		httpx.Error(w, http.StatusUnauthorized, "invalid token")
		return
	}
	var push struct {
		Message struct {
			Data []byte `json:"data"`
		} `json:"message"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&push); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	var n struct {
		PackageName string `json:"packageName"`
		OneTime     *struct {
			NotificationType int    `json:"notificationType"`
			PurchaseToken    string `json:"purchaseToken"`
			SKU              string `json:"sku"`
		} `json:"oneTimeProductNotification"`
		Voided *struct {
			PurchaseToken string `json:"purchaseToken"`
		} `json:"voidedPurchaseNotification"`
	}
	_ = json.Unmarshal(push.Message.Data, &n)
	ctx := r.Context()
	var token, sku string
	switch {
	case n.PackageName != "" && n.PackageName != h.Play.Package:
	case n.OneTime != nil:
		token, sku = n.OneTime.PurchaseToken, n.OneTime.SKU
	case n.Voided != nil:
		// A refund: the product is the one recorded with its token.
		token = n.Voided.PurchaseToken
		_ = h.DB.QueryRow(ctx, `SELECT play_product FROM purchases WHERE play_token = $1`, token).Scan(&sku)
	}
	product, ok := FindPlay(sku)
	if token == "" || !ok {
		// A test notification, a subscription's, another app's: acknowledged, nothing to do.
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ignored"})
		return
	}
	p, err := h.playSettle(ctx, product, token, nil, nil)
	switch {
	case errors.Is(err, errPlayUnknown):
		log.Printf("shop: play notification for %s: nobody to give it to (%v)", sku, err)
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "unknown"})
	case err != nil:
		// Pub/Sub sends it again later.
		log.Printf("shop: play notification for %s: %v", sku, err)
		httpx.Error(w, http.StatusBadGateway, "try again")
	default:
		httpx.JSON(w, http.StatusOK, map[string]string{"status": p.Status})
	}
}

// WatchPlay: now and then, the app's purchases still waiting (a cash payment, a notification lost)
// asked of Google again, and the given ones not yet consumed or acknowledged finished.
func (h *Handler) WatchPlay(ctx context.Context, every time.Duration) {
	if h.Play == nil {
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
		h.recheckPlay(ctx)
	}
}

func (h *Handler) recheckPlay(ctx context.Context) {
	rows, err := h.DB.Query(ctx, `SELECT id, play_product, play_token FROM purchases WHERE play_token IS NOT NULL
		AND (credited_at IS NULL AND status = 'pending' OR credited_at IS NOT NULL AND NOT play_finished AND status = 'completed')
		AND created_at > now() - interval '30 days' AND updated_at < now() - interval '2 minutes' ORDER BY created_at LIMIT 50`)
	if err != nil {
		return
	}
	type open struct{ id, product, token string }
	list, _ := pgx.CollectRows(rows, func(row pgx.CollectableRow) (open, error) {
		var o open
		return o, row.Scan(&o.id, &o.product, &o.token)
	})
	for _, o := range list {
		product, ok := FindPlay(o.product)
		if !ok {
			continue
		}
		pp, err := h.Play.Get(ctx, product.ID, o.token)
		if err != nil {
			log.Printf("shop: watch play %s: %v", o.id, err)
			// Asked again later (its updated_at moved: not every round).
			_, _ = h.DB.Exec(ctx, `UPDATE purchases SET updated_at = now() WHERE id = $1`, o.id)
			continue
		}
		if err := h.playApply(ctx, o.id, product, o.token, pp); err != nil {
			log.Printf("shop: watch play %s: %v", o.id, err)
		}
		_, _ = h.DB.Exec(ctx, `UPDATE purchases SET updated_at = now() WHERE id = $1`, o.id)
	}
}
