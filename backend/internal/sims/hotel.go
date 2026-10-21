package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// A room of one's own in a hotel (game/hotels.go): the floors are walked by
// lift, a room is visited, then rented at the reception for a few hours or
// for nights. While the stay lasts the room is the Sim's (Stay): sleeping in
// it, the shower, the TV and room service (the hotel's Stay interactions);
// nobody else can rent it. One stay at a time, anywhere (a hotel, or a home
// booked on Dodo: dodo.go).

var (
	errNoRoom       = errors.New("il faut d'abord louer une chambre ici (à la réception, ou par l'ascenseur)")
	errRoomTaken    = errors.New("cette chambre est occupée : choisis-en une autre")
	errNoSuchRoom   = errors.New("chambre inconnue")
	errNoSuchLength = errors.New("durée inconnue")
	errNotAHotel    = errors.New("ce n'est pas un hôtel")
	errTooYoungRoom = errors.New("une chambre d'hôtel, c'est à partir de 18 ans")
)

// nowTime: the clock (tests set it).
var nowTime = time.Now

// Stay is a room (or a home) rented away from home, until a game minute.
type Stay struct {
	Kind    string `json:"kind"` // hotel | dodo
	Place   string `json:"place"`
	Name    string `json:"name"`
	Room    string `json:"room,omitempty"`
	Floor   int    `json:"floor,omitempty"`
	Type    string `json:"type,omitempty"`
	City    string `json:"city"`
	Commune string `json:"commune"`
	From    int64  `json:"from"`
	Until   int64  `json:"until"`
	Paid    int    `json:"paid"`
	// Dodo: the listing, and the player who lets it (when it's a player's house).
	Listing int64  `json:"listing,omitempty"`
	Host    string `json:"host,omitempty"`
	// Lot: a player's house let on Dodo (its plot, drawn as it is built); Seed: a game home's (its plan).
	Lot  int64 `json:"lot,omitempty"`
	Seed int   `json:"seed,omitempty"`
}

// stay: the Sim's stay while it lasts (nil once it's over).
func (s *Sim) stay() *Stay {
	if s.Stay == nil || s.Stay.Until <= s.GameMinutes {
		return nil
	}
	return s.Stay
}

// staysAt: a room rented at this place, now.
func (s *Sim) staysAt(place string) bool {
	st := s.stay()
	return st != nil && st.Place == place && s.City == st.City && s.Commune == st.Commune
}

// until: « jusqu'à mercredi 14 h ».
func untilLabel(m int64) string {
	days := []string{"lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"}
	return fmt.Sprintf("jusqu'à %s %d h", days[game.WeekdayOf(m)], (m/60)%24)
}

// HotelRoom: a door of a corridor, as the lift's floor shows it.
type HotelRoom struct {
	Room  string `json:"room"`
	Type  string `json:"type"`
	Taken bool   `json:"taken"`
	Mine  bool   `json:"mine"`
}

// roomsTaken: the rooms of a hotel players have now (but this Sim).
func roomsTaken(ctx context.Context, q queryer, place, me string, now int64) (map[string]bool, error) {
	rows, err := q.Query(ctx, `SELECT stay->>'room' FROM sims WHERE stay->>'place' = $1 AND (stay->>'until')::bigint > $2 AND id <> $3`, place, now, me)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var room string
		if rows.Scan(&room) == nil {
			out[room] = true
		}
	}
	return out, rows.Err()
}

// hotelPlace: a hotel of the world, and its rooms.
func hotelPlace(id string) (world.City, world.Commune, world.Place, game.Hotel, error) {
	c, cm, p, ok := world.FindPlace(id)
	if !ok || p.Kind != "hotel" {
		return c, cm, p, game.Hotel{}, errNotAHotel
	}
	return c, cm, p, game.HotelOf(id), nil
}

