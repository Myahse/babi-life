package sims

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The street lived in passing (the update « rue-vivante-gestes », web world3d/open/rueGestes.tsx): what
// one does with a single tap when the Sim walks by something, played on the spot for a few seconds,
// never an activity (the Sim walks on whenever the player moves). Sit on a bench, a low wall or a
// maquis's plastic chair; buy a cornet of alloco, a garba, a brochette, a sachet of water, phone credit
// or the paper from the sellers who walk the street; kick the ball back to the children, a few
// keepy-uppies, skip rope with them; greet a passer-by or another player; pet a goat or a hen; a coin
// for a talibé; help a tantie lift her basin; push a broken-down car; a selfie at a landmark. The
// purchases cost what the street's sellers ask (docs/economie.md); the rest is free, a little mood.
// Each its own cooldown (the same tap again straight away does nothing more); the free ones counted a
// day (game.GestesDone): past it they're still played, without the reward.

// GestesKey: the update that opens them (features.go).
const GestesKey = "rue-vivante-gestes"

type geste struct {
	cost   int
	effect game.Needs
	// From, until (hours of the game day; 0, 0: any time).
	from, until int
	cool        time.Duration
	// What's said back (one, by the game minute).
	said []string
	// Why not now (outside its hours).
	shut string
}

var gestes = map[string]geste{
	"assis":     {effect: game.Needs{Energy: 3, Fun: 1}, cool: 60 * time.Second, said: []string{"Tu t'assois un moment, tu regardes la rue passer.", "Ça fait du bien de se poser un peu !"}},
	"alloco":    {cost: 300, effect: game.Needs{Hunger: 12, Fun: 1}, from: 8, until: 23, cool: 45 * time.Second, said: []string{"Un cornet d'alloco bien chaud, avec le piment. Prends !"}, shut: "L'alloco, c'est de 8 h à 23 h."},
	"garba":     {cost: 500, effect: game.Needs{Hunger: 20, Social: 1}, from: 9, until: 24, cool: 60 * time.Second, said: []string{"Garba, petit morceau, piment à côté. Bon appétit !"}, shut: "Le garba, c'est à partir de 9 h."},
	"brochette": {cost: 500, effect: game.Needs{Hunger: 14, Fun: 2}, from: 16, until: 24, cool: 45 * time.Second, said: []string{"Deux brochettes bien grillées, avec l'oignon. Bon appétit !"}, shut: "Les brochettes, c'est le soir, à partir de 16 h."},
	"eau":       {cost: 50, effect: game.Needs{Energy: 4, Hunger: 1}, from: 7, until: 22, cool: 30 * time.Second, said: []string{"Eau glacée, bien fraîche !"}, shut: "Le vendeur d'eau passe de 7 h à 22 h."},
	"credit":    {cost: 500, effect: game.Needs{Social: 6}, from: 6, until: 22, cool: 90 * time.Second, said: []string{"Crédit chargé. Allô, maman ?"}, shut: "Le vendeur de crédit est là de 6 h à 22 h."},
	"journal":   {cost: 200, effect: game.Needs{Fun: 4, Social: 1}, from: 6, until: 20, cool: 90 * time.Second, said: []string{"Le journal du jour : la politique, le foot, les petites annonces."}, shut: "Le vendeur de journaux passe de 6 h à 20 h."},
	"ballon":    {effect: game.Needs{Fun: 4, Social: 2, Energy: -1}, from: 7, until: 20, cool: 15 * time.Second, said: []string{"« Merci tonton ! » Les enfants repartent avec le ballon.", "« Encore, encore ! » Les enfants applaudissent."}},
	"jongles":   {effect: game.Needs{Fun: 5, Energy: -2}, from: 7, until: 20, cool: 20 * time.Second, said: []string{"Un, deux, trois… dix jongles ! Les enfants comptent avec toi."}},
	"corde":     {effect: game.Needs{Fun: 5, Social: 2, Energy: -3}, from: 7, until: 20, cool: 20 * time.Second, said: []string{"Tu sautes à la corde avec les petites : « Encore ! »"}},
	"saluer":    {effect: game.Needs{Social: 3}, cool: 6 * time.Second, said: []string{"« On dit quoi ? » « On est là ! »", "« Bonne arrivée ! » « Merci, la famille ? »", "« Ça va un peu ? » « Ça va, Dieu merci ! »"}},
	"joueur":    {effect: game.Needs{Social: 4}, cool: 15 * time.Second, said: []string{"« On dit quoi ? »"}},
	"cabri":     {effect: game.Needs{Fun: 3}, cool: 20 * time.Second, said: []string{"Le cabri bêle et te pousse la main avec sa tête.", "Le cabri se laisse caresser."}},
	"poule":     {effect: game.Needs{Fun: 2}, cool: 20 * time.Second, said: []string{"La poule caquette et s'en va en courant !"}},
	"talibe":    {cost: 50, effect: game.Needs{Social: 3, Fun: 1}, cool: 60 * time.Second, said: []string{"« Que Dieu te bénisse ! »", "« Merci, que Dieu te donne longue vie ! »"}},
	"bassine":   {effect: game.Needs{Social: 5, Fun: 1, Energy: -2}, from: 6, until: 20, cool: 60 * time.Second, said: []string{"Vous soulevez la bassine ensemble : « Merci mon enfant, que Dieu te garde ! »"}},
	"panne":     {effect: game.Needs{Social: 5, Fun: 2, Energy: -4, Hygiene: -2}, cool: 60 * time.Second, said: []string{"Un, deux, trois, poussez ! Le moteur tousse… et démarre : « Merci, les gars ! »"}},
	"selfie":    {effect: game.Needs{Fun: 5, Social: 1}, cool: 20 * time.Second, said: []string{"Clic ! Le selfie est dans ta galerie."}},
}

