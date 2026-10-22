package game

import "testing"

// Every vehicle can be kept somewhere, is drawn by a known body, and comes in colours.
func TestVehicleModels(t *testing.T) {
	bodies := map[string]bool{"velo": true, "moto": true, "saloon": true, "berline": true, "suv": true, "4x4": true, "limo": true}
	for _, m := range VehicleModels {
		if !bodies[m.Body] {
			t.Errorf("%s: body %q", m.ID, m.Body)
		}
		if len(m.Colors) == 0 || m.Price <= 0 || m.TopSpeed <= 0 {
			t.Errorf("%s: %+v", m.ID, m)
		}
		if (m.Kind == "velo") != (m.FuelPerKm == 0) {
			t.Errorf("%s: petrol %d on a %s", m.ID, m.FuelPerKm, m.Kind)
		}
		kept := false
		for _, p := range ParkingKinds {
			kept = kept || p.For == m.Kind
		}
		if !kept {
			t.Errorf("%s: nowhere to keep a %s", m.ID, m.Kind)
		}
	}
}
