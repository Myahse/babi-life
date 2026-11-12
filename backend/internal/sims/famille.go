package sims

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"slices"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Le mode vie's generations and visitors (the update « mode-vie », game/famille.go; web game/famille.ts,
// components/Famille.tsx, world3d/FamilyHome.tsx). All of it lives in the Sim's Life (sims.life, Famille):
//   - Ageing: from 18, adult life goes on in real days, young adult, adult, senior (game.Spans); each new
//     part is a birthday thrown at home, and the hair greys. Some never die (« vieillesse douce »).
//   - Children: a couple at home tries for a baby (fade to black); it is on its way for a few days, then
//     born at home, one of the household (Kids), growing up through the game's stages.
//   - The next generation: a child grown up takes over the house (handDown): the Sim's row stays the house's,
//     the person in it changes (name, look, age), three quarters of the money less the debts are theirs; the
//     parent stays at home as one of the elders, the partner too, and the elders pass gently in old age
//     (a farewell, the family gathered, a photo on the wall: Memorials).
//   - Visitors: a friend invited (« Inviter à la maison ») or a neighbour dropping by knocks; let in, they
//     sit, chat, eat, and go home at a set time; looked after (HostActs), the friendship grows.
// Everything is decided here; the phone only shows it and asks.

// Famille: the generations and the visitors, in the Sim's Life.
type Famille struct {
	// AdultAt: the game minute the Sim's adult life began to count (its first day seen as an adult).
	AdultAt int64 `json:"adultAt,omitempty"`
	// Stage and Years: where it is in adult life (game.Age*), and its age, as last synced.
	Stage string `json:"stage,omitempty"`
	Years int    `json:"years,omitempty"`
	// Gentle: « vieillesse douce », the player's choice: seniors never pass.
	Gentle bool `json:"gentle,omitempty"`
	// Last: the senior's years are over (and an heir is there): the farewell may be said (adieu).
	Last bool `json:"last,omitempty"`
	// Tries: tries for a baby since the last one (the third always works).
	Tries     int        `json:"tries,omitempty"`
	Expecting *Expecting `json:"expecting,omitempty"`
	Kids      []Kid      `json:"kids,omitempty"`
	Elders    []Elder    `json:"elders,omitempty"`
	Memorials []Memorial `json:"memorials,omitempty"`
	// Party: a birthday to throw at home (the app's scene); Arrival: the newborn to welcome (its id).
	Party   *FamParty `json:"party,omitempty"`
	Arrival string    `json:"arrival,omitempty"`
	// Farewell: the scene of a passing or of the house handed down, to be shown once.
	Farewell   *Farewell `json:"farewell,omitempty"`
	Generation int       `json:"generation,omitempty"`
	Visit      *Visit    `json:"visit,omitempty"`
	// NextVisit: from when a neighbour or a friend may drop by unannounced.
	NextVisit int64 `json:"nextVisit,omitempty"`
}

// Expecting: a baby on its way: since when, its day, who carries it ("self", "partner"; adopting: "").
type Expecting struct {
	Since  int64  `json:"since"`
	Due    int64  `json:"due"`
	Mother string `json:"mother,omitempty"`
	With   string `json:"with,omitempty"`
}

// Kid: a child of the house: its name, its look (drawn from Seed by the app), when born (game minute).
type Kid struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Gender string   `json:"gender"`
	Seed   int      `json:"seed"`
	Born   int64    `json:"born"`
	Traits []string `json:"traits,omitempty"`
	Stage  string   `json:"stage,omitempty"`
	Years  int      `json:"years,omitempty"`
}

// Elder: a parent living on at home after handing the house down (or the partner who stayed).
type Elder struct {
	ID      string          `json:"id"`
	Name    string          `json:"name"`
	Gender  string          `json:"gender"`
	Kin     string          `json:"kin"` // papa | maman
	Look    json.RawMessage `json:"look,omitempty"`
	Seed    int             `json:"seed,omitempty"`
	AdultAt int64           `json:"adultAt"`
	Stage   string          `json:"stage,omitempty"`
	Years   int             `json:"years,omitempty"`
}

// Memorial: someone of the family gone: the photo on the wall.
type Memorial struct {
	Name   string          `json:"name"`
	Gender string          `json:"gender"`
	Look   json.RawMessage `json:"look,omitempty"`
	Seed   int             `json:"seed,omitempty"`
	Years  int             `json:"years"`
	At     int64           `json:"at"`
}

