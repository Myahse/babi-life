package sims

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"math"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// L'agriculture et l'élevage (the update « agriculture », game/ferme.go): a Sim's farm, kept in its Life (Ferme):
// its plots, each a field and up to two pens, the grenier, the lots drying. Played from the phone's « Ferme » app:
//   POST /sims/{id}/ferme/{act}   voir | louer | acheter | renouveler | rendre | defricher | labourer | semer |
//                                 arroser | desherber | traiter | recolter | arracher | manoeuvre | transformer |
//                                 vendre | betes | nourrir | abreuver | paturage | oeufs | veterinaire |
//                                 vendre-betes | pecher
// The days are brought up first (fermeSettle): each day gone, the field grows if it had water (the rain, the
// watering can, the farmhand) and less with weeds or pests; the animals well kept produce and have their young,
// forgotten they get tired (never worse). What's sold is FromFerme, capped a day: what doesn't fit stays.

// Ferme: what the Sim's farm keeps.
type Ferme struct {
	// Day: the game day it's brought up to (today: its actions are counted for it).
	Day   int64       `json:"day"`
	Plots []*Parcelle `json:"plots"`
	// Grenier: the harvest and the products kept, by id (game.SoldAs), in units.
	Grenier map[string]int `json:"grenier,omitempty"`
	// Sechage: what dries or ferments, ready on a day.
	Sechage []FermeLot `json:"sechage,omitempty"`
	// Next: the next plot's number; Earned, Born, Harvests: what the farm has done (its page's counters).
	Next     int `json:"next"`
	Earned   int `json:"earned,omitempty"`
	Born     int `json:"born,omitempty"`
	Harvests int `json:"harvests,omitempty"`
	// News: what happened while away (the last days brought up), said once on the app.
	News []string `json:"news,omitempty"`
}

// Parcelle: a plot held.
type Parcelle struct {
	ID    string `json:"id"`
	Offre string `json:"offre"`
	Owned bool   `json:"owned,omitempty"`
	// RentUntil: the day the rent runs out (rented: nothing grows past it until it's paid again).
	RentUntil int64 `json:"rentUntil,omitempty"`
	// Paid: what it cost (bought: what it sells back from).
	Paid int `json:"paid"`
	// Hand: a farmhand paid each day (ManoeuvreDay) to water, weed and feed.
	Hand  bool      `json:"hand,omitempty"`
	Champ Champ     `json:"champ"`
	Pens  []*Enclos `json:"pens,omitempty"`
}

// Champ: the plot's field.
type Champ struct {
	Stage string `json:"stage"`
	Crop  string `json:"crop,omitempty"`
	// Growth: the days of growth so far (a weedy, or pest-ridden, day counts half); Quality: how it's been kept.
	Growth  float64 `json:"growth,omitempty"`
	Quality float64 `json:"quality,omitempty"`
	// InSeason: sown in its season (else it yields less).
	InSeason bool `json:"inSeason,omitempty"`
	// Watered: the last day watered; Weeds, Pest: what's to do; WeedAt: the growth the next weeds come at.
	Watered int64 `json:"watered,omitempty"`
	Weeds   bool  `json:"weeds,omitempty"`
	WeedAt  int   `json:"weedAt,omitempty"`
	Pest    bool  `json:"pest,omitempty"`
	// Score: the sowing's game; Harvests: a tree's harvests so far; Dry: days in a row without water.
	Score    int   `json:"score,omitempty"`
	Harvests int   `json:"harvests,omitempty"`
	Sown     int64 `json:"sown,omitempty"`
	Dry      int   `json:"dry,omitempty"`
}

// Enclos: a pen (a coop, a pen, a pond) and its animals.
type Enclos struct {
	Kind   string `json:"kind"`
	Adults int    `json:"adults"`
	Young  int    `json:"young,omitempty"`
	// YoungAge: the young's days; BirthIn: the days well kept till the next births.
	YoungAge int `json:"youngAge,omitempty"`
	BirthIn  int `json:"birthIn,omitempty"`
	// Fed, Watered, Grazed: the last day each was done.
	Fed     int64 `json:"fed,omitempty"`
	Watered int64 `json:"watered,omitempty"`
	Grazed  int64 `json:"grazed,omitempty"`
	// Condition: how they are (20–100: tired, never worse); Tired: forgotten yesterday; Sick: the vet to call.
	Condition int  `json:"condition"`
	Tired     bool `json:"tired,omitempty"`
	Sick      bool `json:"sick,omitempty"`
	// Eggs: laid, to pick up; Grown: a pond's days of growth.
	Eggs  int `json:"eggs,omitempty"`
	Grown int `json:"grown,omitempty"`
	// Milked: the last day the goats (the cows) were milked (fermeTravail.go).
	Milked int64 `json:"milked,omitempty"`
}

// FermeLot: a lot drying or fermenting.
type FermeLot struct {
	Product string `json:"product"`
	Qty     int    `json:"qty"`
	Ready   int64  `json:"ready"`
}

