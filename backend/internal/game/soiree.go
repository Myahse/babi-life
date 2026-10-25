package game

// A soirée thrown by a player at home (sims/party.go): the others in the
// commune see its lights over the house and come to it. Its place is
// virtual, « soiree:<id> », drawn as a club (web world3d Interior, the
// host's name on the LED wall). Throwing it costs the host; what's done
// there pays nothing (a sink, money.go).

const (
	SoireeKind   = "soiree"
	SoireePrefix = "soiree:"
	// SoireeCost: the sound system, the DJ's set and the drinks, paid by the host.
	SoireeCost = 5000
	// SoireeHours: how long it lasts (real time).
	SoireeHours = 3
	// SoireeHostID: what the host does there, receiving the guests.
	SoireeHostID = "recevoir-soiree"
	// SoireeMixID: behind the decks.
	SoireeMixID = "mixer-soiree"
)

func init() {
	Kinds[SoireeKind] = PlaceKind{
		ID: SoireeKind, Label: "Soirée", Icon: "party-popper",
		Interactions: []Interaction{
			{ID: SoireeHostID, Ages: Adults, Label: "Recevoir tes invités", Icon: "party-popper", Minutes: 60, Effect: Needs{Social: 30, Fun: 25, Energy: -10}},
			{ID: "danser-soiree", Ages: TeensUp, Label: "Danser le coupé-décalé", Icon: "music", Minutes: 45, Effect: Needs{Fun: 35, Social: 20, Energy: -15}},
			{ID: SoireeMixID, Ages: TeensUp, Label: "Passer derrière les platines", Icon: "disc-3", Minutes: 40, Effect: Needs{Fun: 30, Social: 15, Energy: -8}},
			{ID: "boire-soiree", Ages: Adults, Label: "Prendre un verre au bar", Icon: "martini", Minutes: 20, Cost: 1000, Effect: Needs{Fun: 10, Social: 15}},
			{ID: "travaillement-soiree", Ages: Adults, Label: "Travailler le DJ (lancer les billets)", Icon: "banknote", Minutes: 15, Cost: 5000, Effect: Needs{Fun: 30, Social: 25}},
		},
		Events: []RandomEvent{
			{Text: "Le DJ a crié ton nom au micro : tout le monde t'a applaudi·e !", Effect: Needs{Fun: 10, Social: 10}},
			{Text: "Les voisins ont tapé au mur à cause du bruit… la soirée continue.", Effect: Needs{Fun: -5}},
			{Text: "Ton morceau préféré est passé, tu as mis le feu sur la piste.", Effect: Needs{Fun: 15}},
		},
	}
}
