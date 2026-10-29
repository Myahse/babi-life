package world

import "slices"

// Every commune has its school and its crèche (invented for the game, near
// its centre), where the children go to school and the babies to the crèche
// (game.Kinds "school" and "creche"). A commune that already has a school
// (a real lycée, a groupe scolaire) keeps it and gets only the crèche.
// (Run before osm.go's init, which goes over every place: the files' order.)
func init() {
	creches := []string{"Crèche « Les Petits Lutins »", "Crèche « Bébé Soleil »", "Crèche « Les Bambins »", "Crèche « Petit Nid »"}
	for i := range Cities {
		for j := range Cities[i].Communes {
			c := &Cities[i].Communes[j]
			n := 0
			for _, r := range c.ID {
				n += int(r)
			}
			if !slices.ContainsFunc(c.Places, func(p Place) bool { return p.Kind == "school" }) {
				c.Places = append(c.Places, fictional(c.ID+"-ecole", "Groupe scolaire de "+c.Name, "school", "", c.Lat-0.0024, c.Lng+0.0012))
			}
			c.Places = append(c.Places, fictional(c.ID+"-creche", creches[n%len(creches)], "creche", "", c.Lat+0.0026, c.Lng+0.0008))
		}
	}
}
