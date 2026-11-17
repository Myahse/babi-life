package sims

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Mon quartier (game/monquartier.go, the update « mon-quartier »): the quartier is made the first time it's
// asked for, centred on the Sim's home lot (or its commune's centre), and moved on to now each time it's
// read (the buildings' money, the reputation their customers bring): no background job, the database
// sleeps when nobody plays. The phone's sheets (web components/quartier/) manage it; the 3D world
// (another part of the update) draws it from the same GET, and visitors read its public view.

var (
	errNoQuartierKind  = errors.New("ce bâtiment n'existe pas")
	errKindLocked      = errors.New("ton quartier n'a pas encore le niveau pour ce bâtiment")
	errKindMax         = errors.New("ton quartier en a déjà assez")
	errSlotTaken       = errors.New("cet emplacement est déjà pris")
	errLotFar          = errors.New("ce terrain est ailleurs dans ton quartier")
	errNoSlot          = errors.New("plus de place dans ton quartier")
	errNoBuilding      = errors.New("ce bâtiment n'est pas dans ton quartier")
	errNoStaffHere     = errors.New("personne à embaucher ici")
	errStaffMax        = errors.New("il y a déjà assez de monde ici")
	errStaffMin        = errors.New("personne à renvoyer")
	errQuartierName    = errors.New("le nom du quartier fait 2 à 40 lettres")
	errVisitsMode      = errors.New("visites : « tous » ou « amis »")
	errFriendsOnly     = errors.New("ce quartier ne s'ouvre qu'aux amis")
	errOwnQuartier     = errors.New("c'est ton propre quartier")
	errQuartierNothing = errors.New("rien à encaisser pour l'instant : tes bâtiments gagnent au fil des heures")
)

func quartierOpen(ctx context.Context) bool {
	return features.Default == nil || features.Default.BlocksKey(ctx, game.MonQuartierKey) == ""
}

// quartierRow: a quartier as kept.
type quartierRow struct {
	sim, commune, name, mode string
	lat, lng                 float64
	level, rep               int
	pionnier                 bool
	repAt                    time.Time
}

// qBuilding: one of its buildings.
type qBuilding struct {
	ID    int64  `json:"id"`
	Kind  string `json:"kind"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	// Slot: the lot it stands on (game.QuartierLotSpot), also as Lot.
	Slot    int     `json:"slot"`
	Lot     int     `json:"lot"`
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`
	Heading float64 `json:"heading"`
	Level   int     `json:"level"`
	Opened  bool    `json:"opened"`
	Staff   int     `json:"staff"`
	// StaffMax: the most who may work there (0: nobody to hire).
	StaffMax int `json:"staffMax"`
	PerDay   int `json:"perDay"`
	Pending  int `json:"pending"`
	last     time.Time
	layout   int
}

// quartierLot: one of the quartier's lots, where it is (before the phone snaps it to its street) and the
// building on it (0: a free lot, « Terrain libre »).
type quartierLot struct {
	Lot      int     `json:"lot"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	Heading  float64 `json:"heading"`
	Building int64   `json:"building"`
}

type latLng struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type quartierUnlock struct {
	Kind   string `json:"kind"`
	Label  string `json:"label"`
	Icon   string `json:"icon"`
	About  string `json:"about"`
	Level  int    `json:"level"`
	Price  int    `json:"price"`
	Locked bool   `json:"locked"`
	// Built: how many the quartier has; Max: how many it may have.
	Built int `json:"built"`
	Max   int `json:"max"`
}

type quartierTodo struct {
	ID     string  `json:"id"`
	Text   string  `json:"text"`
	Target *latLng `json:"target,omitempty"`
	Kind   string  `json:"kind"`
	// Lot: the lot it points to in the quartier view (-1: the home); none: no lot (a demande, the story).
	Lot *int `json:"lot,omitempty"`
}

type quartierNext struct {
	Level      int `json:"level"`
	Reputation int `json:"reputation"`
}

// quartierView: GET /sims/{id}/quartier (the contract's shape, and what the sheets need besides).
type quartierView struct {
	Owner       string           `json:"owner"`
	OwnerName   string           `json:"ownerName"`
	Name        string           `json:"name"`
	Commune     string           `json:"commune"`
	CommuneName string           `json:"communeName"`
	Center      latLng           `json:"center"`
	Radius      int              `json:"radius"`
	Level       int              `json:"level"`
	Reputation  int              `json:"reputation"`
	Next        *quartierNext    `json:"next"`
	Buildings   []qBuilding      `json:"buildings"`
	Unlocks     []quartierUnlock `json:"unlocks"`
	Todo        *quartierTodo    `json:"todo"`
	VisitsMode  string           `json:"visitsMode"`
	Pionnier    bool             `json:"pionnier"`
	// PerDay: what all the buildings bring a day; Pending: what waits in them; Left: what may still be
	// collected today (the rents' daily limit); FreeSlots: the spots still free.
	PerDay    int   `json:"perDay"`
	Pending   int   `json:"pending"`
	Left      int   `json:"left"`
	FreeSlots []int `json:"freeSlots"`
	// Lots: every lot of the quartier, built on or free.
	Lots []quartierLot `json:"lots"`
	// Money: the Sim's money now (what it can afford).
	Money int `json:"money"`
	Home  *struct {
		Label string `json:"label"`
	} `json:"home,omitempty"`
}

// publicBuilding: a building as a visitor sees it (no money).
type publicBuilding struct {
	ID      int64   `json:"id"`
	Kind    string  `json:"kind"`
	Label   string  `json:"label"`
	Icon    string  `json:"icon"`
	Slot    int     `json:"slot"`
	Lot     int     `json:"lot"`
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`
	Heading float64 `json:"heading"`
	Level   int     `json:"level"`
	Opened  bool    `json:"opened"`
	Staff   int     `json:"staff"`
}

// publicQuartier: GET /quartiers/{simId}: the same minus the money and the owner's goals.
type publicQuartier struct {
	Owner       string           `json:"owner"`
	OwnerName   string           `json:"ownerName"`
	Name        string           `json:"name"`
	Commune     string           `json:"commune"`
	CommuneName string           `json:"communeName"`
	Center      latLng           `json:"center"`
	Radius      int              `json:"radius"`
	Level       int              `json:"level"`
	Reputation  int              `json:"reputation"`
	Next        *quartierNext    `json:"next"`
	Buildings   []publicBuilding `json:"buildings"`
	Unlocks     []quartierUnlock `json:"unlocks"`
	VisitsMode  string           `json:"visitsMode"`
}