var (
	errGesteUnknown = errors.New("geste inconnu")
	errGesteSoon    = errors.New("doucement : attends un peu avant de recommencer")
	errGesteBaby    = errors.New("un bébé ne fait pas ça tout seul")
)

// gesteClock: when each Sim last did each gesture (in memory: a restart only forgets a few seconds' waits).
var gesteClock = struct {
	sync.Mutex
	at map[string]time.Time
}{at: map[string]time.Time{}}

// gesteReady: the gesture's cooldown over for this Sim (and started again from now if so).
func gesteReady(sim, kind string, cool time.Duration, now time.Time) bool {
	gesteClock.Lock()
	defer gesteClock.Unlock()
	k := sim + "|" + kind
	if t, ok := gesteClock.at[k]; ok && now.Sub(t) < cool {
		return false
	}
	// (Kept small: the old ones dropped now and then.)
	if len(gesteClock.at) > 20000 {
		for key, t := range gesteClock.at {
			if now.Sub(t) > 10*time.Minute {
				delete(gesteClock.at, key)
			}
		}
	}
	gesteClock.at[k] = now
	return true
}

// doGeste: the gesture done, or why not. The money and the needs it brings; what's said back.
func (s *Sim) doGeste(kind string, now time.Time) (string, int, error) {
	g, ok := gestes[kind]
	if !ok {
		return "", 0, errGesteUnknown
	}
	if features.Default.BlocksKey(context.Background(), GestesKey) != "" {
		return "", 0, errors.New("bientôt dans le jeu")
	}
	if s.Activity != nil {
		return "", 0, game.ErrBusy
	}
	if s.stage().ID == game.StageBebe {
		return "", 0, errGesteBaby
	}
	if h := game.HourOf(s.GameMinutes); g.until > 0 && (h < g.from || h >= g.until) {
		return "", 0, errors.New(g.shut)
	}
	if s.Money < g.cost {
		return "", 0, game.ErrNotEnoughMoney
	}
	if !gesteReady(s.ID, kind, g.cool, now) {
		return "", 0, errGesteSoon
	}
	said := g.said[int(s.GameMinutes)%len(g.said)]
	if g.cost > 0 {
		s.Money -= g.cost
		s.Needs = s.Needs.Add(g.effect)
		return said, g.cost, nil
	}
	// Free: the reward a good number of times a day, then just the gesture.
	w := s.wallet()
	if w.Can(s.today(), game.GestesDone) {
		w.Use(s.today(), game.GestesDone)
		s.Needs = s.Needs.Add(g.effect)
	}
	return said, 0, nil
}

// geste: POST /sims/{id}/geste {kind, to} — a street gesture (to: the player greeted, for « joueur »).
func (h *Handler) geste(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind string `json:"kind"`
		To   string `json:"to"`
	}
	if err := httpx.Decode(r, &req); err != nil || len(req.Kind) > 20 || len(req.To) > 80 {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	var from, name string
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		said, cost, err := s.doGeste(req.Kind, time.Now())
		if err != nil {
			return game.Outcome{}, nil, err
		}
		from, name = s.ID, s.FirstName
		return game.Outcome{Text: said, Money: -cost}, nil, nil
	})
	// The player greeted sees it on their screen: a bubble over this Sim (web lib/live.ts GESTE_IN).
	if req.Kind == "joueur" && req.To != "" && from != "" && req.To != from {
		h.notify(req.To, map[string]any{"t": "geste", "from": from, "name": name, "text": "On dit quoi ?"})
	}
}
