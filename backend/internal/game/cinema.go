package game

import (
	"fmt"
	"hash/fnv"
)

// Kinéo, the game's cinema chain (an invented name), and its two cinemas,
// like the real ones: a multiplex at the Cap Sud mall in Marcory (six
// screens, two of them VIP, about a thousand seats: like the one opened there
// in April 2024) and a single screen of 180 seats at Sococé, Deux-Plateaux.
// What's on (films the game makes up) changes every week; each screen shows
// two or three of them in turn from late morning to late evening, one
// session after the other. Who's already in the seats is the same for every
// player (a hash of the showing and the seat, fuller in the evening and at
// the weekend), plus the seats players bought (sims/cinema.go).

// Film: one of the films the game shows.
type Film struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Genre   string `json:"genre"`
	Minutes int    `json:"minutes"`
	// Rating: « Tous publics », « -12 », « -16 ».
	Rating  string    `json:"rating"`
	Tagline string    `json:"tagline"`
	Colors  [2]string `json:"colors"`
	// Draw: how much it fills the seats (1 is average).
	Draw float64 `json:"-"`
}

var Films = []Film{
	{"babi-express", "Babi Express", "Action", 112, "-12", "Un gbaka, un trésor volé, une nuit pour traverser Abidjan.", [2]string{"#ff7a00", "#3b0a45"}, 1.2},
	{"mariage-kouassi", "Le Mariage de Kouassi", "Comédie", 101, "Tous publics", "Deux familles, trois dots, un seul marié.", [2]string{"#f4c430", "#c2185b"}, 1.15},
	{"rois-zouglou", "Les Rois du Zouglou", "Musical", 118, "Tous publics", "Yopougon, 1994 : une bande de copains et un micro.", [2]string{"#00a862", "#14213d"}, 1.0},
	{"nuit-treichville", "Nuit blanche à Treichville", "Thriller", 107, "-12", "Un taxi, une valise, et personne n'a rien vu.", [2]string{"#1d4ed8", "#0b0b14"}, 0.95},
	{"maison-bassam", "La Maison de Bassam", "Épouvante", 96, "-16", "Les vieilles maisons du quartier France ont de la mémoire.", [2]string{"#5a5048", "#0e0a08"}, 0.9},
	{"heritage-akissi", "L'Héritage de tantie Akissi", "Drame", 125, "Tous publics", "Une plantation, quatre enfants, un testament.", [2]string{"#8a5a2b", "#f4efe6"}, 0.8},
	{"lievre-tiassale", "Le Petit Lièvre de Tiassalé", "Animation", 88, "Tous publics", "Le plus malin de la savane part à la grande ville.", [2]string{"#74c0fc", "#ffd166"}, 1.1},
	{"operation-lagune", "Opération Lagune", "Action", 122, "-12", "Les plongeurs de la police contre les rois du port.", [2]string{"#0f9d8a", "#0b1f2e"}, 1.05},
	{"coeur-maquis", "Cœur de maquis", "Romance", 104, "Tous publics", "Elle sert les clients, il chante le samedi soir.", [2]string{"#d6336c", "#2b0a1e"}, 0.9},
	{"gbaka-revanche", "Gbaka 2 : la revanche", "Comédie", 110, "Tous publics", "L'apprenti est devenu chauffeur. Le patron n'a rien oublié.", [2]string{"#f2b705", "#1f6f2e"}, 1.15},
	{"elephants-or", "Les Éléphants d'or", "Sport", 115, "Tous publics", "Une CAN, un vestiaire, un pays qui y croit.", [2]string{"#ff8200", "#009e60"}, 1.0},
	{"route-odienne", "Sur la route d'Odienné", "Aventure", 109, "Tous publics", "Deux frères, une vieille moto, mille kilomètres.", [2]string{"#c9a227", "#5c3d22"}, 0.85},
}

// FindFilm: a film by its id.
func FindFilm(id string) (Film, bool) {
	for _, f := range Films {
		if f.ID == id {
			return f, true
		}
	}
	return Film{}, false
}

// Salle: a screen of a cinema: its rows and seats, the aisles (after which seats), its price.
type Salle struct {
	N      int    `json:"n"`
	Rows   int    `json:"rows"`
	Cols   int    `json:"cols"`
	Aisles []int  `json:"aisles"`
	VIP    bool   `json:"vip,omitempty"`
	Price  int    `json:"price"`
	Name   string `json:"name"`
}

// Cinema: a Kinéo cinema (its place in world/world.go), its screens, its first and last sessions.
type Cinema struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Salles []Salle `json:"salles"`
	// First session (hour), how many films each screen shows in turn.
	Opens int `json:"-"`
	Films int `json:"-"`
}

const (
	KineoCapSud = "marcory-kineo"
	KineoSococe = "cocody-kineo"
)