var (
	errFermeClosed  = errors.New("bientôt dans le jeu")
	errFermeMinor   = errors.New("une parcelle, c'est à partir de 18 ans : en attendant, aide au potager de la cour")
	errFermeBaby    = errors.New("pas encore : grandis un peu")
	errFermeOffre   = errors.New("cette parcelle n'existe pas")
	errFermeShut    = errors.New("cette parcelle n'est pas encore ouverte")
	errFermeFull    = errors.New("tu as déjà trois parcelles : rends-en une d'abord")
	errFermeHave    = errors.New("tu as déjà cette parcelle")
	errFermeNone    = errors.New("cette parcelle n'est pas à toi")
	errFermeAway    = errors.New("ta parcelle est loin : vas-y pour y travailler (ou paie un manœuvre pour s'en occuper)")
	errFermeHome    = errors.New("ta cour est chez toi : rentre à la maison pour t'en occuper")
	errFermeRent    = errors.New("le loyer de la parcelle est à renouveler d'abord")
	errFermeStage   = errors.New("pas maintenant : ce n'est pas l'étape du champ")
	errFermeCrop    = errors.New("cette culture ne pousse pas ici")
	errFermeDone    = errors.New("c'est déjà fait aujourd'hui")
	errFermeRaining = errors.New("il pleut aujourd'hui : la pluie arrose pour toi")
	errFermeNoWeeds = errors.New("pas de mauvaises herbes pour l'instant")
	errFermeNoPest  = errors.New("pas de ravageurs sur ce champ")
	errFermeStock   = errors.New("rien de cela dans ton grenier")
	errFermeNoBuyer = errors.New("personne n'achète cela ici")
	errFermeNoMake  = errors.New("cela ne se transforme pas")
	errFermeCapped  = errors.New("la coopérative et le marché ont assez acheté à ta ferme aujourd'hui : le reste attend au grenier jusqu'à demain")
	errFermeBete    = errors.New("cet animal ne s'élève pas ici")
	errFermePens    = errors.New("plus de place pour un autre élevage sur cette parcelle")
	errFermeMax     = errors.New("l'enclos est plein")
	errFermeMin     = errors.New("il en faut plus pour commencer l'élevage")
	errFermePen     = errors.New("tu n'as pas ces bêtes ici")
	errFermeGraze   = errors.New("ces bêtes ne vont pas au pâturage")
	errFermeNoEggs  = errors.New("pas encore d'œufs à ramasser")
	errFermeWell    = errors.New("tes bêtes vont bien : pas besoin du vétérinaire")
	errFermeFish    = errors.New("les poissons sont encore petits : nourris-les encore quelques jours")
	errFermeNotPond = errors.New("ce n'est pas un étang")
	errFermeEmpty   = errors.New("vends d'abord tes bêtes")
	errFermeNoSell  = errors.New("rien à vendre")
	errFermeSick    = errors.New("une bête malade ne se vend pas : appelle d'abord le vétérinaire")
	errFermeAct     = errors.New("action inconnue")
	errFermeNoMilk  = errors.New("ces bêtes ne se traient pas")
)

func fermeOpen() bool { return features.Default.Open(context.Background(), game.AgricultureKey) }

// ferme: the Sim's farm (made the first time).
func (s *Sim) ferme() *Ferme {
	if s.Life.Ferme == nil {
		s.Life.Ferme = &Ferme{Day: s.today(), Grenier: map[string]int{}}
	}
	if s.Life.Ferme.Grenier == nil {
		s.Life.Ferme.Grenier = map[string]int{}
	}
	return s.Life.Ferme
}

func (f *Ferme) plot(id string) (*Parcelle, game.FermeOffre, error) {
	for _, p := range f.Plots {
		if p.ID == id {
			o, ok := game.FindOffre(p.Offre)
			if !ok {
				return nil, o, errFermeOffre
			}
			return p, o, nil
		}
	}
	return nil, game.FermeOffre{}, errFermeNone
}

func (p *Parcelle) pen(kind string) *Enclos {
	for _, e := range p.Pens {
		if e.Kind == kind {
			return e
		}
	}
	return nil
}

// active: the plot can be worked on that day (bought, or its rent paid).
func (p *Parcelle) active(day int64) bool { return p.Owned || day < p.RentUntil }

// fermeZone: the climate of the plot (the yard follows the house's town).
func (s *Sim) fermeZone(o game.FermeOffre) string {
	if o.Home {
		return world.FermeZoneOf(s.HomeCity)
	}
	return o.Zone
}

// fermeSettle: the days gone brought up (each one, FermeCatchUp at most), the farmhands paid. What happened, in
// a few lines (kept in News for the app).
func (s *Sim) fermeSettle() []string {
	f := s.ferme()
	today := s.today()
	if f.Day >= today {
		return nil
	}
	from := max(f.Day, today-game.FermeCatchUp)
	var news []string
	born, ripe, sick, tired, handGone := map[string]int{}, []string{}, 0, 0, []string{}
	paid := 0
	for d := from; d < today; d++ {
		for _, p := range f.Plots {
			o, ok := game.FindOffre(p.Offre)
			if !ok || !p.active(d) {
				continue
			}
			zone := s.fermeZone(o)
			hand := false
			if p.Hand {
				cost := game.ManoeuvreDay
				for _, e := range p.Pens {
					if b, ok := game.FindBete(e.Kind); ok && !b.Graze {
						cost += b.Feed * (e.Adults + e.Young)
					}
				}
				if s.Money >= cost {
					s.Money -= cost
					paid += cost
					hand = true
				} else {
					p.Hand = false
					handGone = append(handGone, fermePlotName(o))
				}
			}
			if was := p.Champ.Stage; p.fieldDay(zone, d, hand, s.Career) && was != game.StageMur {
				if c, ok := game.FindCulture(p.Champ.Crop); ok {
					ripe = append(ripe, fmt.Sprintf("%s (%s)", game.LowerFirst(c.Label), fermePlotName(o)))
				}
			}
			for _, e := range p.Pens {
				n, sk, tr := e.penDay(p.ID, d, hand)
				if b, ok := game.FindBete(e.Kind); ok && n > 0 {
					born[b.Young] += n
				}
				if sk {
					sick++
				}
				if tr {
					tired++
				}
			}
		}
		// The lots dried.
		kept := f.Sechage[:0]
		for _, l := range f.Sechage {
			if l.Ready <= d+1 {
				f.Grenier[l.Product] += l.Qty
				if pr, ok := game.FindProduit(l.Product); ok {
					news = append(news, fmt.Sprintf("%s : %d %s prêts au grenier.", pr.Label, l.Qty, pr.Unit))
				}
				continue
			}
			kept = append(kept, l)
		}
		f.Sechage = kept
	}
	f.Day = today
	for _, k := range slices.Sorted(maps.Keys(born)) {
		f.Born += born[k]
		news = append(news, fmt.Sprintf("Des naissances à la ferme : %d %s !", born[k], k))
	}
	if len(born) > 0 {
		s.addMood("naissance-ferme", "")
	}
	if len(ripe) > 0 {
		news = append(news, "Prêt à récolter : "+strings.Join(ripe, ", ")+".")
	}
	if sick > 0 {
		news = append(news, "Une bête est malade : appelle le vétérinaire.")
	}
	if tired > 0 {
		news = append(news, "Des bêtes oubliées sont fatiguées : nourris-les et donne-leur à boire.")
	}
	if paid > 0 {
		news = append(news, fmt.Sprintf("Ton manœuvre a été payé %s (nourriture des bêtes comprise).", game.FCFA(paid)))
	}
	for _, n := range handGone {
		news = append(news, fmt.Sprintf("Pas assez d'argent pour payer le manœuvre de %s : il est rentré chez lui.", n))
	}
	f.News = news
	return news
}

