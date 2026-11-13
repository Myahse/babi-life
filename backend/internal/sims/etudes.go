package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Le parcours d'études (the update « parcours-etudes », game/etudes.go for the rules and the pacing; web
// components/Etudes.tsx, the phone's « Études » app). Kept in the Sim's Life (Etudes): the lycée's
// classes, the internat, the BEPC and the bac played (their score is the action's game, Activity.Defi),
// the university's cursus (the classes counted, the partiels, the fees), the diplomas. The papers are
// derived from it (syncPapers), the careers read it (economy.go: the rungs that ask for a diploma, the
// start a diploma gives).

var (
	errInternatOnly  = errors.New("seulement pour les internes de ce lycée : choisis l'internat dans l'appli Études")
	errEtudesAdult   = errors.New("l'université, c'est après le bac, à 18 ans")
	errEtudesGoThere = errors.New("l'inscription se fait sur place : va d'abord à l'université")
	errEtudesNone    = errors.New("tu n'es inscrit·e nulle part")
	errInternatTeen  = errors.New("l'internat, c'est pour les collégiens et les lycéens")
	errNotLycee      = errors.New("ce n'est pas un lycée")
)

func etudesOpen(ctx context.Context) bool {
	return features.Default != nil && features.Default.BlocksKey(ctx, game.EtudesKey) == ""
}

// etudes: the Sim's studies, made when first needed.
func (s *Sim) etudes() *game.Etudes {
	if s.Life.Etudes == nil {
		s.Life.Etudes = &game.Etudes{}
	}
	return s.Life.Etudes
}

// diplomas: those obtained (none yet: nil).
func (s *Sim) diplomas() []game.Diplome {
	if s.Life.Etudes == nil {
		return nil
	}
	return s.Life.Etudes.Diplomas()
}

// mark: a mark out of 20 the French way (« 12,4 »).
func mark(n float64) string {
	return strings.Replace(strconv.FormatFloat(n, 'f', 1, 64), ".", ",", 1)
}

// mentionOf: « , mention Bien » (nothing for a pass).
func mentionOf(n float64) string {
	if m := game.Mention(n); m != "" && m != "Passable" {
		return ", mention " + m
	}
	return ""
}

// etudesTweak: a place's action as the studies make it (the update open): the internat's only for its
// boarders, the exams for those who may sit them (an adult pays, « candidat libre »), the partiel only
// where one is enrolled and once the classes are there (its game, the filière's: Variant).
func (s *Sim) etudesTweak(placeID string, it game.Interaction) (game.Interaction, error) {
	if !etudesOpen(context.Background()) {
		return it, nil
	}
	e := s.etudes()
	adult := !s.minor()
	switch it.ID {
	case game.EtudeSoirID, game.DortoirID, game.ReveilID:
		if !e.Internat || e.Lycee != placeID {
			return it, errInternatOnly
		}
	case game.BEPCID:
		if e.BEPC != nil {
			return it, game.ErrEtudesHasBEPC
		}
		if !adult && s.age() < game.BEPCAge {
			return it, fmt.Errorf("le BEPC se passe à partir de %d ans : encore un peu de collège", game.BEPCAge)
		}
		if adult {
			it.Cost, it.Label = game.BEPCFee, it.Label+" (candidat libre)"
		}
	case game.BacAID, game.BacCID, game.BacDID:
		if e.BAC != nil {
			return it, game.ErrEtudesHasBac
		}
		if e.BEPC == nil {
			return it, game.ErrEtudesNoBEPC
		}
		if !adult && s.age() < game.BacAge {
			return it, fmt.Errorf("le bac se passe à partir de %d ans : encore un peu de lycée", game.BacAge)
		}
		if adult {
			it.Cost, it.Label = game.BacFee, it.Label+" (candidat libre)"
		}
	case game.AmphiID:
		if c := e.Cursus; c != nil && c.Place == placeID && c.Due > 0 {
			return it, game.ErrEtudesDue
		}
	case game.PartielID:
		c := e.Cursus
		if c == nil || c.Place != placeID {
			return it, game.ErrEtudesNotHere
		}
		if c.Due > 0 {
			return it, game.ErrEtudesDue
		}
		if c.Cours < game.PartielCours && !c.Retake {
			return it, fmt.Errorf("encore %d cours en amphi avant le partiel (tu en as %d)", game.PartielCours-c.Cours, c.Cours)
		}
		it.Variant = c.Filiere
		if c.Retake {
			it.Label = fmt.Sprintf("Passer le rattrapage du semestre %d", c.Semestre)
		} else {
			it.Label = fmt.Sprintf("Passer le partiel du semestre %d", c.Semestre)
		}
	}
	return it, nil
}

