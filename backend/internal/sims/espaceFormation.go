package sims

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// L'espace, les carrières et la formation (game/espaceCarriere.go; web components/espace/Formation.tsx). Lived
// like the EMPT (armee.go): the concours written, the selection's drills, each played (a score under
// game.DrillPass doesn't count: again), the stay's three modules once hired « Astronaute candidat·e », and at the
// end the brevet (Papiers app) and the rung Astronaute. The tourists' « formation express »: two drills, free
// with their ticket, needed to board (espace.go spaceLaunch, spaceBoard). A mission is so many shifts aboard,
// each in the one-shift-a-day cap (the work's own: nothing else up there pays). Kept in Life.Espace.Formation.

// Formation: what the training centre keeps of a Sim.
type Formation struct {
	// Ecrit: the concours' best score; Drills: the selection's best scores; Selected: all passed.
	Ecrit    int            `json:"ecrit,omitempty"`
	Drills   map[string]int `json:"drills,omitempty"`
	Selected bool           `json:"selected,omitempty"`
	// Stay: the training stay being lived (hired as a candidate).
	Stay *FormationStay `json:"stay,omitempty"`
	// Brevet: the « Brevet d'astronaute Astrélia » (BrevetOn: when).
	Brevet   bool  `json:"brevet,omitempty"`
	BrevetOn int64 `json:"brevetOn,omitempty"`
	// Tourist: the express training's drills passed (both: Espace.Training).
	Tourist []string `json:"tourist,omitempty"`
	// Mission: the mission flown now (its shifts aboard); MissionsDone: those accomplished.
	Mission      *SpaceMission `json:"mission,omitempty"`
	MissionsDone int           `json:"missionsDone,omitempty"`
}

// FormationStay: the training stay's modules.
type FormationStay struct {
	// Module: the modules passed (0-based: the one being done); Modules: how many.
	Module  int      `json:"module"`
	Modules int      `json:"modules"`
	Done    []string `json:"done"`
	Since   int64    `json:"since"`
	Sum     int      `json:"sum,omitempty"`
	Count   int      `json:"count,omitempty"`
}

// SpaceMission: a mission's shifts worked aboard (Launched: its voyage's launch, to tell one from the next).
type SpaceMission struct {
	Dest     string `json:"dest"`
	Launched int64  `json:"launched"`
	Shifts   int    `json:"shifts"`
	Need     int    `json:"need"`
	Done     bool   `json:"done,omitempty"`
}

var (
	errAstroBac       = errors.New("le concours d'Astrélia est ouvert aux bacheliers des séries C et D")
	errAstroEcritDone = errors.New("écrit déjà réussi : passe maintenant les épreuves de sélection")
	errAstroNeedEcrit = errors.New("réussis d'abord l'écrit du concours Astrélia")
	errAstroSelDone   = errors.New("tu es déjà sélectionné·e : signe avec Astrélia dans l'appli Boulot (Astronaute)")
	errAstroDrillDone = errors.New("épreuve déjà réussie : passe les autres")
	errAstroNotStay   = errors.New("c'est la formation des astronautes candidats : sois d'abord sélectionné·e et embauché·e")
	errAstroNotModule = errors.New("ce n'est pas au programme de ce module")
	errAstroModDone   = errors.New("déjà validé pour ce module : fais les autres")
	errAstroNoTicket  = errors.New("la formation express est comprise dans le billet : achète-le d'abord au pas de tir")
	errAstroTrained   = errors.New("ta formation express est déjà faite : bon vol !")
	errAstroStaff     = errors.New("c'est pour le personnel d'Astrélia et ses candidats")
	errAstroHire      = errors.New("pour être astronaute, réussis d'abord la sélection au Centre d'entraînement Astrélia de Sassandra (le concours et les cinq épreuves)")
	errSpaceSick      = errors.New("le médecin d'Astrélia dit non : tu es malade. Soigne-toi d'abord")
	errSpaceTraining  = errors.New("fais d'abord ta formation express (deux épreuves, comprises dans le billet), au pas de tir ou au centre d'entraînement")
	errNeedsLow       = "la visite médicale demande chaque besoin à %d au moins : %s"
)

func init() {
	// The medical isn't played: it checks (the needs, the illness) and counts at once (defi.go gesteNot).
	gesteNot = append(gesteNot, game.SelMedicaleID)
}

// formation: the Sim's training record, made when asked.
func (s *Sim) formation() *Formation {
	e := s.space()
	if e.Formation == nil {
		e.Formation = &Formation{}
	}
	return e.Formation
}

