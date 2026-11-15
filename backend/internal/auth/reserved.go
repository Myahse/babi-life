package auth

import "strings"

// Usernames a player may not take: they would pass for the game's team or a
// system account. Matched case-insensitively, separators (_ . -) removed and
// simple leet digits read as letters (0→o, 1→i or l, 3→e, 4→a, 5→s), so
// « Adm1n », « b4bi_life » or « s.u.p.p.o.r.t » are caught too.
//
// Most words are also refused as a prefix (« admin_koffi », « babilife2 »);
// the ones that start ordinary names (babi, team, modo, root, help, aide,
// claude) only on their own or followed by digits (« modo2 », « team_1 »), so
// that « Modou », « babiqueen », « teamkoffi » or « Claudine » stay free.
var reservedWords = []string{
	"admin", "administrateur", "administrator", "administration",
	"babilife", "lifeinbabi",
	"support", "equipe", "staff",
	"moderateur", "moderatrice", "moderator", "moderation",
	"officiel", "officielle", "official",
	"system", "systeme",
	"anthropic",
	"contact", "security", "securite",
	"testeur", "testeuse", "tester", "noreply",
}

// reservedExact: refused alone or followed by digits only.
var reservedExact = []string{"babi", "team", "modo", "root", "help", "aide", "claude", "info"}

// Words refused anywhere in the name (« koffi_officiel », « vrai.babilife »):
// long enough not to hide inside ordinary words (« admin » alone would catch
// « badminton », so only « administrat… » is here).
var reservedAnywhere = []string{"babilife", "lifeinbabi", "officiel", "official", "moderateur", "moderator", "administrat"}

// stripSeps lowercases and drops the separators a username may hold.
func stripSeps(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if r == '_' || r == '.' || r == '-' || r == ' ' {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// deleet reads the digits that look like letters as those letters; one is i or
// l, so both readings are returned. Same length as the input (byte for byte on
// ASCII, which is all a username holds).
func deleet(s string) []string {
	m := strings.NewReplacer("0", "o", "3", "e", "4", "a", "5", "s", "@", "a", "$", "s")
	base := m.Replace(s)
	return []string{strings.ReplaceAll(base, "1", "i"), strings.ReplaceAll(base, "1", "l")}
}

// onlyDigits: "" or digits only.
func onlyDigits(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// ReservedUsername says whether a username is kept for the game's own accounts.
func ReservedUsername(u string) bool {
	plain := stripSeps(u)
	if plain == "" {
		return false
	}
	for _, sk := range deleet(plain) {
		for _, w := range reservedAnywhere {
			if strings.Contains(sk, w) {
				return true
			}
		}
		for _, w := range reservedWords {
			if strings.HasPrefix(sk, w) {
				return true
			}
		}
		for _, w := range reservedExact {
			if strings.HasPrefix(sk, w) && onlyDigits(plain[len(w):]) {
				return true
			}
		}
	}
	return false
}
