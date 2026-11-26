package sims

import (
	"context"
	"errors"

	"github.com/myahse/babi-life/backend/internal/features"
)

// « Persos du monde » (the update « persos-monde »; web avatar/options.ts WORLD_HAIRS, EYE_SHAPES…,
// world3d/peoples.ts): the planet's hairdos, the hijab and the Sikh turban, and the face's features.

// PersosMondeKey is the update's key.
const PersosMondeKey = "persos-monde"

// worldHairIDs are the hairdos it brings (web avatar/options.ts WORLD_HAIRS): refused while it is closed.
var worldHairIDs = map[string]bool{
	"lisse-long": true, "raie-cote": true, "ondule": true, "boucle": true, "boucles-afro": true, "carre-frange": true,
	"chignon-top": true, "man-bun": true, "buzz": true, "tresse-lisse": true, "hijab": true, "turban": true,
}

// The face's features and their values ("" : the face as it always was).
var faceValues = map[string]map[string]bool{
	"eyeShape": {"": true, "amande": true, "bride": true, "tombant": true},
	"nose":     {"": true, "fin": true, "large": true, "aquilin": true},
	"lips":     {"": true, "fines": true, "pleines": true},
	"brows":    {"": true, "fins": true, "epais": true},
	"freckles": {"": true, "legeres": true, "beaucoup": true},
}

func (l Look) face() map[string]string {
	return map[string]string{"eyeShape": l.EyeShape, "nose": l.Nose, "lips": l.Lips, "brows": l.Brows, "freckles": l.Freckles}
}

// validFace: each feature one of its values, the wrap's colour a colour.
func (l Look) validFace() error {
	for k, v := range l.face() {
		if !faceValues[k][v] {
			return errors.New("visage invalide")
		}
	}
	if l.WrapColor != "" && !hexColor.MatchString(l.WrapColor) {
		return errors.New("couleur invalide")
	}
	return nil
}

// usesPersosMonde: something in the look comes with « persos-monde » (a hairdo, a feature of the face).
func (l Look) usesPersosMonde() bool {
	if worldHairIDs[l.Hair] {
		return true
	}
	for _, v := range l.face() {
		if v != "" {
			return true
		}
	}
	return false
}

// persosMondeShut: the look uses « persos-monde » and the update is closed.
func (l Look) persosMondeShut(ctx context.Context) bool {
	return l.usesPersosMonde() && features.Default.BlocksKey(ctx, PersosMondeKey) != ""
}
