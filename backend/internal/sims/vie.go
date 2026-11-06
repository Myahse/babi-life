package sims

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Le mode vie's next pillars (the update « mode-vie », game/vie.go; web game/vie.ts, components/LifePanels.tsx):
// moods, skills and relationships, all the server's. A Sim's Life (sims.life, migration 116) holds its
// moodlets (each with its reason and until when, in game minutes), the points of its skills, its family's
// gauges and when the house was last cleaned. They change only here: when an action ends (finish →
// lifeDone), when something is said (chatHandler → lifeChat), and as the clock goes (lifeSync, on every
// request: the moodlets that are over go, the needs' come and go). The mood weighs a little on what an
// action does (lifeStart) and on free will (web); the skills open actions (Requirement.Skill), make their
// own a little better and are asked for promotions (work). While the update is shut, none of it runs.

// Life: what le mode vie keeps of a Sim beyond its needs.
type Life struct {
	Moodlets []game.Moodlet `json:"moodlets,omitempty"`
	// Skills: the points earned in each (game.SkillLevel makes the level).
	Skills map[string]int `json:"skills,omitempty"`
	// Kin: the gauges with the family at home (papa, maman: parents.go's ids).
	Kin map[string]game.Rel `json:"kin,omitempty"`
	// Cleaned: the game minute the house was last cleaned; Slept: the last night's sleep ended; Since: first seen by le mode vie.
	Cleaned int64 `json:"cleaned,omitempty"`
	Slept   int64 `json:"slept,omitempty"`
	Since   int64 `json:"since,omitempty"`
}

// MaxMoodlets: at most this many at once (the oldest timed one goes first).
const MaxMoodlets = 10

// dirtyAfter: the house is « sale » this long after it was last cleaned (game minutes: two days).
const dirtyAfter = 2 * 24 * 60

// addMood: the moodlet `id` (for `reason`) from now; the same one again only lasts longer.
func (s *Sim) addMood(id, reason string) {
	m := game.NewMoodlet(id, reason, s.GameMinutes)
	ms := s.Life.Moodlets
	if i := slices.IndexFunc(ms, func(x game.Moodlet) bool { return x.ID == id && x.Reason == reason }); i >= 0 {
		ms[i] = m
		return
	}
	// Feelings that undo each other: made up, the quarrel's gone; in love again, the heartbreak eases.
	switch id {
	case "amoureux":
		s.dropMood("chagrin", "")
	case "bien-mange", "festin":
		s.dropMood("faim", "")
	}
	ms = append(ms, m)
	if len(ms) > MaxMoodlets {
		// The one ending first goes (a need's last: it comes back by itself while the need is low).
		k := 0
		for i, x := range ms {
			if !x.Need && (ms[k].Need || x.Until < ms[k].Until) {
				k = i
			}
		}
		ms = slices.Delete(ms, k, k+1)
	}
	s.Life.Moodlets = ms
}

// dropMood: the moodlet `id` gone (for `reason`; "" for any reason).
func (s *Sim) dropMood(id, reason string) {
	s.Life.Moodlets = slices.DeleteFunc(s.Life.Moodlets, func(x game.Moodlet) bool { return x.ID == id && (reason == "" || x.Reason == reason) })
}

// hasMood: the moodlet `id` is there.
func (s *Sim) hasMood(id string) bool {
	return slices.ContainsFunc(s.Life.Moodlets, func(x game.Moodlet) bool { return x.ID == id })
}

// mood: the overall mood now.
func (s *Sim) mood() game.Mood { return game.MoodOf(s.Life.Moodlets) }

