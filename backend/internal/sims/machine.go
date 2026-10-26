package sims

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Les machines à sous (game/slots.go, web components/Machine.tsx): playing
// one is an activity at the maquis or at the Hôtel Ivoire's casino; while it
// lasts, each spin is played here, for a stake the machine takes. The spin
// is drawn on the server, the stake taken and what it wins paid at once.
// Adults only (the Sim grown up and the account 18 or over), the game's money
// only, SlotsPerDay spins a day an account.

var (
	errNoMachine  = errors.New("installe-toi d'abord devant une machine à sous")
	errSlotStake  = errors.New("cette machine ne prend pas cette mise")
	errSlotsMinor = errors.New("les machines à sous, c'est à partir de 18 ans")
)

// machineSpin: POST /sims/{id}/machine {stake} — the reels turned once.
func (h *Handler) machineSpin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Stake int `json:"stake"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if adult, err := accountAdult(ctx, tx); err != nil || !adult {
			return game.Outcome{}, nil, errNotAdult
		}
		// Seeded from the system's own randomness: no spin can be foreseen.
		return s.spin(req.Stake, rand.New(rand.NewPCG(rand.Uint64(), rand.Uint64())))
	})
}

// spin: one turn of the machine the Sim is playing.
func (s *Sim) spin(stake int, rng *rand.Rand) (game.Outcome, []Event, error) {
	a := s.Activity
	if a == nil || a.Kind != "do" || !game.IsSlots(a.Interaction.ID) || a.End <= s.GameMinutes {
		return game.Outcome{}, nil, errNoMachine
	}
	if s.stage().ID != game.StageAdulte {
		return game.Outcome{}, nil, errSlotsMinor
	}
	if usual := game.SlotStakes[a.Interaction.ID]; !game.StakeIn(stake, usual) {
		return game.Outcome{}, nil, fmt.Errorf("%w : de %s à %s Djai", errSlotStake, money(usual[0]), money(usual[len(usual)-1]))
	}
	if s.Money < stake {
		return game.Outcome{}, nil, game.ErrNotEnoughMoney
	}
	if !s.wallet().Can(s.today(), game.Slots) {
		return game.Outcome{}, nil, game.ErrFull(game.Slots)
	}
	s.wallet().Use(s.today(), game.Slots)
	sp := game.Spin(rng)
	win := stake * sp.Times
	s.Money += win - stake
	if a.Machine == nil {
		a.Machine = &game.SlotSession{}
	}
	m := a.Machine
	m.Last, m.Stake = &sp, stake
	m.Spins++
	m.Staked += stake
	m.Won += win
	text := "Perdu : les rouleaux ne donnent rien."
	switch {
	case sp.Times == 1:
		text = sp.Line + "."
	case win > 0:
		text = fmt.Sprintf("%s Tu gagnes %s.", strings.TrimSuffix(sp.Line, " !")+" !", game.FCFA(win))
	}
	// A big win goes in the journal (the rest is told at the end of the session).
	var events []Event
	if sp.Times >= 30 {
		events = append(events, Event{Kind: "interaction", Text: fmt.Sprintf("%s — machine à sous : %s Tu gagnes %s.", a.PlaceName, sp.Line, game.FCFA(win)), Money: win - stake, GameTime: s.GameMinutes})
	}
	return game.Outcome{Text: text, Money: win - stake}, events, nil
}

// machineNote: a session at the machine, told at its end: the spins, and what it came to.
func machineNote(a *game.Activity) (string, int, bool) {
	m := a.Machine
	if m == nil || m.Spins == 0 {
		return "", 0, false
	}
	net := m.Won - m.Staked
	tours := "tour"
	if m.Spins > 1 {
		tours += "s"
	}
	switch {
	case net > 0:
		return fmt.Sprintf(" · %d %s, %s gagnés", m.Spins, tours, game.FCFA(net)), net, true
	case net < 0:
		return fmt.Sprintf(" · %d %s, %s perdus", m.Spins, tours, game.FCFA(-net)), net, true
	}
	return fmt.Sprintf(" · %d %s, ni gagné ni perdu", m.Spins, tours), 0, true
}
