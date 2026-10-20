package game

import (
	"encoding/json"
	"errors"
	"sort"
)

// House plans: real houses with their rooms (the bedroom, the shower, the
// living room, the kitchen), their courtyard or garden, and for the rich a
// pool. The same plans make the home a Sim grows up in (a shack for the
// gnambro, a room in a cour commune, an apartment, a villa with its pool for
// the debout) and the houses one can build on a bought lot in one go
// (BuildPlan), then change block by block. A plan is blocks and furniture like
// any house, plus its zones: the floor of each room, the yard, the garden,
// the pool, drawn flat on the ground (the pool as a raised basin).

// Zone is a stretch of ground in a house: x, z of its corner, w × d cells,
// its kind and, for a room, its name. In JSON: [x, z, w, d, "kind", "label"].
type Zone struct {
	X, Z, W, D int
	K, L       string
}

// Zone kinds.
const (
	ZoneFloor    = "sol"      // a room's tiled floor (L: its name)
	ZoneConcrete = "beton"    // a poor room's concrete floor
	ZoneYard     = "cour"     // beaten earth
	ZoneGarden   = "jardin"   // lawn, flowers, a tree or two
	ZoneTerrace  = "terrasse" // tiled, in the open
	ZonePool     = "piscine"  // a raised basin of water, tiled round
)

// ZonePrice: Djai a square metre, when a plan is built (the rest is free ground).
var ZonePrice = map[string]int{ZoneFloor: 1500, ZoneConcrete: 500, ZoneTerrace: 2000, ZoneGarden: 1000, ZonePool: 40000}

func (z Zone) MarshalJSON() ([]byte, error) { return json.Marshal([]any{z.X, z.Z, z.W, z.D, z.K, z.L}) }

func (z *Zone) UnmarshalJSON(data []byte) error {
	var raw []json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil || len(raw) < 5 {
		return errors.New("zone invalide")
	}
	for i, p := range []*int{&z.X, &z.Z, &z.W, &z.D} {
		if err := json.Unmarshal(raw[i], p); err != nil {
			return errors.New("zone invalide")
		}
	}
	if err := json.Unmarshal(raw[4], &z.K); err != nil {
		return err
	}
	if len(raw) > 5 {
		return json.Unmarshal(raw[5], &z.L)
	}
	return nil
}

// Plan is a whole house, ready to draw or to build.
type Plan struct {
	ID        string  `json:"id"`
	Label     string  `json:"label"`
	Hint      string  `json:"hint"`
	W         int     `json:"w"`
	D         int     `json:"d"`
	Rooms     int     `json:"rooms"` // bedrooms
	Pool      bool    `json:"pool"`
	Blocks    []Block `json:"blocks"`
	Furniture []Piece `json:"furniture"`
	Zones     []Zone  `json:"zones"`
	// Lot: a plan one can build on a bought lot (else, a home one is born in).
	Lot  bool `json:"lot"`
	Cost int  `json:"cost"`
}

// planner lays a plan out: x across the lot, z from the back (0) to the
// street (D-1), y up; the house faces the street.
type planner struct {
	w, d  int
	g     map[cell]string
	furn  []Piece
	zones []Zone
}

func newPlanner(w, d int) *planner { return &planner{w: w, d: d, g: map[cell]string{}} }

func (p *planner) set(x, y, z int, m string) {
	if x >= 0 && x < p.w && z >= 0 && z < p.d && y >= 0 && y < PlotH {
		p.g[cell{x, y, z}] = m
	}
}

// walls: the outline of the rectangle x0..x1 × z0..z1 (inclusive), h high.
func (p *planner) walls(x0, z0, x1, z1, h int, m string) {
	for y := 0; y < h; y++ {
		for x := x0; x <= x1; x++ {
			p.set(x, y, z0, m)
			p.set(x, y, z1, m)
		}
		for z := z0; z <= z1; z++ {
			p.set(x0, y, z, m)
			p.set(x1, y, z, m)
		}
	}
}