// FamParty: a birthday that starts a new part of life: whose (self, a kid's or an elder's id), their name and age.
type FamParty struct {
	Who   string `json:"who"`
	Name  string `json:"name"`
	Stage string `json:"stage"`
	Years int    `json:"years"`
	At    int64  `json:"at"`
}

// Farewell: the passing of someone of the house (Gone), or the house handed down to the heir.
type Farewell struct {
	Name   string          `json:"name"`
	Gender string          `json:"gender"`
	Look   json.RawMessage `json:"look,omitempty"`
	Seed   int             `json:"seed,omitempty"`
	Years  int             `json:"years"`
	Gone   bool            `json:"gone,omitempty"`
	Heir   string          `json:"heir,omitempty"`
	Money  int             `json:"money,omitempty"`
	Rest   int             `json:"rest,omitempty"`
	At     int64           `json:"at"`
}

// Visit: someone at the door or in the house: who (a Friend's id, or a neighbour's "p-v…"), invited or not,
// on the way (route), at the door (porte) or in (dedans), when they come, when they go, what was done for them.
type Visit struct {
	Who    string          `json:"who"`
	Name   string          `json:"name"`
	Gender string          `json:"gender"`
	Seed   int             `json:"seed"`
	Look   json.RawMessage `json:"look,omitempty"`
	Kind   string          `json:"kind"`  // invite | surprise
	State  string          `json:"state"` // route | porte | dedans
	At     int64           `json:"at"`
	Until  int64           `json:"until,omitempty"`
	Done   []string        `json:"done,omitempty"`
}

const (
	// maxKids: a big family, not a crèche.
	maxKids = 6
	// visitStay: how long a visitor stays once in (game minutes), and how long they wait at the door.
	visitStay = 40
	doorWait  = 15
	// invitedIn: an invited friend arrives this long after the call.
	invitedIn = 2
)

var (
	errFamNotHome    = errors.New("il faut être chez soi")
	errNoPartnerIn   = errors.New("il faut vivre en couple à la maison")
	errExpecting     = errors.New("un bébé est déjà en route")
	errTooManyKids   = errors.New("la maison est déjà pleine d'enfants")
	errTooOldBaby    = errors.New("plus l'âge d'avoir un bébé")
	errNoHeir        = errors.New("aucun enfant n'a encore 18 ans")
	errNoKid         = errors.New("pas d'enfant de ce nom à la maison")
	errNoVisit       = errors.New("personne à la porte")
	errVisitBusy     = errors.New("quelqu'un est déjà invité")
	errNotFriend     = errors.New("invite plutôt quelqu'un que tu connais")
	errAlreadyHosted = errors.New("déjà fait pour cette visite")
	errNotYet        = errors.New("pas encore")
	errBadName       = errors.New("un prénom de 2 à 20 lettres")
)

// fam: the Sim's Famille, made if needed.
func (s *Sim) fam() *Famille {
	if s.Life.Famille == nil {
		s.Life.Famille = &Famille{}
	}
	return s.Life.Famille
}

// atHome: in its own commune, not at a hotel nor in prison (the house's people are there).
func (s *Sim) atHome() bool {
	return s.City == s.HomeCity && s.Commune == s.HomeCommune && s.Stay == nil && s.Prison == nil
}

// partnerHome: the partner living with the Sim (a person of the game), if any.
func (s *Sim) partnerHome() *game.Friend {
	for i := range s.Friends {
		if s.Friends[i].Partner && s.Friends[i].Home {
			return &s.Friends[i]
		}
	}
	return nil
}

// heir: the eldest child of the house who is 18 (nil: none yet).
func (f *Famille) heir(now int64) *Kid {
	var best *Kid
	for i := range f.Kids {
		k := &f.Kids[i]
		if st, _ := game.KidAgeAt(now - k.Born); st == game.StageAdulte && (best == nil || k.Born < best.Born) {
			best = k
		}
	}
	return best
}

func (f *Famille) kid(id string) *Kid {
	for i := range f.Kids {
		if f.Kids[i].ID == id {
			return &f.Kids[i]
		}
	}
	return nil
}

