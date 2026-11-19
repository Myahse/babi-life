package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"math/rand/v2"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// L'héritage (the update « heritage », game/heritage.go; web screens/FamilleApp.tsx, components/heritage/).
// The sims row is the lineage: the heir takes the same row over, so the lots, the buildings, the vehicles,
// the quartier and the shop's purchases never move (no Djai goes between rows or accounts). On top of le mode
// vie's generations (famille.go, which it runs even with le mode vie shut):
//   - the family's ages go by in hours played (game.HeirSpans): a pause holds them (holdFamily, from hold);
//     the Sims there before the update are aged from their time played, once (heritageTurn);
//   - the heir is a child of 18, an adopted one (the orphanage's « adopter-orphelinat »), or else a nephew
//     or niece who carries the name;
//   - the passation (« Passer la main », from 60, or from 50 with 3 jalons, at least 21 real days a
//     generation): the succession duties, the heir's share, the elder's pot, the papers ended, the skills
//     taught, the friends become tontons, the family's tier and renom; one row of family_generations;
//   - the elders: advice, a weekly blessing paid from their pot only (the day's « famille » limit), a visit.

// heirClock: Famille.Clock once the family's ages go by in hours played.
const heirClock = "jeu"

var (
	errHeirAge     = errors.New("pas encore : la main se passe à 60 ans, ou dès 50 ans avec 3 jalons sur 5")
	errHeirFloor   = errors.New("une génération dure au moins 21 jours : reviens plus tard pour passer la main")
	errHeirOffice  = errors.New("tu as un mandat en cours : termine-le avant de passer la main")
	errHeirStake   = errors.New("une partie avec mise est en cours : termine-la avant de passer la main")
	errHeirNeveu   = errors.New("un neveu ou une nièce ne reprend la maison que s'il n'y a pas d'enfant de 18 ans")
	errHeirGen     = errors.New("la page n'est pas à jour : rouvre « Ma famille »")
	errElderNone   = errors.New("pas d'ancien de ce nom à la maison")
	errBlessed     = errors.New("déjà béni·e cette semaine : reviens dans quelques jours")
	errPotEmpty    = errors.New("sa cagnotte est vide : sa bénédiction, c'est de bon cœur")
	errVillage     = errors.New("parti·e se reposer au village : on ne lui rend plus visite")
	errVisitedJust = errors.New("tu viens de passer du temps avec lui ou elle")
	errAdoptAge    = errors.New("il faut avoir 25 ans pour adopter")
)

func heritageOpen(ctx context.Context) bool {
	return features.Default != nil && features.Default.BlocksKey(ctx, game.HeritageKey) == ""
}

// holdFamily: the time held for the Sim (hold) held for its family too: its ages, its children's, the
// baby on its way, the elders', the next visit. Only once the family's clock is the time played.
func (s *Sim) holdFamily(minutes int64) {
	f := s.Life.Famille
	if !s.heritageOn || f == nil || f.Clock != heirClock || minutes <= 0 {
		return
	}
	if f.AdultAt != 0 {
		f.AdultAt += minutes
	}
	for i := range f.Kids {
		f.Kids[i].Born += minutes
	}
	if e := f.Expecting; e != nil {
		e.Since += minutes
		e.Due += minutes
	}
	for i := range f.Elders {
		f.Elders[i].AdultAt += minutes
		if f.Elders[i].Visited != 0 {
			f.Elders[i].Visited += minutes
		}
	}
	if f.NextVisit != 0 {
		f.NextVisit += minutes
	}
}

// heritageTurn: the update reaching an adult Sim for the first time: its family's clock made the time
// played. A Sim of le mode vie keeps its ages (and its children's, its elders'); any other is as old as its
// account's time played makes it (a year every 40 minutes, 40 at most). Its 21 days start now.
func heritageTurn(ctx context.Context, tx pgx.Tx, s *Sim, user string) error {
	if !s.heritageOn || s.minor() || (s.Life.Famille != nil && s.Life.Famille.Clock == heirClock) {
		return nil
	}
	f := s.fam()
	now := s.GameMinutes
	sp, old := game.HeirSpans, game.Spans
	if f.AdultAt > 0 {
		_, y := old.AdultAgeAt(now - f.AdultAt)
		f.AdultAt = now - sp.LivedFor(y)
	} else {
		var played int64
		if err := tx.QueryRow(ctx, `SELECT play_seconds FROM users WHERE id = $1`, user).Scan(&played); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		f.AdultAt = now - sp.LivedFor(game.VeteranAge(played))
	}
	for i := range f.Kids {
		k := &f.Kids[i]
		lived := now - k.Born
		if lived < old.Childhood() {
			k.Born = now - lived*sp.Childhood()/max(1, old.Childhood())
		} else {
			_, y := old.AdultAgeAt(lived - old.Childhood())
			k.Born = now - sp.Childhood() - sp.LivedFor(y)
		}
		k.Stage, k.Years = sp.KidAgeAt(now - k.Born)
	}
	if e := f.Expecting; e != nil {
		left := max(0, e.Due-now) * game.Days(sp.Grossesse) / max(1, game.Days(old.Grossesse))
		e.Since, e.Due = now+left-game.Days(sp.Grossesse), now+left
	}
	for i := range f.Elders {
		el := &f.Elders[i]
		_, y := old.AdultAgeAt(now - el.AdultAt)
		el.AdultAt = now - sp.LivedFor(y)
	}
	f.Stage, f.Years = sp.AdultAgeAt(now - f.AdultAt)
	f.Clock = heirClock
	_, err := tx.Exec(ctx, `UPDATE sims SET generation_since = now() WHERE id = $1`, s.ID)
	return err
}