// wallX / wallZ: an inside wall along x (at z) or along z (at x).
func (p *planner) wallX(x0, x1, z, h int, m string) {
	for y := 0; y < h; y++ {
		for x := x0; x <= x1; x++ {
			p.set(x, y, z, m)
		}
	}
}
func (p *planner) wallZ(x, z0, z1, h int, m string) {
	for y := 0; y < h; y++ {
		for z := z0; z <= z1; z++ {
			p.set(x, y, z, m)
		}
	}
}

// roof: a flat roof (or slab) over x0..x1 × z0..z1 at height y.
func (p *planner) roof(x0, z0, x1, z1, y int, m string) {
	for x := x0; x <= x1; x++ {
		for z := z0; z <= z1; z++ {
			p.set(x, y, z, m)
		}
	}
}

// door: an opening two blocks high; closed: a wooden door (a neighbour's, shut).
func (p *planner) door(x, z int, closed bool) {
	for y := 0; y < 2; y++ {
		if closed {
			p.set(x, y, z, "bois")
		} else {
			delete(p.g, cell{x, y, z})
		}
	}
}

func (p *planner) window(x, z int) { p.set(x, 1, z, "verre") }

func (p *planner) put(id string, x, z, r int) {
	p.furn = append(p.furn, Piece{X: x, Z: z, R: r, ID: id})
}

func (p *planner) zone(x, z, w, d int, k, l string) {
	p.zones = append(p.zones, Zone{X: x, Z: z, W: w, D: d, K: k, L: l})
}

// room: the floor of a room whose walls are x0..x1 × z0..z1.
func (p *planner) room(x0, z0, x1, z1 int, k, label string) {
	p.zone(x0+1, z0+1, x1-x0-1, z1-z0-1, k, label)
}

// Storey: the height of one floor (three blocks of wall and the slab over them).
const Storey = 4

// upstairs: a floor over a house whose outline is x0..x1 × z0..z1, at storey
// n (1: a duplex's first floor, 2: a triplex's second), its bedrooms in a row
// at the back and one at the front, a bathroom, and its own slab or roof over
// it. The ground floor's roof is its floor.
func (p *planner) upstairs(x0, z0, x1, z1, n, bedrooms int, wall, roof string) {
	y0 := n * Storey
	for y := y0; y < y0+3; y++ {
		for x := x0; x <= x1; x++ {
			p.set(x, y, z0, wall)
			p.set(x, y, z1, wall)
		}
		for z := z0; z <= z1; z++ {
			p.set(x0, y, z, wall)
			p.set(x1, y, z, wall)
		}
		// The landing in the middle, the rooms either side.
		mid := (z0 + z1) / 2
		for x := x0; x <= x1; x++ {
			p.set(x, y, mid, wall)
		}
	}
	mid := (z0 + z1) / 2
	w := x1 - x0
	n2 := bedrooms + 1
	step := w / n2
	for i := 0; i < n2; i++ {
		a := x0 + i*step
		b := x0 + (i+1)*step
		if i == n2-1 {
			b = x1
		}
		if i > 0 {
			for y := y0; y < y0+3; y++ {
				for z := z0; z <= mid; z++ {
					p.set(a, y, z, wall)
				}
			}
		}
		// The doors onto the landing, the windows outside.
		for y := y0; y < y0+2; y++ {
			delete(p.g, cell{a + 2, y, mid})
		}
		p.set(a+2, y0+1, z0, "verre")
		if i == n2-1 {
			p.furn = append(p.furn, Piece{X: b - 1, Y: y0, Z: z0 + 1, ID: "douche"}, Piece{X: b - 1, Y: y0, Z: mid - 1, ID: "wc"})
			continue
		}
		p.furn = append(p.furn, Piece{X: a + 1, Y: y0, Z: z0 + 1, ID: "lit"}, Piece{X: b - 1, Y: y0, Z: z0 + 1, ID: "armoire"})
	}
	// The front: a family room with its sofa and TV, big windows.
	p.furn = append(p.furn, Piece{X: x0 + 2, Y: y0, Z: z1 - 2, R: 2, ID: "canape"}, Piece{X: x0 + 3, Y: y0, Z: mid + 1, ID: "tele"}, Piece{X: x1 - 2, Y: y0, Z: mid + 2, ID: "lit"})
	for x := x0 + 2; x < x1-1; x += 2 {
		p.set(x, y0+1, z1, "verre")
	}
	p.roof(x0, z0, x1, z1, y0+3, roof)
}