// fieldDay: one day of the field (d, in that climate; the farmhand there or not): whether it's ripe after it.
func (p *Parcelle) fieldDay(zone string, d int64, hand bool, career string) bool {
	c := &p.Champ
	if c.Stage != game.StagePousse {
		return c.Stage == game.StageMur
	}
	crop, ok := game.FindCulture(c.Crop)
	if !ok {
		return false
	}
	w := game.Meteo(zone, d)
	if w == "froid" {
		return false
	}
	if hand {
		c.Weeds = false
	}
	if c.Watered == d || w == "pluie" || hand {
		g := 1.0
		if c.Weeds {
			g /= 2
		}
		if c.Pest {
			g /= 2
		}
		c.Growth += g
		c.Dry = 0
	} else {
		c.Dry++
	}
	chance := game.PestChance
	if career == game.AgronomeCareer {
		chance /= 2
	}
	if c.Pest {
		c.Quality = math.Max(0.5, c.Quality-0.05)
	} else if c.Growth > 0 && game.FermeRoll("ravageurs", p.ID, d) < chance {
		c.Pest = true
	}
	if !c.Weeds && c.WeedAt > 0 && c.Growth >= float64(c.WeedAt) {
		c.Weeds = true
		c.WeedAt += 3
	}
	if c.Growth >= float64(crop.Days) {
		c.Stage = game.StageMur
		return true
	}
	return false
}

// penDay: one day of a pen: the young born, whether one fell sick, whether they're tired. Never a death.
func (e *Enclos) penDay(plot string, d int64, hand bool) (born int, sick, tired bool) {
	b, ok := game.FindBete(e.Kind)
	if !ok {
		return 0, false, false
	}
	fed := e.Fed == d || e.Grazed == d || hand
	watered := e.Watered == d || hand || b.Pond
	well := fed && watered
	if well {
		e.Condition = min(100, e.Condition+10)
		e.Tired = false
	} else {
		e.Condition = max(20, e.Condition-15)
		e.Tired = true
	}
	key := plot + "/" + e.Kind
	if !e.Sick {
		ch := game.SickChance
		if e.Tired {
			ch = game.SickChanceTired
		}
		if game.FermeRoll("malade", key, d) < ch {
			e.Sick, sick = true, true
		}
	}
	// The young grow up whatever happens.
	if e.Young > 0 && !b.Pond {
		e.YoungAge++
		if e.YoungAge >= b.Grow {
			e.Adults += e.Young
			e.Young, e.YoungAge = 0, 0
		}
	}
	if e.Sick || !well {
		return 0, sick, !well
	}
	if b.Pond {
		e.Grown++
		return 0, sick, false
	}
	if b.Product != "" {
		laid := int(math.Round(float64(e.Adults) * b.Per * float64(e.Condition) / 100))
		e.Eggs = min(e.Adults*4, e.Eggs+laid)
	}
	if b.Every > 0 && e.Adults >= 2 {
		e.BirthIn--
		if e.BirthIn <= 0 {
			e.BirthIn = b.Every
			lo, hi := b.Litter[0], b.Litter[1]
			n := lo
			if hi > lo {
				n += int(game.FermeRoll("portee", key, d) * float64(hi-lo+1))
			}
			n = min(n, b.Max-e.Adults-e.Young)
			if n > 0 {
				if e.Young == 0 {
					e.YoungAge = 0
				}
				e.Young += n
				born = n
			}
		}
	}
	return born, sick, false
}

func fermePlotName(o game.FermeOffre) string {
	if o.Home {
		return "ta cour"
	}
	if i := strings.Index(o.Label, " ("); i > 0 {
		return strings.TrimPrefix(strings.TrimPrefix(o.Label[:i], "Parcelle de "), "Parcelle d'")
	}
	return o.Label
}

// fermeReq: what an act may carry.
type fermeReq struct {
	Plot    string `json:"plot"`
	Offre   string `json:"offre"`
	Crop    string `json:"crop"`
	Kind    string `json:"kind"`
	Product string `json:"product"`
	To      string `json:"to"`
	Qty     int    `json:"qty"`
	Score   int    `json:"score"`
	On      bool   `json:"on"`
	Hire    bool   `json:"hire"`
	Young   bool   `json:"young"`
	// Work: done by the Sim at the plot as a timed action (fermeTravail.go), not at once.
	Work bool `json:"work"`
}

// fermeView: the farm as the app shows it (the act « voir », and after each one).
type fermeView struct {
	Ferme  *Ferme               `json:"ferme"`
	Today  int64                `json:"today"`
	Month  int                  `json:"month"`
	Meteo  map[string][2]string `json:"meteo"`
	Rainy  map[string]bool      `json:"rainy"`
	Offres []offreView          `json:"offres"`
	// Cultures, Produits, Betes: the catalogue.
	Cultures []game.Culture `json:"cultures"`
	Produits []game.Produit `json:"produits"`
	Betes    []game.Bete    `json:"betes"`
	// Left: what the farm may still sell today; Cap, the day's.
	Left int `json:"left"`
	Cap  int `json:"cap"`
	// HomeZone: the yard's climate; Here: the plots the Sim is at now (it can work them).
	HomeZone string          `json:"homeZone"`
	Here     map[string]bool `json:"here"`
	Rules    map[string]int  `json:"rules"`
}