// heritageFacts: what the jalons, the renom and the passation read from the database.
type heritageFacts struct {
	generation, renom        int
	since                    time.Time
	lots, lotsPaid, vehicles int
	estates                  []string
	qBuildings2, qLevel      int
	married, stake           bool
	office                   string // the office held now ("" none): « maire:cocody »…
	won                      []string
}

func readFacts(ctx context.Context, q rowQuerier, s *Sim) (heritageFacts, error) {
	var fx heritageFacts
	err := q.QueryRow(ctx, `
		SELECT s.generation, s.renom, s.generation_since,
		       (SELECT count(*) FROM plots WHERE sim_id = s.id AND lot_w > 0),
		       (SELECT coalesce(sum(lot_paid), 0) FROM plots WHERE sim_id = s.id AND lot_w > 0),
		       (SELECT count(*) FROM vehicles WHERE sim_id = s.id),
		       coalesce((SELECT array_agg(plan) FROM estates WHERE sim_id = s.id), '{}'),
		       (SELECT count(*) FROM quartier_buildings WHERE sim_id = s.id AND level >= 2),
		       coalesce((SELECT level FROM quartiers WHERE sim_id = s.id), 0),
		       EXISTS (SELECT 1 FROM documents WHERE sim_id = s.id AND kind = $2 AND NOT ended),
		       EXISTS (SELECT 1 FROM pvp_stakes WHERE sim = s.id),
		       coalesce((SELECT office FROM offices WHERE sim_id = s.id AND until > now() ORDER BY since LIMIT 1), ''),
		       coalesce((SELECT array_agg(kind) FROM elections WHERE winner = s.id AND settled AND closes_at > s.generation_since), '{}')
		FROM sims s WHERE s.id = $1`, s.ID, game.DocMariage).
		Scan(&fx.generation, &fx.renom, &fx.since, &fx.lots, &fx.lotsPaid, &fx.vehicles, &fx.estates, &fx.qBuildings2, &fx.qLevel, &fx.married, &fx.stake, &fx.office, &fx.won)
	return fx, err
}

// netWorth: the money less the debts, the lots at what they cost, the buildings at their plan's price.
func (fx heritageFacts) netWorth(s *Sim) int {
	w := s.Money - s.Loan - s.RentArrears + fx.lotsPaid
	for _, p := range fx.estates {
		w += game.HomePlans[p].Cost
	}
	return w
}

// bestOffice: the highest office of the generation (held now, or an election won since it began).
func (fx heritageFacts) bestOffice() string {
	best := ""
	try := func(o string) {
		o, _, _ = strings.Cut(o, ":")
		if game.OfficeRenom[o] > game.OfficeRenom[best] {
			best = o
		}
	}
	try(fx.office)
	for _, k := range fx.won {
		try(k)
	}
	return best
}

func (s *Sim) familyStart() int {
	if fam, ok := game.FindFamily(s.Family); ok {
		return fam.Start
	}
	return game.Families[len(game.Families)-1].Start
}

// jalons: the five goals of the generation, read now.
func (s *Sim) jalons(fx heritageFacts) []game.Jalon {
	close := 0
	for _, fr := range s.Friends {
		if fr.Friendship >= 60 && !fr.Enemy {
			close++
		}
	}
	f := s.fam()
	return game.Jalons(game.JalonsIn{
		Lots: fx.lots, OwnHouse: s.Housing == game.OwnHouse, Estates: len(fx.estates), QuartierBuildings2: fx.qBuildings2, CareerLevel: s.CareerLevel,
		NetWorth: fx.netWorth(s), Start: s.familyStart(), Office: fx.bestOffice() != "", CloseFriends: close,
		Married: fx.married, PartnerHome: s.partnerHome() != nil, Kids: len(f.Kids),
	})
}

