package sims

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

var (
	errTooYoungForLot = errors.New("on achète un terrain à 18 ans : d'ici là, tu vis chez tes parents")
	errLotNotBigger   = errors.New("choisis un terrain plus grand que le tien")
	errNoSuchLot      = errors.New("terrain inconnu")
	errMoveInArrears  = errors.New("règle d'abord tes arriérés de loyer avant de déménager")
	errAlreadyHome    = errors.New("tu habites déjà ta maison")
	errNoSuchPlan     = errors.New("plan inconnu")
	errLivesThere     = errors.New("tu habites cette maison : déménage d'abord pour la démolir")
	errChantier       = errors.New("le chantier n'est pas fini")
	errNoSuchCommune  = errors.New("commune inconnue")
	errSellHome       = errors.New("tu habites cette maison : déménage d'abord pour la vendre")
	errTwoInCommune   = fmt.Errorf("deux terrains au plus dans une même commune : agrandis-en un, ou vends-en un")
	errManyLots       = fmt.Errorf("%d terrains au plus en tout : vends-en un d'abord", MaxLots)
)

// One's own houses (game/house.go): from 18 the Sim buys lots in any commune
// of any town (from the phone, without going there first: one buys land from
// afar), two at most in a commune; builds on each block by block, furnishes
// it, and moves into one (sims.home_plot): the others stand empty, to sell or
// to let. Others in the commune see the houses on their lots.

const (
	// MaxLotsInCommune: a Sim's lots in one commune; MaxLots: in all.
	MaxLotsInCommune = 2
	MaxLots          = 8
)

// Lot is the land a Sim owns.
type Lot struct {
	W       int    `json:"w"`
	D       int    `json:"d"`
	Area    int    `json:"area"`
	City    string `json:"city"`
	Commune string `json:"commune"`
	Paid    int    `json:"paid"`
	// Lat, Lng: where the player set it on the map (an update: lot-carte); none, the spot the game drew (world3d lotSpot).
	Lat *float64 `json:"lat,omitempty"`
	Lng *float64 `json:"lng,omitempty"`
}

type Plot struct {
	// ID: the lot's own; Key: where it stands in the commune (world3d lotSpot): the Sim's id for its
	// first lot (where its single lot always stood), « sim:id » for the others.
	ID        int64        `json:"id"`
	Key       string       `json:"key"`
	SimID     string       `json:"simId"`
	FirstName string       `json:"firstName,omitempty"`
	Blocks    []game.Block `json:"blocks"`
	Furniture []game.Piece `json:"furniture"`
	Zones     []game.Zone  `json:"zones"`
	Built     int          `json:"built"`
	Lot       *Lot         `json:"lot"`
	// Livable: a covered bed and toilets; Home: the Sim lives there.
	Livable bool `json:"livable"`
	Home    bool `json:"home"`
	// BuildFrom, BuildUntil: a house from a plan going up (its building site, on its own: the Sim is free).
	BuildFrom  *time.Time `json:"buildFrom,omitempty"`
	BuildUntil *time.Time `json:"buildUntil,omitempty"`
}

// building: the masons still at it, and how many minutes are left.
func (p Plot) building(now time.Time) (bool, int) {
	if p.BuildUntil == nil || !now.Before(*p.BuildUntil) {
		return false, 0
	}
	return true, int(p.BuildUntil.Sub(now).Minutes()) + 1
}

// chantierErr: why the house can't be lived in or changed yet.
func chantierErr(left int) error {
	return fmt.Errorf("%w : encore %d min, les maçons travaillent", errChantier, left)
}

func (p Plot) house() game.House {
	h := game.House{Blocks: p.Blocks, Furniture: p.Furniture, Zones: p.Zones, Built: p.Built}
	if p.Lot != nil {
		h.W, h.D = p.Lot.W, p.Lot.D
	}
	return h
}

// bare: nothing built or furnished on it.
func (p Plot) bare() bool { return len(p.Blocks) == 0 && len(p.Furniture) == 0 && len(p.Zones) == 0 }