// hotel: GET /sims/{id}/hotel/{place}[?floor=] — the hotel's floors and prices, one floor's rooms, and the Sim's stay.
func (h *Handler) hotel(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	_, _, place, ho, err := hotelPlace(chi.URLParam(r, "place"))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	s, err := scanSim(h.DB.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1`, id))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	now := game.MinuteOf(nowTime())
	s.GameMinutes = now
	out := map[string]any{"hotel": ho, "name": place.Name, "types": game.RoomTypes, "lengths": game.StayLengths, "stay": s.stay()}
	// The prices: each kind of room for each length.
	prices := map[string]map[string]int{}
	for _, t := range game.RoomTypes {
		prices[t.ID] = map[string]int{}
		for _, l := range game.StayLengths {
			prices[t.ID][l.ID] = ho.Price(t, l)
		}
	}
	out["prices"] = prices
	if floor, _ := strconv.Atoi(r.URL.Query().Get("floor")); floor >= 1 && floor <= ho.Floors {
		taken, err := roomsTaken(ctx, h.DB, place.ID, id, now)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		day := now / (24 * 60)
		rooms := make([]HotelRoom, 0, ho.RoomsPerFloor)
		for n := 1; n <= ho.RoomsPerFloor; n++ {
			room := game.RoomNumber(floor, n)
			mine := s.staysAt(place.ID) && s.Stay.Room == room
			rooms = append(rooms, HotelRoom{Room: room, Type: ho.TypeOf(floor, n).ID, Mine: mine, Taken: !mine && (taken[room] || ho.GuestTaken(room, day))})
		}
		out["floor"] = floor
		out["rooms"] = rooms
	}
	httpx.JSON(w, http.StatusOK, out)
}

// bookRoom: POST /sims/{id}/hotel/{place}/book {room, length} — the room rented, paid at once. The same
// room again: the stay goes on (longer). At the hotel, from 18, one stay at a time.
func (h *Handler) bookRoom(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Room   string `json:"room"`
		Length string `json:"length"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		c, cm, place, ho, err := hotelPlace(chi.URLParam(r, "place"))
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if s.stage().ID != game.StageAdulte {
			return game.Outcome{}, nil, errTooYoungRoom
		}
		if s.City != c.ID || s.Commune != cm.ID {
			return game.Outcome{}, nil, fmt.Errorf("va d'abord %s", inCommune(cm.Name))
		}
		floor, n, ok := ho.ParseRoom(req.Room)
		if !ok {
			return game.Outcome{}, nil, errNoSuchRoom
		}
		length, ok := game.FindStayLength(req.Length)
		if !ok {
			return game.Outcome{}, nil, errNoSuchLength
		}
		t := ho.TypeOf(floor, n)
		again := s.staysAt(place.ID) && s.Stay.Room == req.Room
		if st := s.stay(); st != nil && !again {
			return game.Outcome{}, nil, fmt.Errorf("tu as déjà %s %s : libère-la d'abord", stayName(st), untilLabel(st.Until))
		}
		if !again {
			taken, err := roomsTaken(ctx, tx, place.ID, s.ID, s.GameMinutes)
			if err != nil {
				return game.Outcome{}, nil, err
			}
			if taken[req.Room] || ho.GuestTaken(req.Room, s.GameMinutes/(24*60)) {
				return game.Outcome{}, nil, errRoomTaken
			}
		}
		price := ho.Price(t, length)
		if price > s.Money {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		s.Money -= price
		text := fmt.Sprintf("%s %s, %s : %s. La clé est à toi %s.", t.Label, req.Room, place.Name, length.Label, untilLabel(s.GameMinutes+length.Minutes))
		if again {
			s.Stay.Until += length.Minutes
			s.Stay.Paid += price
			text = fmt.Sprintf("Ton séjour en %s se prolonge : %s de plus, %s.", req.Room, length.Label, untilLabel(s.Stay.Until))
		} else {
			s.Stay = &Stay{Kind: "hotel", Place: place.ID, Name: place.Name, Room: req.Room, Floor: floor, Type: t.ID, City: c.ID, Commune: cm.ID, From: s.GameMinutes, Until: s.GameMinutes + length.Minutes, Paid: price}
		}
		return game.Outcome{Text: text, Money: -price}, []Event{{Kind: "bill", Text: text, Money: -price, GameTime: s.GameMinutes}}, nil
	})
}

// stayName: « ta chambre 1204 au Noum Hôtel », « ta location à Cocody ».
func stayName(st *Stay) string {
	if st.Kind == "hotel" {
		return fmt.Sprintf("ta chambre %s (%s)", st.Room, st.Name)
	}
	return fmt.Sprintf("ta location « %s »", st.Name)
}

// endStay: POST /sims/{id}/stay/end — the key handed back before the end (nothing paid back).
func (h *Handler) endStay(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		st := s.stay()
		if st == nil {
			return game.Outcome{}, nil, errors.New("tu n'as rien de loué en ce moment")
		}
		if a := s.Activity; a != nil && a.PlaceID == st.Place && (a.Interaction.Stay || a.PlaceID == StayPlaceID) {
			return game.Outcome{}, nil, game.ErrBusy
		}
		s.Stay = nil
		text := fmt.Sprintf("Tu rends la clé de %s. Merci de ta visite !", stayName(st))
		return game.Outcome{Text: text}, []Event{{Kind: "life", Text: text, GameTime: s.GameMinutes}}, nil
	})
}
