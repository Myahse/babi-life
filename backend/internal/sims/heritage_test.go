package sims

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"net/http"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

func heirSim() *Sim {
	s := famSim()
	s.lifeOn, s.heritageOn = false, true
	s.Life.Famille = nil
	s.famSync(rand.New(rand.NewPCG(1, 1)))
	return s
}

// The family's ages go by in hours played; a pause (hold) holds them: the Sim's, the children's, the
// baby on its way, the elders'.
func TestHeritageHoldAndAge(t *testing.T) {
	s := heirSim()
	f := s.Life.Famille
	if f.Clock != heirClock || f.Years != 18 {
		t.Fatalf("a new adult: %+v", f)
	}
	sp := game.HeirSpans
	f.Kids = []Kid{{ID: "k1", Name: "Ama", Gender: "femme", Born: s.GameMinutes - 60}}
	f.Elders = []Elder{{ID: "e1", Name: "Papa", Kin: "papa", AdultAt: s.GameMinutes - sp.LivedFor(65)}}
	f.Expecting = &Expecting{Since: s.GameMinutes, Due: s.GameMinutes + 60}
	adult, due := f.AdultAt, f.Expecting.Due
	kid, elder := f.Kids[0].Born, f.Elders[0].AdultAt
	s.hold(180)
	if f.AdultAt != adult+180 || f.Kids[0].Born != kid+180 || f.Elders[0].AdultAt != elder+180 || f.Expecting.Due != due+180 {
		t.Fatalf("held: %+v", f)
	}
	s.famSync(rand.New(rand.NewPCG(1, 2)))
	if f.Years != 18 || f.Kids[0].Stage != game.StageEnfant || f.Expecting == nil {
		t.Fatalf("nothing grew while away: %+v", f)
	}
	// Played: 30 at 10 h, a birthday; the elders never pass.
	s.GameMinutes += sp.LivedFor(30)
	s.famSync(rand.New(rand.NewPCG(1, 3)))
	if f.Years != 30 || f.Party == nil || len(f.Elders) != 1 {
		t.Fatalf("30 after 10 h played: %+v", f)
	}
	s.GameMinutes += sp.LifeEnd() * 2
	s.famSync(rand.New(rand.NewPCG(1, 4)))
	if len(f.Elders) != 1 || len(f.Memorials) != 0 || f.Last {
		t.Fatalf("no death with « heritage »: %+v", f)
	}
	// Closed, the clocks aren't touched.
	s.heritageOn = false
	at := f.AdultAt
	s.hold(60)
	if f.AdultAt != at {
		t.Fatal("closed: no hold of the family")
	}
}

// The passation's refusals that need no database, and the heirs offered.
func TestHeritageBlocksAndHeirs(t *testing.T) {
	s := heirSim()
	f := s.Life.Famille
	fx := heritageFacts{generation: 1, since: time.Now().Add(-30 * 24 * time.Hour)}
	if err := s.passationBlock(fx, time.Now()); err != errHeirAge {
		t.Fatalf("18: %v", err)
	}
	f.Years = 60
	if err := s.passationBlock(fx, time.Now()); err != nil {
		t.Fatalf("60: %v", err)
	}
	s.Activity = &game.Activity{Kind: "do"}
	if err := s.passationBlock(fx, time.Now()); err != game.ErrBusy {
		t.Errorf("busy: %v", err)
	}
	s.Activity, s.Prison = nil, &Prison{}
	if err := s.passationBlock(fx, time.Now()); err != errInPrison {
		t.Errorf("prison: %v", err)
	}
	s.Prison = nil
	if err := s.passationBlock(heritageFacts{generation: 1, since: time.Now()}, time.Now()); err != errHeirFloor {
		t.Errorf("floor: %v", err)
	}
	// 50 with three jalons.
	f.Years = 52
	s.Housing = game.OwnHouse
	s.Money = 3 * s.familyStart()
	if err := s.passationBlock(fx, time.Now()); err != errHeirAge {
		t.Errorf("52, two jalons: %v", err)
	}
	f.Kids = []Kid{{ID: "k1", Name: "Ama", Gender: "femme", Born: s.GameMinutes - game.HeirSpans.Childhood() - 5}, {ID: "k2", Name: "Yao", Gender: "homme", Born: s.GameMinutes - 10, Adopted: true}}
	if err := s.passationBlock(fx, time.Now()); err != nil {
		t.Errorf("52, three jalons: %v", err)
	}
	hs := s.heirOptions(1)
	if len(hs) != 1 || hs[0].ID != "k1" || hs[0].Share != game.HeirShare {
		t.Errorf("one child of 18: %+v", hs)
	}
	f.Kids = f.Kids[1:]
	hs = s.heirOptions(1)
	if len(hs) != 1 || hs[0].Kind != game.HeirNeveu || hs[0].Share != game.NeveuShare || hs[0] != s.heirOptions(1)[0] {
		t.Errorf("no child of 18: the nephew, the same each time: %+v", hs)
	}
}

