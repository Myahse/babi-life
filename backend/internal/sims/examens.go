package sims

import (
	"context"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// Les examens avant le travail (the update « examens-avant-travail », game/examens.go for the rule). Checked
// wherever work is taken, done or paid: the hire (economy.go career, the army's sign-up armee.go), the
// shift started by hand, by the Boulot app's switch or le mode vie's « Partir au travail » (interactAt,
// goWork; the offline replay goes through interactAt too), the job's tasks (jobs.go), the shift's pay and
// its promotion (clock.go finish, pay). The exams retaken are recorded by etudesFinish (etudes.go): the
// retake opens even to those who had them, the bac only after the BEPC retaken.
//
// Not work, left alone: the petits boulots (open to anyone: the money for the candidat libre's fees), the
// lots and businesses' takings (Mon quartier, immobilier: an owner's income, not a shift), the political
// mandates (an election, not a hire), the service militaire and the EMPT (a training, not the career).

// examsGateOn: the update open, with the studies (where the exams are sat): without them the rule can't be met.
func examsGateOn() bool {
	ctx := context.Background()
	return features.Default != nil && features.Default.BlocksKey(ctx, game.ExamensKey) == "" && etudesOpen(ctx)
}

// workBlock: why the Sim can't take or work this career now (nil: it can).
func (s *Sim) workBlock(career string) error {
	if career == "" || !examsGateOn() {
		return nil
	}
	return game.WorkBlock(career, s.Life.Etudes, career == s.Career)
}

// examsRetake: with the update open, the exam's own « passed » is the retaken one (the old one doesn't count).
func examsRetake(e *game.Etudes, bac bool) *game.Exam {
	if !examsGateOn() {
		if bac {
			return e.BAC
		}
		return e.BEPC
	}
	if bac {
		return e.ReBAC
	}
	return e.ReBEPC
}

// examsBack: said after a retake passed: the post waiting can be worked again.
func (s *Sim) examsBack() string {
	if s.Career == "" || !examsGateOn() || s.workBlock(s.Career) != nil {
		return ""
	}
	return " Ton poste t'attend : tu peux reprendre le travail là où tu en étais."
}

// examsView: what the Études app shows of the rule (nil with the update shut).
func (s *Sim) examsView() map[string]any {
	if !examsGateOn() {
		return nil
	}
	v := map[string]any{"smallTrades": game.SmallTrades}
	if c, ok := game.FindCareer(s.Career); ok {
		v["career"], v["title"], v["needs"], v["missing"] = c.Label, c.Levels[min(s.CareerLevel, len(c.Levels)-1)].Title, game.WorkExams(c.ID), game.WorkMissing(c.ID, s.Life.Etudes)
	}
	return v
}
