package sims

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"math/rand/v2"
	"net/http"
	"slices"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Le mode vie's wishes (« envies », the update « mode-vie », game/envies.go; web components/Envies.tsx).
// Up to three at a time, kept in the Sim's Life with its points de bonheur and the perks bought. They
// come with the clock (lifeSync: those over go, an empty slot fills a little after), each drawn from
// what fits the Sim now (wishOffer); they're fulfilled where the thing happens (an action ended:
// lifeDone, a word said: lifeChat, a level reached: gainSkill, a mood: addMood, a piece bought: build,
// a game of dames won: Life.Hits, written by dames.go). One can be changed for another a few times a
// game day (dismissWish). The points buy perks (buyPerk), which the needs' decay (decay), the skills
// (lifeDone), the taxi's fare (rideOff) and the queue (web) read.

var (
	errNoWish     = errors.New("cette envie n'est plus là")
	errNoSwap     = errors.New("plus d'envie à changer aujourd'hui : reviens demain")
	errNoPerk     = errors.New("récompense inconnue")
	errHavePerk   = errors.New("tu l'as déjà")
	errFewPoints  = errors.New("pas assez de points de bonheur")
	errLifeClosed = errors.New("bientôt dans le jeu")
)

// hasPerk: the perk `id` bought (and le mode vie open: shut, the perks do nothing).
func (s *Sim) hasPerk(id string) bool { return s.lifeOn && slices.Contains(s.Life.Perks, id) }

// swapsLeft: the wishes that can still be changed today.
func (s *Sim) swapsLeft() int {
	n := game.WishSwaps
	if s.hasPerk("envie-plus") {
		n += game.SwapsPlus
	}
	return max(0, n-s.Life.Swaps)
}

// wishRand: the same draw for the same Sim at the same minute (so a request run twice gives the same wishes).
func (s *Sim) wishRand() *rand.Rand {
	h := fnv.New64a()
	h.Write([]byte(s.ID))
	return rand.New(rand.NewPCG(uint64(s.GameMinutes), h.Sum64()+uint64(len(s.Life.Wishes))+uint64(s.Life.Fulfilled)))
}

// leans: which skill each trait and each aspiration takes to (the skill wishes come more often for them).
var (
	traitSkill  = map[string]string{"gourmand": "cuisine", "sportif": "forme", "artiste": "musique", "ambianceur": "danse", "dragueur": "charisme", "travailleur": "logique"}
	aspireSkill = map[string][]string{"boss": {"logique", "charisme"}, "ambiance": {"danse", "musique"}, "commerce": {"charisme", "logique"}, "foot": {"forme"}, "famille": {"cuisine", "bricolage"}}
	// The skills a child can train at home, and the rest from the teens.
	kidSkills = []string{"forme", "musique", "logique", "bricolage"}
)

