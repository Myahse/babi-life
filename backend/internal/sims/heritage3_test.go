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
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
)

// The crest's parts from the lists, the devise trimmed, 40 characters at most, moderated like the chat.
func TestHeritageCrestCheck(t *testing.T) {
	ok := game.Crest{Shape: "bouclier", Colors: [2]string{"#f77f00", "#009e60"}, Emblem: "elephant", Devise: "  L'union   fait la force "}
	c, err := ok.Check()
	if err != nil || c.Devise != "L'union fait la force" {
		t.Fatalf("ok: %v %q", err, c.Devise)
	}
	for _, bad := range []game.Crest{
		{Shape: "carre", Colors: ok.Colors, Emblem: "lion"},
		{Shape: "rond", Colors: [2]string{"#123456", "#009e60"}, Emblem: "lion"},
		{Shape: "rond", Colors: ok.Colors, Emblem: "dragon"},
		{Shape: "rond", Colors: ok.Colors, Emblem: "lion", Devise: strings.Repeat("a", game.DeviseMax+1)},
	} {
		if _, err := bad.Check(); err == nil {
			t.Errorf("accepted: %+v", bad)
		}
	}
	for d, want := range map[string]error{
		"Le travail paie":            nil,
		"Travail, Famille, Baobab":   nil,
		"va sur www.arnaque.com":     errDeviseLinks,
		"appelle 07 07 07 07 07":     errDeviseLinks,
		"Babilife officiel":          errDeviseWords,
		"famille de p.u.t.e":         nil, // (letters apart: not a word; the reports are there for the rest)
		"Les autres sont des PUT41N": errDeviseWords,
		"merde alors":                errDeviseWords,
	} {
		if _, err := moderateDevise(d); err != want {
			t.Errorf("%q: %v, want %v", d, err, want)
		}
	}
}

// An heirloom's renom grows with the times it was handed down, to a cap; its line.
func TestHeritageHeirloomRenom(t *testing.T) {
	if game.HeirloomRenom(1) != 5 || game.HeirloomRenom(3) != 15 || game.HeirloomRenom(20) != game.HeirloomRenomMax {
		t.Fatal(game.HeirloomRenom(1), game.HeirloomRenom(3), game.HeirloomRenom(20))
	}
	if game.HeirloomLine("Awa", "Lassina") != "De Awa à Lassina" {
		t.Fatal(game.HeirloomLine("Awa", "Lassina"))
	}
}

// The fête is a rendez-vous of the week: Sunday 19 h to 22 h, waiting for « heritage », and an
// interaction of the Palais de la Culture closed with the update.
func TestHeritageFeteSchedule(t *testing.T) {
	r, ok := game.FindRendezVous(game.FamillesFeteID)
	if !ok || r.Needs != game.HeritageKey {
		t.Fatalf("rendez-vous: %+v", r)
	}
	occ := game.OccurrencesBetween([]game.RendezVous{r}, time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC), time.Date(2026, 11, 23, 0, 0, 0, 0, time.UTC), nil)
	if len(occ) != 1 || occ[0].From != time.Date(2026, 11, 22, 19, 0, 0, 0, time.UTC) || occ[0].Until != time.Date(2026, 11, 22, 22, 0, 0, 0, time.UTC) {
		t.Fatalf("occurrences: %+v", occ)
	}
	found := false
	for _, it := range game.Kinds["culture"].Interactions {
		found = found || it.ID == game.FamillesFeteActID
	}
	if !found {
		t.Fatal("the Palais' fête")
	}
	in := false
	for _, id := range game.HeritageInteractions {
		in = in || id == game.FamillesFeteActID
	}
	if !in {
		t.Fatal("closed with « heritage »")
	}
}

