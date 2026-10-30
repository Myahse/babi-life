// Package shop: la boutique, what's paid with real money (F CFA, through
// GeniusPay). The game is played for free from start to end; the shop only
// brings Djai sooner, or a comfort, or a mark. For accounts of 18 or over:
// a few packs of Djai, the Babi Pass (a month: a quarter more on the Djai
// earned, the gold star by the name), « Plein d'énergie » (every need full
// at once), the Pack Prestige (the crown, for good). And the advertisers'
// pubs (ads/): a campaign's price, paid from its follow-up page. Prices are
// set here, never by the phone. A purchase is credited once GeniusPay says,
// when asked, that it's paid the right sum: whether the player comes back
// to the game, its webhook arrives, or the shop looks again by itself; and
// only once.
package shop

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
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
	// PlayID: its in-app product on Google Play (the Android app pays through Play Billing, play.go).
	PlayID string `json:"playId"`
}

var Packs = []Pack{
	{ID: "piece", Label: "La pièce", Price: 500, Djai: 40_000, PlayID: "djai_500"},
	{ID: "gombo", Label: "Le gombo", Price: 1000, Djai: 90_000, Bonus: "+12 %", PlayID: "djai_1000"},
	{ID: "djossi", Label: "Le djossi", Price: 2500, Djai: 240_000, Bonus: "+20 %", PlayID: "djai_2500"},
	{ID: "boss", Label: "Le boss", Price: 5000, Djai: 520_000, Bonus: "+30 %", PlayID: "djai_5000"},
	{ID: "grotto", Label: "Le grotto", Price: 10_000, Djai: 1_120_000, Bonus: "+40 %", PlayID: "djai_10000"},
}

// Item: something else than Djai, for a price in F CFA.
type Item struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Text  string `json:"text"`
	Price int    `json:"price"`
	// Once: bought once and kept (the pack Prestige); the others again and again.
	Once bool `json:"once,omitempty"`
	// Piece: a piece of clothing (game/clothes.go Premium), into the wardrobe.
	Piece string `json:"piece,omitempty"`
	// Grow: growing up at once to this stage (a child, an adult) instead of waiting the days of childhood.
	Grow string `json:"grow,omitempty"`
	// PlayID: its in-app product on Google Play (play.go); a growing up's depends on the stage it starts from (GrowPlayID).
	PlayID string `json:"playId,omitempty"`
}

// PassDays: how long the Babi Pass lasts, from its purchase (or the end of the one before).
const PassDays = 30

var Items = []Item{
	{ID: "pass", Label: "Babi Pass · 30 jours", Text: "Un quart de Djai en plus sur tout ce que tu gagnes (boulot, petits boulots, défis), et l'étoile dorée à ton nom.", Price: 1500, PlayID: "babi_pass_30j"},
	{ID: "energie", Label: "Plein d'énergie", Text: "Faim, énergie, hygiène, social, loisirs : toutes les jauges à fond, tout de suite.", Price: 300, PlayID: "plein_energie"},
	{ID: "prestige", Label: "Pack Prestige", Text: "La couronne, à porter pour toujours (Profil, Mon look).", Price: 2000, Once: true, PlayID: "pack_prestige"},
	{ID: "veste-repos", Label: "La veste du repos", Text: "La chemise patchwork turquoise, bleu nuit, blanc et orange, son motif qu'on ne trouve nulle part ailleurs : dans ta garde-robe pour toujours.", Price: 1500, Once: true, Piece: "veste-repos", PlayID: "veste_repos"},
	// Growing up at once: its price set by the stage the Sim is at (GrowPrice), shown only when offered.
	{ID: "grandir-enfant", Label: "Enfant tout de suite", Text: "3 ans tout de suite : l'école, la récré, les copains. Sinon le bébé grandit tout seul, en deux heures de jeu.", Grow: game.StageEnfant},
	{ID: "grandir-ado", Label: "Ado tout de suite", Text: "12 ans tout de suite : le collège, et ton premier téléphone avec ses applis.", Grow: game.StageAdo},
	{ID: "grandir-adulte", Label: "Adulte tout de suite", Text: "18 ans tout de suite : tu quittes la maison avec l'argent de ta famille, le boulot, ton mentor.", Grow: game.StageAdulte},
	{ID: "polo-mere-con", Label: "Le polo de mère con", Text: "Le polo à larges rayures orange et blanches, son col blanc : dans ta garde-robe pour toujours.", Price: 1500, Once: true, Piece: "polo-mere-con", PlayID: "polo_mere_con"},
}