// wishOffer: every wish that fits the Sim now, each with how much it's wanted.
func (s *Sim) wishOffer() []game.Wish {
	now := s.GameMinutes
	hour := game.HourOf(now)
	st := s.stage().ID
	adult, baby := st == game.StageAdulte, st == game.StageBebe
	teen := st == game.StageAdo || adult
	has := func(t string) bool { return slices.Contains(s.Traits, t) }
	mood := s.mood().Score
	n := s.Needs
	var out []game.Wish
	add := func(goal, label, icon string, points int, w float64) {
		if w > 0 {
			out = append(out, game.Wish{Goal: goal, Label: label, Icon: icon, Points: points, Weight: w})
		}
	}
	low := func(v float64) float64 { return max(0, (60-v)/30) }
	// The body's wants: more as the need goes down.
	add("mood:bien-mange", "Bien manger", "utensils", 15, 0.3+low(n.Hunger)+b2f(has("gourmand")))
	add("mood:bien-dormi", "Faire une bonne nuit", "bed-double", 15, 0.2+low(n.Energy)+b2f(has("dormeur")))
	if baby {
		if s.parentsHome() {
			add("kin", "Un câlin de papa ou maman", "heart", 20, 2)
		}
		add("fun", "Jouer et rire", "smile", 15, 1+low(n.Fun))
		return out
	}
	add("mood:douche", "Prendre une bonne douche", "shower-head", 15, 0.2+low(n.Hygiene))
	add("fun", "Se changer les idées", "party-popper", 15, low(n.Fun)+b2f(mood <= -2)*1.5)
	if s.hasMood("maison-sale") {
		add("do:faire-menage", "Faire le ménage", "sparkles", 20, 1.5)
	}
	// Cooking: the kédjénou once the cuisine is there for it, else something at the gazinière.
	if adult && s.skillLevel("cuisine") >= 4 {
		add("do:cuisiner-kedjenou", "Cuisiner un kédjénou", "chef-hat", 30, 0.8+b2f(has("gourmand"))+b2f(s.Aspiration == "famille")*0.5)
	} else if teen {
		add("train:cuisine", "Cuisiner quelque chose de bon", "cooking-pot", 15, 0.5+b2f(has("gourmand")))
	}
	// The skills: training one, or a level in it, more in a good mood.
	glad := 1.0
	if mood >= 2 {
		glad = 1.5
	} else if mood <= -2 {
		glad = 0.5
	}
	for _, sk := range game.Skills {
		if sk.ID == "cuisine" || (!teen && !slices.Contains(kidSkills, sk.ID)) {
			continue
		}
		w := 0.35
		if traitSkill[s.firstTrait(sk.ID)] == sk.ID {
			w += 0.8
		}
		if slices.Contains(aspireSkill[s.Aspiration], sk.ID) {
			w += 0.6
		}
		lvl := s.skillLevel(sk.ID)
		if lvl < game.SkillMax && (lvl < 6 || w > 1) {
			add("skill:"+sk.ID, fmt.Sprintf("Monter en %s", strings.ToLower(sk.Label)), sk.Icon, 25+5*lvl, w*glad*0.8)
			out[len(out)-1].Level = lvl + 1
		}
		if sk.ID == "danse" && !teen {
			continue
		}
		add("train:"+sk.ID, trainLabel[sk.ID], sk.Icon, 15, w*glad)
	}
	if st != game.StageAdulte {
		add("do:devoirs", "Faire ses devoirs", "book-open", 15, 0.6+b2f(has("travailleur")))
	}
	if teen {
		add("win:dames", "Gagner aux dames", "grid-3x3", 30, 0.3+b2f(has("travailleur"))*0.5+b2f(slices.Contains(aspireSkill[s.Aspiration], "logique"))*0.4)
	}
	// Going out: the maquis in the evening, the boîte at night, between adults.
	if adult && hour >= 15 && hour < 23 {
		add("place:maquis", "Aller au maquis ce soir", "beer", 25, 0.5+b2f(has("ambianceur"))+b2f(s.Aspiration == "ambiance")+low(n.Social)*0.5)
	}
	if adult && (hour >= 19 || hour < 2) {
		add("place:club", "Sortir en boîte", "disc-3", 25, 0.3+b2f(has("ambianceur"))*0.8+b2f(s.Aspiration == "ambiance")*0.6)
	}
	if adult && s.Career != "" {
		add("mood:salaire", "Toucher sa paie", "banknote", 20, 0.4+b2f(s.Aspiration == "boss")+b2f(has("travailleur"))*0.5)
	}
	// The people: papa and maman at home, the friends (the closest), a quarrel to mend, a flirt.
	if s.parentsHome() {
		add("kin", "Discuter avec papa ou maman", "messages-square", 15, 0.6+low(n.Social)*0.6)
	}
	partner := s.partner()
	friends := make([]*game.Friend, 0, len(s.Friends))
	for i := range s.Friends {
		friends = append(friends, &s.Friends[i])
	}
	slices.SortStableFunc(friends, func(a, b *game.Friend) int { return b.Friendship - a.Friendship })
	chats := 0
	for _, f := range friends {
		switch {
		case f.Enemy:
			add("excuse:"+f.ID, fmt.Sprintf("Se réconcilier avec %s", f.Name), "hand-heart", 30, 0.5)
		case f.Partner:
			add("chat:"+f.ID, fmt.Sprintf("Passer un moment avec %s", f.Name), "heart", 20, 0.9+low(n.Social)*0.5)
		case chats < 2 && f.Friendship >= 10:
			chats++
			add("chat:"+f.ID, fmt.Sprintf("Discuter avec %s", f.Name), "messages-square", 15+f.Friendship/10, 0.5+low(n.Social)*0.5+b2f(has("ambianceur"))*0.3)
			if adult && f.Adult && partner == nil && f.Friendship >= 25 {
				add("flirt:"+f.ID, fmt.Sprintf("Flirter avec %s", f.Name), "heart", 25, 0.2+b2f(has("dragueur")))
			}
		}
	}
	if teen {
		add("player", "Discuter avec un autre joueur", "users", 20, 0.25+low(n.Social)*0.3)
	}
	// Something for the house (one's own): a piece not there yet, within reach.
	if adult && s.Housing == game.OwnHouse {
		for _, id := range []string{"canape", "tele", "ventilo", "frigo"} {
			f, ok := game.FindFurniture(id)
			if ok && !s.furnishedWith(id) && s.Money >= f.Price {
				add("buy:"+id, fmt.Sprintf("Acheter : %s", strings.ToLower(f.Label)), f.Icon, 30, 0.6)
				break
			}
		}
	}
	return out
}