// examScore: the score an exam counts as when it ends: its game's; not played, the default when the games
// are shut or it was left to play by itself; -1 when the Sim didn't sit it (it left the game unplayed).
func examScore(a *game.Activity) int {
	if a.Defi > 0 {
		return a.Defi
	}
	if a.Auto != nil || features.Default.BlocksKey(context.Background(), "gestes-maison") != "" {
		return game.ExamDefault
	}
	return -1
}

// etudesFinish: what an action ended brings to the studies (finish, clock.go): a class counted, an exam's
// result, a semester validated, a diploma.
func (s *Sim) etudesFinish(a *game.Activity) []Event {
	if a.Kind != "do" || !etudesOpen(context.Background()) {
		return nil
	}
	e := s.etudes()
	at := a.End
	say := func(text string, money int) []Event {
		return []Event{{Kind: "life", Text: text, Money: money, GameTime: at}}
	}
	switch id := a.Interaction.ID; id {
	case game.CoursLyceeID:
		e.Cours++
		if e.Lycee == "" {
			e.Lycee, e.LyceeName = a.PlaceID, a.PlaceName
		}
	case game.AmphiID:
		c := e.Cursus
		if c == nil || c.Place != a.PlaceID || c.Due > 0 {
			return nil
		}
		if !c.Attend(at) {
			return say(fmt.Sprintf("Cours suivi, mais il ne compte pas : %d cours comptés par jour au plus. Reviens demain.", game.CoursPerDay), 0)
		}
		if c.Cours >= game.PartielCours {
			return say(fmt.Sprintf("Cours validé (%d/%d ce semestre) : le partiel du semestre %d est ouvert.", c.Cours, game.SemesterCours, c.Semestre), 0)
		}
		return say(fmt.Sprintf("Cours validé (%d/%d ce semestre).", c.Cours, game.SemesterCours), 0)
	case game.BEPCID, game.BacAID, game.BacCID, game.BacDID:
		score := examScore(a)
		name := "BEPC"
		if id != game.BEPCID {
			name = "bac"
		}
		if score < 0 {
			return say(fmt.Sprintf("Copie blanche : tu n'as pas composé, le %s ne compte pas. Reviens le passer au lycée.", name), 0)
		}
		bonus := 0
		if s.minor() {
			bonus = game.ExamBonus(s.Performance)
		}
		note := game.ExamNote(score, bonus)
		ex := &game.Exam{Note: note, On: at, School: a.PlaceName, Serie: game.BacSerie(id)}
		if id == game.BEPCID {
			e.BEPCTries++
			if note < game.PassNote {
				return say(fmt.Sprintf("Recalé·e au BEPC (%s/20). Révise et reviens le repasser au lycée.", mark(note)), 0)
			}
			e.BEPC = ex
			s.paperSync = true
			s.addMood("fier", "bepc")
			return say(fmt.Sprintf("BEPC obtenu avec %s/20%s ! Le diplôme est dans tes papiers. Prochaine étape : le bac.", mark(note), mentionOf(note)), 0)
		}
		e.BACTries++
		if note < game.PassNote {
			return say(fmt.Sprintf("Recalé·e au bac série %s (%s/20). Reviens le repasser au lycée.", ex.Serie, mark(note)), 0)
		}
		e.BAC = ex
		s.paperSync = true
		s.addMood("fier", "bac")
		gift := s.family().BacGift
		s.Money += gift
		text := fmt.Sprintf("Bac série %s en poche avec %s/20%s ! Le diplôme est dans tes papiers.", ex.Serie, mark(note), mentionOf(note))
		if gift > 0 {
			text += fmt.Sprintf(" La famille est fière : %s offerts.", game.FCFA(gift))
		}
		if s.minor() {
			text += " À 18 ans, l'université t'attend (appli Études)."
		}
		return say(text, gift)
	case game.PartielID:
		c := e.Cursus
		if c == nil || c.Place != a.PlaceID {
			return nil
		}
		score := examScore(a)
		if score < 0 {
			return say("Absent·e au partiel : il ne compte pas. Reviens le passer.", 0)
		}
		note, res := c.Partiel(score)
		switch res {
		case game.PartielRetake:
			return say(fmt.Sprintf("Partiel raté (%s/20) : tu as droit au rattrapage, sans refaire les cours.", mark(note)), 0)
		case game.PartielRedo:
			return say(fmt.Sprintf("Rattrapage raté (%s/20) : le semestre %d est à refaire, cours compris.", mark(note), c.Semestre), 0)
		case game.PartielDone:
			d := game.Diplome{Degree: c.Degree, Filiere: c.Filiere, Place: c.Place, School: c.School, Note: c.Average(), On: at}
			e.Diplomes = append(e.Diplomes, d)
			e.Cursus = nil
			s.paperSync = true
			s.addMood("fier", "diplome")
			return say(fmt.Sprintf("Semestre validé (%s/20) : diplômé·e ! %s, %s, moyenne %s/20%s. Le diplôme est dans tes papiers.", mark(note), game.DiplomaLabel(d.Degree, d.Filiere), d.School, mark(d.Note), mentionOf(d.Note)), 0)
		}
		text := fmt.Sprintf("Semestre %d validé avec %s/20 ! Place au semestre %d sur %d.", c.Semestre-1, mark(note), c.Semestre, c.Semestres)
		// A new year (semesters 3, 5, 7): the réinscription.
		if c.Semestre%2 == 1 {
			sc, _ := game.FindSchool(c.Place)
			fee := sc.YearFee(c.Degree)
			if s.Money >= fee {
				s.Money -= fee
				return say(text+fmt.Sprintf(" Réinscription pour l'année payée : %s.", game.FCFA(fee)), -fee)
			}
			c.Due = fee
			text += fmt.Sprintf(" Réinscription à payer (%s) dans l'appli Études avant les prochains cours.", game.FCFA(fee))
		}
		return say(text, 0)
	}
	return nil
}