// GrowPrice: what growing up at once costs, in F CFA, from the stage the Sim
// is at to the one bought: the baby's 2 hours 1 000, then a step at a time
// 2 000 (enfant → ado, ado → adulte), or from the cradle 3 000 to ado and
// 5 000 to adulte.
// 0: not offered (already older, or a jump not sold).
func GrowPrice(from, to string) int {
	return map[[2]string]int{
		{game.StageBebe, game.StageEnfant}: 1000,
		{game.StageEnfant, game.StageAdo}:  2000,
		{game.StageAdo, game.StageAdulte}:  2000,
		{game.StageBebe, game.StageAdo}:    3000,
		{game.StageBebe, game.StageAdulte}: 5000,
	}[[2]string{from, to}]
}

func FindPack(id string) (Pack, bool) {
	for _, p := range Packs {
		if p.ID == id {
			return p, true
		}
	}
	return Pack{}, false
}

// kindOf: the purchase's kind for an item (give's switch): its ID, or « tenue » for a piece, « grandir » for growing up.
func kindOf(it Item) string {
	switch {
	case it.Piece != "":
		return "tenue"
	case it.Grow != "":
		return "grandir"
	}
	return it.ID
}

func FindItem(id string) (Item, bool) {
	for _, it := range Items {
		if it.ID == id {
			return it, true
		}
	}
	return Item{}, false
}

type Handler struct {
	DB *pgxpool.Pool
	// Pay: nil while GeniusPay's keys aren't set (the shop shows, shut).
	Pay *GeniusPay
	// Play: Google Play's Developer API, for the Android app's purchases (nil: GOOGLE_PLAY_SERVICE_ACCOUNT not set).
	Play *Play
	// Site: the game's address, where GeniusPay sends the player back; API: the API's own (for the webhook).
	Site, API string
	// Changed: the Sim's devices told (its money, its Pass changed).
	Changed func(simID string)
}

// Routes: the player's (signed in).
func (h *Handler) Routes(r chi.Router) {
	r.Get("/sims/{id}/shop", h.view)
	r.Post("/sims/{id}/shop", h.buy)
	r.Post("/sims/{id}/shop/{purchase}", h.check)
	// The Android app's purchase on Google Play (play.go).
	r.Post("/shop/play", h.play)
}

// PubRoutes: the advertiser's, by the campaign's private token (not signed in).
func (h *Handler) PubRoutes(r chi.Router) {
	r.Post("/ads/campaigns/{token}/pay", h.payCampaign)
	r.Post("/ads/campaigns/{token}/pay/{purchase}", h.checkCampaign)
}

// Purchase: one, as the player sees it.
type Purchase struct {
	ID       string    `json:"id"`
	Kind     string    `json:"kind"`
	Item     string    `json:"item"`
	Price    int       `json:"price"`
	Djai     int       `json:"djai"`
	Status   string    `json:"status"`
	Credited bool      `json:"credited"`
	At       time.Time `json:"at"`
}

type view struct {
	// Open: GeniusPay set up; Sandbox: its test keys (nothing really paid).
	Open    bool `json:"open"`
	Sandbox bool `json:"sandbox,omitempty"`
	// Play: the Android app pays through Google Play Billing (play.go): set up and its update open.
	Play  bool `json:"play,omitempty"`
	Adult bool `json:"adult"`
	// PassUntil: the Pass on, till then; Prestige: the pack bought.
	PassUntil *time.Time `json:"passUntil,omitempty"`
	Prestige  bool       `json:"prestige"`
	Packs     []Pack     `json:"packs"`
	// Operators: with the update « frais-operateur », the ways to pay and their fees (on top of the price).
	Operators []Operator `json:"operators,omitempty"`
	Items     []Item     `json:"items"`
	Purchases []Purchase `json:"purchases"`
}