// plotColumns, then the key and whether it's the home (p for plots, s for its Sim).
const plotColumns = `p.id, p.sim_id, p.blocks, p.built, p.furniture, p.zones, p.lot_w, p.lot_d, p.lot_city, p.lot_commune, p.lot_paid, p.lot_lat, p.lot_lng,
	CASE WHEN p.id = (SELECT min(q.id) FROM plots q WHERE q.sim_id = p.sim_id) THEN p.sim_id::text ELSE p.sim_id::text || ':' || p.id END,
	COALESCE(s.home_plot = p.id AND s.housing = '` + game.OwnHouse + `', false), p.build_from, p.build_until`

func scanPlot(row pgx.Row, extra ...any) (Plot, error) {
	var p Plot
	var l Lot
	err := row.Scan(append([]any{&p.ID, &p.SimID, &p.Blocks, &p.Built, &p.Furniture, &p.Zones, &l.W, &l.D, &l.City, &l.Commune, &l.Paid, &l.Lat, &l.Lng, &p.Key, &p.Home, &p.BuildFrom, &p.BuildUntil}, extra...)...)
	if err == nil && l.W > 0 {
		l.Area = l.W * l.D
		p.Lot = &l
	}
	p.Livable = p.house().Livable()
	return p, err
}

type queryer interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