// importLegacy: a bac or a BEPC from before the update (given at 18 by the marks, in the papers), counted:
// its série unknown, it opens every filière.
func importLegacy(ctx context.Context, q interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, s *Sim) error {
	e := s.etudes()
	if e.BAC != nil && e.BEPC != nil {
		return nil
	}
	rows, err := q.Query(ctx, `SELECT kind, coalesce((data->>'marks')::float8, 10) FROM documents WHERE sim_id = $1 AND kind = ANY($2) AND NOT ended`, s.ID, []string{game.DocBEPC, game.DocBAC})
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var kind string
		var marks float64
		if err := rows.Scan(&kind, &marks); err != nil {
			return err
		}
		switch {
		case kind == game.DocBAC && e.BAC == nil:
			e.BAC = &game.Exam{Note: marks}
		case kind == game.DocBEPC && e.BEPC == nil:
			e.BEPC = &game.Exam{Note: marks}
		}
	}
	return rows.Err()
}

// bacSerie: the série the bac opens (« * »: a bac from before the séries), "" without one.
func bacSerie(e *game.Etudes) string {
	if e == nil || e.BAC == nil {
		return ""
	}
	if e.BAC.Serie == "" {
		return "*"
	}
	return e.BAC.Serie
}

// examPaper, diplomaPaper: the papers the studies give (syncPapers).
func (s *Sim) examPaper(kind string, ex *game.Exam) paperIssue {
	d := s.who()
	d["on"], d["marks"], d["mention"], d["school"], d["commune"] = ex.On, ex.Note, game.Mention(ex.Note), ex.School, communeName(s.HomeCity, s.HomeCommune)
	if ex.Serie != "" {
		d["serie"] = ex.Serie
	}
	return paperIssue{kind: kind, mode: paperUpdate, data: d}
}

func (s *Sim) diplomaPaper(dp game.Diplome) paperIssue {
	d := s.who()
	d["on"], d["marks"], d["mention"], d["school"], d["diploma"] = dp.On, dp.Note, game.Mention(dp.Note), dp.School, game.DiplomaLabel(dp.Degree, dp.Filiere)
	if c, cm, _, ok := world.FindPlace(dp.Place); ok {
		d["commune"] = communeName(c.ID, cm.ID)
	}
	return paperIssue{kind: game.DocDiplome, ref: dp.Ref(), mode: paperKeep, data: d, line: "Ton diplôme est dans tes papiers."}
}