// stairs: the outside staircase up to the first floor, as on Abidjan's
// houses: at x, from z (its foot) back towards -z, a step higher each metre.
func (p *planner) stairs(x, z int, m string) {
	for k := 0; k < Storey; k++ {
		for y := 0; y <= k; y++ {
			p.set(x, y, z-k, m)
		}
	}
}

// stairsUp: an indoor staircase (the piece « escalier ») from floor n to the
// one above, its foot at z and its top at z+3, its well opened in the slab.
func (p *planner) stairsUp(x, z, n int) {
	for k := 0; k < Storey; k++ {
		delete(p.g, cell{x, n*Storey + Storey - 1, z + k})
	}
	p.furn = append(p.furn, Piece{X: x, Y: n * Storey, Z: z, R: 2, ID: StairsID})
}

// fence: a compound wall round the lot, 2 m, the gate (w wide) in the middle of the street side.
func (p *planner) fence(m string, gate int) {
	p.walls(0, 0, p.w-1, p.d-1, 2, m)
	g0 := (p.w - gate) / 2
	for x := g0; x < g0+gate; x++ {
		for y := 0; y < 2; y++ {
			delete(p.g, cell{x, y, p.d - 1})
		}
	}
}

// pool: a basin of w × d with a deck chair or two beside it (on the given side, x).
func (p *planner) pool(x, z, w, d int) {
	p.zone(x-1, z-1, w+2, d+2, ZoneTerrace, "")
	p.zone(x, z, w, d, ZonePool, "Piscine")
}

func (p *planner) plan(id, label, hint string, rooms int, lot bool) Plan {
	out := Plan{ID: id, Label: label, Hint: hint, W: p.w, D: p.d, Rooms: rooms, Furniture: p.furn, Zones: p.zones, Lot: lot}
	for c, m := range p.g {
		out.Blocks = append(out.Blocks, Block{c.x, c.y, c.z, m})
	}
	sort.Slice(out.Blocks, func(i, j int) bool {
		a, b := out.Blocks[i], out.Blocks[j]
		if a.Y != b.Y {
			return a.Y < b.Y
		}
		if a.Z != b.Z {
			return a.Z < b.Z
		}
		return a.X < b.X
	})
	for _, z := range out.Zones {
		if z.K == ZonePool {
			out.Pool = true
		}
	}
	out.Cost = planCost(out)
	return out
}

func planCost(pl Plan) int {
	cost := 0
	for _, b := range pl.Blocks {
		if m, ok := FindMaterial(b.M); ok {
			cost += m.Price
		}
	}
	for _, f := range pl.Furniture {
		if fu, ok := FindFurniture(f.ID); ok {
			cost += fu.Price
		}
	}
	for _, z := range pl.Zones {
		cost += ZonePrice[z.K] * z.W * z.D
	}
	return cost
}

/* ---------- The houses ---------- */

// baraque: the gnambro's shack of corrugated iron and planks, one room on
// beaten earth, the shower and the latrine a few steps off, shared.
func baraque() Plan {
	p := newPlanner(10, 10)
	p.zone(0, 0, 10, 10, ZoneYard, "")
	p.walls(1, 1, 5, 5, 2, "tole")
	p.wallX(1, 5, 5, 1, "bois")
	p.roof(1, 1, 5, 5, 2, "tole")
	p.door(3, 5, false)
	p.room(1, 1, 5, 5, ZoneConcrete, "La pièce")
	p.put("natte", 2, 2, 0)
	p.put("chaises", 4, 2, 0)
	p.put("gaziniere", 2, 7, 0) // cooking outside, in the yard
	// The shared shower and latrine: a little shed of iron.
	p.walls(7, 1, 9, 3, 2, "tole")
	p.door(8, 3, false)
	p.room(7, 1, 9, 3, ZoneConcrete, "Douche commune")
	p.put("douche", 8, 2, 0)
	p.walls(7, 5, 9, 7, 2, "tole")
	p.door(8, 7, false)
	p.put("wc", 8, 6, 0)
	return p.plan("baraque", "La baraque", "Une pièce en tôle, la douche et les toilettes partagées dans la cour.", 1, false)
}