type offreView struct {
	game.FermeOffre
	Open bool `json:"open"`
	// CityName: the town it's by.
	CityName string `json:"cityName,omitempty"`
}

func (s *Sim) fermeView(ctx context.Context) fermeView {
	f := s.ferme()
	hidden := features.Default.HiddenPlaces(ctx)
	v := fermeView{Ferme: f, Today: s.today(), Month: game.MonthOfDay(s.today()), Meteo: map[string][2]string{}, Rainy: map[string]bool{},
		Cultures: game.Cultures, Produits: game.Produits, Betes: game.Betes, Left: min(s.left(game.FromFerme), game.FermeCap*2), Cap: game.FermeCap,
		HomeZone: world.FermeZoneOf(s.HomeCity), Here: map[string]bool{},
		Rules: map[string]int{"clear": game.ClearCost, "plough": game.PloughCost, "treat": game.TreatCost, "hand": game.ManoeuvreDay, "rentDays": game.RentDays, "maxPlots": game.FermeMaxPlots}}
	for _, o := range game.FermeOffres {
		z := s.fermeZone(o)
		v.Meteo[z] = [2]string{game.Meteo(z, v.Today), game.Meteo(z, v.Today+1)}
		v.Rainy[z] = game.RainySeason(z, v.Month)
		ov := offreView{FermeOffre: o, Open: o.Home || (!hidden[o.Place] && !hidden[world.FermeCommune(o.Place)])}
		if c, ok := world.FindCity(o.City); ok {
			ov.CityName = c.Name
		}
		v.Offres = append(v.Offres, ov)
	}
	for _, p := range f.Plots {
		if o, ok := game.FindOffre(p.Offre); ok && s.fermeThere(o) == nil {
			v.Here[p.ID] = true
		}
	}
	return v
}

// fermeThere: whether the Sim is where it can work this plot (its town; the yard: at home's town).
func (s *Sim) fermeThere(o game.FermeOffre) error {
	if o.Home {
		if s.City != s.HomeCity {
			return errFermeHome
		}
		return nil
	}
	if s.City != o.City {
		return errFermeAway
	}
	return nil
}

// fermeHandler: POST /sims/{id}/ferme/{act}.
func (h *Handler) fermeHandler(w http.ResponseWriter, r *http.Request) {
	var req fermeReq
	if r.ContentLength != 0 {
		if err := httpx.Decode(r, &req); err != nil {
			httpx.Error(w, http.StatusBadRequest, "requête invalide")
			return
		}
	}
	act := chi.URLParam(r, "act")
	ctx := r.Context()
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		if !fermeOpen() {
			return game.Outcome{}, nil, errFermeClosed
		}
		news := s.fermeSettle()
		hidden := features.Default.HiddenPlaces(ctx)
		open := func(o game.FermeOffre) bool {
			return o.Home || (!hidden[o.Place] && !hidden[world.FermeCommune(o.Place)])
		}
		// Done by the Sim at the plot (fermeTravail.go): started now, done when it ends.
		if req.Work {
			if label, ok, err := s.fermeWorkStart(act, req, open); ok {
				if err != nil {
					return game.Outcome{}, nil, err
				}
				s.reply = s.fermeView(ctx)
				return game.Outcome{Text: label}, nil, nil
			}
		}
		text, money, err := s.fermeAct(act, req, open)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		v := s.fermeView(ctx)
		s.reply = v
		if act == "voir" {
			return game.Outcome{Text: strings.Join(news, " ")}, nil, nil
		}
		return game.Outcome{Text: text, Money: money}, []Event{{Kind: "life", Text: text, Money: money, GameTime: s.GameMinutes}}, nil
	})
}