var (
	errShut     = errors.New("la boutique ouvre bientôt")
	errMinor    = errors.New("les achats sont réservés aux 18 ans et plus")
	errNoSim    = errors.New("sim introuvable")
	errTooMany  = errors.New("trop d'achats en attente : termine ou attends ceux en cours")
	errNotFound = errors.New("achat introuvable")
	errHave     = errors.New("tu l'as déjà")
	errGrown    = errors.New("ton perso a déjà cet âge")
	errNotSold  = errors.New("pas à cet âge : grandis d'abord d'une étape")
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
	simID, adult, tester, _, err := h.owner(ctx, r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, errNoSim.Error())
		return
	}
	v := view{Adult: adult, Packs: Packs}
	if features.Default.BlocksKey(ctx, "frais-operateur") == "" {
		v.Operators = Operators
	}
	var born, minutes int64
	if err := h.DB.QueryRow(ctx, `SELECT pass_until, prestige, born_at, game_minutes FROM sims WHERE id = $1`, simID).Scan(&v.PassUntil, &v.Prestige, &born, &minutes); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	// Growing up: only what's offered at the Sim's stage, at its price.
	stage := game.StageOf(game.AgeAt(born, minutes)).ID
	for _, it := range Items {
		if it.Grow != "" {
			if it.Price = GrowPrice(stage, it.Grow); it.Price == 0 {
				continue
			}
			it.PlayID = GrowPlayID(it.Grow, it.Price)
		}
		v.Items = append(v.Items, it)
	}
	if v.PassUntil != nil && v.PassUntil.Before(time.Now()) {
		v.PassUntil = nil
	}
	rows, err := h.DB.Query(ctx, `SELECT id, kind, item, price, djai, status, credited_at IS NOT NULL, created_at FROM purchases
		WHERE user_id = $1 AND status <> 'created' ORDER BY created_at DESC LIMIT 10`, auth.UserID(ctx))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	v.Purchases, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Purchase, error) {
		var p Purchase
		return p, row.Scan(&p.ID, &p.Kind, &p.Item, &p.Price, &p.Djai, &p.Status, &p.Credited, &p.At)
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	// Test keys: nothing is really paid, so only the team's accounts buy (else anyone would get Djai for free).
	v.Sandbox = h.Pay != nil && h.Pay.Sandbox()
	v.Open = h.Pay != nil && (!v.Sandbox || tester)
	// The Android app's way (update « paiement-google »): Google Play set up on the server and the update open.
	v.Play = h.Play != nil && features.Default.BlocksKey(ctx, PlayKey) == ""
	httpx.JSON(w, http.StatusOK, v)
}

