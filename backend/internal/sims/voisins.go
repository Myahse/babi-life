package sims

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Les voisins vivants (the update « voisins-vivants », game/voisins.go; web components/VoisinsApp.tsx): the
// cour's three families, kept in the Sim's Life. Their days go by with the game's (voisinsSync, in the
// mutate flow, at most game.VoisinCatchUp days at once): news of their own lives, an ask now and then, the
// money lent paid back, a plate brought by the closest. The Sim greets them, brings a dish, answers yes or no
// (POST /sims/{id}/voisins/{house}/{act}). With le mode vie, the neighbour who drops by is one of them.

var (
	errNoVoisin   = errors.New("pas de voisin de ce nom")
	errGreeted    = errors.New("déjà salué·e aujourd'hui")
	errDished     = errors.New("tu leur as déjà apporté un plat aujourd'hui")
	errNoAsk      = errors.New("ils ne t'ont rien demandé")
	errVoisinsOff = errors.New("les voisins ne sont pas encore là")
)

func voisinsOpen(ctx context.Context) bool {
	return features.Default != nil && features.Default.BlocksKey(ctx, game.VoisinsKey) == ""
}

// Voisins: the cour.
type Voisins struct {
	Houses []Voisin `json:"houses"`
	// Day: the last game day lived; Next: the next family's id.
	Day  int64 `json:"day"`
	Next int   `json:"next"`
}

// Voisin: a neighbour family.
type Voisin struct {
	ID     int    `json:"id"`
	Family string `json:"family"`
	// The head of the family (who comes, who asks), and the partner if any.
	Name    string `json:"name"`
	Gender  string `json:"gender"`
	Seed    int    `json:"seed"`
	Partner string `json:"partner,omitempty"`
	PGender string `json:"pGender,omitempty"`
	PSeed   int    `json:"pSeed,omitempty"`
	Kids    int    `json:"kids"`
	Job     string `json:"job"`
	Trait   string `json:"trait"`
	Lien    int    `json:"lien"`
	// News: the last things known of them (newest first); Ask: what they came to ask, waiting.
	News []VoisinNews `json:"news,omitempty"`
	Ask  *VoisinAsk   `json:"ask,omitempty"`
	// Greeted, Dished: the game day of the last greeting, of the last dish brought.
	Greeted int64 `json:"greeted,omitempty"`
	Dished  int64 `json:"dished,omitempty"`
	// Owe: what they borrowed, to pay back from the game day OweDay.
	Owe    int   `json:"owe,omitempty"`
	OweDay int64 `json:"oweDay,omitempty"`
	Since  int64 `json:"since"`
}

// VoisinNews: one thing known of them, when (game minute).
type VoisinNews struct {
	Text string `json:"text"`
	At   int64  `json:"at"`
}

// VoisinAsk: an ask waiting for its answer.
type VoisinAsk struct {
	Kind   string `json:"kind"`
	Text   string `json:"text"`
	Yes    string `json:"yes"`
	No     string `json:"no"`
	Amount int    `json:"amount,omitempty"`
	Day    int64  `json:"day"`
}

// first: the head's first name (what's said in the asks).
func (v *Voisin) first() string { n, _, _ := strings.Cut(v.Name, " "); return n }

func (v *Voisin) news(text string, at int64) {
	v.News = append([]VoisinNews{{Text: text, At: at}}, v.News...)
	if len(v.News) > game.VoisinNews {
		v.News = v.News[:game.VoisinNews]
	}
}

// newVoisin: a family moves in.
func (c *Voisins) newVoisin(rng *rand.Rand, now int64) Voisin {
	c.Next++
	taken := map[string]bool{}
	for _, h := range c.Houses {
		taken[h.Family] = true
	}
	fam := game.VoisinNames[rng.IntN(len(game.VoisinNames))]
	for taken[fam] {
		fam = game.VoisinNames[rng.IntN(len(game.VoisinNames))]
	}
	g := "femme"
	if rng.IntN(2) == 0 {
		g = "homme"
	}
	v := Voisin{ID: c.Next, Family: fam, Name: game.BabyName(g, rng) + " " + fam, Gender: g, Seed: rng.IntN(1 << 30), Kids: rng.IntN(4), Job: game.VoisinJobs[rng.IntN(len(game.VoisinJobs))], Trait: game.VoisinTraits[rng.IntN(len(game.VoisinTraits))], Lien: game.LienStart, Since: now}
	if rng.Float64() < 0.65 {
		v.PGender = map[string]string{"femme": "homme", "homme": "femme"}[g]
		v.Partner, v.PSeed = game.BabyName(v.PGender, rng), rng.IntN(1<<30)
	}
	return v
}

