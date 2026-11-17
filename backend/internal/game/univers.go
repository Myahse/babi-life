package game

import "hash/fnv"

// A quartier's own world (the update « mon-quartier », web world3d/quartier/univers/): not a piece cut out of the
// real map but a whole neighbourhood of its own, like a Sims world, generated on the phone from a seed and a
// preset (the style of the commune it belongs to: villas and the lagoon's bay at Cocody, maquis streets at
// Yopougon, towers at the Plateau, the beach at Port-Bouët…). The server keeps the seed, the preset and the
// layout the player picked among UniversVariants of that style; every phone draws the same world from them.

// UniversVariants: the layouts of a style a player may pick from at the first visit.
const UniversVariants = 3

// universPresets: each commune's style (web world3d/quartier/univers/presets.ts has their looks).
var universPresets = map[string]string{
	"cocody":         "cocody",
	"yopougon":       "yopougon",
	"plateau":        "plateau",
	"treichville":    "marche",
	"adjame":         "marche",
	"attecoube":      "marche",
	"marcory":        "marcory",
	"koumassi":       "koumassi",
	"abobo":          "abobo",
	"port-bouet":     "plage",
	"bassam-france":  "plage",
	"sp-centre":      "plage",
	"bingerville":    "bingerville",
	"man-centre":     "bingerville",
	"anyama":         "rural",
	"songon":         "rural",
	"korhogo-centre": "rural",
}

// UniversPreset: the style of a commune's quartiers (a town of the interior without its own: « ville »).
func UniversPreset(commune string) string {
	if p, ok := universPresets[commune]; ok {
		return p
	}
	return "ville"
}

// UniversSeed: a Sim's world's seed, the same on every phone (FNV-1a of its id, 31 bits: a plain number in JSON
// and in the phone's arithmetic).
func UniversSeed(simID string) int64 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(simID))
	return int64(h.Sum32() & 0x7fffffff)
}
