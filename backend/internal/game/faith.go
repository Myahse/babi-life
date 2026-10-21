package game

import (
	"regexp"
	"strings"

	"golang.org/x/text/unicode/norm"
)

// The faiths of the places of worship: what is held there and when (the
// Sunday mass, the culte, the Friday prayer). OpenStreetMap only says
// « christian » or « muslim », sometimes nothing: the name tells the rest
// (« Paroisse Sainte-Thérèse », « Église des Assemblées de Dieu », « Temple
// méthodiste »). An unnamed church is taken for an evangelical one, the most
// common in Abidjan.
const (
	FaithCatholic   = "catholique"
	FaithProtestant = "protestant" // méthodiste, baptiste, harriste, CMA: the culte on Sunday
	FaithEvangelic  = "evangelique"
	FaithMuslim     = "musulman"
	FaithOther      = "autre" // the Kingdom Halls…: one prays there, no mass or culte
)

var (
	faithMuslim     = regexp.MustCompile(`\b(mosquee|mosque|masjid|zawia|zaouia|zawiya|jamaa|islam\w*|musulman\w*)\b`)
	faithOther      = regexp.MustCompile(`\b(temoins? de jehovah|salle du royaume|derniers jours?)\b`)
	faithProtestant = regexp.MustCompile(`\b(methodiste|methodist|baptiste?|baptis|harris\w*|protestante?|cma|presbyterien\w*|adventiste)\b`)
	faithEvangelic  = regexp.MustCompile(`\b(evangel\w*|evangeique|assemblees? de dieu|pentec\w*|mission\w*|ministere|reveil|celeste|universel\w*|plein evangile|temple|tabernacle|eben ezer|bethel|bethanie|shekina\w*|shalom|gloire|delivrance|vases? d.honneur)\b`)
	faithCatholic   = regexp.MustCompile(`\b(cathedrale|basilique|parr?oiss?e|chapelle|saints?|saintes?|st|ste|notre dame|notre mere|soeurs?|sacre coeur|catholiques?|kizito|lwanga|padoue|jeanne d arc)\b`)
)

// FaithOf: the faith of a place of worship from its name and what the map
// calls it (christian, muslim, place_of_worship, or nothing).
func FaithOf(name, mapType string) string {
	n := plainWords(name)
	switch {
	case mapType == "muslim" || faithMuslim.MatchString(n):
		return FaithMuslim
	case faithOther.MatchString(n):
		return FaithOther
	// A Methodist « paroisse » is Methodist: the denominations first, the saints after.
	case faithProtestant.MatchString(n):
		return FaithProtestant
	case faithEvangelic.MatchString(n):
		return FaithEvangelic
	case faithCatholic.MatchString(n):
		return FaithCatholic
	}
	return FaithEvangelic
}

// plainWords: lower case, no accents, words apart (« Sacré-Cœur » → « sacre coeur »).
func plainWords(s string) string {
	s = strings.ReplaceAll(strings.ReplaceAll(strings.ToLower(s), "œ", "oe"), "’", "'")
	var b strings.Builder
	for _, r := range norm.NFD.String(s) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r >= 0x300 && r <= 0x36f: // the accents, dropped
		default:
			b.WriteRune(' ')
		}
	}
	return " " + strings.Join(strings.Fields(b.String()), " ") + " "
}