// quartierPionnierSQL reads the Pionnier mark whichever way the Sim carries it (a column, or a field of its life),
// without failing where neither exists yet.
const quartierPionnierSQL = `(COALESCE(to_jsonb(s)->>'pionnier', '') = 'true' OR COALESCE(s.life->>'pionnier', '') = 'true')`

// ensureQuartier: the Sim's quartier, locked, made the first time.
func ensureQuartier(ctx context.Context, tx pgx.Tx, simID string) (quartierRow, error) {
	q := quartierRow{sim: simID}
	row := tx.QueryRow(ctx, `SELECT commune, name, visits_mode, center_lat, center_lng, level, reputation, pionnier, rep_at FROM quartiers WHERE sim_id = $1 FOR UPDATE`, simID)
	err := row.Scan(&q.commune, &q.name, &q.mode, &q.lat, &q.lng, &q.level, &q.rep, &q.pionnier, &q.repAt)
	if err == nil || !errors.Is(err, pgx.ErrNoRows) {
		return q, err
	}
	var first, city string
	var own bool
	var lat, lng *float64
	if err := tx.QueryRow(ctx, `
		SELECT s.first_name, s.home_city, s.home_commune, s.housing = $2, p.lot_lat, p.lot_lng, `+quartierPionnierSQL+`
		FROM sims s LEFT JOIN plots p ON p.id = s.home_plot WHERE s.id = $1`, simID, game.OwnHouse).Scan(&first, &city, &q.commune, &own, &lat, &lng, &q.pionnier); err != nil {
		return q, err
	}
	if lat != nil && lng != nil {
		q.lat, q.lng = *lat, *lng
	} else if _, cm, ok := world.FindCommune(city, q.commune); ok {
		// (The home where the street draws it: the quartier's lots round it, the same on every phone.)
		q.lat, q.lng = game.StreetHome(simID, own, cm.Lat, cm.Lng)
	} else if _, cm, ok := world.FindCommune("abidjan", "yopougon"); ok {
		q.commune, q.lat, q.lng = cm.ID, cm.Lat, cm.Lng
	}
	q.name = "Quartier " + first
	q.mode = "tous"
	q.level = game.QuartierLevel(0, q.pionnier)
	q.repAt = time.Now()
	_, err = tx.Exec(ctx, `INSERT INTO quartiers (sim_id, commune, center_lat, center_lng, name, level, pionnier, rep_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
		simID, q.commune, q.lat, q.lng, q.name, q.level, q.pionnier, q.repAt)
	return q, err
}

// loadQuartier: the quartier and its buildings moved on to now (and saved so).
func loadQuartier(ctx context.Context, tx pgx.Tx, simID string, now time.Time) (quartierRow, []qBuilding, error) {
	q, err := ensureQuartier(ctx, tx, simID)
	if err != nil {
		return q, nil, err
	}
	rows, err := tx.Query(ctx, `SELECT id, kind, slot, lat, lng, heading, level, staff, opened, earnings_pending, last, layout FROM quartier_buildings WHERE sim_id = $1 ORDER BY slot FOR UPDATE`, simID)
	if err != nil {
		return q, nil, err
	}
	var bs []qBuilding
	for rows.Next() {
		var b qBuilding
		var heading float32
		if err := rows.Scan(&b.ID, &b.Kind, &b.Slot, &b.Lat, &b.Lng, &heading, &b.Level, &b.Staff, &b.Opened, &b.Pending, &b.last, &b.layout); err != nil {
			rows.Close()
			return q, nil, err
		}
		b.Heading = float64(heading)
		b.Lot = b.Slot
		bs = append(bs, b)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return q, nil, err
	}
	if err := centreOnHome(ctx, tx, &q, bs); err != nil {
		return q, nil, err
	}
	if err := migrateLots(ctx, tx, q, bs); err != nil {
		return q, nil, err
	}
	repDay := 0
	for i := range bs {
		b := &bs[i]
		k, _ := game.FindQuartierKind(b.Kind)
		if b.Opened {
			qb := game.QBuilding{Kind: b.Kind, Staff: b.Staff, Pending: b.Pending, Last: b.last}
			qb.Settle(q.commune, now)
			if qb.Pending != b.Pending || !qb.Last.Equal(b.last) {
				b.Pending, b.last = qb.Pending, qb.Last
				if _, err := tx.Exec(ctx, `UPDATE quartier_buildings SET earnings_pending = $2, last = $3 WHERE id = $1`, b.ID, b.Pending, b.last); err != nil {
					return q, nil, err
				}
			}
			repDay += k.Rep
		}
		b.fill(k, q.commune)
	}
	gain, at := game.QuartierRepGain(repDay, q.repAt, now)
	if repDay == 0 {
		at = now
	}
	q.rep += gain
	lvl := max(q.level, game.QuartierLevel(q.rep, q.pionnier))
	if gain > 0 || lvl != q.level || !at.Equal(q.repAt) {
		q.level, q.repAt = lvl, at
		if _, err := tx.Exec(ctx, `UPDATE quartiers SET reputation = $2, level = $3, rep_at = $4 WHERE sim_id = $1`, simID, q.rep, q.level, q.repAt); err != nil {
			return q, nil, err
		}
	}
	return q, bs, nil
}

// centreOnHome: a v1 quartier centred on its commune's centre (no lot set on the map) moved onto the home as the
// street draws it, before its buildings go onto their lots round it; never once a building stands on a lot.
func centreOnHome(ctx context.Context, tx pgx.Tx, q *quartierRow, bs []qBuilding) error {
	if slices.ContainsFunc(bs, func(b qBuilding) bool { return b.layout >= game.QuartierLotLayout }) {
		return nil
	}
	var city string
	var own, set bool
	if err := tx.QueryRow(ctx, `SELECT s.home_city, s.housing = $2, p.lot_lat IS NOT NULL FROM sims s LEFT JOIN plots p ON p.id = s.home_plot WHERE s.id = $1`, q.sim, game.OwnHouse).Scan(&city, &own, &set); err != nil || set {
		return err
	}
	_, cm, ok := world.FindCommune(city, q.commune)
	if !ok || math.Abs(q.lat-cm.Lat) > 1e-7 || math.Abs(q.lng-cm.Lng) > 1e-7 {
		return nil
	}
	q.lat, q.lng = game.StreetHome(q.sim, own, cm.Lat, cm.Lng)
	_, err := tx.Exec(ctx, `UPDATE quartiers SET center_lat = $2, center_lng = $3 WHERE sim_id = $1`, q.sim, q.lat, q.lng)
	return err
}

// migrateLots: the buildings kept under the v1 layout (a ring of slots round the home) moved onto their lot
// (the same number) among the neighbourhood's streets; done once, the first time the quartier is read.
func migrateLots(ctx context.Context, tx pgx.Tx, q quartierRow, bs []qBuilding) error {
	for i := range bs {
		b := &bs[i]
		if b.layout >= game.QuartierLotLayout {
			continue
		}
		b.Lat, b.Lng, b.Heading = q.slotSpot(b.Slot)
		b.layout = game.QuartierLotLayout
		if _, err := tx.Exec(ctx, `UPDATE quartier_buildings SET lat = $2, lng = $3, heading = $4, layout = $5 WHERE id = $1`, b.ID, b.Lat, b.Lng, b.Heading, b.layout); err != nil {
			return err
		}
	}
	return nil
}

func (b *qBuilding) fill(k game.QuartierKind, commune string) {
	b.Label, b.Icon, b.StaffMax = k.Label, k.Icon, k.Staff
	b.PerDay = 0
	if b.Opened {
		b.PerDay = game.QuartierPerDay(k, b.Staff, commune)
	}
}

// quartierRep: reputation won by a Sim's quartier (none yet: nothing to do).
func quartierRep(ctx context.Context, db execer, simID string, n int) error {
	_, err := db.Exec(ctx, `UPDATE quartiers SET reputation = reputation + $2 WHERE sim_id = $1`, simID, n)
	return err
}

// unlocks: every building, locked or not at the quartier's level, with how many it has.
func unlocks(level int, bs []qBuilding) []quartierUnlock {
	out := make([]quartierUnlock, 0, len(game.QuartierKinds))
	for _, k := range game.QuartierKinds {
		n := 0
		for _, b := range bs {
			if b.Kind == k.ID {
				n++
			}
		}
		out = append(out, quartierUnlock{Kind: k.ID, Label: k.Label, Icon: k.Icon, About: k.About, Level: k.Level, Price: k.Price, Locked: k.Level > level, Built: n, Max: k.Max})
	}
	return out
}

func freeSlots(bs []qBuilding) []int {
	out := []int{}
	for i := range game.QuartierLots {
		if !slices.ContainsFunc(bs, func(b qBuilding) bool { return b.Slot == i }) {
			out = append(out, i)
		}
	}
	return out
}

func nextOf(level int) *quartierNext {
	l, rep := game.NextQuartierLevel(level)
	if l == 0 {
		return nil
	}
	return &quartierNext{Level: l, Reputation: rep}
}

func (q quartierRow) slotSpot(slot int) (lat, lng, heading float64) {
	e, n, h := game.QuartierLotSpot(slot)
	lat, lng = game.OffsetLatLng(q.lat, q.lng, e, n)
	return lat, lng, h
}

// lots: every lot, where its building stands (snapped to its street when built) or where it is free.
func (q quartierRow) lots(bs []qBuilding) []quartierLot {
	out := make([]quartierLot, 0, game.QuartierLots)
	for i := range game.QuartierLots {
		l := quartierLot{Lot: i}
		if j := slices.IndexFunc(bs, func(b qBuilding) bool { return b.Slot == i }); j >= 0 {
			l.Lat, l.Lng, l.Heading, l.Building = bs[j].Lat, bs[j].Lng, bs[j].Heading, bs[j].ID
		} else {
			l.Lat, l.Lng, l.Heading = q.slotSpot(i)
		}
		out = append(out, l)
	}
	return out
}

// ownerView: the whole quartier as its owner sees it.
func ownerView(q quartierRow, bs []qBuilding, ownerName string) quartierView {
	if bs == nil {
		bs = []qBuilding{}
	}
	v := quartierView{Owner: q.sim, OwnerName: ownerName, Name: q.name, Commune: q.commune, CommuneName: communeName("abidjan", q.commune), Center: latLng{q.lat, q.lng},
		Radius: game.QuartierRadius, Level: q.level, Reputation: q.rep, Next: nextOf(q.level), Buildings: bs, Unlocks: unlocks(q.level, bs), VisitsMode: q.mode, Pionnier: q.pionnier, FreeSlots: freeSlots(bs), Lots: q.lots(bs)}
	if _, cm, ok := world.FindCommune("abidjan", q.commune); !ok || cm.Name == "" {
		v.CommuneName = q.commune
	}
	for _, b := range bs {
		v.PerDay += b.PerDay
		v.Pending += b.Pending
	}
	return v
}

// publicView: what a visitor sees.
func publicView(q quartierRow, bs []qBuilding, ownerName string) publicQuartier {
	v := ownerView(q, bs, ownerName)
	pb := make([]publicBuilding, 0, len(bs))
	for _, b := range bs {
		pb = append(pb, publicBuilding{ID: b.ID, Kind: b.Kind, Label: b.Label, Icon: b.Icon, Slot: b.Slot, Lot: b.Slot, Lat: b.Lat, Lng: b.Lng, Heading: b.Heading, Level: b.Level, Opened: b.Opened, Staff: b.Staff})
	}
	return publicQuartier{Owner: v.Owner, OwnerName: v.OwnerName, Name: v.Name, Commune: v.Commune, CommuneName: v.CommuneName, Center: v.Center, Radius: v.Radius,
		Level: v.Level, Reputation: v.Reputation, Next: v.Next, Buildings: pb, Unlocks: v.Unlocks, VisitsMode: v.VisitsMode}
}

// needWords: what an urgent need asks for, the worst first.
var needWords = []struct {
	id, text, kind string
}{
	{"hunger", "Tu as faim : va manger un morceau", "maquis"},
	{"energy", "Tu tombes de fatigue : rentre dormir", "maison"},
	{"hygiene", "Une bonne douche s'impose", "maison"},
	{"social", "Tu te sens seul : passe au grin voir du monde", "grin"},
	{"fun", "Tu t'ennuies : va te détendre", "terrain"},
}

// UrgentNeed: below this a need comes first in « À faire maintenant ».
const UrgentNeed = 20

// quartierTodoFor: the one thing to do now: an urgent need, then the quartier's goal (its first building,
// the money waiting, a building it can afford), then a demande of the day, then the story's step, then the
// reputation the next level needs.
func quartierTodoFor(ctx context.Context, tx pgx.Tx, q quartierRow, bs []qBuilding, needs game.Needs, money int, born int64, now time.Time) *quartierTodo {
	near := func(kind string) (*latLng, *int) {
		for _, b := range bs {
			if b.Kind == kind {
				return &latLng{b.Lat, b.Lng}, &b.Slot
			}
		}
		return nil, nil
	}
	home := -1
	vals := map[string]float64{"hunger": needs.Hunger, "energy": needs.Energy, "hygiene": needs.Hygiene, "social": needs.Social, "fun": needs.Fun}
	worst, low := "", float64(UrgentNeed)
	for _, n := range needWords {
		if vals[n.id] < low {
			worst, low = n.id, vals[n.id]
		}
	}
	for _, n := range needWords {
		if n.id == worst {
			t := &quartierTodo{ID: "need:" + n.id, Text: n.text, Kind: "need"}
			t.Target, t.Lot = near(n.kind)
			if n.kind == "maison" {
				t.Target, t.Lot = &latLng{q.lat, q.lng}, &home
			}
			return t
		}
	}
	if len(bs) == 0 {
		lat, lng, _ := q.slotSpot(0)
		lot := 0
		return &quartierTodo{ID: "build:boutique", Text: "Ouvre ta première boutique au carrefour", Kind: "build", Target: &latLng{lat, lng}, Lot: &lot}
	}
	for _, b := range bs {
		if b.Pending >= 2000 {
			return &quartierTodo{ID: fmt.Sprintf("collect:%d", b.ID), Text: fmt.Sprintf("Encaisse les gains : %s", b.Label), Kind: "collect", Target: &latLng{b.Lat, b.Lng}, Lot: &b.Slot}
		}
	}
	for _, u := range unlocks(q.level, bs) {
		if !u.Locked && u.Built == 0 && u.Price <= money {
			t := &quartierTodo{ID: "build:" + u.Kind, Text: fmt.Sprintf("Construis : %s", u.Label), Kind: "build"}
			// (The nearest free lot: « Terrain libre — Construire ici ».)
			if free := freeSlots(bs); len(free) > 0 {
				lat, lng, _ := q.slotSpot(free[0])
				t.Target, t.Lot = &latLng{lat, lng}, &free[0]
			}
			return t
		}
	}
	day := errandDay(now)
	if errandsOpen(ctx) {
		if list, err := todaysErrands(ctx, tx, q.sim, q.commune, errandStage(born, now), day); err == nil {
			for _, e := range list {
				if !e.Done && e.Step < len(e.Steps) {
					return &quartierTodo{ID: "demande:" + e.ID, Text: fmt.Sprintf("%s : %s", e.Giver, e.Steps[e.Step].Text), Kind: "demande"}
				}
			}
		}
	}
	if storiesOpen(ctx) {
		if st, err := storyNow(ctx, tx, q.sim, day); err == nil && st.on != nil {
			if v := st.on.view(day); !v.Waiting && v.Step < len(v.Steps) {
				return &quartierTodo{ID: fmt.Sprintf("histoire:%s:%d", st.on.id, v.Chapter), Text: v.Steps[v.Step].Text, Kind: "histoire"}
			}
		}
	}
	if n := nextOf(q.level); n != nil {
		return &quartierTodo{ID: fmt.Sprintf("level:%d", n.Level), Text: fmt.Sprintf("Encore %d de réputation pour le niveau %d", n.Reputation-q.rep, n.Level), Kind: "level"}
	}
	return nil
}

// quartier: GET /sims/{id}/quartier — the Sim's quartier, moved on to now, with the one thing to do now.
func (h *Handler) quartier(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !quartierOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	var id, first string
	var needs game.Needs
	var money int
	var born int64
	var home bool
	if err := tx.QueryRow(ctx, `SELECT id, first_name, needs, money, born_at, home_plot IS NOT NULL AND housing = $3 FROM sims WHERE id = $1 AND user_id = $2`,
		chi.URLParam(r, "id"), auth.UserID(ctx), game.OwnHouse).Scan(&id, &first, &needs, &money, &born, &home); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	now := time.Now()
	q, bs, err := loadQuartier(ctx, tx, id, now)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	v := ownerView(q, bs, first)
	v.Money = money
	v.Todo = quartierTodoFor(ctx, tx, q, bs, needs, money, born, now)
	if home {
		v.Home = &struct {
			Label string `json:"label"`
		}{Label: "Ma maison"}
	}
	if v.Left, err = leftFor(ctx, tx, id, game.FromEstate); err != nil || tx.Commit(ctx) != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, v)
}

// onQuartier: a change to the Sim's quartier, in the Sim's own transaction (its money).
func (h *Handler) onQuartier(w http.ResponseWriter, r *http.Request, req any, fn func(s *Sim, tx pgx.Tx, q *quartierRow, bs []qBuilding) (string, int, error)) {
	if !quartierOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	if err := httpx.Decode(r, req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		q, bs, err := loadQuartier(ctx, tx, s.ID, time.Now())
		if err != nil {
			return game.Outcome{}, nil, err
		}
		text, money, err := fn(s, tx, &q, bs)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		kind := "life"
		if money != 0 {
			kind = "bill"
		}
		return game.Outcome{Text: text, Money: money}, []Event{{Kind: kind, Text: text, Money: money, GameTime: s.GameMinutes}}, nil
	})
}

// quartierBuild: POST /sims/{id}/quartier/build {kind, slot} — a building paid and opened on a free spot
// (slot -1: the first free one). Its opening brings reputation; a shop opens with one person working.
func (h *Handler) quartierBuild(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind string `json:"kind"`
		Slot *int   `json:"slot"`
		// Where the phone put the lot on its street (else its place in the layout): kept if near enough.
		Lat     *float64 `json:"lat"`
		Lng     *float64 `json:"lng"`
		Heading *float64 `json:"heading"`
	}
	h.onQuartier(w, r, &req, func(s *Sim, tx pgx.Tx, q *quartierRow, bs []qBuilding) (string, int, error) {
		k, ok := game.FindQuartierKind(req.Kind)
		if !ok {
			return "", 0, errNoQuartierKind
		}
		if k.Level > q.level {
			return "", 0, errKindLocked
		}
		n := 0
		for _, b := range bs {
			if b.Kind == k.ID {
				n++
			}
		}
		if n >= k.Max {
			return "", 0, errKindMax
		}
		free := freeSlots(bs)
		slot := -1
		if req.Slot != nil && *req.Slot >= 0 {
			slot = *req.Slot
			if slot >= game.QuartierLots || !slices.Contains(free, slot) {
				return "", 0, errSlotTaken
			}
		} else if len(free) > 0 {
			slot = free[0]
		}
		if slot < 0 {
			return "", 0, errNoSlot
		}
		if k.Price > s.Money {
			return "", 0, game.ErrNotEnoughMoney
		}
		s.Money -= k.Price
		staff := 0
		if k.Shop != "" {
			staff = 1
		}
		lat, lng, heading := q.slotSpot(slot)
		if req.Lat != nil && req.Lng != nil {
			e, n := game.MetresFrom(q.lat, q.lng, *req.Lat, *req.Lng)
			if !game.LotNear(slot, e, n) {
				return "", 0, errLotFar
			}
			lat, lng = *req.Lat, *req.Lng
			if req.Heading != nil && !math.IsNaN(*req.Heading) {
				heading = math.Remainder(*req.Heading, 2*math.Pi)
			}
		}
		b := qBuilding{Kind: k.ID, Slot: slot, Lot: slot, Lat: lat, Lng: lng, Heading: heading, Level: 1, Opened: true, Staff: staff, last: time.Now()}
		if err := tx.QueryRow(reqCtx(r), `INSERT INTO quartier_buildings (sim_id, kind, slot, lat, lng, heading, staff, last, layout) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
			s.ID, k.ID, slot, lat, lng, heading, staff, b.last, game.QuartierLotLayout).Scan(&b.ID); err != nil {
			return "", 0, err
		}
		b.fill(k, q.commune)
		rep := game.RepForOpening(k)
		q.rep += rep
		q.level = max(q.level, game.QuartierLevel(q.rep, q.pionnier))
		if _, err := tx.Exec(reqCtx(r), `UPDATE quartiers SET reputation = $2, level = $3 WHERE sim_id = $1`, s.ID, q.rep, q.level); err != nil {
			return "", 0, err
		}
		s.reply = b
		return fmt.Sprintf("Nouveau dans ton quartier : %s ! +%d de réputation.", k.Label, rep), -k.Price, nil
	})
}