// renomIn: what the generation leaves, for its renom.
func (s *Sim) renomIn(fx heritageFacts, neveu bool) game.RenomIn {
	e := s.Life.Etudes
	return game.RenomIn{
		NetWorth: fx.netWorth(s), Lots: fx.lots, Buildings: len(fx.estates) + fx.qBuildings2, CareerLevel: s.CareerLevel,
		Kids: len(s.fam().Kids), QuartierLevel: fx.qLevel, Years: s.fam().Years, Office: fx.bestOffice(),
		Bac: e != nil && (e.BAC != nil || e.ReBAC != nil), Sup: e != nil && len(e.Diplomes) > 0, Married: fx.married, Neveu: neveu,
	}
}

// HeirOption: someone who could take the house over.
type HeirOption struct {
	ID     string `json:"id"`
	Kind   string `json:"kind"` // enfant | adopte | neveu
	Label  string `json:"label"`
	Name   string `json:"name"`
	Gender string `json:"gender"`
	Seed   int    `json:"seed"`
	Years  int    `json:"years"`
	Share  int    `json:"share"`
}

// neveuSeed: the nephew or niece of a generation, the same on every ask.
func neveuSeed(id string, gen int) uint64 {
	h := fnv.New64a()
	h.Write([]byte(id + ":neveu:" + strconv.Itoa(gen)))
	return h.Sum64()
}

// heirOptions: the children of 18 and over (eldest first); none, the nephew or niece.
func (s *Sim) heirOptions(gen int) []HeirOption {
	f := s.fam()
	sp := s.spans()
	var out []HeirOption
	kids := slices.Clone(f.Kids)
	slices.SortFunc(kids, func(a, b Kid) int { return int(a.Born - b.Born) })
	for _, k := range kids {
		st, y := sp.KidAgeAt(s.GameMinutes - k.Born)
		if st != game.StageAdulte {
			continue
		}
		kind := game.HeirEnfant
		if k.Adopted {
			kind = game.HeirAdopte
		}
		out = append(out, HeirOption{ID: k.ID, Kind: kind, Label: game.HeirKindLabel(kind, k.Gender), Name: k.Name, Gender: k.Gender, Seed: k.Seed, Years: y, Share: game.HeirShare})
	}
	if len(out) == 0 {
		seed := neveuSeed(s.ID, gen)
		name, gender := game.NeveuName(seed)
		out = append(out, HeirOption{ID: game.HeirNeveu, Kind: game.HeirNeveu, Label: game.HeirKindLabel(game.HeirNeveu, gender), Name: name, Gender: gender, Seed: int(seed % (1 << 30)), Years: game.AdultAge, Share: game.NeveuShare})
	}
	return out
}

// passationBlock: why the house can't be handed down now (nil: it can).
func (s *Sim) passationBlock(fx heritageFacts, now time.Time) error {
	switch {
	case s.Activity != nil:
		return game.ErrBusy
	case s.Prison != nil:
		return errInPrison
	case fx.office != "":
		return errHeirOffice
	case fx.stake:
		return errHeirStake
	case now.Sub(fx.since) < game.GenerationFloor:
		return errHeirFloor
	}
	years := s.fam().Years
	if years >= game.PassationAge || (years >= game.PassationEarly && game.JalonsDone(s.jalons(fx)) >= game.JalonsEarly) {
		return nil
	}
	return errHeirAge
}

// HeritagePreview: what the passation would give now, to the first heir.
type HeritagePreview struct {
	NetWorth int    `json:"netWorth"`
	Estate   int    `json:"estate"`
	Fee      int    `json:"fee"`
	Heir     int    `json:"heir"`
	Pot      int    `json:"pot"`
	Share    int    `json:"share"`
	TierFrom string `json:"tierFrom"`
	TierTo   string `json:"tierTo"`
	Renom    int    `json:"renom"`
}

func (s *Sim) preview(fx heritageFacts, heir HeirOption) HeritagePreview {
	estate := s.Money - s.Loan - s.RentArrears
	h, pot, fee := game.Split(estate, heir.Share)
	worth := fx.netWorth(s)
	return HeritagePreview{NetWorth: worth, Estate: estate, Fee: fee, Heir: h, Pot: pot, Share: heir.Share, TierFrom: s.Family, TierTo: game.TierAfter(s.Family, worth), Renom: game.Renom(s.renomIn(fx, heir.Kind == game.HeirNeveu))}
}

// PassationCard: the ceremony's summary (Famille.Passation), shown once.
type PassationCard struct {
	Gen       int             `json:"gen"`
	Old       string          `json:"old"`
	OldGender string          `json:"oldGender"`
	OldLook   json.RawMessage `json:"oldLook,omitempty"`
	Years     int             `json:"years"`
	Heir      string          `json:"heir"`
	HeirKind  string          `json:"heirKind"`
	Estate    int             `json:"estate"`
	Fee       int             `json:"fee"`
	Money     int             `json:"money"`
	Pot       int             `json:"pot"`
	TierFrom  string          `json:"tierFrom"`
	TierTo    string          `json:"tierTo"`
	Renom     int             `json:"renom"`
	Total     int             `json:"total"`
	Lots      int             `json:"lots"`
	Estates   int             `json:"estates"`
	Vehicles  int             `json:"vehicles"`
	At        int64           `json:"at"`
}

