package sims

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
)

// Inviting one's friends (the update « parrainage »): each account has its
// link (auth/referral.go keeps whose link a new account came by). Once the
// friend has really joined, its Sim played a little while (FriendPlayed, seen
// as it saves: mutateWith), the friend's link-giver gets a wrapped gift in the
// drawer at home (web world3d/HomeInside.tsx, components/GiftDrawer.tsx), and
// the line in its journal and a push. Opened, the gift is drawn among what it
// can go into: a piece for the wardrobe, food for the fridge, a decoration
// put in the house, Djai (its own limit, game.FromParrainage), now and then
// something rare. Anti-abuse: a tester's account (or one whose Sim used the
// toolbox) never counts, one gift per friend ever, GiftsADay a day at most.

// ParrainageKey: the update it comes with.
const ParrainageKey = "parrainage"

const (
	// FriendPlayed: the game minutes (real minutes played) the friend's Sim has lived for the gift to come.
	FriendPlayed = 30
	// GiftsADay: the most gifts an account gets a day (Abidjan's, from midnight); the others wait for the next day.
	GiftsADay = 5
)

// The gift's kinds.
const (
	GiftHabit = "habit"
	GiftFrigo = "frigo"
	GiftDeco  = "deco"
	GiftDjai  = "djai"
)

var errGiftWaits = errors.New("ce cadeau attend encore un peu : rien de nouveau ne rentre chez toi aujourd'hui, réessaie demain")

// referralSeen: the accounts settled for good (no link, gift given, a tester's), not asked again.
// referralLater: the ones to ask again only after then (the day's gifts all given, the update closed).
var (
	referralSeen  sync.Map
	referralLater sync.Map
)

// referralGrant: a gift given, for its notification.
type referralGrant struct {
	Referrer string
	Friend   string
	// Sim: one of the referrer's Sims (for the push), "" if it has none yet.
	Sim string
}

// friendPlayed: whether the friend's Sim has played long enough for its link-giver's gift.
func friendPlayed(s *Sim) bool { return s.BornAt != 0 && s.GameMinutes-s.BornAt >= FriendPlayed }

// dayStart: midnight in Abidjan (UTC), the day the gifts are counted by.
func dayStart(now time.Time) time.Time { return now.UTC().Truncate(24 * time.Hour) }

// creditReferral: the friend (an account) has played; its link-giver gets its
// gift, once ever, if the day's gifts aren't all given. It reports the gift
// given (nil: none), and until when not to ask again (zero: never again).
func creditReferral(ctx context.Context, db *pgxpool.Pool, friend string, now time.Time) (*referralGrant, time.Time, error) {
	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, now.Add(time.Minute), err
	}
	defer tx.Rollback(ctx)
	var referrer *string
	var name string
	var tester, given bool
	if err := tx.QueryRow(ctx, `SELECT u.referred_by, CASE WHEN u.first_name <> '' THEN u.first_name ELSE u.name END,
			u.tester OR EXISTS(SELECT 1 FROM sims t WHERE t.user_id = u.id AND t.tested),
			EXISTS(SELECT 1 FROM referral_gifts g WHERE g.friend_id = u.id)
		FROM users u WHERE u.id = $1`, friend).Scan(&referrer, &name, &tester, &given); err != nil {
		return nil, now.Add(time.Minute), err
	}
	if referrer == nil || tester || given {
		return nil, time.Time{}, nil
	}
	// The referrer's row locked: two friends at once can't both pass the day's limit.
	if _, err := tx.Exec(ctx, `SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, *referrer); err != nil {
		return nil, now.Add(time.Minute), err
	}
	var n int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM referral_gifts WHERE user_id = $1 AND created_at >= $2`, *referrer, dayStart(now)).Scan(&n); err != nil {
		return nil, now.Add(time.Minute), err
	}
	if n >= GiftsADay {
		return nil, dayStart(now).Add(24 * time.Hour), nil
	}
	var id int64
	err = tx.QueryRow(ctx, `INSERT INTO referral_gifts (user_id, friend_id, friend_name, created_at) VALUES ($1, $2, $3, $4)
		ON CONFLICT (friend_id) DO NOTHING RETURNING id`, *referrer, friend, name, now).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, time.Time{}, nil
	}
	if err != nil {
		return nil, now.Add(time.Minute), err
	}
	text := fmt.Sprintf("Ton ami·e %s a rejoint Babi Life avec ton lien : un cadeau t'attend dans ton tiroir !", name)
	if _, err := tx.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) SELECT id, 'social', $2, 0, game_minutes FROM sims WHERE user_id = $1`, *referrer, text); err != nil {
		return nil, now.Add(time.Minute), err
	}
	g := &referralGrant{Referrer: *referrer, Friend: name}
	_ = tx.QueryRow(ctx, `SELECT id FROM sims WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, *referrer).Scan(&g.Sim)
	if err := tx.Commit(ctx); err != nil {
		return nil, now.Add(time.Minute), err
	}
	return g, time.Time{}, nil
}