// etudesPapers: the studies' papers (the exams sat since the update; a bac from before keeps its own).
func (s *Sim) etudesPapers() []paperIssue {
	e := s.Life.Etudes
	if e == nil {
		return nil
	}
	var out []paperIssue
	if e.BEPC != nil && e.BEPC.On != 0 {
		out = append(out, s.examPaper(game.DocBEPC, e.BEPC))
	}
	if e.BAC != nil && e.BAC.On != 0 {
		out = append(out, s.examPaper(game.DocBAC, e.BAC))
	}
	for _, d := range e.Diplomes {
		out = append(out, s.diplomaPaper(d))
	}
	return out
}

// schoolView: a university as the app shows it.
type schoolView struct {
	game.School
	Name    string `json:"name"`
	City    string `json:"city"`
	Commune string `json:"commune"`
	Where   string `json:"where"`
	Here    bool   `json:"here"`
	// Why: per offer (« licence:droit »), why it can't be begun ("" it can).
	Why map[string]string `json:"why"`
	// Fees: per offer, the year's.
	Fees map[string]int `json:"fees"`
}

type lyceeView struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	City    string `json:"city"`
	Commune string `json:"commune"`
	Where   string `json:"where"`
	Here    bool   `json:"here"`
}

// etudesView: what the app shows: the studies, the universities and what each offers to this Sim, the
// lycées, what the careers ask.
func (s *Sim) etudesView() map[string]any {
	e := s.etudes()
	schools := make([]schoolView, 0, len(game.Schools))
	for _, sc := range game.Schools {
		city, cm, p, ok := world.FindPlace(sc.Place)
		if !ok {
			continue
		}
		v := schoolView{School: sc, Name: p.Name, City: city.ID, Commune: cm.ID, Where: communeName(city.ID, cm.ID), Here: s.City == city.ID && s.Commune == cm.ID, Why: map[string]string{}, Fees: map[string]int{}}
		for _, o := range sc.Offers {
			k := o.Degree + ":" + o.Filiere
			v.Fees[k] = sc.YearFee(o.Degree)
			if err := game.CanEnrol(e, bacSerie(e), sc, o); err != nil {
				v.Why[k] = err.Error()
			}
		}
		schools = append(schools, v)
	}
	var lycees []lyceeView
	for _, id := range game.LyceeIDs {
		if city, cm, p, ok := world.FindPlace(id); ok {
			lycees = append(lycees, lyceeView{ID: id, Name: p.Name, City: city.ID, Commune: cm.ID, Where: communeName(city.ID, cm.ID), Here: s.City == city.ID && s.Commune == cm.ID})
		}
	}
	// Every diploma's name (« Licence de droit »), by « degree:filière ».
	labels := map[string]string{}
	for _, sc := range game.Schools {
		for _, o := range sc.Offers {
			labels[o.Degree+":"+o.Filiere] = game.DiplomaLabel(o.Degree, o.Filiere)
		}
	}
	gates := map[string]any{}
	for id, g := range game.DiplomaGates {
		c, _ := game.FindCareer(id)
		gates[id] = map[string]any{"career": c.Label, "title": c.Levels[g.Level].Title, "label": g.Label, "met": g.Meets(e.Diplomas())}
	}
	return map[string]any{
		"etudes": e, "age": s.age(), "minor": s.minor(), "marks": s.Performance,
		"schools": schools, "lycees": lycees, "gates": gates, "labels": labels,
		"degrees": game.Degrees, "filieres": game.Filieres, "series": game.Series,
		"rules": map[string]int{"bepcAge": game.BEPCAge, "bacAge": game.BacAge, "bepcFee": game.BEPCFee, "bacFee": game.BacFee, "semesterCours": game.SemesterCours, "partielCours": game.PartielCours, "coursPerDay": game.CoursPerDay, "bonus": game.ExamBonus(s.Performance)},
	}
}

// etudesGet: GET /sims/{id}/etudes.
func (h *Handler) etudesGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !etudesOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	s, err := scanSim(h.DB.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(ctx)))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	s.GameMinutes = max(s.GameMinutes, game.MinuteOf(time.Now()))
	if err := importLegacy(ctx, h.DB, &s); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, s.etudesView())
}

