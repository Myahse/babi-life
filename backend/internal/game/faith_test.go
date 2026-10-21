package game

import "testing"

func TestFaithOf(t *testing.T) {
	for _, c := range []struct{ name, typ, want string }{
		{"Mosquée Mohammed VI", "muslim", FaithMuslim},
		{"Mosquée de la Riviéra 3", "", FaithMuslim},
		{"Mosquée Aldina Furdaus", "place_of_worship", FaithMuslim},
		{"Magic System", "muslim", FaithMuslim},
		{"Paroisse Sainte-Thérèse de Marcory", "christian", FaithCatholic},
		{"Cathédrale Saint-Paul", "", FaithCatholic},
		{"Église Notre-Dame du Sacré Coeur", "christian", FaithCatholic},
		{"Église Catholique Saint Kizito", "christian", FaithCatholic},
		{"st Charles Lwanga", "christian", FaithCatholic},
		{"Basilique Notre-Dame de la Paix", "", FaithCatholic},
		{"Église Méthodiste Unie – Paroisse Cité de Grâce d’Anoumabo", "christian", FaithProtestant},
		{"Eglise Baptiste Missionnaire temple Bethel", "christian", FaithProtestant},
		{"Église Harriste", "christian", FaithProtestant},
		{"Eglise protestante CMA riviera triangle", "christian", FaithProtestant},
		{"Église Evangelique des Assemblées de Dieu Temple Peniel", "christian", FaithEvangelic},
		{"Eglise de Pentecôte de CI Assemblée de la Riviera 2", "place_of_worship", FaithEvangelic},
		{"Christianisme céleste", "christian", FaithEvangelic},
		{"Bethanie Israel", "christian", FaithEvangelic},
		{"Lieu de Culte", "christian", FaithEvangelic},
		{"Salle du royaume des témoins de Jéhovah", "christian", FaithOther},
	} {
		if got := FaithOf(c.name, c.typ); got != c.want {
			t.Errorf("FaithOf(%q, %q) = %q, want %q", c.name, c.typ, got, c.want)
		}
	}
}