func reqCtx(r *http.Request) context.Context { return r.Context() }

// quartierCollect: POST /sims/{id}/quartier/collect {buildingId?} — the money waiting (in one building, or
// all), the tax off, within the rents' daily limit (FromEstate); the rest waits.
func (h *Handler) quartierCollect(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BuildingID int64 `json:"buildingId"`
	}
	h.onQuartier(w, r, &req, func(s *Sim, tx pgx.Tx, q *quartierRow, bs []qBuilding) (string, int, error) {
		if req.BuildingID != 0 && !slices.ContainsFunc(bs, func(b qBuilding) bool { return b.ID == req.BuildingID }) {
			return "", 0, errNoBuilding
		}
		got, tax := 0, 0
		for i := range bs {
			b := &bs[i]
			if req.BuildingID != 0 && b.ID != req.BuildingID {
				continue
			}
			qb := game.QBuilding{Pending: b.Pending}
			net, tx1 := qb.Collect(s.left(game.FromEstate))
			if net > 0 {
				net = s.earn(game.FromEstate, net)
			}
			if qb.Pending != b.Pending {
				b.Pending = qb.Pending
				if _, err := tx.Exec(reqCtx(r), `UPDATE quartier_buildings SET earnings_pending = $2 WHERE id = $1`, b.ID, b.Pending); err != nil {
					return "", 0, err
				}
			}
			got, tax = got+net, tax+tx1
		}
		switch {
		case got == 0 && s.left(game.FromEstate) == 0:
			return "", 0, game.ErrFull(game.FromEstate)
		case got == 0:
			return "", 0, errQuartierNothing
		}
		s.reply = map[string]int{"amount": got, "tax": tax}
		text := fmt.Sprintf("Recettes du quartier : %s pour toi, %s d'impôts payés.", game.FCFA(got), game.FCFA(tax))
		if s.left(game.FromEstate) == 0 {
			text = capNote(text, game.FromEstate, 0, 1)
		}
		return text, got, nil
	})
}

