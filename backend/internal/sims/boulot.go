package sims

import (
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"math/rand/v2"
	"net/http"
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Le mode vie's lived work day (the update « mode-vie », game/boulot.go; web components/LifeWork.tsx).
// A shift (or a child's day at school, « aller-ecole ») begun while le mode vie is open is a Shift on the
// activity (shiftBegin, from start): how the Sim rides there, the way it works now (setStyle: the minutes
// in each style are counted), and the shift's event, asked from a minute in it (answerShift; left
// unanswered, the quiet answer counts at the end). When it ends (finish → shiftEnd), before the
// promotion's check, the styles and the choices move the performance (a child's grade at school), the
// needs and the colleagues; a bonus is paid within the day's work limit; a mood says how the day went;
// and the day's summary (Life.Work.Last) tells the player back home, a promotion with it (promoted).
// With the update shut, nothing of this runs: the shift is as it always was.

var (
	errNoShift   = errors.New("tu n'es pas au travail")
	errNoEvent   = errors.New("rien à décider pour l'instant")
	errBadStyle  = errors.New("façon de travailler inconnue")
	errBadChoice = errors.New("choix inconnu")
	errNoGoWork  = errors.New("pas de travail à cette heure-ci : regarde tes horaires dans l'appli Boulot")
	errNoJob     = errors.New("tu n'as pas de travail. Ouvre l'appli Boulot")
)

// WorkLife: what le mode vie keeps of the Sim's work and school days.
type WorkLife struct {
	// Colleagues: the people at work (of the career Of), or the classmates (Classmates).
	Of         string     `json:"of,omitempty"`
	Colleagues []Coworker `json:"colleagues,omitempty"`
	Classmates []Coworker `json:"classmates,omitempty"`
	// Grade: the « performance scolaire » (0..100; 0 none yet: game.GradeStart).
	Grade int `json:"grade,omitempty"`
	// Last: the last day's summary (shown once back home).
	Last *WorkDay `json:"last,omitempty"`
}

// Coworker: a colleague or a classmate, and how well they get on.
type Coworker struct {
	Name       string `json:"name"`
	Gender     string `json:"gender"`
	Friendship int    `json:"friendship"`
}

// WorkDay: a day at work or at school, as the Sim comes home with it.
type WorkDay struct {
	At     int64  `json:"at"`
	School bool   `json:"school,omitempty"`
	Place  string `json:"place,omitempty"`
	Pay    int    `json:"pay"`
	Bonus  int    `json:"bonus,omitempty"`
	// Perf: the performance points the day brought (negative: lost); Now and Need: where it stands for the next promotion.
	Perf  int    `json:"perf"`
	Now   int    `json:"now"`
	Need  int    `json:"need"`
	Style string `json:"style"`
	// Mood: the moodlet the day left (its id and label).
	Mood      string `json:"mood,omitempty"`
	MoodLabel string `json:"moodLabel,omitempty"`
	Result    string `json:"result,omitempty"`
	Grade     int    `json:"grade,omitempty"`
	GradeWas  int    `json:"gradeWas,omitempty"`
	Ride      string `json:"ride,omitempty"`
	// Coll: the colleagues' friendship moved by this much (each).
	Coll  int        `json:"coll,omitempty"`
	Promo *Promotion `json:"promo,omitempty"`
}

// Promotion: the new rung, its pay and the one before.
type Promotion struct {
	Title string `json:"title"`
	Pay   int    `json:"pay"`
	Was   int    `json:"was"`
	From  string `json:"from"`
	Level int    `json:"level"`
	Wish  bool   `json:"wish,omitempty"`
}

// The names the colleagues and the classmates are drawn from.
var coworkerNames = []struct{ name, gender string }{
	{"Awa", "femme"}, {"Koffi", "homme"}, {"Mariam", "femme"}, {"Yao", "homme"}, {"Adjoua", "femme"}, {"Kouassi", "homme"},
	{"Fatou", "femme"}, {"Seydou", "homme"}, {"Aya", "femme"}, {"Brice", "homme"}, {"Nadège", "femme"}, {"Ibrahim", "homme"},
	{"Prisca", "femme"}, {"Serge", "homme"}, {"Raïssa", "femme"}, {"Drissa", "homme"},
}

// shiftRand: the same draw for the same Sim and the same shift (a request run twice draws the same).
func (s *Sim) shiftRand(salt int64) *rand.Rand {
	h := fnv.New64a()
	h.Write([]byte(s.ID))
	return rand.New(rand.NewPCG(uint64(salt), h.Sum64()))
}

// work: the WorkLife, made if there's none.
func (s *Sim) workLife() *WorkLife {
	if s.Life.Work == nil {
		s.Life.Work = &WorkLife{}
	}
	return s.Life.Work
}

// coworkers: the colleagues of the career now (drawn when it's a new one), or the classmates.
func (s *Sim) coworkers(school bool) []Coworker {
	w := s.workLife()
	draw := func(salt int64) []Coworker {
		r := s.shiftRand(salt)
		i := r.IntN(len(coworkerNames))
		j := (i + 1 + r.IntN(len(coworkerNames)-1)) % len(coworkerNames)
		return []Coworker{{coworkerNames[i].name, coworkerNames[i].gender, 15}, {coworkerNames[j].name, coworkerNames[j].gender, 15}}
	}
	if school {
		if len(w.Classmates) == 0 {
			w.Classmates = draw(7)
		}
		return w.Classmates
	}
	if w.Of != s.Career || len(w.Colleagues) == 0 {
		h := fnv.New32a()
		h.Write([]byte(s.Career))
		w.Of, w.Colleagues = s.Career, draw(int64(h.Sum32()))
	}
	return w.Colleagues
}

// shiftRide: how the Sim goes: a child by the school's car, a teen on foot; to work, the company's car
// from the fourth rung, the gbaka for the transport's people, else the gbaka or a woro-woro by the day.
func (s *Sim) shiftRide(school bool) string {
	if school {
		if s.stage().ID == game.StageEnfant {
			return "car-ecole"
		}
		return "marche"
	}
	switch {
	case s.CareerLevel >= 3:
		return "voiture"
	case s.Career == "transport":
		return "gbaka"
	case game.DayOf(s.GameMinutes)%5 == 4:
		return "marche"
	case game.DayOf(s.GameMinutes)%2 == 0:
		return "gbaka"
	}
	return "woro"
}

// shiftBegin: a shift or a school day just begun (start): its Shift, its event drawn.
func (s *Sim) shiftBegin() {
	a := s.Activity
	if !s.lifeOn || a == nil || a.Kind != "do" || a.Shift != nil {
		return
	}
	school := a.Interaction.ID == "aller-ecole" && s.minor()
	if !school && (a.Career == "" || a.Career != s.Career) {
		return
	}
	s.coworkers(school)
	sh := &game.Shift{School: school, Ride: s.shiftRide(school), Style: game.StyleNormal, Since: s.GameMinutes, Choice: -1}
	r := s.shiftRand(a.Start)
	events := game.WorkEvents
	if school {
		events = game.SchoolEvents
	}
	if n := a.End - a.Start; n >= 3 && r.Float64() < 0.75 {
		sh.Event = events[r.IntN(len(events))].ID
		sh.EventAt = a.Start + max(1, int64(math.Round(float64(n)*(0.3+0.3*r.Float64()))))
	}
	a.Shift = sh
}

// spend: the minutes worked in the style now, counted up to now.
func spend(sh *game.Shift, now int64) {
	if now > sh.Since {
		if sh.Spent == nil {
			sh.Spent = map[string]int64{}
		}
		sh.Spent[sh.Style] += now - sh.Since
	}
	sh.Since = max(sh.Since, now)
}

// shiftNow: the shift under way, nil for none.
func (s *Sim) shiftNow() *game.Shift {
	if a := s.Activity; a != nil && a.Kind == "do" && a.Shift != nil && a.End > s.GameMinutes {
		return a.Shift
	}
	return nil
}

// setStyle: the way the Sim works from now.
func (s *Sim) setStyle(style string) (game.Outcome, error) {
	sh := s.shiftNow()
	if sh == nil {
		return game.Outcome{}, errNoShift
	}
	st := game.StyleOf(style, sh.School)
	if st.ID != style {
		return game.Outcome{}, errBadStyle
	}
	spend(sh, s.GameMinutes)
	sh.Style = style
	return game.Outcome{Text: st.Label}, nil
}

// moveColleagues: the friendship with each colleague (or classmate) moved by d.
func (s *Sim) moveColleagues(school bool, d int) {
	if d == 0 {
		return
	}
	cs := s.coworkers(school)
	for i := range cs {
		cs[i].Friendship = game.Clamp100(cs[i].Friendship + d)
	}
}

// applyChoice: an answer to the shift's event: its effects now, the rest at the end (Perf, Bonus).
func (s *Sim) applyChoice(sh *game.Shift, c game.WorkChoice, rng *rand.Rand) string {
	perf, mood, text := c.Perf, c.Mood, c.Result
	if c.Skill != "" && rng.Float64() >= game.SkillChance(s.skillLevel(c.Skill)) {
		perf, mood, text = c.FailPerf, c.FailMood, c.FailResult
	} else {
		s.Needs = s.Needs.Add(c.Effect)
		s.moveColleagues(sh.School, c.Colleagues)
		sh.Coll += c.Colleagues
		sh.Bonus += c.Bonus
		if c.Late > 0 && s.Activity != nil {
			s.Activity.End += c.Late
			sh.Late = true
		}
	}
	sh.Perf += perf
	sh.Result = text
	if mood != "" {
		s.addMood(mood, "")
	}
	return text
}

// answerShift: the player's answer to the shift's event (0 or 1).
func (s *Sim) answerShift(choice int, rng *rand.Rand) (game.Outcome, error) {
	sh := s.shiftNow()
	if sh == nil {
		return game.Outcome{}, errNoShift
	}
	ev, ok := game.EventOf(sh.Event, sh.School)
	if !ok || sh.Choice >= 0 || s.GameMinutes < sh.EventAt {
		return game.Outcome{}, errNoEvent
	}
	if choice < 0 || choice > 1 {
		return game.Outcome{}, errBadChoice
	}
	sh.Choice = choice
	return game.Outcome{Text: s.applyChoice(sh, ev.Choices[choice], rng)}, nil
}

// shiftEnd: the shift over (finish, before the promotion's check): what the styles and the choices did,
// the bonus paid, the mood, and the day's summary. earned: the shift's pay.
func (s *Sim) shiftEnd(a *game.Activity, earned int) []Event {
	sh := a.Shift
	spend(sh, a.End)
	// The event never answered: as if the quiet answer was given.
	if ev, ok := game.EventOf(sh.Event, sh.School); ok && sh.Choice < 0 && a.End >= sh.EventAt {
		sh.Choice = 1
		s.applyChoice(sh, ev.Choices[1], s.shiftRand(a.Start+1))
	}
	perf, coll, effect := game.StylePerf(sh.Spent, sh.School, a.End-a.Start)
	perf += sh.Perf
	s.Needs = s.Needs.Add(effect)
	s.moveColleagues(sh.School, coll)
	// The style it was worked in the longest.
	style := game.StyleNormal
	for id, m := range sh.Spent {
		if m > sh.Spent[style] || (m == sh.Spent[style] && id < style && id != game.StyleNormal) {
			style = id
		}
	}
	day := &WorkDay{At: a.End, School: sh.School, Place: a.PlaceName, Pay: earned, Perf: int(math.Round(perf)), Style: style, Result: sh.Result, Ride: sh.Ride, Coll: coll + sh.Coll}
	w := s.workLife()
	var mood string
	if sh.School {
		if w.Grade == 0 {
			w.Grade = game.GradeStart
		}
		day.GradeWas = w.Grade
		w.Grade = max(1, min(100, w.Grade+int(math.Round(perf*game.GradePerPoint))))
		day.Grade = w.Grade
		// A good grade counts towards the bac (life.go schoolMark already counts the day itself).
		if w.Grade >= 70 {
			s.Performance++
		}
		switch {
		case perf >= 3:
			mood = "bonne-ecole"
		case perf < 0:
			mood = "puni"
		case style == game.StyleChat:
			mood = "collegues"
		}
	} else {
		s.Performance = max(0, s.Performance+day.Perf)
		if sh.Bonus > 0 {
			day.Bonus = s.earn(game.FromWork, int(math.Round(float64(earned)*sh.Bonus/50))*50)
		}
		switch {
		case sh.Late:
			mood = "tard"
		case perf >= 3 && style == game.StyleHard:
			mood = "journee-dure"
		case perf >= 3:
			mood = "bonne-journee"
		case style == game.StyleMinimum && perf > -3:
			mood = "tranquille"
		case perf < 0:
			mood = "mauvaise-journee"
		case style == game.StyleChat:
			mood = "collegues"
		}
	}
	if mood != "" {
		s.addMood(mood, "")
		day.Mood, day.MoodLabel = mood, game.Moodlets[mood].Label
	}
	w.Last = day
	var text string
	if sh.School {
		text = fmt.Sprintf("Journée d'école finie : performance scolaire %s (%d/100).", game.Grade(day.Grade), day.Grade)
	} else {
		text = fmt.Sprintf("Journée de travail finie : performance %+d.", day.Perf)
		if day.Bonus > 0 {
			text += fmt.Sprintf(" Prime : %s.", game.FCFA(day.Bonus))
		}
	}
	return []Event{{Kind: "life", Text: text, Money: day.Bonus, GameTime: a.End}}
}

// shiftSummary: where the performance stands for the next promotion, once the shift's counted (finish).
func (s *Sim) shiftSummary() {
	if s.Life.Work == nil || s.Life.Work.Last == nil || s.Life.Work.Last.School {
		return
	}
	s.Life.Work.Last.Now, s.Life.Work.Last.Need = s.Performance, game.NeededToPromote(s.CareerLevel)
}

// promoted: le mode vie's promotion moment: the mood, the wish fulfilled, the new rung in the day's summary.
func (s *Sim) promoted(c game.Career) {
	if !s.lifeOn || s.CareerLevel < 1 {
		return
	}
	s.addMood("promu", "")
	had := slices.ContainsFunc(s.Life.Wishes, func(w game.Wish) bool { return w.Goal == "promo" })
	s.wishGoal("promo")
	if w := s.Life.Work; w != nil && w.Last != nil && !w.Last.School {
		l, was := c.Levels[s.CareerLevel], c.Levels[s.CareerLevel-1]
		w.Last.Promo = &Promotion{Title: l.Title, Pay: l.Pay, Was: was.Pay, From: was.Title, Level: s.CareerLevel, Wish: had}
		w.Last.Mood, w.Last.MoodLabel = "promu", game.Moodlets["promu"].Label
	}
}

// goWork: the Sim sets off to work from home (le mode vie): the shift starts at a workplace of its
// commune, as the Boulot app's switch would do it by itself.
func (s *Sim) goWork() error {
	if _, ok := game.FindCareer(s.Career); !ok {
		return errNoJob
	}
	if s.Activity != nil {
		return game.ErrBusy
	}
	if !s.wallet().Can(s.today(), game.FromWork) {
		return game.ErrFull(game.FromWork)
	}
	if !s.goToWork() {
		return errNoGoWork
	}
	return nil
}

// boulotStyle: POST /sims/{id}/boulot/style {style}.
func (h *Handler) boulotStyle(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Style string `json:"style"`
	}
	if !lifeModeOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, errLifeClosed.Error())
		return
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		out, err := s.setStyle(req.Style)
		return out, nil, err
	})
}

// boulotChoix: POST /sims/{id}/boulot/choix {choice}.
func (h *Handler) boulotChoix(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Choice int `json:"choice"`
	}
	if !lifeModeOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, errLifeClosed.Error())
		return
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		out, err := s.answerShift(req.Choice, newRand())
		return out, nil, err
	})
}

// boulotPartir: POST /sims/{id}/boulot/partir — off to work now, from home.
func (h *Handler) boulotPartir(w http.ResponseWriter, r *http.Request) {
	if !lifeModeOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, errLifeClosed.Error())
		return
	}
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		if err := s.goWork(); err != nil {
			return game.Outcome{}, nil, err
		}
		a := s.Activity
		return game.Outcome{Text: fmt.Sprintf("%s : %s", s.FirstName, a.Interaction.Label)}, nil, nil
	})
}

// boulotEvents: GET /boulot — the ways of working and the events, for the work card.
func boulotEvents(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]any{"styles": game.WorkStyles, "schoolStyles": game.SchoolStyles, "events": game.WorkEvents, "schoolEvents": game.SchoolEvents})
}
