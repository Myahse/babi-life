package game

import (
	"fmt"
	"math"
	"math/rand/v2"
)

// The Djai earned by playing, and its limits. Djai is also sold for real
// money (shop/: 40 000 Djai for the smallest pack, about 80 to 112 Djai a
// real franc), so what play brings must stay scarce: a modest rent and food
// for an hour a day, never more than half the smallest pack in a real day,
// whatever is done. Every limit is here, by source and per account (all its
// Sims together), for a real day (Abidjan's, from midnight); docs/economie.md
// explains the numbers and is the reference for tuning them.

// Income: where Djai earned by playing comes from.
type Income string

const (
	// FromWork: a shift at one's job (game.Career), one a day.
	FromWork Income = "travail"
	// FromGig: the petits boulots (an interaction with a negative cost, a job asked of someone in the street).
	FromGig Income = "boulot"
	// FromTips: the tips at work (game.JobTask).
	FromTips Income = "pourboire"
	// FromDefi: the money a défi wins over what it cost (sims/defi.go).
	FromDefi Income = "defi"
	// FromTournament: the Saturday tournament's prize.
	FromTournament Income = "tournoi"
	// FromGames: a game of dames or 8 américain won against the game's players.
	FromGames Income = "jeux"
	// FromLuck: money come by chance (a note found, a gift, a prime, a djai asked of someone).
	FromLuck Income = "chance"
	// FromCoup: the gang's coup.
	FromCoup Income = "coup"
	// FromSocial: the brands paying for videos (Tikitoko).
	FromSocial Income = "reseaux"
	// FromPlayers: Djai from other players (Waye, a game's stake). Not earned: the
	// total doesn't count it, but it has its own limit (accounts made to farm).
	FromPlayers Income = "recu"
	// ToPlayers: Djai sent to other players, per day.
	ToPlayers Income = "envoye"
	// FromRental: a player's house booked on Dodo by another player.
	FromRental Income = "location"
	// EarnedTotal: everything earned by playing, together (FromPlayers, ToPlayers and FromRental aside).
	EarnedTotal Income = "total"
	// Slots: the spins at the slot machines, counted (game/slots.go). What they pay isn't earned
	// (like the bets', it's what was staked coming back, less the house's edge): only the spins are limited.
	Slots Income = "machine"
)

// Cap: what an account may get from a source in a real day.
type Cap struct {
	// Djai: the most a day (0: no limit in Djai).
	Djai int
	// Times: how many times a day (0: no limit).
	Times int
	// Full: the line said when it's reached.
	Full string
}

// Caps: the limits, by source. The Babi Pass (shop/) raises the Djai ones by
// PassBonus, as it does what's earned.
var Caps = map[Income]Cap{
	FromWork:       {Times: 1, Full: "Tu as déjà fait ta journée de travail aujourd'hui : reviens demain."},
	FromGig:        {Djai: 2000, Full: "Plus de petit boulot aujourd'hui : reviens demain."},
	FromTips:       {Djai: 800, Full: "Plus de pourboire aujourd'hui."},
	FromDefi:       {Djai: 1000, Full: "Les gars du quartier ne misent plus contre toi aujourd'hui : reviens demain."},
	FromTournament: {Djai: 2000, Times: 1, Full: "Tu as déjà joué le tournoi aujourd'hui."},
	FromGames:      {Djai: 1500, Full: "Plus personne ne veut jouer de l'argent contre toi aujourd'hui : reviens demain."},
	FromLuck:       {Djai: 1000, Full: "La chance, c'est pas tous les jours."},
	FromCoup:       {Times: 1, Full: "La bande a déjà fait un coup aujourd'hui : faites-vous oublier jusqu'à demain."},
	FromSocial:     {Djai: 2000, Full: "Les marques ne paient plus de vidéo aujourd'hui : reviens demain."},
	FromPlayers:    {Djai: 20000, Full: "Son Waye ne peut plus rien recevoir aujourd'hui (20 000 Djai par jour)."},
	ToPlayers:      {Djai: 20000, Full: "Waye : 20 000 Djai envoyés aux joueurs par jour, pas plus. Reviens demain."},
	FromRental:     {Djai: 250000, Full: "L'hôte ne peut plus être payé sur Dodo aujourd'hui : réessaie demain."},
	EarnedTotal:    {Djai: DailyTotal, Full: "Tu as assez gagné pour aujourd'hui : reviens demain."},
	Slots:          {Times: SlotsPerDay, Full: "Assez de machine à sous pour aujourd'hui : reviens demain."},
}

// DailyTotal: the most an account earns by playing in a real day, every
// source together, without the Pass: half the smallest pack (40 000 Djai).
const DailyTotal = 20_000

// PassBonus: the share the Babi Pass (shop/) adds to the Djai earned, and to
// the day's limits in Djai: comfort and speed, not a way round them.
const PassBonus = 0.25

// NewAccountHold: an account this young (or a Sim given money by the
// testers' toolbox) can't send Djai to other players, put a stake against
// them or book their houses: accounts made to farm can't pass it on.
const NewAccountHold = 7 * 24 * 60 // minutes

// WindfallChance: a surprise that would bring money (a note found, a gift)
// happens this often when drawn; otherwise something else happens.
const WindfallChance = 0.35

// TournamentID: the Saturday tournament at the salle de jeux (catalog.go), entered once a day.
const TournamentID = "tournoi-console"

