package game

import (
	"errors"
	"fmt"
	"math"
	"slices"
	"strings"
)

// Le parcours d'études (the update « parcours-etudes », sims/etudes.go, web components/Etudes.tsx): the
// collège and the lycée (real lycées in the big towns, world/lycees.go) with their classes, the récré,
// the internat, the BEPC and the bac played as exams (the bac in série A, C or D); then the university:
// the inscription, a filière the bac's série allows, semesters validated by the classes attended and the
// partiels played, and the diplomas (BTS, Licence, Master, doctorat en médecine or en pharmacie,
// ingénieur), kept in the Papiers app. Some careers ask for one past their first rungs (DiplomaGates);
// a diploma starts a career higher (StartLevel).
//
// Pacing. The teenager's whole adolescence is an hour of play (GrowUp), so the lycée is short: the BEPC
// can be sat from 14 (about 20 minutes into it), the bac from 16 (about 40), and a bac not taken by 18
// is sat later « en candidat libre ». The university is lived on the real calendar instead: a semester
// asks for SemesterCours classes, at most CoursPerDay counted a real day, then its partiel; so a
// semester is two real days of play at the soonest (classes are on weekdays), a Licence about two
// weeks, a Master two more. The real years are compressed: a Licence's six semesters are six, a
// doctorat in medicine (seven years for real) is eight.

// EtudesKey: the update.
const EtudesKey = "parcours-etudes"

// The lycée's actions (catalog.go « school », only at the lycées: LyceeIDs), the exams, the university's.
const (
	CoursLyceeID = "cours-lycee"
	RecreID      = "recre-lycee"
	CantineID    = "cantine-lycee"
	EtudeSoirID  = "etude-du-soir"
	DortoirID    = "dortoir-internat"
	ReveilID     = "reveil-internat"
	BEPCID       = "examen-bepc"
	BacAID       = "bac-serie-a"
	BacCID       = "bac-serie-c"
	BacDID       = "bac-serie-d"
	AmphiID      = "amphi"
	PartielID    = "partiel"
)

// EtudesInteractions: what the update brings to the places (features.go).
var EtudesInteractions = []string{CoursLyceeID, RecreID, CantineID, EtudeSoirID, DortoirID, ReveilID, BEPCID, BacAID, BacCID, BacDID}

// The lycées (world/lycees.go): the real ones of the big towns and a few « Collège moderne ».
var LyceeIDs = []string{
	"lycee-classique-abidjan", "lycee-sainte-marie-cocody", "lycee-moderne-yopougon", "lycee-moderne-adjame", "lycee-moderne-treichville",
	"lycee-moderne-koumassi", "lycee-moderne-port-bouet", "lycee-garcons-bingerville", "college-moderne-abobo", "college-moderne-marcory",
	"college-moderne-plateau", "lycee-scientifique-yamoussoukro", "lycee-mamie-adjoua", "lycee-classique-bouake", "lycee-djibo-sounkalo",
	"lycee-moderne-daloa", "lycee-moderne-korhogo", "lycee-moderne-man", "lycee-moderne-san-pedro", "college-moderne-grand-bassam",
}

// IsLycee: a place that is one of the lycées.
func IsLycee(placeID string) bool { return slices.Contains(LyceeIDs, placeID) }

// The exams.
const (
	BEPCAge = 14 // a teenager sits the BEPC from this age
	BacAge  = 16 // and the bac from this one (an adult whenever: « candidat libre »)
	// Candidat libre: what an adult pays to sit them (the family pays for a teenager).
	BEPCFee = 5000
	BacFee  = 10000
	// PassNote: the mark out of 20 that passes an exam or validates a semester.
	PassNote = 10
	// ExamDefault: the score an exam counts as when it isn't played (the update « gestes-maison » closed, or
	// left to play by itself).
	ExamDefault = 55
)

// The bac's séries.
const (
	SerieA = "A"
	SerieC = "C"
	SerieD = "D"
)