// cour: a room in a cour commune, the coulé's: a row of rooms round a shared
// yard (the neighbours' doors shut), the shower and toilets at the end.
func cour() Plan {
	p := newPlanner(16, 13)
	p.zone(0, 0, 16, 13, ZoneYard, "")
	// Three rooms in a row at the back: the first is ours.
	p.walls(0, 0, 14, 5, 3, "banco")
	p.wallZ(5, 0, 5, 3, "banco")
	p.wallZ(10, 0, 5, 3, "banco")
	p.roof(0, 0, 14, 5, 3, "tole")
	p.door(2, 5, false)
	p.window(4, 5)
	p.door(7, 5, true)
	p.window(9, 5)
	p.door(12, 5, true)
	p.room(0, 0, 5, 5, ZoneConcrete, "Ta pièce")
	p.put("lit", 1, 1, 0)
	p.put("armoire", 4, 1, 0)
	p.put("chaises", 4, 4, 0)
	p.put("ventilo", 1, 4, 0)
	// The yard: the mothers cook outside.
	p.put("gaziniere", 2, 8, 0)
	p.put("table", 4, 8, 0)
	// The shared shower and toilets, in the corner.
	p.walls(12, 8, 15, 12, 3, "parpaing")
	p.wallX(12, 15, 10, 3, "parpaing")
	p.roof(12, 8, 15, 12, 3, "tole")
	p.door(12, 9, false)
	p.door(12, 11, false)
	p.room(12, 8, 15, 10, ZoneConcrete, "Douche commune")
	p.room(12, 10, 15, 12, ZoneConcrete, "Toilettes")
	p.put("douche", 14, 9, 0)
	p.put("wc", 14, 11, 0)
	return p.plan("cour", "La cour commune", "Une pièce dans la cour, les voisins à côté, la douche et les toilettes partagées.", 1, false)
}

// smallHouse: one bedroom-living room and a shower room, at x0, z0 (8 × 6).
func smallHouse(p *planner, x0, z0 int, wall string) {
	x1, z1 := x0+7, z0+5
	p.walls(x0, z0, x1, z1, 3, wall)
	p.wallZ(x0+5, z0, z1, 3, wall)
	p.roof(x0, z0, x1, z1, 3, "tole")
	p.door(x0+2, z1, false)
	p.window(x0+4, z1)
	p.window(x0, z0+2)
	p.door(x0+5, z0+3, false)
	p.room(x0, z0, x0+5, z1, ZoneFloor, "La pièce")
	p.room(x0+5, z0, x1, z1, ZoneFloor, "Douche")
	p.put("lit", x0+1, z0+1, 0)
	p.put("armoire", x0+3, z0+1, 0)
	p.put("gaziniere", x0+4, z0+1, 0)
	p.put("chaises", x0+4, z0+4, 0)
	p.put("tele", x0+1, z0+4, 0)
	p.put("douche", x0+6, z0+1, 0)
	p.put("wc", x0+6, z0+4, 0)
}

func studio() Plan {
	p := newPlanner(10, 10)
	p.zone(0, 0, 10, 10, ZoneYard, "")
	smallHouse(p, 1, 1, "parpaing")
	return p.plan("studio", "Le studio", "Une pièce avec ton coin cuisine, ta douche à toi.", 1, false)
}