// referralCheck: after a Sim saved, whether its account brings a gift to the one whose link it came by.
func (h *Handler) referralCheck(ctx context.Context, user string, s *Sim) {
	if !friendPlayed(s) {
		return
	}
	if _, done := referralSeen.Load(user); done {
		return
	}
	now := time.Now()
	if v, ok := referralLater.Load(user); ok && now.Before(v.(time.Time)) {
		return
	}
	// Closed: asked again later, the gift comes once it opens.
	if features.Default.BlocksKey(ctx, ParrainageKey) != "" {
		referralLater.Store(user, now.Add(time.Minute))
		return
	}
	g, later, err := creditReferral(ctx, h.DB, user, now)
	if err == nil && later.IsZero() {
		referralSeen.Store(user, true)
		referralLater.Delete(user)
	} else {
		referralLater.Store(user, later)
	}
	if g != nil && g.Sim != "" {
		h.Push.ToSim(g.Sim, push.Message{Title: "Babi Life · Cadeau", Body: fmt.Sprintf("Ton ami·e %s a rejoint Babi Life avec ton lien : un cadeau t'attend dans ton tiroir !", g.Friend), URL: "/jeu?app=inviter", Tag: "parrainage"})
	}
}

// Gift: a gift of a friend, wrapped or opened.
type Gift struct {
	ID     int64     `json:"id"`
	From   string    `json:"from"`
	At     time.Time `json:"at"`
	Opened bool      `json:"opened"`
	Kind   string    `json:"kind,omitempty"`
	Item   string    `json:"item,omitempty"`
	Label  string    `json:"label,omitempty"`
	Amount int       `json:"amount,omitempty"`
	Rare   bool      `json:"rare,omitempty"`
}

// Referred: a friend come by the link.
type Referred struct {
	Name   string    `json:"name"`
	At     time.Time `json:"at"`
	Gifted bool      `json:"gifted"`
}

