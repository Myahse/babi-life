package world

import "testing"

func TestTrainQuote(t *testing.T) {
	day := int64(3 * 24 * 60)
	// The banlieue train at 8 h: the next one within the quarter hour, a ticket, a few stops.
	m, fare, path, long, at, ok := TrainQuote("abidjan", "treichville", "abidjan", "abobo", day+8*60)
	if !ok || long || fare != Train.Fare || at < day+8*60 || at > day+8*60+int64(Train.Every) || len(path.Points) != 4 || m < 10 {
		t.Fatalf("banlieue: %d min, %d F, %d points, long %v, at %d, ok %v", m, fare, len(path.Points), long, at, ok)
	}
	// None at night.
	if _, _, _, _, _, ok := TrainQuote("abidjan", "plateau", "abidjan", "anyama", day+23*60); ok {
		t.Fatal("a banlieue train at 23 h")
	}
	// To Bouaké at 9 h: the 14 h 30, its time on the way after it leaves.
	m, fare, _, long, at, ok = TrainQuote("abidjan", "adjame", "bouake", "bouake-centre", day+9*60)
	if !ok || !long || fare != Train.LongFare || at != day+14*60+30 || m != at-(day+9*60)+int64(Train.LongMinutes) {
		t.Fatalf("grande ligne: %d min, %d F, long %v, at %d, ok %v", m, fare, long, at, ok)
	}
	// After the last of the day, none; not from a commune without a station; never to the same.
	if _, _, _, _, _, ok := TrainQuote("bouake", "bouake-centre", "abidjan", "treichville", day+20*60); ok {
		t.Fatal("a grande ligne after the last")
	}
	if _, _, _, _, _, ok := TrainQuote("abidjan", "cocody", "abidjan", "plateau", day+8*60); ok {
		t.Fatal("a train from Cocody")
	}
	if _, _, _, _, _, ok := TrainQuote("abidjan", "plateau", "abidjan", "plateau", day+8*60); ok {
		t.Fatal("a train to the same station")
	}
	// Every station is a commune of the game.
	for _, s := range Train.Stations {
		if _, _, ok := FindCommune(s.City, s.Commune); !ok {
			t.Fatalf("%s: no commune %s/%s", s.Name, s.City, s.Commune)
		}
	}
}
