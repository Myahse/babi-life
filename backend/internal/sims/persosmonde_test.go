package sims

import "testing"

func TestPersosMondeLook(t *testing.T) {
	if (Look{}).usesPersosMonde() {
		t.Fatal("an old look uses nothing of « persos-monde »")
	}
	if !(Look{Hair: "hijab"}).usesPersosMonde() || !(Look{EyeShape: "bride"}).usesPersosMonde() {
		t.Fatal("the hijab and the eyes' shape come with « persos-monde »")
	}
	if err := (Look{EyeShape: "amande", Nose: "large", Lips: "pleines", Brows: "epais", Freckles: "legeres", WrapColor: "#1c3f94"}).validate("femme"); err != nil {
		t.Fatal(err)
	}
	if (Look{Nose: "crochu"}).validate("homme") == nil || (Look{WrapColor: "bleu"}).validate("homme") == nil {
		t.Fatal("an unknown feature or colour is refused")
	}
}