// Series: what each says, for the app.
var Series = []struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Hint  string `json:"hint"`
}{
	{SerieA, "Série A (littéraire)", "Lettres, langues, philosophie : ouvre le droit, les lettres, les sciences économiques."},
	{SerieC, "Série C (maths et physique)", "La plus scientifique : ouvre tout, de la médecine à l'école d'ingénieurs."},
	{SerieD, "Série D (sciences de la vie)", "SVT, maths, physique : ouvre la médecine, la pharmacie, les sciences, l'informatique."},
}

// BacSerie: the série of a bac's interaction ("" when it isn't one).
func BacSerie(interaction string) string {
	switch interaction {
	case BacAID:
		return SerieA
	case BacCID:
		return SerieC
	case BacDID:
		return SerieD
	}
	return ""
}

// ExamNote: the mark out of 20 of an exam not played (its game shut: ExamDefault), with the year's bonus
// (points on 20).
func ExamNote(score int, bonus float64) float64 {
	return min(20, Round1(float64(min(100, max(0, score)))/5+max(0, bonus)))
}

// Round1: a mark to the tenth.
func Round1(n float64) float64 { return math.Round(n*10) / 10 }

// BonusMax, BonusCours: the year's marks (classes and homework done, Sim.Performance while minor) add up
// to BonusMax points to an exam's mark, and only once BonusCours of the lycée's classes were followed.
const (
	BonusMax   = 1.0
	BonusCours = 5
)

// YearBonus: what the year brings to an exam's mark (points on 20).
func YearBonus(marks, cours int) float64 {
	if cours < BonusCours || marks <= 0 {
		return 0
	}
	return min(BonusMax, Round1(float64(marks)/20))
}

// The exams played. Each sitting draws its questions at random from big banks by subject (web
// jeux/configs/examens/, 60 to 80 an exam), so many per subject (Draw), 20 seconds each; the mark is each
// subject's mark (its right answers out of those drawn, on 20) weighed by the série's coefficients. The
// client sends its right answers per subject (a Copie), checked against the plan: never more than drawn.
const (
	QuestionSeconds = 20
	// OralLow: a bac's mark from this to PassNote goes to the second tour, an oral of OralQuestions.
	OralLow       = 8
	OralQuestions = 5
	// PartielQuestions: drawn from the filière's bank (web jeux/configs/partiels.ts).
	PartielQuestions = 10
	// ExamWait: after a failure, the next session opens a real day later (game minutes are real ones).
	ExamWait = 24 * 60
	// MinSeconds: a copy handed in faster than this a question wasn't read (the server refuses it).
	MinSeconds = 1
)

// A Subject of an exam: its coefficient, how many of its questions a sitting draws.
type Subject struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Coef  int    `json:"coef"`
	Draw  int    `json:"draw"`
}

// ExamPlans: the subjects of each exam, close to the real coefficients (BEPC: français and maths first;
// bac A: philosophie and français; C: maths and physique-chimie; D: SVT), 15 questions a sitting.
var ExamPlans = map[string][]Subject{
	BEPCID: {
		{"maths", "Mathématiques", 3, 3}, {"francais", "Français", 3, 3}, {"histoire-geo", "Histoire-géographie", 2, 3},
		{"svt", "SVT", 2, 2}, {"physique", "Physique-chimie", 2, 2}, {"anglais", "Anglais", 2, 2},
	},
	BacAID: {
		{"philo", "Philosophie", 5, 3}, {"francais", "Français", 4, 3}, {"histoire-geo", "Histoire-géographie", 3, 3},
		{"anglais", "Anglais", 3, 3}, {"maths", "Mathématiques", 2, 3},
	},
	BacCID: {
		{"maths", "Mathématiques", 5, 3}, {"physique", "Physique-chimie", 5, 3}, {"francais", "Français", 3, 3},
		{"svt", "SVT", 2, 2}, {"philo", "Philosophie", 2, 2}, {"anglais", "Anglais", 2, 2},
	},
	BacDID: {
		{"svt", "SVT", 5, 3}, {"physique", "Physique-chimie", 4, 3}, {"maths", "Mathématiques", 4, 3},
		{"francais", "Français", 3, 2}, {"philo", "Philosophie", 2, 2}, {"anglais", "Anglais", 2, 2},
	},
}

