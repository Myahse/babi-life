package sims

import (
	"math/rand/v2"
	"strings"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Two at once. A Sim already together with someone can get together with
// someone else (if they don't know: sortir, chat.go), and then it's a matter
// of time: going out with one, flirting, the quarter talks. Caught, the one
// cheated on leaves (packs up if they lived together), or forgives once, but
// it hurts; the other one, learning they weren't the only one, may go too.
// All between adults, nothing shown: the game says what happened.

const (
	// The chances of being found out: out with one of them (an outing), or getting together with someone new.
	caughtOuting = 0.25
	caughtNew    = 0.15
	caughtFlirt  = 0.1
)

// partners: everyone the Sim is together with.
func (s *Sim) partners() []*game.Friend {
	var out []*game.Friend
	for i := range s.Friends {
		if s.Friends[i].Partner {
			out = append(out, &s.Friends[i])
		}
	}
	return out
}

// cheating: together with more than one.
func (s *Sim) cheating() bool { return len(s.partners()) > 1 }

var (
	caughtLeaves = []string{
		"{name} a tout découvert pour {other}. {Pronoun} a pris ses affaires sans un mot. C'est fini.",
		"Le quartier a parlé : {name} sait pour {other}. « Ne m'appelle plus jamais. » C'est fini.",
		"{name} t'a vu·e avec {other}. Les cris ont réveillé toute la cour. C'est fini entre vous.",
	}
	caughtForgives = []string{
		"{name} a appris pour {other}. Des larmes, une longue nuit… {Pronoun} te pardonne, cette fois. Mais ça ne sera plus comme avant.",
		"{name} sait pour {other}. « Si je te reprends, c'est fini. » {Pronoun} reste, blessé·e.",
	}
	loverLeaves = []string{"{other} apprend qu'il y avait {name}. « Tu m'as pris·e pour qui ? » {Pronoun2} s'en va aussi."}
)

// caught: found out with `with` (one of the partners) by another, maybe:
// what happened (to write in the journal), or "" if nobody found out.
func (s *Sim) caught(with *game.Friend, chance float64, rng *rand.Rand) string {
	if with == nil || !with.Partner || !s.cheating() || rng.Float64() >= chance {
		return ""
	}
	// Who finds out: the one who lives with the Sim first, else the oldest together.
	var cheated *game.Friend
	for _, p := range s.partners() {
		if p.ID == with.ID {
			continue
		}
		if cheated == nil || p.Home || (!cheated.Home && p.Met < cheated.Met) {
			cheated = p
		}
	}
	if cheated == nil {
		return ""
	}
	fill := func(l string, a, b *game.Friend) string {
		return strings.NewReplacer("{name}", a.Name, "{other}", b.Name, "{Pronoun}", pronoun(a), "{Pronoun2}", pronoun(b)).Replace(l)
	}
	s.Needs = s.Needs.Add(game.Needs{Social: -15, Fun: -15})
	var text string
	// Closer, likelier to forgive; never twice (forgiven once: friendship lower, and the next time is the last).
	if rng.Float64() < 0.65-float64(cheated.Friendship)/250 || cheated.Friendship < 40 {
		cheated.Partner, cheated.Home = false, false
		cheated.Friendship = max(0, cheated.Friendship-45)
		text = fill(caughtLeaves[rng.IntN(len(caughtLeaves))], cheated, with)
	} else {
		cheated.Friendship = max(0, cheated.Friendship-30)
		text = fill(caughtForgives[rng.IntN(len(caughtForgives))], cheated, with)
	}
	// The lover learns too, half the time.
	if rng.Float64() < 0.5 {
		with.Partner, with.Home = false, false
		with.Friendship = max(0, with.Friendship-30)
		text += " " + fill(loverLeaves[0], cheated, with)
	}
	return text
}

func pronoun(f *game.Friend) string {
	if f.Gender == "femme" {
		return "Elle"
	}
	return "Il"
}
