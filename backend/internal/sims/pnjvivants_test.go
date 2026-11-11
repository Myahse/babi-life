package sims

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
)

// The PNJ in the grin: an answer comes after a little while, at most once per message, never past the
// hour's limit; a quiet room gets a line now and then, by day; their coupons are real Bet225 rounds; their
// soirées come one night in two and can be found by id; their lives are the same every time.
func TestPnjVivants(t *testing.T) {
	ctx := context.Background()
	if p, c, n, ok := pnjOf("ia-port-bouet-3"); !ok || c != "port-bouet" || n != 3 || p.name != pnjCast[3].name {
		t.Fatalf("pnjOf: %v %q %d", ok, c, n)
	}
	if _, _, _, ok := pnjOf("ia-cocody-99"); ok {
		t.Fatal("a PNJ out of the cast")
	}
	for body, kind := range map[string]string{"Bonsoir tout le monde": "salut", "Qui a vu le match ?": "foot", "un garba svp": "maquis", "t'es un bot ?": "pnj", "[defi:the:80]": "carte", "mdr": "rire"} {
		if got := pnjTopic(body).kind; got != kind {
			t.Errorf("%q: %q, want %q", body, got, kind)
		}
	}
	if !pnjTopic("Comment on gagne des Djai").question {
		t.Error("a question without « ? »")
	}

	// A day hour (game time is Abidjan's, UTC).
	now := time.Date(2026, 11, 11, 15, 0, 0, 0, time.UTC)
	answers, tooSoon := 0, 0
	for i := range 200 {
		id := int64(1000 + i)
		msg := []grinRow{{id: id, sim: "s1", name: "Awa", body: "Salut le grin !", at: now.Add(-70 * time.Second)}}
		if l := pnjGrinLine(ctx, "cocody", msg, 0, now); l != nil {
			answers++
			if l.replyTo == nil || *l.replyTo != id || l.key != fmt.Sprintf("ans:%d", id) || !strings.HasPrefix(l.who.ID, PnjPrefix+"cocody-") || l.body == "" {
				t.Fatalf("answer: %+v", l)
			}
		}
		msg[0].at = now.Add(-5 * time.Second)
		if pnjGrinLine(ctx, "cocody", msg, 0, now) != nil {
			tooSoon++
		}
		// The hour's limit reached: nothing.
		msg[0].at = now.Add(-70 * time.Second)
		if pnjGrinLine(ctx, "cocody", msg, PnjGrinPerHourCommune, now) != nil {
			t.Fatal("past the hour's limit")
		}
		// Answered already (a PNJ line after it): nothing more.
		done := append([]grinRow{{id: id + 1, pnj: "ia-cocody-1", body: "👋🏾", at: now.Add(-10 * time.Second), replyTo: &id}}, msg...)
		if l := pnjGrinLine(ctx, "cocody", done, 1, now); l != nil && l.replyTo != nil {
			t.Fatal("answered twice")
		}
	}
	if tooSoon > 0 || answers < 80 || answers > 160 {
		t.Fatalf("greetings answered %d/200 (too soon: %d)", answers, tooSoon)
	}
	// A quiet room: a line in some slots of the day, none at night.
	lines := 0
	for h := range 48 {
		at := time.Date(2026, 11, 11, 7, 0, 0, 0, time.UTC).Add(time.Duration(h) * PnjIdleSlot)
		if game.HourOf(game.MinuteOf(at)) >= 23 {
			break
		}
		if l := pnjGrinLine(ctx, "babi", nil, 0, at); l != nil {
			lines++
			if !l.who.Npc || l.body == "" || l.replyTo != nil {
				t.Fatalf("idle: %+v", l)
			}
		}
	}
	if lines == 0 || pnjGrinLine(ctx, "babi", nil, 0, time.Date(2026, 11, 11, 3, 0, 0, 0, time.UTC)) != nil {
		t.Fatalf("quiet room: %d lines by day, or one at night", lines)
	}

	// A coupon: the round's matches, the same each time, settled once played.
	ref := TicketRef("pnj", pnjCouponRef(game.RoundAt(now.Unix())+1, 2))
	parts := strings.Split(strings.Trim(ref, "[]"), ":")
	id, ok := ticketID(parts[1], parts[2], parts[3])
	if !ok {
		t.Fatalf("coupon ref %q", ref)
	}
	b, owner, ok := pnjBet(id, now.Unix())
	if !ok || len(b.Legs) < 2 || b.Status != "open" || b.Odds <= 1 || owner != pnjCast[2].name+" (PNJ)" {
		t.Fatalf("coupon: %+v %q", b, owner)
	}
	if later, _, _ := pnjBet(id, now.Add(2*time.Hour).Unix()); later.Status == "open" {
		t.Fatalf("not settled: %+v", later)
	}

	// The soirées: one night in two in a commune, found again by id while they last.
	nights := 0
	for d := range 20 {
		day := game.DayOf(game.MinuteOf(now)) + int64(d)
		p, ok := pnjPartyOn("abidjan", "yopougon", day)
		if !ok {
			continue
		}
		nights++
		at := p.Starts.Add(time.Hour)
		if q, ok := pnjPartyByID(p.ID, at); !ok || q.Host != p.Host || q.Guests < 3 || !strings.HasSuffix(q.HostName, "(PNJ)") {
			t.Fatalf("party by id: %+v", q)
		}
		if _, ok := pnjPartyByID(p.ID, p.Ends.Add(time.Minute)); ok {
			t.Fatal("a soirée after its end")
		}
	}
	if nights < 4 || nights > 16 {
		t.Fatalf("%d soirées in 20 nights", nights)
	}

	// A life: the same every time, a home in the commune.
	l := pnjLife("ia-yopougon-4")
	if l == nil || l.Home == "" || fmt.Sprint(l) != fmt.Sprint(pnjLife("ia-yopougon-4")) {
		t.Fatalf("life: %+v", l)
	}
}

