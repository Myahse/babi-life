package sims

import (
	"context"
	"encoding/json"
	"math/rand/v2"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
)

func TestRefCodes(t *testing.T) {
	seen := map[string]bool{}
	for range 2000 {
		c := auth.NewRefCode()
		if len(c) != auth.RefCodeLen || auth.CleanRefCode(c) != c || strings.ContainsAny(c, "0o1li") {
			t.Fatalf("a code to read out and type: %q", c)
		}
		seen[c] = true
	}
	if len(seen) < 1990 {
		t.Errorf("codes drawn again and again: %d different of 2000", len(seen))
	}
	if auth.CleanRefCode(" AbC234 ") != "abc234" || auth.CleanRefCode("x'; drop") != "" || auth.CleanRefCode("ab") != "" {
		t.Error("a code from a link: cleaned, or nothing")
	}
}

// A gift goes where it belongs: the piece to the wardrobe, the food to the fridge, the decoration into the house, the Djai on the Sim.
func TestUnwrapPutsItWhereItGoes(t *testing.T) {
	house := game.House{W: 8, D: 8}
	kinds := map[string]int{}
	for i := range 400 {
		s := &Sim{Gender: "femme", GameMinutes: 1000}
		c := giftRoom{fridge: map[string]int{}, room: 12, house: &house, decoOpen: true}
		h := house
		c.house = &h
		g, err := s.unwrap(rand.New(rand.NewPCG(uint64(i), 9)), &c)
		if err != nil {
			t.Fatal(err)
		}
		kinds[g.Kind]++
		switch g.Kind {
		case GiftHabit:
			p, ok := game.FindPiece(g.Item)
			if !ok || !slices.Contains(c.owned, g.Item) || p.Shop == "premium" || (p.Gender != "" && p.Gender != "femme") || (p.Shop == "exclu") != g.Rare {
				t.Fatalf("a piece in the wardrobe: %+v %v", g, c.owned)
			}
		case GiftFrigo:
			if c.fridge[g.Item] != g.Amount || g.Amount < 1 {
				t.Fatalf("food in the fridge: %+v %v", g, c.fridge)
			}
		case GiftDeco:
			if len(c.house.Furniture) != 1 || c.house.Furniture[0].ID != g.Item || len(house.Furniture) != 0 {
				t.Fatalf("a decoration in the house: %+v %v", g, c.house.Furniture)
			}
		case GiftDjai:
			if g.Amount <= 0 || s.Money != g.Amount {
				t.Fatalf("Djai on the Sim: %+v, money %d", g, s.Money)
			}
		default:
			t.Fatalf("a gift of nothing: %+v", g)
		}
	}
	for _, k := range []string{GiftHabit, GiftFrigo, GiftDeco, GiftDjai} {
		if kinds[k] == 0 {
			t.Errorf("never a gift of %s: %v", k, kinds)
		}
	}
}

// No house, no fridge (a child at its parents', a hotel): clothes or Djai; the Djai on their own limit.
func TestUnwrapWithoutAHouse(t *testing.T) {
	s := &Sim{Gender: "homme", GameMinutes: 1000}
	djai := 0
	for i := range 200 {
		c := giftRoom{}
		g, err := s.unwrap(rand.New(rand.NewPCG(uint64(i), 3)), &c)
		if err != nil {
			t.Fatal(err)
		}
		if g.Kind != GiftHabit && g.Kind != GiftDjai {
			t.Fatalf("without a house: %+v", g)
		}
		djai += g.moneyIn()
	}
	if max := game.Caps[game.FromParrainage].Djai; djai > max || s.Money != djai {
		t.Errorf("the gifts' Djai in a day: %d (limit %d), money %d", djai, max, s.Money)
	}
	// The wardrobe full and the day's Djai given: the gift waits.
	var all []string
	for _, p := range game.Clothes {
		all = append(all, p.ID)
	}
	if _, err := s.unwrap(rand.New(rand.NewPCG(1, 1)), &giftRoom{owned: all}); err != errGiftWaits {
		t.Errorf("nothing left to give: %v", err)
	}
}

