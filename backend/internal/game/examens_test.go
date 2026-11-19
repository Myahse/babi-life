package game

import (
	"slices"
	"testing"
)

// The rule itself: a small trade asks the BEPC alone, every other career the BEPC and the bac; only the
// retaken exams count (the old BEPC and bac, kept in BEPC / BAC, don't); the post held says it waits.
func TestWorkExams(t *testing.T) {
	for _, c := range Careers {
		want := []string{ExamBEPC, ExamBAC}
		if slices.Contains(SmallTrades, c.ID) {
			want = []string{ExamBEPC}
		}
		if !slices.Equal(WorkExams(c.ID), want) {
			t.Errorf("%s: exams %v, want %v", c.ID, WorkExams(c.ID), want)
		}
	}
	for _, id := range SmallTrades {
		if _, ok := FindCareer(id); !ok {
			t.Errorf("small trade %q is no career", id)
		}
	}
	if WorkExams("") != nil || WorkBlock("", nil, false) != nil {
		t.Error("no career asks for nothing")
	}

	old := &Exam{Note: 12}
	// The old diplomas (given at 18, or sat before the update): nothing counts.
	e := &Etudes{BEPC: old, BAC: old}
	if err := WorkBlock("bureau", e, false); err != ErrExamsBEPCBac {
		t.Errorf("bureau, old diplomas: %v", err)
	}
	if err := WorkBlock("bureau", e, true); err != ErrExamsBEPCBacPost {
		t.Errorf("bureau held, old diplomas: %v", err)
	}
	if err := WorkBlock("commerce", e, false); err != ErrExamsBEPC {
		t.Errorf("commerce, old diplomas: %v", err)
	}
	if err := WorkBlock("commerce", e, true); err != ErrExamsBEPCPost {
		t.Errorf("commerce held, old diplomas: %v", err)
	}
	// The BEPC retaken: the small trades open, the rest still wait for the bac.
	e.ReBEPC = &Exam{Note: 11, On: 100}
	if err := WorkBlock("commerce", e, true); err != nil {
		t.Errorf("commerce with the BEPC retaken: %v", err)
	}
	if err := WorkBlock("sante", e, false); err != ErrExamsBac {
		t.Errorf("sante with the BEPC only: %v", err)
	}
	if err := WorkBlock(ArmeeCareer, e, true); err != ErrExamsBacPost {
		t.Errorf("armee held with the BEPC only: %v", err)
	}
	if m := WorkMissing("droit", e); !slices.Equal(m, []string{ExamBAC}) {
		t.Errorf("droit missing %v", m)
	}
	// Both retaken: everything opens.
	e.ReBAC = &Exam{Note: 10, On: 200, Serie: SerieD}
	for _, c := range Careers {
		if err := WorkBlock(c.ID, e, true); err != nil {
			t.Errorf("%s with both retaken: %v", c.ID, err)
		}
	}
	// Nothing at all (a Sim that never studied).
	if m := WorkMissing("police", nil); !slices.Equal(m, []string{ExamBEPC, ExamBAC}) {
		t.Errorf("police, no studies: %v", m)
	}
}
