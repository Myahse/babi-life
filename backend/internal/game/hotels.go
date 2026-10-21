package game

import (
	"fmt"
	"hash/fnv"
	"math"
)

// The hotels' rooms (world3d/interior/HotelFloors.tsx): every hotel has its
// floors, reached by its lifts, each with its corridor of numbered rooms. A
// room is visited, then rented for a few hours or for nights (game time is
// real time: a night is a real night); while the stay lasts it is the Sim's,
// to sleep, wash, watch TV and order from room service (the « Stay »
// interactions below), and nobody else can have it. Some rooms are taken by
// the game's own guests (a share that changes with the day), others by
// players.

// RoomType: a standard room, a superior one (the corners, more room and view), a suite (the top floors).
type RoomType struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	Hint  string  `json:"hint"`
	Rate  float64 `json:"rate"` // times the hotel's standard night
}

var RoomTypes = []RoomType{
	{ID: "standard", Label: "Chambre standard", Hint: "Un grand lit, le bureau, la télé, la douche à l'italienne.", Rate: 1},
	{ID: "superieure", Label: "Chambre supérieure", Hint: "À l'angle : deux fois plus de fenêtres, un canapé, la baignoire.", Rate: 1.4},
	{ID: "suite", Label: "Suite", Hint: "Tout en haut : le salon à part, la chambre, la grande salle de bain, la vue.", Rate: 2.6},
}

// Hotel: one hotel's floors and prices.
type Hotel struct {
	Place string `json:"place"`
	// Floors of rooms (1 to Floors; 0 is the hall); RoomsPerFloor along each corridor.
	Floors        int `json:"floors"`
	RoomsPerFloor int `json:"roomsPerFloor"`
	// SuitesFrom: the floors of suites (from it to the top).
	SuitesFrom int `json:"suitesFrom"`
	Stars      int `json:"stars"`
	// Night: a standard room's night, in Djai.
	Night int `json:"night"`
	// Busy: about how many rooms the game's own guests take (0 to 1).
	Busy float64 `json:"busy"`
}

// Hotels: by place (world/world.go). A hotel not listed gets DefaultHotel.
var Hotels = map[string]Hotel{
	"plateau-poulman":     {Floors: 10, RoomsPerFloor: 12, SuitesFrom: 10, Stars: 5, Night: 85000, Busy: 0.55},
	"plateau-noum":        {Floors: 21, RoomsPerFloor: 10, SuitesFrom: 19, Stars: 5, Night: 110000, Busy: 0.5},
	"cocody-hotel-ivoire": {Floors: 24, RoomsPerFloor: 12, SuitesFrom: 22, Stars: 5, Night: 95000, Busy: 0.6},
	"marcory-azale":       {Floors: 5, RoomsPerFloor: 10, SuitesFrom: 5, Stars: 4, Night: 60000, Busy: 0.5},
	"pb-rabisson":         {Floors: 6, RoomsPerFloor: 12, SuitesFrom: 6, Stars: 4, Night: 55000, Busy: 0.65},
}

var DefaultHotel = Hotel{Floors: 4, RoomsPerFloor: 8, SuitesFrom: 4, Stars: 3, Night: 35000, Busy: 0.45}

// HotelOf: a hotel's floors and prices.
func HotelOf(place string) Hotel {
	h, ok := Hotels[place]
	if !ok {
		h = DefaultHotel
	}
	h.Place = place
	return h
}

// RoomNumber: floor 12, room 4 → « 1204 ».
func RoomNumber(floor, n int) string { return fmt.Sprintf("%d%02d", floor, n) }

// ParseRoom: « 1204 » → floor 12, room 4 (ok false when it isn't one of the hotel's).
func (h Hotel) ParseRoom(room string) (floor, n int, ok bool) {
	var v int
	if _, err := fmt.Sscanf(room, "%d", &v); err != nil || fmt.Sprint(v) != room {
		return 0, 0, false
	}
	floor, n = v/100, v%100
	return floor, n, floor >= 1 && floor <= h.Floors && n >= 1 && n <= h.RoomsPerFloor
}

// TypeOf: a room's kind: suites on the top floors, superior at the corridor's ends, else standard.
func (h Hotel) TypeOf(floor, n int) RoomType {
	switch {
	case floor >= h.SuitesFrom:
		return RoomTypes[2]
	case n <= 2 || n > h.RoomsPerFloor-2:
		return RoomTypes[1]
	}
	return RoomTypes[0]
}

// Stay lengths one can rent a room for: a few hours (day use), or nights.
type StayLength struct {
	ID      string  `json:"id"`
	Label   string  `json:"label"`
	Minutes int64   `json:"minutes"`
	Rate    float64 `json:"rate"` // times one night
}

var StayLengths = []StayLength{
	{ID: "3h", Label: "3 heures", Minutes: 3 * 60, Rate: 0.4},
	{ID: "1n", Label: "1 nuit", Minutes: 24 * 60, Rate: 1},
	{ID: "2n", Label: "2 nuits", Minutes: 2 * 24 * 60, Rate: 2},
	{ID: "3n", Label: "3 nuits", Minutes: 3 * 24 * 60, Rate: 2.9},
	{ID: "7n", Label: "1 semaine", Minutes: 7 * 24 * 60, Rate: 6.3},
}

func FindStayLength(id string) (StayLength, bool) {
	for _, l := range StayLengths {
		if l.ID == id {
			return l, true
		}
	}
	return StayLength{}, false
}

// Price: a room of this kind for this long, to the 500.
func (h Hotel) Price(t RoomType, l StayLength) int {
	return int(math.Round(float64(h.Night)*t.Rate*l.Rate/500)) * 500
}

// GuestTaken: whether the game's own guests have this room today (the same answer all day, for everyone).
func (h Hotel) GuestTaken(room string, day int64) bool {
	f := fnv.New32a()
	fmt.Fprintf(f, "%s/%s/%d", h.Place, room, day)
	return float64(f.Sum32()%1000)/1000 < h.Busy
}

// StayIDs: what one does in one's own room (Interaction.Stay): only with a room rented here.
const (
	RoomSleepID = "chambre-dormir"
)
