package game

import (
	"fmt"
	"math/rand/v2"
)

// Friends and the street. Sims meet people while doing things with others;
// friendship grows when they see each other and fades when they don't. A
// teenager from any family, though far more often a struggling one, can be
// drawn into a street gang (the « microbes »): quick money and belonging, until the police catch up.

// A Friend is someone the Sim knows.
type Friend struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Gender     string `json:"gender"`
	Seed       int    `json:"seed"` // their look, drawn from it
	Commune    string `json:"commune"`
	Friendship int    `json:"friendship"` // 0..100
	Gang       bool   `json:"gang,omitempty"`
	Met        int64  `json:"met"`
	Seen       int64  `json:"seen"`
}

const MaxFriends = 12

// Social places: doing these, a Sim may meet someone or see a friend again.
var SocialInteractions = []string{
	"aller-ecole", "jouer-cour", "play-football", "play-basket", "watch-match", "drink-with-friends", "dance-coupe-decale",
	"party", "glace", "anniversaire-resto", "spectacle", "pray", "coffee-break", "eat-poulet-braise",
	"gbairai", "tresses", "amphi", "resto-u", "bar-hotel",
}

var (
	girls = []string{"Awa", "Aya", "Mariam", "Adjoua", "Fatou", "Akissi", "Ruth", "Affoué", "Grâce", "Nadège", "Salimata", "Ange"}
	boys  = []string{"Kouadio", "Yao", "Moussa", "Koffi", "Serge", "Ibrahim", "Didier", "Konan", "Junior", "Lassina", "Arouna", "Fabrice"}
)

// Meet: someone new, or a friend seen again; nil if nothing happens.
func Meet(friends []Friend, commune string, now int64, rng *rand.Rand) (f *Friend, isNew bool) {
	if len(friends) > 0 && (len(friends) >= MaxFriends || rng.Float64() < 0.55) {
		i := rng.IntN(len(friends))
		return &friends[i], false
	}
	if rng.Float64() > 0.45 {
		return nil, false
	}
	g := "femme"
	names := girls
	if rng.IntN(2) == 0 {
		g, names = "homme", boys
	}
	return &Friend{ID: fmt.Sprintf("f%d", now%1_000_000*10+int64(rng.IntN(10))), Name: names[rng.IntN(len(names))], Gender: g, Seed: rng.IntN(1 << 20),
		Commune: commune, Friendship: 15 + rng.IntN(15), Met: now, Seen: now}, true
}

// FadeFriends: a week apart costs a little friendship.
func FadeFriends(friends []Friend, now int64) {
	for i := range friends {
		if now-friends[i].Seen > 7*24*60 && friends[i].Friendship > 5 {
			friends[i].Friendship -= 5
			friends[i].Seen = now - 3*24*60 // fades again next week
		}
	}
}

// Ways to spend time with a friend.
type FriendAction struct {
	ID         string `json:"id"`
	Label      string `json:"label"`
	Icon       string `json:"icon"`
	Minutes    int64  `json:"minutes"`
	Cost       int    `json:"cost"`
	Effect     Needs  `json:"effect"`
	Friendship int    `json:"friendship"`
	Phone      bool   `json:"phone,omitempty"` // done on the phone, from anywhere
}

var FriendActions = []FriendAction{
	{ID: "appeler", Label: "Appeler", Icon: "phone", Minutes: 20, Cost: 100, Effect: Needs{Social: 20}, Friendship: 5, Phone: true},
	{ID: "trainer", Label: "Traîner ensemble", Icon: "users", Minutes: 60, Effect: Needs{Social: 35, Fun: 20}, Friendship: 12},
}

// The gang: who gets invited, and what a « coup » brings.
const (
	GangName       = "la bande"
	CoupMinutes    = 60
	CustodyMinutes = 3 * 60 // garde à vue, shortened for the game
)

// GangInviteChance: teenagers hanging around get noticed by the bande. It
// recruits in every family, but far more among those who struggle.
func GangInviteChance(stage, family string, marks int) float64 {
	if stage != StageAdo {
		return 0
	}
	chance := map[string]float64{"gnambro": 0.2, "coule": 0.15, "poignon": 0.07, "lagnon": 0.04, "late": 0.02, "debout": 0.01}[family]
	if marks < 5 {
		chance *= 2 // out of school: the street is closer
	}
	return chance
}

// CoupOutcome: the money of a coup, and whether the police catch the Sim.
// Every arrest makes the next one likelier.
func CoupOutcome(record int, rng *rand.Rand) (money int, caught bool) {
	if rng.Float64() < 0.25+0.1*float64(record) {
		return 0, true
	}
	return 5000 + rng.IntN(15)*1000, false
}

// CleanRecordCareers: jobs closed to Sims with a police record.
var CleanRecordCareers = []string{"bureau", "mairie", "enseignement", "sante"}
