package game

import "testing"

func TestHotelRooms(t *testing.T) {
	h := HotelOf("plateau-noum")
	if f, n, ok := h.ParseRoom("1204"); !ok || f != 12 || n != 4 {
		t.Fatalf("1204: %d %d %v", f, n, ok)
	}
	for _, bad := range []string{"0004", "2201", "1299", "12a4", "", "0"} {
		if _, _, ok := h.ParseRoom(bad); ok {
			t.Errorf("%q is not a room", bad)
		}
	}
	if h.TypeOf(20, 5).ID != "suite" || h.TypeOf(3, 1).ID != "superieure" || h.TypeOf(3, 5).ID != "standard" {
		t.Fatal("suites on top, superior at the ends")
	}
	night, _ := FindStayLength("1n")
	week, _ := FindStayLength("7n")
	if h.Price(RoomTypes[0], night) != 110000 || h.Price(RoomTypes[2], night) <= h.Price(RoomTypes[1], night) || h.Price(RoomTypes[0], week) >= 7*110000 {
		t.Fatal("prices: suites dearer, a week cheaper than 7 nights")
	}
	// The game's guests: about the share said, the same all day.
	taken := 0
	for n := 1; n <= 10; n++ {
		for f := 1; f <= 21; f++ {
			if h.GuestTaken(RoomNumber(f, n), 800) {
				taken++
			}
			if h.GuestTaken(RoomNumber(f, n), 800) != h.GuestTaken(RoomNumber(f, n), 800) {
				t.Fatal("not the same answer")
			}
		}
	}
	if taken < 70 || taken > 140 {
		t.Fatalf("%d of 210 taken", taken)
	}
}

func TestDodoListings(t *testing.T) {
	a, b := DodoListings("abidjan", "cocody", 9), DodoListings("abidjan", "cocody", 9)
	if len(a) < 5 || a[0].Title != b[0].Title || a[0].Night != b[0].Night {
		t.Fatal("the same homes for everyone")
	}
	for _, l := range DodoListings("abidjan", "abobo", 9) {
		if l.Type == "villa" {
			t.Fatal("no villa with a pool where land is cheap")
		}
	}
	if DodoNight("cocody") <= DodoNight("abobo") {
		t.Fatal("Cocody dearer than Abobo")
	}
}
