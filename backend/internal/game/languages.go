package game

import "strings"

// The languages of the street, beside French that everyone speaks: the
// player says which ones they speak (their profile), every passer-by has
// their own (their mother tongue, often Dioula too, the market's language),
// and a greeting in a language they share warms them up. The greetings are
// the ones the courses give (Dioula: mandenkan.com; Baoulé: coastsystems.net),
// by the time of day; where the game has no sure words for a language, it
// says what happens instead of making them up.

type Language struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

var Languages = []Language{
	{"dioula", "Dioula"}, {"baoule", "Baoulé"}, {"bete", "Bété"}, {"senoufo", "Sénoufo"}, {"malinke", "Malinké"},
	{"agni", "Agni"}, {"attie", "Attié"}, {"guere", "Guéré"}, {"yacouba", "Yacouba"}, {"gouro", "Gouro"},
	{"abron", "Abron"}, {"ebrie", "Ébrié"}, {"anglais", "Anglais"},
}

// LanguageLabel: « Baoulé » for baoule; "" for no such language.
func LanguageLabel(id string) string {
	for _, l := range Languages {
		if l.ID == id {
			return l.Label
		}
	}
	return ""
}

// npcMother: the passers-by's mother tongues, twenty shares (the web's
// world3d/languages.ts holds the same list: a passer-by speaks the same
// languages on the phone and on the server).
var npcMother = []string{
	"baoule", "baoule", "baoule", "baoule", "baoule", "dioula", "dioula", "dioula", "dioula", "malinke",
	"malinke", "senoufo", "senoufo", "bete", "bete", "agni", "attie", "guere", "yacouba", "ebrie",
}

// NpcLanguages: what a passer-by speaks besides French, from their seed: their
// mother tongue, Dioula six times in ten (always for a Malinké), English one
// time in ten.
func NpcLanguages(seed int) []string {
	if seed < 0 {
		seed = -seed
	}
	m := npcMother[seed%len(npcMother)]
	out := []string{m}
	if m != "dioula" && (m == "malinke" || (seed/20)%10 < 6) {
		out = append(out, "dioula")
	}
	if (seed/200)%10 == 0 {
		out = append(out, "anglais")
	}
	return out
}

// GreetReply: what a passer-by who speaks the language answers to a greeting
// in it, at that hour, to a Sim of that gender ({name}, {e} filled in after).
// ok false: the game has no words for it (it tells the scene instead).
func GreetReply(lang string, hour int, simFemme, npcFemme bool) (string, bool) {
	switch lang {
	case "dioula":
		// The man answers « Nba », the woman « Nse »; then « are you well? », « no trouble at all ».
		ans := "Nba"
		if npcFemme {
			ans = "Nse"
		}
		return "« " + ans + " ! I ka kɛnɛ wa ? » — « Ɔn-hɔn, n ka kɛnɛ ! » — « Tɔɔrɔ si t'a la ! » {name} rigole : « Toi tu parles bien dèh ! »", true
	case "baoule":
		// To a man « nja », to a woman « mmo »; the answer by the time of day.
		to := "nja"
		if simFemme {
			to = "mmo"
		}
		ans := "Yoo, " + to + " arɛ o !"
		switch {
		case hour >= 17 || hour < 4:
			ans = "Yoo, " + to + " ahosin !"
		case hour >= 11:
			ans = "Yoo, " + to + " aanti o !"
		}
		return "« " + ans + " » {name} est tout{e} content{e} qu'on lui parle baoulé : « Toi, tu es de la famille ! »", true
	case "bete":
		return "« Ayo ! » {name} éclate de rire : « Toi tu es de chez nous ou bien ? »", true
	case "anglais":
		return "« Fine, thank you! And you? » {name} est content{e} de pratiquer son anglais.", true
	}
	return "{name} te répond en " + strings.ToLower(LanguageLabel(lang)) + ", tout{e} surpris{e} : vous voilà comme deux parents du même village.", false
}