// The blessing: from the pot only, once a real week, within the day's limit.
func TestHeritageBlessing(t *testing.T) {
	s := heirSim()
	f := s.Life.Famille
	f.Elders = []Elder{{ID: "e1", Name: "Papa Koffi", Kin: "papa", Pot: 7000, Gen: 1}}
	now := time.Now()
	money := s.Money
	if _, _, err := s.elderAct("e1", "benediction", now, newRand()); err != nil {
		t.Fatal(err)
	}
	if s.Money != money+game.BlessingMax || f.Elders[0].Pot != 2000 {
		t.Fatalf("blessed: %d pot %d", s.Money-money, f.Elders[0].Pot)
	}
	if _, _, err := s.elderAct("e1", "benediction", now.Add(time.Hour), newRand()); err != errBlessed {
		t.Fatalf("again: %v", err)
	}
	s.purse = nil
	if _, _, err := s.elderAct("e1", "benediction", now.Add(8*24*time.Hour), newRand()); err != nil || f.Elders[0].Pot != 0 || s.Money != money+7000 {
		t.Fatalf("a week on, the rest of the pot: %v %d", err, s.Money-money)
	}
	f.Elders[0].Blessed = 0
	if _, _, err := s.elderAct("e1", "benediction", now.Add(16*24*time.Hour), newRand()); err != errPotEmpty {
		t.Fatalf("pot empty: %v", err)
	}
	f.Elders[0].Village = true
	if _, _, err := s.elderAct("e1", "visite", now, newRand()); err != errVillage {
		t.Fatalf("village: %v", err)
	}
	// The parent at home is the mentor from the second generation.
	if m, ok := s.elderMentor(2); ok || m.Name == "Papa Koffi" {
		t.Fatal("gone to the village: the family's mentor")
	}
	f.Elders[0].Village = false
	if m, ok := s.elderMentor(2); !ok || m.Name != "Papa Koffi" {
		t.Fatalf("mentor: %+v", m)
	}
}

// An adoption: the child arrives an hour played on, five or so, adopted.
func TestHeritageAdopt(t *testing.T) {
	s := heirSim()
	if txt := s.heritageStart(game.Interaction{ID: game.AdoptID}); txt == "" || s.Life.Famille.Expecting == nil || !s.Life.Famille.Expecting.Adopt {
		t.Fatalf("dossier: %q", txt)
	}
	s.GameMinutes += 61
	s.famSync(newRand())
	f := s.Life.Famille
	if len(f.Kids) != 1 || !f.Kids[0].Adopted || f.Kids[0].Stage != game.StageEnfant {
		t.Fatalf("adopted: %+v", f.Kids)
	}
}