// OralVariant: the bac's interaction as the second tour (its Variant, its game `bac-serie-c:oral`).
const OralVariant = "oral"

// PlanOf: the subjects an exam's sitting draws (nil: not an exam). The oral: one question of each of the
// série's five heaviest subjects; the partiel: its filière's bank.
func PlanOf(interaction, variant string) []Subject {
	if interaction == PartielID {
		if f, ok := FindFiliere(variant); ok {
			return []Subject{{f.ID, f.Label, 1, PartielQuestions}}
		}
		return nil
	}
	plan, ok := ExamPlans[interaction]
	if !ok {
		return nil
	}
	if variant != OralVariant || interaction == BEPCID {
		return plan
	}
	oral := slices.Clone(plan)
	slices.SortStableFunc(oral, func(a, b Subject) int { return b.Coef - a.Coef })
	oral = oral[:OralQuestions]
	for i := range oral {
		oral[i].Draw = 1
	}
	return oral
}

// IsExam: an interaction played as an exam (its copy checked).
func IsExam(interaction string) bool {
	_, ok := ExamPlans[interaction]
	return ok || interaction == PartielID
}

// A Sitting: an exam sat (its interaction), its mark (the year's bonus in it), its copy.
type Sitting struct {
	Exam  string  `json:"exam"`
	Note  float64 `json:"note"`
	Bonus float64 `json:"bonus,omitempty"`
	Copie Copie   `json:"copie"`
	On    int64   `json:"on"`
}

// A Copie: per subject, the right answers and the questions drawn.
type Copie map[string][2]int

var ErrCopie = errors.New("copie illisible : recompose l'épreuve")

// ParseCopie: the copy the client sends (« maths:2/3,francais:1/3 »), checked against the plan: every
// subject once, as many questions as drawn, never more right than asked.
func ParseCopie(s string, plan []Subject) (Copie, error) {
	c := Copie{}
	for _, part := range strings.Split(s, ",") {
		id, frac, ok := strings.Cut(strings.TrimSpace(part), ":")
		if !ok {
			return nil, ErrCopie
		}
		var right, asked int
		if n, err := fmt.Sscanf(frac, "%d/%d", &right, &asked); err != nil || n != 2 {
			return nil, ErrCopie
		}
		if _, dup := c[id]; dup {
			return nil, ErrCopie
		}
		c[id] = [2]int{right, asked}
	}
	if len(c) != len(plan) {
		return nil, ErrCopie
	}
	for _, sub := range plan {
		got, ok := c[sub.ID]
		if !ok || got[1] != sub.Draw || got[0] < 0 || got[0] > got[1] {
			return nil, ErrCopie
		}
	}
	return c, nil
}

// Asked: how many questions the copy answers.
func (c Copie) Asked() int {
	n := 0
	for _, v := range c {
		n += v[1]
	}
	return n
}

// Right: how many it got right.
func (c Copie) Right() int {
	n := 0
	for _, v := range c {
		n += v[0]
	}
	return n
}

// CopieNote: the mark out of 20: each subject's (on 20) weighed by its coefficient.
func CopieNote(plan []Subject, c Copie) float64 {
	sum, coefs := 0.0, 0
	for _, sub := range plan {
		v := c[sub.ID]
		if v[1] == 0 {
			continue
		}
		sum += float64(sub.Coef) * 20 * float64(v[0]) / float64(v[1])
		coefs += sub.Coef
	}
	if coefs == 0 {
		return 0
	}
	return Round1(sum / float64(coefs))
}

// OralPass: the second tour: the oral's mark (on 20) counts for a third, the first tour's for two; 10
// passes (the bac is then given with 10, Passable).
func OralPass(first float64, right int) bool {
	oral := 20 * float64(right) / OralQuestions
	return (2*first+oral)/3 >= PassNote-1e-9
}