// familyHouse: a living room with the kitchen, a bedroom, a bathroom (11 × 9).
func familyHouse(p *planner, x0, z0 int, wall, roof string) {
	x1, z1 := x0+10, z0+8
	p.walls(x0, z0, x1, z1, 3, wall)
	p.wallZ(x0+6, z0, z1, 3, wall)
	p.wallX(x0+6, x1, z0+4, 3, wall)
	p.roof(x0, z0, x1, z1, 3, roof)
	p.door(x0+3, z1, false)
	p.door(x0+6, z0+3, false)
	p.door(x0+6, z0+6, false)
	for _, x := range []int{x0 + 1, x0 + 5, x0 + 8} {
		p.window(x, z1)
	}
	p.window(x0+2, z0)
	p.window(x0+8, z0)
	p.window(x0, z0+4)
	p.window(x1, z0+2)
	p.room(x0, z0, x0+6, z1, ZoneFloor, "Salon et cuisine")
	p.room(x0+6, z0, x1, z0+4, ZoneFloor, "Chambre")
	p.room(x0+6, z0+4, x1, z1, ZoneFloor, "Salle de bain")
	// The living room: the TV against the back wall, the sofa facing it; the kitchen corner.
	p.put("tele", x0+3, z0+1, 0)
	p.put("canape", x0+2, z0+4, 2)
	p.put("gaziniere", x0+1, z0+1, 0)
	p.put("frigo", x0+1, z0+2, 0)
	p.put("table", x0+1, z0+5, 0)
	p.put("chaises", x0+2, z0+5, 0)
	// The bedroom.
	p.put("lit", x0+7, z0+1, 0)
	p.put("armoire", x0+9, z0+1, 0)
	p.put("ventilo", x0+5, z0+1, 0)
	// The bathroom.
	p.put("douche", x0+9, z0+5, 0)
	p.put("wc", x0+9, z0+7, 0)
}

func appart() Plan {
	p := newPlanner(13, 12)
	p.zone(0, 0, 13, 12, ZoneYard, "")
	familyHouse(p, 1, 0, "jaune", "parpaing")
	p.zone(1, 9, 11, 3, ZoneTerrace, "")
	return p.plan("appart", "L'appartement", "Salon, chambre, cuisine et salle de bain.", 1, false)
}

// bigHouse: a living room, a kitchen, bedrooms (2 or 3) and a bathroom (14 × 10).
func bigHouse(p *planner, x0, z0, bedrooms int, wall, roof string) {
	x1, z1 := x0+13, z0+9
	p.walls(x0, z0, x1, z1, 3, wall)
	// Bedrooms along the back, the living room and kitchen at the front.
	p.wallX(x0, x1, z0+4, 3, wall)
	p.roof(x0, z0, x1, z1, 3, roof)
	n := bedrooms + 1 // the bathroom is the last of the back rooms
	step := 13 / n
	for i := 1; i < n; i++ {
		p.wallZ(x0+i*step, z0, z0+4, 3, wall)
	}
	for i := 0; i < n; i++ {
		a := x0 + i*step
		b := x0 + (i+1)*step
		if i == n-1 {
			b = x1
		}
		label := "Chambre"
		if i == n-1 {
			label = "Salle de bain"
		}
		p.room(a, z0, b, z0+4, ZoneFloor, label)
		p.door(a+2, z0+4, false)
		p.window(a+2, z0)
		if i == n-1 {
			p.put("douche", b-1, z0+1, 0)
			p.put("wc", b-1, z0+3, 0)
		} else {
			p.put("lit", a+1, z0+1, 0)
			p.put("armoire", b-1, z0+1, 0)
		}
	}
	// The kitchen at one end of the front, the living room the rest.
	p.wallZ(x0+4, z0+4, z1, 3, wall)
	p.door(x0+4, z0+7, false)
	p.room(x0, z0+4, x0+4, z1, ZoneFloor, "Cuisine")
	p.room(x0+4, z0+4, x1, z1, ZoneFloor, "Salon")
	p.put("gaziniere", x0+1, z0+5, 0)
	p.put("frigo", x0+3, z0+5, 0)
	p.put("table", x0+2, z0+7, 0)
	p.put("tele", x0+8, z0+5, 0)
	p.put("canape", x0+7, z0+7, 2)
	p.put("chaises", x0+11, z0+7, 0)
	p.put("ventilo", x0+12, z0+5, 0)
	p.door(x0+9, z1, false)
	for _, x := range []int{x0 + 2, x0 + 6, x0 + 11} {
		p.window(x, z1)
	}
	p.window(x0, z0+6)
	p.window(x1, z0+6)
}

func maison() Plan {
	p := newPlanner(16, 18)
	p.zone(0, 0, 16, 18, ZoneGarden, "Jardin")
	p.fence("parpaing", 3)
	bigHouse(p, 1, 1, 2, "bleu", "parpaing")
	p.zone(2, 11, 12, 2, ZoneTerrace, "")
	return p.plan("maison", "La maison familiale", "Deux chambres, le salon, la cuisine, la salle de bain et le jardin devant.", 2, false)
}

