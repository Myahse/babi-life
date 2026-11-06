package sims

import (
	"math/rand/v2"
	"testing"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// workSim: an adult at the market's hours on a Monday, le mode vie open.
func workSim(t *testing.T) *Sim {
	t.Helper()
	f, _ := game.FindFamily("poignon")
	s := adultSim(f, "commerce")
	s.GameMinutes = game.MinuteOf(monday.Add(8 * time.Hour))
	s.lifeOn = true
	return &s
}

// toWork: off to work from home, no event this shift (unless asked), the shift's id.
func toWork(t *testing.T, s *Sim, keepEvent bool) *game.Shift {
	t.Helper()
	if err := s.goWork(); err != nil {
		t.Fatalf("off to work: %v", err)
	}
	sh := s.Activity.Shift
	if sh == nil || sh.Ride == "" || sh.Style != game.StyleNormal || sh.Choice != -1 {
		t.Fatalf("the shift lived: %+v", sh)
	}
	if !keepEvent {
		sh.Event, sh.EventAt = "", 0
	}
	return sh
}

// endShift: the clock run to the end of the shift.
func endShift(s *Sim) []Event {
	return s.advanceTo(s.Activity.End, rand.New(rand.NewPCG(1, 2)))
}

// The way one works moves the performance, the needs and the colleagues; back home, the day's summary.
func TestShiftStyles(t *testing.T) {
	hard, lazy, chat := workSim(t), workSim(t), workSim(t)
	for _, c := range []struct {
		s     *Sim
		style string
	}{{hard, game.StyleHard}, {lazy, game.StyleMinimum}, {chat, game.StyleChat}} {
		toWork(t, c.s, false)
		if _, err := c.s.setStyle(c.style); err != nil {
			t.Fatal(err)
		}
		c.s.Performance = 1
		endShift(c.s)
		if c.s.Activity != nil || c.s.Life.Work == nil || c.s.Life.Work.Last == nil {
			t.Fatalf("%s: the shift over, its summary: %+v", c.style, c.s.Life.Work)
		}
	}
	h, l, c := hard.Life.Work.Last, lazy.Life.Work.Last, chat.Life.Work.Last
	if h.Perf != 4 || l.Perf != -2 || c.Perf != 0 {
		t.Errorf("the day's performance: hard %d, minimum %d, colleagues %d", h.Perf, l.Perf, c.Perf)
	}
	if !(hard.Performance > chat.Performance && chat.Performance > lazy.Performance) {
		t.Errorf("performance after: hard %d, chat %d, lazy %d", hard.Performance, chat.Performance, lazy.Performance)
	}
	if !(hard.Needs.Energy < lazy.Needs.Energy) || !(chat.Needs.Social > hard.Needs.Social) {
		t.Errorf("needs: hard %+v, lazy %+v, chat %+v", hard.Needs, lazy.Needs, chat.Needs)
	}
	if chat.Life.Work.Colleagues[0].Friendship <= hard.Life.Work.Colleagues[0].Friendship {
		t.Errorf("colleagues: chatting %d, working hard %d", chat.Life.Work.Colleagues[0].Friendship, hard.Life.Work.Colleagues[0].Friendship)
	}
	if h.Mood != "journee-dure" || l.Mood != "tranquille" || c.Mood != "collegues" || !lazy.hasMood("tranquille") {
		t.Errorf("moods: %q %q %q", h.Mood, l.Mood, c.Mood)
	}
	if h.Pay <= 0 || h.Now != hard.Performance || h.Need != game.NeededToPromote(hard.CareerLevel) {
		t.Errorf("summary: %+v", h)
	}
	// A style that isn't one.
	s := workSim(t)
	toWork(t, s, false)
	if _, err := s.setStyle("sieste"); err == nil {
		t.Error("an unknown style")
	}
}

// The style is counted by the minute: half the shift hard, half at the minimum.
func TestShiftStyleMinutes(t *testing.T) {
	s := workSim(t)
	toWork(t, s, false)
	a := s.Activity
	s.setStyle(game.StyleHard)
	s.advanceTo(a.Start+(a.End-a.Start)/2, rand.New(rand.NewPCG(1, 2)))
	s.setStyle(game.StyleMinimum)
	endShift(s)
	if got := s.Life.Work.Last.Perf; got != 1 {
		t.Errorf("half hard (+4), half minimum (-2): %+d", got)
	}
}

// The event: asked from its minute, answered once; staying late lengthens the shift and pays a bonus.
func TestShiftEvent(t *testing.T) {
	s := workSim(t)
	sh := toWork(t, s, true)
	sh.Event, sh.EventAt = "tard", s.GameMinutes+2
	if _, err := s.answerShift(0, rand.New(rand.NewPCG(1, 1))); err != errNoEvent {
		t.Fatalf("before its minute: %v", err)
	}
	s.advanceTo(sh.EventAt, rand.New(rand.NewPCG(1, 2)))
	end := s.Activity.End
	out, err := s.answerShift(0, rand.New(rand.NewPCG(1, 1)))
	if err != nil || out.Text == "" || s.Activity.End != end+1 || !s.hasMood("tard") {
		t.Fatalf("stays late: %v %+v end %d → %d", err, out, end, s.Activity.End)
	}
	if _, err := s.answerShift(1, rand.New(rand.NewPCG(1, 1))); err != errNoEvent {
		t.Fatalf("answered twice: %v", err)
	}
	money := s.Money
	endShift(s)
	last := s.Life.Work.Last
	if last.Bonus <= 0 || last.Mood != "tard" || last.Result == "" || last.Perf < 4 {
		t.Errorf("the bonus and the day: %+v", last)
	}
	if s.Money-money != last.Pay+last.Bonus {
		t.Errorf("paid %d: pay %d + bonus %d", s.Money-money, last.Pay, last.Bonus)
	}
}

// Left unanswered, the quiet answer counts.
func TestShiftEventUnanswered(t *testing.T) {
	s := workSim(t)
	sh := toWork(t, s, true)
	sh.Event, sh.EventAt = "aide", s.GameMinutes+1
	before := s.coworkers(false)[0].Friendship
	endShift(s)
	if sh.Choice != 1 || s.Life.Work.Colleagues[0].Friendship >= before+2 {
		t.Errorf("« Pas le temps » by default: choice %d, friendship %d → %d", sh.Choice, before, s.Life.Work.Colleagues[0].Friendship)
	}
}

// A skill check: the charisme decides the presentation to the boss.
func TestShiftSkillCheck(t *testing.T) {
	won := func(level int) int {
		n := 0
		for seed := range uint64(200) {
			s := workSim(t)
			sh := toWork(t, s, true)
			s.Life.Skills = map[string]int{"charisme": game.SkillXP(level)}
			sh.Event, sh.EventAt = "patron", s.GameMinutes
			s.answerShift(0, rand.New(rand.NewPCG(seed, 9)))
			if sh.Perf > 0 {
				n++
			}
		}
		return n
	}
	lo, hi := won(1), won(10)
	if lo < 60 || lo > 110 || hi < 175 {
		t.Errorf("presented to the boss, out of 200: charisme 1 %d, charisme 10 %d", lo, hi)
	}
}

// Performance and the skill make the promotion: its moment in the summary, its mood, its wish.
func TestShiftPromotion(t *testing.T) {
	s := workSim(t)
	s.Life.Wishes = []game.Wish{{Goal: "promo", Label: "Obtenir une promotion", Points: 40, Until: s.GameMinutes + 600}}
	toWork(t, s, false)
	s.setStyle(game.StyleHard)
	s.Performance = game.NeededToPromote(0) - 2
	c, _ := game.FindCareer("commerce")
	endShift(s)
	p := s.Life.Work.Last.Promo
	if s.CareerLevel != 1 || p == nil || p.Title != c.Levels[1].Title || p.Pay != c.Levels[1].Pay || p.Was != c.Levels[0].Pay || !p.Wish {
		t.Fatalf("promoted: level %d, %+v", s.CareerLevel, p)
	}
	if !s.hasMood("promu") || s.Life.Points < 40 || s.Life.Work.Last.Mood != "promu" {
		t.Errorf("the mood and the wish: %v, %d points", s.Life.Moodlets, s.Life.Points)
	}
	// The third rung asks for the career's skill (charisme 2): held without it, however good the work.
	toNext := func() {
		s.GameMinutes = game.MinuteOf(monday.Add(32 * time.Hour))
		toWork(t, s, false)
		s.setStyle(game.StyleHard)
		s.Performance = game.NeededToPromote(1) + 5
		endShift(s)
	}
	toNext()
	if s.CareerLevel != 1 || s.Life.Work.Last.Promo != nil {
		t.Errorf("held for the skill: level %d", s.CareerLevel)
	}
}

// Shut, the shift is as it always was: no Shift, no summary.
func TestShiftShut(t *testing.T) {
	s := workSim(t)
	s.lifeOn = false
	if !s.goToWork() || s.Activity.Shift != nil {
		t.Fatalf("a shift as ever: %+v", s.Activity)
	}
	endShift(s)
	if s.Life.Work != nil {
		t.Errorf("nothing kept: %+v", s.Life.Work)
	}
}

// A child's school day: lived too, its grade moves.
func TestSchoolDay(t *testing.T) {
	s := workSim(t)
	s.Career = ""
	s.BornAt = s.GameMinutes - game.MinutesToAge(9)
	s.Housing = "studio"
	if _, err := s.interactAt(HomePlaceID, "aller-ecole"); err != nil {
		t.Fatal(err)
	}
	sh := s.Activity.Shift
	if sh == nil || !sh.School || sh.Ride != "car-ecole" {
		t.Fatalf("to school: %+v", sh)
	}
	sh.Event = ""
	s.setStyle(game.StyleHard)
	endShift(s)
	last := s.Life.Work.Last
	if !last.School || last.GradeWas != game.GradeStart || last.Grade != game.GradeStart+16 || game.Grade(last.Grade) != "C" || last.Mood != "bonne-ecole" {
		t.Errorf("the school day: %+v", last)
	}
}