// Mention: what the mark is worth on the diploma.
func Mention(note float64) string {
	switch {
	case note >= 16:
		return "Très bien"
	case note >= 14:
		return "Bien"
	case note >= 12:
		return "Assez bien"
	case note >= PassNote:
		return "Passable"
	}
	return ""
}

// An Exam passed: its mark, its série (the bac's), when, where; Oral: passed at the second tour.
type Exam struct {
	Note   float64 `json:"note"`
	Serie  string  `json:"serie,omitempty"`
	On     int64   `json:"on"`
	School string  `json:"school,omitempty"`
	Oral   bool    `json:"oral,omitempty"`
}

// The diplomas of higher education.
const (
	DegreeBTS       = "bts"
	DegreeLicence   = "licence"
	DegreeMaster    = "master"
	DegreeMedecine  = "medecine"
	DegreePharmacie = "pharmacie"
	DegreeIngenieur = "ingenieur"
)

// A Degree: its name and its semesters (compressed: see the pacing above).
type Degree struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Semesters int    `json:"semesters"`
	// Needs: the diploma it follows (the Master a Licence of the same filière).
	Needs string `json:"needs,omitempty"`
	// Rank: how far it goes (bac+2, bac+3…), for what a career asks.
	Rank int `json:"rank"`
}

var Degrees = []Degree{
	{ID: DegreeBTS, Label: "BTS", Semesters: 4, Rank: 2},
	{ID: DegreeLicence, Label: "Licence", Semesters: 6, Rank: 3},
	{ID: DegreeMaster, Label: "Master", Semesters: 4, Needs: DegreeLicence, Rank: 5},
	{ID: DegreeMedecine, Label: "Doctorat en médecine", Semesters: 8, Rank: 7},
	{ID: DegreePharmacie, Label: "Doctorat en pharmacie", Semesters: 8, Rank: 6},
	{ID: DegreeIngenieur, Label: "Diplôme d'ingénieur", Semesters: 8, Rank: 5},
}

func FindDegree(id string) (Degree, bool) {
	i := slices.IndexFunc(Degrees, func(d Degree) bool { return d.ID == id })
	if i < 0 {
		return Degree{}, false
	}
	return Degrees[i], true
}

// A Filiere: what's studied, and the bac séries that may enter it; MinNote: a selective one, the bac's
// mark it asks (12: Assez bien).
type Filiere struct {
	ID      string   `json:"id"`
	Label   string   `json:"label"`
	Series  []string `json:"series"`
	MinNote float64  `json:"minNote,omitempty"`
}

var Filieres = []Filiere{
	{ID: "droit", Label: "Droit", Series: []string{SerieA, SerieC, SerieD}},
	{ID: "lettres", Label: "Lettres et langues", Series: []string{SerieA}},
	{ID: "eco", Label: "Sciences économiques et gestion", Series: []string{SerieA, SerieC, SerieD}},
	{ID: "info", Label: "Informatique", Series: []string{SerieC, SerieD}},
	{ID: "sciences", Label: "Sciences et technologies", Series: []string{SerieC, SerieD}},
	{ID: "medecine", Label: "Médecine", Series: []string{SerieC, SerieD}, MinNote: 12},
	{ID: "pharmacie", Label: "Pharmacie", Series: []string{SerieC, SerieD}, MinNote: 12},
	{ID: "gestion", Label: "Gestion commerciale", Series: []string{SerieA, SerieC, SerieD}},
	{ID: "genie", Label: "Génie civil et industriel", Series: []string{SerieC, SerieD}},
}

func FindFiliere(id string) (Filiere, bool) {
	i := slices.IndexFunc(Filieres, func(f Filiere) bool { return f.ID == id })
	if i < 0 {
		return Filiere{}, false
	}
	return Filieres[i], true
}

// An Offer: a diploma in a filière, taught at a school.
type Offer struct {
	Degree  string `json:"degree"`
	Filiere string `json:"filiere"`
}