// lifeSync: the moodlets brought up to the Sim's clock: those over go; the needs', the house's and the
// rain's are there while they hold; a night not slept shows in the morning. And the mood they make.
func (s *Sim) lifeSync() {
	now := s.GameMinutes
	l := &s.Life
	if l.Since == 0 {
		l.Since, l.Cleaned, l.Slept = now, now, now
	}
	// Over (the ones that hold while something lasts are recomputed below).
	l.Moodlets = slices.DeleteFunc(l.Moodlets, func(m game.Moodlet) bool { return m.Need || m.Until <= now })
	while := func(id string, on bool) {
		if on {
			m := game.NewMoodlet(id, "", now)
			m.Need, m.Until = true, now+30
			l.Moodlets = append(l.Moodlets, m)
		}
	}
	n := s.Needs
	while("faim", n.Hunger < 20)
	while("fatigue", n.Energy < 15)
	while("sale", n.Hygiene < 20)
	while("seul", n.Social < 20)
	while("ennui", n.Fun < 20)
	while("repus", n.Hunger >= 92 && !s.hasMood("festin"))
	atHome := s.City == s.HomeCity && s.Commune == s.HomeCommune && s.Stay == nil && s.Prison == nil
	while("maison-sale", atHome && now-l.Cleaned > dirtyAfter)
	h, _, rain := game.HappeningAt(s.City, s.Commune, now)
	// (Out in it: busy away from home, or about in another commune; idle in one's own quarter, likely at home.)
	under := (s.Activity != nil && s.Activity.PlaceID != HomePlaceID && s.Activity.PlaceKind != "chat") || (s.Activity == nil && !atHome)
	while("pluie", rain && h.ID == "pluie" && under)
	// The morning after a night not slept (nothing since the day before, the energy low).
	if hour := game.HourOf(now); hour >= 5 && hour < 11 && now-l.Slept > 20*60 && n.Energy < 30 && !s.hasMood("nuit-blanche") {
		s.addMood("nuit-blanche", "")
	}
	m := s.mood()
	s.Mood = &m
}

// skillLevel: the level of the skill (1..10).
func (s *Sim) skillLevel(id string) int { return game.SkillLevel(s.Life.Skills[id]) }

// skillLevels: every skill's level, for the requirements (game.Who).
func (s *Sim) skillLevels() map[string]int {
	if !s.lifeOn || len(s.Life.Skills) == 0 {
		return nil
	}
	out := make(map[string]int, len(s.Life.Skills))
	for k, v := range s.Life.Skills {
		out[k] = game.SkillLevel(v)
	}
	return out
}

// gainSkill: points in a skill; a level reached is said (the journal, a moodlet of pride).
func (s *Sim) gainSkill(skill string, points int) []Event {
	if skill == "" || points <= 0 {
		return nil
	}
	if s.Life.Skills == nil {
		s.Life.Skills = map[string]int{}
	}
	before := s.skillLevel(skill)
	s.Life.Skills[skill] = min(s.Life.Skills[skill]+points, game.SkillXP(game.SkillMax))
	after := s.skillLevel(skill)
	if after <= before {
		return nil
	}
	label := game.SkillLabel(skill)
	s.addMood("fier", fmt.Sprintf("%s niveau %d", label, after))
	return []Event{{Kind: "skill", Text: fmt.Sprintf("%s : niveau %d !", label, after), GameTime: s.GameMinutes}}
}

// Ways an action is done that are washing, a night's sleep or an evening out.
var (
	washes = []string{"shower", "logement-douche", "chambre-douche", "douche-vestiaire", "bain-bebe", "nager"}
	outing = []string{"drink-with-friends", "dance-coupe-decale", "danser-soiree", "party", "bar-hotel", "anniversaire-resto"}
)

// lifeDone: an action done to its end (finish): the skill it trains, and how it leaves the Sim feeling.
func (s *Sim) lifeDone(a *game.Activity, earned int) []Event {
	it := a.Interaction
	id := it.ID
	// Its game played well counts (a.Defi, its score); left to play by itself, as an ordinary game.
	score := 0
	if a.Auto == nil && a.Defi > 0 {
		score = a.Defi
	}
	skill, points := game.SkillGain(id, it.Minutes, s.Traits, s.mood().Score, score)
	events := s.gainSkill(skill, points)
	e := it.Effect
	switch {
	case id == "cuisiner-kedjenou" || e.Hunger >= 65:
		s.addMood("festin", "")
	case e.Hunger >= 35:
		s.addMood("bien-mange", "")
	}
	if slices.Contains(washes, id) || (strings.Contains(id, "douche") && e.Hygiene >= 40) {
		s.addMood("douche", "")
	}
	if e.Energy >= 60 {
		s.Life.Slept = s.GameMinutes
		s.dropMood("nuit-blanche", "")
		if s.Needs.Energy >= 70 {
			s.addMood("bien-dormi", "")
		}
	}
	if slices.Contains(outing, id) || ((a.PlaceKind == "maquis" || a.PlaceKind == "club") && e.Fun >= 20) {
		s.addMood("belle-soiree", "")
	}
	if a.Career != "" && earned > 0 {
		s.addMood("salaire", "")
	}
	switch skill {
	case "forme":
		s.addMood("en-forme", "")
	case "musique":
		s.addMood("inspire", "")
	}
	if id == "faire-menage" {
		s.Life.Cleaned = s.GameMinutes
		s.dropMood("maison-sale", "")
		s.addMood("maison-propre", "")
	}
	if id == game.NightID {
		if p := s.partner(); p != nil {
			s.addMood("amoureux", p.Name)
			p.Romance = game.Clamp100(max(p.Romance, 60) + 4)
		}
	}
	return events
}

