package sims

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Le mode vie's objects that wear and break (the update « mode-vie », game/objets.go; web
// world3d/objetsPanne.tsx, components/LifeHome.tsx). Each action done at home on one of the house's
// things wears it (objUsed, from lifeDone), the finer pieces slower; the more worn, the likelier one use
// breaks it. Broken (Life.Objects), what's done on it is refused (objBlocks, from start) and a mood holds
// while it lasts (objSync, from lifeSync). « Réparer » (the home's reparer-<object>) is done like any
// action, its end decides by the bricolage (repairDone): mended, or not, maybe with a small shock; the
// repairman (POST objets/{obj}/reparateur) is paid at once, comes, and has mended it RepairmanMinutes on.

var (
	errNoObject   = errors.New("objet inconnu")
	errNotBroken  = errors.New("rien à réparer : ça marche")
	errProComing  = errors.New("le réparateur est déjà en route")
	errObjAtHome  = errors.New("rentre d'abord chez toi")
	errFixingSelf = errors.New("ton perso est en train de le réparer")
)

// objState: the object's state, made if there's none.
func (s *Sim) objState(id string) *game.ObjState {
	if s.Life.Objects == nil {
		s.Life.Objects = map[string]*game.ObjState{}
	}
	st := s.Life.Objects[id]
	if st == nil {
		st = &game.ObjState{}
		s.Life.Objects[id] = st
	}
	return st
}

// broken: the object `id` is broken (and le mode vie open).
func (s *Sim) broken(id string) bool {
	if !s.lifeOn || s.Life.Objects == nil {
		return false
	}
	st := s.Life.Objects[id]
	return st != nil && st.Broken != 0
}

// objPiece: the finest piece of the house that is this object (its tier, its price); the plainest when
// the house isn't one's own (the family's, a rented one: the ordinary furniture).
func (s *Sim) objPiece(o game.HomeObject) game.Furniture {
	best, _ := game.FindFurniture(o.Base)
	if s.Housing != game.OwnHouse {
		return best
	}
	rank := map[string]int{"": 0, game.TierConfort: 1, game.TierPrestige: 2}
	for _, id := range s.Furnished {
		f, ok := game.FindFurniture(id)
		if ok && (f.ID == o.Base || f.Base == o.Base) && rank[f.Tier] >= rank[best.Tier] {
			best = f
		}
	}
	return best
}

// objUsed: an action done at home wears the object it's done on; it may break. A line when it does.
func (s *Sim) objUsed(a *game.Activity, rng *rand.Rand) []Event {
	if !s.lifeOn || a.PlaceID != HomePlaceID {
		return nil
	}
	id := game.ObjectUsed(a.Interaction.ID)
	o, ok := game.ObjectOf(id)
	if !ok || (s.Housing == game.OwnHouse && !s.furnishedWith(o.Base)) {
		return nil
	}
	st := s.objState(id)
	if st.Broken != 0 {
		return nil
	}
	st.Wear = min(100, st.Wear+game.WearPerUse(s.objPiece(o).Tier))
	if rng.Float64() >= game.BreakChance(st.Wear) {
		return nil
	}
	st.Broken = s.GameMinutes
	return []Event{{Kind: "life", Text: fmt.Sprintf("%s ! Il faut le réparer (ou appeler un réparateur).", o.Broken), GameTime: s.GameMinutes}}
}

// objBlocks: what's done on a broken object is refused (and mending it asks for it to be broken).
func (s *Sim) objBlocks(interactionID, placeID string) error {
	if !s.lifeOn || placeID != HomePlaceID {
		return nil
	}
	if id := game.RepairOf(interactionID); id != "" {
		if !s.broken(id) {
			return errNotBroken
		}
		if s.Life.Objects[id].Pro != 0 {
			return errProComing
		}
		return nil
	}
	if id := game.ObjectUsed(interactionID); id != "" && s.broken(id) {
		o, _ := game.ObjectOf(id)
		return fmt.Errorf("%s : répare-le d'abord (touche-le)", o.Broken)
	}
	return nil
}

