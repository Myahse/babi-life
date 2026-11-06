package world

import (
	"slices"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Every commune has its school and its crèche (invented for the game, near
// its centre), where the children go to school and the babies to the crèche
// (game.Kinds "school" and "creche"). A commune that already has a school
// (a real lycée, a groupe scolaire) keeps it and gets only the crèche.
// (Run before osm.go's init, which goes over every place: the files' order.)
// The communes out in the bush, whose middle is a reserve's gate or a bay (the trip from the town ends
// there): their school and crèche stand by their mairie, in the village, not inside the reserve.
func init() {
	gate := map[string]bool{game.BroboCommune: true, game.BerebyCommune: true}
	creches := []string{"Crèche « Les Petits Lutins »", "Crèche « Bébé Soleil »", "Crèche « Les Bambins »", "Crèche « Petit Nid »"}
	for i := range Cities {
		for j := range Cities[i].Communes {
			c := &Cities[i].Communes[j]
			lat, lng := c.Lat, c.Lng
			if gate[c.ID] {
				if k := slices.IndexFunc(c.Places, func(p Place) bool { return p.ID == c.Admin.Mairie }); k >= 0 {
					lat, lng = c.Places[k].Lat, c.Places[k].Lng
				}
			}
			n := 0
			for _, r := range c.ID {
				n += int(r)
			}
			if !slices.ContainsFunc(c.Places, func(p Place) bool { return p.Kind == "school" }) {
				c.Places = append(c.Places, fictional(c.ID+"-ecole", "Groupe scolaire de "+c.Name, "school", "", lat-0.0024, lng+0.0012))
			}
			c.Places = append(c.Places, fictional(c.ID+"-creche", creches[n%len(creches)], "creche", "", lat+0.0026, lng+0.0008))
		}
	}
}
