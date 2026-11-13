package game

import (
	"errors"
	"slices"
	"testing"
)

// The bac's série decides the filières; a Master follows a Licence of the same filière; one cursus at a time.
func TestCanEnrol(t *testing.T) {
	ufhb, _ := FindSchool("cocody-universite")
	lic := func(f string) Offer { return Offer{DegreeLicence, f} }
	e := &Etudes{}
	if err := CanEnrol(e, "", 12, ufhb, lic("droit")); !errors.Is(err, ErrEtudesNoBac) {
		t.Errorf("no bac: %v", err)
	}
	if err := CanEnrol(e, SerieA, 12, ufhb, Offer{DegreeMedecine, "medecine"}); !errors.Is(err, ErrEtudesSante) {
		t.Errorf("A in medicine: %v", err)
	}
	if err := CanEnrol(e, SerieD, 12, ufhb, Offer{DegreeMedecine, "medecine"}); err != nil {
		t.Errorf("D in medicine: %v", err)
	}
	if err := CanEnrol(e, "*", 12, ufhb, lic("info")); err != nil {
		t.Errorf("a bac from before the séries opens everything: %v", err)
	}
	if err := CanEnrol(e, SerieC, 12, ufhb, Offer{DegreeBTS, "gestion"}); !errors.Is(err, ErrEtudesNotOffered) {
		t.Errorf("BTS at the UFHB: %v", err)
	}
	if err := CanEnrol(e, SerieA, 12, ufhb, Offer{DegreeMaster, "droit"}); err == nil {
		t.Error("a Master without the Licence")
	}
	e.Diplomes = []Diplome{{Degree: DegreeLicence, Filiere: "droit"}}
	if err := CanEnrol(e, SerieA, 12, ufhb, Offer{DegreeMaster, "droit"}); err != nil {
		t.Errorf("Master after the Licence: %v", err)
	}
	if err := CanEnrol(e, SerieA, 12, ufhb, lic("droit")); !errors.Is(err, ErrEtudesHas) {
		t.Errorf("the Licence again: %v", err)
	}
	e.Cursus = &Cursus{}
	if err := CanEnrol(e, SerieA, 12, ufhb, lic("lettres")); !errors.Is(err, ErrEtudesEnrolled) {
		t.Errorf("two at once: %v", err)
	}
	// The fees: public cheap, the Master dearer, private more.
	ucao, _ := FindSchool("cocody-ucao")
	if ufhb.YearFee(DegreeLicence) != PublicFee || ufhb.YearFee(DegreeMaster) != PublicFee2 || ucao.YearFee(DegreeLicence) <= ufhb.YearFee(DegreeLicence) || ucao.YearFee(DegreeBTS) != PrivateBTSFee {
		t.Error("fees")
	}
}

// Classes count three a day at most; the partiel decides: a retake once, then the semester again; the last
// semester validated, the diploma.
func TestCursus(t *testing.T) {
	ufhb, _ := FindSchool("cocody-universite")
	c := NewCursus(ufhb, Offer{DegreeLicence, "droit"}, "UFHB", 0)
	if c.Semestres != 6 || c.Due != PublicFee {
		t.Fatalf("new: %+v", c)
	}
	day := int64(24 * 60)
	for i := 0; i < 4; i++ {
		ok := c.Attend(day + int64(i))
		if ok != (i < CoursPerDay) {
			t.Fatalf("class %d counted %v", i, ok)
		}
	}
	for i := 0; i < 3; i++ {
		c.Attend(2*day + int64(i))
	}
	if c.Cours != 6 {
		t.Fatalf("cours %d", c.Cours)
	}
	if note, res := c.Partiel(10); res != PartielRetake || note >= PassNote {
		t.Fatalf("bad partiel: %v %v", note, res)
	}
	if _, res := c.Partiel(10); res != PartielRedo || c.Cours != 0 || c.Semestre != 1 {
		t.Fatalf("retake failed: %v %+v", res, c)
	}
	for s := 1; s <= 6; s++ {
		c.Cours = SemesterCours
		note, res := c.Partiel(80)
		if note < PassNote {
			t.Fatalf("semester %d: %v", s, note)
		}
		want := PartielValidated
		if s == 6 {
			want = PartielDone
		}
		if res != want {
			t.Fatalf("semester %d: %v", s, res)
		}
	}
	if len(c.Notes) != 6 || c.Average() < 12 || Mention(c.Average()) == "" {
		t.Errorf("notes %v avg %v", c.Notes, c.Average())
	}
}