// trainLabel: the wish to train each skill, said as the thing done.
var trainLabel = map[string]string{
	"charisme":  "S'entraîner à parler",
	"forme":     "Faire du sport",
	"bricolage": "Bricoler un peu",
	"musique":   "Jouer de la musique",
	"logique":   "Faire travailler sa tête",
	"danse":     "Danser le coupé-décalé",
}

// firstTrait: the Sim's trait that leans to this skill, "" for none.
func (s *Sim) firstTrait(skill string) string {
	for _, t := range s.Traits {
		if traitSkill[t] == skill {
			return t
		}
	}
	return ""
}

// furnishedWith: a piece of this kind in the house (a finer one counts: its base).
func (s *Sim) furnishedWith(base string) bool {
	return slices.ContainsFunc(s.Furnished, func(id string) bool {
		f, ok := game.FindFurniture(id)
		return id == base || (ok && f.Base == base)
	})
}

func b2f(b bool) float64 {
	if b {
		return 1
	}
	return 0
}

// newWish: a wish drawn for an empty slot, not one already there; false when nothing fits.
func (s *Sim) newWish(rng *rand.Rand) (game.Wish, bool) {
	offer := slices.DeleteFunc(s.wishOffer(), func(w game.Wish) bool {
		return slices.ContainsFunc(s.Life.Wishes, func(x game.Wish) bool { return x.Goal == w.Goal })
	})
	i := game.PickWish(offer, rng.Float64())
	if i < 0 {
		return game.Wish{}, false
	}
	w := offer[i]
	w.Until = s.GameMinutes + game.WishLife
	// Tonight's: until the night's over.
	if w.Goal == "place:maquis" || w.Goal == "place:club" {
		day := game.DayOf(s.GameMinutes) * 24 * 60
		w.Until = min(w.Until, day+26*60)
	}
	return w, true
}

// wishSync: the wishes brought up to the clock: a new day, its changes back; those over go; empty slots
// fill (a little after one went); what was done elsewhere (Hits) counts.
func (s *Sim) wishSync() {
	now := s.GameMinutes
	l := &s.Life
	if day := game.DayOf(now); l.WishDay != day {
		l.WishDay, l.Swaps = day, 0
	}
	if len(l.Hits) > 0 {
		hits := l.Hits
		l.Hits = nil
		for _, h := range hits {
			// A mood from another player ("mood:<id>:<who>": playersocial.go), or a goal reached.
			if parts := strings.SplitN(h, ":", 3); len(parts) == 3 && parts[0] == "mood" {
				if _, ok := game.Moodlets[parts[1]]; ok {
					s.addMood(parts[1], parts[2])
				}
				continue
			}
			s.wishGoal(h)
		}
	}
	before := len(l.Wishes)
	l.Wishes = slices.DeleteFunc(l.Wishes, func(w game.Wish) bool { return w.Until <= now })
	if len(l.Wishes) < before && l.WishNext < now {
		l.WishNext = now + game.WishGap
	}
	if len(l.Wishes) >= game.MaxWishes || now < l.WishNext {
		return
	}
	rng := s.wishRand()
	for len(l.Wishes) < game.MaxWishes {
		w, ok := s.newWish(rng)
		if !ok {
			break
		}
		l.Wishes = append(l.Wishes, w)
	}
}

// wishHit: the wishes this fulfils, fulfilled: their points, a good mood, a line (the toast, its sound).
func (s *Sim) wishHit(match func(game.Wish) bool) {
	if !s.lifeOn {
		return
	}
	l := &s.Life
	for i := 0; i < len(l.Wishes); i++ {
		w := l.Wishes[i]
		if !match(w) {
			continue
		}
		l.Wishes = slices.Delete(l.Wishes, i, i+1)
		i--
		l.Points += w.Points
		l.Fulfilled++
		l.WishNext = s.GameMinutes + game.WishGap
		s.addMood("envie", w.Label)
		s.pending = append(s.pending, Event{Kind: "wish", Text: fmt.Sprintf("Envie réalisée : %s. +%d points de bonheur", w.Label, w.Points), Money: 0, GameTime: s.GameMinutes})
	}
}

// wishGoal: the wishes fulfilled by this goal exactly.
func (s *Sim) wishGoal(goal string) { s.wishHit(func(w game.Wish) bool { return w.Goal == goal }) }

// wishDone: an action done to its end, and the wishes it fulfils (its own, its place's, its skill's, some fun).
func (s *Sim) wishDone(a *game.Activity, skill string) {
	id := a.Interaction.ID
	fun := a.Interaction.Effect.Fun >= 15
	s.wishHit(func(w game.Wish) bool {
		switch w.Goal {
		case "do:" + id, "place:" + a.PlaceKind:
			return true
		case "fun":
			return fun
		}
		return skill != "" && w.Goal == "train:"+skill
	})
}

