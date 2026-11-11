package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Les rendez-vous de la semaine (the update « rendez-vous », game/rendezvous.go): the phone's
// « Rendez-vous » app lists the week's with their countdown, « J'y serai » asks to be reminded, and a
// live one says « En cours, rejoins ! » with the way there. Babi Infos tells each one an hour before
// and as it starts; those who said « J'y serai » get a notification a quarter of an hour before.
// The bonuses come from what's already played: the happy hour lowers the maquis' prices (a measure,
// civic.go), the soirée night halves the host's cost (party.go), the Sunday street match pays a little
// once per account, the Saturday dames tournament shares a fixed pot among its first three.
//
// Cheap on the server: the schedule is a pure function of the clock; a one-minute ticker (and the
// app's reads, at most every 30 s per server) writes what's due with unique keys, so several servers
// post, remind and pay once; nothing at all while the update is closed.

const (
	// rendezPostBefore: Babi Infos tells a rendez-vous this long before it starts (and as it starts).
	rendezPostBefore = time.Hour
	// rendezRemindBefore: the « J'y serai » notification, this long before.
	rendezRemindBefore = 15 * time.Minute
	// rendezAhead: how far the app looks (the week).
	rendezAhead = 7 * 24 * time.Hour
	// rendezPayWithin: a tournament's pot is still paid this long after it ends (a server asleep meanwhile).
	rendezPayWithin = 24 * time.Hour
	rendezEvery     = 30 * time.Second
)

var (
	errRendezGone = errors.New("ce rendez-vous n'est pas au programme")
	errRendezOver = errors.New("ce rendez-vous est passé")
)

// rendezOpen: the update is open (no store, the tests: open). A var, so tests can close it.
var rendezOpen = func(ctx context.Context) bool {
	return features.Default.Open(ctx, game.RendezVousKey)
}

// rendezNow: the clock the bonuses read (tests set it to a rendez-vous' hour).
var rendezNow = time.Now

// The team's switches (rendezvous_settings), read again every 30 s at most.
var rendezSettings struct {
	sync.Mutex
	at  time.Time
	off map[string]bool
}

func rendezOff(ctx context.Context, q queryer) map[string]bool {
	rendezSettings.Lock()
	defer rendezSettings.Unlock()
	if rendezSettings.off != nil && time.Since(rendezSettings.at) < 30*time.Second {
		return rendezSettings.off
	}
	off := map[string]bool{}
	rows, err := q.Query(ctx, `SELECT id FROM rendezvous_settings WHERE off`)
	if err != nil {
		if rendezSettings.off != nil {
			return rendezSettings.off
		}
		return off
	}
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			off[id] = true
		}
	}
	rows.Close()
	rendezSettings.at, rendezSettings.off = time.Now(), off
	return off
}

// RendezForget: the switches read again at once (the admin just changed one).
func RendezForget() {
	rendezSettings.Lock()
	rendezSettings.off = nil
	rendezSettings.Unlock()
}

// rendezCommunes: the communes of Abidjan a featured rendez-vous may be held in (those not waiting for
// an update), and with a place of that kind when one is given (the happy hour: a maquis to go to).
func rendezCommunes(ctx context.Context, kind string) []string {
	// (Asked by every action of every Sim: kept a minute.)
	rendezPools.Lock()
	defer rendezPools.Unlock()
	if p, ok := rendezPools.of[kind]; ok && time.Since(rendezPools.at) < time.Minute {
		return p
	}
	if rendezPools.of == nil || time.Since(rendezPools.at) >= time.Minute {
		rendezPools.of, rendezPools.at = map[string][]string{}, time.Now()
	}
	hidden := features.Default.HiddenPlaces(ctx)
	var out []string
	for _, c := range world.Cities {
		if c.ID != "abidjan" {
			continue
		}
		for _, cm := range c.Communes {
			if hidden[cm.ID] || (kind != "" && !slices.ContainsFunc(cm.Places, func(p world.Place) bool { return p.Kind == kind && !hidden[p.ID] })) {
				continue
			}
			out = append(out, cm.ID)
		}
	}
	rendezPools.of[kind] = out
	return out
}

