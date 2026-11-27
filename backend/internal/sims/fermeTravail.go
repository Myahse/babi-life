package sims

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Le travail aux champs, fait par le Sim (the update « agriculture », ferme.go): at the plot, an act of the
// hands is no longer done at once from the phone. It is a timed action the Sim acts out in 3D at the plot, with
// its tool (web world3d/ferme/, avatar/ferme.ts): POST /sims/{id}/ferme/{act} with « work » checks it could be
// done now (the act tried on a copy of the Sim), then starts it; when it ends (finish, clock.go), the act is done
// for real (its costs taken then, once, as before: fermeAct). Stopped before the end, nothing is done nor paid.
// A plot away (its paid farmhand) is still worked by the farmhand each day, as before; the phone can't work it.

// FermeTask: one act of the hands, how long it takes (the catalogue's minutes, game.Length makes them real ones).
type fermeTask struct {
	Minutes     int64
	Label, Icon string
}

var fermeTasks = map[string]fermeTask{
	"defricher":   {90, "Défricher à la machette", "axe"},
	"labourer":    {60, "Labourer à la daba", "shovel"},
	"semer":       {40, "Semer le long des rangs", "sprout"},
	"arroser":     {20, "Arroser à l'arrosoir", "droplets"},
	"desherber":   {40, "Désherber entre les rangs", "shovel"},
	"traiter":     {20, "Traiter au neem", "spray-can"},
	"recolter":    {60, "Récolter", "wheat"},
	"transformer": {20, "Étaler la récolte au soleil", "sun"},
	"nourrir":     {15, "Nourrir les bêtes", "wheat"},
	"abreuver":    {10, "Abreuver les bêtes", "droplets"},
	"oeufs":       {15, "Ramasser les œufs", "egg"},
	"traire":      {20, "Traire", "milk"},
	"paturage":    {120, "Mener le troupeau au pâturage", "footprints"},
}

// fermeHired: the same act done with help, shorter (the young of the village, the motoculteur).
var fermeHired = map[string]fermeTask{
	"defricher": {40, "Défricher avec les jeunes du village", "users"},
	"labourer":  {20, "Labourer au motoculteur Kabako", "tractor"},
}

// fermeHarvest: what « récolter » is, crop by crop (the label of the action).
var fermeHarvest = map[string]string{
	"cacao":     "Cueillir les cabosses",
	"cafe":      "Cueillir les cerises de café",
	"banane":    "Couper les régimes de banane",
	"palmier":   "Couper les régimes de graines",
	"mais":      "Casser les épis de maïs",
	"mil":       "Couper les épis de mil",
	"sorgho":    "Couper les épis de sorgho",
	"riz":       "Couper le riz à la faucille",
	"igname":    "Déterrer les ignames",
	"manioc":    "Arracher le manioc",
	"coton":     "Cueillir le coton",
	"hevea":     "Saigner les hévéas",
	"anacarde":  "Ramasser les noix de cajou",
	"karite":    "Ramasser les noix de karité",
	"tomate":    "Cueillir les tomates",
	"piment":    "Cueillir les piments",
	"aubergine": "Cueillir les aubergines",
	"gombo":     "Cueillir le gombo",
}

// fermeDrying: what is spread out to dry (« transformer » with days of sun, at the plot).
var fermeDrying = map[string]string{
	"feves-sechees": "Étaler les fèves de cacao sur la claie",
	"cafe-seche":    "Étaler les cerises de café sur la bâche",
}

// IsFermeWork: an activity that is the farm's work at the plot.
func isFermeWork(a *game.Activity) bool { return a != nil && a.Kind == "do" && a.Ferme != nil }

// fermeTry: whether the act could be done now (tried on a copy of the Sim: its money, needs and farm untouched).
func (s *Sim) fermeTry(act string, q fermeReq, open func(game.FermeOffre) bool) error {
	t := *s
	b, err := json.Marshal(s.Life)
	if err != nil {
		return err
	}
	t.Life = Life{}
	if err := json.Unmarshal(b, &t.Life); err != nil {
		return err
	}
	t.pending = nil
	_, _, err = t.fermeAct(act, q, open)
	return err
}