var Cinemas = map[string]Cinema{
	KineoCapSud: {ID: KineoCapSud, Name: "Kinéo Cap Sud", Opens: 11, Films: 2, Salles: []Salle{
		{N: 1, Name: "Salle 1 · VIP", Rows: 6, Cols: 10, Aisles: []int{5}, VIP: true, Price: 10000},
		{N: 2, Name: "Salle 2 · VIP", Rows: 6, Cols: 10, Aisles: []int{5}, VIP: true, Price: 10000},
		{N: 3, Name: "Salle 3", Rows: 11, Cols: 20, Aisles: []int{4, 16}, Price: 4500},
		{N: 4, Name: "Salle 4", Rows: 11, Cols: 20, Aisles: []int{4, 16}, Price: 4500},
		{N: 5, Name: "Salle 5", Rows: 11, Cols: 20, Aisles: []int{4, 16}, Price: 4500},
		{N: 6, Name: "Salle 6", Rows: 11, Cols: 20, Aisles: []int{4, 16}, Price: 4500},
	}},
	KineoSococe: {ID: KineoSococe, Name: "Kinéo Sococé", Opens: 14, Films: 3, Salles: []Salle{
		{N: 1, Name: "Salle unique", Rows: 12, Cols: 15, Aisles: []int{3, 12}, Price: 3500},
	}},
}

// Showing: a film on a screen at a game minute.
type Showing struct {
	Film  string `json:"film"`
	Salle int    `json:"salle"`
	At    int64  `json:"at"`
	Price int    `json:"price"`
	VIP   bool   `json:"vip,omitempty"`
}

// OnThisWeek: the eight films on this week (the game's weeks start on Monday).
func OnThisWeek(day int64) []Film {
	week := int(day / 7)
	out := make([]Film, 0, 8)
	for k := 0; k < 8; k++ {
		out = append(out, Films[(week*3+k)%len(Films)])
	}
	return out
}

// Program: the sessions of a cinema on a game day, by screen and time.
func Program(cinema string, day int64) []Showing {
	c, ok := Cinemas[cinema]
	if !ok {
		return nil
	}
	films := OnThisWeek(day)
	// Friday and Saturday nights, a late session more.
	weekday := day % 7
	last := int64(23 * 60)
	if weekday == 4 || weekday == 5 {
		last = 23*60 + 45
	}
	var out []Showing
	for i, s := range c.Salles {
		// Each screen its films of the week, in turn (the VIP screens the biggest ones).
		mine := make([]Film, 0, c.Films)
		for k := 0; k < c.Films; k++ {
			mine = append(mine, films[(i*c.Films+k+int(day))%len(films)])
		}
		t := int64(c.Opens*60) + int64(i%3)*20
		for k := 0; t <= last; k++ {
			f := mine[k%len(mine)]
			out = append(out, Showing{Film: f.ID, Salle: s.N, At: day*1440 + t, Price: s.Price, VIP: s.VIP})
			// The film, the ads before it and the cleaning after, to the next quarter hour.
			t += int64((f.Minutes+25+14)/15) * 15
		}
	}
	return out
}

// FindShowing: the session of a screen at that minute, if there is one.
func FindShowing(cinema string, salle int, at int64) (Showing, bool) {
	for _, s := range Program(cinema, at/1440) {
		if s.Salle == salle && s.At == at {
			return s, true
		}
	}
	return Showing{}, false
}

// FindSalle: a screen of a cinema.
func FindSalle(cinema string, n int) (Salle, bool) {
	for _, s := range Cinemas[cinema].Salles {
		if s.N == n {
			return s, true
		}
	}
	return Salle{}, false
}

// SeatName: « F7 » for row 5 (0 is the front, A) and seat 6 (0-based).
func SeatName(row, col int) string { return fmt.Sprintf("%c%d", 'A'+row, col+1) }

// ParseSeat: row and seat back from « F7 », within the screen.
func ParseSeat(s Salle, name string) (int, int, bool) {
	if len(name) < 2 {
		return 0, 0, false
	}
	row := int(name[0] - 'A')
	var col int
	if _, err := fmt.Sscanf(name[1:], "%d", &col); err != nil {
		return 0, 0, false
	}
	col--
	if row < 0 || row >= s.Rows || col < 0 || col >= s.Cols || SeatName(row, col) != name {
		return 0, 0, false
	}
	return row, col, true
}

// SeatTaken: whether someone of the town (not a player) has that seat, the same for everyone:
// fuller in the evening and at the weekend, for the films that draw, and in the middle of the room.
func SeatTaken(cinema string, sh Showing, row, col int, s Salle) bool {
	f, _ := FindFilm(sh.Film)
	hour := (sh.At % 1440) / 60
	p := 0.12
	switch {
	case hour >= 18:
		p = 0.5
	case hour >= 15:
		p = 0.28
	}
	if wd := (sh.At / 1440) % 7; wd >= 4 {
		p += 0.18
	}
	if s.VIP {
		p -= 0.08
	}
	p *= f.Draw
	// The middle seats go first, the front row last.
	mid := 1 - absf(float64(col)-float64(s.Cols-1)/2)/float64(s.Cols)
	p *= 0.7 + 0.6*mid
	if row == 0 {
		p *= 0.4
	}
	h := fnv.New32a()
	fmt.Fprintf(h, "%s/%d/%d/%d/%d", cinema, sh.Salle, sh.At, row, col)
	return float64(h.Sum32()%10000)/10000 < p
}

func absf(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