// dismissWish: POST /sims/{id}/envies/{goal}/changer — the wish dropped, another in its place (a few a day).
func (h *Handler) dismissWish(w http.ResponseWriter, r *http.Request) {
	goal := chi.URLParam(r, "goal")
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		if !s.lifeOn {
			return game.Outcome{}, nil, errLifeClosed
		}
		return s.dismissWish(goal)
	})
}

func (s *Sim) dismissWish(goal string) (game.Outcome, []Event, error) {
	l := &s.Life
	i := slices.IndexFunc(l.Wishes, func(w game.Wish) bool { return w.Goal == goal })
	if i < 0 {
		return game.Outcome{}, nil, errNoWish
	}
	if s.swapsLeft() <= 0 {
		return game.Outcome{}, nil, errNoSwap
	}
	old := l.Wishes[i]
	l.Swaps++
	// The new one is drawn without the old one (nor the others there).
	rest := slices.Delete(slices.Clone(l.Wishes), i, i+1)
	l.Wishes = append(rest, old)
	nw, ok := s.newWish(s.wishRand())
	l.Wishes = rest
	if ok {
		l.Wishes = slices.Insert(l.Wishes, i, nw)
		return game.Outcome{Text: fmt.Sprintf("Nouvelle envie : %s.", nw.Label)}, nil, nil
	}
	return game.Outcome{Text: "Envie oubliée."}, nil, nil
}

// buyPerk: POST /sims/{id}/envies/recompenses/{perk} — a perk bought with points de bonheur, for good.
func (h *Handler) buyPerk(w http.ResponseWriter, r *http.Request) {
	perk := chi.URLParam(r, "perk")
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		if !s.lifeOn {
			return game.Outcome{}, nil, errLifeClosed
		}
		return s.buyPerk(perk)
	})
}

func (s *Sim) buyPerk(id string) (game.Outcome, []Event, error) {
	p, ok := game.PerkOf(id)
	switch {
	case !ok:
		return game.Outcome{}, nil, errNoPerk
	case slices.Contains(s.Life.Perks, id):
		return game.Outcome{}, nil, errHavePerk
	case s.Life.Points < p.Cost:
		return game.Outcome{}, nil, errFewPoints
	}
	s.Life.Points -= p.Cost
	s.Life.Perks = append(s.Life.Perks, id)
	text := fmt.Sprintf("Récompense : %s.", p.Label)
	return game.Outcome{Text: text}, []Event{{Kind: "perk", Text: text, GameTime: s.GameMinutes}}, nil
}

// perks: GET /envies/recompenses — the shop's perks (the same for all).
func perksList(w http.ResponseWriter, r *http.Request) {
	if !lifeModeOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"perks": game.Perks, "swaps": game.WishSwaps})
}

// lifeHit: something done elsewhere that a wish may want (a game of dames won: "win:dames"), kept in the
// Sim's Life until its next request reads it (wishSync). Only while le mode vie is open.
func lifeHit(ctx context.Context, db execer, simID, goal string) {
	if !lifeModeOpen(ctx) {
		return
	}
	_, _ = db.Exec(ctx, `UPDATE sims SET life = jsonb_set(life, '{hits}', COALESCE(life->'hits', '[]'::jsonb) || to_jsonb($2::text)) WHERE id = $1`, simID, goal)
}

// decay: the needs after these minutes (idle or doing something), the perk « besoins-lents » felt.
func (s *Sim) decay(n game.Needs, minutes int64, idle bool) game.Needs {
	var after game.Needs
	if idle {
		after = game.DecayIdle(n, s.decayed(minutes))
	} else {
		after = game.Decay(n, s.decayed(minutes))
	}
	if !s.hasPerk("besoins-lents") {
		return after
	}
	keep := func(a, b float64) float64 {
		if b < a {
			return a + (b-a)*game.SlowNeeds
		}
		return b
	}
	return game.Needs{Hunger: keep(n.Hunger, after.Hunger), Energy: keep(n.Energy, after.Energy), Hygiene: keep(n.Hygiene, after.Hygiene), Social: keep(n.Social, after.Social), Fun: keep(n.Fun, after.Fun)}
}

// rideOff: a ride's fare with the perk « taxi-ami » (taxi, woro-woro, gbaka, moto).
func (s *Sim) rideOff(fare int, mode string) int {
	if fare <= 0 || !s.hasPerk("taxi-ami") || (!publicFare(mode) && mode != "moto" && mode != "") {
		return fare
	}
	return fare * (100 - game.TaxiOff) / 100
}
