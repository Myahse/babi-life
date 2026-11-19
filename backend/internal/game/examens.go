package game

import (
	"errors"
	"slices"
)

// Les examens avant le travail (the update « examens-avant-travail », sims/examens.go; web game/examens.ts):
// nobody works a career before having retaken its exams at a lycée (« en candidat libre » for an adult),
// passed while the update is open. The BEPC and the bac given at 18 (life.go comeOfAge, the papers
// diplome-bepc / diplome-bac) and those sat at the lycée before the update don't count: they stay in the
// papers and in Etudes.BEPC / Etudes.BAC (the university and the career starts still read those), but work
// asks for Etudes.ReBEPC / Etudes.ReBAC, set only by a pass with the update open. A Sim already in a career
// keeps its post and its rung: it can't work (no shift, no task, no pay) until the exams are there, then
// carries on where it was. The diploma gates of the higher rungs (DiplomaGates) stay on top of this.

// ExamensKey: the update.
const ExamensKey = "examens-avant-travail"

// The exams work asks for.
const (
	ExamBEPC = "bepc"
	ExamBAC  = "bac"
)

// SmallTrades: the street and informal trades, open with the BEPC alone: the maquis (plongeur·se,
// serveur·se), the market (vendeur·se ambulant·e, petite table), the gbaka and the woro-woro (apprenti,
// chauffeur), the quartier's DJ, the salon and the barber (apprenti·e coiffeur·se). Every other career
// (an office, a counter, a uniform, a public service, a profession) asks for the bac too.
var SmallTrades = []string{"maquis", "commerce", "transport", "ambiance", "coiffure"}

// WorkExams: the exams a career asks for (nil: no career).
func WorkExams(career string) []string {
	if career == "" {
		return nil
	}
	if slices.Contains(SmallTrades, career) {
		return []string{ExamBEPC}
	}
	return []string{ExamBEPC, ExamBAC}
}

// WorkMissing: the exams this career still asks of these studies (retaken with the update open), in order.
func WorkMissing(career string, e *Etudes) []string {
	var out []string
	for _, x := range WorkExams(career) {
		switch {
		case x == ExamBEPC && (e == nil || e.ReBEPC == nil):
			out = append(out, x)
		case x == ExamBAC && (e == nil || e.ReBAC == nil):
			out = append(out, x)
		}
	}
	return out
}

// The refusals, whole sentences (the server's English catalogue holds each).
var (
	ErrExamsBEPC        = errors.New("Pour travailler, repasse d'abord ton BEPC au lycée (en candidat libre).")
	ErrExamsBEPCBac     = errors.New("Pour travailler, repasse d'abord ton BEPC puis ton BAC au lycée (en candidat libre).")
	ErrExamsBac         = errors.New("Pour travailler, repasse d'abord ton BAC au lycée (en candidat libre) : ton BEPC est déjà fait.")
	ErrExamsBEPCPost    = errors.New("Ton poste t'attend : pour reprendre le travail, repasse d'abord ton BEPC au lycée (en candidat libre).")
	ErrExamsBEPCBacPost = errors.New("Ton poste t'attend : pour reprendre le travail, repasse d'abord ton BEPC puis ton BAC au lycée (en candidat libre).")
	ErrExamsBacPost     = errors.New("Ton poste t'attend : pour reprendre le travail, repasse d'abord ton BAC au lycée (en candidat libre). Ton BEPC est déjà fait.")
)

// WorkBlock: why this career can't be worked (or taken) with these studies, nil when it can. held: the
// Sim already has the post (it waits for it).
func WorkBlock(career string, e *Etudes, held bool) error {
	miss := WorkMissing(career, e)
	switch {
	case len(miss) == 0:
		return nil
	case len(miss) == 2 && held:
		return ErrExamsBEPCBacPost
	case len(miss) == 2:
		return ErrExamsBEPCBac
	case miss[0] == ExamBAC && held:
		return ErrExamsBacPost
	case miss[0] == ExamBAC:
		return ErrExamsBac
	case held:
		return ErrExamsBEPCPost
	}
	return ErrExamsBEPC
}
