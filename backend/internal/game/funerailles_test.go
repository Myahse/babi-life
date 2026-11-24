package game

import "testing"

func TestFunerals(t *testing.T) {
	prev := Funeral{}
	for i, f := range Funerals {
		if _, ok := FindFuneral(f.ID); !ok {
			t.Fatalf("%s introuvable", f.ID)
		}
		pays := FuneralPays(f)
		if pays <= 0 || pays >= f.Cost {
			t.Errorf("%s : payé %d sur %d", f.ID, pays, f.Cost)
		}
		// Each one costs more and brings more renom than the one before.
		if i > 0 && (f.Cost <= prev.Cost || f.Renom <= prev.Renom) {
			t.Errorf("%s pas au-dessus de %s", f.ID, prev.ID)
		}
		prev = f
	}
	if FuneralPays(Funerals[0]) != 15000 {
		t.Errorf("simples : %d", FuneralPays(Funerals[0]))
	}
}
