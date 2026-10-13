package game

// Source records where a real-world fact comes from and how sure we are of
// it. Fictional simulation content says so instead of pretending to be real.
type Source struct {
	Status  string   `json:"status"` // one of the Status* values
	URLs    []string `json:"urls,omitempty"`
	Checked string   `json:"checked,omitempty"` // YYYY-MM-DD the sources were last looked at
	Note    string   `json:"note,omitempty"`
}

const (
	// StatusVerified: confirmed by an official text or several independent sources.
	StatusVerified = "verified"
	// StatusPartial: one credible source, or sources that agree only in part (dates vary…).
	StatusPartial = "partial"
	// StatusUnverified: believed true but not confirmed yet; listed by the audit.
	StatusUnverified = "unverified"
	// StatusFictional: made up for the game, makes no claim about the real world.
	StatusFictional = "fictional"
)

// Checked is the date of the last verification pass over the world data.
const Checked = "2026-10-13"

func Verified(note string, urls ...string) *Source {
	return &Source{Status: StatusVerified, URLs: urls, Checked: Checked, Note: note}
}

func Partial(note string, urls ...string) *Source {
	return &Source{Status: StatusPartial, URLs: urls, Checked: Checked, Note: note}
}

func Unverified(note string, urls ...string) *Source {
	return &Source{Status: StatusUnverified, URLs: urls, Checked: Checked, Note: note}
}

// Fictional marks game content that describes no real place, event or person.
var Fictional = &Source{Status: StatusFictional}

// Sources used across the world data, so every record cites the same pages.
const (
	SrcHolidaysDecree   = "https://civlii.laws.africa/en/akn/ci/act/decree/1996/205/fra@2023-07-18/source"
	SrcHolidaysText     = "https://loidici.biz/?p=24567"
	SrcPeaceDay         = "https://www.fratmat.info/article/2146641/societe/cote-divoire-le-15-novembre-une-journee-nationale-pour-celebrer-la-paix"
	SrcNuitDestin2026   = "https://www.fratmat.info/article/2640635/societe/nuit-du-destin-2026-le-lundi-16-mars-2026-declare-jour-ferie-et-chome-en-cote-divoire"
	SrcFEMUA            = "https://en.wikipedia.org/wiki/Anoumabo_Urban_Music_Festival"
	SrcFEMUA2023        = "https://burkina24.com/?p=323057"
	SrcAbissa           = "https://www.afrique-sur7.fr/fetes-traditionnelles-ivoiriennes-populaires"
	SrcLonelyFestivals  = "https://www.lonelyplanet.fr/destinations/afrique/cote-divoire/fetes-festivals"
	SrcBridges          = "https://yop.l-frii.com/cote-divoire-voici-les-5-ponts-qui-facilitent-la-mobilite-dans-le-pays/"
	SrcBridgeHKB        = "https://www.gouv.ci/doc/Discours_PR_Pont_HKB_16dec14 VF.pdf"
	SrcAirportRoad2024  = "https://connectionivoirienne.net/2024/11/18/abidjan-des-bouchons-monstres-permanents-sur-le-chemin-de-laeroport-a-cause-des-travaux-simultanes/"
	SrcNouchiGrin       = "https://www.afrique-sur7.fr/le-grin/lexique"
	SrcNouchiAfrik      = "https://www.afrik.com/cote-d-ivoire-la-page-nouchi"
	SrcNouchiGV         = "https://globalvoices.org/2013/12/16/do-you-speak-nouchi-ivorian-politicians-would-like-to-know/"
	SrcNouchiAnnuaire   = "https://annuaireci.com/blog/le-nouchi-largot-ivoirien-qui-fait-vibrer-la-cote-divoire-et-seduit-le-monde/"
	SrcBrouteur         = "https://www.lalanguefrancaise.com/dictionnaire/definition/brouteur"
	SrcRuePrincesse2011 = "https://news.abidjan.net/articles/407307/reportage-operation-pays-propre-a-yopougon-la-rue-princesse-a-perdu-sa-couronne"
)