// loadLots: all of a Sim's lots, oldest first.
func loadLots(ctx context.Context, q queryer, simID string) ([]Plot, error) {
	rows, err := q.Query(ctx, `SELECT `+plotColumns+` FROM plots p JOIN sims s ON s.id = p.sim_id WHERE p.sim_id = $1 AND p.lot_w > 0 ORDER BY p.id`, simID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Plot{}
	for rows.Next() {
		p, err := scanPlot(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// loadPlot: one of the Sim's lots (lot 0: the one it lives in, else its first); an empty Plot when it has none.
func loadPlot(ctx context.Context, q queryer, simID string, lot int64, lock bool) (Plot, error) {
	query := `SELECT ` + plotColumns + ` FROM plots p JOIN sims s ON s.id = p.sim_id WHERE p.sim_id = $1 AND ($2 = 0 OR p.id = $2)
		ORDER BY (s.home_plot = p.id) DESC NULLS LAST, p.id LIMIT 1`
	if lock {
		query += ` FOR UPDATE OF p`
	}
	p, err := scanPlot(q.QueryRow(ctx, query, simID, lot))
	if errors.Is(err, pgx.ErrNoRows) {
		if lot != 0 {
			return Plot{}, errNoSuchLot
		}
		return Plot{SimID: simID, Blocks: []game.Block{}, Furniture: []game.Piece{}, Zones: []game.Zone{}}, nil
	}
	return p, err
}

// savePlot: a new lot gets its id here.
func savePlot(ctx context.Context, tx pgx.Tx, p *Plot) error {
	l := p.Lot
	if l == nil {
		l = &Lot{}
	}
	if p.Blocks == nil {
		p.Blocks = []game.Block{}
	}
	if p.Furniture == nil {
		p.Furniture = []game.Piece{}
	}
	if p.Zones == nil {
		p.Zones = []game.Zone{}
	}
	if p.ID == 0 {
		return tx.QueryRow(ctx, `
			INSERT INTO plots (sim_id, blocks, built, furniture, zones, lot_w, lot_d, lot_city, lot_commune, lot_paid, lot_lat, lot_lng, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now()) RETURNING id`,
			p.SimID, p.Blocks, p.Built, p.Furniture, p.Zones, l.W, l.D, l.City, l.Commune, l.Paid, l.Lat, l.Lng).Scan(&p.ID)
	}
	_, err := tx.Exec(ctx, `UPDATE plots SET blocks = $2, built = $3, furniture = $4, zones = $5, lot_w = $6, lot_d = $7,
		lot_city = $8, lot_commune = $9, lot_paid = $10, lot_lat = $11, lot_lng = $12, updated_at = now() WHERE id = $1`,
		p.ID, p.Blocks, p.Built, p.Furniture, p.Zones, l.W, l.D, l.City, l.Commune, l.Paid, l.Lat, l.Lng)
	return err
}

// latLng: where a lot was set (nil when the game drew its spot, or no lot).
func (l *Lot) latLng() (*float64, *float64) {
	if l == nil {
		return nil, nil
	}
	return l.Lat, l.Lng
}

var (
	errSpotFar   = errors.New("choisis un endroit dans la commune")
	errSpotTaken = errors.New("ce coin est déjà pris : choisis un peu plus loin")
	errNotBare   = errors.New("on ne déplace qu'un terrain vide : il y a déjà une maison dessus")
)

const (
	// spotReach: how far from the commune's centre a lot may be set; spotGap: how close to another one.
	spotReach = 6000.0
	spotGap   = 30.0
)

// spotFree: the spot is in the commune, and no other lot set on the map stands too close (not `except`, the lot moved).
func spotFree(ctx context.Context, q queryer, city, commune string, lat, lng float64, except int64) error {
	_, cm, ok := world.FindCommune(city, commune)
	if !ok {
		return errNoSuchCommune
	}
	if math.IsNaN(lat) || math.IsNaN(lng) || metres(cm.Lat, cm.Lng, lat, lng) > spotReach {
		return errSpotFar
	}
	rows, err := q.Query(ctx, `SELECT lot_lat, lot_lng FROM plots WHERE lot_city = $1 AND lot_commune = $2 AND lot_lat IS NOT NULL AND lot_w > 0 AND id <> $3`, city, commune, except)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var a, b float64
		if rows.Scan(&a, &b) == nil && metres(a, b, lat, lng) < spotGap {
			return errSpotTaken
		}
	}
	return rows.Err()
}

// metres between two points (close together: flat enough).
func metres(lat1, lng1, lat2, lng2 float64) float64 {
	const r = 6371000.0
	dy := (lat2 - lat1) * math.Pi / 180 * r
	dx := (lng2 - lng1) * math.Pi / 180 * r * math.Cos((lat1+lat2)/2*math.Pi/180)
	return math.Hypot(dx, dy)
}

// moveLot: POST /sims/{id}/lot/move {lot, lat, lng} — an empty lot set somewhere else on the map (an update: lot-carte).
func (h *Handler) moveLot(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Lot int64   `json:"lot"`
		Lat float64 `json:"lat"`
		Lng float64 `json:"lng"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if features.Default.BlocksKey(r.Context(), "lot-carte") != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		lots, err := loadLots(ctx, tx, s.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		for _, p := range lots {
			if p.ID != req.Lot {
				continue
			}
			if !p.bare() || p.BuildUntil != nil {
				return game.Outcome{}, nil, errNotBare
			}
			if err := spotFree(ctx, tx, p.Lot.City, p.Lot.Commune, req.Lat, req.Lng, p.ID); err != nil {
				return game.Outcome{}, nil, err
			}
			p.Lot.Lat, p.Lot.Lng = &req.Lat, &req.Lng
			if err := savePlot(ctx, tx, &p); err != nil {
				return game.Outcome{}, nil, err
			}
			return game.Outcome{Text: "Ton terrain est à sa nouvelle place. À toi de bâtir !"}, nil, nil
		}
		return game.Outcome{}, nil, errNoSuchLot
	})
}

// lotSpots: GET /sims/{id}/lots/spots?city=&commune= — the lots of a commune, for the map where one picks a spot:
// where each is (set on the map, or its key, for the spot the game draws), its size, and the player's own.
func (h *Handler) lotSpots(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	city, commune := r.URL.Query().Get("city"), r.URL.Query().Get("commune")
	if _, _, ok := world.FindCommune(city, commune); !ok {
		httpx.Error(w, http.StatusNotFound, errNoSuchCommune.Error())
		return
	}
	rows, err := h.DB.Query(r.Context(), `
		SELECT `+plotColumns+` FROM plots p JOIN sims s ON s.id = p.sim_id
		WHERE p.lot_city = $1 AND p.lot_commune = $2 AND p.lot_w > 0 LIMIT 400`, city, commune)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	type spot struct {
		Key  string   `json:"key"`
		Lat  *float64 `json:"lat,omitempty"`
		Lng  *float64 `json:"lng,omitempty"`
		W    int      `json:"w"`
		D    int      `json:"d"`
		Mine bool     `json:"mine,omitempty"`
		Lot  int64    `json:"lot,omitempty"`
		Bare bool     `json:"bare,omitempty"`
	}
	out := []spot{}
	for rows.Next() {
		p, err := scanPlot(rows)
		if err != nil || p.Lot == nil {
			continue
		}
		sp := spot{Key: p.Key, Lat: p.Lot.Lat, Lng: p.Lot.Lng, W: p.Lot.W, D: p.Lot.D}
		if p.SimID == id {
			sp.Mine, sp.Lot, sp.Bare = true, p.ID, p.bare() && p.BuildUntil == nil
		}
		out = append(out, sp)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// lotParam: ?lot= (0 when absent: the home, or the first lot).
func lotParam(r *http.Request) int64 {
	n, _ := strconv.ParseInt(r.URL.Query().Get("lot"), 10, 64)
	return n
}

// plot: GET /sims/{id}/plot[?lot=] — one of the player's lots and its house.
func (h *Handler) plot(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	p, err := loadPlot(r.Context(), h.DB, id, lotParam(r), false)
	if errors.Is(err, errNoSuchLot) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

// LotOffer is a lot for sale in a commune: a new one, or one of the Sim's made bigger (Upgrade: that lot's id).
type LotOffer struct {
	game.LotSize
	Area     int    `json:"area"`
	Price    int    `json:"price"`
	PerM2    int    `json:"perM2"`
	City     string `json:"city"`
	Commune  string `json:"commune"`
	Name     string `json:"name"`
	Upgrade  int64  `json:"upgrade,omitempty"`
	Payable  int    `json:"payable"` // what it costs now (an enlarged lot: the difference)
	Possible bool   `json:"possible"`
}

// lotsWhere: the commune a lot is looked for in (?city=&commune=, or the body's): where the Sim is when none is given.
func lotsWhere(s *Sim, city, commune string) (string, string, error) {
	if city == "" && commune == "" {
		return s.City, s.Commune, nil
	}
	if _, _, ok := world.FindCommune(city, commune); !ok {
		return "", "", errNoSuchCommune
	}
	return city, commune, nil
}

// offers: the new lots one can buy in a commune (none past two there, or past MaxLots in all), and,
// for each lot one has there, the bigger sizes it can grow to (the house on it must fit).
func offers(lots []Plot, city, commune string) []LotOffer {
	name := commune
	if _, cm, ok := world.FindCommune(city, commune); ok {
		name = cm.Name
	}
	perM2, ok := game.LotPricePerM2[commune]
	if !ok {
		perM2 = game.DefaultLotPrice
	}
	var here []Plot
	for _, p := range lots {
		if p.Lot != nil && p.Lot.City == city && p.Lot.Commune == commune {
			here = append(here, p)
		}
	}
	room := len(here) < MaxLotsInCommune && len(lots) < MaxLots
	out := make([]LotOffer, 0, len(game.LotSizes))
	for _, l := range game.LotSizes {
		o := LotOffer{LotSize: l, Area: l.Area(), Price: game.LotPrice(commune, l), PerM2: perM2, City: city, Commune: commune, Name: name}
		o.Payable, o.Possible = o.Price, room
		out = append(out, o)
		for _, p := range here {
			if l.Area() > p.Lot.Area && p.house().Fits(l.W, l.D) {
				g := o
				g.Upgrade, g.Payable, g.Possible = p.ID, max(0, o.Price-p.Lot.Paid), true
				out = append(out, g)
			}
		}
	}
	return out
}

// lotOffers: GET /sims/{id}/lots[?city=&commune=] — the lots for sale in a commune (where the Sim is by default), and its own.
func (h *Handler) lotOffers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	s, err := scanSim(h.DB.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1`, id))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	lots, err := loadLots(ctx, h.DB, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	city, commune, err := lotsWhere(&s, r.URL.Query().Get("city"), r.URL.Query().Get("commune"))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"offers": offers(lots, city, commune), "lots": lots, "fees": game.LotFees, "adult": !s.minor(),
		"perCommune": MaxLotsInCommune, "max": MaxLots})
}