// A School of higher education (a university place, world.go): public or private, its yearly fees.
type School struct {
	Place  string  `json:"place"`
	Public bool    `json:"public"`
	Fee    int     `json:"fee"`  // FCFA a year (a Licence's, a BTS's)
	Fee2   int     `json:"fee2"` // FCFA a year from the Master on (and medicine, pharmacy)
	Offers []Offer `json:"offers"`
	// A selective school (the INP-HB): the séries it takes, the bac's mark it asks (14: Bien).
	Series  []string `json:"series,omitempty"`
	MinNote float64  `json:"minNote,omitempty"`
}

// Fees. Public: the state universities' registration fees, their real order of magnitude (30 000 F a year
// in Licence, 60 000 F in Master). Private: far under the real ones (several hundred thousand francs a
// year) so a player can pay them by working: 150 000 F, BTS 100 000 F (docs/economie.md).
const (
	PublicFee      = 30000
	PublicFee2     = 60000
	GrandeEcoleFee = 40000
	PrivateFee     = 150000
	PrivateFee2    = 200000
	PrivateBTSFee  = 100000
)

func lm(filieres ...string) []Offer {
	var o []Offer
	for _, f := range filieres {
		o = append(o, Offer{DegreeLicence, f}, Offer{DegreeMaster, f})
	}
	return o
}

// Schools: the universities that enrol (world.go's « universite » places).
var Schools = []School{
	{Place: "cocody-universite", Public: true, Fee: PublicFee, Fee2: PublicFee2, Offers: append(lm("droit", "lettres", "eco", "info", "sciences"), Offer{DegreeMedecine, "medecine"}, Offer{DegreePharmacie, "pharmacie"})},
	{Place: "abobo-una", Public: true, Fee: PublicFee, Fee2: PublicFee2, Offers: lm("sciences", "info")},
	{Place: "bouake-universite", Public: true, Fee: PublicFee, Fee2: PublicFee2, Offers: append(lm("droit", "lettres", "eco", "sciences"), Offer{DegreeMedecine, "medecine"})},
	{Place: "korhogo-universite", Public: true, Fee: PublicFee, Fee2: PublicFee2, Offers: lm("droit", "lettres", "eco", "sciences")},
	{Place: "daloa-universite", Public: true, Fee: PublicFee, Fee2: PublicFee2, Offers: lm("lettres", "eco", "sciences")},
	{Place: "yakro-inphb", Public: true, Fee: GrandeEcoleFee, Fee2: GrandeEcoleFee, Series: []string{SerieC, SerieD}, MinNote: 14, Offers: []Offer{{DegreeBTS, "gestion"}, {DegreeBTS, "info"}, {DegreeIngenieur, "genie"}, {DegreeIngenieur, "info"}}},
	{Place: "cocody-ucao", Fee: PrivateFee, Fee2: PrivateFee2, Offers: append(lm("droit", "eco", "info"), Offer{DegreeBTS, "gestion"}, Offer{DegreeBTS, "info"})},
	{Place: "cocody-iua", Fee: PrivateFee, Fee2: PrivateFee2, Offers: append(lm("droit", "eco", "info", "lettres"), Offer{DegreeBTS, "gestion"}, Offer{DegreeBTS, "info"})},
	{Place: "bassam-iugb", Fee: PrivateFee, Fee2: PrivateFee2, Offers: lm("eco", "info")},
}

func FindSchool(place string) (School, bool) {
	i := slices.IndexFunc(Schools, func(s School) bool { return s.Place == place })
	if i < 0 {
		return School{}, false
	}
	return Schools[i], true
}

// YearFee: what a year of this diploma costs at the school.
func (sc School) YearFee(degree string) int {
	switch {
	case degree == DegreeBTS && !sc.Public:
		return PrivateBTSFee
	case degree == DegreeMaster || degree == DegreeMedecine || degree == DegreePharmacie:
		return sc.Fee2
	}
	return sc.Fee
}

// The semesters.
const (
	SemesterCours = 6 // classes (amphi) a semester asks for
	PartielCours  = 4 // the partiel can be sat from this many
	CoursPerDay   = 3 // at most this many counted a real day
)