// parrainageDB: a fresh database (TEST_DATABASE_URL), as the reply tests.
func parrainageDB(t *testing.T) *pgxpool.Pool { return replyDB(t) }

// devSignUp: an account signed up (or in) by the dev login, with a link's code; its id.
func devSignUp(t *testing.T, pool *pgxpool.Pool, name, code string) string {
	t.Helper()
	h := &auth.Handler{DB: pool, Tokens: auth.NewTokens("test"), DevLogin: true}
	req := httptest.NewRequest(http.MethodPost, "/auth/dev?p="+code, strings.NewReader(`{"name":"`+name+`"}`))
	rec := httptest.NewRecorder()
	h.Dev(rec, req)
	var out struct {
		User struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &out) != nil || out.User.ID == "" {
		t.Fatalf("dev sign-up %s: %d %s", name, rec.Code, rec.Body)
	}
	return out.User.ID
}

func referrerOf(t *testing.T, pool *pgxpool.Pool, user string) string {
	var r *string
	if err := pool.QueryRow(context.Background(), `SELECT referred_by FROM users WHERE id = $1`, user).Scan(&r); err != nil {
		t.Fatal(err)
	}
	if r == nil {
		return ""
	}
	return *r
}

func TestReferralAtSignUp(t *testing.T) {
	pool := parrainageDB(t)
	ctx := context.Background()
	awa := devSignUp(t, pool, "Awa Kone", "")
	code, err := auth.RefCode(ctx, pool, awa)
	if err != nil || len(code) != auth.RefCodeLen {
		t.Fatalf("Awa's code: %q %v", code, err)
	}
	if again, _ := auth.RefCode(ctx, pool, awa); again != code {
		t.Errorf("the code changed: %q then %q", code, again)
	}
	koffi := devSignUp(t, pool, "Koffi Yao", strings.ToUpper(code))
	if other, _ := auth.RefCode(ctx, pool, koffi); other == code {
		t.Error("two accounts, one code")
	}
	if referrerOf(t, pool, koffi) != awa {
		t.Error("Koffi signed up with Awa's link: not recorded")
	}
	// Signed in again with another link: still Awa's.
	yao := devSignUp(t, pool, "Yao Brou", "")
	ycode, _ := auth.RefCode(ctx, pool, yao)
	if devSignUp(t, pool, "Koffi Yao", ycode) != koffi || referrerOf(t, pool, koffi) != awa {
		t.Error("a sign-in changed whose link Koffi came by")
	}
	// An account that already existed doesn't become someone's friend, nor does one by its own link.
	if devSignUp(t, pool, "Yao Brou", code); referrerOf(t, pool, yao) != "" {
		t.Error("an existing account recorded a link")
	}
	if err := auth.RecordReferral(ctx, pool, awa, code); err != nil || referrerOf(t, pool, awa) != "" {
		t.Error("one's own link")
	}
	// A bad code: nothing, and the sign-up goes on.
	if devSignUp(t, pool, "Ama Diallo", "zzzzzz"); referrerOf(t, pool, awa) != "" {
		t.Error("a code of nobody")
	}
}

