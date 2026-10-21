package game

import "testing"

func TestCinemaProgram(t *testing.T) {
	for id, c := range Cinemas {
		for day := int64(0); day < 14; day++ {
			p := Program(id, day)
			if len(p) < len(c.Salles)*4 {
				t.Fatalf("%s day %d: only %d sessions", id, day, len(p))
			}
			end := map[int]int64{}
			for _, s := range p {
				f, ok := FindFilm(s.Film)
				if !ok {
					t.Fatalf("unknown film %s", s.Film)
				}
				if s.At/1440 != day || s.At%1440 < int64(c.Opens*60) {
					t.Fatalf("%s: a session outside its day or before opening: %d", id, s.At)
				}
				// One film at a time on a screen.
				if s.At < end[s.Salle] {
					t.Fatalf("%s salle %d: %s starts before the last one is over", id, s.Salle, f.Title)
				}
				end[s.Salle] = s.At + int64(f.Minutes)
				if got, ok := FindShowing(id, s.Salle, s.At); !ok || got != s {
					t.Fatal("a session isn't found again")
				}
			}
		}
	}
}

func TestCinemaSeats(t *testing.T) {
	s, _ := FindSalle(KineoCapSud, 3)
	for _, name := range []string{"A1", "K20", "F7"} {
		r, c, ok := ParseSeat(s, name)
		if !ok || SeatName(r, c) != name {
			t.Fatalf("%s doesn't parse", name)
		}
	}
	for _, bad := range []string{"L1", "A21", "A0", "F", "f7", "F07"} {
		if _, _, ok := ParseSeat(s, bad); ok {
			t.Fatalf("%s parses", bad)
		}
	}
	// Fuller on a Saturday night than on a Monday morning.
	full := func(sh Showing) int {
		n := 0
		for r := 0; r < s.Rows; r++ {
			for c := 0; c < s.Cols; c++ {
				if SeatTaken(KineoCapSud, sh, r, c, s) {
					n++
				}
			}
		}
		return n
	}
	monday := full(Showing{Film: "babi-express", Salle: 3, At: 7*1440 + 11*60})
	saturday := full(Showing{Film: "babi-express", Salle: 3, At: 12*1440 + 21*60})
	if monday >= saturday || saturday > s.Rows*s.Cols*9/10 || monday == 0 {
		t.Fatalf("seats taken: %d on Monday morning, %d on Saturday night (of %d)", monday, saturday, s.Rows*s.Cols)
	}
}