// Against a database (TEST_DATABASE_URL): shut, nothing changes; open, a veteran aged from its time
// played, a pause that doesn't age it, the refusals, the passation conserving the money (duties, the
// heir's share, the elder's pot), the papers ended, a double POST done once, the blessing, the ranking.
func TestHeritageDB(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	old := features.Default
	features.Default = &features.Store{DB: pool}
	t.Cleanup(func() { features.Default = old })
	open := func(k string, on bool) {
		t.Helper()
		if err := features.Default.Set(ctx, k, on, nil); err != nil {
			t.Fatal(err)
		}
	}
	id := replySim(t, pool, "Awa")
	if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = game_minutes - $2, money = 1000000, loan = 100000, family = 'lagnon', last_tick = now() WHERE id = $1`, id, game.MinutesToAge(30)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE users SET play_seconds = 36000 FROM sims WHERE sims.user_id = users.id AND sims.id = $1`, id); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO documents (sim_id, kind, ref, number, data) VALUES ($1, $2, '', 'BL-1', '{}'), ($1, $3, '', 'BL-2', '{}')`, id, game.DocBAC, game.DocExtrait); err != nil {
		t.Fatal(err)
	}
	type state struct {
		money, loan, gen, renom int
		first                   string
		fam                     *Famille
	}
	read := func() state {
		t.Helper()
		var st state
		var life []byte
		if err := pool.QueryRow(ctx, `SELECT money, loan, generation, renom, first_name, coalesce(life->'famille', 'null') FROM sims WHERE id = $1`, id).Scan(&st.money, &st.loan, &st.gen, &st.renom, &st.first, &life); err != nil {
			t.Fatal(err)
		}
		_ = json.Unmarshal(life, &st.fam)
		return st
	}
	body := func(gen int, heir string) string {
		return fmt.Sprintf(`{"heir":%q,"look":{},"gen":%d}`, heir, gen)
	}
	pass := "/sims/" + id + "/heritage/passation"

	// Shut: refused, nothing set.
	if code, _ := quartierCall(t, pool, id, http.MethodGet, "/sims/"+id+"/heritage", ""); code != http.StatusForbidden {
		t.Fatalf("shut GET: %d", code)
	}
	if code, _ := quartierCall(t, pool, id, http.MethodPost, pass, body(1, "neveu")); code != http.StatusUnprocessableEntity {
		t.Fatalf("shut POST: %d", code)
	}
	if st := read(); st.fam != nil || st.money != 1000000 || st.gen != 1 {
		t.Fatalf("shut, something changed: %+v %+v", st, st.fam)
	}

	open(game.HeritageKey, true)
	code, h := quartierCall(t, pool, id, http.MethodGet, "/sims/"+id+"/heritage", "")
	if code != 200 {
		t.Fatalf("GET: %d %v", code, h)
	}
	// The GET doesn't save: a first action makes the turn (10 h played: 33 years old).
	if code, out := quartierCall(t, pool, id, http.MethodPost, "/sims/"+id+"/heritage/ancien/x/vu", "{}"); code != 200 {
		t.Fatalf("vu: %d %v", code, out)
	}
	st := read()
	if st.fam == nil || st.fam.Clock != heirClock || st.fam.Years != 33 {
		t.Fatalf("veteran: %+v", st.fam)
	}
	// A pause of three minutes (the Sim as it was when put away, three minutes ago): it isn't older.
	adult := st.fam.AdultAt - 3
	if _, err := pool.Exec(ctx, `UPDATE sims SET paused_at = now() - interval '3 minutes', last_tick = now() - interval '3 minutes', game_minutes = game_minutes - 3,
		life = jsonb_set(life, '{famille,adultAt}', to_jsonb((life->'famille'->>'adultAt')::bigint - 3)) WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}
	quartierCall(t, pool, id, http.MethodPost, "/sims/"+id+"/heritage/ancien/x/vu", "{}")
	if st = read(); st.fam.AdultAt < adult || st.fam.Years != 33 {
		t.Fatalf("paused: adultAt %d → %d, %d years", adult, st.fam.AdultAt, st.fam.Years)
	}
	if lived := st.fam.AdultAt - adult; lived < 2 || lived > 4 {
		t.Errorf("held about 3 minutes: %d", lived)
	}

	// Refusals: the floor, the age, an office, a stake.
	if code, out := quartierCall(t, pool, id, http.MethodPost, pass, body(1, "neveu")); code != 422 || out["error"] != errHeirFloor.Error() {
		t.Fatalf("floor: %d %v", code, out)
	}
	if _, err := pool.Exec(ctx, `UPDATE sims SET generation_since = now() - interval '22 days' WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}
	if code, out := quartierCall(t, pool, id, http.MethodPost, pass, body(1, "neveu")); code != 422 || out["error"] != errHeirAge.Error() {
		t.Fatalf("33: %d %v", code, out)
	}
	if _, err := pool.Exec(ctx, `UPDATE sims SET life = jsonb_set(life, '{famille,adultAt}', to_jsonb(game_minutes - $2::bigint)) WHERE id = $1`, id, game.HeirSpans.LivedFor(61)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO offices (office, sim_id, until) VALUES ('maire:cocody', $1, now() + interval '7 days')`, id); err != nil {
		t.Fatal(err)
	}
	if code, out := quartierCall(t, pool, id, http.MethodPost, pass, body(1, "neveu")); code != 422 || out["error"] != errHeirOffice.Error() {
		t.Fatalf("office: %d %v", code, out)
	}
	_, _ = pool.Exec(ctx, `DELETE FROM offices WHERE sim_id = $1`, id)
	if _, err := pool.Exec(ctx, `INSERT INTO pvp_stakes (match, sim, amount) VALUES ('m1', $1, 500)`, id); err != nil {
		t.Fatal(err)
	}
	if code, out := quartierCall(t, pool, id, http.MethodPost, pass, body(1, "neveu")); code != 422 || out["error"] != errHeirStake.Error() {
		t.Fatalf("stake: %d %v", code, out)
	}
	_, _ = pool.Exec(ctx, `DELETE FROM pvp_stakes WHERE sim = $1`, id)
	if code, _ := quartierCall(t, pool, id, http.MethodPost, pass, body(2, "neveu")); code != 422 {
		t.Fatalf("a generation ahead: %d", code)
	}

	// The passation, to the nephew (no child): 900 000 of estate, 65 000 of duties, 60 % to the heir.
	if code, out := quartierCall(t, pool, id, http.MethodPost, pass, body(1, "neveu")); code != 200 {
		t.Fatalf("passation: %d %v", code, out)
	}
	st = read()
	heir, pot, fee := game.Split(900_000, game.NeveuShare)
	if st.money != heir || st.loan != 0 || st.gen != 2 || st.renom <= 0 || st.first == "Awa" {
		t.Fatalf("after: %+v", st)
	}
	var elderPot int
	for _, e := range st.fam.Elders {
		elderPot += e.Pot
	}
	if elderPot != pot || st.fam.Passation == nil || st.fam.Passation.Fee != fee {
		t.Fatalf("the elder's pot %d, want %d: %+v", elderPot, pot, st.fam.Passation)
	}
	var rows int
	var estate, gotFee, inherited, gotPot int
	if err := pool.QueryRow(ctx, `SELECT count(*), max(estate), max(fee), max(inherited), max(elder_pot) FROM family_generations WHERE sim_id = $1`, id).Scan(&rows, &estate, &gotFee, &inherited, &gotPot); err != nil {
		t.Fatal(err)
	}
	if rows != 1 || estate != 900_000 || inherited+gotPot+gotFee != estate {
		t.Fatalf("money conserved: %d rows, %d = %d + %d + %d", rows, estate, inherited, gotPot, gotFee)
	}
	var bacEnded, extraitEnded bool
	_ = pool.QueryRow(ctx, `SELECT ended FROM documents WHERE sim_id = $1 AND kind = $2`, id, game.DocBAC).Scan(&bacEnded)
	_ = pool.QueryRow(ctx, `SELECT ended FROM documents WHERE sim_id = $1 AND kind = $2`, id, game.DocExtrait).Scan(&extraitEnded)
	if !bacEnded || extraitEnded {
		t.Errorf("papers: bac ended %v, extrait ended %v", bacEnded, extraitEnded)
	}
	// Sent again: done once.
	if code, _ := quartierCall(t, pool, id, http.MethodPost, pass, body(1, "neveu")); code != 200 {
		t.Fatalf("again: %d", code)
	}
	if again := read(); again.money != st.money || again.gen != 2 || again.first != st.first {
		t.Fatalf("done twice: %+v", again)
	}
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM family_generations WHERE sim_id = $1`, id).Scan(&rows)
	if rows != 1 {
		t.Fatalf("history rows: %d", rows)
	}

	// The blessing, from the pot.
	elder := st.fam.Elders[0].ID
	if code, out := quartierCall(t, pool, id, http.MethodPost, "/sims/"+id+"/heritage/ancien/"+elder+"/benediction", "{}"); code != 200 {
		t.Fatalf("blessing: %d %v", code, out)
	}
	if after := read(); after.money != st.money+game.BlessingMax || after.fam.Elders[0].Pot != pot-game.BlessingMax {
		t.Fatalf("blessed: %d, pot %d", after.money-st.money, after.fam.Elders[0].Pot)
	}

	// The ranking: there, then left out once a tester's.
	code, rk := quartierCall(t, pool, id, http.MethodGet, "/sims/"+id+"/heritage/classement", "")
	if top, _ := rk["top"].([]any); code != 200 || len(top) != 1 {
		t.Fatalf("ranking: %d %v", code, rk)
	}
	_, _ = pool.Exec(ctx, `UPDATE sims SET tested = true WHERE id = $1`, id)
	if _, rk = quartierCall(t, pool, id, http.MethodGet, "/sims/"+id+"/heritage/classement", ""); len(rk["top"].([]any)) != 0 {
		t.Fatalf("tester listed: %v", rk)
	}
}