var rendezPools struct {
	sync.Mutex
	at time.Time
	of map[string][]string
}

// rendezHeld: the rendez-vous held now (the update open, the team's switch on, the mode's own update open).
func rendezHeld(ctx context.Context, q queryer) []game.RendezVous {
	if !rendezOpen(ctx) {
		return nil
	}
	off := rendezOff(ctx, q)
	var out []game.RendezVous
	for _, r := range game.RendezVousList {
		if off[r.ID] || (r.Needs != "" && features.Default.BlocksKey(ctx, r.Needs) != "") {
			continue
		}
		out = append(out, r)
	}
	return out
}

// RendezBetween: the occurrences held over [from, to) (the admin's week too).
func RendezBetween(ctx context.Context, list []game.RendezVous, from, to time.Time) []game.Occurrence {
	all, maquis := rendezCommunes(ctx, ""), rendezCommunes(ctx, "maquis")
	var out []game.Occurrence
	for _, r := range list {
		pool := all
		if r.Mode == "maquis" && len(maquis) > 0 {
			pool = maquis
		}
		out = append(out, game.OccurrencesBetween([]game.RendezVous{r}, from, to, pool)...)
	}
	slices.SortStableFunc(out, func(a, b game.Occurrence) int { return a.From.Compare(b.From) })
	return out
}

// rendezLive: the occurrence of a rendez-vous on now, if it's held.
func rendezLive(ctx context.Context, q queryer, id string, now time.Time) (game.Occurrence, bool) {
	held := rendezHeld(ctx, q)
	i := slices.IndexFunc(held, func(r game.RendezVous) bool { return r.ID == id })
	if i < 0 {
		return game.Occurrence{}, false
	}
	for _, o := range RendezBetween(ctx, held[i:i+1], now, now.Add(time.Second)) {
		if o.Live(now) {
			return o, true
		}
	}
	return game.Occurrence{}, false
}

/* ---------- The bonuses, from what's already played ---------- */

// rendezMeasures: the happy hour and the soirée night, while on in the Sim's commune, among its
// measures (the phone shows the prices lowered the same way: lib/civic.ts, game/soirees.ts).
func rendezMeasures(ctx context.Context, q queryer, s *Sim) {
	if s.City != "abidjan" {
		return
	}
	now := rendezNow()
	if o, ok := rendezLive(ctx, q, "happy-hour", now); ok && s.Commune == o.Commune {
		s.Measures = append(slices.Clip(s.Measures), game.HappyHour.ID)
	}
	if o, ok := rendezLive(ctx, q, "soiree-vendredi", now); ok && s.Commune == o.Commune {
		s.Measures = append(slices.Clip(s.Measures), game.SoireeNightID)
	}
}

// soireeCost: what the soirée costs its host: half during the soirée night, for a host of its commune.
func soireeCost(s *Sim) int {
	if slices.Contains(s.Measures, game.SoireeNightID) {
		return game.Discounted(game.SoireeCost, game.SoireeNightOff)
	}
	return game.SoireeCost
}