// buy: a payment opened at GeniusPay for a pack or an item; the player is sent to its page.
func (h *Handler) buy(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Pack string `json:"pack,omitempty"`
		Item string `json:"item,omitempty"`
		// Operator: how the player pays (update « frais-operateur »): its fees on top of the price.
		Operator string `json:"operator,omitempty"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	// What's bought: a pack of Djai, or an item.
	var kind, id, label, description string
	var price, djai int
	if pack, ok := FindPack(req.Pack); ok {
		kind, id, label, price, djai = "djai", pack.ID, pack.Label, pack.Price, pack.Djai
		description = fmt.Sprintf("Babi Life · %s Djai (%s)", thousands(pack.Djai), pack.Label)
	} else if it, ok := FindItem(req.Item); ok {
		kind, id, label, price = kindOf(it), it.ID, it.Label, it.Price
		description = "Babi Life · " + it.Label
	} else {
		httpx.Error(w, http.StatusUnprocessableEntity, "article inconnu")
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
	if kind == "tenue" {
		var have bool
		if err := h.DB.QueryRow(ctx, `SELECT $2 = ANY(clothes) FROM sims WHERE id = $1`, simID, id).Scan(&have); err == nil && have {
			httpx.Error(w, http.StatusUnprocessableEntity, errHave.Error())
			return
		}
	}
	if kind == "grandir" {
		if features.Default.BlocksKey(ctx, "grandir-vite") != "" {
			httpx.Error(w, http.StatusServiceUnavailable, errShut.Error())
			return
		}
		// Only to grow: a baby to a child, a minor to an adult.
		it, _ := FindItem(id)
		var born, minutes int64
		if err := h.DB.QueryRow(ctx, `SELECT born_at, game_minutes FROM sims WHERE id = $1`, simID).Scan(&born, &minutes); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		if game.AgeAt(born, minutes) >= game.StageByID(it.Grow).From {
			httpx.Error(w, http.StatusUnprocessableEntity, errGrown.Error())
			return
		}
		if price = GrowPrice(game.StageOf(game.AgeAt(born, minutes)).ID, it.Grow); price == 0 {
			httpx.Error(w, http.StatusUnprocessableEntity, errNotSold.Error())
			return
		}
	}
	if kind == "prestige" {
		var have bool
		if err := h.DB.QueryRow(ctx, `SELECT prestige FROM sims WHERE id = $1`, simID).Scan(&have); err == nil && have {
			httpx.Error(w, http.StatusUnprocessableEntity, errHave.Error())
			return
		}
	}
	user := auth.UserID(ctx)
	var waiting int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM purchases WHERE user_id = $1 AND credited_at IS NULL AND status IN ('created', 'pending', 'processing') AND created_at > now() - interval '15 minutes'`, user).Scan(&waiting)
	if waiting >= 5 {
		httpx.Error(w, http.StatusTooManyRequests, errTooMany.Error())
		return
	}
	var pid string
	if err := h.DB.QueryRow(ctx, `INSERT INTO purchases (user_id, sim_id, kind, item, pack, price, djai, sandbox) VALUES ($1, $2, $3, $4, $4, $5, $6, $7) RETURNING id`,
		user, simID, kind, id, price, djai, h.Pay.Sandbox()).Scan(&pid); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	back := h.Site + "/jeu?achat=" + pid
	// The operator's fees, paid by the player on top (the purchase keeps the price: paid more, it's credited all the same).
	total, method := price, ""
	if op, ok := FindOperator(req.Operator); ok && features.Default.BlocksKey(ctx, "frais-operateur") == "" {
		total, method = price+op.Fee(price), op.ID
		description += fmt.Sprintf(" + %s F de frais %s", thousands(op.Fee(price)), op.Label)
	}
	np := NewPayment{
		Amount: total, Currency: "XOF", Description: description, PaymentMethod: method,
		SuccessURL: back, ErrorURL: back + "&echec=1",
		Metadata: map[string]string{"purchase": pid, "sim": simID, "item": id},
	}
	if customer.Name != "" || customer.Email != "" {
		np.Customer = &customer
	}
	url, err := h.open(ctx, pid, np)
	if err != nil {
		log.Printf("shop: payment not created for %s (%s): %v", pid, label, err)
		// In the admin's activity log too: the team sees why without the server's logs.
		_, _ = h.DB.Exec(ctx, `INSERT INTO admin_log (action, detail) VALUES ('GeniusPay a refusé un paiement', $1)`, fmt.Sprintf("%s (%d F) : %.300s", label, total, err.Error()))
		httpx.Error(w, http.StatusBadGateway, "GeniusPay ne répond pas : réessaie dans un instant")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"id": pid, "url": url})
}

// open creates the payment at GeniusPay for a purchase and records its reference; the page to pay on.
func (h *Handler) open(ctx context.Context, id string, np NewPayment) (string, error) {
	if h.API != "" {
		np.WebhookURL = h.API + "/api/v1/shop/geniuspay"
	}
	pay, err := h.Pay.Create(ctx, np)
	// An operator GeniusPay doesn't take that way: its page, where the player chooses (the sum stays, fees included).
	if err != nil && np.PaymentMethod != "" {
		log.Printf("shop: payment method %s refused (%v): without it", np.PaymentMethod, err)
		np.PaymentMethod = ""
		pay, err = h.Pay.Create(ctx, np)
	}
	if err != nil || pay.URL() == "" {
		_, _ = h.DB.Exec(ctx, `UPDATE purchases SET status = 'error', updated_at = now() WHERE id = $1`, id)
		if err == nil {
			err = errors.New("no page to pay on")
		}
		return "", err
	}
	if _, err := h.DB.Exec(ctx, `UPDATE purchases SET reference = $2, status = 'pending', updated_at = now() WHERE id = $1`, id, pay.Reference); err != nil {
		return "", err
	}
	return pay.URL(), nil
}

