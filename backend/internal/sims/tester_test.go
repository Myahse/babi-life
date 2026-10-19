package sims

import (
	"testing"

	"github.com/myahse/babi-life/backend/internal/adminkey"
	"github.com/myahse/babi-life/backend/internal/game"
)

func TestTesterPass(t *testing.T) {
	adminkey.Master = "la-cle"
	defer func() { adminkey.Master = "" }()
	if testerPass("") || testerPass("nimporte") || !testerPass("la-cle") {
		t.Error("only the testers' code or the admin key")
	}
}

func TestTesterGrowsUp(t *testing.T) {
	s := newBaby("poignon")
	ev, err := s.testerAge(game.StageAdulte)
	if err != nil || s.stage().ID != game.StageAdulte || s.Housing != "studio" || !hasText(ev, "quitte la maison") || !s.hasApp("waye") {
		t.Fatalf("a baby made adult goes through leaving home: %v %v %s", err, ev, s.Housing)
	}
	if _, err := s.testerAge(game.StageBebe); err != nil || s.stage().ID != game.StageBebe {
		t.Errorf("and back to a baby: %v", err)
	}
	legacy := Sim{FirstName: "Awa", GameMinutes: 1_000_000}
	if _, err := legacy.testerAge(game.StageEnfant); err != nil || legacy.stage().ID != game.StageEnfant || legacy.Family == "" {
		t.Errorf("a Sim from before births gets an age and a family: %v", err)
	}
	if ev, _ := s.testerDo(TesterAction{Action: "money", Amount: 1 << 40}); s.Money < TesterMaxMoney || ev[0].Money != TesterMaxMoney {
		t.Error("money is capped per tap")
	}
}