// hasBrevet: the brevet earned.
func (s *Sim) hasBrevet() bool {
	return s.Life.Espace != nil && s.Life.Espace.Formation != nil && s.Life.Espace.Formation.Brevet
}

// bacCD: a bac of the série C or D (or one from before the séries), the concours' condition.
func (s *Sim) bacCD() bool {
	e := s.Life.Etudes
	if e == nil {
		return false
	}
	for _, x := range []*game.Exam{e.BAC, e.ReBAC} {
		if x != nil && (x.Serie == game.SerieC || x.Serie == game.SerieD || x.Serie == "" || x.Serie == "*") {
			return true
		}
	}
	return false
}

// lowNeeds: the needs under the medical's bar, by name.
func lowNeeds(n game.Needs) []string {
	var out []string
	for _, x := range []struct {
		v    float64
		name string
	}{{n.Hunger, "la faim"}, {n.Energy, "l'énergie"}, {n.Hygiene, "l'hygiène"}, {n.Social, "le social"}, {n.Fun, "le moral"}} {
		if x.v < game.MedicalMin {
			out = append(out, x.name)
		}
	}
	return out
}

// espaceBefore: what the training and the boarding read in the database before the action (interact, travel):
// the illness (the update « cycle-vie »), for the medical and the rocket.
func espaceBefore(ctx context.Context, tx pgx.Tx, s *Sim, id string) error {
	if (id != game.SelMedicaleID && id != game.RocketApp) || !cycleVieOpen(ctx) {
		return nil
	}
	h, err := readHealth(ctx, tx, s.ID, time.Now())
	if err != nil {
		return err
	}
	s.sick = h.Kind != ""
	return nil
}

// formationCheck: whether this action of the training centre (or a pad's express training) is the Sim's to do
// now (interactAt).
func (s *Sim) formationCheck(kind, id string) error {
	if kind != game.EntrainementKind && kind != game.SpatioportKind {
		return nil
	}
	if !game.IsFormationDrill(id) && !slices.Contains(game.CentreLife, id) {
		return nil
	}
	f := &Formation{}
	if e := s.Life.Espace; e != nil && e.Formation != nil {
		f = e.Formation
	}
	switch {
	case slices.Contains(game.CentreLife, id):
		if !game.IsEspaceCareer(s.Career) && f.Stay == nil {
			return errAstroStaff
		}
	case id == game.ConcoursEcritID:
		if f.Selected || f.Brevet {
			return errAstroSelDone
		}
		if f.Ecrit >= game.DrillPass {
			return errAstroEcritDone
		}
		if !s.bacCD() {
			return errAstroBac
		}
	case slices.Contains(game.SelectionDrills, id):
		if f.Selected || f.Brevet {
			return errAstroSelDone
		}
		if f.Ecrit < game.DrillPass {
			return errAstroNeedEcrit
		}
		if f.Drills[id] >= game.DrillPass {
			return errAstroDrillDone
		}
		if id == game.SelMedicaleID {
			if low := lowNeeds(s.Needs); len(low) > 0 {
				return fmt.Errorf(errNeedsLow, game.MedicalMin, strings.Join(low, ", "))
			}
			if s.sick {
				return errSpaceSick
			}
		}
	case game.IsModuleStep(id):
		st := f.Stay
		if st == nil || s.Career != game.AstronauteCareer {
			return errAstroNotStay
		}
		if !slices.Contains(game.FormationModules[min(st.Module, len(game.FormationModules)-1)].Steps, id) {
			return errAstroNotModule
		}
		if slices.Contains(st.Done, id) {
			return errAstroModDone
		}
	case slices.Contains(game.TouristDrills, id):
		e := s.Life.Espace
		if e != nil && e.Training {
			return errAstroTrained
		}
		if (e == nil || e.Ticket == nil) && len(game.Missions[s.Career]) == 0 {
			return errAstroNoTicket
		}
		if slices.Contains(f.Tourist, id) {
			return errAstroDrillDone
		}
	}
	return nil
}

// formationStart: what an action of the training does as it starts (clock.go start): the medical counted at
// once; unplayed (the update « gestes-maison » shut), a drill counts as done.
func (s *Sim) formationStart(it game.Interaction) {
	if !game.IsFormationDrill(it.ID) {
		return
	}
	if it.ID != game.SelMedicaleID && playedNoClock() {
		return
	}
	score := 60
	if it.ID == game.SelMedicaleID {
		score = 100
	}
	if line := s.formationPlayed(it.ID, score); line != "" {
		s.pending = append(s.pending, Event{Kind: "life", Text: strings.TrimSpace(line), GameTime: s.GameMinutes})
	}
}