// check: back from GeniusPay's page (or waiting on it): the purchase as GeniusPay says it now.
func (h *Handler) check(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := h.settled(ctx, h.DB.QueryRow(ctx, `SELECT id, kind, item, price, djai, status, credited_at IS NOT NULL, created_at, reference FROM purchases WHERE id = $1 AND user_id = $2 AND sim_id = $3`,
		chi.URLParam(r, "purchase"), auth.UserID(ctx), chi.URLParam(r, "id")))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, errNotFound.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

// settled reads one purchase (the Purchase columns, then its reference) and, still waiting on
// GeniusPay, asks it now.
func (h *Handler) settled(ctx context.Context, row pgx.Row) (Purchase, error) {
	var p Purchase
	var ref *string
	if err := row.Scan(&p.ID, &p.Kind, &p.Item, &p.Price, &p.Djai, &p.Status, &p.Credited, &p.At, &ref); err != nil {
		return Purchase{}, err
	}
	if !p.Credited && ref != nil && h.Pay != nil && open(p.Status) {
		var err error
		if p.Status, p.Credited, err = h.settle(ctx, p.ID, *ref); err != nil {
			log.Printf("shop: check %s: %v", p.ID, err)
		}
	}
	return p, nil
}

// open: GeniusPay hasn't said its last word yet; or the purchase was held « à vérifier » (asked again:
// paid as sold, it's given then).
func open(status string) bool {
	return status == "pending" || status == "processing" || status == "mismatch"
}

// Paid: GeniusPay's words for a payment received.
func paid(status string) bool {
	switch status {
	case "completed", "complete", "success", "successful", "succeeded", "paid", "approved", "validated":
		return true
	}
	return false
}

// settle asks GeniusPay how the payment stands and, paid the right sum, gives what was bought (once).
func (h *Handler) settle(ctx context.Context, id, reference string) (status string, credited bool, err error) {
	pay, err := h.Pay.Get(ctx, reference)
	if err != nil {
		return "pending", false, err
	}
	return h.settleWith(ctx, id, pay)
}

// settleWith: the purchase as this word from GeniusPay on its payment says (asked of it, or its signed webhook).
func (h *Handler) settleWith(ctx context.Context, id string, pay Payment) (status string, credited bool, err error) {
	status = strings.ToLower(pay.Status)
	log.Printf("shop: purchase %s: GeniusPay says %q (%v %s)", id, status, float64(pay.Amount), pay.Currency)
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

// credit gives a purchase GeniusPay says is paid what it bought, once it paid the sum sold.
func (h *Handler) credit(ctx context.Context, id string, pay Payment) (string, bool, error) {
	// Less than the sum sold (the fees can come on top of it, never off it), or a test payment while the shop sells for real: nothing given (looked at by hand).
	// (No sum in GeniusPay's word: the payment it made for us, at our price.)
	return h.creditIf(ctx, id, func(price int) bool {
		if pay.Amount > 0 && int(math.Round(float64(pay.Amount))) < price || pay.Currency != "" && !strings.EqualFold(pay.Currency, "XOF") || !h.Pay.Sandbox() && strings.EqualFold(pay.Environment, "sandbox") {
			log.Printf("shop: purchase %s paid %v %s (%s, our keys sandbox: %v), sold %d XOF: not credited", id, float64(pay.Amount), pay.Currency, pay.Environment, h.Pay.Sandbox(), price)
			return false
		}
		return true
	})
}

// creditIf gives a paid purchase what it bought, with a line in the Sim's journal; done once (credited_at).
// sold (nil: always) says whether what was paid matches what was sold; false: held « mismatch », nothing given.
func (h *Handler) creditIf(ctx context.Context, id string, sold func(price int) bool) (string, bool, error) {
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return "pending", false, err
	}
	defer tx.Rollback(ctx)
	var simID, user *string
	var kind, item string
	var price, djai int
	var already bool
	if err := tx.QueryRow(ctx, `SELECT sim_id, user_id, kind, item, price, djai, credited_at IS NOT NULL FROM purchases WHERE id = $1 FOR UPDATE`, id).Scan(&simID, &user, &kind, &item, &price, &djai, &already); err != nil {
		return "pending", false, err
	}
	if already {
		return "completed", true, nil
	}
	if sold != nil && !sold(price) {
		_, err := tx.Exec(ctx, `UPDATE purchases SET status = 'mismatch', updated_at = now() WHERE id = $1`, id)
		if err == nil {
			err = tx.Commit(ctx)
		}
		return "mismatch", false, err
	}
	if kind == "pub" {
		// The advertiser's campaign: paid, it runs on its days (ads.Shows).
		if _, err := tx.Exec(ctx, `UPDATE ad_campaigns SET paid = true WHERE id::text = $1`, item); err != nil {
			return "pending", false, err
		}
	} else {
		// Its Sim gone since: the account's (the oldest one, the one the game plays).
		if simID == nil && user != nil {
			var s string
			if err := tx.QueryRow(ctx, `SELECT id FROM sims WHERE user_id = $1 ORDER BY created_at LIMIT 1`, *user).Scan(&s); err != nil {
				return "pending", false, err
			}
			simID = &s
		}
		if simID == nil {
			return "pending", false, errors.New("no sim to credit")
		}
		if err := give(ctx, tx, *simID, kind, item, djai); err != nil {
			return "pending", false, err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE purchases SET status = 'completed', credited_at = now(), sim_id = COALESCE($2, sim_id), updated_at = now() WHERE id = $1`, id, simID); err != nil {
		return "pending", false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return "pending", false, err
	}
	if simID != nil && h.Changed != nil {
		h.Changed(*simID)
	}
	return "completed", true, nil
}

// give: what a purchase brings its Sim, and the journal's line about it.
func give(ctx context.Context, tx pgx.Tx, simID, kind, item string, djai int) error {
	var minutes int64
	var text string
	money := 0
	switch kind {
	case "djai":
		pack, _ := FindPack(item)
		if err := tx.QueryRow(ctx, `UPDATE sims SET money = money + $2 WHERE id = $1 RETURNING game_minutes`, simID, djai).Scan(&minutes); err != nil {
			return err
		}
		text, money = fmt.Sprintf("Boutique : %s Djai (%s), merci !", thousands(djai), pack.Label), djai
	case "pass":
		// From now, or from the end of the Pass still running.
		var until time.Time
		if err := tx.QueryRow(ctx, `UPDATE sims SET pass_until = GREATEST(COALESCE(pass_until, now()), now()) + make_interval(days => $2) WHERE id = $1 RETURNING game_minutes, pass_until`, simID, PassDays).Scan(&minutes, &until); err != nil {
			return err
		}
		text = fmt.Sprintf("Boutique : Babi Pass jusqu'au %s. Un quart de Djai en plus sur ce que tu gagnes, et l'étoile à ton nom.", until.UTC().Format("02/01/2006"))
	case "energie":
		full := game.Needs{Hunger: 100, Energy: 100, Hygiene: 100, Social: 100, Fun: 100}
		if err := tx.QueryRow(ctx, `UPDATE sims SET needs = $2 WHERE id = $1 RETURNING game_minutes`, simID, full).Scan(&minutes); err != nil {
			return err
		}
		text = "Boutique : plein d'énergie, toutes les jauges à fond !"
	case "prestige":
		if err := tx.QueryRow(ctx, `UPDATE sims SET prestige = true WHERE id = $1 RETURNING game_minutes`, simID).Scan(&minutes); err != nil {
			return err
		}
		text = "Boutique : Pack Prestige. La couronne est à toi (Profil, Mon look)."
	case "grandir":
		// Grown up on the Sim's next turn (sims: grow_to), its birthdays said then.
		it, _ := FindItem(item)
		if err := tx.QueryRow(ctx, `UPDATE sims SET grow_to = $2 WHERE id = $1 RETURNING game_minutes`, simID, it.Grow).Scan(&minutes); err != nil {
			return err
		}
		text = fmt.Sprintf("Boutique : %s, merci !", strings.ToLower(it.Label))
	case "tenue":
		it, _ := FindItem(item)
		if err := tx.QueryRow(ctx, `UPDATE sims SET clothes = CASE WHEN $2 = ANY(clothes) THEN clothes ELSE array_append(clothes, $2) END WHERE id = $1 RETURNING game_minutes`, simID, it.Piece).Scan(&minutes); err != nil {
			return err
		}
		text = fmt.Sprintf("Boutique : %s, dans ta garde-robe (Mon look, Garde-robe).", it.Label)
	default:
		return fmt.Errorf("unknown purchase kind %q", kind)
	}
	_, err := tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) VALUES ($1, 'transfer', $2, $3, $4)`, simID, text, money, minutes)
	return err
}

// refund: paid back by GeniusPay: what it brought taken back (the Djai that are left, the Pass, the crown; a pub stops).
func (h *Handler) refund(ctx context.Context, id string) error {
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var simID *string
	var kind, item string
	var djai int
	var credited bool
	if err := tx.QueryRow(ctx, `SELECT sim_id, kind, item, djai, credited_at IS NOT NULL FROM purchases WHERE id = $1 AND status <> 'refunded' FOR UPDATE`, id).Scan(&simID, &kind, &item, &djai, &credited); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	if credited {
		switch {
		case kind == "pub":
			_, err = tx.Exec(ctx, `UPDATE ad_campaigns SET paid = false WHERE id::text = $1`, item)
		case simID == nil:
		case kind == "djai":
			var minutes int64
			if err = tx.QueryRow(ctx, `UPDATE sims SET money = money - LEAST(GREATEST(money, 0), $2) WHERE id = $1 RETURNING game_minutes`, *simID, djai).Scan(&minutes); err == nil {
				_, err = tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) VALUES ($1, 'transfer', 'Boutique : achat remboursé, ses Djai repris.', $2, $3)`, *simID, -djai, minutes)
			}
		case kind == "pass":
			_, err = tx.Exec(ctx, `UPDATE sims SET pass_until = NULL WHERE id = $1`, *simID)
		case kind == "tenue":
			it, _ := FindItem(item)
			_, err = tx.Exec(ctx, `UPDATE sims SET clothes = array_remove(clothes, $2) WHERE id = $1`, *simID, it.Piece)
		case kind == "prestige":
			// The crown taken off, with the pack.
			_, err = tx.Exec(ctx, `UPDATE sims SET prestige = false, look = jsonb_set(look, '{accessory}', to_jsonb(nullif(trim(both ',' from replace(replace(coalesce(look->>'accessory', 'none'), 'couronne', ''), ',,', ',')), '')), true) WHERE id = $1`, *simID)
		}
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
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

/* ---------- The advertisers' pubs ---------- */

// payCampaign: the campaign's price (set by the team once approved), paid by its advertiser on GeniusPay's page.
func (h *Handler) payCampaign(w http.ResponseWriter, r *http.Request) {
	if h.Pay == nil {
		httpx.Error(w, http.StatusServiceUnavailable, errShut.Error())
		return
	}
	token := chi.URLParam(r, "token")
	if len(token) < 20 {
		httpx.Error(w, http.StatusNotFound, "campagne introuvable")
		return
	}
	ctx := r.Context()
	var id, advertiser, contact, title, status string
	var price int
	var isPaid bool
	if err := h.DB.QueryRow(ctx, `SELECT id::text, advertiser, contact, title, status, price, paid FROM ad_campaigns WHERE token = $1`, token).Scan(&id, &advertiser, &contact, &title, &status, &price, &isPaid); err != nil {
		httpx.Error(w, http.StatusNotFound, "campagne introuvable")
		return
	}
	switch {
	case isPaid:
		httpx.Error(w, http.StatusUnprocessableEntity, "cette pub est déjà payée")
		return
	case status != "approved":
		httpx.Error(w, http.StatusUnprocessableEntity, "la pub doit d'abord être acceptée")
		return
	case price < 200:
		httpx.Error(w, http.StatusUnprocessableEntity, "le prix n'est pas encore fixé : on te l'envoie")
		return
	}
	var waiting int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM purchases WHERE kind = 'pub' AND item = $1 AND credited_at IS NULL AND status IN ('created', 'pending', 'processing') AND created_at > now() - interval '15 minutes'`, id).Scan(&waiting)
	if waiting >= 3 {
		httpx.Error(w, http.StatusTooManyRequests, errTooMany.Error())
		return
	}
	var pid string
	if err := h.DB.QueryRow(ctx, `INSERT INTO purchases (kind, item, pack, price, djai, sandbox) VALUES ('pub', $1, 'pub', $2, 0, $3) RETURNING id`, id, price, h.Pay.Sandbox()).Scan(&pid); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	back := h.Site + "/pub/suivi/" + token + "?achat=" + pid
	np := NewPayment{
		Amount: price, Currency: "XOF", Description: "Babi Pub · " + title,
		Customer:   &Customer{Name: advertiser, Email: emailOf(contact)},
		SuccessURL: back, ErrorURL: back + "&echec=1",
		Metadata: map[string]string{"purchase": pid, "campaign": id},
	}
	url, err := h.open(ctx, pid, np)
	if err != nil {
		log.Printf("shop: pub payment not created for %s: %v", id, err)
		httpx.Error(w, http.StatusBadGateway, "GeniusPay ne répond pas : réessaie dans un instant")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"id": pid, "url": url})
}

// checkCampaign: back from GeniusPay's page: the campaign's payment as GeniusPay says it now.
func (h *Handler) checkCampaign(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := h.settled(ctx, h.DB.QueryRow(ctx, `SELECT p.id, p.kind, p.item, p.price, p.djai, p.status, p.credited_at IS NOT NULL, p.created_at, p.reference
		FROM purchases p JOIN ad_campaigns c ON c.id::text = p.item WHERE p.id = $1 AND p.kind = 'pub' AND c.token = $2`, chi.URLParam(r, "purchase"), chi.URLParam(r, "token")))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, errNotFound.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

// emailOf: the contact if it's an e-mail (a phone number isn't given to GeniusPay as one).
func emailOf(contact string) string {
	if strings.Contains(contact, "@") {
		return contact
	}
	return ""
}

/* ---------- GeniusPay's word ---------- */

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
		Event string          `json:"event"`
		Data  json.RawMessage `json:"data"`
	}
	_ = json.Unmarshal(body, &hook)
	said, perr := paymentIn(hook.Data)
	if perr != nil {
		log.Printf("shop: webhook %q without a payment: %.300s", hook.Event, body)
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ignored"})
		return
	}
	log.Printf("shop: webhook %q for %s: %q", hook.Event, said.Reference, said.Status)
	// The event says the status when the payment's own field doesn't (« payment.completed »).
	if said.Status == "" {
		if _, st, ok := strings.Cut(hook.Event, "."); ok {
			said.Status = st
		}
	}
	hook.Data = nil
	ctx := r.Context()
	var id string
	var credited bool
	err = h.DB.QueryRow(ctx, `SELECT id, credited_at IS NOT NULL FROM purchases WHERE reference = $1`, said.Reference).Scan(&id, &credited)
	if err != nil {
		// Not one of ours (another site on the same account, a test): nothing to do.
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "unknown"})
		return
	}
	if credited && !strings.Contains(hook.Event, "refund") {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "completed"})
		return
	}
	status, _, err := h.settle(ctx, id, said.Reference)
	// GeniusPay not answering about its own payment (its sandbox doesn't always): a webhook
	// checked with the secret is believed as it is.
	if err != nil && h.Pay.WebhookSecret != "" {
		log.Printf("shop: webhook %s: asking GeniusPay failed (%v): its signed word taken", id, err)
		status, _, err = h.settleWith(ctx, id, said)
	}
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
		rows, err := h.DB.Query(ctx, `SELECT id, reference FROM purchases WHERE credited_at IS NULL AND status IN ('pending', 'processing', 'mismatch')
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
		// (Not Google Play's: a cash payment there can wait days; WatchPlay asks Google.)
		_, _ = h.DB.Exec(ctx, `UPDATE purchases SET status = 'expired', updated_at = now() WHERE credited_at IS NULL AND status IN ('created', 'pending', 'processing') AND play_token IS NULL AND created_at < now() - interval '25 hours'`)
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