// buyLot: POST /sims/{id}/lot {size, city, commune[, upgrade]} — a new lot in a commune (where the Sim is
// by default), or one of its lots made bigger (upgrade: its id; the house stays, the difference is paid).
func (h *Handler) buyLot(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Size    string `json:"size"`
		City    string `json:"city"`
		Commune string `json:"commune"`
		Upgrade int64  `json:"upgrade"`
		// Where on the map (an update: lot-carte); none, the game draws a spot.
		Lat *float64 `json:"lat"`
		Lng *float64 `json:"lng"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if features.Default.BlocksKey(r.Context(), "lot-carte") != "" {
		req.Lat, req.Lng = nil, nil
	}
	size, ok := game.FindLotSize(req.Size)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, errNoSuchLot.Error())
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if s.minor() {
			return game.Outcome{}, nil, errTooYoungForLot
		}
		if _, err := tx.Exec(ctx, `SELECT 1 FROM plots WHERE sim_id = $1 FOR UPDATE`, s.ID); err != nil {
			return game.Outcome{}, nil, err
		}
		lots, err := loadLots(ctx, tx, s.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		city, commune, err := lotsWhere(s, req.City, req.Commune)
		if req.Upgrade != 0 {
			// Growing a lot: it's where it is.
			for _, p := range lots {
				if p.ID == req.Upgrade {
					city, commune, err = p.Lot.City, p.Lot.Commune, nil
				}
			}
		}
		if err != nil {
			return game.Outcome{}, nil, err
		}
		var offer *LotOffer
		for _, o := range offers(lots, city, commune) {
			if o.ID == size.ID && o.Upgrade == req.Upgrade {
				offer = &o
			}
		}
		switch {
		case offer == nil && req.Upgrade != 0:
			return game.Outcome{}, nil, errLotNotBigger
		case offer == nil:
			return game.Outcome{}, nil, errNoSuchLot
		case !offer.Possible && len(lots) >= MaxLots:
			return game.Outcome{}, nil, errManyLots
		case !offer.Possible:
			return game.Outcome{}, nil, errTwoInCommune
		case offer.Payable > s.Money:
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		p := Plot{SimID: s.ID}
		if req.Upgrade != 0 {
			for _, q := range lots {
				if q.ID == req.Upgrade {
					p = q
				}
			}
		}
		// A new lot where the player put it (a bigger one stays where it was).
		lat, lng := p.Lot.latLng()
		if req.Upgrade == 0 && req.Lat != nil && req.Lng != nil {
			if err := spotFree(ctx, tx, city, commune, *req.Lat, *req.Lng, 0); err != nil {
				return game.Outcome{}, nil, err
			}
			lat, lng = req.Lat, req.Lng
		}
		s.Money -= offer.Payable
		p.Lot = &Lot{W: size.W, D: size.D, Area: size.Area(), City: city, Commune: commune, Paid: offer.Price, Lat: lat, Lng: lng}
		if err := savePlot(ctx, tx, &p); err != nil {
			return game.Outcome{}, nil, err
		}
		text := fmt.Sprintf("Terrain acheté %s : %s de %d m² (%d × %d m), ACD et notaire compris. À toi de bâtir !", inCommune(offer.Name), game.LowerFirst(size.Label), size.Area(), size.W, size.D)
		if req.Upgrade != 0 {
			text = fmt.Sprintf("Ton terrain s'agrandit : %d m² %s. Ta maison reste debout.", size.Area(), inCommune(offer.Name))
		}
		return game.Outcome{Text: text, Money: -offer.Payable}, []Event{{Kind: "bill", Text: text, Money: -offer.Payable, GameTime: s.GameMinutes}}, nil
	})
}

// sellLot: POST /sims/{id}/lot/sell {lot} — a lot sold back: 90 % of what it cost, and half of the house on it.
// Not the one the Sim lives in.
func (h *Handler) sellLot(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Lot int64 `json:"lot"`
	}
	if err := httpx.Decode(r, &req); err != nil || req.Lot == 0 {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		p, err := loadPlot(ctx, tx, s.ID, req.Lot, true)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if p.Home {
			return game.Outcome{}, nil, errSellHome
		}
		back := p.Lot.Paid*9/10 + game.PlanRefund(p.house())
		if _, err := tx.Exec(ctx, `DELETE FROM plots WHERE id = $1`, p.ID); err != nil {
			return game.Outcome{}, nil, err
		}
		_, _ = tx.Exec(ctx, `UPDATE sims SET home_plot = NULL WHERE id = $1 AND home_plot = $2`, s.ID, p.ID)
		s.Money += back
		text := fmt.Sprintf("Terrain vendu %s : %s pour toi.", inCommune(communeName(p.Lot.City, p.Lot.Commune)), game.FCFA(back))
		return game.Outcome{Text: text, Money: back}, []Event{{Kind: "bill", Text: text, Money: back, GameTime: s.GameMinutes}}, nil
	})
}

// build: PUT /sims/{id}/plot {lot, place, remove, furnish, unfurnish} — blocks and furniture on one of the lots.
func (h *Handler) build(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Lot       int64        `json:"lot"`
		Place     []game.Block `json:"place"`
		Remove    []game.Block `json:"remove"`
		Furnish   []game.Piece `json:"furnish"`
		Unfurnish []game.Piece `json:"unfurnish"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if s.minor() {
			return game.Outcome{}, nil, errTooYoungForLot
		}
		ctx := r.Context()
		p, err := loadPlot(ctx, tx, s.ID, req.Lot, true)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if on, left := p.building(time.Now()); on {
			return game.Outcome{}, nil, chantierErr(left)
		}
		house, placed, cost, err := p.house().Edit(req.Place, req.Remove, req.Furnish, req.Unfurnish)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if cost > s.Money {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		s.Money -= cost
		p.Blocks, p.Furniture, p.Built = house.Blocks, house.Furniture, house.Built
		if err := savePlot(ctx, tx, &p); err != nil {
			return game.Outcome{}, nil, err
		}
		// The furniture one lives with: only the house one lives in.
		if p.Home {
			s.Furnished = house.Has()
		}
		text := "Le chantier avance."
		switch {
		case len(req.Furnish) > 0 && placed == 0:
			text = "Les meubles sont installés."
		case placed == 0 && cost < 0:
			text = "Démoli : la moitié revendue."
		}
		return game.Outcome{Text: text, Money: -cost}, nil, nil
	})
}