// formationPlayed: a drill (or the concours) played (defi.go; or started, unplayed): what it does, the line to
// add ("" when it's not one).
func (s *Sim) formationPlayed(id string, score int) string {
	if !game.IsFormationDrill(id) {
		return ""
	}
	f := s.formation()
	switch {
	case id == game.ConcoursEcritID:
		f.Ecrit = max(f.Ecrit, score)
		if score < game.DrillPass {
			return fmt.Sprintf(" Concours Astrélia : l'écrit n'est pas réussi (%d/100, il faut %d). Tu peux le repasser.", score, game.DrillPass)
		}
		return fmt.Sprintf(" Concours Astrélia : écrit réussi (%d/100) ! Place aux %d épreuves de sélection.", score, len(game.SelectionDrills))
	case slices.Contains(game.SelectionDrills, id):
		if f.Drills == nil {
			f.Drills = map[string]int{}
		}
		f.Drills[id] = max(f.Drills[id], score)
		if score < game.DrillPass {
			return " Pas validé : l'instructeur te le fait refaire."
		}
		n := 0
		for _, d := range game.SelectionDrills {
			if f.Drills[d] >= game.DrillPass {
				n++
			}
		}
		if n < len(game.SelectionDrills) {
			return fmt.Sprintf(" Validé ! (%d/%d épreuves de sélection)", n, len(game.SelectionDrills))
		}
		f.Selected = true
		return " Sélectionné·e par Astrélia ! Signe ton contrat d'astronaute candidat·e : appli Boulot, Astronaute. La formation t'attend au centre."
	case game.IsModuleStep(id):
		return s.moduleDone(f, id, score)
	case slices.Contains(game.TouristDrills, id):
		if score < game.DrillPass {
			return " Pas validé : l'instructrice te le fait refaire, sans stress."
		}
		if !slices.Contains(f.Tourist, id) {
			f.Tourist = append(f.Tourist, id)
		}
		if len(f.Tourist) < len(game.TouristDrills) {
			return fmt.Sprintf(" Validé ! (%d/%d de la formation express)", len(f.Tourist), len(game.TouristDrills))
		}
		s.space().Training = true
		return " Formation express terminée : tu es prêt·e à embarquer. Bon vol !"
	}
	return ""
}

// moduleDone: a drill of the stay played; the module, then the stay, passed.
func (s *Sim) moduleDone(f *Formation, id string, score int) string {
	st := f.Stay
	if st == nil {
		return ""
	}
	if slices.Contains(st.Done, id) {
		return " Déjà validé pour ce module : fais les autres."
	}
	if score < game.DrillPass {
		return " Pas validé : l'instructeur te le fait refaire."
	}
	steps := game.FormationModules[min(st.Module, len(game.FormationModules)-1)].Steps
	st.Done = append(st.Done, id)
	st.Sum += score
	st.Count++
	if len(st.Done) < len(steps) {
		return fmt.Sprintf(" Validé ! (%d/%d dans ce module)", len(st.Done), len(steps))
	}
	st.Module++
	st.Done = []string{}
	if st.Module < st.Modules {
		return fmt.Sprintf(" Module %d sur %d terminé, bravo ! Le suivant : « %s ».", st.Module, st.Modules, game.FormationModules[st.Module].Name)
	}
	return s.brevetEarned(f, st)
}

// brevetEarned: the stay over: the brevet in the Papiers app, the rung Astronaute (when the diploma's there).
func (s *Sim) brevetEarned(f *Formation, st *FormationStay) string {
	avg := 0
	if st.Count > 0 {
		avg = st.Sum / st.Count
	}
	f.Stay, f.Brevet, f.BrevetOn = nil, true, s.GameMinutes
	d := s.who()
	d["agency"], d["since"], d["on"], d["modules"], d["mention"] = game.Agency, st.Since, s.GameMinutes, st.Modules, game.DrillMention(avg)
	if _, _, p, ok := world.FindPlace(game.EntrainementID); ok {
		d["place"] = p.Name
	}
	s.papers = append(s.papers, paperIssue{kind: game.DocBrevetAstro, data: d, mode: paperRenew})
	line := fmt.Sprintf(" Formation terminée ! Le Brevet d'astronaute Astrélia (mention %s) est dans l'appli Papiers.", game.DrillMention(avg))
	c, ok := game.FindCareer(game.AstronauteCareer)
	if !ok || s.Career != c.ID || s.CareerLevel > 0 {
		return line
	}
	if g, held := s.promotionGate(c); held {
		return line + fmt.Sprintf(" Pour devenir %s, il te faut encore %s (appli Études).", c.Levels[g.Level].Title, g.Label)
	}
	s.CareerLevel, s.Performance = 1, 0
	s.paperSync = true
	return line + fmt.Sprintf(" Te voilà %s (%s par service) : la Station Akwaba t'attend, ta mission est gratuite.", game.LowerFirst(c.Levels[1].Title), game.FCFA(c.Levels[1].Pay))
}