// parrainage: GET /sims/{id}/parrainage, the link's code, the friends come by it, the gifts.
func (h *Handler) parrainage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if features.Default.BlocksKey(ctx, ParrainageKey) != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	user := auth.UserID(ctx)
	var mine bool
	if err := h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sims WHERE id = $1 AND user_id = $2)`, chi.URLParam(r, "id"), user).Scan(&mine); err != nil || !mine {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	code, err := auth.RefCode(ctx, h.DB, user)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load the code")
		return
	}
	friends, gifts, err := referralView(ctx, h.DB, user)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load the gifts")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"code": code, "friends": friends, "gifts": gifts, "perDay": GiftsADay, "played": FriendPlayed})
}

func referralView(ctx context.Context, db queryer, user string) ([]Referred, []Gift, error) {
	friends := []Referred{}
	rows, err := db.Query(ctx, `SELECT CASE WHEN u.first_name <> '' THEN u.first_name ELSE u.name END, u.created_at, EXISTS(SELECT 1 FROM referral_gifts g WHERE g.friend_id = u.id)
		FROM users u WHERE u.referred_by = $1 ORDER BY u.created_at DESC LIMIT 100`, user)
	if err != nil {
		return nil, nil, err
	}
	for rows.Next() {
		var f Referred
		if err := rows.Scan(&f.Name, &f.At, &f.Gifted); err != nil {
			rows.Close()
			return nil, nil, err
		}
		friends = append(friends, f)
	}
	rows.Close()
	gifts := []Gift{}
	// The wrapped ones, then the last ones opened.
	rows, err = db.Query(ctx, `SELECT id, friend_name, created_at, opened_at IS NOT NULL, kind, item, label, amount, rare FROM referral_gifts
		WHERE user_id = $1 AND (opened_at IS NULL OR id IN (SELECT id FROM referral_gifts WHERE user_id = $1 AND opened_at IS NOT NULL ORDER BY opened_at DESC LIMIT 20))
		ORDER BY opened_at IS NOT NULL, coalesce(opened_at, created_at) DESC`, user)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var g Gift
		if err := rows.Scan(&g.ID, &g.From, &g.At, &g.Opened, &g.Kind, &g.Item, &g.Label, &g.Amount, &g.Rare); err != nil {
			return nil, nil, err
		}
		gifts = append(gifts, g)
	}
	return friends, gifts, rows.Err()
}

// giftRoom: where a gift may go, for the Sim opening it: what the wardrobe
// has, the fridge (nil: none to fill), the house it lives in (nil: none of its own).
type giftRoom struct {
	owned  []string
	fridge map[string]int
	room   int
	house  *game.House
	// decoOpen: the update « deco-premium » open (its pieces may be given).
	decoOpen bool
}

// Gift pools: the decorations, and the rare ones.
var (
	giftDecos     = []string{"plante", "tapis", "lampadaire", "bibliotheque", "transat"}
	giftRareDecos = []string{"aquarium", "toile", "sculpture", "piano"}
	giftDjai      = []int{500, 750, 1000, 1500}
)

// RareGift: one gift in this many is a rare one, when there's one to give.
const RareGift = 20

// unwrap: what's in the gift, drawn among what can go where it belongs, and
// put there (the wardrobe, the fridge, the house: in room; the Djai: on the Sim).
func (s *Sim) unwrap(rng *rand.Rand, c *giftRoom) (Gift, error) {
	pieces := func(rare bool) []game.ClothingPiece {
		var out []game.ClothingPiece
		for _, p := range game.Clothes {
			if p.Shop == "premium" || (p.Shop == "exclu") != rare || (p.Gender != "" && p.Gender != s.Gender) || slices.Contains(c.owned, p.ID) {
				continue
			}
			out = append(out, p)
		}
		return out
	}
	decos := func(ids []string) []game.Furniture {
		var out []game.Furniture
		if c.house == nil {
			return nil
		}
		for _, id := range ids {
			if f, ok := game.FindFurniture(id); ok && (f.Key == "" || c.decoOpen) {
				out = append(out, f)
			}
		}
		return out
	}
	habit := func(p game.ClothingPiece, rare bool) Gift {
		c.owned = append(c.owned, p.ID)
		return Gift{Kind: GiftHabit, Item: p.ID, Label: fmt.Sprintf("%s, %s", p.Label, p.Brand), Rare: rare}
	}
	// A decoration: in the house, where there's room for it (none: not this one).
	deco := func(fs []game.Furniture, rare bool) (Gift, bool) {
		rng.Shuffle(len(fs), func(i, j int) { fs[i], fs[j] = fs[j], fs[i] })
		for _, f := range fs {
			if h, ok := placeGift(*c.house, f); ok {
				*c.house = h
				return Gift{Kind: GiftDeco, Item: f.ID, Label: f.Label, Rare: rare}, true
			}
		}
		return Gift{}, false
	}
	left := s.left(game.FromParrainage)

	// Now and then, something rare: a fine piece for the house, else from the exclusive collection, else a fat envelope.
	if rng.IntN(RareGift) == 0 {
		if g, ok := deco(decos(giftRareDecos), true); ok {
			return g, nil
		}
		if ps := pieces(true); len(ps) > 0 {
			return habit(ps[rng.IntN(len(ps))], true), nil
		}
		if left >= 5000 {
			got := s.earn(game.FromParrainage, 5000)
			return Gift{Kind: GiftDjai, Label: fmt.Sprintf("Une enveloppe de %s Djai", money(got)), Amount: got, Rare: true}, nil
		}
	}
	// Otherwise, by their weights, among those that can go somewhere.
	type option struct {
		kind   string
		weight int
	}
	var opts []option
	if len(pieces(false)) > 0 {
		opts = append(opts, option{GiftHabit, 35})
	}
	if c.fridge != nil && game.FridgeCount(c.fridge) < c.room {
		opts = append(opts, option{GiftFrigo, 20})
	}
	if len(decos(giftDecos)) > 0 {
		opts = append(opts, option{GiftDeco, 20})
	}
	if left >= giftDjai[0] {
		opts = append(opts, option{GiftDjai, 25})
	}
	for len(opts) > 0 {
		total := 0
		for _, o := range opts {
			total += o.weight
		}
		pick, i := rng.IntN(total), 0
		for pick >= opts[i].weight {
			pick -= opts[i].weight
			i++
		}
		switch opts[i].kind {
		case GiftHabit:
			ps := pieces(false)
			return habit(ps[rng.IntN(len(ps))], false), nil
		case GiftFrigo:
			g := game.Groceries[rng.IntN(len(game.Groceries))]
			n := min(3, c.room-game.FridgeCount(c.fridge))
			c.fridge[g.ID] += n
			return Gift{Kind: GiftFrigo, Item: g.ID, Label: fmt.Sprintf("%d × %s", n, g.Label), Amount: n}, nil
		case GiftDeco:
			if g, ok := deco(decos(giftDecos), false); ok {
				return g, nil
			}
		case GiftDjai:
			amount := giftDjai[rng.IntN(len(giftDjai))]
			got := s.earn(game.FromParrainage, min(amount, left))
			return Gift{Kind: GiftDjai, Label: fmt.Sprintf("%s Djai", money(got)), Amount: got}, nil
		}
		opts = slices.Delete(opts, i, i+1)
	}
	return Gift{}, errGiftWaits
}

// placeGift: the piece put down in the house, on the ground floor, under its
// roof first, where it fits (House.Edit says), with a free cell round it to walk by.
func placeGift(h game.House, f game.Furniture) (game.House, bool) {
	roof := map[[2]int]bool{}
	solid := map[[3]int]bool{}
	for _, b := range h.Blocks {
		solid[[3]int{b.X, b.Y, b.Z}] = true
		if b.Y >= 2 {
			roof[[2]int{b.X, b.Z}] = true
		}
	}
	for _, covered := range []bool{true, false} {
		for z := h.D - 1; z >= 0; z-- {
			for x := 0; x < h.W; x++ {
				for _, r := range []int{0, 1} {
					w, d := f.W, f.D
					if r == 1 {
						w, d = d, w
					}
					if covered && !roof[[2]int{x, z}] {
						continue
					}
					// Not against everything: one side of it left free to walk by.
					if solid[[3]int{x - 1, 1, z}] && solid[[3]int{x + w, 1, z}] && solid[[3]int{x, 1, z - 1}] && solid[[3]int{x, 1, z + d}] {
						continue
					}
					out, _, _, err := h.Edit(nil, nil, []game.Piece{{X: x, Y: 0, Z: z, R: r, ID: f.ID}}, nil)
					if err == nil && out.Livable() == h.Livable() {
						return out, true
					}
				}
			}
		}
	}
	return h, false
}

// giftOpen: POST /sims/{id}/parrainage/{gift}/open, the gift unwrapped by this Sim and put where it goes.
func (h *Handler) giftOpen(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if features.Default.BlocksKey(ctx, ParrainageKey) != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "gift"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "cadeau introuvable")
		return
	}
	user := auth.UserID(ctx)
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		g, err := s.openGift(ctx, tx, user, id, newRand())
		if err != nil {
			return game.Outcome{}, nil, err
		}
		text := fmt.Sprintf("Grâce à %s : %s.", g.From, giftWhere(g))
		return game.Outcome{Text: text, Money: g.moneyIn(), Data: g}, []Event{{Kind: "social", Text: text, Money: g.moneyIn(), GameTime: s.GameMinutes}}, nil
	})
}

// moneyIn: the Djai the gift brought.
func (g Gift) moneyIn() int {
	if g.Kind == GiftDjai {
		return g.Amount
	}
	return 0
}

// giftWhere: what it was, and where it went.
func giftWhere(g Gift) string {
	switch g.Kind {
	case GiftHabit:
		return g.Label + ", rangé dans ta garde-robe"
	case GiftFrigo:
		return g.Label + ", au frais dans ton frigo"
	case GiftDeco:
		return g.Label + ", installé dans ta maison"
	}
	return g.Label + " dans ton porte-monnaie"
}

// openGift: the account's gift `id`, still wrapped, opened by the Sim (in tx, the Sim's row locked).
func (s *Sim) openGift(ctx context.Context, tx pgx.Tx, user string, id int64, rng *rand.Rand) (Gift, error) {
	g := Gift{ID: id}
	if err := tx.QueryRow(ctx, `SELECT friend_name, created_at FROM referral_gifts WHERE id = $1 AND user_id = $2 AND opened_at IS NULL FOR UPDATE`, id, user).Scan(&g.From, &g.At); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return g, errors.New("ce cadeau est déjà ouvert")
		}
		return g, err
	}
	c := giftRoom{decoOpen: features.Default.BlocksKey(ctx, game.DecoKey) == ""}
	if err := tx.QueryRow(ctx, `SELECT clothes FROM sims WHERE id = $1`, s.ID).Scan(&c.owned); err != nil {
		return g, err
	}
	had := len(c.owned)
	// The fridge: in one's own house, while the update « frigo » is open.
	if room := game.FridgeRoom(s.Furnished); s.Housing == game.OwnHouse && room > 0 && features.Default.BlocksKey(ctx, game.FridgeKey) == "" {
		stock, err := readFridge(ctx, tx, s.ID)
		if err != nil {
			return g, err
		}
		c.fridge, c.room = stock, room
	}
	// The house one lives in, its masons gone.
	var plot Plot
	if s.Housing == game.OwnHouse && !s.minor() {
		p, err := loadPlot(ctx, tx, s.ID, 0, true)
		if err != nil {
			return g, err
		}
		if on, _ := p.building(time.Now()); p.Home && p.Lot != nil && !on {
			plot = p
			house := p.house()
			c.house = &house
		}
	}
	got, err := s.unwrap(rng, &c)
	if err != nil {
		return g, err
	}
	got.ID, got.From, got.At, got.Opened = g.ID, g.From, g.At, true
	switch got.Kind {
	case GiftHabit:
		if _, err := tx.Exec(ctx, `UPDATE sims SET clothes = clothes || $2::text[] WHERE id = $1`, s.ID, c.owned[had:]); err != nil {
			return g, err
		}
	case GiftFrigo:
		if err := writeFridge(ctx, tx, s.ID, c.fridge); err != nil {
			return g, err
		}
	case GiftDeco:
		plot.Blocks, plot.Furniture = c.house.Blocks, c.house.Furniture
		if err := savePlot(ctx, tx, &plot); err != nil {
			return g, err
		}
		s.Furnished = c.house.Has()
	}
	if _, err := tx.Exec(ctx, `UPDATE referral_gifts SET opened_at = now(), sim_id = $2, kind = $3, item = $4, label = $5, amount = $6, rare = $7 WHERE id = $1`,
		id, s.ID, got.Kind, got.Item, got.Label, got.Amount, got.Rare); err != nil {
		return g, err
	}
	return got, nil
}