// quartierStaff: POST /sims/{id}/quartier/staff {buildingId, delta} — one more (or one less) person working.
func (h *Handler) quartierStaff(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BuildingID int64 `json:"buildingId"`
		Delta      int   `json:"delta"`
	}
	h.onQuartier(w, r, &req, func(s *Sim, tx pgx.Tx, q *quartierRow, bs []qBuilding) (string, int, error) {
		i := slices.IndexFunc(bs, func(b qBuilding) bool { return b.ID == req.BuildingID })
		if i < 0 {
			return "", 0, errNoBuilding
		}
		b := &bs[i]
		k, _ := game.FindQuartierKind(b.Kind)
		if k.Staff == 0 {
			return "", 0, errNoStaffHere
		}
		next := b.Staff + int(math.Copysign(1, float64(req.Delta)))
		switch {
		case next > k.Staff:
			return "", 0, errStaffMax
		case next < 0:
			return "", 0, errStaffMin
		}
		b.Staff = next
		if _, err := tx.Exec(reqCtx(r), `UPDATE quartier_buildings SET staff = $2 WHERE id = $1`, b.ID, b.Staff); err != nil {
			return "", 0, err
		}
		b.fill(k, q.commune)
		s.reply = *b
		if req.Delta > 0 {
			return fmt.Sprintf("%s : une personne de plus au travail (%s par jour de salaire).", k.Label, game.FCFA(game.Wage)), 0, nil
		}
		return fmt.Sprintf("%s : une personne de moins au travail.", k.Label), 0, nil
	})
}