// A Cursus: the diploma being prepared, where, how far.
type Cursus struct {
	Place     string    `json:"place"`
	School    string    `json:"school"`
	Degree    string    `json:"degree"`
	Filiere   string    `json:"filiere"`
	Semestre  int       `json:"semestre"`  // the one under way, from 1
	Semestres int       `json:"semestres"` // how many
	Cours     int       `json:"cours"`     // attended this semester
	Day       int64     `json:"day"`       // the real day of the last class counted
	Today     int       `json:"today"`     // how many counted that day
	Retake    bool      `json:"retake,omitempty"`
	Last      float64   `json:"last,omitempty"` // the last partiel's mark
	Notes     []float64 `json:"notes,omitempty"`
	// Due: the year's fee not paid yet (the classes wait for it).
	Due   int   `json:"due,omitempty"`
	Since int64 `json:"since"`
}

// A Diplome obtained.
type Diplome struct {
	Degree  string  `json:"degree"`
	Filiere string  `json:"filiere"`
	Place   string  `json:"place"`
	School  string  `json:"school"`
	Note    float64 `json:"note"`
	On      int64   `json:"on"`
}

// Diplomas: those obtained.
func (e *Etudes) Diplomas() []Diplome {
	if e == nil {
		return nil
	}
	return e.Diplomes
}

// Ref: its document's ref (one per diploma and filière).
func (d Diplome) Ref() string { return d.Degree + ":" + d.Filiere }

// Etudes: a Sim's schooling (kept in its Life).
type Etudes struct {
	// The lycée: the classes attended there, where, the internat chosen.
	Cours     int    `json:"cours,omitempty"`
	Lycee     string `json:"lycee,omitempty"`
	LyceeName string `json:"lyceeName,omitempty"`
	Internat  bool   `json:"internat,omitempty"`
	// The exams passed, and how many times sat.
	BEPC      *Exam `json:"bepc,omitempty"`
	BAC       *Exam `json:"bac,omitempty"`
	BEPCTries int   `json:"bepcTries,omitempty"`
	BACTries  int   `json:"bacTries,omitempty"`
	// After a failure, when the next session opens (game minute: a real day later).
	BEPCNext int64 `json:"bepcNext,omitempty"`
	BACNext  int64 `json:"bacNext,omitempty"`
	// Oral: the bac's first tour between OralLow and PassNote (its mark, its série): the second tour awaits.
	Oral *Exam `json:"oral,omitempty"`
	// Last: the last BEPC or bac sat, its subjects' results (the app shows them).
	Last *Sitting `json:"last,omitempty"`
	// The university.
	Cursus   *Cursus   `json:"cursus,omitempty"`
	Diplomes []Diplome `json:"diplomes,omitempty"`
}

var (
	ErrEtudesNoBac      = errors.New("il faut d'abord le bac : il se passe au lycée (en candidat libre si tu as plus de 18 ans)")
	ErrEtudesSerie      = errors.New("ta série de bac ne permet pas cette filière")
	ErrEtudesEnrolled   = errors.New("tu es déjà inscrit·e : termine ou abandonne d'abord ton cursus (appli Études)")
	ErrEtudesNotOffered = errors.New("cette formation n'est pas proposée ici")
	ErrEtudesHas        = errors.New("tu as déjà ce diplôme")
	ErrEtudesNotHere    = errors.New("tu n'es pas inscrit·e ici : inscris-toi dans l'appli Études, sur place")
	ErrEtudesDue        = errors.New("ta réinscription n'est pas payée : règle-la dans l'appli Études")
	ErrEtudesNoBEPC     = errors.New("il faut d'abord le BEPC")
	ErrEtudesHasBEPC    = errors.New("tu as déjà ton BEPC")
	ErrEtudesHasBac     = errors.New("tu as déjà ton bac")
	ErrEtudesSante      = errors.New("filière sélective : il faut un bac C ou D avec au moins la mention Assez bien (12/20)")
	ErrEtudesINPHB      = errors.New("école sélective : l'INP-HB prend les bacheliers C ou D avec au moins la mention Bien (14/20)")
)

