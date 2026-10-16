package ads

import (
	"testing"
	"time"
)

func TestCampaignClean(t *testing.T) {
	today := time.Date(2026, 10, 16, 15, 0, 0, 0, time.UTC)
	ok := Campaign{Advertiser: " Garba Chez Tanti ", Contact: "07 07 07 07 07", Title: "Le garba qui sent bon", Key: "ads/2026-10/x.jpg", Type: "image/jpeg", Communes: []string{"yopougon", "yopougon"}, Starts: "2026-10-16", Ends: "2026-11-15"}
	c := ok
	if _, _, err := c.clean(today); err != nil {
		t.Fatal(err)
	}
	if c.Advertiser != "Garba Chez Tanti" || c.Contact != "+2250707070707" || len(c.Communes) != 1 {
		t.Fatalf("not cleaned: %+v", c)
	}
	bad := []func(c *Campaign){
		func(c *Campaign) { c.Advertiser = "" },
		func(c *Campaign) { c.Contact = "rien" },
		func(c *Campaign) { c.Type = "application/pdf" },
		func(c *Campaign) { c.Key = "../secret" },
		func(c *Campaign) { c.Communes = []string{"paris"} },
		func(c *Campaign) { c.Starts = "2026-10-01" },
		func(c *Campaign) { c.Ends = "2026-10-10" },
		func(c *Campaign) { c.Ends = "2027-03-01" },
	}
	for i, f := range bad {
		c := ok
		c.Communes = []string{"yopougon"}
		f(&c)
		if _, _, err := c.clean(today); err == nil {
			t.Fatalf("bad campaign %d accepted: %+v", i, c)
		}
	}
}

func TestShows(t *testing.T) {
	s, e := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 11, 30, 0, 0, 0, 0, time.UTC)
	day := time.Date(2026, 11, 10, 18, 0, 0, 0, time.UTC)
	if !Shows("approved", true, nil, s, e, "cocody", day) {
		t.Fatal("an approved, paid, everywhere ad doesn't show")
	}
	if !Shows("approved", true, []string{"yopougon"}, s, e, "yopougon", day) || Shows("approved", true, []string{"yopougon"}, s, e, "cocody", day) {
		t.Fatal("communes not respected")
	}
	if Shows("approved", false, nil, s, e, "cocody", day) || Shows("pending", true, nil, s, e, "cocody", day) || Shows("approved", true, nil, s, e, "cocody", e.Add(48*time.Hour)) {
		t.Fatal("unpaid, pending or finished ad shows")
	}
	if !Shows("approved", true, nil, s, e, "cocody", e.Add(20*time.Hour)) {
		t.Fatal("the last day doesn't show")
	}
}