// fermeAct: an act on the farm (the days already brought up): the line said, the money (spent <0, earned >0).
// open: whether an offer's place is open (its update, its country).
func (s *Sim) fermeAct(act string, q fermeReq, open func(game.FermeOffre) bool) (string, int, error) {
	if act == "voir" {
		return "", 0, nil
	}
	if s.stage().ID == game.StageBebe {
		return "", 0, errFermeBaby
	}
	f := s.ferme()
	today := s.today()
	switch act {
	case "louer", "acheter":
		o, ok := game.FindOffre(q.Offre)
		if !ok {
			return "", 0, errFermeOffre
		}
		if !open(o) {
			return "", 0, errFermeShut
		}
		if s.minor() && !o.Home {
			return "", 0, errFermeMinor
		}
		n := 0
		for _, p := range f.Plots {
			if p.Offre == o.ID {
				return "", 0, errFermeHave
			}
			if o2, _ := game.FindOffre(p.Offre); !o2.Home {
				n++
			}
		}
		if !o.Home && n >= game.FermeMaxPlots {
			return "", 0, errFermeFull
		}
		buy := act == "acheter" || o.Home
		cost := o.Rent
		if buy {
			cost = o.Price
		}
		if s.Money < cost {
			return "", 0, errBroke
		}
		s.Money -= cost
		f.Next++
		p := &Parcelle{ID: "p" + strconv.Itoa(f.Next), Offre: o.ID, Owned: buy, Paid: cost, Champ: champ0()}
		if !buy {
			p.RentUntil = today + game.RentDays
		}
		if o.Home {
			p.Champ.Stage = game.StageDefriche
		}
		f.Plots = append(f.Plots, p)
		if o.Home {
			return fmt.Sprintf("Ta cour est aménagée (%s) : trois planches de potager et un petit poulailler. Laboure, sème, et adopte tes premières poules.", game.FCFA(cost)), -cost, nil
		}
		if buy {
			return fmt.Sprintf("Parcelle achetée : %s, pour %s. Elle est à toi : commence par défricher.", o.Label, game.FCFA(cost)), -cost, nil
		}
		return fmt.Sprintf("Parcelle louée : %s, %s pour %d jours. Commence par défricher.", o.Label, game.FCFA(cost), game.RentDays), -cost, nil
	case "vendre":
		return s.fermeSell(q)
	case "transformer":
		return s.fermeMake(q)
	}
	p, o, err := f.plot(q.Plot)
	if err != nil {
		return "", 0, err
	}
	name := fermePlotName(o)
	switch act {
	case "renouveler":
		if p.Owned {
			return "", 0, errors.New("cette parcelle est à toi : pas de loyer")
		}
		if s.Money < o.Rent {
			return "", 0, errBroke
		}
		s.Money -= o.Rent
		p.RentUntil = max(p.RentUntil, today) + game.RentDays
		p.Paid += o.Rent
		return fmt.Sprintf("Loyer de %s payé : %d jours de plus (%s).", name, game.RentDays, game.FCFA(o.Rent)), -o.Rent, nil
	case "rendre":
		for _, e := range p.Pens {
			if e.Adults+e.Young > 0 {
				return "", 0, errFermeEmpty
			}
		}
		f.Plots = slices.DeleteFunc(f.Plots, func(x *Parcelle) bool { return x == p })
		if p.Owned && !o.Home {
			back := int(math.Round(float64(o.Price) * game.PlotResale))
			s.Money += back
			return fmt.Sprintf("Tu as revendu la parcelle de %s : %s.", name, game.FCFA(back)), back, nil
		}
		return fmt.Sprintf("Tu as rendu %s à son propriétaire.", name), 0, nil
	case "manoeuvre":
		p.Hand = q.On
		if q.On {
			return fmt.Sprintf("Un manœuvre s'occupe de %s chaque jour : arrosage, désherbage et bêtes (%s par jour, plus la nourriture).", name, game.FCFA(game.ManoeuvreDay)), 0, nil
		}
		return fmt.Sprintf("Le manœuvre de %s est remercié : à toi de t'en occuper.", name), 0, nil
	}
	// The rest is done there.
	if err := s.fermeThere(o); err != nil {
		return "", 0, err
	}
	if !p.active(today) {
		return "", 0, errFermeRent
	}
	if s.minor() && !o.Home {
		return "", 0, errFermeMinor
	}
	if slices.Contains([]string{"betes", "nourrir", "abreuver", "paturage", "oeufs", "traire", "veterinaire", "vendre-betes", "pecher"}, act) {
		return s.fermePen(act, q, p, o)
	}
	c := &p.Champ
	zone := s.fermeZone(o)
	month := game.MonthOfDay(today)
	switch act {
	case "defricher":
		if c.Stage != game.StageFriche {
			return "", 0, errFermeStage
		}
		cost := 0
		if q.Hire {
			cost = game.ClearCost
			if s.Money < cost {
				return "", 0, errBroke
			}
			s.Money -= cost
			s.Needs = s.Needs.Add(game.Needs{Energy: -8, Social: 15, Fun: 5})
		} else {
			s.Needs = s.Needs.Add(game.Needs{Energy: -25, Hygiene: -15, Fun: 5})
		}
		c.Stage = game.StageDefriche
		s.fermeSkill(15)
		if q.Hire {
			return fmt.Sprintf("Les jeunes du village t'ont aidé à défricher %s à la machette (%s) : les broussailles en tas, rien n'a été brûlé.", name, game.FCFA(cost)), -cost, nil
		}
		return fmt.Sprintf("%s est défrichée à la machette, à la sueur de ton front : les broussailles en tas, rien n'a été brûlé.", fermeCap(name)), 0, nil
	case "labourer":
		if c.Stage != game.StageDefriche {
			return "", 0, errFermeStage
		}
		cost := 0
		if q.Hire {
			cost = game.PloughCost
			if s.Money < cost {
				return "", 0, errBroke
			}
			s.Money -= cost
			s.Needs = s.Needs.Add(game.Needs{Energy: -8, Fun: 10})
		} else {
			s.Needs = s.Needs.Add(game.Needs{Energy: -25, Hygiene: -15, Fun: 5})
		}
		c.Stage = game.StageLaboure
		s.fermeSkill(15)
		if q.Hire {
			return fmt.Sprintf("Le motoculteur Kabako loué pour la journée (%s) : %s est labourée en un rien de temps.", game.FCFA(cost), name), -cost, nil
		}
		return fmt.Sprintf("%s est labourée à la daba, sillon après sillon.", fermeCap(name)), 0, nil
	case "semer":
		if c.Stage != game.StageLaboure {
			return "", 0, errFermeStage
		}
		crop, ok := game.FindCulture(q.Crop)
		if !ok || !slices.Contains(o.Crops, crop.ID) || !crop.GrowsIn(zone) {
			return "", 0, errFermeCrop
		}
		cost := crop.Seed * o.Rows
		if s.Money < cost {
			return "", 0, errBroke
		}
		s.Money -= cost
		in := crop.InSow(month)
		*c = champ0()
		c.Stage, c.Crop, c.Quality, c.InSeason, c.Score, c.Sown = game.StagePousse, crop.ID, 1, in, max(0, min(100, q.Score)), today
		if !in {
			c.Quality = game.OutOfSeason
		}
		c.WeedAt = 2
		s.Needs = s.Needs.Add(game.Needs{Energy: -12, Hygiene: -8, Fun: 10})
		s.fermeSkill(20)
		line := fmt.Sprintf("%s : %d rangs plantés à %s (%s).", crop.SeedLabel, o.Rows, name, game.FCFA(cost))
		if !in {
			line += " Ce n'est pas sa saison : il donnera moins."
		}
		return line + fmt.Sprintf(" Première récolte dans %d jours, s'il a de l'eau.", crop.Days), -cost, nil
	case "arroser":
		if c.Stage != game.StagePousse {
			return "", 0, errFermeStage
		}
		if c.Watered == today {
			return "", 0, errFermeDone
		}
		if game.Meteo(zone, today) == "pluie" {
			return "", 0, errFermeRaining
		}
		c.Watered = today
		s.Needs = s.Needs.Add(game.Needs{Energy: -6, Fun: 4})
		s.fermeSkill(5)
		return fmt.Sprintf("L'arrosoir rempli au puits, rang après rang : %s a bu pour aujourd'hui.", name), 0, nil
	case "desherber":
		if c.Stage != game.StagePousse {
			return "", 0, errFermeStage
		}
		if !c.Weeds {
			return "", 0, errFermeNoWeeds
		}
		c.Weeds = false
		s.Needs = s.Needs.Add(game.Needs{Energy: -12, Hygiene: -10})
		s.fermeSkill(8)
		return fmt.Sprintf("Les mauvaises herbes arrachées à la daba : les plants de %s respirent.", name), 0, nil
	case "traiter":
		if c.Stage != game.StagePousse {
			return "", 0, errFermeStage
		}
		if !c.Pest {
			return "", 0, errFermeNoPest
		}
		if s.Money < game.TreatCost {
			return "", 0, errBroke
		}
		s.Money -= game.TreatCost
		c.Pest = false
		s.Needs = s.Needs.Add(game.Needs{Energy: -6})
		s.fermeSkill(8)
		return fmt.Sprintf("Le jus de feuilles de neem pulvérisé, un peu de cendre au pied : les chenilles quittent %s, sans produit chimique (%s).", name, game.FCFA(game.TreatCost)), -game.TreatCost, nil
	case "recolter":
		if c.Stage != game.StageMur {
			return "", 0, errFermeStage
		}
		crop, _ := game.FindCulture(c.Crop)
		season := 1.0
		if crop.Kind == "perenne" && !crop.InSeason(month) {
			season = game.OffSeason
		}
		bonus := 1.0
		if s.Career == game.AgriculteurCareer {
			bonus = 1.1
		}
		score := c.Score
		if q.Score > 0 {
			score = (score + max(0, min(100, q.Score))) / 2
		}
		units := game.HarvestUnits(crop, o.Rows, c.Quality, season, s.skillLevel(game.SkillAgri), score, bonus)
		f.Grenier[crop.ID] += units
		f.Harvests++
		c.Harvests++
		if crop.Kind == "perenne" {
			c.Stage, c.Growth, c.Weeds, c.WeedAt = game.StagePousse, float64(crop.Days-crop.Again), false, crop.Days-crop.Again+1
		} else {
			*c = champ0()
			c.Stage = game.StageDefriche
		}
		s.Needs = s.Needs.Add(game.Needs{Energy: -15, Hygiene: -10, Fun: 20, Social: 5})
		s.fermeSkill(30)
		s.addMood("belle-recolte", crop.Label)
		line := fmt.Sprintf("Récolte de %s à %s : %d %s au grenier.", game.LowerFirst(crop.Label), name, units, crop.Unit)
		if season < 1 {
			line += " Hors saison, les arbres donnent peu."
		}
		if crop.Make != "" {
			if pr, ok := game.FindProduit(crop.Make); ok {
				line += " À faire ensuite : " + game.LowerFirst(pr.Do) + "."
			}
		}
		return line, 0, nil
	case "arracher":
		if c.Stage != game.StagePousse && c.Stage != game.StageMur {
			return "", 0, errFermeStage
		}
		*c = champ0()
		c.Stage = game.StageDefriche
		return fmt.Sprintf("Le champ de %s est arraché : la terre attend une nouvelle culture.", name), 0, nil
	}
	return "", 0, errFermeAct
}