// rendezFoot: a street match started during the Sunday rendez-vous: the first one of the account pays
// game.FootBonus (once, whichever server), within the day's limits, to an account that could pass
// Djai on (not a fresh one made to farm, not the testers'); the line said, or "". In a savepoint: a
// failure here never undoes the match.
func rendezFoot(ctx context.Context, tx pgx.Tx, s *Sim, interaction string) string {
	if interaction != "street-foot" && interaction != "play-football" {
		return ""
	}
	sp, err := tx.Begin(ctx)
	if err != nil {
		return ""
	}
	defer sp.Rollback(ctx)
	o, ok := rendezLive(ctx, sp, "foot-dimanche", rendezNow())
	if !ok {
		return ""
	}
	if _, err := sp.Exec(ctx, `INSERT INTO rendezvous_joins (occ, sim, joined_at) VALUES ($1, $2, now()) ON CONFLICT (occ, sim) DO UPDATE SET joined_at = COALESCE(rendezvous_joins.joined_at, now())`, o.Key, s.ID); err != nil {
		return ""
	}
	said := ""
	if heldBack(ctx, sp, s.ID) == nil {
		tag, err := sp.Exec(ctx, `INSERT INTO rendezvous_done (key) VALUES ($1) ON CONFLICT DO NOTHING`, fmt.Sprintf("foot:%s:%s", o.Key, auth.UserID(ctx)))
		if err != nil {
			return ""
		}
		if tag.RowsAffected() > 0 {
			if got := s.earn(game.FromRendezVous, game.FootBonus); got > 0 {
				said = capNote(fmt.Sprintf("Rendez-vous du dimanche : +%s pour ton premier match !", game.FCFA(got)), game.FromRendezVous, got, game.FootBonus)
			}
		}
	}
	if sp.Commit(ctx) != nil {
		return ""
	}
	return said
}

// rendezDames: a game of dames won during the Saturday tournament counts for its winner: against a
// player (both accounts able to pass Djai on: not made to farm), or against a man of the grin with a
// stake; a few times at most against the same one (game.DamesPairMax, DamesNpcMax: the ranking's
// query). In a savepoint: a failure here never undoes the game's end.
func rendezDames(ctx context.Context, tx pgx.Tx, d *dameRow, winner int8) {
	if winner == 0 || (d.Black == nil && (winner != 1 || d.Stake < game.DamesNpcStake)) {
		return
	}
	sp, err := tx.Begin(ctx)
	if err != nil {
		return
	}
	defer sp.Rollback(ctx)
	o, ok := rendezLive(ctx, sp, "dames-samedi", rendezNow())
	if !ok {
		return
	}
	sim, against := d.White, "npc"
	if d.Black != nil {
		sim, against = d.White, *d.Black
		if winner == -1 {
			sim, against = *d.Black, d.White
		}
		if heldBack(ctx, sp, against) != nil || heldBack(ctx, sp, sim) != nil {
			return
		}
	}
	if _, err := sp.Exec(ctx, `INSERT INTO rendezvous_wins (occ, sim, against, n) VALUES ($1, $2, $3, 1) ON CONFLICT (occ, sim, against) DO UPDATE SET n = rendezvous_wins.n + 1, last_at = now()`, o.Key, sim, against); err != nil {
		return
	}
	if _, err := sp.Exec(ctx, `INSERT INTO rendezvous_joins (occ, sim, joined_at) VALUES ($1, $2, now()) ON CONFLICT (occ, sim) DO UPDATE SET joined_at = COALESCE(rendezvous_joins.joined_at, now())`, o.Key, sim); err != nil {
		return
	}
	_ = sp.Commit(ctx)
}

// rankingSQL: an occurrence's tournament, best first (equal: the one who got there first).
const rankingSQL = `SELECT w.sim, s.first_name, SUM(CASE WHEN w.against = 'npc' THEN LEAST(w.n, $2) ELSE $3 * LEAST(w.n, $4) END)::int pts, MAX(w.last_at) at
	FROM rendezvous_wins w JOIN sims s ON s.id = w.sim WHERE w.occ = $1 GROUP BY w.sim, s.first_name ORDER BY pts DESC, at ASC LIMIT $5`

// RankLine: one line of the tournament's ranking.
type RankLine struct {
	Sim    string `json:"sim"`
	Name   string `json:"name"`
	Points int    `json:"points"`
}