// villaHouse: the villa: a big living room, the kitchen, bedrooms and two
// bathrooms (w × 12, w ≥ 16), big windows at the front.
func villaHouse(p *planner, x0, z0, w, bedrooms int, wall string) {
	x1, z1 := x0+w-1, z0+11
	p.walls(x0, z0, x1, z1, 3, wall)
	p.wallX(x0, x1, z0+5, 3, wall)
	p.roof(x0, z0, x1, z1, 3, "parpaing")
	n := bedrooms + 1
	step := (w - 1) / n
	for i := 1; i < n; i++ {
		p.wallZ(x0+i*step, z0, z0+5, 3, wall)
	}
	for i := 0; i < n; i++ {
		a := x0 + i*step
		b := x0 + (i+1)*step
		if i == n-1 {
			b = x1
		}
		p.window(a+3, z0)
		if i == n-1 {
			// Two bathrooms side by side in the last bay.
			mid := (a + b) / 2
			p.wallZ(mid, z0, z0+5, 3, wall)
			p.door(a+1, z0+5, false)
			p.door(mid+1, z0+5, false)
			p.room(a, z0, mid, z0+5, ZoneFloor, "Salle d'eau")
			p.room(mid, z0, b, z0+5, ZoneFloor, "Salle de bain")
			p.put("douche", a+1, z0+1, 0)
			p.put("douche", b-1, z0+1, 0)
			p.put("wc", b-1, z0+3, 0)
			continue
		}
		p.door(a+2, z0+5, false)
		label := "Chambre"
		if i == 0 {
			label = "Chambre des parents"
		}
		p.room(a, z0, b, z0+5, ZoneFloor, label)
		p.put("lit", a+1, z0+1, 0)
		p.put("armoire", b-1, z0+1, 0)
		p.put("ventilo", a+1, z0+4, 0)
	}
	// The front: the kitchen, then the living room, glass at the front.
	p.wallZ(x0+5, z0+5, z1, 3, wall)
	p.door(x0+5, z0+8, false)
	p.room(x0, z0+5, x0+5, z1, ZoneFloor, "Cuisine")
	p.room(x0+5, z0+5, x1, z1, ZoneFloor, "Salon")
	p.put("gaziniere", x0+1, z0+6, 0)
	p.put("frigo", x0+3, z0+6, 0)
	p.put("table", x0+2, z0+8, 0)
	p.put("tele", x0+9, z0+6, 0)
	p.put("canape", x0+8, z0+9, 2)
	p.put("canape", x0+11, z0+9, 2)
	p.put("table", x0+14, z0+7, 0)
	p.put("chaises", x0+13, z0+7, 0)
	p.door(x0+7, z1, false)
	for x := x0 + 9; x < x1; x++ {
		p.window(x, z1)
	}
	p.window(x0+2, z1)
	p.window(x0, z0+8)
	p.window(x1, z0+8)
}

// guard: the guard's hut by the gate.
func (p *planner) guard(x, z int) {
	p.walls(x, z, x+2, z+2, 3, "parpaing")
	p.roof(x, z, x+2, z+2, 3, "tole")
	p.door(x+1, z+2, false)
	p.put("chaises", x+1, z+1, 0)
}

func villa() Plan {
	p := newPlanner(22, 28)
	p.zone(0, 0, 22, 28, ZoneGarden, "Jardin")
	p.fence("jaune", 4)
	villaHouse(p, 2, 1, 18, 3, "jaune")
	p.upstairs(2, 1, 19, 12, 1, 3, "jaune", "parpaing")
	p.stairs(20, 10, "parpaing")
	p.zone(2, 13, 18, 2, ZoneTerrace, "Terrasse")
	p.pool(4, 17, 9, 5)
	p.put("transat", 14, 17, 0)
	p.put("transat", 16, 17, 0)
	p.guard(17, 23)
	return p.plan("villa", "La villa duplex avec piscine", "Un étage : six chambres, trois salles de bain, deux salons, la cuisine, le jardin, la piscine et le gardien.", 6, false)
}