// champ0: a field as it comes (the bush, to clear).
func champ0() Champ { return Champ{Stage: game.StageFriche, Quality: 1} }

func fermeCap(s string) string {
	if s == "" {
		return s
	}
	r := []rune(s)
	return strings.ToUpper(string(r[0])) + string(r[1:])
}

// fermeSkill: the farming skill's points (and its level said when it rises).
func (s *Sim) fermeSkill(points int) {
	s.pending = append(s.pending, s.gainSkill(game.SkillAgri, points)...)
}

// fermePen: an act on the animals of a plot.
func (s *Sim) fermePen(act string, q fermeReq, p *Parcelle, o game.FermeOffre) (string, int, error) {
	f := s.ferme()
	today := s.today()
	b, ok := game.FindBete(q.Kind)
	if !ok {
		return "", 0, errFermeBete
	}
	e := p.pen(b.ID)
	if act == "betes" {
		if !slices.Contains(o.Animals, b.ID) || !b.LivesIn(s.fermeZone(o)) {
			return "", 0, errFermeBete
		}
		n := max(1, q.Qty)
		if e == nil {
			if len(p.Pens) >= o.Pens {
				return "", 0, errFermePens
			}
			n = max(n, b.Min)
		} else if e.Adults+e.Young+n > b.Max {
			return "", 0, errFermeMax
		}
		if n > b.Max {
			return "", 0, errFermeMax
		}
		cost := n * b.Price
		if s.Money < cost {
			return "", 0, errBroke
		}
		s.Money -= cost
		if e == nil {
			e = &Enclos{Kind: b.ID, Condition: 80, BirthIn: b.Every}
			p.Pens = append(p.Pens, e)
		}
		if b.Pond {
			// Alevins: a new pond's growth starts again with them.
			e.Adults += n
			e.Grown = 0
			return fmt.Sprintf("%d alevins de tilapia lâchés dans l'étang (%s). Nourris-les chaque jour : dans %d jours, on pêche.", n, game.FCFA(cost), b.Grow), -cost, nil
		}
		e.Adults += n
		return fmt.Sprintf("Au marché à bétail : %d %s pour %s, et les voilà dans %s.", n, strings.ToLower(b.Label), game.FCFA(cost), b.Pen), -cost, nil
	}
	if e == nil || e.Adults+e.Young == 0 {
		return "", 0, errFermePen
	}
	heads := e.Adults + e.Young
	switch act {
	case "traire":
		return s.fermeMilk(e, b)
	case "nourrir":
		if e.Fed == today || e.Grazed == today {
			return "", 0, errFermeDone
		}
		cost := b.Feed * heads
		if s.Money < cost {
			return "", 0, errBroke
		}
		s.Money -= cost
		e.Fed = today
		s.Needs = s.Needs.Add(game.Needs{Energy: -5, Fun: 6})
		s.fermeSkill(5)
		return fmt.Sprintf("%s : %s (%s). Tout le monde se presse à la mangeoire.", b.Label, b.FeedLabel, game.FCFA(cost)), -cost, nil
	case "abreuver":
		if b.Pond {
			return "", 0, errFermeDone
		}
		if e.Watered == today {
			return "", 0, errFermeDone
		}
		e.Watered = today
		s.Needs = s.Needs.Add(game.Needs{Energy: -4, Fun: 3})
		s.fermeSkill(3)
		return fmt.Sprintf("L'eau fraîche de la pompe dans les abreuvoirs de %s.", b.Pen), 0, nil
	case "paturage":
		if !b.Graze {
			return "", 0, errFermeGraze
		}
		if e.Fed == today || e.Grazed == today {
			return "", 0, errFermeDone
		}
		e.Grazed = today
		e.Condition = min(100, e.Condition+int(math.Round(10*(game.ScoreFactor(q.Score)-0.9))))
		s.Needs = s.Needs.Add(game.Needs{Energy: -12, Fun: 15, Hygiene: -6})
		s.fermeSkill(12)
		if b.Herder > 0 && s.Career != game.EleveurCareer {
			if s.Money < b.Herder {
				return "", 0, errBroke
			}
			s.Money -= b.Herder
			return fmt.Sprintf("Le troupeau mené aux pâturages avec le bouvier (%s pour sa journée) : l'herbe est verte, les bêtes reviennent repues.", game.FCFA(b.Herder)), -b.Herder, nil
		}
		return "Le troupeau mené au pâturage, le bâton à la main : l'herbe est gratuite, les bêtes reviennent repues.", 0, nil
	case "oeufs":
		if b.Product == "" || b.Pond {
			return "", 0, errFermeNoEggs
		}
		if e.Eggs <= 0 {
			return "", 0, errFermeNoEggs
		}
		found := int(math.Ceil(float64(e.Eggs) * (0.6 + 0.4*float64(max(0, min(100, q.Score)))/100)))
		found = max(1, min(e.Eggs, found))
		e.Eggs -= found
		f.Grenier[b.Product] += found
		s.Needs = s.Needs.Add(game.Needs{Fun: 8})
		s.fermeSkill(5)
		line := fmt.Sprintf("%d œufs ramassés dans %s, rangés au grenier.", found, b.Pen)
		if e.Eggs > 0 {
			line += fmt.Sprintf(" Il en reste %d dans la paille.", e.Eggs)
		}
		return line, 0, nil
	case "veterinaire":
		if !e.Sick {
			return "", 0, errFermeWell
		}
		cost := b.Vet
		if s.Career == game.VeterinaireCareer {
			cost = 0
		}
		if s.Money < cost {
			return "", 0, errBroke
		}
		s.Money -= cost
		e.Sick = false
		e.Condition = max(e.Condition, 70)
		if cost == 0 {
			return fmt.Sprintf("Tu as soigné toi-même la bête malade de %s : elle va déjà mieux.", b.Pen), 0, nil
		}
		return fmt.Sprintf("Le vétérinaire est passé (%s) : un remède, du repos, la bête malade de %s va déjà mieux.", game.FCFA(cost), b.Pen), -cost, nil
	case "pecher":
		if !b.Pond {
			return "", 0, errFermeNotPond
		}
		if e.Grown < b.Grow {
			return "", 0, errFermeFish
		}
		n := e.Adults
		f.Grenier[b.Product] += n
		e.Adults, e.Grown = 0, 0
		p.Pens = slices.DeleteFunc(p.Pens, func(x *Enclos) bool { return x == e })
		s.Needs = s.Needs.Add(game.Needs{Fun: 20, Hygiene: -10, Energy: -10})
		s.fermeSkill(20)
		s.addMood("belle-recolte", b.Label)
		return fmt.Sprintf("On a pêché l'étang au filet : %d tilapias bien gras au grenier, à vendre frais au marché.", n), 0, nil
	case "vendre-betes":
		if b.Pond {
			return "", 0, errFermeNotPond
		}
		if e.Sick {
			return "", 0, errFermeSick
		}
		have, price, what := e.Adults, b.Sell, strings.ToLower(b.Label)
		if q.Young {
			have, price, what = e.Young, b.SellYoung, b.Young
		}
		if have <= 0 {
			return "", 0, errFermeNoSell
		}
		n := min(have, max(1, q.Qty))
		n = min(n, s.left(game.FromFerme)/price)
		if n <= 0 {
			return "", 0, errFermeCapped
		}
		got := s.earn(game.FromFerme, n*price)
		f.Earned += got
		if q.Young {
			e.Young -= n
			if e.Young == 0 {
				e.YoungAge = 0
			}
		} else {
			e.Adults -= n
		}
		if e.Adults+e.Young == 0 {
			p.Pens = slices.DeleteFunc(p.Pens, func(x *Enclos) bool { return x == e })
		}
		return capNote(fmt.Sprintf("Vente au marché à bétail : %d %s pour %s.", n, what, game.FCFA(got)), game.FromFerme, n, min(have, max(1, q.Qty))), got, nil
	}
	return "", 0, errFermeAct
}