// lifeStart: the action just begun does a little more good in a good mood (a little less in a bad one),
// and more as the skill it trains grows. Its pay is never touched. Once per action.
func (s *Sim) lifeStart() {
	a := s.Activity
	if !s.lifeOn || a == nil || a.Kind != "do" || a.Boost != 0 {
		return
	}
	f := game.MoodFactor(s.mood().Score)
	if skill, _ := game.SkillOf(a.Interaction.ID); skill != "" {
		f *= game.SkillBonus(s.skillLevel(skill))
	}
	a.Boost = math.Round(f*1000) / 1000
	if math.Abs(f-1) < 1e-9 {
		return
	}
	a.Interaction.Effect = boosted(a.Interaction.Effect, f)
	if a.Auto != nil {
		a.Auto.Effect = boosted(a.Auto.Effect, f)
	}
}

// boosted: the needs' good scaled by f (what the action costs the needs left as is).
func boosted(n game.Needs, f float64) game.Needs {
	g := func(v float64) float64 {
		if v > 0 {
			return math.Round(v*f*10) / 10
		}
		return v
	}
	return game.Needs{Hunger: g(n.Hunger), Energy: g(n.Energy), Hygiene: g(n.Hygiene), Social: g(n.Social), Fun: g(n.Fun)}
}

// promotionHeld: le mode vie asks for the career's skill to be promoted (game.PromotionSkill): what's
// missing, "" when nothing.
func (s *Sim) promotionHeld(c game.Career) string {
	if !s.lifeOn {
		return ""
	}
	skill := game.CareerSkill[c.ID]
	need := game.PromotionSkill(s.CareerLevel + 1)
	if skill == "" || need == 0 || s.skillLevel(skill) >= need {
		return ""
	}
	return skill
}

// Relationships.

// lifeOnly: the topics le mode vie brings (the wheel's), refused while it's shut.
var lifeOnly = []string{"confier", "calin", "embrasser", "disputer", "excuser"}

// relOf: a friend's gauges (a partner from before the gauges: their romance high already).
func relOf(f *game.Friend) game.Rel {
	if f == nil {
		return game.Rel{}
	}
	r := game.Rel{Friendship: f.Friendship, Romance: f.Romance, Enemy: f.Enemy}
	if f.Partner && r.Romance == 0 {
		r.Romance = 60
	}
	return r
}

// kinRel: the gauges with papa or maman (fond of each other from the start).
func (s *Sim) kinRel(id string) game.Rel {
	if r, ok := s.Life.Kin[id]; ok {
		return r
	}
	return game.Rel{Friendship: 60}
}

// lifeGate: whether this can be said to them, from what they are to each other ("" topic: no gauge).
func (s *Sim) lifeGate(p Passerby, topic string, adult bool) error {
	if !s.lifeOn {
		if slices.Contains(lifeOnly, topic) {
			return errUnknownTopic
		}
		return nil
	}
	x, ok := game.SocialOf(topic)
	if !ok || strings.HasPrefix(p.ID, ParentPrefix) {
		return nil
	}
	f := s.findFriend("p-" + p.ID)
	adults := adult && s.stage().ID == game.StageAdulte && (f == nil || f.Adult)
	if why := game.SocialWhy(x, f != nil, relOf(f), adults); why != "" {
		return errors.New(why)
	}
	return nil
}

