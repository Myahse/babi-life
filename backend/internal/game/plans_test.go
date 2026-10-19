package game

import "testing"

// Every plan is a house one could have built block by block: inside its lot,
// nothing floating, no furniture in a wall or on another piece, each door
// open, and one can live in it (a bed under a roof, toilets).
func TestPlansAreSound(t *testing.T) {
	all := []Plan{}
	for _, p := range HomePlans {
		all = append(all, p)
	}
	all = append(all, LotPlans...)
	for _, pl := range all {
		grid := map[cell]string{}
		for _, b := range pl.Blocks {
			c := b.at()
			if c.x < 0 || c.x >= pl.W || c.z < 0 || c.z >= pl.D || c.y < 0 || c.y >= PlotH {
				t.Errorf("%s: block out of the lot %v", pl.ID, b)
			}
			if _, ok := FindMaterial(b.M); !ok {
				t.Errorf("%s: unknown material %q", pl.ID, b.M)
			}
			grid[c] = b.M
		}
		for _, b := range pl.Blocks {
			if b.Y > 0 && !touches(grid, b.at()) {
				t.Errorf("%s: floating block %v", pl.ID, b)
			}
		}
		taken := map[cell]string{}
		for _, f := range pl.Furniture {
			if _, ok := FindFurniture(f.ID); !ok {
				t.Errorf("%s: unknown furniture %q", pl.ID, f.ID)
				continue
			}
			for _, c := range f.cells() {
				if c.x < 0 || c.x >= pl.W || c.z < 0 || c.z >= pl.D {
					t.Errorf("%s: %s out of the lot", pl.ID, f.ID)
				}
				if m, ok := grid[c]; ok {
					t.Errorf("%s: %s at %v is in a %s block", pl.ID, f.ID, c, m)
				}
				if o, ok := taken[c]; ok {
					t.Errorf("%s: %s and %s on the same cell %v", pl.ID, f.ID, o, c)
				}
				taken[c] = f.ID
			}
		}
		for _, z := range pl.Zones {
			if z.X < 0 || z.Z < 0 || z.X+z.W > pl.W || z.Z+z.D > pl.D || z.W <= 0 || z.D <= 0 {
				t.Errorf("%s: zone out of the lot %v", pl.ID, z)
			}
		}
		h := House{W: pl.W, D: pl.D, Blocks: pl.Blocks, Furniture: pl.Furniture}
		if !h.Livable() {
			t.Errorf("%s: not livable (a bed under a roof and toilets)", pl.ID)
		}
		if pl.Cost <= 0 {
			t.Errorf("%s: no cost", pl.ID)
		}
	}
}

func TestEachFamilyHasItsHome(t *testing.T) {
	sizes := map[string]int{}
	for _, f := range Families {
		id := HomePlanFor(f.ID, f.Housing)
		pl, ok := HomePlans[id]
		if !ok {
			t.Fatalf("%s: no home plan (%q)", f.ID, id)
		}
		sizes[f.ID] = pl.W * pl.D
	}
	if !(sizes["gnambro"] < sizes["lagnon"] && sizes["lagnon"] < sizes["late"] && sizes["late"] < sizes["debout"]) {
		t.Fatalf("the richer the family, the bigger the home: %v", sizes)
	}
	if !HomePlans[HomePlanFor("debout", "villa")].Pool || HomePlans[HomePlanFor("coule", "entrer-coucher")].Pool {
		t.Fatal("the debout have a pool, the coulé don't")
	}
	if HomePlanFor("late", OwnHouse) != "" {
		t.Fatal("in one's own house, no home plan")
	}
}

func TestBuildPlanOnALot(t *testing.T) {
	for _, l := range LotSizes {
		h := House{W: l.W, D: l.D}
		fit := 0
		for _, pl := range LotPlans {
			out, err := h.BuildPlan(pl)
			if pl.W > l.W || pl.D > l.D {
				if err != ErrPlanTooBig {
					t.Errorf("%s on %d m²: want too big, got %v", pl.ID, l.W*l.D, err)
				}
				continue
			}
			if err != nil {
				t.Fatalf("%s on %d m²: %v", pl.ID, l.W*l.D, err)
			}
			fit++
			if !out.Fits(l.W, l.D) || !out.Livable() {
				t.Errorf("%s on %d m²: doesn't fit or isn't livable", pl.ID, l.W*l.D)
			}
			if _, err := out.BuildPlan(pl); err != ErrLotNotEmpty {
				t.Errorf("a plan on a built lot: want ErrLotNotEmpty, got %v", err)
			}
		}
		if fit == 0 {
			t.Errorf("no plan for a lot of %d m²", l.W*l.D)
		}
	}
}

// From the street (the front edge), one can walk to every piece of furniture:
// no room is walled in, no door blocked by a bed.
func TestPlansCanBeWalked(t *testing.T) {
	all := []Plan{}
	for _, p := range HomePlans {
		all = append(all, p)
	}
	all = append(all, LotPlans...)
	type xz struct{ x, z int }
	for _, pl := range all {
		solid := map[xz]bool{}
		for _, b := range pl.Blocks {
			if b.Y <= 1 {
				solid[xz{b.X, b.Z}] = true
			}
		}
		owner := map[xz]int{}
		for i, f := range pl.Furniture {
			if f.Y > 0 {
				continue // upstairs: reached by the stairs, not walked to on the ground
			}
			for _, c := range f.cells() {
				owner[xz{c.x, c.z}] = i + 1
			}
		}
		for _, z := range pl.Zones {
			if z.K == ZonePool {
				for x := z.X; x < z.X+z.W; x++ {
					for zz := z.Z; zz < z.Z+z.D; zz++ {
						solid[xz{x, zz}] = true
					}
				}
			}
		}
		seen := map[xz]bool{}
		var queue []xz
		for x := 0; x < pl.W; x++ {
			c := xz{x, pl.D - 1}
			if !solid[c] && owner[c] == 0 {
				seen[c] = true
				queue = append(queue, c)
			}
		}
		reached := map[int]bool{}
		for len(queue) > 0 {
			c := queue[0]
			queue = queue[1:]
			for _, d := range []xz{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
				n := xz{c.x + d.x, c.z + d.z}
				if n.x < 0 || n.z < 0 || n.x >= pl.W || n.z >= pl.D || seen[n] || solid[n] {
					continue
				}
				if o := owner[n]; o > 0 {
					reached[o] = true
					continue
				}
				seen[n] = true
				queue = append(queue, n)
			}
		}
		for i, f := range pl.Furniture {
			if f.Y == 0 && !reached[i+1] {
				t.Errorf("%s: can't walk to the %s at %d,%d", pl.ID, f.ID, f.X, f.Z)
			}
		}
	}
}