// repairDone: a repair done to its end: mended by the bricolage's level, or not (maybe a shock). It
// trains the bricolage either way, more when it works.
func (s *Sim) repairDone(a *game.Activity, rng *rand.Rand) []Event {
	id := game.RepairOf(a.Interaction.ID)
	if id == "" || !s.broken(id) {
		return nil
	}
	o, _ := game.ObjectOf(id)
	st := s.Life.Objects[id]
	var text string
	if rng.Float64() < game.RepairChance(s.skillLevel("bricolage")) {
		st.Broken, st.Wear = 0, 10
		st.Fixed++
		s.addMood("repare", "")
		text = fmt.Sprintf("Réparé ! %s marche de nouveau.", o.Label)
		return append([]Event{{Kind: "life", Text: text, GameTime: s.GameMinutes}}, s.gainSkill("bricolage", 40)...)
	}
	if rng.Float64() < game.ShockChance(o) {
		s.addMood("decharge", "")
		s.Needs = s.Needs.Add(game.Needs{Energy: -8, Fun: -8})
		text = fmt.Sprintf("Bzzt ! Une petite décharge… %s est toujours en panne.", o.Label)
	} else {
		text = fmt.Sprintf("Raté : %s ne marche toujours pas.", game.LowerFirst(o.Label))
	}
	return append([]Event{{Kind: "life", Text: text, GameTime: s.GameMinutes}}, s.gainSkill("bricolage", 20)...)
}

// objSync: the repairmen who are done have mended theirs; the broken things weigh on the mood at home.
func (s *Sim) objSync(atHome bool) {
	now := s.GameMinutes
	seen := map[string]bool{}
	for _, o := range game.HomeObjects {
		st := s.Life.Objects[o.ID]
		if st == nil || st.Broken == 0 {
			continue
		}
		if st.Pro != 0 && now >= st.Pro {
			st.Broken, st.Wear, st.Pro, st.ProAt = 0, 0, 0, 0
			st.Fixed++
			s.pending = append(s.pending, Event{Kind: "life", Text: fmt.Sprintf("Le réparateur a fini : %s marche comme neuve.", game.LowerFirst(o.Label)), GameTime: now})
			continue
		}
		if atHome && !seen[o.Mood] {
			seen[o.Mood] = true
			m := game.NewMoodlet(o.Mood, "", now)
			m.Need, m.Until = true, now+30
			s.Life.Moodlets = append(s.Life.Moodlets, m)
		}
	}
}

// callRepairman: the repairman called for the object: paid now (a child's family pays), here in a moment.
func (s *Sim) callRepairman(id string) (game.Outcome, error) {
	o, ok := game.ObjectOf(id)
	if !ok {
		return game.Outcome{}, errNoObject
	}
	if s.City != s.HomeCity || s.Commune != s.HomeCommune || s.Stay != nil {
		return game.Outcome{}, errObjAtHome
	}
	if !s.broken(id) {
		return game.Outcome{}, errNotBroken
	}
	st := s.Life.Objects[id]
	if st.Pro != 0 {
		return game.Outcome{}, errProComing
	}
	if a := s.Activity; a != nil && game.RepairOf(a.Interaction.ID) == id {
		return game.Outcome{}, errFixingSelf
	}
	cost := game.RepairmanCost(s.objPiece(o).Price)
	if s.minor() {
		cost = 0
	}
	if s.Money < cost {
		return game.Outcome{}, game.ErrNotEnoughMoney
	}
	s.Money -= cost
	st.ProAt, st.Pro = s.GameMinutes, s.GameMinutes+game.RepairmanMinutes
	text := fmt.Sprintf("Le réparateur arrive pour %s.", game.LowerFirst(o.Label))
	if cost == 0 {
		text = fmt.Sprintf("Papa appelle le réparateur pour %s.", game.LowerFirst(o.Label))
	}
	return game.Outcome{Text: text, Money: -cost}, nil
}

// repairman: POST /sims/{id}/objets/{obj}/reparateur.
func (h *Handler) repairman(w http.ResponseWriter, r *http.Request) {
	if !lifeModeOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, errLifeClosed.Error())
		return
	}
	id := chi.URLParam(r, "obj")
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		out, err := s.callRepairman(id)
		if err != nil {
			return out, nil, err
		}
		return out, []Event{{Kind: "life", Text: out.Text, Money: out.Money, GameTime: s.GameMinutes}}, nil
	})
}

// objetsList: GET /objets — the house's things that break, and what the repairman asks for each piece.
func objetsList(w http.ResponseWriter, r *http.Request) {
	type piece struct {
		ID   string `json:"id"`
		Base string `json:"base"`
		Tier string `json:"tier,omitempty"`
		Cost int    `json:"cost"`
	}
	var pieces []piece
	for _, f := range game.Furnitures {
		base := f.Base
		if base == "" {
			base = f.ID
		}
		if isObjectBase(base) {
			pieces = append(pieces, piece{f.ID, base, f.Tier, game.RepairmanCost(f.Price)})
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"objects": game.HomeObjects, "pieces": pieces})
}

// isObjectBase: a furniture id that is one of the objects' plainest (game.HomeObjects' Base).
func isObjectBase(base string) bool {
	for _, o := range game.HomeObjects {
		if o.Base == base {
			return true
		}
	}
	return false
}