// DayOf: the real day (from Epoch, at midnight in Abidjan) of a game minute.
func DayOf(minute int64) int64 { return minute / minutesPerDay }

// purseKey: a source's tally on a day.
type purseKey struct {
	Day int64
	Src Income
}

// Tally: what an account got from a source on a day.
type Tally struct {
	Djai  int
	Times int
}

// Purse: an account's tallies for the last days, and what changed since it
// was read (sims/ saves the changes with the Sim, in the same transaction).
type Purse struct {
	got     map[purseKey]Tally
	changed map[purseKey]Tally
}

func NewPurse() *Purse {
	return &Purse{got: map[purseKey]Tally{}, changed: map[purseKey]Tally{}}
}

// Seed: a tally read from the database.
func (p *Purse) Seed(day int64, src Income, t Tally) {
	p.got[purseKey{day, src}] = t
}

// Got: the tally of a source on a day.
func (p *Purse) Got(day int64, src Income) Tally { return p.got[purseKey{day, src}] }

// limit: a source's cap in Djai on a day, with the Pass (0: none).
func limit(src Income, pass bool) int {
	c := Caps[src].Djai
	if c > 0 && pass {
		c += int(math.Round(float64(c) * PassBonus))
	}
	return c
}

// inTotal: the sources the day's total counts.
func inTotal(src Income) bool {
	return src != FromPlayers && src != ToPlayers && src != FromRental && src != EarnedTotal && src != Slots
}

// Left: the Djai a source can still bring today (math.MaxInt: no limit).
// Work is never cut (a shift started is paid); the others stop at their own
// cap and at the day's total.
func (p *Purse) Left(day int64, src Income, pass bool) int {
	left := math.MaxInt
	if c := limit(src, pass); c > 0 {
		left = max(0, c-p.Got(day, src).Djai)
	}
	if inTotal(src) && src != FromWork {
		left = min(left, max(0, limit(EarnedTotal, pass)-p.Got(day, EarnedTotal).Djai))
	}
	return left
}

// Can: whether a source counted in times (a shift, a coup) can be done once more today.
func (p *Purse) Can(day int64, src Income) bool {
	c := Caps[src].Times
	return c == 0 || p.Got(day, src).Times < c
}

// Use: the source done once more today.
func (p *Purse) Use(day int64, src Income) {
	p.add(day, src, Tally{Times: 1})
}

// Take: of `amount` from a source, what the account may still get today; counted.
func (p *Purse) Take(day int64, src Income, amount int, pass bool) int {
	got := min(max(amount, 0), p.Left(day, src, pass))
	if got > 0 {
		p.add(day, src, Tally{Djai: got})
		if inTotal(src) {
			p.add(day, EarnedTotal, Tally{Djai: got})
		}
	}
	return got
}

func (p *Purse) add(day int64, src Income, d Tally) {
	k := purseKey{day, src}
	t := p.got[k]
	p.got[k] = Tally{t.Djai + d.Djai, t.Times + d.Times}
	c := p.changed[k]
	p.changed[k] = Tally{c.Djai + d.Djai, c.Times + d.Times}
}

// Change: what a tally gained since the purse was read.
type Change struct {
	Day int64
	Src Income
	Tally
}

// Changes: the tallies to save.
func (p *Purse) Changes() []Change {
	out := make([]Change, 0, len(p.changed))
	for k, t := range p.changed {
		out = append(out, Change{k.Day, k.Src, t})
	}
	return out
}

// Saved: the changes are in the database.
func (p *Purse) Saved() { p.changed = map[purseKey]Tally{} }

// Limit: a source's day so far, for the player (the apps show what's left).
type Limit struct {
	Got      int `json:"got"`
	Max      int `json:"max,omitempty"`
	Times    int `json:"times,omitempty"`
	MaxTimes int `json:"maxTimes,omitempty"`
}

// Today: every source's day so far, with its limits (the Pass's included).
func (p *Purse) Today(day int64, pass bool) map[Income]Limit {
	out := make(map[Income]Limit, len(Caps))
	for src, c := range Caps {
		t := p.Got(day, src)
		out[src] = Limit{Got: t.Djai, Max: limit(src, pass), Times: t.Times, MaxTimes: c.Times}
	}
	return out
}

// Full: the line said when a source's limit is reached.
func Full(src Income) string { return Caps[src].Full }

// ErrFull: a source's limit reached, as an error for the player.
func ErrFull(src Income) error { return fmt.Errorf("%s", Caps[src].Full) }

// Windfall: a surprise drawn that would bring money happens only now and
// then (WindfallChance); otherwise another one, which brings none, does.
func Windfall(pool []RandomEvent, ev RandomEvent, rng *rand.Rand) RandomEvent {
	if ev.Money <= 0 || rng.Float64() < WindfallChance {
		return ev
	}
	return Calm(pool, rng)
}

// Calm: a surprise from the pool that brings no money (or costs some); the
// first of the pool if every one brings money.
func Calm(pool []RandomEvent, rng *rand.Rand) RandomEvent {
	var calm []RandomEvent
	for _, e := range pool {
		if e.Money <= 0 {
			calm = append(calm, e)
		}
	}
	if len(calm) == 0 {
		return RandomEvent{Text: pool[0].Text, Effect: pool[0].Effect}
	}
	return calm[rng.IntN(len(calm))]
}