// famSync: the family brought to the Sim's clock (lifeSync, with the update open): the ages and their
// birthdays, the baby born on its day, the elders' gentle passing, the visitors coming and going.
func (s *Sim) famSync(rng *rand.Rand) {
	now := s.GameMinutes
	adult := s.BornAt == 0 || s.age() >= game.AdultAge
	if !adult && s.Life.Famille == nil {
		return
	}
	f := s.fam()
	if adult {
		if f.AdultAt == 0 {
			f.AdultAt = now
		}
		st, y := game.AdultAgeAt(now - f.AdultAt)
		if f.Stage != "" && st != f.Stage {
			s.birthday("self", s.FirstName, st, y)
			// The years show: the hair greys (the street, the other players see it too).
			s.Look.HairColor = game.GreyHair(s.Look.HairColor, st)
		}
		f.Stage, f.Years = st, y
		f.Last = st == game.AgeSenior && !f.Gentle && now-f.AdultAt >= game.LifeEnd() && f.heir(now) != nil
		if f.Last && !s.hasMood("serein") {
			m := game.NewMoodlet("serein", "", now)
			m.Need, m.Until = true, now+30
			s.Life.Moodlets = append(s.Life.Moodlets, m)
		}
	}
	// The baby on its way, then born at home.
	if e := f.Expecting; e != nil {
		if now >= e.Due {
			s.birth(rng)
		} else if e.Mother == "self" && !s.hasMood("enceinte") {
			m := game.NewMoodlet("enceinte", "", now)
			m.Need, m.Until = true, now+30
			s.Life.Moodlets = append(s.Life.Moodlets, m)
		}
	}
	for i := range f.Kids {
		k := &f.Kids[i]
		st, y := game.KidAgeAt(now - k.Born)
		if k.Stage != "" && st != k.Stage {
			key := st
			if st == game.StageAdulte {
				key = game.Majeur
			}
			s.birthday(k.ID, k.Name, key, y)
		}
		k.Stage, k.Years = st, y
	}
	// The elders: older every day; their years over, a gentle passing (never with « vieillesse douce »).
	kept := f.Elders[:0]
	for _, e := range f.Elders {
		st, y := game.AdultAgeAt(now - e.AdultAt)
		e.Stage, e.Years = st, y
		if !f.Gentle && now-e.AdultAt >= game.LifeEnd()+game.DayMinutes {
			s.mourn(e.Name, e.Gender, e.Look, e.Seed, e.Years, true)
			continue
		}
		kept = append(kept, e)
	}
	f.Elders = kept
	s.visitSync(rng)
}

// birthday: a new part of life begins: the journal says it, a party waits at home.
func (s *Sim) birthday(who, name, stage string, years int) {
	now := s.GameMinutes
	s.pending = append(s.pending, Event{Kind: "life", Text: game.BirthdayLine(name, stage, years), GameTime: now})
	s.fam().Party = &FamParty{Who: who, Name: name, Stage: stage, Years: years, At: now}
}

// mourn: someone of the house gone: the photo on the wall, the family in mourning, the scene to show.
func (s *Sim) mourn(name, gender string, look json.RawMessage, seed, years int, scene bool) {
	f := s.fam()
	now := s.GameMinutes
	f.Memorials = append(f.Memorials, Memorial{Name: name, Gender: gender, Look: look, Seed: seed, Years: years, At: now})
	s.addMood("deuil", "")
	s.pending = append(s.pending, Event{Kind: "life", Text: fmt.Sprintf("%s s'est éteint·e paisiblement, à %d ans, entouré·e de sa famille. Sa photo est au salon.", name, years), GameTime: now})
	if scene {
		f.Farewell = &Farewell{Name: name, Gender: gender, Look: look, Seed: seed, Years: years, Gone: true, At: now}
	}
}

// birth: the baby's day: one more of the house, a first name drawn (the app lets it be changed).
func (s *Sim) birth(rng *rand.Rand) {
	f := s.fam()
	now := s.GameMinutes
	gender := "femme"
	if rng.IntN(2) == 0 {
		gender = "homme"
	}
	id := fmt.Sprintf("k%d", now%1_000_000*10+int64(len(f.Kids)))
	k := Kid{ID: id, Name: game.BabyName(gender, rng), Gender: gender, Seed: rng.IntN(1 << 30), Born: now, Traits: game.BabyTraits(s.Traits, rng), Stage: game.StageBebe}
	f.Kids = append(f.Kids, k)
	f.Expecting, f.Tries, f.Arrival = nil, 0, k.ID
	// The child on the livret de famille (papiers.go).
	s.paperSync = true
	s.dropMood("enceinte", "")
	s.addMood("jeune-parent", "")
	word := "Une petite fille"
	if gender == "homme" {
		word = "Un petit garçon"
	}
	s.pending = append(s.pending, Event{Kind: "life", Text: fmt.Sprintf("%s est né·e à la maison : %s de la famille %s. Bienvenue !", k.Name, strings.ToLower(word), s.LastName), GameTime: now})
}