// The selective filières and school: médecine and pharmacie ask for a bac C or D with Assez bien, the
// INP-HB a bac C or D with Bien; a bac from before the séries meets any série, its mark decides.
func TestSelective(t *testing.T) {
	ufhb, _ := FindSchool("cocody-universite")
	inphb, _ := FindSchool("yakro-inphb")
	med := Offer{DegreeMedecine, "medecine"}
	pharma := Offer{DegreePharmacie, "pharmacie"}
	ing := Offer{DegreeIngenieur, "genie"}
	e := &Etudes{}
	for _, c := range []struct {
		bac  string
		note float64
		sc   School
		o    Offer
		want error
	}{
		{SerieD, 11.9, ufhb, med, ErrEtudesSante},
		{SerieD, 12, ufhb, med, nil},
		{SerieC, 12.5, ufhb, pharma, nil},
		{SerieA, 18, ufhb, med, ErrEtudesSante},
		{"*", 10, ufhb, med, ErrEtudesSante},
		{"*", 12, ufhb, med, nil},
		{SerieD, 11, ufhb, Offer{DegreeLicence, "droit"}, nil},
		{SerieC, 13.9, inphb, ing, ErrEtudesINPHB},
		{SerieC, 14, inphb, ing, nil},
		{SerieD, 15, inphb, ing, nil},
		{SerieA, 17, inphb, Offer{DegreeBTS, "gestion"}, ErrEtudesINPHB},
	} {
		if err := CanEnrol(e, c.bac, c.note, c.sc, c.o); !errors.Is(err, c.want) {
			t.Errorf("%s %.1f %s %s: %v, want %v", c.bac, c.note, c.sc.Place, c.o.Filiere, err, c.want)
		}
	}
}

// The mark: each subject's on 20, weighed by the série's coefficients; the copy checked against the plan.
func TestCopieCoefficients(t *testing.T) {
	plan := PlanOf(BacCID, "")
	n := 0
	for _, sub := range plan {
		n += sub.Draw
	}
	if n != 15 {
		t.Fatalf("bac C draws %d", n)
	}
	// Maths and physique-chimie perfect, nothing else: (5+5)×20 / 19 coefficients.
	c, err := ParseCopie("maths:3/3,physique:3/3,francais:0/3,svt:0/2,philo:0/2,anglais:0/2", plan)
	if err != nil {
		t.Fatal(err)
	}
	if got := CopieNote(plan, c); got != 10.5 {
		t.Errorf("C, maths and physique: %v", got)
	}
	// The same right answers in série A count far less (maths ×2 there).
	a, _ := ParseCopie("philo:0/3,francais:0/3,histoire-geo:0/3,anglais:0/3,maths:3/3", PlanOf(BacAID, ""))
	if got := CopieNote(PlanOf(BacAID, ""), a); got != 2.4 {
		t.Errorf("A, maths only: %v", got)
	}
	// D: SVT weighs most.
	d := PlanOf(BacDID, "")
	svt, _ := ParseCopie("svt:3/3,physique:0/3,maths:0/3,francais:0/2,philo:0/2,anglais:0/2", d)
	ang, _ := ParseCopie("svt:0/3,physique:0/3,maths:0/3,francais:0/2,philo:0/2,anglais:2/2", d)
	if CopieNote(d, svt) <= CopieNote(d, ang)*2 {
		t.Errorf("D: SVT %v, anglais %v", CopieNote(d, svt), CopieNote(d, ang))
	}
	// Refused: more right than asked, fewer asked than drawn, a subject missing or unknown, twice.
	for _, bad := range []string{
		"", "maths:4/3,physique:3/3,francais:0/3,svt:0/2,philo:0/2,anglais:0/2",
		"maths:3/15,physique:3/3,francais:0/3,svt:0/2,philo:0/2,anglais:0/2",
		"maths:1/1,physique:3/3,francais:0/3,svt:0/2,philo:0/2,anglais:0/2",
		"maths:3/3,physique:3/3,francais:0/3,svt:0/2,philo:0/2",
		"maths:3/3,physique:3/3,francais:0/3,svt:0/2,philo:0/2,anglais:0/2,info:1/1",
		"maths:3/3,maths:3/3,francais:0/3,svt:0/2,philo:0/2,anglais:0/2",
		"maths:-1/3,physique:3/3,francais:0/3,svt:0/2,philo:0/2,anglais:0/2",
		"100",
	} {
		if _, err := ParseCopie(bad, plan); !errors.Is(err, ErrCopie) {
			t.Errorf("accepted %q", bad)
		}
	}
	// The oral: five questions, one of each of the five heaviest subjects; the partiel, ten of its filière.
	oral := PlanOf(BacCID, OralVariant)
	if len(oral) != OralQuestions || oral[0].ID != "maths" || oral[0].Draw != 1 {
		t.Errorf("oral plan %+v", oral)
	}
	if p := PlanOf(PartielID, "droit"); len(p) != 1 || p[0].Draw != PartielQuestions {
		t.Errorf("partiel plan %+v", p)
	}
	if PlanOf(CoursLyceeID, "") != nil || IsExam(CoursLyceeID) || !IsExam(BEPCID) || !IsExam(PartielID) {
		t.Error("what's an exam")
	}
}

