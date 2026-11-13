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
	if err := CanEnrol(e, "", ufhb, lic("droit")); !errors.Is(err, ErrEtudesNoBac) {
		t.Errorf("no bac: %v", err)
	}
	if err := CanEnrol(e, SerieA, ufhb, Offer{DegreeMedecine, "medecine"}); !errors.Is(err, ErrEtudesSerie) {
		t.Errorf("A in medicine: %v", err)
	}
	if err := CanEnrol(e, SerieD, ufhb, Offer{DegreeMedecine, "medecine"}); err != nil {
		t.Errorf("D in medicine: %v", err)
	}
	if err := CanEnrol(e, "*", ufhb, lic("info")); err != nil {
		t.Errorf("a bac from before the séries opens everything: %v", err)
	}
	if err := CanEnrol(e, SerieC, ufhb, Offer{DegreeBTS, "gestion"}); !errors.Is(err, ErrEtudesNotOffered) {
		t.Errorf("BTS at the UFHB: %v", err)
	}
	if err := CanEnrol(e, SerieA, ufhb, Offer{DegreeMaster, "droit"}); err == nil {
		t.Error("a Master without the Licence")
	}
	e.Diplomes = []Diplome{{Degree: DegreeLicence, Filiere: "droit"}}
	if err := CanEnrol(e, SerieA, ufhb, Offer{DegreeMaster, "droit"}); err != nil {
		t.Errorf("Master after the Licence: %v", err)
	}
	if err := CanEnrol(e, SerieA, ufhb, lic("droit")); !errors.Is(err, ErrEtudesHas) {
		t.Errorf("the Licence again: %v", err)
	}
	e.Cursus = &Cursus{}
	if err := CanEnrol(e, SerieA, ufhb, lic("lettres")); !errors.Is(err, ErrEtudesEnrolled) {
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

// The exam's mark, the school's bonus, the mention.
func TestExamNote(t *testing.T) {
	if ExamNote(50, 0) != 10 || ExamNote(95, 10) != 20 || ExamNote(40, ExamBonus(20)) != 10 {
		t.Error("notes")
	}
	if Mention(9.9) != "" || Mention(16) != "Très bien" || Mention(12) != "Assez bien" {
		t.Error("mentions")
	}
	if BacSerie(BacCID) != SerieC || BacSerie(BEPCID) != "" {
		t.Error("séries")
	}
	if !slices.Contains(Schoolwork, CoursLyceeID) {
		t.Error("the lycée's classes count as schoolwork")
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