// tryBaby: the couple at home tries for a baby (fade to black). Half the time it works, the third try always.
func (s *Sim) tryBaby(rng *rand.Rand) (game.Outcome, []Event, error) {
	f := s.fam()
	p := s.partnerHome()
	switch {
	case !s.atHome():
		return game.Outcome{}, nil, errFamNotHome
	case p == nil:
		return game.Outcome{}, nil, errNoPartnerIn
	case s.BornAt != 0 && s.age() < game.AdultAge:
		return game.Outcome{}, nil, game.ErrTooYoung
	case f.Expecting != nil:
		return game.Outcome{}, nil, errExpecting
	case len(f.Kids) >= maxKids:
		return game.Outcome{}, nil, errTooManyKids
	case f.Stage == game.AgeSenior:
		return game.Outcome{}, nil, errTooOldBaby
	}
	now := s.GameMinutes
	s.Needs = s.Needs.Add(game.Needs{Social: 25, Fun: 20})
	s.addMood("amoureux", p.Name)
	p.Romance = min(100, p.Romance+5)
	f.Tries++
	if f.Tries < 3 && rng.Float64() >= 0.5 {
		text := fmt.Sprintf("Un moment tendre avec %s… Pas de bébé cette fois. Ça viendra.", p.Name)
		return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: now}}, nil
	}
	mother := "partner"
	if s.Gender == "femme" {
		mother = "self"
	} else if p.Gender != "femme" {
		mother = "" // two men: a baby adopted, arriving on its day
	}
	f.Expecting = &Expecting{Since: now, Due: now + game.Days(game.Spans.Grossesse), Mother: mother, With: p.ID}
	text := fmt.Sprintf("Bonne nouvelle : un bébé est en route ! Il arrive dans %s.", humanDays(game.Spans.Grossesse))
	if mother == "" {
		text = fmt.Sprintf("Bonne nouvelle : l'adoption est acceptée ! Le bébé arrive dans %s.", humanDays(game.Spans.Grossesse))
	}
	return game.Outcome{Text: text}, []Event{{Kind: "life", Text: text, GameTime: now}}, nil
}

func humanDays(d float64) string {
	if d < 1 {
		return fmt.Sprintf("%d h", int(d*24+0.5))
	}
	if d < 1.5 {
		return "1 jour"
	}
	return fmt.Sprintf("%d jours", int(d+0.5))
}

// lookJSON: a look as the elders and memorials keep it.
func lookJSON(l Look) json.RawMessage {
	b, _ := json.Marshal(l)
	return b
}

// handDown: the house handed down to the child `kid` (18 or over), who is played from now on: its name, its
// look (the one the app drew for it, checked), its age; three quarters of the money less the debts. The
// parent (unless gone: died) stays at home with the partner, both elders now. Returns the parent's name.
func (s *Sim) handDown(kidID string, look Look, died bool) (string, error) {
	f := s.fam()
	now := s.GameMinutes
	k := f.kid(kidID)
	if k == nil {
		return "", errNoKid
	}
	if st, _ := game.KidAgeAt(now - k.Born); st != game.StageAdulte {
		return "", errNoHeir
	}
	if err := look.validate(k.Gender); err != nil {
		return "", err
	}
	if s.Activity != nil {
		return "", game.ErrBusy
	}
	heir := *k
	old, oldGender, oldLook, years := s.FirstName, s.Gender, lookJSON(s.Look), f.Years
	kin := "maman"
	if oldGender == "homme" {
		kin = "papa"
	}
	if died {
		s.mourn(old, oldGender, oldLook, 0, years, false)
	} else {
		f.Elders = append(f.Elders, Elder{ID: fmt.Sprintf("e%d", now%1_000_000), Name: old, Gender: oldGender, Kin: kin, Look: oldLook, AdultAt: f.AdultAt, Stage: f.Stage, Years: years})
	}
	// The partner stays at home with the family, an elder too.
	if p := s.partnerHome(); p != nil {
		pk := "maman"
		if p.Gender == "homme" {
			pk = "papa"
		}
		f.Elders = append(f.Elders, Elder{ID: "e" + p.ID, Name: p.Name, Gender: p.Gender, Kin: pk, Look: p.Look, Seed: p.Seed, AdultAt: f.AdultAt})
		s.Friends = slices.DeleteFunc(s.Friends, func(x game.Friend) bool { return x.ID == p.ID })
	}
	// The parent's friends know the child a little; no romance comes down the generations.
	for i := range s.Friends {
		fr := &s.Friends[i]
		fr.Friendship, fr.Romance, fr.Partner, fr.Home, fr.Childhood = fr.Friendship/2, 0, false, false, false
	}
	heirMoney, rest := game.Inheritance(s.Money, s.Loan+s.RentArrears)
	s.Money, s.Loan, s.RentArrears = heirMoney, 0, 0
	// The child is the Sim now.
	s.FirstName, s.Gender, s.Look, s.Traits = heir.Name, heir.Gender, look, heir.Traits
	if len(s.Traits) == 0 {
		s.Traits = []string{"travailleur"}
	}
	s.BornAt = now - game.MinutesToAge(game.AdultAge) - 1
	s.Career, s.CareerLevel, s.Performance, s.AutoWork = "", 0, 0, false
	f.AdultAt = heir.Born + game.Childhood()
	f.Stage, f.Years = game.AdultAgeAt(now - f.AdultAt)
	f.Kids = slices.DeleteFunc(f.Kids, func(x Kid) bool { return x.ID == heir.ID })
	f.Generation++
	f.Last, f.Party, f.Visit, f.Arrival, f.Expecting, f.Tries = false, nil, nil, "", nil, 0
	f.Farewell = &Farewell{Name: old, Gender: oldGender, Look: oldLook, Years: years, Gone: died, Heir: heir.Name, Money: heirMoney, Rest: rest, At: now}
	// What the parent knew, a little of it taught; the elders at home are family.
	for k, v := range s.Life.Skills {
		s.Life.Skills[k] = v / 4
	}
	s.Life.Moodlets, s.Life.Wishes = nil, nil
	s.addMood("nouvelle-vie", "")
	if died {
		s.addMood("deuil", "")
	}
	return old, nil
}