// voisinsSync: the cour's days lived up to now; what the Sim hears of it.
func (s *Sim) voisinsSync(rng *rand.Rand) []Event {
	now := s.GameMinutes
	day := now / game.DayMinutes
	c := s.Life.Voisins
	if c == nil {
		c = &Voisins{Day: day}
		for range game.VoisinsCount {
			c.Houses = append(c.Houses, c.newVoisin(rng, now))
		}
		s.Life.Voisins = c
		return nil
	}
	var out []Event
	say := func(text string, money int) {
		out = append(out, Event{Kind: "voisin", Text: text, Money: money, GameTime: now})
	}
	for d := max(c.Day+1, day-game.VoisinCatchUp+1); d <= day; d++ {
		for i := range c.Houses {
			h := &c.Houses[i]
			// Too late to answer: they did without the Sim.
			if h.Ask != nil && d > h.Ask.Day+game.VoisinAskDays {
				if h.Ask.Kind != "bruit" {
					h.Lien = max(0, h.Lien-2)
				}
				h.Ask = nil
			}
			// What was lent, paid back (or not: they're gone cold).
			if h.Owe > 0 && d >= h.OweDay {
				if h.Lien >= 40 || rng.Float64() < 0.8 {
					s.Money += h.Owe
					say(fmt.Sprintf("%s te rend les %d F prêtés : « Merci encore ! »", h.first(), h.Owe), h.Owe)
					h.Lien = min(100, h.Lien+3)
				} else {
					say(fmt.Sprintf("%s ne t'a jamais rendu tes %d F… et t'évite dans la cour.", h.first(), h.Owe), 0)
				}
				h.Owe = 0
			}
			// The closest bring a plate now and then.
			if h.Lien >= game.LienClose && rng.Float64() < 0.15 {
				s.Needs = s.Needs.Add(game.Needs{Hunger: 25, Social: 5})
				say(fmt.Sprintf("%s t'apporte une assiette d'alloco-poisson : « Pour toi, mon voisin ! »", h.first()), 0)
			}
			if rng.Float64() >= game.VoisinEventChance {
				continue
			}
			switch {
			case h.Ask == nil && h.Owe == 0 && rng.Float64() < 0.5:
				a := game.AskFor(h.Trait, rng)
				ask := &VoisinAsk{Kind: a.ID, Text: fmt.Sprintf(a.Text, h.first()), Yes: a.Yes, No: a.No, Day: d}
				if a.Loan {
					ask.Amount = game.LoanAmount(rng)
					ask.Yes = fmt.Sprintf("Prêter %d F", ask.Amount)
				}
				h.Ask = ask
				say(ask.Text, 0)
			case rng.Float64() < game.VoisinMoveChance:
				gone := h.Family
				*h = c.newVoisin(rng, now)
				h.news(fmt.Sprintf("Les %s ont emménagé dans la cour.", h.Family), now)
				say(fmt.Sprintf("Les %s ont déménagé. Une nouvelle famille arrive : les %s.", gone, h.Family), 0)
			default:
				n := game.VoisinNewsKinds[rng.IntN(len(game.VoisinNewsKinds))]
				if n.ID == "naissance" {
					h.Kids++
				}
				text := fmt.Sprintf(n.Text, h.Family)
				h.news(text, now)
				say(text, 0)
			}
		}
	}
	c.Day = day
	return out
}

// voisinAct: POST /sims/{id}/voisins/{house}/{act} — saluer, plat, oui, non.
func (h *Handler) voisinAct(w http.ResponseWriter, r *http.Request) {
	if !voisinsOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, errVoisinsOff.Error())
		return
	}
	id, _ := strconv.Atoi(chi.URLParam(r, "house"))
	act := chi.URLParam(r, "act")
	h.mutateTx(w, r, func(s *Sim, _ pgx.Tx) (game.Outcome, []Event, error) {
		if s.Life.Voisins == nil {
			s.voisinsSync(newRand())
		}
		return s.voisinDo(id, act)
	})
}