// personalPapers: the documents that were the parent's own, ended at the passation (the heir gets their
// own: the BEPC and the bac retaken, their card, their licence).
var personalPapers = []string{game.DocBEPC, game.DocBAC, game.DocDiplome, game.DocCNI, game.DocPermis, game.DocTravail, game.DocMariage}

// passation: the house handed down to `heirID` (a child's id, or « neveu »), the heir's look checked.
func (s *Sim) passation(ctx context.Context, tx pgx.Tx, fx heritageFacts, heirID string, look Look, rng *rand.Rand) (game.Outcome, []Event, error) {
	if err := s.passationBlock(fx, time.Now()); err != nil {
		return game.Outcome{}, nil, err
	}
	f := s.fam()
	now := s.GameMinutes
	sp := s.spans()
	opts := s.heirOptions(fx.generation)
	i := slices.IndexFunc(opts, func(o HeirOption) bool { return o.ID == heirID })
	if i < 0 {
		if heirID == game.HeirNeveu {
			return game.Outcome{}, nil, errHeirNeveu
		}
		return game.Outcome{}, nil, errNoHeir
	}
	pick := opts[i]
	neveu := pick.Kind == game.HeirNeveu
	var heir Kid
	if neveu {
		heir = Kid{ID: game.HeirNeveu, Name: pick.Name, Gender: pick.Gender, Seed: pick.Seed, Born: now - sp.Childhood(), Traits: game.BabyTraits(s.Traits, rng)}
	} else {
		heir = *f.kid(pick.ID)
	}
	if err := look.validate(heir.Gender); err != nil {
		return game.Outcome{}, nil, err
	}
	// What the generation leaves, read before the heir is in.
	worth := fx.netWorth(s)
	estate := s.Money - s.Loan - s.RentArrears
	heirMoney, pot, fee := game.Split(estate, pick.Share)
	var feats []string
	for _, j := range s.jalons(fx) {
		if j.Done {
			feats = append(feats, j.ID)
		}
	}
	gain := game.Renom(s.renomIn(fx, neveu))
	old, oldGender, oldLook, years, tier, began := s.FirstName, s.Gender, lookJSON(s.Look), f.Years, s.Family, fx.since
	best, bestPts := "", 0
	for k, v := range s.Life.Skills {
		if v > bestPts || (v == bestPts && k < best) {
			best, bestPts = k, v
		}
	}
	n := len(f.Elders)
	if _, err := s.handTo(heir, look, false, heirMoney, pot); err != nil {
		return game.Outcome{}, nil, err
	}
	gen := fx.generation + 1
	// The elders: the parent with their pot, the partner who stayed; two generations up, off to the village.
	for j := n; j < len(f.Elders); j++ {
		f.Elders[j].Gen = fx.generation
	}
	if len(f.Elders) > n {
		f.Elders[n].Pot = pot
	}
	for j := range f.Elders {
		if e := &f.Elders[j]; e.Gen > 0 && e.Gen <= gen-2 && !e.Village {
			e.Village = true
			s.pending = append(s.pending, Event{Kind: "life", Text: fmt.Sprintf("%s part se reposer au village : sa photo reste au salon, et on l'appelle le dimanche.", e.Name), GameTime: now})
		}
	}
	// The parent's friends: the heir's « tontons » and « tatas » now (handTo halved the friendship).
	for j := range s.Friends {
		if fr := &s.Friends[j]; !fr.Enemy {
			fr.Friendship, fr.Tonton = max(30, fr.Friendship), true
		}
	}
	// The best skill taught by half, the others by a quarter (handTo).
	if best != "" {
		s.Life.Skills[best] = bestPts / 2
	}
	s.Family = game.TierAfter(tier, worth)
	s.Life.Etudes = nil
	s.Gang, s.Record = "", 0
	f.Generation = fx.generation
	f.FirstJob = fx.renom+gain >= game.FirstJobRenom
	// « Heritage »'s own ceremony (components/heritage/PassationScene.tsx) instead of le mode vie's.
	f.Farewell = nil
	f.Passation = &PassationCard{Gen: gen, Old: old, OldGender: oldGender, OldLook: oldLook, Years: years, Heir: heir.Name, HeirKind: pick.Kind, Estate: max(0, estate), Fee: fee, Money: heirMoney, Pot: pot,
		TierFrom: tier, TierTo: s.Family, Renom: gain, Total: fx.renom + gain, Lots: fx.lots, Estates: len(fx.estates), Vehicles: fx.vehicles, At: now}
	// The papers: the parent's own ended; the heir's extrait; the title deeds and the cartes grises in the heir's name.
	if _, err := tx.Exec(ctx, `UPDATE documents SET ended = true WHERE sim_id = $1 AND NOT ended AND kind = ANY($2)`, s.ID, personalPapers); err != nil {
		return game.Outcome{}, nil, err
	}
	s.papers = append(s.papers, s.extraitPaper(paperRenew))
	s.paperSync = true
	if _, err := tx.Exec(ctx, `UPDATE sims SET first_name = $2, gender = $3, traits = $4, generation = $5, renom = renom + $6, generation_since = now() WHERE id = $1`, s.ID, s.FirstName, s.Gender, s.Traits, gen, gain); err != nil {
		return game.Outcome{}, nil, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO family_generations (sim_id, n, first_name, gender, look, family_tier, years, heir_kind, estate, fee, inherited, elder_pot, renom, feats, began_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`, s.ID, fx.generation, old, oldGender, oldLook, tier, years, pick.Kind, max(0, estate), fee, heirMoney, pot, gain, featsOrEmpty(feats), began); err != nil {
		return game.Outcome{}, nil, err
	}
	// Mon quartier's reputation is the parent's: half of it comes down.
	if _, err := tx.Exec(ctx, `UPDATE quartiers SET reputation = reputation / 2 WHERE sim_id = $1`, s.ID); err != nil {
		return game.Outcome{}, nil, err
	}
	// No couple of players, no romance comes down to the heir.
	if other := inCouple(ctx, tx, s.ID); other != "" {
		_ = insertEvent(ctx, tx, other, "social", fmt.Sprintf("%s a passé la main à la génération suivante : votre couple s'arrête là, avec tendresse.", old), 0, now)
	}
	if _, err := tx.Exec(ctx, `UPDATE bonds SET couple = false, romance = 0 WHERE sim_a = $1 OR sim_b = $1`, s.ID); err != nil {
		return game.Outcome{}, nil, err
	}
	_, _ = tx.Exec(ctx, `DELETE FROM couple_requests WHERE from_sim = $1 OR to_sim = $1`, s.ID)
	text := fmt.Sprintf("%s : %s reprend la maison de %s, avec %s.", game.GenerationLabel(gen), s.FirstName, old, game.FCFA(heirMoney))
	if fee > 0 {
		text += fmt.Sprintf(" Droits de succession : %s.", game.FCFA(fee))
	}
	if pot > 0 {
		text += fmt.Sprintf(" La cagnotte de %s : %s.", old, game.FCFA(pot))
	}
	return game.Outcome{Text: text}, []Event{{Kind: "life", Text: text, GameTime: now}}, nil
}

func featsOrEmpty(f []string) []string {
	if f == nil {
		return []string{}
	}
	return f
}

// elderAct: what one does with an elder: advice, a blessing (once a real week, from their pot only,
// within the day's « famille » limit), a visit (not once gone to the village).
func (s *Sim) elderAct(id, act string, now time.Time, rng *rand.Rand) (game.Outcome, []Event, error) {
	f := s.fam()
	i := slices.IndexFunc(f.Elders, func(e Elder) bool { return e.ID == id })
	if i < 0 {
		return game.Outcome{}, nil, errElderNone
	}
	e := &f.Elders[i]
	switch act {
	case "conseil":
		s.Needs = s.Needs.Add(game.Needs{Social: 6})
		return game.Outcome{Text: fmt.Sprintf("%s : « %s »", e.Name, game.ElderWords(rng))}, nil, nil
	case "benediction":
		if e.Blessed > 0 && now.Sub(time.Unix(e.Blessed, 0)) < game.BlessingEvery {
			return game.Outcome{}, nil, errBlessed
		}
		if e.Pot <= 0 {
			return game.Outcome{}, nil, errPotEmpty
		}
		would := min(game.BlessingMax, e.Pot)
		got := s.earn(game.FromFamille, would)
		if got <= 0 {
			return game.Outcome{}, nil, errors.New(game.Full(game.FromFamille))
		}
		e.Pot -= got
		e.Blessed = now.Unix()
		s.Needs = s.Needs.Add(game.Needs{Social: 10, Fun: 10})
		s.addMood("benediction", "")
		text := capNote(fmt.Sprintf("%s pose la main sur ta tête et te bénit : « Que Dieu te garde. » Et te glisse %s de sa cagnotte.", e.Name, game.FCFA(got)), game.FromFamille, got, would)
		return game.Outcome{Text: text, Money: got}, []Event{{Kind: "money", Text: text, Money: got, GameTime: s.GameMinutes}}, nil
	case "visite":
		if e.Village {
			return game.Outcome{}, nil, errVillage
		}
		if e.Visited != 0 && s.GameMinutes-e.Visited < 60 {
			return game.Outcome{}, nil, errVisitedJust
		}
		e.Visited = s.GameMinutes
		s.Needs = s.Needs.Add(game.Needs{Social: 15, Fun: 8})
		s.addMood("bon-moment", e.Name)
		return game.Outcome{Text: fmt.Sprintf("Un après-midi avec %s : le thé, les vieilles photos, les histoires d'avant.", e.Name)}, nil, nil
	}
	return game.Outcome{}, nil, errors.New("action inconnue")
}

// elderMentor: from the second generation, the parent at home is the mentor (mentor.go): their name and
// voice, the family's mentor's hand. ok false: the family's mentor as before.
func (s *Sim) elderMentor(generation int) (game.Mentor, bool) {
	m := game.MentorOf(s.Family)
	if !s.heritageOn || generation < 2 || s.Life.Famille == nil {
		return m, false
	}
	for i := len(s.Life.Famille.Elders) - 1; i >= 0; i-- {
		e := s.Life.Famille.Elders[i]
		if e.Village || e.Gen != generation-1 {
			continue
		}
		title := "Ta mère, l'ancienne de la famille"
		if e.Kin == "papa" {
			title = "Ton père, l'ancien de la famille"
		}
		return game.Mentor{Family: m.Family, Name: e.Name, Gender: e.Gender, Title: title, Intro: "La maison est à toi maintenant. Je suis là, à côté : viens me demander quand tu veux.", Help: m.Help}, true
	}
	return m, false
}

// heritageBefore: the orphanage's adoption: what it asks, before the dossier is paid.
func heritageBefore(ctx context.Context, tx pgx.Tx, s *Sim, interaction string) error {
	if interaction != game.AdoptID {
		return nil
	}
	if !s.heritageOn {
		return errLifeClosed
	}
	f := s.fam()
	switch {
	case s.minor() || f.Years < game.AdoptAge:
		return errAdoptAge
	case f.Expecting != nil:
		return errExpecting
	case len(f.Kids) >= maxKids:
		return errTooManyKids
	}
	if papersOpen(ctx) && !hasPaper(ctx, tx, s.ID, game.DocCNI) {
		return errNeedCNI
	}
	return nil
}

// heritageStart: the dossier accepted (the adoption started): the child arrives at home an hour played on.
func (s *Sim) heritageStart(it game.Interaction) string {
	if it.ID != game.AdoptID || !s.heritageOn {
		return ""
	}
	sp := s.spans()
	f := s.fam()
	f.Expecting = &Expecting{Since: s.GameMinutes, Due: s.GameMinutes + game.Days(sp.Grossesse), Adopt: true}
	return fmt.Sprintf(" Dossier accepté : l'enfant arrive à la maison dans %s de jeu.", humanDays(sp.Grossesse))
}

// HeritageState: GET /sims/{id}/heritage.
type HeritageState struct {
	Generation int              `json:"generation"`
	Renom      int              `json:"renom"`
	Since      time.Time        `json:"since"`
	FloorAt    time.Time        `json:"floorAt"`
	Stage      string           `json:"stage"`
	Years      int              `json:"years"`
	Jalons     []game.Jalon     `json:"jalons"`
	Done       int              `json:"done"`
	Can        bool             `json:"can"`
	Why        string           `json:"why,omitempty"`
	Nudge      string           `json:"nudge,omitempty"`
	Heirs      []HeirOption     `json:"heirs"`
	Preview    HeritagePreview  `json:"preview"`
	Elders     []ElderView      `json:"elders"`
	History    []GenerationRow  `json:"history"`
	Mentor     *game.Mentor     `json:"mentor,omitempty"`
	Played     map[string]int64 `json:"played"`
}

// ElderView: an elder with when they can bless again (seconds; 0: now).
type ElderView struct {
	Elder
	BlessIn int64 `json:"blessIn"`
}

// GenerationRow: a generation handed down (family_generations).
type GenerationRow struct {
	N        int             `json:"n"`
	Name     string          `json:"name"`
	Gender   string          `json:"gender"`
	Look     json.RawMessage `json:"look"`
	Tier     string          `json:"tier"`
	Years    int             `json:"years"`
	HeirKind string          `json:"heirKind"`
	Estate   int             `json:"estate"`
	Fee      int             `json:"fee"`
	Heir     int             `json:"heir"`
	Pot      int             `json:"pot"`
	Renom    int             `json:"renom"`
	Feats    []string        `json:"feats"`
	Began    time.Time       `json:"began"`
	Retired  time.Time       `json:"retired"`
}

// heritageState: the state « Ma famille » shows, read (nothing saved).
func (s *Sim) heritageState(fx heritageFacts, now time.Time) HeritageState {
	f := s.fam()
	js := s.jalons(fx)
	st := HeritageState{Generation: fx.generation, Renom: fx.renom, Since: fx.since, FloorAt: fx.since.Add(game.GenerationFloor), Stage: f.Stage, Years: f.Years, Jalons: js, Done: game.JalonsDone(js), Heirs: s.heirOptions(fx.generation), Elders: []ElderView{}, History: []GenerationRow{}}
	if err := s.passationBlock(fx, now); err != nil {
		st.Why = err.Error()
	} else {
		st.Can = true
	}
	switch {
	case f.Years >= 70:
		st.Nudge = "Après 70 ans, la génération ne rapporte plus qu'un quart de sa renommée : il est temps de passer la main."
	case f.Years > game.PassationAge+1:
		st.Nudge = "Après 60 ans, la génération ne rapporte plus que la moitié de sa renommée."
	}
	st.Preview = s.preview(fx, st.Heirs[0])
	for _, e := range f.Elders {
		v := ElderView{Elder: e}
		if e.Blessed > 0 {
			v.BlessIn = max(0, int64((game.BlessingEvery - now.Sub(time.Unix(e.Blessed, 0))).Seconds()))
		}
		st.Elders = append(st.Elders, v)
	}
	if m, ok := s.elderMentor(fx.generation); ok {
		st.Mentor = &m
	}
	// How long each part of life lasts, in minutes played (the app's countdowns).
	sp := s.spans()
	st.Played = map[string]int64{"jeune": game.Days(sp.Jeune), "adulte": game.Days(sp.Adulte), "senior": game.Days(sp.Senior), "lived": max(0, s.GameMinutes-f.AdultAt), "early": sp.LivedFor(game.PassationEarly), "normal": sp.LivedFor(game.PassationAge)}
	return st
}

// readHistory: the generations handed down, the first first.
func readHistory(ctx context.Context, db interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, simID string) []GenerationRow {
	out := []GenerationRow{}
	rows, err := db.Query(ctx, `SELECT n, first_name, gender, look, family_tier, years, heir_kind, estate, fee, inherited, elder_pot, renom, feats, began_at, retired_at FROM family_generations WHERE sim_id = $1 ORDER BY n`, simID)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var g GenerationRow
		var estate, fee, heir, pot int64
		if rows.Scan(&g.N, &g.Name, &g.Gender, &g.Look, &g.Tier, &g.Years, &g.HeirKind, &estate, &fee, &heir, &pot, &g.Renom, &g.Feats, &g.Began, &g.Retired) == nil {
			g.Estate, g.Fee, g.Heir, g.Pot = int(estate), int(fee), int(heir), int(pot)
			out = append(out, g)
		}
	}
	return out
}

// heritageGet: GET /sims/{id}/heritage.
func (h *Handler) heritageGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !heritageOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, errLifeClosed.Error())
		return
	}
	s, err := scanSim(h.DB.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(ctx)))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	s.heritageOn = true
	fx, err := readFacts(ctx, h.DB, &s)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	st := s.heritageState(fx, time.Now())
	st.History = readHistory(ctx, h.DB, s.ID)
	httpx.JSON(w, http.StatusOK, st)
}

// heritagePassation: POST /sims/{id}/heritage/passation {heir, look, gen}. gen is the generation the app
// saw: sent again once done (the answer lost on the way), nothing is done twice.
func (h *Handler) heritagePassation(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Heir string `json:"heir"`
		Look Look   `json:"look"`
		Gen  int    `json:"gen"`
	}
	if err := httpx.Decode(r, &req); err != nil || req.Gen < 1 {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if !s.heritageOn {
			return game.Outcome{}, nil, errLifeClosed
		}
		fx, err := readFacts(ctx, tx, s)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		switch {
		case req.Gen < fx.generation:
			return game.Outcome{Text: "C'est fait : la maison est déjà passée à la génération suivante."}, nil, nil
		case req.Gen > fx.generation:
			return game.Outcome{}, nil, errHeirGen
		}
		return s.passation(ctx, tx, fx, req.Heir, req.Look, newRand())
	})
}

// heritageElder: POST /sims/{id}/heritage/ancien/{elder}/{act}: conseil | benediction | visite | vu (the ceremony seen).
func (h *Handler) heritageElder(w http.ResponseWriter, r *http.Request) {
	elder, act := chi.URLParam(r, "elder"), chi.URLParam(r, "act")
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if !s.heritageOn {
			return game.Outcome{}, nil, errLifeClosed
		}
		if act == "vu" {
			s.fam().Passation = nil
			return game.Outcome{}, nil, nil
		}
		return s.elderAct(elder, act, time.Now(), newRand())
	})
}

// FamilyRank: a family in the great families' ranking.
type FamilyRank struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	LastName   string `json:"lastName"`
	Generation int    `json:"generation"`
	Renom      int    `json:"renom"`
	Rank       int    `json:"rank,omitempty"`
}

// heritageRanking: GET /sims/{id}/heritage/classement: the ten families of the highest renom (the testers
// left out), and the Sim's own with its place.
func (h *Handler) heritageRanking(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !heritageOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, errLifeClosed.Error())
		return
	}
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	rows, err := h.DB.Query(ctx, `
		SELECT s.id, s.first_name, s.last_name, s.generation, s.renom
		FROM sims s JOIN users u ON u.id = s.user_id
		WHERE s.renom > 0 AND NOT u.tester AND NOT s.tested
		ORDER BY s.renom DESC, s.generation DESC, s.last_name LIMIT 10`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	top := []FamilyRank{}
	for rows.Next() {
		var f FamilyRank
		if rows.Scan(&f.ID, &f.Name, &f.LastName, &f.Generation, &f.Renom) == nil {
			f.Rank = len(top) + 1
			top = append(top, f)
		}
	}
	rows.Close()
	mine := FamilyRank{ID: id}
	_ = h.DB.QueryRow(ctx, `
		SELECT s.first_name, s.last_name, s.generation, s.renom,
		       1 + (SELECT count(*) FROM sims o JOIN users u ON u.id = o.user_id WHERE o.renom > s.renom AND NOT u.tester AND NOT o.tested)
		FROM sims s WHERE s.id = $1`, id).Scan(&mine.Name, &mine.LastName, &mine.Generation, &mine.Renom, &mine.Rank)
	httpx.JSON(w, http.StatusOK, map[string]any{"top": top, "mine": mine})
}

// testerHeritage: the testers' shortcuts (tester.go): the five jalons met, 60 years old, the 21 days gone
// (that one written by the toolbox's handler). ok false: not one of them.
func (s *Sim) testerHeritage(action string) (evs []Event, ok bool, err error) {
	now := s.GameMinutes
	text := ""
	switch action {
	case "heritage-jalons":
		if s.minor() {
			return nil, true, game.ErrTooYoung
		}
		f := s.fam()
		s.Housing = game.OwnHouse
		if s.Career == "" {
			s.Career = "commerce"
		}
		if c, ok := game.FindCareer(s.Career); ok {
			s.CareerLevel = max(s.CareerLevel, min(4, len(c.Levels)-1))
		}
		s.Money = max(s.Money, 3*s.familyStart())
		names := []string{"Yao", "Adjoua", "Konan", "Aya", "Kouamé"}
		for i, n := range names {
			id := fmt.Sprintf("p-tonton%d", i)
			if s.friendByID(id) == nil && len(s.Friends) < game.MaxFriends {
				g := "homme"
				if i%2 == 1 {
					g = "femme"
				}
				s.Friends = append(s.Friends, game.Friend{ID: id, Name: n, Gender: g, Seed: 100 + i, Commune: s.HomeCommune, Friendship: 70, Adult: true, Met: now, Seen: now})
			}
		}
		if s.partnerHome() == nil && len(s.Friends) < game.MaxFriends {
			g := "homme"
			if s.Gender == "homme" {
				g = "femme"
			}
			s.Friends = append(s.Friends, game.Friend{ID: "p-moitie", Name: game.BabyName(g, newRand()), Gender: g, Seed: 77, Commune: s.HomeCommune, Friendship: 85, Romance: 85, Partner: true, Home: true, Adult: true, Met: now, Seen: now})
		}
		rng := newRand()
		sp := s.spans()
		for len(f.Kids) < 2 {
			g := "femme"
			if len(f.Kids)%2 == 0 {
				g = "homme"
			}
			f.Kids = append(f.Kids, Kid{ID: fmt.Sprintf("k%d", now%1_000_000*10+int64(len(f.Kids))), Name: game.BabyName(g, rng), Gender: g, Seed: rng.IntN(1 << 30), Born: now - sp.Childhood() - 1, Traits: game.BabyTraits(s.Traits, rng), Stage: game.StageAdulte, Years: game.AdultAge})
		}
		s.paperSync = true
		text = "Testeur : les cinq jalons de la génération sont remplis."
	case "heritage-60":
		if s.minor() {
			return nil, true, game.ErrTooYoung
		}
		f := s.fam()
		f.AdultAt = now - s.spans().LivedFor(game.PassationAge)
		f.Clock = heirClock
		text = "Testeur : ton perso a 60 ans."
	case "heritage-floor":
		text = "Testeur : les 21 jours de la génération sont passés."
	default:
		return nil, false, nil
	}
	return []Event{{Kind: "life", Text: text, GameTime: now}}, true, nil
}