// fermeWorkStart: the act started as the Sim's timed action at the plot (or the yard), if it's one of the hands.
// ok false: not one (done at once as before).
func (s *Sim) fermeWorkStart(act string, q fermeReq, open func(game.FermeOffre) bool) (string, bool, error) {
	task, ok := fermeTasks[act]
	if !ok {
		return "", false, nil
	}
	if s.Activity != nil {
		return "", true, game.ErrBusy
	}
	f := s.ferme()
	p, o, err := f.plot(q.Plot)
	if err != nil {
		return "", true, err
	}
	if act == "transformer" {
		// Only the drying is done at the plot (the rest, the attiéké, the oil, at once as before).
		if _, dry := fermeDrying[q.Product]; !dry {
			return "", false, nil
		}
		// (On the claie of the plot the Sim is at.)
		if err := s.fermeThere(o); err != nil {
			return "", true, err
		}
	}
	if err := s.fermeTry(act, q, open); err != nil {
		return "", true, err
	}
	if h, ok := fermeHired[act]; ok && q.Hire {
		task = h
	}
	w := &game.FermeWork{Act: act, Plot: p.ID, Offre: o.ID, Crop: q.Crop, Kind: q.Kind, Product: q.Product, Score: q.Score, Hire: q.Hire, Qty: q.Qty}
	switch act {
	case "recolter":
		w.Crop = p.Champ.Crop
		if l, ok := fermeHarvest[w.Crop]; ok {
			task.Label = l
		}
	case "transformer":
		task.Label = fermeDrying[q.Product]
	case "nourrir", "abreuver", "oeufs", "traire", "paturage":
		if b, ok := game.FindBete(q.Kind); ok {
			switch act {
			case "nourrir":
				task.Label = fmt.Sprintf("Nourrir les bêtes : %s", b.FeedLabel)
			case "abreuver":
				task.Label = fmt.Sprintf("Abreuver les %s", game.LowerFirst(b.Label))
			case "traire":
				task.Label = fmt.Sprintf("Traire les %s", game.LowerFirst(b.Label))
			}
		}
	}
	place, kind, name := o.Place, game.FermeKind, o.Label
	if o.Home {
		// The yard: behind the house, acted out where the Sim stands at home.
		place, kind = "", ""
	}
	it := game.Interaction{ID: "ferme-" + act, Label: task.Label, Icon: task.Icon, Minutes: task.Minutes}
	if err := s.start(it, place, kind, name, nil, ""); err != nil {
		return "", true, err
	}
	s.Activity.Ferme = w
	return task.Label, true, nil
}

// fermeWorkDone: the act done as the timed action ends (finish): the line and the money said in its stead.
func (s *Sim) fermeWorkDone(a *game.Activity) (string, int) {
	w := a.Ferme
	s.fermeSettle()
	hidden := features.Default.HiddenPlaces(context.Background())
	q := fermeReq{Plot: w.Plot, Crop: w.Crop, Kind: w.Kind, Product: w.Product, Score: w.Score, Hire: w.Hire, Qty: w.Qty}
	text, money, err := s.fermeAct(w.Act, q, func(o game.FermeOffre) bool {
		return o.Home || (!hidden[o.Place] && !hidden[world.FermeCommune(o.Place)])
	})
	if err != nil {
		return fmt.Sprintf("%s — %s : %s.", a.PlaceName, a.Interaction.Label, err.Error()), 0
	}
	return text, money
}

// fermeMilk: the goats (or the cows) milked, once a day: a bowl of fresh milk drunk there (never sold: no money).
func (s *Sim) fermeMilk(e *Enclos, b game.Bete) (string, int, error) {
	if b.ID != "chevres" && b.ID != "boeufs" {
		return "", 0, errFermeNoMilk
	}
	if e.Milked == s.today() {
		return "", 0, errFermeDone
	}
	e.Milked = s.today()
	s.Needs = s.Needs.Add(game.Needs{Hunger: 15, Fun: 6, Energy: -3})
	s.fermeSkill(4)
	return fmt.Sprintf("%s traites au petit matin, sur le petit tabouret : un bol de lait frais, bu sur place.", b.Label), 0, nil
}

// testerFermeAller: the testers' way to a village plot (« ferme-aller », its offer): the plot given if it isn't
// held (bought, still bush), the Sim set down at it (its town, its commune, a moment's look round the plot).
func (s *Sim) testerFermeAller(action, offre string) ([]Event, bool, error) {
	if action != "ferme-aller" {
		return nil, false, nil
	}
	o, ok := game.FindOffre(offre)
	if !ok || o.Home {
		return nil, true, errFermeOffre
	}
	c, ok := world.FindCity(o.City)
	commune := world.FermeCommune(o.Place)
	if !ok || commune == "" {
		return nil, true, errFermeOffre
	}
	f := s.ferme()
	if !slices.ContainsFunc(f.Plots, func(p *Parcelle) bool { return p.Offre == o.ID }) {
		f.Next++
		f.Plots = append(f.Plots, &Parcelle{ID: "p" + strconv.Itoa(f.Next), Offre: o.ID, Owned: true, Champ: champ0()})
	}
	s.Activity = nil
	s.City, s.Commune = c.ID, commune
	it := game.Interaction{ID: "ferme-arrivee", Label: "Arriver à la parcelle", Icon: "map-pin", Minutes: 1}
	if err := s.start(it, o.Place, game.FermeKind, o.Label, nil, ""); err != nil {
		return nil, true, err
	}
	return []Event{{Kind: "life", Text: fmt.Sprintf("Testeur : te voilà à %s.", fermePlotName(o)), GameTime: s.GameMinutes}}, true, nil
}