func villaGrande() Plan {
	p := newPlanner(28, 34)
	p.zone(0, 0, 28, 34, ZoneGarden, "Jardin")
	p.fence("marbre", 5)
	villaHouse(p, 2, 1, 24, 4, "marbre")
	p.upstairs(2, 1, 25, 12, 1, 4, "marbre", "marbre")
	p.upstairs(2, 1, 25, 12, 2, 4, "marbre", "marbre")
	p.stairs(26, 10, "marbre")
	p.stairsUp(3, 7, 1)
	p.zone(2, 13, 24, 3, ZoneTerrace, "Terrasse")
	p.pool(4, 18, 14, 6)
	for _, x := range []int{19, 21, 23} {
		p.put("transat", x, 18, 0)
	}
	p.guard(22, 29)
	return p.plan("villa-grande", "La grande villa triplex", "Deux étages : douze chambres, des salles de bain partout, les salons, la terrasse, la grande piscine, le jardin et le gardien.", 12, false)
}

/* ---------- The plans to build on a bought lot ---------- */

func lotMaisonnette() Plan {
	p := newPlanner(10, 15)
	p.zone(0, 0, 10, 15, ZoneGarden, "Jardin")
	smallHouse(p, 1, 1, "parpaing")
	p.zone(1, 8, 8, 2, ZoneTerrace, "")
	return p.plan("maisonnette", "Maisonnette", "Une pièce, la douche et les toilettes, un petit jardin. Pour 150 m².", 1, true)
}

func lotMaison() Plan {
	p := newPlanner(15, 20)
	p.zone(0, 0, 15, 20, ZoneGarden, "Jardin")
	familyHouse(p, 2, 1, "jaune", "parpaing")
	p.zone(2, 11, 11, 2, ZoneTerrace, "")
	return p.plan("maison-2p", "Maison deux pièces", "Salon et cuisine, une chambre, la salle de bain, le jardin. Pour 300 m².", 1, true)
}

func lotVilla() Plan {
	p := newPlanner(20, 25)
	p.zone(0, 0, 20, 25, ZoneGarden, "Jardin")
	bigHouse(p, 3, 1, 2, "bleu", "parpaing")
	p.zone(3, 12, 14, 2, ZoneTerrace, "Terrasse")
	p.pool(5, 16, 8, 4)
	p.put("transat", 15, 16, 0)
	return p.plan("villa-basse", "Villa basse avec piscine", "Deux chambres, le salon, la cuisine, la salle de bain, la piscine, le jardin. Pour 500 m².", 2, true)
}

func lotGrandeVilla() Plan {
	p := newPlanner(20, 30)
	p.zone(0, 0, 20, 30, ZoneGarden, "Jardin")
	villaHouse(p, 1, 1, 18, 3, "marbre")
	p.zone(1, 13, 18, 2, ZoneTerrace, "Terrasse")
	p.pool(3, 17, 9, 5)
	p.put("transat", 14, 17, 0)
	p.put("transat", 16, 17, 0)
	return p.plan("villa", "Villa avec piscine", "Trois chambres, deux salles de bain, le grand salon, la cuisine, la terrasse, la piscine, le jardin. Pour 600 m².", 3, true)
}

func lotDuplex() Plan {
	p := newPlanner(20, 25)
	p.zone(0, 0, 20, 25, ZoneGarden, "Jardin")
	villaHouse(p, 0, 1, 18, 3, "vert")
	p.upstairs(0, 1, 17, 12, 1, 3, "vert", "parpaing")
	p.stairs(18, 10, "parpaing")
	p.zone(0, 13, 18, 2, ZoneTerrace, "Terrasse")
	p.pool(3, 17, 8, 4)
	p.put("transat", 13, 17, 0)
	p.put("transat", 15, 17, 0)
	return p.plan("duplex", "Villa duplex avec piscine", "Un étage : six chambres, trois salles de bain, deux salons, la cuisine, la piscine, le jardin. Pour 500 m².", 6, true)
}

