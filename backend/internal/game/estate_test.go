package game

import (
	"testing"
	"time"
)

// A new building fills up as the days go by, pays its rents into what waits for its owner (a week at
// most), wears, and empties when it isn't kept up; the tax comes off what's collected, the day's limit too.
func TestEstateSettle(t *testing.T) {
	t0 := time.Date(2026, 11, 1, 8, 0, 0, 0, time.UTC)
	e := Estate{Kind: EstateImmeuble, Units: 8, Upkeep: 100, Staff: []Staff{}, Last: t0}
	e.Settle("yopougon", t0.Add(24*time.Hour))
	if e.Tenants != 2 || e.Pending != 0 {
		t.Fatalf("day one: %d tenants, %d waiting", e.Tenants, e.Pending)
	}
	e.Settle("yopougon", t0.Add(5*24*time.Hour))
	if e.Tenants != 8 || e.Pending <= 0 || e.Upkeep >= 90 {
		t.Fatalf("five days on: %d tenants, %d waiting, upkeep %.1f", e.Tenants, e.Pending, e.Upkeep)
	}
	// Months without coming: a week's worth waits, no more; the building runs down, tenants leave.
	e.Settle("yopougon", t0.Add(60*24*time.Hour))
	if ceiling := (8*UnitRent("yopougon", EstateImmeuble) + 6*10400*3) * PendingDays; e.Pending > ceiling {
		t.Fatalf("more than a week waits: %d > %d", e.Pending, ceiling)
	}
	if e.Upkeep > 80 || e.Tenants >= 8 {
		t.Fatalf("not run down: upkeep %.1f, %d tenants", e.Upkeep, e.Tenants)
	}
	if e.RepairCost() <= 0 {
		t.Fatal("repairs are free")
	}
	before := e.Pending
	got, tax := e.Collect(1 << 30)
	if got+tax != before || tax == 0 || e.Pending != 0 {
		t.Fatalf("collect: %d + %d tax of %d, %d left", got, tax, before, e.Pending)
	}
	// The day's limit: the rest waits.
	e.Pending = 100000
	if got, _ := e.Collect(9000); got != 9000 || e.Pending <= 0 {
		t.Fatalf("limited collect: %d, %d left", got, e.Pending)
	}
}

// A shop sells with its staff, more in a dear commune, and costs its wages when nobody buys.
func TestShopSales(t *testing.T) {
	k, _ := FindShopKind("maquis")
	if ShopSales(k, 2, "plateau", 100) <= ShopSales(k, 2, "yopougon", 100) || ShopSales(k, 9, "yopougon", 100) != ShopSales(k, k.Staff, "yopougon", 100) {
		t.Fatal("sales by commune and staff")
	}
	e := Estate{Kind: EstateImmeuble, Units: 6, Shop: "maquis", Staff: []Staff{{Name: "Awa"}, {Name: "Yao"}}, Upkeep: 100}
	if e.DayGross("yopougon") != ShopSales(k, 2, "yopougon", 100)-2*Wage {
		t.Fatal("the wages come off")
	}
	if UnitRent("plateau", EstateTour) <= UnitRent("plateau", EstateImmeuble) {
		t.Fatal("an office lets dearer than a flat")
	}
	for id, ep := range EstatePlans {
		pl, ok := FindLotPlan(id)
		if !ok || pl.Key == "" || ep.Units == 0 || ep.Hours == 0 {
			t.Errorf("%s: plan %v, key %q", id, ok, pl.Key)
		}
		for _, b := range pl.Blocks {
			if b.Y >= PlotH {
				t.Errorf("%s: a block over the top", id)
				break
			}
		}
	}
}