var greetLines = map[string]string{
	"bavard":    "%s te retient vingt minutes pour te raconter tout ce qui se passe dans le quartier.",
	"serviable": "%s te salue : « Si tu as besoin de quoi que ce soit, tu frappes, hein ! »",
	"fetard":    "%s te tape dans la main : « Samedi on fait quelque chose, tu viens ! »",
	"pieux":     "%s te salue : « Que Dieu te garde, mon voisin. »",
	"discret":   "%s te fait un petit signe de la tête et un sourire.",
	"curieux":   "%s te salue… et te demande où tu vas, avec qui, et pourquoi.",
}

func (s *Sim) voisinDo(id int, act string) (game.Outcome, []Event, error) {
	c := s.Life.Voisins
	if c == nil {
		return game.Outcome{}, nil, errVoisinsOff
	}
	var h *Voisin
	for i := range c.Houses {
		if c.Houses[i].ID == id {
			h = &c.Houses[i]
		}
	}
	if h == nil {
		return game.Outcome{}, nil, errNoVoisin
	}
	day := s.GameMinutes / game.DayMinutes
	var text string
	money := 0
	switch act {
	case "saluer":
		if h.Greeted == day {
			return game.Outcome{}, nil, errGreeted
		}
		h.Greeted, h.Lien = day, min(100, h.Lien+game.GreetLien)
		s.Needs = s.Needs.Add(game.Needs{Social: 8})
		text = fmt.Sprintf(greetLines[h.Trait], h.first())
	case "plat":
		if h.Dished == day {
			return game.Outcome{}, nil, errDished
		}
		if s.Money < game.DishCost {
			return game.Outcome{}, nil, errBroke
		}
		s.Money -= game.DishCost
		money = -game.DishCost
		h.Dished, h.Lien = day, min(100, h.Lien+game.DishLien)
		s.Needs = s.Needs.Add(game.Needs{Social: 10})
		text = fmt.Sprintf("Tu apportes un plat de garba chez les %s. %s est touché·e : « Il ne fallait pas ! »", h.Family, h.first())
	case "oui", "non":
		ask := h.Ask
		if ask == nil {
			return game.Outcome{}, nil, errNoAsk
		}
		a, ok := game.FindAsk(ask.Kind)
		if !ok {
			h.Ask = nil
			return game.Outcome{}, nil, errNoAsk
		}
		if act == "oui" {
			cost := a.Cost
			if a.Loan {
				cost = ask.Amount
			}
			if s.Money < cost {
				return game.Outcome{}, nil, errBroke
			}
			s.Money -= cost
			money = -cost
			if a.Loan {
				h.Owe, h.OweDay = ask.Amount, day+2+int64(newRand().IntN(4))
			}
			if a.Pay > 0 {
				money += s.earn(game.FromVoisins, a.Pay)
			}
			s.Needs = s.Needs.Add(a.YesNeeds)
			h.Lien = min(100, h.Lien+a.YesLien)
			text = fmt.Sprintf(a.YesText, h.first())
		} else {
			s.Needs = s.Needs.Add(a.NoNeeds)
			h.Lien = max(0, h.Lien+a.NoLien)
			text = fmt.Sprintf(a.NoText, h.first())
		}
		h.Ask = nil
	default:
		return game.Outcome{}, nil, errors.New("action inconnue")
	}
	return game.Outcome{Text: text, Money: money}, nil, nil
}

// voisinVisitor: a neighbour family's head, to drop by (famille.go dropBy), if the cour is there.
func (s *Sim) voisinVisitor(rng *rand.Rand) *Visit {
	c := s.Life.Voisins
	if !s.voisinsOn || c == nil || len(c.Houses) == 0 {
		return nil
	}
	h := c.Houses[rng.IntN(len(c.Houses))]
	if h.Lien < 20 {
		return nil
	}
	return &Visit{Who: fmt.Sprintf("p-n%d", h.ID), Name: h.Name, Gender: h.Gender, Seed: h.Seed, Kind: "surprise", State: "porte", At: s.GameMinutes}
}

// voisinWelcomed: the neighbour let in (famille.go openDoor): the bond grows.
func (s *Sim) voisinWelcomed(who string) {
	c := s.Life.Voisins
	if c == nil || !strings.HasPrefix(who, "p-n") {
		return
	}
	id, _ := strconv.Atoi(strings.TrimPrefix(who, "p-n"))
	for i := range c.Houses {
		if c.Houses[i].ID == id {
			c.Houses[i].Lien = min(100, c.Houses[i].Lien+4)
		}
	}
}