// espaceHire: whether this career of Astrélia can be taken (economy.go career): its update open; an
// astronaute's, the selection passed.
func (s *Sim) espaceHire(career string) error {
	if !game.IsEspaceCareer(career) {
		return nil
	}
	if !spaceOpen(game.EspaceKey) {
		return errSpaceClosed
	}
	if career == game.AstronauteCareer {
		if f := s.Life.Espace; f == nil || f.Formation == nil || !(f.Formation.Selected || f.Formation.Brevet) {
			return errAstroHire
		}
	}
	return nil
}

// espaceJoined: said once hired at Astrélia (economy.go career, the career set): a candidate's stay begins;
// with the brevet, the rung Astronaute (the diploma's gate permitting).
func (s *Sim) espaceJoined() string {
	if s.Career != game.AstronauteCareer {
		return ""
	}
	f := s.formation()
	if f.Brevet {
		if c, ok := game.FindCareer(s.Career); ok && s.CareerLevel == 0 {
			if _, held := s.promotionGate(c); !held {
				s.CareerLevel = 1
			}
		}
		return " Ton brevet d'astronaute compte : bienvenue dans l'équipage d'Astrélia."
	}
	s.CareerLevel = 0
	if f.Stay == nil {
		f.Stay = &FormationStay{Modules: len(game.FormationModules), Done: []string{}, Since: s.GameMinutes}
	}
	return fmt.Sprintf(" Ta formation commence au Centre d'entraînement Astrélia de Sassandra : %d modules, puis le brevet.", len(game.FormationModules))
}

// brevetGate: an astronaut candidate isn't promoted without the brevet (etudes.go promotionGate).
func (s *Sim) brevetGate(c game.Career) (game.Gate, bool) {
	if c.ID != game.AstronauteCareer || s.CareerLevel != 0 || s.hasBrevet() {
		return game.Gate{}, false
	}
	return game.Gate{Level: 1, Label: "le Brevet d'astronaute Astrélia (la formation au centre de Sassandra)"}, true
}

// missionAllowed: this career flies free to there now (its rung; an astronaut, the brevet).
func (s *Sim) missionAllowed(dest string) bool {
	if !game.FliesFree(s.Career, dest) {
		return false
	}
	lvl, ok := game.MissionLevel(s.Career, dest)
	if !ok || s.CareerLevel < lvl {
		return false
	}
	return s.Career != game.AstronauteCareer || s.hasBrevet()
}

// spaceBoard: the preflight's medical at boarding: not sick; and trained (the express training, or the brevet).
func (s *Sim) spaceBoard() error {
	if s.sick {
		return errSpaceSick
	}
	if e := s.Life.Espace; (e == nil || !e.Training) && !s.hasBrevet() {
		return errSpaceTraining
	}
	return nil
}

// missionShift: a shift worked aboard on a mission (espace.go spaceFinish): counted; all done, the mission is
// accomplished (the performance, never money: the shift's own pay is all, in its daily cap).
func (s *Sim) missionShift(a *game.Activity) []Event {
	v := s.voyage()
	if a == nil || a.Career == "" || a.Interaction.ID != game.WorkInteractionID || v == nil || !v.Mission || v.Arrived == 0 {
		return nil
	}
	f := s.formation()
	if f.Mission == nil || f.Mission.Launched != v.Launched {
		f.Mission = &SpaceMission{Dest: v.Dest, Launched: v.Launched, Need: max(1, game.MissionShifts[v.Dest])}
	}
	m := f.Mission
	if m.Done {
		return nil
	}
	m.Shifts++
	if m.Shifts < m.Need {
		return []Event{{Kind: "career", Text: fmt.Sprintf("Mission : service %d sur %d fait à bord.", m.Shifts, m.Need), GameTime: s.GameMinutes}}
	}
	m.Done = true
	f.MissionsDone++
	s.Performance += 5
	d, _ := game.FindDestination(m.Dest)
	return []Event{{Kind: "career", Text: fmt.Sprintf("Mission accomplie à la %s ! Le contrôle de mission d'Abidjan applaudit. Rentre quand tu veux : le retour est prêt au sas.", d.Name), GameTime: s.GameMinutes}}
}
