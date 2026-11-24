package game

// Les funérailles (the update « cycle-vie », sims/funerailles.go; web components/Funerailles.tsx): when an
// elder of the family passes away (famille.go mourn), the family has the funeral to give them, as in Côte
// d'Ivoire: the simple one among the family, the « digne » one with the bâche, the chairs and the choir
// for the veillée, or the great funeral, the orchestra, the tee-shirts with their face, the whole quartier
// fed. It costs (the family's and the friends' cotisations take part of it), and the renom of the family
// grows with it. Not given within FuneralDays, the family does a simple one without the Sim (a little shame).

// Funeral: one way of giving it.
type Funeral struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	About string `json:"about"`
	// Cost: what it costs in all; Cotisations: the share the family and the friends bring.
	Cost        int     `json:"cost"`
	Cotisations float64 `json:"cotisations"`
	Renom       int     `json:"renom"`
	Needs       Needs   `json:"-"`
}

// Funerals: from the simplest.
var Funerals = []Funeral{
	{ID: "simple", Label: "Funérailles simples", About: "La famille proche, une veillée de prière à la maison, l'enterrement au village.", Cost: 20000, Cotisations: 0.25, Renom: 2, Needs: Needs{Social: 20}},
	{ID: "digne", Label: "Funérailles dignes", About: "La bâche dans la cour, les chaises, la chorale toute la nuit, le repas pour la famille et les voisins.", Cost: 80000, Cotisations: 0.35, Renom: 12, Needs: Needs{Social: 40, Fun: 10}},
	{ID: "grande", Label: "Grandes funérailles", About: "L'orchestre, les tee-shirts à son effigie, tout le quartier nourri, la famille venue de loin : on parlera longtemps de son départ.", Cost: 250000, Cotisations: 0.4, Renom: 40, Needs: Needs{Social: 60, Fun: 20}},
}

// FindFuneral: a way of giving it by its id.
func FindFuneral(id string) (Funeral, bool) {
	for _, f := range Funerals {
		if f.ID == id {
			return f, true
		}
	}
	return Funeral{}, false
}

// FuneralDays: real days to give it before the family does without the Sim.
const FuneralDays = 7

// FuneralPays: what the Sim pays of it (the rest, the cotisations).
func FuneralPays(f Funeral) int { return f.Cost - int(float64(f.Cost)*f.Cotisations) }