// Against a database: shut, the crest refused and nothing written; open, a crest moderated, chosen once a
// generation; an heirloom (a vehicle and a piece of furniture) handed down at the passation, its line, its
// renom, the card; selling or taking it away refused.
func TestHeritageHeirloomCrestDB(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	open := heirOpen(t, pool)
	id := replySim(t, pool, "Awa")
	if _, err := pool.Exec(ctx, `UPDATE sims SET born_at = game_minutes - $2, money = 400000, family = 'lagnon', last_tick = now(), clothes = ARRAY[$3] WHERE id = $1`, id, game.MinutesToAge(30), game.Clothes[0].ID); err != nil {
		t.Fatal(err)
	}
	model := game.VehicleModels[0]
	var car int64
	if err := pool.QueryRow(ctx, `INSERT INTO vehicles (sim_id, model, color) VALUES ($1, $2, $3) RETURNING id`, id, model.ID, model.Colors[0]).Scan(&car); err != nil {
		t.Fatal(err)
	}
	// A lot with a house, a canapé in it.
	sofa := ""
	for _, f := range game.Furnitures {
		if f.Key == "" && f.W == 1 && f.D == 1 {
			sofa = f.ID
			break
		}
	}
	var lot int64
	if err := pool.QueryRow(ctx, `INSERT INTO plots (sim_id, lot_w, lot_d, lot_city, lot_commune, lot_lat, lot_lng, furniture) VALUES ($1, 12, 12, 'abidjan', 'cocody', 5.35, -3.98, $2) RETURNING id`, id, fmt.Sprintf(`[[2,0,2,0,%q]]`, sofa)).Scan(&lot); err != nil {
		t.Fatal(err)
	}
	crest := `{"shape":"bouclier","colors":["#f77f00","#009e60"],"emblem":"elephant","devise":"Le travail paie"}`
	blason := "/sims/" + id + "/heritage/blason"

	// Shut: the crest refused, nothing written.
	if code, _ := quartierCall(t, pool, id, http.MethodPost, blason, crest); code != 422 {
		t.Fatalf("shut crest: %d", code)
	}
	var raw []byte
	_ = pool.QueryRow(ctx, `SELECT crest FROM sims WHERE id = $1`, id).Scan(&raw)
	if raw != nil {
		t.Fatalf("shut: crest written %s", raw)
	}

	open(true)
	if code, out := quartierCall(t, pool, id, http.MethodPost, blason, strings.Replace(crest, "Le travail paie", "merde alors", 1)); code != 422 || out["error"] != errDeviseWords.Error() {
		t.Fatalf("moderated: %d %v", code, out)
	}
	if code, out := quartierCall(t, pool, id, http.MethodPost, blason, crest); code != 200 {
		t.Fatalf("crest: %d %v", code, out)
	}
	if code, out := quartierCall(t, pool, id, http.MethodPost, blason, strings.Replace(crest, "elephant", "lion", 1)); code != 422 || out["error"] != errCrestOnce.Error() {
		t.Fatalf("twice a generation: %d %v", code, out)
	}
	_ = pool.QueryRow(ctx, `SELECT crest FROM sims WHERE id = $1`, id).Scan(&raw)
	if !strings.Contains(string(raw), "elephant") {
		t.Fatalf("crest kept: %s", raw)
	}

	// The state offers the vehicle, the canapé, the wax.
	code, st := quartierCall(t, pool, id, http.MethodGet, "/sims/"+id+"/heritage", "")
	if code != 200 {
		t.Fatalf("GET: %d", code)
	}
	kinds := map[string]bool{}
	for _, c := range st["choices"].([]any) {
		kinds[c.(map[string]any)["kind"].(string)] = true
	}
	if !kinds[game.HeirloomVehicule] || !kinds[game.HeirloomMeuble] || !kinds[game.HeirloomVetement] || st["crestCan"] != false {
		t.Fatalf("choices: %v crestCan %v", st["choices"], st["crestCan"])
	}

	// 61, the generation 22 days old: handed down to the nephew with the car.
	if _, err := pool.Exec(ctx, `UPDATE sims SET generation_since = now() - interval '22 days', life = jsonb_set(life, '{famille,adultAt}', to_jsonb(game_minutes - $2::bigint)) WHERE id = $1`, id, game.HeirSpans.LivedFor(61)); err != nil {
		t.Fatal(err)
	}
	pass := func(gen int, kind, item string) (int, map[string]any) {
		return quartierCall(t, pool, id, http.MethodPost, "/sims/"+id+"/heritage/passation", fmt.Sprintf(`{"heir":"neveu","look":{},"gen":%d,"heirloom":{"kind":%q,"item":%q}}`, gen, kind, item))
	}
	if code, out := pass(1, game.HeirloomVehicule, "999999"); code != 422 || out["error"] != errHeirloomPick.Error() {
		t.Fatalf("not one's own: %d %v", code, out)
	}
	var renom0 int
	_ = pool.QueryRow(ctx, `SELECT renom FROM sims WHERE id = $1`, id).Scan(&renom0)
	if code, out := pass(1, game.HeirloomVehicule, fmt.Sprint(car)); code != 200 {
		t.Fatalf("passation: %d %v", code, out)
	}
	var gens, renom, logged int
	var lines []string
	if err := pool.QueryRow(ctx, `SELECT gens, lines FROM heirlooms WHERE sim_id = $1 AND kind = 'vehicule'`, id).Scan(&gens, &lines); err != nil {
		t.Fatal(err)
	}
	fam, _ := heirFam(t, pool, id)
	_ = pool.QueryRow(ctx, `SELECT renom FROM sims WHERE id = $1`, id).Scan(&renom)
	_ = pool.QueryRow(ctx, `SELECT coalesce(sum(pts), 0) FROM renom_log WHERE sim_id = $1`, id).Scan(&logged)
	card := fam.Passation
	if gens != 1 || len(lines) != 1 || !strings.HasPrefix(lines[0], "De Awa à ") || card == nil || card.Heirloom == nil || card.Heirloom.Renom != game.HeirloomRenom(1) || card.Crest == nil {
		t.Fatalf("heirloom: %d %v card %+v", gens, lines, card)
	}
	if renom-renom0 != card.Renom || logged != card.Renom {
		t.Fatalf("renom: +%d, card %d, logged %d", renom-renom0, card.Renom, logged)
	}
	// It can't be sold.
	if code, out := quartierCall(t, pool, id, http.MethodPost, "/sims/"+id+"/garage/sell", fmt.Sprintf(`{"vehicle":%d}`, car)); code != 422 || out["error"] != game.ErrHeirloomLocked.Error() {
		t.Fatalf("sold: %d %v", code, out)
	}
	// The garage says it's the family's (it glows where it's drawn).
	if code, g := quartierCall(t, pool, id, http.MethodGet, "/sims/"+id+"/garage", ""); code != 200 || g["vehicles"].([]any)[0].(map[string]any)["heirloom"] != true {
		t.Fatalf("garage: %d %v", code, g)
	}
	// The testers' shortcut: the elder speaks in the commune's grin at once.
	if _, err := pool.Exec(ctx, `UPDATE users SET tester = true WHERE id = (SELECT user_id FROM sims WHERE id = $1)`, id); err != nil {
		t.Fatal(err)
	}
	if code, out := quartierCall(t, pool, id, http.MethodPost, "/sims/"+id+"/tester", `{"action":"heritage-ancien"}`); code != 200 {
		t.Fatalf("heritage-ancien: %d %v", code, out)
	}
	var said int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM grin WHERE pnj = $1`, ancienPrefix+id).Scan(&said)
	if said != 1 {
		t.Fatalf("the elder in the grin: %d lines", said)
	}
	// The heir's generation may choose the crest again.
	if code, out := quartierCall(t, pool, id, http.MethodPost, blason, strings.Replace(crest, "elephant", "lion", 1)); code != 200 {
		t.Fatalf("next generation's crest: %d %v", code, out)
	}

	// The canapé, the family's too (a second heirloom, written as a passation would): never taken away from its last house, nor its lot sold.
	if _, err := pool.Exec(ctx, `INSERT INTO heirlooms (sim_id, kind, item, label, ref) VALUES ($1, 'meuble', $2, 'Canapé', $2)`, id, sofa); err != nil {
		t.Fatal(err)
	}
	if err := heirloomStays(ctx, pool, id, lot, nil); err != game.ErrHeirloomLocked {
		t.Fatalf("taken away: %v", err)
	}
	if err := heirloomStays(ctx, pool, id, lot, []game.Piece{{X: 2, Z: 2, ID: sofa}}); err != nil {
		t.Fatalf("kept: %v", err)
	}
	if code, out := quartierCall(t, pool, id, http.MethodPost, "/sims/"+id+"/lot/sell", fmt.Sprintf(`{"lot":%d}`, lot)); code != 422 || out["error"] != game.ErrHeirloomLocked.Error() {
		t.Fatalf("lot sold with it: %d %v", code, out)
	}
	// The houses show it.
	var plots []Plot
	r := quartierRaw(t, pool, id, "/sims/"+id+"/plots")
	if err := json.Unmarshal(r, &plots); err != nil {
		t.Fatal(err)
	}
	for _, p := range plots {
		if p.ID == lot && (len(p.Heirlooms) != 1 || p.Crest == nil) {
			t.Fatalf("plot: %+v %s", p.Heirlooms, p.Crest)
		}
	}
}

// Against a database: the fête only while it's on; its renom once a week; the week's podium told once in
// Babi Direct with the crests; shut, nothing.
func TestHeritageFeteDB(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	open := heirOpen(t, pool)
	h := &Handler{DB: pool}
	awa, koffi := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi")
	oldOpen := rendezOpen
	rendezOpen = func(context.Context) bool { return true }
	defer func() { rendezNow, rendezOpen = time.Now, oldOpen }()
	RendezForget()
	sunday := time.Date(2026, 11, 22, 20, 0, 0, 0, time.UTC)
	rendezNow = func() time.Time { return sunday }
	come := func(id string) string {
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		s, err := scanSim(tx.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1`, id))
		if err != nil {
			t.Fatal(err)
		}
		s.heritageOn = heritageOpen(ctx)
		if err := feteBefore(ctx, tx, &s, game.FamillesFeteActID); err != nil {
			return "refused: " + err.Error()
		}
		said := feteCome(ctx, tx, &s, game.FamillesFeteActID)
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		return said
	}
	renom := func(id string) (n int) {
		_ = pool.QueryRow(ctx, `SELECT renom FROM sims WHERE id = $1`, id).Scan(&n)
		return
	}

	// Shut: refused, nothing.
	if said := come(awa); !strings.HasPrefix(said, "refused") || renom(awa) != 0 {
		t.Fatalf("shut: %q %d", said, renom(awa))
	}
	open(true)
	// Saturday: not on.
	rendezNow = func() time.Time { return sunday.Add(-24 * time.Hour) }
	if said := come(awa); said != "refused: "+errFeteClosed.Error() {
		t.Fatalf("saturday: %q", said)
	}
	rendezNow = func() time.Time { return sunday }
	if said := come(awa); !strings.Contains(said, fmt.Sprintf("+%d", game.FeteRenom)) || renom(awa) != game.FeteRenom {
		t.Fatalf("come: %q %d", said, renom(awa))
	}
	// Twice the same week: the evening, not the renom.
	if said := come(awa); said == "" || strings.Contains(said, "+15") || renom(awa) != game.FeteRenom {
		t.Fatalf("twice: %q %d", said, renom(awa))
	}
	come(koffi)
	// Koffi's family also handed down this week (its renom logged): first.
	if _, err := pool.Exec(ctx, `INSERT INTO renom_log (sim_id, pts, why, at) VALUES ($1, 120, 'passation', $2)`, koffi, sunday.Add(-48*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE sims SET crest = '{"shape":"rond","colors":["#1c5d99","#ffffff"],"emblem":"pirogue","devise":""}' WHERE id = $1`, koffi); err != nil {
		t.Fatal(err)
	}
	// (The renom_log rows are dated now by the database: the week ending at the fête's end.)
	if _, err := pool.Exec(ctx, `UPDATE renom_log SET at = $1 WHERE why = 'fete'`, sunday); err != nil {
		t.Fatal(err)
	}
	o, _ := rendezLive(ctx, pool, game.FamillesFeteID, sunday)
	for range 2 {
		if err := h.fetePodium(ctx, o); err != nil {
			t.Fatal(err)
		}
	}
	var n int
	var body string
	var extra []byte
	if err := pool.QueryRow(ctx, `SELECT count(*), max(body), (array_agg(extra))[1] FROM babi_direct WHERE key = $1`, "rdv:"+o.Key+":podium").Scan(&n, &body, &extra); err != nil {
		t.Fatal(err)
	}
	var x struct {
		Familles []FeteFamily `json:"familles"`
	}
	_ = json.Unmarshal(extra, &x)
	if n != 1 || len(x.Familles) != 2 || x.Familles[0].Sim != koffi || x.Familles[0].Gained != 120+game.FeteRenom || x.Familles[0].Crest == nil || !strings.Contains(body, "1. Famille") {
		t.Fatalf("podium: %d %q %+v", n, body, x.Familles)
	}
}

// quartierRaw: a GET's body as it comes.
func quartierRaw(t *testing.T, pool *pgxpool.Pool, sim, path string) []byte {
	t.Helper()
	var user string
	if err := pool.QueryRow(context.Background(), `SELECT user_id FROM sims WHERE id = $1`, sim).Scan(&user); err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	(&Handler{DB: pool}).Routes(r)
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req = req.WithContext(auth.WithUserID(req.Context(), user))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Body.Bytes()
}