// In the database: a PNJ's line is written once, and the room's read shows it as a PNJ's.
func TestPnjGrinRead(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	awa := replySim(t, pool, "Awa")
	var user string
	if err := pool.QueryRow(ctx, `SELECT user_id FROM sims WHERE id = $1`, awa).Scan(&user); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE sims SET apps = '{gbairai}', born_at = $2 WHERE id = $1`, awa, game.MinuteOf(time.Now())-game.MinutesToAge(25)); err != nil {
		t.Fatal(err)
	}
	h := &Handler{DB: pool}
	// A day slot where a quiet room gets a line.
	var at time.Time
	for k := range 200 {
		c := time.Date(2026, 11, 11, 9, 0, 0, 0, time.UTC).Add(time.Duration(k) * PnjIdleSlot)
		if pnjGrinLine(ctx, "babi", nil, 0, c) != nil {
			at = c
			break
		}
	}
	if at.IsZero() {
		t.Fatal("no slot")
	}
	h.pnjGrin(ctx, "babi", at)
	pnjGrinLooked.Delete("babi")
	h.pnjGrin(ctx, "babi", at) // another server, the same slot: not twice
	var n int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM grin WHERE pnj IS NOT NULL`).Scan(&n)
	if n != 1 {
		t.Fatalf("%d PNJ lines", n)
	}
	r := httptest.NewRequest(http.MethodGet, "/sims/"+awa+"/grin?room=babi", nil)
	rc := chi.NewRouteContext()
	rc.URLParams.Add("id", awa)
	r = r.WithContext(context.WithValue(auth.WithUserID(r.Context(), user), chi.RouteCtxKey, rc))
	w := httptest.NewRecorder()
	h.grin(w, r)
	var out struct {
		Messages []GrinMessage `json:"messages"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil || len(out.Messages) == 0 {
		t.Fatalf("read: %d %s", w.Code, w.Body.String())
	}
	m := out.Messages[0]
	if !m.Npc || m.Gone || !strings.HasPrefix(m.Sim, PnjPrefix) || m.FirstName == "" || m.Commune == "" {
		t.Fatalf("PNJ line: %+v", m)
	}
}