// visitSync: the visitor on the way at the door, the one at the door gone if nobody opens, the one in gone
// home at their time; and now and then, someone dropping by unannounced.
func (s *Sim) visitSync(rng *rand.Rand) {
	f := s.fam()
	now := s.GameMinutes
	if v := f.Visit; v != nil {
		switch {
		case v.State == "route" && now >= v.At:
			v.State = "porte"
		case v.State == "porte" && now >= v.At+doorWait:
			f.Visit = nil
			if v.Kind == "invite" {
				s.pending = append(s.pending, Event{Kind: "social", Text: fmt.Sprintf("%s a frappé, personne n'a ouvert : rentré·e à la maison.", v.Name), GameTime: now})
			}
		case v.State == "dedans" && now >= v.Until:
			s.visitEnd()
		}
		return
	}
	if f.NextVisit == 0 {
		f.NextVisit = now + 60 + int64(rng.IntN(120))
		return
	}
	hour := game.HourOf(now)
	if now < f.NextVisit || hour < 9 || hour >= 20 || !s.atHome() || s.Activity != nil || s.parentsHome() || s.Housing == "" {
		return
	}
	f.NextVisit = now + 3*60 + int64(rng.IntN(4*60))
	if rng.Float64() < 0.5 {
		return
	}
	s.dropBy(rng)
}

// dropBy: a friend (or a neighbour) knocks, unannounced.
func (s *Sim) dropBy(rng *rand.Rand) {
	f := s.fam()
	now := s.GameMinutes
	var cands []*game.Friend
	for i := range s.Friends {
		x := &s.Friends[i]
		if !x.Enemy && !(x.Partner && x.Home) && x.Friendship >= 30 {
			cands = append(cands, x)
		}
	}
	if len(cands) > 0 && rng.Float64() < 0.7 {
		x := cands[rng.IntN(len(cands))]
		f.Visit = &Visit{Who: x.ID, Name: x.Name, Gender: x.Gender, Seed: x.Seed, Look: x.Look, Kind: "surprise", State: "porte", At: now}
		return
	}
	g := "femme"
	if rng.IntN(2) == 0 {
		g = "homme"
	}
	f.Visit = &Visit{Who: fmt.Sprintf("p-v%d", rng.IntN(1<<30)), Name: game.BabyName(g, rng), Gender: g, Seed: rng.IntN(1 << 30), Kind: "surprise", State: "porte", At: now}
}

// visitFriend: the Friend the visitor is (nil for a neighbour not yet met).
func (s *Sim) visitFriend() *game.Friend {
	v := s.fam().Visit
	if v == nil {
		return nil
	}
	for i := range s.Friends {
		if s.Friends[i].ID == v.Who {
			return &s.Friends[i]
		}
	}
	return nil
}

