package world

import "github.com/myahse/babi-life/backend/internal/game"

// La vie là-haut (workstream D; game/espaceActs.go, sims/espaceVie.go; web world3d/espace): the places the
// socle's three space cities (espace.go) gain, each of its own kind so that its sheet lists its own actions:
// the station's cupola and laboratory, the Moon's greenhouse, its Margouillat rover and its regolith mine, Mars's
// laboratory, greenhouse and rover. Added in an init, so espace.go stays as the socle left it; they sit in the
// communes already there (their updates hide them with the commune, features.go).

// spaceKinds: the socle's places given a kind of their own (by place id).
var spaceKinds = map[string]string{
	"akwaba-coupole-hublots": game.EspaceCoupoleKind,
	"akwaba-labo-module":     game.EspaceLaboKind,
}

// spaceMore: the places added, by commune.
var spaceMore = map[string][]Place{
	"lune-base": {
		spacePlace("lune-base-serre", "Serre de Clair-de-Terre", game.EspaceSerreKind),
		spacePlace("lune-base-margouillat", "Garage du rover Margouillat", game.EspaceRoverKind),
		spacePlace("lune-base-mine", "Mine de régolithe de Shackleton", game.EspaceMineKind),
	},
	"mars-colonie": {
		spacePlace("mars-colonie-labo", "Laboratoire d'Harmattan", game.EspaceLaboKind),
		spacePlace("mars-colonie-serre", "Serre du dôme", game.EspaceSerreKind),
		spacePlace("mars-colonie-rover", "Rover de la colonie", game.EspaceRoverKind),
	},
}

func init() {
	for i := range Espace {
		for j := range Espace[i].Communes {
			cm := &Espace[i].Communes[j]
			for k := range cm.Places {
				if kind, ok := spaceKinds[cm.Places[k].ID]; ok {
					cm.Places[k].Kind = kind
				}
			}
			for _, p := range spaceMore[cm.ID] {
				if !containsPlace(cm.Places, p.ID) {
					cm.Places = append(cm.Places, p)
				}
			}
		}
	}
}

func containsPlace(ps []Place, id string) bool {
	for _, p := range ps {
		if p.ID == id {
			return true
		}
	}
	return false
}