// quartierEdit: PUT /sims/{id}/quartier {name?, visitsMode?}.
func (h *Handler) quartierEdit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !quartierOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	var req struct {
		Name       *string `json:"name"`
		VisitsMode *string `json:"visitsMode"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	q, err := ensureQuartier(ctx, tx, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if req.Name != nil {
		n := strings.TrimSpace(*req.Name)
		if l := len([]rune(n)); l < 2 || l > 40 {
			httpx.Error(w, http.StatusUnprocessableEntity, errQuartierName.Error())
			return
		}
		q.name = n
	}
	if req.VisitsMode != nil {
		if *req.VisitsMode != "tous" && *req.VisitsMode != "amis" {
			httpx.Error(w, http.StatusUnprocessableEntity, errVisitsMode.Error())
			return
		}
		q.mode = *req.VisitsMode
	}
	if _, err := tx.Exec(ctx, `UPDATE quartiers SET name = $2, visits_mode = $3 WHERE sim_id = $1`, id, q.name, q.mode); err != nil || tx.Commit(ctx) != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"name": q.name, "visitsMode": q.mode})
}

// mayVisit: whether a viewer (any Sim of the account, or that one Sim) may see an owner's quartier:
// never across a block; friends only when the owner asks so.
func mayVisit(ctx context.Context, tx pgx.Tx, owner, user, viewer, mode string) (bool, error) {
	var mine, blocked, friend bool
	err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM sims WHERE id = $1 AND user_id = $2),
		       EXISTS(SELECT 1 FROM blocks k JOIN sims v ON v.user_id = $2 AND ($3 = '' OR v.id::text = $3) WHERE (k.sim = $1 AND k.blocked = v.id) OR (k.sim = v.id AND k.blocked = $1)),
		       EXISTS(SELECT 1 FROM sims v JOIN bonds b ON b.sim_a = LEAST(v.id, $1::uuid) AND b.sim_b = GREATEST(v.id, $1::uuid) AND b.friends WHERE v.user_id = $2 AND ($3 = '' OR v.id::text = $3))`,
		owner, user, viewer).Scan(&mine, &blocked, &friend)
	if err != nil {
		return false, err
	}
	switch {
	case mine:
		return true, nil
	case blocked:
		return false, nil
	case mode == "amis":
		return friend, nil
	}
	return true, nil
}