// invite: « Inviter à la maison »: a friend met in the game comes over (a call; they are there in a moment).
func (s *Sim) invite(who string) (game.Outcome, []Event, error) {
	f := s.fam()
	if f.Visit != nil {
		return game.Outcome{}, nil, errVisitBusy
	}
	var x *game.Friend
	for i := range s.Friends {
		if s.Friends[i].ID == who {
			x = &s.Friends[i]
		}
	}
	if x == nil || x.Enemy || (x.Partner && x.Home) {
		return game.Outcome{}, nil, errNotFriend
	}
	if s.parentsHome() {
		return game.Outcome{}, nil, errFamNotHome
	}
	now := s.GameMinutes
	f.Visit = &Visit{Who: x.ID, Name: x.Name, Gender: x.Gender, Seed: x.Seed, Look: x.Look, Kind: "invite", State: "route", At: now + invitedIn}
	text := fmt.Sprintf("%s arrive chez toi dans un instant.", x.Name)
	return game.Outcome{Text: text}, []Event{{Kind: "social", Text: fmt.Sprintf("Invité·e à la maison : %s.", x.Name), GameTime: now}}, nil
}

// openDoor: « Ouvrir la porte »: the visitor comes in, until their time to go (a neighbour is met: known now).
func (s *Sim) openDoor() (game.Outcome, []Event, error) {
	f := s.fam()
	v := f.Visit
	if v == nil || v.State != "porte" {
		return game.Outcome{}, nil, errNoVisit
	}
	if !s.atHome() {
		return game.Outcome{}, nil, errFamNotHome
	}
	now := s.GameMinutes
	v.State, v.Until = "dedans", now+visitStay
	if s.visitFriend() == nil && len(s.Friends) < game.MaxFriends {
		s.Friends = append(s.Friends, game.Friend{ID: v.Who, Name: v.Name, Gender: v.Gender, Seed: v.Seed, Commune: s.HomeCommune, Friendship: 20, Adult: true, Met: now, Seen: now})
	}
	if x := s.visitFriend(); x != nil {
		x.Friendship, x.Seen = min(100, x.Friendship+3), now
	}
	s.Needs = s.Needs.Add(game.Needs{Social: 8})
	text := fmt.Sprintf("%s entre : « Bonne arrivée ! » Repart vers %s.", v.Name, game.ClockLabel(v.Until))
	return game.Outcome{Text: text}, nil, nil
}

// sendAway: not opening (or seeing them off early): gone home; unannounced, they hardly mind.
func (s *Sim) sendAway() (game.Outcome, []Event, error) {
	f := s.fam()
	v := f.Visit
	if v == nil {
		return game.Outcome{}, nil, errNoVisit
	}
	if v.State == "dedans" {
		return s.visitEnd()
	}
	if x := s.visitFriend(); x != nil {
		hurt := 2
		if v.Kind == "invite" {
			hurt = 8
		}
		x.Friendship = max(0, x.Friendship-hurt)
	}
	f.Visit = nil
	text := fmt.Sprintf("Tu n'ouvres pas. %s repart.", v.Name)
	return game.Outcome{Text: text}, nil, nil
}

// visitEnd: the visitor goes home: the more they were looked after, the better the friendship and the mood.
func (s *Sim) visitEnd() (game.Outcome, []Event, error) {
	f := s.fam()
	v := f.Visit
	f.Visit = nil
	now := s.GameMinutes
	text := fmt.Sprintf("%s rentre chez soi. « Merci pour l'accueil ! »", v.Name)
	if len(v.Done) >= 2 {
		s.addMood("bonne-visite", "")
		if x := s.friendByID(v.Who); x != nil {
			x.Friendship = min(100, x.Friendship+5)
		}
		text = fmt.Sprintf("%s rentre chez soi, ravi·e : « On se refait ça vite ! »", v.Name)
	}
	return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: now}}, nil
}

// friendByID: the Friend of that id, if any.
func (s *Sim) friendByID(who string) *game.Friend {
	for i := range s.Friends {
		if s.Friends[i].ID == who {
			return &s.Friends[i]
		}
	}
	return nil
}