// Has: a diploma of that kind (and filière, "" for any) among these.
func Has(dips []Diplome, degree, filiere string) bool {
	return slices.ContainsFunc(dips, func(d Diplome) bool { return d.Degree == degree && (filiere == "" || d.Filiere == filiere) })
}

// RankOf: the highest diploma's rank (2 a BTS… 0 none).
func RankOf(dips []Diplome) int {
	r := 0
	for _, d := range dips {
		if dg, ok := FindDegree(d.Degree); ok {
			r = max(r, dg.Rank)
		}
	}
	return r
}

// CanEnrol: whether a Sim with these studies (bac: its série, "*" for a bac from before the séries, ""
// none; note: its mark) may begin this diploma at this school. The selective ones (médecine, pharmacie,
// the INP-HB) ask for a série and a mention; a bac from before the séries meets any série, its mention is
// its mark's (Passable without one: importLegacy).
func CanEnrol(e *Etudes, bac string, note float64, sc School, o Offer) error {
	if !slices.Contains(sc.Offers, o) {
		return ErrEtudesNotOffered
	}
	if e != nil && e.Cursus != nil {
		return ErrEtudesEnrolled
	}
	if bac == "" {
		return ErrEtudesNoBac
	}
	f, _ := FindFiliere(o.Filiere)
	serieOK := func(series []string) bool { return bac == "*" || slices.Contains(series, bac) }
	if len(sc.Series) > 0 && (!serieOK(sc.Series) || note < sc.MinNote) {
		return ErrEtudesINPHB
	}
	if f.MinNote > 0 && (!serieOK(f.Series) || note < f.MinNote) {
		return ErrEtudesSante
	}
	if !serieOK(f.Series) {
		return ErrEtudesSerie
	}
	var dips []Diplome
	if e != nil {
		dips = e.Diplomes
	}
	if Has(dips, o.Degree, o.Filiere) {
		return ErrEtudesHas
	}
	if d, _ := FindDegree(o.Degree); d.Needs != "" && !Has(dips, d.Needs, o.Filiere) {
		return fmt.Errorf("il faut d'abord la %s", DiplomaLabel(d.Needs, o.Filiere))
	}
	return nil
}

// NewCursus: the first semester of a diploma, the fee of its first year owed (paid at once by the caller).
func NewCursus(sc School, o Offer, schoolName string, now int64) *Cursus {
	d, _ := FindDegree(o.Degree)
	return &Cursus{Place: sc.Place, School: schoolName, Degree: o.Degree, Filiere: o.Filiere, Semestre: 1, Semestres: d.Semesters, Since: now, Due: sc.YearFee(o.Degree)}
}

// Attend: a class at the amphi counted (true), unless the day's are all counted already.
func (c *Cursus) Attend(now int64) bool {
	day := now / (24 * 60)
	if day != c.Day {
		c.Day, c.Today = day, 0
	}
	if c.Today >= CoursPerDay || c.Cours >= SemesterCours+2 {
		return false
	}
	c.Today++
	c.Cours++
	return true
}

// SemesterNote: a semester's mark out of 20: the partiel (score 0..100) for four fifths, attendance
// (the classes, up to SemesterCours+2) for the rest.
func SemesterNote(score, cours int) float64 {
	p := float64(min(100, max(0, score))) / 5 * 0.8
	a := 4 * float64(min(cours, SemesterCours+2)) / float64(SemesterCours+2)
	return math.Round((p+a)*10) / 10
}

// The partiel's outcome.
const (
	PartielValidated = iota // the semester validated
	PartielRetake           // failed: the rattrapage, once, without more classes
	PartielRedo             // failed again: the semester to do again
	PartielDone             // that was the last semester: the diploma
)

