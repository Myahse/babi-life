package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/world"
)

func TestStoreInstallsApps(t *testing.T) {
	s := newSim()
	if err := s.install("golvo", true); err != nil || !s.hasApp("golvo") {
		t.Fatalf("install: %v %v", err, s.Apps)
	}
	_ = s.install("golvo", true)
	if len(s.Apps) != 1 {
		t.Errorf("installing twice keeps one copy: %v", s.Apps)
	}
	if _ = s.install("golvo", false); s.hasApp("golvo") {
		t.Error("uninstall")
	}
	if err := s.install("whatsapp", true); err != errUnknownApp {
		t.Errorf("unknown app: %v", err)
	}
}

func TestWayeSendsWithAOnePercentFee(t *testing.T) {
	s := newSim()
	if _, err := s.send("maman", 5000); err == nil {
		t.Fatal("Waye must be installed")
	}
	s.Apps = []string{"waye"}
	social := s.Needs.Social
	ev, err := s.send("maman", 5000)
	if err != nil || s.Money != 10000-5050 || ev.Money != -5050 {
		t.Fatalf("5 000 F + 50 F fee: money %d ev %+v err %v", s.Money, ev, err)
	}
	if s.Needs.Social <= social {
		t.Error("sending money home should lift Social")
	}
	if world.SendFee(1_000_000) != 5000 {
		t.Error("fees are capped at 5 000 F")
	}
	if _, err := s.send("maman", 100000); err == nil {
		t.Error("can't send more than you have")
	}
}

func TestGolvoDeliversAndTheSimEats(t *testing.T) {
	s := newSim() // in Yopougon at noon, 10 000 F
	if err := s.order("marcory-bietry", "garba"); err == nil {
		t.Fatal("Golvo must be installed")
	}
	s.Apps = []string{"golvo"}
	if err := s.order("yop-rue-princesse", "brochettes"); err != errPlaceClosed {
		t.Errorf("the Rue Princesse closed in 2011: %v", err)
	}
	if err := s.order("marcory-bietry", "cheeseburger"); err != errNoDish {
		t.Errorf("not on the menu: %v", err)
	}
	if err := s.order("marcory-zone4", "plateau"); err == nil {
		t.Error("the club kitchen is closed at noon")
	}
	fee, _, _ := world.DeliveryQuote("abidjan", "marcory", "yopougon")
	if err := s.order("marcory-bietry", "garba"); err != nil || s.Money != 10000-1000-fee || s.Activity == nil {
		t.Fatalf("garba from Biétry: money %d fee %d err %v", s.Money, fee, err)
	}
	near, _, _ := world.DeliveryQuote("abidjan", "yopougon", "yopougon")
	if near != world.DeliveryBase || fee <= near {
		t.Errorf("delivery costs more from further away: %d vs %d", fee, near)
	}
}