func ranking(ctx context.Context, q queryer, occ string, n int) ([]RankLine, error) {
	rows, err := q.Query(ctx, rankingSQL, occ, game.DamesNpcMax, game.DamesPlayerPoints, game.DamesPairMax, n)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []RankLine
	for rows.Next() {
		var l RankLine
		var at time.Time
		if err := rows.Scan(&l.Sim, &l.Name, &l.Points, &at); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// payDames: an ended tournament's pot, once (the key written in the same transaction): to its first
// three that can be paid (an account not made to farm), each within the day's limits; told in Babi Infos.
func (h *Handler) payDames(ctx context.Context, o game.Occurrence) error {
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `INSERT INTO rendezvous_done (key) VALUES ($1) ON CONFLICT DO NOTHING`, "prix:"+o.Key)
	if err != nil || tag.RowsAffected() == 0 {
		return err
	}
	lines, err := ranking(ctx, tx, o.Key, 20)
	if err != nil {
		return err
	}
	now := game.MinuteOf(time.Now())
	var podium []string
	rank := 0
	for _, l := range lines {
		if rank >= len(game.DamesPrizes) {
			break
		}
		if l.Points <= 0 || heldBack(ctx, tx, l.Sim) != nil {
			continue
		}
		prize := game.DamesPrizes[rank]
		rank++
		got, err := takeFor(ctx, tx, l.Sim, game.FromRendezVous, prize)
		if err != nil {
			return err
		}
		text := capNote(fmt.Sprintf("Tournoi de dames du samedi : tu finis %s avec %d points. %s pour toi !", placeWord(rank), l.Points, game.FCFA(got)), game.FromRendezVous, got, prize)
		if err := insertEvent(ctx, tx, l.Sim, "social", text, got, now); err != nil {
			return err
		}
		podium = append(podium, fmt.Sprintf("%d. %s (%d pts)", rank, l.Name, l.Points))
		h.Push.ToSim(l.Sim, push.Message{Title: "Babi Life · Rendez-vous", Body: text, URL: "/jeu?app=rendezvous", Tag: "rdv-" + o.Key})
	}
	body := "Tournoi de dames du samedi : personne n'a marqué de points cette fois. Samedi prochain, à toi !"
	if len(podium) > 0 {
		body = "Tournoi de dames du samedi, le podium :"
		for _, p := range podium {
			body += "\n" + p
		}
	}
	if err := storeDirect(ctx, tx, []directItem{{Key: "rdv:" + o.Key + ":podium", Kind: "rendezvous", Emoji: "🏆", Body: body, At: o.Until}}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func placeWord(rank int) string {
	switch rank {
	case 1:
		return "premier·e"
	case 2:
		return "deuxième"
	}
	return "troisième"
}

/* ---------- Babi Infos, the reminders, the pots: on the clock ---------- */

// rendezPosts: what Babi Infos says of the occurrences given, due in (from, to]: an hour before, and as it starts.
func rendezPosts(occs []game.Occurrence, from, to time.Time) []directItem {
	var out []directItem
	for _, o := range occs {
		where := ""
		if o.Commune != "" {
			where = " " + inCommune(communeName("abidjan", o.Commune))
		}
		soon := o.From.Add(-rendezPostBefore)
		if soon.After(from) && !soon.After(to) && to.Before(o.From) {
			out = append(out, directItem{Key: "rdv:" + o.Key + ":avant", Kind: "rendezvous", Emoji: o.Emoji, Commune: o.Commune, At: soon,
				Body: fmt.Sprintf("Dans 1 h : %s%s ! %s Dis « J'y serai » dans l'appli Rendez-vous.", o.Label, where, o.Bonus+".")})
		}
		if o.From.After(from) && !o.From.After(to) && to.Before(o.Until) {
			out = append(out, directItem{Key: "rdv:" + o.Key + ":debut", Kind: "rendezvous", Emoji: o.Emoji, Commune: o.Commune, At: o.From,
				Body: fmt.Sprintf("C'est maintenant : %s%s ! %s Rejoins-nous !", o.Label, where, o.Bonus+".")})
		}
	}
	return out
}

var rendezClock struct {
	sync.Mutex
	last, done time.Time
	paid       map[string]bool
}

// WatchRendezVous: the rendez-vous' clock, every minute until ctx ends.
func (h *Handler) WatchRendezVous(ctx context.Context) {
	t := time.NewTicker(time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			h.rendezTick(ctx, time.Now())
		}
	}
}

// rendezTick: what's due since the last time (a few hours at most): the posts, the reminders, the pots.
// Nothing while the update is closed; mostly nothing at all (no query) between rendez-vous.
func (h *Handler) rendezTick(ctx context.Context, now time.Time) {
	rendezClock.Lock()
	if now.Sub(rendezClock.last) < rendezEvery {
		rendezClock.Unlock()
		return
	}
	rendezClock.last = now
	from := rendezClock.done
	rendezClock.Unlock()
	held := rendezHeld(ctx, h.DB)
	if len(held) == 0 {
		return
	}
	if from.IsZero() || now.Sub(from) > 3*time.Hour {
		from = now.Add(-3 * time.Hour)
	}
	occs := RendezBetween(ctx, held, now.Add(-rendezPayWithin), now.Add(rendezPostBefore+time.Minute))
	if err := storeDirect(ctx, h.DB, rendezPosts(occs, from, now)); err != nil {
		return
	}
	for _, o := range occs {
		// Those who said « J'y serai », a quarter of an hour before (and up to its start: a server asleep).
		if !now.Before(o.From.Add(-rendezRemindBefore)) && now.Before(o.From.Add(5*time.Minute)) {
			h.remind(ctx, o)
		}
		if o.ID == "dames-samedi" && !now.Before(o.Until) {
			rendezClock.Lock()
			paid := rendezClock.paid[o.Key]
			rendezClock.Unlock()
			if !paid && h.payDames(ctx, o) == nil {
				rendezClock.Lock()
				if rendezClock.paid == nil {
					rendezClock.paid = map[string]bool{}
				}
				rendezClock.paid[o.Key] = true
				rendezClock.Unlock()
			}
		}
	}
	rendezClock.Lock()
	if now.After(rendezClock.done) {
		rendezClock.done = now
	}
	rendezClock.Unlock()
}

// remind: the notification to those who said « J'y serai » (the one UPDATE marks them: sent once).
func (h *Handler) remind(ctx context.Context, o game.Occurrence) {
	rows, err := h.DB.Query(ctx, `UPDATE rendezvous_joins SET reminded_at = now() WHERE occ = $1 AND remind AND reminded_at IS NULL RETURNING sim`, o.Key)
	if err != nil {
		return
	}
	sims, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil || len(sims) == 0 {
		return
	}
	where := ""
	if o.Commune != "" {
		where = " " + inCommune(communeName("abidjan", o.Commune))
	}
	text := fmt.Sprintf("%s%s commence à %s. Tu as dit « J'y serai » : on t'attend !", o.Label, where, o.From.Format("15h04"))
	now := game.MinuteOf(time.Now())
	for _, id := range sims {
		_ = insertEvent(ctx, h.DB, id, "social", text, 0, now)
		h.Push.ToSim(id, push.Message{Title: "Babi Life · Rendez-vous", Body: text, URL: "/jeu?app=rendezvous", Tag: "rdv-" + o.Key})
	}
}

/* ---------- The app ---------- */

// RendezItem: an occurrence as the app shows it.
type RendezItem struct {
	game.Occurrence
	Live bool `json:"live"`
	// Going: how many said « J'y serai »; Joined: how many came; Mine: whether I said it.
	Going  int  `json:"going"`
	Joined int  `json:"joined"`
	Mine   bool `json:"mine"`
	// Ranking: the tournament's first ones (dames), while it's on or just over.
	Ranking []RankLine `json:"ranking,omitempty"`
}

// rendezList: GET /sims/{id}/rendezvous — the week's rendez-vous, the live ones first then by start.
func (h *Handler) rendezList(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	ctx := r.Context()
	if features.Default.BlocksKey(ctx, game.RendezVousKey) != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	now := time.Now()
	h.rendezTick(ctx, now)
	occs := RendezBetween(ctx, rendezHeld(ctx, h.DB), now, now.Add(rendezAhead))
	keys := make([]string, len(occs))
	for i, o := range occs {
		keys[i] = o.Key
	}
	type count struct {
		going, joined int
		mine          bool
	}
	counts := map[string]count{}
	rows, err := h.DB.Query(ctx, `SELECT occ, count(*) FILTER (WHERE remind), count(*) FILTER (WHERE joined_at IS NOT NULL), bool_or(sim = $2 AND remind) FROM rendezvous_joins WHERE occ = ANY($1) GROUP BY occ`, keys, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	for rows.Next() {
		var k string
		var c count
		if rows.Scan(&k, &c.going, &c.joined, &c.mine) == nil {
			counts[k] = c
		}
	}
	rows.Close()
	out := make([]RendezItem, 0, len(occs))
	for _, o := range occs {
		c := counts[o.Key]
		it := RendezItem{Occurrence: o, Live: o.Live(now), Going: c.going, Joined: c.joined, Mine: c.mine}
		if o.ID == "dames-samedi" && it.Live {
			it.Ranking, _ = ranking(ctx, h.DB, o.Key, 5)
		}
		out = append(out, it)
	}
	slices.SortStableFunc(out, func(a, b RendezItem) int {
		if a.Live != b.Live {
			if a.Live {
				return -1
			}
			return 1
		}
		return a.From.Compare(b.From)
	})
	httpx.JSON(w, http.StatusOK, map[string]any{"items": out, "now": now})
}

// rendezAct: POST /sims/{id}/rendezvous/{occ} {"remind": bool} or {"join": true} — « J'y serai »
// (taken back with false), or « J'y vais » while it's on (counted among those who came).
func (h *Handler) rendezAct(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Remind *bool `json:"remind"`
		Join   bool  `json:"join"`
	}
	if err := httpx.Decode(r, &req); err != nil || (req.Remind == nil && !req.Join) {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	ctx := r.Context()
	// (« dames-samedi:20261114 »: its colon may come escaped.)
	key, err := url.PathUnescape(chi.URLParam(r, "occ"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	now := time.Now()
	var occ *game.Occurrence
	for _, o := range RendezBetween(ctx, rendezHeld(ctx, h.DB), now.Add(-time.Hour*6), now.Add(rendezAhead)) {
		if o.Key == key {
			occ = &o
			break
		}
	}
	switch {
	case occ == nil:
		httpx.Error(w, http.StatusNotFound, errRendezGone.Error())
		return
	case !now.Before(occ.Until):
		httpx.Error(w, http.StatusConflict, errRendezOver.Error())
		return
	}
	if req.Join {
		if !occ.Live(now) {
			httpx.Error(w, http.StatusConflict, "ça n'a pas encore commencé")
			return
		}
		_, err = h.DB.Exec(ctx, `INSERT INTO rendezvous_joins (occ, sim, joined_at) VALUES ($1, $2, now()) ON CONFLICT (occ, sim) DO UPDATE SET joined_at = COALESCE(rendezvous_joins.joined_at, now())`, key, id)
	} else {
		_, err = h.DB.Exec(ctx, `INSERT INTO rendezvous_joins (occ, sim, remind) VALUES ($1, $2, $3) ON CONFLICT (occ, sim) DO UPDATE SET remind = $3`, key, id, *req.Remind)
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	var going, joined int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FILTER (WHERE remind), count(*) FILTER (WHERE joined_at IS NOT NULL) FROM rendezvous_joins WHERE occ = $1`, key).Scan(&going, &joined)
	httpx.JSON(w, http.StatusOK, map[string]any{"going": going, "joined": joined, "mine": req.Remind != nil && *req.Remind})
}
