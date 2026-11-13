package sims

import (
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// L'armée (the update « armee », game/armee.go; web components/Caserne.tsx): the service militaire and the
// EMPT lived like the MACA's sentence (prison.go), but chosen: the Sim lives at the caserne (or the
// internat), nowhere else, its drills to pass round after round, each its own little game (a score under
// game.DrillPass doesn't count: again). All rounds passed, its paper (Papiers app) and the army's career
// a rung or two up. Kept in the Sim's Life (no column of its own).

// Armee: what the army keeps of a Sim.
type Armee struct {
	// Stay: the service or the EMPT being lived, nil when not.
	Stay *ArmyStay `json:"stay,omitempty"`
	// Service, Empt: done (the attestation, the brevet): the career starts higher.
	Service bool `json:"service,omitempty"`
	Empt    bool `json:"empt,omitempty"`
	// Ecrit, Physique: the EMPT concours' best scores (both at game.DrillPass: admitted).
	Ecrit    int `json:"ecrit,omitempty"`
	Physique int `json:"physique,omitempty"`
}

// ArmyStay: a program being lived.
type ArmyStay struct {
	Program string `json:"program"`
	Place   string `json:"place"`
	Since   int64  `json:"since"`
	// Round: the rounds passed (0-based: the one being done); Rounds: how many.
	Round  int      `json:"round"`
	Rounds int      `json:"rounds"`
	Unit   string   `json:"unit"`
	Steps  []string `json:"steps"`
	// Done: this round's drills passed.
	Done []string `json:"done"`
	// Sum, Count: the drills' scores, for the paper's mention.
	Sum   int `json:"sum,omitempty"`
	Count int `json:"count,omitempty"`
}

var (
	errInService   = errors.New("tu es au service militaire : tu vis à la caserne jusqu'à la fin de tes semaines de classes")
	errInEmpt      = errors.New("tu es à l'internat de l'EMPT : tu vis à l'école jusqu'à la fin de l'année")
	errNotRecruit  = errors.New("c'est pour les recrues du service militaire : engage-toi d'abord")
	errNotPupil    = errors.New("c'est pour les élèves de l'EMPT : réussis d'abord le concours d'entrée")
	errServiceDone = errors.New("tu as déjà fait ton service militaire : l'attestation est dans tes papiers")
	errEmptDone    = errors.New("tu as déjà ton brevet de l'EMPT")
	errEmptAge     = fmt.Errorf("le concours de l'EMPT est ouvert jusqu'à %d ans", game.EmptMaxAge)
	errEpreuveDone = errors.New("épreuve déjà réussie : passe l'autre")
	errBusyArmy    = errors.New("tu vis déjà à la caserne ou à l'internat")
	errArmyAlready = errors.New("tu es déjà dans l'armée")
)

// army: the Sim's army record, made when asked.
func (s *Sim) army() *Armee {
	if s.Life.Armee == nil {
		s.Life.Armee = &Armee{}
	}
	return s.Life.Armee
}

// armyStay: the program being lived, nil when none.
func (s *Sim) armyStay() *ArmyStay {
	if s.Life.Armee == nil {
		return nil
	}
	return s.Life.Armee.Stay
}

// armyGate: while a program is lived, only its own place (interactAt).
func (s *Sim) armyGate(placeID string) error {
	st := s.armyStay()
	if st == nil || placeID == st.Place {
		return nil
	}
	return st.err()
}

func (st *ArmyStay) err() error {
	if st.Program == game.EmptProgram.ID {
		return errInEmpt
	}
	return errInService
}

// armyCheck: whether this action of the caserne or the EMPT is the Sim's to do now (interactAt).
func (s *Sim) armyCheck(kind, id string) error {
	if kind != game.CaserneKind && kind != game.EmptKind {
		return nil
	}
	st := s.armyStay()
	a := s.Life.Armee
	if p, ok := game.ProgramOf(id); ok {
		if st == nil || st.Program != p.ID {
			if p.ID == game.EmptProgram.ID {
				return errNotPupil
			}
			return errNotRecruit
		}
		return nil
	}
	switch id {
	case game.ServiceSignID:
		if st != nil {
			return errBusyArmy
		}
		if a != nil && a.Service {
			return errServiceDone
		}
	case game.ArmeeJoinID:
		if st != nil {
			return errBusyArmy
		}
		if s.Career == game.ArmeeCareer {
			return errArmyAlready
		}
		if s.Record > 0 {
			return errRecordCareers
		}
	case game.EmptEcritID, game.EmptPhysiqueID:
		if st != nil {
			return errBusyArmy
		}
		if a != nil && a.Empt {
			return errEmptDone
		}
		if s.age() > game.EmptMaxAge {
			return errEmptAge
		}
		if a != nil && (id == game.EmptEcritID && a.Ecrit >= game.DrillPass || id == game.EmptPhysiqueID && a.Physique >= game.DrillPass) {
			return errEpreuveDone
		}
	}
	return nil
}

// armyStart: what an action of the caserne or the EMPT does as it starts (clock.go start): the sign-up,
// the career joined, leaving; unplayed (the update « gestes-maison » shut), a drill counts as done.
func (s *Sim) armyStart(id string) {
	switch id {
	case game.ServiceSignID:
		s.armyBegin(game.ServiceProgram)
		s.pending = append(s.pending, Event{Kind: "life", Text: fmt.Sprintf("Engagé·e pour le service militaire au %s : %d semaines de classes, tu vis à la caserne. Treillis, rangers, lit au carré : bienvenue, recrue !", game.ArmeeUnit, game.ServiceProgram.Rounds), GameTime: s.GameMinutes})
		return
	case game.ArmeeJoinID:
		s.pending = append(s.pending, Event{Kind: "career", Text: s.armyJoin(), GameTime: s.GameMinutes})
		return
	case game.ServiceQuitID, game.EmptQuitID:
		if st := s.armyStay(); st != nil {
			s.Life.Armee.Stay = nil
			what := "le service militaire"
			if st.Program == game.EmptProgram.ID {
				what = "l'EMPT"
			}
			s.pending = append(s.pending, Event{Kind: "life", Text: fmt.Sprintf("Tu quittes %s avant la fin : pas de papier cette fois. Tu pourras revenir.", what), GameTime: s.GameMinutes})
		}
		return
	}
	if playedNoClock() {
		return
	}
	if line := s.armyPlayed(id, 60); line != "" {
		s.pending = append(s.pending, Event{Kind: "life", Text: strings.TrimSpace(line), GameTime: s.GameMinutes})
	}
}

// armyBegin: a program starts, the Sim moves in (whatever it was doing ends once this is over).
func (s *Sim) armyBegin(p game.ArmyProgram) {
	s.army().Stay = &ArmyStay{Program: p.ID, Place: p.Place, Since: s.GameMinutes, Rounds: p.Rounds, Unit: p.Unit, Steps: slices.Clone(p.Steps), Done: []string{}}
}

// armyJoin: the army's career, at the rung what's been done opens; the line said.
func (s *Sim) armyJoin() string {
	c, _ := game.FindCareer(game.ArmeeCareer)
	a := s.army()
	lvl := game.ArmeeStartLevel(a.Service, a.Empt)
	s.Career, s.CareerLevel, s.Performance = c.ID, lvl, 0
	s.paperSync = true
	l := c.Levels[lvl]
	why := ""
	switch {
	case a.Empt:
		why = " (ton brevet de l'EMPT te fait entrer sergent)"
	case a.Service:
		why = " (ton service militaire te fait entrer caporal)"
	}
	return fmt.Sprintf("Engagé·e dans l'armée au %s comme %s%s : %s par service. Les missions t'attendent à la caserne.", game.ArmeeUnit, game.LowerFirst(l.Title), why, game.FCFA(l.Pay))
}

// armyPlayed: a drill or a concours épreuve played (sims/defi.go; or started, unplayed): what it does, the
// line to add ("" when it's not one).
func (s *Sim) armyPlayed(id string, score int) string {
	if id == game.EmptEcritID || id == game.EmptPhysiqueID {
		return s.armyConcours(id, score)
	}
	st := s.armyStay()
	if st == nil || !slices.Contains(st.Steps, id) {
		return ""
	}
	empt := st.Program == game.EmptProgram.ID
	if slices.Contains(st.Done, id) {
		if empt {
			return " Déjà validé ce trimestre : fais les autres."
		}
		return " Déjà validé cette semaine : fais les autres."
	}
	if score < game.DrillPass {
		return " Pas validé : l'instructeur te le fait refaire."
	}
	st.Done = append(st.Done, id)
	st.Sum += score
	st.Count++
	if len(st.Done) < len(st.Steps) {
		if empt {
			return fmt.Sprintf(" Validé ! (%d/%d ce trimestre)", len(st.Done), len(st.Steps))
		}
		return fmt.Sprintf(" Validé ! (%d/%d cette semaine)", len(st.Done), len(st.Steps))
	}
	st.Round++
	st.Done = []string{}
	if st.Round < st.Rounds {
		if empt {
			return fmt.Sprintf(" Trimestre %d sur %d terminé, bravo !", st.Round, st.Rounds)
		}
		return fmt.Sprintf(" Semaine %d sur %d terminée, bravo !", st.Round, st.Rounds)
	}
	return s.armyGraduate(st)
}

// armyGraduate: every round passed: its paper, the flag, out.
func (s *Sim) armyGraduate(st *ArmyStay) string {
	a := s.army()
	a.Stay = nil
	avg := 0
	if st.Count > 0 {
		avg = st.Sum / st.Count
	}
	d := s.who()
	d["unit"], d["since"], d["on"], d["rounds"], d["mention"] = game.ArmeeUnit, st.Since, s.GameMinutes, st.Rounds, game.DrillMention(avg)
	if _, _, p, ok := world.FindPlace(st.Place); ok {
		d["place"] = p.Name
	}
	start := ""
	if st.Program == game.EmptProgram.ID {
		a.Empt = true
		s.papers = append(s.papers, paperIssue{kind: game.DocEMPT, data: d, mode: paperRenew})
		if s.Career != game.ArmeeCareer {
			start = " L'armée t'ouvre ses portes au grade de sergent : « S'engager dans l'armée » à la caserne, ou l'appli Boulot."
		}
		return fmt.Sprintf(" Fin de l'année à l'EMPT ! Brevet obtenu, mention %s : il est dans l'appli Papiers.%s", game.DrillMention(avg), start)
	}
	a.Service = true
	s.papers = append(s.papers, paperIssue{kind: game.DocService, data: d, mode: paperRenew})
	if s.Career != game.ArmeeCareer {
		start = " Si l'armée te plaît, tu y entres caporal : « S'engager dans l'armée » à la caserne, ou l'appli Boulot."
	}
	return fmt.Sprintf(" Service militaire terminé ! Ton attestation de service (mention %s) est dans l'appli Papiers. Tu rentres chez toi.%s", game.DrillMention(avg), start)
}

// armyConcours: an épreuve of the EMPT's concours: its best kept; both passed, admitted to the internat.
func (s *Sim) armyConcours(id string, score int) string {
	a := s.army()
	what := "l'écrit"
	if id == game.EmptEcritID {
		a.Ecrit = max(a.Ecrit, score)
	} else {
		what = "l'épreuve physique"
		a.Physique = max(a.Physique, score)
	}
	if score < game.DrillPass {
		return fmt.Sprintf(" Concours de l'EMPT : %s n'est pas réussi (%d/100, il faut %d). Tu peux le repasser.", what, score, game.DrillPass)
	}
	if a.Ecrit < game.DrillPass || a.Physique < game.DrillPass {
		other := "l'épreuve physique"
		if id == game.EmptPhysiqueID {
			other = "l'écrit"
		}
		return fmt.Sprintf(" Concours de l'EMPT : %s réussi (%d/100) ! Reste %s.", what, score, other)
	}
	s.armyBegin(game.EmptProgram)
	return fmt.Sprintf(" Admis·e à l'EMPT ! Tu entres à l'internat : %d trimestres de cours, d'atelier et de sport.", game.EmptProgram.Rounds)
}