// The year's bonus: at most a point, only with the classes followed. The second tour: the oral counts a third.
func TestBonusAndOral(t *testing.T) {
	if YearBonus(40, BonusCours-1) != 0 || YearBonus(40, BonusCours) != BonusMax || YearBonus(10, 20) != 0.5 || YearBonus(0, 20) != 0 {
		t.Error("bonus")
	}
	if ExamNote(ExamDefault, 0) != 11 || ExamNote(100, 1) != 20 {
		t.Error("default note")
	}
	// 8: four right of five (16) makes it, three (12) not; 9: three are enough.
	if !OralPass(8, 4) || OralPass(8, 3) || !OralPass(9, 3) || OralPass(9, 2) || !OralPass(9.9, 3) {
		t.Error("second tour")
	}
	if Mention(9.9) != "" || Mention(10) != "Passable" || Mention(16) != "Très bien" || Mention(12) != "Assez bien" || Mention(14) != "Bien" {
		t.Error("mentions")
	}
	if BacSerie(BacCID) != SerieC || BacSerie(BEPCID) != "" {
		t.Error("séries")
	}
	if !slices.Contains(Schoolwork, CoursLyceeID) {
		t.Error("the lycée's classes count as schoolwork")
	}
	for id, plan := range ExamPlans {
		n := 0
		for _, sub := range plan {
			n += sub.Draw
		}
		if n != 15 {
			t.Errorf("%s draws %d", id, n)
		}
	}
}

// Careers: the rung that asks for a diploma, only when crossing it (those above keep theirs); the start a diploma gives.
func TestDiplomaGates(t *testing.T) {
	if _, held := GateHeld("droit", 0, nil); !held {
		t.Error("stagiaire to avocat without a Master")
	}
	if _, held := GateHeld("droit", 1, nil); held {
		t.Error("an avocat already (grandfathered) is held")
	}
	if _, held := GateHeld("bureau", 0, nil); held {
		t.Error("the office asks for nothing")
	}
	master := []Diplome{{Degree: DegreeMaster, Filiere: "droit"}}
	if _, held := GateHeld("droit", 0, master); held {
		t.Error("held with the Master")
	}
	if _, held := GateHeld("enseignement", 0, []Diplome{{Degree: DegreeBTS, Filiere: "gestion"}}); !held {
		t.Error("a BTS isn't a Licence")
	}
	if _, held := GateHeld("enseignement", 0, master); held {
		t.Error("a Master is more than a Licence")
	}
	if StartLevel("droit", master) != 1 || StartLevel("sante", []Diplome{{Degree: DegreeMedecine, Filiere: "medecine"}}) != 3 || StartLevel("bureau", nil) != 0 || StartLevel("bureau", master) != 2 {
		t.Error("start levels")
	}
	for id, g := range DiplomaGates {
		c, ok := FindCareer(id)
		if !ok || g.Level >= len(c.Levels) {
			t.Errorf("gate %s", id)
		}
	}
	if DiplomaLabel(DegreeLicence, "info") != "Licence d'informatique" || DiplomaLabel(DegreeMaster, "droit") != "Master de droit" {
		t.Errorf("labels: %q %q", DiplomaLabel(DegreeLicence, "info"), DiplomaLabel(DegreeMaster, "droit"))
	}
}

// Every school offers what exists, every offer's filière and diploma are known.
func TestSchoolsOffers(t *testing.T) {
	for _, sc := range Schools {
		for _, o := range sc.Offers {
			if _, ok := FindDegree(o.Degree); !ok {
				t.Errorf("%s: degree %s", sc.Place, o.Degree)
			}
			if _, ok := FindFiliere(o.Filiere); !ok {
				t.Errorf("%s: filière %s", sc.Place, o.Filiere)
			}
		}
	}
}