// etudesAct: what the app asks (s at the Sim, after the legacy diplomas are read).
func (s *Sim) etudesAct(action, place, degree, filiere string) (game.Outcome, []Event, error) {
	e := s.etudes()
	say := func(text string, money int) (game.Outcome, []Event, error) {
		return game.Outcome{Text: text, Money: money}, []Event{{Kind: "life", Text: text, Money: money, GameTime: s.GameMinutes}}, nil
	}
	switch action {
	case "inscription":
		if s.minor() {
			return game.Outcome{}, nil, errEtudesAdult
		}
		sc, ok := game.FindSchool(place)
		city, cm, p, found := world.FindPlace(place)
		if !ok || !found {
			return game.Outcome{}, nil, errors.New("université inconnue")
		}
		if s.City != city.ID || s.Commune != cm.ID {
			return game.Outcome{}, nil, errEtudesGoThere
		}
		o := game.Offer{Degree: degree, Filiere: filiere}
		if err := game.CanEnrol(e, bacSerie(e), sc, o); err != nil {
			return game.Outcome{}, nil, err
		}
		fee := sc.YearFee(degree)
		if s.Money < fee {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		s.Money -= fee
		c := game.NewCursus(sc, o, p.Name, s.GameMinutes)
		c.Due = 0
		e.Cursus = c
		return say(fmt.Sprintf("Inscrit·e en %s à %s : frais de l'année payés (%s). Semestre 1 sur %d : %d cours en amphi (%d par jour au plus), puis le partiel.", game.DiplomaLabel(degree, filiere), p.Name, game.FCFA(fee), c.Semestres, game.SemesterCours, game.CoursPerDay), -fee)
	case "reinscription":
		c := e.Cursus
		if c == nil {
			return game.Outcome{}, nil, errEtudesNone
		}
		if c.Due == 0 {
			return game.Outcome{}, nil, errors.New("ta réinscription est déjà payée")
		}
		if s.Money < c.Due {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		fee := c.Due
		s.Money -= fee
		c.Due = 0
		return say(fmt.Sprintf("Réinscription payée (%s) : les cours reprennent.", game.FCFA(fee)), -fee)
	case "abandon":
		c := e.Cursus
		if c == nil {
			return game.Outcome{}, nil, errEtudesNone
		}
		e.Cursus = nil
		return say(fmt.Sprintf("Tu abandonnes ta %s à %s. Tu pourras te réinscrire plus tard.", game.DiplomaLabel(c.Degree, c.Filiere), c.School), 0)
	case "internat", "externat":
		if !s.minor() || s.stage().ID != game.StageAdo {
			return game.Outcome{}, nil, errInternatTeen
		}
		if action == "externat" {
			e.Internat = false
			return say("Externe : tu dors à la maison tous les soirs.", 0)
		}
		_, _, p, ok := world.FindPlace(place)
		if !ok || !game.IsLycee(place) {
			return game.Outcome{}, nil, errNotLycee
		}
		e.Lycee, e.LyceeName, e.Internat = place, p.Name, true
		return say(fmt.Sprintf("La famille t'inscrit à l'internat du %s : en semaine, le dortoir, l'étude du soir et le réveil à 5 h 30 ; le week-end, la maison.", p.Name), 0)
	}
	return game.Outcome{}, nil, errors.New("requête invalide")
}

// etudesPost: POST /sims/{id}/etudes {action, place, degree, filiere}.
func (h *Handler) etudesPost(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Action  string `json:"action"`
		Place   string `json:"place"`
		Degree  string `json:"degree"`
		Filiere string `json:"filiere"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	if !etudesOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := importLegacy(ctx, tx, s); err != nil {
			return game.Outcome{}, nil, err
		}
		return s.etudesAct(req.Action, req.Place, req.Degree, req.Filiere)
	})
}

// careerStart: the rung a Sim is hired at, with its diplomas (the update open).
func (s *Sim) careerStart(career string) int {
	if !etudesOpen(context.Background()) {
		return 0
	}
	return game.StartLevel(career, s.diplomas())
}

// promotionGate: the diploma the next rung asks for and the Sim hasn't (the update open), if any.
func (s *Sim) promotionGate(c game.Career) (game.Gate, bool) {
	if !etudesOpen(context.Background()) {
		return game.Gate{}, false
	}
	return game.GateHeld(c.ID, s.CareerLevel, s.diplomas())
}
