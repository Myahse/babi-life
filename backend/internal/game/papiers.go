package game

import (
	"fmt"
	"hash/fnv"
)

// Les papiers (the update « papiers », sims/papiers.go, web components/Papiers.tsx): the game's own
// documents, kept in the phone's « Papiers » wallet. They are the game's, never a copy of a real
// one: a « Babi Life » header, « Document de jeu — sans valeur », invented layouts, numbers in the
// game's own format (« BL-2026-000123 »), no emblem, stamp or signature of a real office. What they
// say comes from the Sim only (its names, its birth in game time, its commune, its family).

// PapersKey: the update.
const PapersKey = "papiers"

// The kinds of document.
const (
	DocExtrait       = "extrait-naissance"
	DocCNI           = "carte-identite"
	DocMariage       = "acte-mariage"
	DocLivret        = "livret-famille"
	DocTravail       = "contrat-travail"
	DocBail          = "contrat-bail"
	DocTitre         = "titre-propriete"
	DocCarteGrise    = "carte-grise"
	DocPermis        = "permis-conduire"
	DocBEPC          = "diplome-bepc"
	DocBAC           = "diplome-bac"
	DocLegalisation  = "attestation-legalisation"
	DocAvertissement = "avis-controle"
	// DocDiplome: a diploma of higher education (the update « parcours-etudes »), one per diploma and filière (ref).
	DocDiplome = "diplome-sup"
)

// The places' new actions (catalog.go), behind the update.
const (
	// CNIMairieID, CNIPoliceID: asking for the identity card, at the mairie or the commissariat.
	CNIMairieID = "carte-identite-mairie"
	CNIPoliceID = "carte-identite-commissariat"
	// PermisID: the driving test (the code's quiz, web defi/jeux/configs/papiers.ts).
	PermisID = "permis-conduire"
	// MariageID: getting married at the mairie, with one's partner.
	MariageID = "se-marier"
	// ExtraitID, LegalisationID: the mairie's existing desks (and the préfecture's, update « communes-detail »).
	ExtraitID          = "etat-civil"
	LegalisationID     = "legalisation"
	PrefLegalisationID = "prefecture-legalisation"
	PermisPass         = 50 // the test's score that passes
	CNIYears           = 10 // how many game years the card lasts (YearMinutes each)
	PapersFine         = 500
	PapersCheckPrefix  = "evt-controle"
)

// PapersInteractions: what the update brings to the places (features.go).
var PapersInteractions = []string{CNIMairieID, CNIPoliceID, PermisID, MariageID}

// CNIValidMinutes: how long the identity card is valid, in real minutes.
func CNIValidMinutes() int64 { return CNIYears * YearMinutes }

// DocNumber: a document's number in the game's format.
func DocNumber(year int, seq int64) string { return fmt.Sprintf("BL-%d-%06d", year, seq%1_000_000) }

// mix: a stable small number from words (a Sim's id, a career…).
func mix(parts ...string) uint32 {
	h := fnv.New32a()
	for _, p := range parts {
		h.Write([]byte(p))
		h.Write([]byte{0})
	}
	return h.Sum32()
}

// ParentNames: the father's and the mother's names on the Sim's papers, the same every time
// (the game draws no names for them elsewhere: they're Papa and Maman at home).
func ParentNames(simID, lastName string) (string, string) {
	f := boys[mix(simID, "papa")%uint32(len(boys))]
	m := girls[mix(simID, "maman")%uint32(len(girls))]
	mn := motherLastNames[mix(simID, "nom-maman")%uint32(len(motherLastNames))]
	return f + " " + lastName, m + " " + mn
}

var motherLastNames = []string{"Kouassi", "Koné", "Yao", "Traoré", "Bamba", "N'Guessan", "Ouattara", "Kouamé", "Diabaté", "Touré", "Aka", "Gnagne", "Coulibaly", "Brou", "Zadi", "Séri"}

// employers: the game's invented companies, by career (the contrat de travail).
var employers = map[string][]string{
	"bureau":       {"Lagune Conseil SA", "Babi Services & Cie", "Plateau Gestion", "Ivoire Bureautique"},
	"maquis":       {"Maquis Chez Tantie Bintou", "Le Garba d'Or", "Maquis Le Bon Coin"},
	"commerce":     {"Établissements Kodjo & Fils", "Marché Adjamé Négoce", "Boutique Akwaba"},
	"transport":    {"Gbaka Express Abobo", "Savane Lignes", "Woro-Woro Union"},
	"ambiance":     {"Rue Princesse Prod", "Babi Ambiance Events", "Le Zouglou Club"},
	"mairie":       {"Mairie de la commune (service municipal)"},
	"enseignement": {"Groupe scolaire Les Flamboyants", "Collège Moderne de Babi"},
	"sante":        {"Clinique Les Palmiers", "Centre de santé Lagune"},
	"droit":        {"Cabinet Koné & Associés", "Étude Maître Yao"},
	"police":       {"Commissariat du quartier"},
	"pharmacie":    {"Pharmacie de la Lagune", "Pharmacie Akwaba"},
	"aerien":       {"Air Lagune"},
	"armee":        {"Bataillon des Lagunes (unité du jeu)"},
}

// Employer: the company on the contract, for this Sim and this career.
func Employer(simID, career string) string {
	if l, ok := employers[career]; ok {
		return l[mix(simID, career)%uint32(len(l))]
	}
	l := []string{"Babi Entreprises", "Société Ivoire Travaux", "Lagune Négoce"}
	return l[mix(simID, career)%uint32(len(l))]
}

// Landlord: the owner on the contrat de bail (invented, the same for a home).
func Landlord(simID, home string) string {
	t := []string{"M.", "Mme", "M.", "Mme", "El Hadj", "Tantie"}
	n := []string{"Koffi", "Bamba", "Yao", "Koné", "Touré", "Kouadio", "Aka", "Diallo", "Brou", "N'Dri"}
	h := mix(simID, home)
	return t[h%uint32(len(t))] + " " + n[(h/7)%uint32(len(n))]
}