// host: something done for the visitor (game.HostActs), once a visit: its cost, its good, the friendship.
func (s *Sim) host(act string) (game.Outcome, []Event, error) {
	f := s.fam()
	v := f.Visit
	if v == nil || v.State != "dedans" {
		return game.Outcome{}, nil, errNoVisit
	}
	a, ok := game.FindHostAct(act)
	if !ok {
		return game.Outcome{}, nil, errors.New("action inconnue")
	}
	if slices.Contains(v.Done, act) {
		return game.Outcome{}, nil, errAlreadyHosted
	}
	if a.Cost > s.Money {
		return game.Outcome{}, nil, game.ErrNotEnoughMoney
	}
	s.Money -= a.Cost
	s.Needs = s.Needs.Add(a.Effect)
	v.Done = append(v.Done, act)
	gain := a.Friendship
	// Showing the house: the more comfortable it is, the more it pleases.
	if act == "visite" {
		gain += int(game.HomeComfort(s.Furnished) * 20)
	}
	if x := s.visitFriend(); x != nil {
		x.Friendship = min(100, x.Friendship+gain)
		s.addMood("bon-moment", x.Name)
	}
	if act == "dames" {
		s.Life.Skills = addSkill(s.Life.Skills, "logique", 2)
	}
	lines := map[string]string{
		"manger": "%s se régale : « Ah, tu cuisines bien hein ! »",
		"boire":  "%s trinque avec toi : « À la tienne ! »",
		"visite": "%s fait le tour de la maison : « C'est joli chez toi ! »",
		"dames":  "Une partie de dames avec %s : ça rigole, ça se chambre.",
	}
	text := fmt.Sprintf(lines[act], v.Name)
	return game.Outcome{Text: text, Money: -a.Cost}, nil, nil
}

func addSkill(m map[string]int, id string, n int) map[string]int {
	if m == nil {
		m = map[string]int{}
	}
	m[id] += n
	return m
}

// nameKid: the newborn (or any child of the house) given another first name.
func (s *Sim) nameKid(id, name string) error {
	k := s.fam().kid(id)
	if k == nil {
		return errNoKid
	}
	name = strings.TrimSpace(name)
	if n := len([]rune(name)); n < 2 || n > 20 || strings.ContainsAny(name, "<>{}/\\@") {
		return errBadName
	}
	k.Name = name
	return nil
}

// famRequest: what the app sends for a family action.
type famRequest struct {
	Kid  string `json:"kid"`
	Name string `json:"name"`
	Look Look   `json:"look"`
	On   bool   `json:"on"`
	Who  string `json:"who"`
	Act  string `json:"act"`
}