// lifeChat: what was said moves the gauges (the family's, a friend's), makes a stranger someone known,
// leaves a mood (a quarrel, a good moment, in love), and talking trains the charisme.
func (s *Sim) lifeChat(p Passerby, topic string, ans chatAnswer) []Event {
	if !s.lifeOn || ans.Mood == "bye" {
		return nil
	}
	good := ans.Mood != "bad"
	if topic == "disputer" {
		good = false
	}
	x, gauged := game.SocialOf(topic)
	if !gauged {
		x = game.Social{Topic: topic, Friendship: 2, BadFriendship: -2}
	}
	if strings.HasPrefix(p.ID, ParentPrefix) {
		if s.Life.Kin == nil {
			s.Life.Kin = map[string]game.Rel{}
		}
		r := s.kinRel(p.ID).Apply(game.Social{Friendship: max(2, x.Friendship), BadFriendship: x.BadFriendship}, good)
		s.Life.Kin[p.ID] = r
		if good && r.Friendship >= 70 {
			s.addMood("bon-moment", p.Name)
		}
		return s.gainSkill("charisme", 2)
	}
	f := s.findFriend("p-" + p.ID)
	if f == nil {
		// A stranger who took it well: someone the Sim knows now (the relationships panel, the Amis app).
		if good && len(s.Friends) < game.MaxFriends && p.Name != "" {
			s.Friends = append(s.Friends, game.Friend{ID: "p-" + p.ID, Name: p.Name, Gender: p.Gender, Seed: p.Seed, Commune: s.Commune, Friendship: 10, Met: s.GameMinutes, Seen: s.GameMinutes, Adult: s.stage().ID == game.StageAdulte, Look: p.Look})
		}
	} else {
		r := relOf(f).Apply(x, good)
		f.Friendship, f.Romance, f.Enemy = r.Friendship, r.Romance, r.Enemy
		switch {
		case topic == "disputer":
			s.addMood("dispute", f.Name)
		case topic == "excuser" && good:
			s.dropMood("dispute", f.Name)
		case (topic == "drague" || topic == "embrasser" || topic == "sortir") && good:
			s.addMood("amoureux", f.Name)
		case (topic == "drague" || topic == "sortir") && !good:
			s.addMood("rejete", f.Name)
		case topic == "rompre":
			s.addMood("chagrin", f.Name)
			f.Romance = 0
		case good && f.Friendship >= 40:
			s.addMood("bon-moment", f.Name)
		}
	}
	pts := 3
	if good {
		pts = 6
	}
	return s.gainSkill("charisme", pts)
}

// Relation: one person in the relationships panel.
type Relation struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Kind   string `json:"kind"` // famille | pnj | joueur
	Gender string `json:"gender,omitempty"`
	Seed   int    `json:"seed,omitempty"`
	game.Rel
	Status string `json:"status"`
}

// relationsOf: the Sim's family at home, the people it knows, from the closest.
func (s *Sim) relationsOf() []Relation {
	out := []Relation{}
	if s.parentsHome() {
		for _, k := range []struct{ id, name, gender string }{{ParentPrefix + "papa", "Papa", "homme"}, {ParentPrefix + "maman", "Maman", "femme"}} {
			r := s.kinRel(k.id)
			out = append(out, Relation{ID: k.id, Name: k.name, Kind: "famille", Gender: k.gender, Rel: r, Status: game.RelStatus(r.Friendship, r.Romance, r.Enemy, false)})
		}
	}
	for i := range s.Friends {
		f := &s.Friends[i]
		r := relOf(f)
		out = append(out, Relation{ID: f.ID, Name: f.Name, Kind: "pnj", Gender: f.Gender, Seed: f.Seed, Rel: r, Status: game.RelStatus(r.Friendship, r.Romance, r.Enemy, f.Partner)})
	}
	return out
}

// relations: GET /sims/{id}/relations — the relationships panel: the family, the people met, the players.
func (h *Handler) relations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !lifeModeOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	s, err := scanSim(h.DB.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(ctx)))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	s.lifeOn = true
	out := s.relationsOf()
	rows, err := h.DB.Query(ctx, `
		SELECT o.id, o.first_name, o.gender, b.friendship, b.romance, b.enemy, b.couple
		FROM bonds b JOIN sims o ON o.id = CASE WHEN b.sim_a = $1 THEN b.sim_b ELSE b.sim_a END
		WHERE b.sim_a = $1 OR b.sim_b = $1
		ORDER BY b.friendship DESC LIMIT 60`, s.ID)
	if err == nil {
		for rows.Next() {
			var p Relation
			var couple bool
			if rows.Scan(&p.ID, &p.Name, &p.Gender, &p.Friendship, &p.Romance, &p.Enemy, &couple) == nil {
				p.Kind = "joueur"
				p.Status = game.RelStatus(p.Friendship, p.Romance, p.Enemy, couple)
				out = append(out, p)
			}
		}
		rows.Close()
	}
	slices.SortStableFunc(out, func(a, b Relation) int { return relRank(b) - relRank(a) })
	httpx.JSON(w, http.StatusOK, map[string]any{"people": out})
}

// relRank: the closest first (a partner, the family, the best friends…), the enemies last.
func relRank(r Relation) int {
	switch r.Status {
	case game.RelPartenaire:
		return 1000
	case game.RelEnnemi:
		return -1
	}
	k := r.Friendship + r.Romance/2
	if r.Kind == "famille" {
		k += 200
	}
	return k
}