// Partiel: the partiel sat with this score; the mark and what follows. A validated semester moves on
// (the next year's fee owed at each odd one: the caller charges it).
func (c *Cursus) Partiel(score int) (float64, int) {
	note := SemesterNote(score, c.Cours)
	c.Last = note
	if note < PassNote {
		if !c.Retake {
			c.Retake = true
			return note, PartielRetake
		}
		c.Retake, c.Cours, c.Today = false, 0, 0
		return note, PartielRedo
	}
	c.Notes = append(c.Notes, note)
	c.Retake, c.Cours, c.Today = false, 0, 0
	if c.Semestre >= c.Semestres {
		return note, PartielDone
	}
	c.Semestre++
	return note, PartielValidated
}

// Average: the mark of the whole diploma.
func (c *Cursus) Average() float64 {
	if len(c.Notes) == 0 {
		return 0
	}
	s := 0.0
	for _, n := range c.Notes {
		s += n
	}
	return math.Round(s/float64(len(c.Notes))*10) / 10
}

// A Gate: the rung of a career that asks for a diploma (DiplomaGates).
type Gate struct {
	Level   int    `json:"level"`
	Degree  string `json:"degree,omitempty"`  // that diploma…
	Filiere string `json:"filiere,omitempty"` // …in that filière ("" any)
	Rank    int    `json:"rank,omitempty"`    // or any diploma of this rank or more
	Label   string `json:"label"`
}

// DiplomaGates: the careers that ask for a diploma past their first rungs (the update open). Anyone can
// still be hired at the bottom; those already on or past the rung keep it (grandfathered).
var DiplomaGates = map[string]Gate{
	"droit":        {Level: 1, Degree: DegreeMaster, Filiere: "droit", Label: "un Master de droit"},
	"sante":        {Level: 3, Degree: DegreeMedecine, Label: "le doctorat en médecine"},
	"pharmacie":    {Level: 2, Degree: DegreePharmacie, Label: "le doctorat en pharmacie"},
	"enseignement": {Level: 1, Rank: 3, Label: "une Licence (ou plus)"},
}

// Meets: whether these diplomas open the gate.
func (g Gate) Meets(dips []Diplome) bool {
	if g.Degree != "" {
		return Has(dips, g.Degree, g.Filiere)
	}
	return RankOf(dips) >= g.Rank
}

// GateHeld: the gate a promotion from `level` to the next would cross without the diploma, if any.
func GateHeld(career string, level int, dips []Diplome) (Gate, bool) {
	g, ok := DiplomaGates[career]
	if !ok || level+1 != g.Level || g.Meets(dips) {
		return Gate{}, false
	}
	return g, true
}

// StartLevel: the rung a diploma lets a Sim be hired at (0 without one).
func StartLevel(career string, dips []Diplome) int {
	rank := RankOf(dips)
	switch career {
	case "droit":
		if Has(dips, DegreeMaster, "droit") {
			return 1
		}
	case "sante":
		if Has(dips, DegreeMedecine, "") {
			return 3
		}
		if Has(dips, DegreeLicence, "sciences") {
			return 1
		}
	case "pharmacie":
		if Has(dips, DegreePharmacie, "") {
			return 2
		}
	case "enseignement":
		if rank >= 5 {
			return 2
		}
		if rank >= 3 {
			return 1
		}
	case "bureau":
		if rank >= 5 {
			return 2
		}
		if rank >= 2 {
			return 1
		}
	case "commerce", "vente", "caisse", "hotellerie", "aerien", "mairie":
		if rank >= 2 {
			return 1
		}
	}
	return 0
}

// DiplomaLabel: « Licence de droit », « BTS en gestion commerciale ».
func DiplomaLabel(degree, filiere string) string {
	d, _ := FindDegree(degree)
	f, _ := FindFiliere(filiere)
	switch degree {
	case DegreeMedecine, DegreePharmacie:
		return d.Label
	case DegreeBTS, DegreeIngenieur:
		return d.Label + " en " + LowerFirst(f.Label)
	}
	l := LowerFirst(f.Label)
	if l != "" && strings.ContainsRune("aeiouéè", []rune(l)[0]) {
		return d.Label + " d'" + l
	}
	return d.Label + " de " + l
}