func lotTriplex() Plan {
	p := newPlanner(20, 30)
	p.zone(0, 0, 20, 30, ZoneGarden, "Jardin")
	villaHouse(p, 0, 1, 18, 3, "marbre")
	p.upstairs(0, 1, 17, 12, 1, 3, "marbre", "marbre")
	p.upstairs(0, 1, 17, 12, 2, 3, "marbre", "marbre")
	p.stairs(18, 10, "marbre")
	p.stairsUp(1, 7, 1)
	p.zone(0, 13, 18, 2, ZoneTerrace, "Terrasse")
	p.pool(3, 17, 10, 6)
	p.put("transat", 15, 17, 0)
	p.put("transat", 17, 17, 0)
	return p.plan("triplex", "Villa triplex avec piscine", "Deux étages : neuf chambres, les salles de bain, trois salons, la grande piscine, le jardin. Pour 600 m².", 9, true)
}

// HomePlans: the homes Sims are born in, by plan id.
var HomePlans = map[string]Plan{}

// LotPlans: the houses one can build on a bought lot, smallest first.
var LotPlans []Plan

// HousingPlan: the home of each housing; FamilyPlan: a family's own, while the Sim lives with its parents.
var (
	HousingPlan = map[string]string{"entrer-coucher": "cour", "studio": "studio", "appart": "appart", "villa": "villa"}
	FamilyPlan  = map[string]string{"gnambro": "baraque", "lagnon": "maison", "debout": "villa-grande"}
)

func init() {
	for _, pl := range []Plan{baraque(), cour(), studio(), appart(), maison(), villa(), villaGrande()} {
		HomePlans[pl.ID] = pl
	}
	LotPlans = []Plan{lotMaisonnette(), lotMaison(), lotVilla(), lotGrandeVilla(), lotDuplex(), lotTriplex()}
}

// HomePlanFor: the home a Sim lives in (its family's while it has the family's housing), "" in its own house.
func HomePlanFor(family, housing string) string {
	if housing == OwnHouse {
		return ""
	}
	if f, ok := FindFamily(family); ok && f.Housing == housing {
		if id, ok := FamilyPlan[family]; ok {
			return id
		}
	}
	return HousingPlan[housing]
}

// FindLotPlan: a lot plan by id.
func FindLotPlan(id string) (Plan, bool) {
	for _, pl := range LotPlans {
		if pl.ID == id {
			return pl, true
		}
	}
	return Plan{}, false
}

// ErrPlanTooBig / ErrLotNotEmpty: building a plan.
var (
	ErrPlanTooBig  = errors.New("ce plan ne tient pas sur ton terrain : il faut un terrain plus grand")
	ErrLotNotEmpty = errors.New("ton terrain n'est pas vide : démolis d'abord ce qui est dessus")
)

// BuildPlan: the plan built on an empty lot, at the street side, in the middle.
func (h House) BuildPlan(pl Plan) (House, error) {
	if h.W == 0 || h.D == 0 {
		return h, ErrNoLot
	}
	if pl.W > h.W || pl.D > h.D {
		return h, ErrPlanTooBig
	}
	if len(h.Blocks) > 0 || len(h.Furniture) > 0 {
		return h, ErrLotNotEmpty
	}
	dx, dz := (h.W-pl.W)/2, h.D-pl.D
	out := House{W: h.W, D: h.D, Built: h.Built + len(pl.Blocks)}
	for _, b := range pl.Blocks {
		out.Blocks = append(out.Blocks, Block{b.X + dx, b.Y, b.Z + dz, b.M})
	}
	for _, f := range pl.Furniture {
		out.Furniture = append(out.Furniture, Piece{X: f.X + dx, Y: f.Y, Z: f.Z + dz, R: f.R, ID: f.ID})
	}
	for _, z := range pl.Zones {
		out.Zones = append(out.Zones, Zone{X: z.X + dx, Z: z.Z + dz, W: z.W, D: z.D, K: z.K, L: z.L})
	}
	return out, nil
}

// PlanRefund: what taking a whole house down gives back (half its blocks and furniture).
func PlanRefund(h House) int {
	back := 0
	for _, b := range h.Blocks {
		if m, ok := FindMaterial(b.M); ok {
			back += m.Price / 2
		}
	}
	for _, f := range h.Furniture {
		if fu, ok := FindFurniture(f.ID); ok {
			back += fu.Price / 2
		}
	}
	return back
}