// famHandler: POST /sims/{id}/famille/{action} — bebe (try for a baby), nommer, fete (the birthday thrown),
// vu (a scene seen), douce (« vieillesse douce »), relais (« Passer à la génération suivante »), adieu (the
// senior's farewell: the heir takes over); and the visitors: inviter, ouvrir, refuser, accueil, raccompagner.
func (h *Handler) famHandler(w http.ResponseWriter, r *http.Request) {
	var req famRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	action := chi.URLParam(r, "action")
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if !s.lifeOn {
			return game.Outcome{}, nil, errLifeClosed
		}
		f := s.fam()
		switch action {
		case "bebe":
			return s.tryBaby(newRand())
		case "nommer":
			if err := s.nameKid(req.Kid, req.Name); err != nil {
				return game.Outcome{}, nil, err
			}
			if f.Arrival == req.Kid {
				f.Arrival = ""
			}
			return game.Outcome{}, nil, nil
		case "fete":
			p := f.Party
			if p == nil {
				return game.Outcome{}, nil, errNotYet
			}
			f.Party = nil
			s.Needs = s.Needs.Add(game.Needs{Social: 25, Fun: 25})
			s.addMood("anniversaire", "")
			text := fmt.Sprintf("Toute la famille chante pour %s : le gâteau, les bougies, les photos.", p.Name)
			return game.Outcome{Text: text}, []Event{{Kind: "life", Text: text, GameTime: s.GameMinutes}}, nil
		case "vu":
			f.Farewell = nil
			if f.Arrival != "" && f.kid(f.Arrival) == nil {
				f.Arrival = ""
			}
			return game.Outcome{}, nil, nil
		case "douce":
			f.Gentle = req.On
			f.Last = false
			text := "Vieillesse douce : la famille vieillit, mais personne ne s'en va."
			if !req.On {
				text = "La vie suit son cours : un jour, les anciens s'en iront paisiblement."
			}
			return game.Outcome{Text: text}, nil, nil
		case "relais", "adieu":
			died := action == "adieu"
			if died && !f.Last {
				return game.Outcome{}, nil, errNotYet
			}
			if !s.atHome() {
				return game.Outcome{}, nil, errFamNotHome
			}
			was := s.ID
			old, err := s.handDown(req.Kid, req.Look, died)
			if err != nil {
				return game.Outcome{}, nil, err
			}
			// Who is played changes: the name, the gender, the traits (not saved by mutate); no couple of
			// players, no romance comes down to the child.
			if _, err := tx.Exec(ctx, `UPDATE sims SET first_name = $2, gender = $3, traits = $4 WHERE id = $1`, was, s.FirstName, s.Gender, s.Traits); err != nil {
				return game.Outcome{}, nil, err
			}
			if other := inCouple(ctx, tx, was); other != "" {
				_ = insertEvent(ctx, tx, other, "social", fmt.Sprintf("%s a passé la main à la génération suivante : votre couple s'arrête là, avec tendresse.", old), 0, s.GameMinutes)
			}
			if _, err := tx.Exec(ctx, `UPDATE bonds SET couple = false, romance = 0 WHERE sim_a = $1 OR sim_b = $1`, was); err != nil {
				return game.Outcome{}, nil, err
			}
			_, _ = tx.Exec(ctx, `DELETE FROM couple_requests WHERE from_sim = $1 OR to_sim = $1`, was)
			fw := f.Farewell
			text := fmt.Sprintf("Génération suivante : %s reprend la maison de %s, avec %s.", s.FirstName, old, game.FCFA(fw.Money))
			if died {
				text = fmt.Sprintf("%s s'est éteint·e paisiblement, à %d ans. %s reprend la maison, avec %s.", old, fw.Years, s.FirstName, game.FCFA(fw.Money))
			}
			return game.Outcome{Text: text, Money: 0}, []Event{{Kind: "life", Text: text, Money: 0, GameTime: s.GameMinutes}}, nil
		case "calin":
			// A moment with a child or an elder of the house: a hug, a game, the old stories.
			name := ""
			if k := f.kid(req.Who); k != nil {
				name = k.Name
			}
			for _, e := range f.Elders {
				if e.ID == req.Who {
					name = e.Name
				}
			}
			if name == "" {
				return game.Outcome{}, nil, errNoKid
			}
			s.Needs = s.Needs.Add(game.Needs{Social: 12, Fun: 8})
			s.addMood("bon-moment", name)
			return game.Outcome{Text: fmt.Sprintf("Un bon moment avec %s.", name)}, nil, nil
		case "inviter":
			return s.invite(req.Who)
		case "ouvrir":
			return s.openDoor()
		case "refuser", "raccompagner":
			return s.sendAway()
		case "accueil":
			return s.host(req.Act)
		}
		return game.Outcome{}, nil, errors.New("action inconnue")
	})
}

// testerFam: the testers' shortcuts through the years (tester.go): the next part of adult life, the baby's
// day, the children a stage older, a neighbour at the door. ok false: not one of them.
func (s *Sim) testerFam(action string) (evs []Event, ok bool, err error) {
	f := s.fam()
	now := s.GameMinutes
	text := ""
	switch action {
	case "vieillir":
		if s.BornAt != 0 && s.age() < game.AdultAge {
			return nil, true, game.ErrTooYoung
		}
		if f.AdultAt == 0 {
			f.AdultAt = now
		}
		lived := now - f.AdultAt
		j, a := game.Days(game.Spans.Jeune), game.Days(game.Spans.Adulte)
		switch {
		case lived < j:
			f.AdultAt = now - j
		case lived < j+a:
			f.AdultAt = now - j - a
		default:
			f.AdultAt = now - game.LifeEnd()
		}
		text = "Testeur : le temps passe d'un coup."
	case "grossesse":
		if f.Expecting == nil {
			return nil, true, errNotYet
		}
		f.Expecting.Due = now
		text = "Testeur : le bébé arrive maintenant."
	case "enfants":
		for i := range f.Kids {
			k := &f.Kids[i]
			lived := now - k.Born
			for _, d := range []int64{game.Days(game.Spans.Bebe), game.Days(game.Spans.Bebe + game.Spans.Enfant), game.Childhood()} {
				if lived < d {
					k.Born = now - d
					break
				}
			}
		}
		text = "Testeur : les enfants grandissent d'une étape."
	case "visite":
		f.Visit = nil
		s.dropBy(newRand())
		text = "Testeur : on frappe à la porte."
	default:
		return nil, false, nil
	}
	return []Event{{Kind: "life", Text: text, GameTime: now}}, true, nil
}