// visitView: an owner's quartier as a visitor may see it (moved on to now); ok false: not allowed.
func (h *Handler) visitView(ctx context.Context, tx pgx.Tx, owner, viewer string) (publicQuartier, bool, error) {
	var first string
	if err := tx.QueryRow(ctx, `SELECT first_name FROM sims WHERE id = $1`, owner).Scan(&first); err != nil {
		return publicQuartier{}, false, err
	}
	q, bs, err := loadQuartier(ctx, tx, owner, time.Now())
	if err != nil {
		return publicQuartier{}, false, err
	}
	ok, err := mayVisit(ctx, tx, owner, auth.UserID(ctx), viewer, q.mode)
	if err != nil || !ok {
		return publicQuartier{}, false, err
	}
	return publicView(q, bs, first), true, nil
}

// quartierPublic: GET /quartiers/{simId} — a quartier as a visitor sees it (403 when friends only).
func (h *Handler) quartierPublic(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !quartierOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	v, ok, err := h.visitView(ctx, tx, chi.URLParam(r, "simId"), "")
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	case err != nil:
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	case !ok:
		httpx.Error(w, http.StatusForbidden, errFriendsOnly.Error())
		return
	}
	if tx.Commit(ctx) != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, v)
}

// quartierVisit: POST /sims/{id}/quartier/visit {owner} — the Sim visits a quartier: the owner's reputation
// grows (once a day for each visitor), the owner is told, and the visitor gets the public view.
func (h *Handler) quartierVisit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !quartierOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	var req struct {
		Owner string `json:"owner"`
	}
	if err := httpx.Decode(r, &req); err != nil || req.Owner == "" {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	var me, name string
	if err := h.DB.QueryRow(ctx, `SELECT id, first_name FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(ctx)).Scan(&me, &name); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	if me == req.Owner {
		httpx.Error(w, http.StatusUnprocessableEntity, errOwnQuartier.Error())
		return
	}
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	v, ok, err := h.visitView(ctx, tx, req.Owner, me)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	case err != nil:
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	case !ok:
		httpx.Error(w, http.StatusForbidden, errFriendsOnly.Error())
		return
	}
	first, err := recordVisit(ctx, tx, req.Owner, me, time.Now())
	if err != nil || tx.Commit(ctx) != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if first {
		v.Reputation += game.RepVisit
		if h.Notify != nil {
			h.Notify(req.Owner, map[string]any{"t": "quartier-visite", "from": me, "name": name})
		}
	}
	httpx.JSON(w, http.StatusOK, v)
}

// recordVisit: a visit written down; the first of the day by this visitor brings the owner reputation.
func recordVisit(ctx context.Context, tx pgx.Tx, owner, visitor string, now time.Time) (bool, error) {
	tag, err := tx.Exec(ctx, `INSERT INTO quartier_visits (owner, visitor, day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, owner, visitor, errandDay(now))
	if err != nil || tag.RowsAffected() == 0 {
		return false, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM quartier_visits WHERE owner = $1 AND day < $2`, owner, errandDay(now)-7); err != nil {
		return false, err
	}
	return true, quartierRep(ctx, tx, owner, game.RepVisit)
}

// hubCommune, hubEvent: GET /hub's shape.
type hubCommune struct {
	Commune    string   `json:"commune"`
	Name       string   `json:"name"`
	Online     int      `json:"online"`
	Highlights []string `json:"highlights"`
}

type hubEvent struct {
	Title   string    `json:"title"`
	At      time.Time `json:"at"`
	Commune string    `json:"commune"`
	Kind    string    `json:"kind"`
	Count   int       `json:"count"`
}

// hub: GET /hub — Babi en ligne: who plays now, in which commune, and what's on (the soirées thrown by
// players, the stadiums' matches and concerts, the street's happenings). Read on demand, nothing stored.
func (h *Handler) hub(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !quartierOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	out, err := h.hubNow(ctx, time.Now())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) hubNow(ctx context.Context, now time.Time) (map[string]any, error) {
	city, _ := world.FindCity("abidjan")
	online := 0
	if h.Online != nil {
		online = h.Online()
	}
	var in map[string]int
	if h.OnlineIn != nil {
		in = h.OnlineIn()
	}
	minute := game.MinuteOf(now)
	byID := map[string]*hubCommune{}
	communes := make([]*hubCommune, 0, len(city.Communes))
	for _, cm := range city.Communes {
		c := &hubCommune{Commune: cm.ID, Name: cm.Name, Online: in[city.ID+"|"+cm.ID], Highlights: []string{}}
		if hp, _, ok := game.HappeningAt(city.ID, cm.ID, minute); ok {
			c.Highlights = append(c.Highlights, hp.Label)
		}
		byID[cm.ID] = c
		communes = append(communes, c)
	}
	events := []hubEvent{}
	rows, err := h.DB.Query(ctx, `
		SELECT p.theme, h.first_name, p.commune, p.created_at, (SELECT count(*) FROM soiree_guests g WHERE g.soiree_id = p.id)
		FROM soirees p JOIN sims h ON h.id = p.host_sim WHERE p.city = $1 AND p.ends_at > $2 ORDER BY p.created_at DESC LIMIT 10`, city.ID, now)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var theme, host, commune string
		var at time.Time
		var n int
		if err := rows.Scan(&theme, &host, &commune, &at, &n); err != nil {
			rows.Close()
			return nil, err
		}
		label, _ := themeLabel(theme)
		if label == "" {
			label = "Soirée"
		}
		events = append(events, hubEvent{Title: fmt.Sprintf("%s chez %s", label, host), At: at, Commune: commune, Kind: "soiree", Count: n})
		if c := byID[commune]; c != nil {
			c.Highlights = append(c.Highlights, fmt.Sprintf("Soirée chez %s", host))
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for _, cm := range city.Communes {
		for _, p := range cm.Places {
			if p.Kind != game.StadiumKind {
				continue
			}
			for _, e := range game.StadiumAgenda(p.ID, minute, minute, minute+24*60) {
				events = append(events, hubEvent{Title: e.Title, At: game.TimeOf(e.Start), Commune: cm.ID, Kind: e.Kind, Count: in[city.ID+"|"+cm.ID]})
				if c := byID[cm.ID]; c != nil && e.Start-game.DoorsOpen <= minute {
					c.Highlights = append(c.Highlights, e.Title)
				}
			}
		}
	}
	sort.SliceStable(events, func(i, j int) bool { return events[i].At.Before(events[j].At) })
	if len(events) > 12 {
		events = events[:12]
	}
	sort.SliceStable(communes, func(i, j int) bool { return communes[i].Online > communes[j].Online })
	return map[string]any{"online": online, "communes": communes, "events": events}, nil
}

// quartierPlacePrefix: a building of a player's quartier as a place of the street (« quartier:<building id> »,
// web components/quartier/useQuartier.ts), where its owner and its visitors do what that kind of place offers.
const quartierPlacePrefix = "quartier:"

var errQuartierPlaceGone = errors.New("ce bâtiment n'est plus ouvert")

// quartierPlace: a quartier building an action is at, read before it (loadQuartierPlace).
type quartierPlace struct {
	id                            int64
	owner, ownerName, kind, label string
	city, commune                 string
	place                         game.PlaceKind
}

// loadQuartierPlace: the quartier building a place id names, onto the Sim (interactAt reads it): opened, of a
// kind with something to do inside, and the Sim allowed there (never across a block; friends only when the
// owner asks so). Nothing for any other place.
func loadQuartierPlace(ctx context.Context, tx pgx.Tx, s *Sim, placeID string) error {
	raw, ok := strings.CutPrefix(placeID, quartierPlacePrefix)
	if !ok {
		return nil
	}
	if !quartierOpen(ctx) {
		return errors.New("bientôt dans le jeu")
	}
	var p quartierPlace
	var opened bool
	var mode string
	err := tx.QueryRow(ctx, `
		SELECT b.id, b.sim_id, b.kind, b.opened, q.commune, q.visits_mode, o.first_name, o.home_city
		FROM quartier_buildings b JOIN quartiers q ON q.sim_id = b.sim_id JOIN sims o ON o.id = b.sim_id
		WHERE b.id::text = $1`, raw).Scan(&p.id, &p.owner, &p.kind, &opened, &p.commune, &mode, &p.ownerName, &p.city)
	if errors.Is(err, pgx.ErrNoRows) {
		return errQuartierPlaceGone
	}
	if err != nil {
		return err
	}
	k, ok := game.QuartierPlaceKind(p.kind)
	if !opened || !ok {
		return errQuartierPlaceGone
	}
	if p.owner != s.ID {
		may, err := mayVisit(ctx, tx, p.owner, auth.UserID(ctx), s.ID, mode)
		if err != nil {
			return err
		}
		if !may {
			return errFriendsOnly
		}
	}
	p.place = k
	if qk, ok := game.FindQuartierKind(p.kind); ok {
		p.label = qk.Label
	}
	s.qplace = &p
	return nil
}

// atQuartierPlace: the building's place kind for interactAt, and its name; the Sim must be in its commune.
func (s *Sim) atQuartierPlace(placeID string) (game.PlaceKind, string, error) {
	p := s.qplace
	if p == nil || quartierPlacePrefix+fmt.Sprint(p.id) != placeID {
		return game.PlaceKind{}, "", errQuartierPlaceGone
	}
	if p.city != s.City || p.commune != s.Commune {
		if _, cm, ok := world.FindCommune(p.city, p.commune); ok {
			return game.PlaceKind{}, "", fmt.Errorf("va d'abord %s", inCommune(cm.Name))
		}
		return game.PlaceKind{}, "", errQuartierPlaceGone
	}
	if p.owner == s.ID {
		return p.place, p.label, nil
	}
	return p.place, fmt.Sprintf("%s · %s", p.label, p.ownerName), nil
}

// quartierSale: a visitor paid at someone's quartier building: the owner's share waits in the building (collected
// like its takings, under the rents' daily limit), and the first purchase of the day by this buyer brings the
// owner reputation and a line in its journal.
func (h *Handler) quartierSale(ctx context.Context, tx pgx.Tx, s *Sim, it game.Interaction) error {
	p := s.qplace
	if p == nil || p.owner == s.ID {
		return nil
	}
	share := game.QuartierSale(it.Cost)
	if share <= 0 {
		return nil
	}
	if _, err := tx.Exec(ctx, `UPDATE quartier_buildings SET earnings_pending = earnings_pending + $2 WHERE id = $1`, p.id, share); err != nil {
		return err
	}
	now := time.Now()
	tag, err := tx.Exec(ctx, `INSERT INTO quartier_sales (owner, buyer, day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, p.owner, s.ID, errandDay(now))
	if err != nil || tag.RowsAffected() == 0 {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM quartier_sales WHERE owner = $1 AND day < $2`, p.owner, errandDay(now)-7); err != nil {
		return err
	}
	if err := quartierRep(ctx, tx, p.owner, game.RepSale); err != nil {
		return err
	}
	line := fmt.Sprintf("%s a payé chez toi (%s) : %s pour toi, à encaisser dans ton quartier.", s.FirstName, p.label, game.FCFA(share))
	return insertEvent(ctx, tx, p.owner, "money", line, 0, game.MinuteOf(now))
}

// areaQuartier, areaHome, areaView: GET /quartiers/{simId}/area's shape.
type areaQuartier struct {
	Owner     string `json:"owner"`
	OwnerName string `json:"ownerName"`
	Name      string `json:"name"`
	Level     int    `json:"level"`
	Center    latLng `json:"center"`
	Friend    bool   `json:"friend"`
	Mine      bool   `json:"mine"`
	// Locked: friends only, and not a friend (its buildings aren't shown, it can't be visited).
	Locked    bool             `json:"locked"`
	Buildings []publicBuilding `json:"buildings"`
}

type areaHome struct {
	Owner     string  `json:"owner"`
	OwnerName string  `json:"ownerName"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	Friend    bool    `json:"friend"`
	Mine      bool    `json:"mine"`
}

type areaView struct {
	Center    latLng         `json:"center"`
	Radius    int            `json:"radius"`
	Quartiers []areaQuartier `json:"quartiers"`
	Homes     []areaHome     `json:"homes"`
}

// Most other quartiers and homes the area lists (the nearest first).
const (
	areaQuartiers = 16
	areaHomes     = 40
)

// quartierArea: GET /quartiers/{simId}/area — the neighbourhood round a quartier, as the quartier view shows it:
// the other players' quartiers there (their buildings in its radius, none for a friends-only one of someone
// who isn't a friend) and the players' homes, never across a block. The commune's own places come with the
// game's world on the phone.
func (h *Handler) quartierArea(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !quartierOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	owner := chi.URLParam(r, "simId")
	var mode string
	if err := tx.QueryRow(ctx, `SELECT COALESCE((SELECT visits_mode FROM quartiers WHERE sim_id = $1), 'tous') FROM sims WHERE id = $1`, owner).Scan(&mode); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	if ok, err := mayVisit(ctx, tx, owner, auth.UserID(ctx), "", mode); err != nil || !ok {
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		} else {
			httpx.Error(w, http.StatusForbidden, errFriendsOnly.Error())
		}
		return
	}
	q, err := ensureQuartier(ctx, tx, owner)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	v, err := areaOf(ctx, tx, q, auth.UserID(ctx))
	if err != nil || tx.Commit(ctx) != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, v)
}

// areaOf: the quartiers and homes round q seen by a player (its friends, its own other Sims; nobody it blocked or
// who blocked it). Read only: a neighbour's v1 buildings are shown on their lot without being moved.
func areaOf(ctx context.Context, tx pgx.Tx, q quartierRow, user string) (areaView, error) {
	r := float64(game.QuartierRadius)
	dLat := r / 111320
	cos := math.Cos(q.lat * math.Pi / 180)
	dLng := r / (111320 * cos)
	v := areaView{Center: latLng{q.lat, q.lng}, Radius: game.QuartierRadius, Quartiers: []areaQuartier{}, Homes: []areaHome{}}
	// (Their centre up to 350 m beyond the edge: their outer lots may still fall in this quartier.)
	const reach = 350.0 / 111320
	rows, err := tx.Query(ctx, `
		SELECT o.sim_id, s.first_name, o.name, o.level, o.visits_mode, o.center_lat, o.center_lng, s.user_id::text = $5,
		       EXISTS(SELECT 1 FROM sims v JOIN bonds b ON b.sim_a = LEAST(v.id, o.sim_id) AND b.sim_b = GREATEST(v.id, o.sim_id) AND b.friends WHERE v.user_id::text = $5)
		FROM quartiers o JOIN sims s ON s.id = o.sim_id
		WHERE o.commune = $1 AND o.sim_id::text <> $2 AND abs(o.center_lat - $3) < $6 AND abs(o.center_lng - $4) < $7
		  AND NOT EXISTS(SELECT 1 FROM blocks k JOIN sims v ON v.user_id::text = $5 WHERE (k.sim = o.sim_id AND k.blocked = v.id) OR (k.sim = v.id AND k.blocked = o.sim_id))
		ORDER BY (o.center_lat - $3)^2 + ((o.center_lng - $4) * $8)^2 LIMIT $9`,
		q.commune, q.sim, q.lat, q.lng, user, dLat+reach, dLng+reach/cos, cos, areaQuartiers)
	if err != nil {
		return v, err
	}
	rowsOf := map[string]quartierRow{}
	for rows.Next() {
		var a areaQuartier
		var o quartierRow
		if err := rows.Scan(&a.Owner, &a.OwnerName, &a.Name, &a.Level, &o.mode, &o.lat, &o.lng, &a.Mine, &a.Friend); err != nil {
			rows.Close()
			return v, err
		}
		o.sim = a.Owner
		a.Center = latLng{o.lat, o.lng}
		a.Locked = o.mode == "amis" && !a.Friend && !a.Mine
		a.Buildings = []publicBuilding{}
		rowsOf[a.Owner] = o
		v.Quartiers = append(v.Quartiers, a)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return v, err
	}
	for i := range v.Quartiers {
		a := &v.Quartiers[i]
		if a.Locked {
			continue
		}
		o := rowsOf[a.Owner]
		brows, err := tx.Query(ctx, `SELECT id, kind, slot, lat, lng, heading, level, staff, opened, layout FROM quartier_buildings WHERE sim_id = $1 ORDER BY slot`, a.Owner)
		if err != nil {
			return v, err
		}
		for brows.Next() {
			var b publicBuilding
			var heading float32
			var layout int
			if err := brows.Scan(&b.ID, &b.Kind, &b.Slot, &b.Lat, &b.Lng, &heading, &b.Level, &b.Staff, &b.Opened, &layout); err != nil {
				brows.Close()
				return v, err
			}
			b.Lot, b.Heading = b.Slot, float64(heading)
			if layout < game.QuartierLotLayout {
				b.Lat, b.Lng, b.Heading = o.slotSpot(b.Slot)
			}
			if e, n := game.MetresFrom(q.lat, q.lng, b.Lat, b.Lng); math.Hypot(e, n) > r {
				continue
			}
			if k, ok := game.FindQuartierKind(b.Kind); ok {
				b.Label, b.Icon = k.Label, k.Icon
			}
			a.Buildings = append(a.Buildings, b)
		}
		brows.Close()
		if err := brows.Err(); err != nil {
			return v, err
		}
	}
	hrows, err := tx.Query(ctx, `
		SELECT s.id, s.first_name, p.lot_lat, p.lot_lng, s.user_id::text = $5,
		       EXISTS(SELECT 1 FROM sims v JOIN bonds b ON b.sim_a = LEAST(v.id, s.id) AND b.sim_b = GREATEST(v.id, s.id) AND b.friends WHERE v.user_id::text = $5)
		FROM sims s JOIN plots p ON p.id = s.home_plot
		WHERE p.lot_commune = $1 AND s.id::text <> $2 AND p.lot_lat IS NOT NULL AND abs(p.lot_lat - $3) < $6 AND abs(p.lot_lng - $4) < $7
		  AND NOT EXISTS(SELECT 1 FROM blocks k JOIN sims v ON v.user_id::text = $5 WHERE (k.sim = s.id AND k.blocked = v.id) OR (k.sim = v.id AND k.blocked = s.id))
		ORDER BY (p.lot_lat - $3)^2 + ((p.lot_lng - $4) * $8)^2 LIMIT $9`,
		q.commune, q.sim, q.lat, q.lng, user, dLat, dLng, cos, areaHomes)
	if err != nil {
		return v, err
	}
	defer hrows.Close()
	for hrows.Next() {
		var a areaHome
		if err := hrows.Scan(&a.Owner, &a.OwnerName, &a.Lat, &a.Lng, &a.Mine, &a.Friend); err != nil {
			return v, err
		}
		v.Homes = append(v.Homes, a)
	}
	return v, hrows.Err()
}