func TestReferralGift(t *testing.T) {
	pool := parrainageDB(t)
	ctx := context.Background()
	awa := devSignUp(t, pool, "Awa Kone", "")
	code, _ := auth.RefCode(ctx, pool, awa)
	h := &Handler{DB: pool}
	friends := make([]string, GiftsADay+2)
	for i := range friends {
		friends[i] = devSignUp(t, pool, "Ami"+string(rune('a'+i))+" Test", code)
	}
	gifts := func() int {
		var n int
		_ = pool.QueryRow(ctx, `SELECT count(*) FROM referral_gifts WHERE user_id = $1`, awa).Scan(&n)
		return n
	}
	now := game.MinuteOf(time.Now())
	// Not played enough: nothing.
	h.referralCheck(ctx, friends[0], &Sim{BornAt: now, GameMinutes: now + FriendPlayed - 1})
	if gifts() != 0 {
		t.Fatal("a gift before the friend played")
	}
	played := &Sim{BornAt: now, GameMinutes: now + FriendPlayed}
	h.referralCheck(ctx, friends[0], played)
	h.referralCheck(ctx, friends[0], played)
	if g, later, err := creditReferral(ctx, pool, friends[0], time.Now()); g != nil || !later.IsZero() || err != nil || gifts() != 1 {
		t.Fatalf("one gift per friend: %d (%+v %v)", gifts(), g, err)
	}
	// A tester's account doesn't count.
	_, _ = pool.Exec(ctx, `UPDATE users SET tester = true WHERE id = $1`, friends[1])
	if g, _, _ := creditReferral(ctx, pool, friends[1], time.Now()); g != nil {
		t.Error("a tester brought a gift")
	}
	// The day's limit: the others wait for tomorrow, then come.
	for _, f := range friends[2:] {
		_, _, _ = creditReferral(ctx, pool, f, time.Now())
	}
	if gifts() != GiftsADay {
		t.Fatalf("gifts in a day: %d, at most %d", gifts(), GiftsADay)
	}
	last := friends[len(friends)-1]
	if g, later, _ := creditReferral(ctx, pool, last, time.Now()); g != nil || !later.After(time.Now()) {
		t.Error("over the day's limit: to wait")
	}
	if g, _, err := creditReferral(ctx, pool, last, time.Now().Add(24*time.Hour)); g == nil || err != nil || g.Friend != "Ami"+string(rune('a'+len(friends)-1)) {
		t.Errorf("the next day: %+v %v", g, err)
	}
	// The line in Awa's journal (once she has a Sim it's written to it: none yet here), and her friends listed.
	fr, gs, err := referralView(ctx, pool, awa)
	if err != nil || len(fr) != len(friends) || len(gs) != GiftsADay+1 || gs[0].Opened {
		t.Fatalf("the view: %d friends, %d gifts, %v", len(fr), len(gs), err)
	}
}

func TestOpenGift(t *testing.T) {
	pool := parrainageDB(t)
	ctx := context.Background()
	sim := replySim(t, pool, "Awa")
	var user string
	_ = pool.QueryRow(ctx, `SELECT user_id FROM sims WHERE id = $1`, sim).Scan(&user)
	open := func() Gift {
		var id int64
		if err := pool.QueryRow(ctx, `INSERT INTO referral_gifts (user_id, friend_name) VALUES ($1, 'Koffi') RETURNING id`, user).Scan(&id); err != nil {
			t.Fatal(err)
		}
		tx, _ := pool.Begin(ctx)
		defer tx.Rollback(ctx)
		s := &Sim{ID: sim, Gender: "femme", GameMinutes: game.MinuteOf(time.Now())}
		g, err := s.openGift(ctx, tx, user, id, rand.New(rand.NewPCG(uint64(id), 1)))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := s.openGift(ctx, tx, user, id, newRand()); err == nil {
			t.Error("a gift opened twice")
		}
		if g.Kind == GiftDjai {
			_, _ = tx.Exec(ctx, `UPDATE sims SET money = money + $2 WHERE id = $1`, sim, s.Money)
		}
		_ = tx.Commit(ctx)
		return g
	}
	for range 12 {
		g := open()
		if g.From != "Koffi" || !g.Opened {
			t.Fatalf("opened: %+v", g)
		}
		var clothes []string
		var opened bool
		_ = pool.QueryRow(ctx, `SELECT clothes FROM sims WHERE id = $1`, sim).Scan(&clothes)
		_ = pool.QueryRow(ctx, `SELECT opened_at IS NOT NULL AND kind = $2 FROM referral_gifts WHERE id = $1`, g.ID, g.Kind).Scan(&opened)
		if !opened {
			t.Errorf("the gift not marked opened: %+v", g)
		}
		if g.Kind == GiftHabit && !slices.Contains(clothes, g.Item) {
			t.Errorf("the piece not in the wardrobe: %+v %v", g, clothes)
		}
		// No house of her own: no decoration, no fridge.
		if g.Kind == GiftDeco || g.Kind == GiftFrigo {
			t.Errorf("without a house: %+v", g)
		}
	}
}