// fermeSell: the grenier's things sold, at the market or to the coopérative, as many as the day's cap allows.
func (s *Sim) fermeSell(q fermeReq) (string, int, error) {
	f := s.ferme()
	have := f.Grenier[q.Product]
	if have <= 0 {
		return "", 0, errFermeStock
	}
	label, unit, market, coop, ok := game.SoldAs(q.Product)
	if !ok {
		return "", 0, errFermeStock
	}
	price, where := market, "au marché"
	if q.To == "coop" {
		price, where = coop, "à la coopérative Ensemble"
	}
	if price <= 0 {
		return "", 0, errFermeNoBuyer
	}
	want := have
	if q.Qty > 0 {
		want = min(have, q.Qty)
	}
	n := min(want, s.left(game.FromFerme)/price)
	if n <= 0 {
		return "", 0, errFermeCapped
	}
	got := s.earn(game.FromFerme, n*price)
	f.Grenier[q.Product] -= n
	if f.Grenier[q.Product] <= 0 {
		delete(f.Grenier, q.Product)
	}
	f.Earned += got
	s.Needs = s.Needs.Add(game.Needs{Social: 10, Fun: 5})
	return capNote(fmt.Sprintf("%s : %d %s vendus %s pour %s.", label, n, unit, where, game.FCFA(got)), game.FromFerme, n, want), got, nil
}