// buildPlan: POST /sims/{id}/plot/plan {lot, plan | clear} — a whole house from a plan on an
// empty lot, paid in one go; or everything on the lot taken down: half sold back.
func (h *Handler) buildPlan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Lot   int64  `json:"lot"`
		Plan  string `json:"plan"`
		Clear bool   `json:"clear"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if s.minor() {
			return game.Outcome{}, nil, errTooYoungForLot
		}
		ctx := r.Context()
		p, err := loadPlot(ctx, tx, s.ID, req.Lot, true)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if req.Clear {
			if p.Home {
				return game.Outcome{}, nil, errLivesThere
			}
			back := game.PlanRefund(p.house())
			s.Money += back
			p.Blocks, p.Furniture, p.Zones = nil, nil, nil
			if err := savePlot(ctx, tx, &p); err != nil {
				return game.Outcome{}, nil, err
			}
			text := "Tout est démoli : le terrain est nu, la moitié des matériaux et des meubles revendue."
			return game.Outcome{Text: text, Money: back}, nil, nil
		}
		pl, ok := game.FindLotPlan(req.Plan)
		if !ok {
			return game.Outcome{}, nil, errNoSuchPlan
		}
		house, err := p.house().BuildPlan(pl)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if pl.Cost > s.Money {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		s.Money -= pl.Cost
		p.Blocks, p.Furniture, p.Zones, p.Built = house.Blocks, house.Furniture, house.Zones, house.Built
		if err := savePlot(ctx, tx, &p); err != nil {
			return game.Outcome{}, nil, err
		}
		if p.Home {
			s.Furnished = house.Has()
		}
		// The masons raise it on the lot over time; the Sim isn't held there: it's the house
		// being built, not the Sim (it's free to go where it likes meanwhile).
		minutes := game.ChantierMinutes(len(house.Blocks))
		if _, err := tx.Exec(ctx, `UPDATE plots SET build_from = now(), build_until = now() + $2 * interval '1 minute' WHERE id = $1`, p.ID, minutes); err != nil {
			return game.Outcome{}, nil, err
		}
		text := fmt.Sprintf("%s : le chantier commence, les maçons montent ta maison (fini dans %d min). Toi, tu es libre en attendant.", pl.Label, minutes)
		m := houseMoment(s, false, p.Lot.City, p.Lot.Commune)
		return game.Outcome{Text: text, Money: -pl.Cost}, []Event{{Kind: "bill", Text: text, Money: -pl.Cost, GameTime: s.GameMinutes, moment: &m}}, nil
	})
}

// moveIn: POST /sims/{id}/plot/movein {lot} — the Sim leaves its rented room (or its other house) for one it built.
func (h *Handler) moveIn(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Lot int64 `json:"lot"`
	}
	_ = httpx.Decode(r, &req)
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		ctx := r.Context()
		p, err := loadPlot(ctx, tx, s.ID, req.Lot, false)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		switch {
		case p.Lot == nil:
			return game.Outcome{}, nil, game.ErrNoLot
		case p.Home:
			return game.Outcome{}, nil, errAlreadyHome
		case !p.house().Livable():
			return game.Outcome{}, nil, game.ErrNotLivable
		case p.BuildUntil != nil && time.Now().Before(*p.BuildUntil):
			_, left := p.building(time.Now())
			return game.Outcome{}, nil, chantierErr(left)
		case s.RentArrears > 0:
			return game.Outcome{}, nil, errMoveInArrears
		case s.Activity != nil:
			return game.Outcome{}, nil, game.ErrBusy
		}
		if _, err := tx.Exec(ctx, `UPDATE sims SET home_plot = $2 WHERE id = $1`, s.ID, p.ID); err != nil {
			return game.Outcome{}, nil, err
		}
		// One doesn't let the house one lives in (Dodo).
		_, _ = tx.Exec(ctx, `DELETE FROM dodo_listings WHERE plot_id = $1`, p.ID)
		s.Housing, s.HomeCity, s.HomeCommune = game.OwnHouse, p.Lot.City, p.Lot.Commune
		s.Furnished = p.house().Has()
		text := fmt.Sprintf("Tu emménages dans ta maison %s ! Plus de loyer : tu es chez toi.", inCommune(communeName(p.Lot.City, p.Lot.Commune)))
		m := houseMoment(s, true, p.Lot.City, p.Lot.Commune)
		return game.Outcome{Text: text}, []Event{{Kind: "life", Text: text, GameTime: s.GameMinutes, moment: &m}}, nil
	})
}

// plots: GET /sims/{id}/plots — the houses on the lots of the commune where
// this Sim is now (the player's own included).
func (h *Handler) plots(w http.ResponseWriter, r *http.Request) {
	_, city, commune, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	rows, err := h.DB.Query(r.Context(), `
		SELECT `+plotColumns+`, s.first_name FROM plots p JOIN sims s ON s.id = p.sim_id
		WHERE p.lot_city = $1 AND p.lot_commune = $2 AND p.lot_w > 0
		ORDER BY p.updated_at DESC LIMIT 40`, city, commune)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	out := []Plot{}
	for rows.Next() {
		var name string
		if p, err := scanPlot(rows, &name); err == nil {
			p.FirstName = name
			out = append(out, p)
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}