// fermeMake: a raw harvest turned into its product (dried, pressed, cooked): at once, or ready in its days.
func (s *Sim) fermeMake(q fermeReq) (string, int, error) {
	f := s.ferme()
	pr, ok := game.FindProduit(q.Product)
	if !ok || pr.From == "" {
		return "", 0, errFermeNoMake
	}
	have := f.Grenier[pr.From]
	if have <= 0 {
		return "", 0, errFermeStock
	}
	n := have
	if q.Qty > 0 {
		n = min(have, q.Qty)
	}
	out := max(1, int(math.Floor(float64(n)*pr.Ratio)))
	cost := pr.Cost * n
	if s.Money < cost {
		return "", 0, errBroke
	}
	s.Money -= cost
	f.Grenier[pr.From] -= n
	if f.Grenier[pr.From] <= 0 {
		delete(f.Grenier, pr.From)
	}
	s.Needs = s.Needs.Add(game.Needs{Energy: -10, Social: 10, Fun: 8})
	s.fermeSkill(10)
	if pr.Days == 0 {
		f.Grenier[pr.ID] += out
		return fmt.Sprintf("%s : %d %s au grenier.", pr.Do, out, pr.Unit), -cost, nil
	}
	f.Sechage = append(f.Sechage, FermeLot{Product: pr.ID, Qty: out, Ready: s.today() + int64(pr.Days)})
	line := fmt.Sprintf("%s : %d %s prêts dans %d jour(s).", pr.Do, out, pr.Unit, pr.Days)
	if cost > 0 {
		line += fmt.Sprintf(" (%s)", game.FCFA(cost))
	}
	return line, -cost, nil
}

// fermeHire: whether one of the careers of the land can be taken (economy.go career): their update open.
func (s *Sim) fermeHire(career string) error {
	if game.IsFermeCareer(career) && !fermeOpen() {
		return errFermeClosed
	}
	return nil
}

// testerFerme: the testers' shortcuts: a plot given (Daloa's, or the yard), the growth brought on, animals given,
// the days passed.
func (s *Sim) testerFerme(action string) ([]Event, bool, error) {
	say := func(text string) []Event {
		return []Event{{Kind: "life", Text: "Testeur : " + text, GameTime: s.GameMinutes}}
	}
	switch action {
	case "ferme-parcelle":
		f := s.ferme()
		for _, id := range []string{"cour", "gonate"} {
			if slices.ContainsFunc(f.Plots, func(p *Parcelle) bool { return p.Offre == id }) {
				continue
			}
			f.Next++
			p := &Parcelle{ID: "p" + strconv.Itoa(f.Next), Offre: id, Owned: true, Champ: champ0()}
			p.Champ.Stage = game.StageLaboure
			f.Plots = append(f.Plots, p)
		}
		s.City, s.Commune = "daloa", "daloa-centre"
		return say("la cour et la parcelle de Gonaté offertes, déjà labourées ; te voilà à Daloa."), true, nil
	case "ferme-pousse":
		f := s.ferme()
		n := 0
		for _, p := range f.Plots {
			c := &p.Champ
			if crop, ok := game.FindCulture(c.Crop); ok && c.Stage == game.StagePousse {
				c.Growth = float64(crop.Days)
				c.Stage = game.StageMur
				n++
			}
			for _, e := range p.Pens {
				if b, ok := game.FindBete(e.Kind); ok {
					e.Grown = max(e.Grown, b.Grow)
					if e.Young > 0 {
						e.Adults += e.Young
						e.Young, e.YoungAge = 0, 0
					}
					if b.Product != "" && !b.Pond {
						e.Eggs = max(e.Eggs, e.Adults*2)
					}
				}
			}
		}
		return say(fmt.Sprintf("%d champ(s) mûr(s), les petits grandis, les œufs pondus.", n)), true, nil
	case "ferme-betes":
		f := s.ferme()
		for _, p := range f.Plots {
			o, _ := game.FindOffre(p.Offre)
			for _, k := range o.Animals {
				if len(p.Pens) >= o.Pens {
					break
				}
				b, _ := game.FindBete(k)
				if p.pen(k) != nil || !b.LivesIn(s.fermeZone(o)) {
					continue
				}
				n := b.Min * 2
				if b.Pond {
					n = 100
				}
				p.Pens = append(p.Pens, &Enclos{Kind: k, Adults: n, Condition: 80, BirthIn: 1})
			}
		}
		return say("des bêtes dans chaque parcelle (ses deux élevages)."), true, nil
	case "ferme-jour":
		f := s.ferme()
		f.Day--
		for _, p := range f.Plots {
			p.Champ.Watered = f.Day
			if p.RentUntil > 0 {
				p.RentUntil--
			}
			for _, e := range p.Pens {
				e.Fed, e.Watered = f.Day, f.Day
			}
		}
		for i := range f.Sechage {
			f.Sechage[i].Ready--
		}
		news := s.fermeSettle()
		return say("une journée de ferme passée (arrosée et nourrie). " + strings.Join(news, " ")), true, nil
	}
	return nil, false, nil
}
