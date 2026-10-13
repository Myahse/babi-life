// Package world describes the map of Côte d'Ivoire: cities, their communes
// and the places a Sim can visit. It is static content, seeded in code: every
// record says whether it is real or made up for the game, and where the real
// ones were checked (see Audit for what still needs work).
package world

import (
	"math"

	"github.com/myahse/babi-life/backend/internal/game"
)

type Place struct {
	ID   string  `json:"id"`
	Name string  `json:"name"`
	Kind string  `json:"kind"` // key into game.Kinds
	Lat  float64 `json:"lat"`
	Lng  float64 `json:"lng"`
	// Quarter is the neighbourhood (quartier) inside the commune, when known.
	Quarter string `json:"quarter,omitempty"`
	// Real: an actual establishment or site; false = invented for the game.
	Real bool `json:"real"`
	// Approx: the position is a placement for the game, not surveyed coordinates.
	Approx bool `json:"approx,omitempty"`
	// Owner of the property and Operator running it, kept apart; empty = unknown.
	Owner    string `json:"owner,omitempty"`
	Operator string `json:"operator,omitempty"`
	// Closed: a real venue that no longer runs as such (YYYY-MM), kept for the game.
	Closed string       `json:"closed,omitempty"`
	Source *game.Source `json:"source,omitempty"`
}

// Admin is a commune's place in the administration.
type Admin struct {
	Type   string `json:"type"`   // "commune"
	Parent string `json:"parent"` // the district or department/region it belongs to
	Mairie string `json:"mairie"` // ID of its mairie (a Place of kind "mairie")
	// Bank of the Ébrié lagoon for Abidjan communes ("nord" | "sud"): trips
	// between banks cross a bridge.
	Bank   string       `json:"bank,omitempty"`
	Source *game.Source `json:"source"`
}

type Commune struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Blurb  string  `json:"blurb"`
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
	Admin  Admin   `json:"admin"`
	Places []Place `json:"places"`
}

// CityAdmin is a city's administrative status.
type CityAdmin struct {
	Type   string       `json:"type"` // "district autonome" | "commune"
	Region string       `json:"region,omitempty"`
	Source *game.Source `json:"source"`
}

type City struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Blurb    string    `json:"blurb"`
	Lat      float64   `json:"lat"`
	Lng      float64   `json:"lng"`
	Zoom     float64   `json:"zoom"`
	Admin    CityAdmin `json:"admin"`
	Communes []Commune `json:"communes"`
}

// Sources for the world data (see game.Source for what each status means).
const (
	srcAbidjanCommunes = "https://www.synonyme-du-mot.com/les-articles/quelles-sont-les-communes-dabidjan-3"
	srcAbidjanDistrict = "https://economie-ivoirienne.ci/pole-competitif/district-autonome-dabidjan.html"
	srcAnyama          = "https://en.wikipedia.org/wiki/Anyama,_Ivory_Coast"
	srcSongon          = "https://en.wikipedia.org/wiki/Songon"
	srcBingerville     = "https://kupi.com/en-ae/explore/ivory-coast/bingerville/history"
	srcVilles2026      = "https://erooamba.com/villes-cote-ivoire-2026"
	srcGbeke           = "https://economie-ivoirienne.ci/pole-competitif/region-du-gbeke.html"
	srcPoro            = "https://economie-ivoirienne.ci/pole-competitif/region-du-poro.html"
	srcRegions         = "https://loidici.biz/?p=13626"
	srcSudComoe        = "https://economie-ivoirienne.ci/pole-competitif/region-du-sud-comoe.html"
	srcCHUStatus       = "https://www.koaci.com/article/2022/09/28/cote-divoire/societe/cote-divoire-les-quatre-chu-transformes-en-etablissements-publics-hospitaliers-nationaux_163513.html"
	srcCHUAngre        = "https://www.fratmat.info/index.php/societe/inauguration-du-chu-d-angre-des-soins-de-qualite-de-specialite-et-de-proximite-pour-tous"
	srcHGAdjame        = "https://www.fratmat.info/article/80047/10064/sante-et-hygiene-publique-le-president-ouattara-inaugure-ce-vendredi-le-4e-chu-d-abidjan"
	srcUniversities    = "https://www.fratmat.info/article/223172/societe/universites-publiques-lacces-et-la-qualite-de-loffre-denseignement-superieur-en-nette-amelioration"
	srcUniversities2   = "https://simoon-cv.com/blog/meilleures-universites-publiques-cote-ivoire-2026"
	srcINPHB           = "https://www.drh.enseignement.gouv.ci/html/public/textes/SIGLES_DEFINITIONS_drh.pdf"
	srcAirport         = "https://www.air-journal.fr/2026-07-11-aeroport-dabidjan-30-ans-dune-concession-qui-a-fait-emerger-un-hub-regional-5276158.html"
	srcAirport2        = "https://proparco.fr/en/carte-des-projets/aeria-2016"
	srcVenues          = "https://www.gouv.ci/uploads/publications/1705065321AKWABA12012024.pdf"
	srcPalaisSports    = "https://connectionivoirienne.net/2018/01/08/abidjan-capitale-aux-mille-palais-en-cote-divoire-magazine/"
	srcStadeFHB        = "https://connectionivoirienne.net/2011/10/14/dossier-etat-des-lieux-des-infrastructures-sportives-en-cote-d’ivoire-abandon-negligence-et-gabegie-ruines-despoir-delabrement-avance-depuis-1984…/"
	srcBassamUNESCO    = "https://whc.unesco.org/document/206740"
	srcBassamMusee     = "https://economie-ivoirienne.ci/activites-sectorielles/une-culture-riche-diverse-et-vivante.html"
	srcYakro           = "https://en.wikipedia.org/wiki/Yamoussoukro"
	srcYakroSites      = "https://erooamba.com/posts/sites-touristiques-cote-divoire-2026"
	srcBridges         = game.SrcBridges
)

var (
	// Commune status of the 13 communes of the District autonome d'Abidjan.
	abidjanAdmin = game.Verified("Les 13 communes du District autonome d'Abidjan.", srcAbidjanDistrict, srcAbidjanCommunes)
	// Which bank of the lagoon: from the bridges that link them.
	bankNote = "Rive de la lagune Ébrié déduite des ponts (Plateau–Treichville, Riviera–Marcory)."
	// A mairie exists in every commune; its position on the map is a placement.
	mairieNote = "Chaque commune a sa mairie ; position sur la carte approximative, adresse à relever."
	// Invented places in real neighbourhoods.
	invented = &game.Source{Status: game.StatusFictional, Note: "Établissement inventé pour le jeu."}
)

func abidjanCommune(id, name, blurb string, lat, lng float64, bank string, places ...Place) Commune {
	src := &game.Source{Status: game.StatusVerified, URLs: append(append([]string{}, abidjanAdmin.URLs...), srcBridges), Checked: game.Checked, Note: abidjanAdmin.Note + " " + bankNote}
	return Commune{ID: id, Name: name, Blurb: blurb, Lat: lat, Lng: lng,
		Admin:  Admin{Type: "commune", Parent: "District autonome d'Abidjan", Mairie: "mairie-" + id, Bank: bank, Source: src},
		Places: append([]Place{mairie(id, name, lat+0.0025, lng-0.0035, srcAbidjanDistrict)}, places...)}
}

func mairie(communeID, communeName string, lat, lng float64, src string) Place {
	return Place{ID: "mairie-" + communeID, Name: "Mairie " + de(communeName), Kind: "mairie", Lat: lat, Lng: lng, Real: true, Approx: true,
		Operator: "Commune " + de(communeName), Source: game.Partial(mairieNote, src)}
}

// de: "de Cocody", "d'Adjamé", "d'Abobo".
func de(name string) string {
	switch name[0] {
	case 'A', 'E', 'I', 'O', 'U':
		return "d'" + name
	}
	if len(name) > 1 && name[:2] == "É" {
		return "d'" + name
	}
	return "de " + name
}

func fictional(id, name, kind, quarter string, lat, lng float64) Place {
	return Place{ID: id, Name: name, Kind: kind, Lat: lat, Lng: lng, Quarter: quarter, Approx: true, Source: invented}
}

var Cities = []City{
	{
		ID: "abidjan", Name: "Abidjan", Zoom: 11.2, Lat: 5.33, Lng: -4.01,
		Blurb: "Babi, la perle des lagunes. Ça ne dort jamais.",
		Admin: CityAdmin{Type: "district autonome", Region: "District autonome d'Abidjan", Source: abidjanAdmin},
		Communes: []Commune{
			abidjanCommune("plateau", "Plateau", "Les tours, les bureaux, les costumes.", 5.3237, -4.0197, "nord",
				Place{ID: "plateau-tours", Name: "Cité administrative", Kind: "office", Lat: 5.3262, Lng: -4.0178, Real: true, Approx: true, Source: game.Unverified("Bureaux de l'administration au Plateau ; nom et position à confirmer.")},
				Place{ID: "plateau-cathedrale", Name: "Cathédrale Saint-Paul", Kind: "worship", Lat: 5.3315, Lng: -4.0230, Real: true, Approx: true, Source: game.Unverified("Cathédrale du Plateau ; à confirmer avec une source.")},
				Place{ID: "plateau-stade", Name: "Stade Félix-Houphouët-Boigny", Kind: "sport", Lat: 5.3205, Lng: -4.0170, Real: true, Approx: true,
					Source: game.Verified("Stade du Plateau, ouvert en 1961 sur le site du stade Géo-André ; capacité variable selon les sources (27 000 à 40 000).", srcVenues, srcStadeFHB)},
			),
			abidjanCommune("cocody", "Cocody", "Résidences, université et Riviera.", 5.3480, -3.9870, "nord",
				Place{ID: "cocody-danga", Name: "Maquis de Danga", Kind: "maquis", Quarter: "Danga", Lat: 5.3420, Lng: -4.0040, Approx: true, Source: invented},
				Place{ID: "cocody-ufhb", Name: "Terrain de l'Université", Kind: "sport", Lat: 5.3460, Lng: -3.9890, Approx: true, Source: invented},
				Place{ID: "cocody-riviera", Name: "Bureaux de la Riviera", Kind: "office", Quarter: "Riviera", Lat: 5.3560, Lng: -3.9640, Approx: true, Source: invented},
				Place{ID: "cocody-universite", Name: "Université Félix-Houphouët-Boigny", Kind: "school", Lat: 5.3440, Lng: -3.9840, Real: true, Approx: true, Operator: "Université publique",
					Source: game.Verified("Ex-Université de Cocody (1964), la plus grande université publique du pays.", srcUniversities, srcUniversities2)},
				Place{ID: "cocody-chu", Name: "CHU de Cocody", Kind: "health", Lat: 5.3410, Lng: -3.9930, Real: true, Approx: true, Operator: "Établissement public hospitalier national",
					Source: game.Verified("Transformé en établissement public hospitalier national en 2022.", srcCHUStatus)},
				Place{ID: "cocody-chu-angre", Name: "CHU d'Angré", Kind: "health", Quarter: "Angré", Lat: 5.3900, Lng: -3.9850, Real: true, Approx: true, Operator: "Établissement public hospitalier national",
					Source: game.Partial("4e CHU d'Abidjan, 250 lits ; quartier d'Angré (Cocody) à confirmer par une source officielle.", srcCHUAngre, srcCHUStatus)},
			),
			abidjanCommune("yopougon", "Yopougon", "Yop City, capitale de l'ambiance.", 5.3450, -4.0820, "nord",
				Place{ID: "yop-rue-princesse", Name: "Rue Princesse", Kind: "club", Lat: 5.3380, Lng: -4.0760, Real: true, Approx: true, Closed: "2011-08",
					Source: game.Partial("Rue des maquis et boîtes de nuit, rasée en août 2011 pendant l'opération « Pays propre ». Le jeu garde un lieu d'ambiance à cet endroit.", game.SrcRuePrincesse2011)},
				Place{ID: "yop-maquis", Name: "Maquis de Sideci", Kind: "maquis", Quarter: "Sideci", Lat: 5.3320, Lng: -4.0690, Approx: true, Source: invented},
				Place{ID: "yop-marche", Name: "Marché de Siporex", Kind: "market", Quarter: "Siporex", Lat: 5.3510, Lng: -4.0710, Real: true, Approx: true, Source: game.Unverified("Marché du quartier Siporex ; à confirmer.")},
				Place{ID: "yop-chu", Name: "CHU de Yopougon", Kind: "health", Lat: 5.3520, Lng: -4.0890, Real: true, Approx: true, Operator: "Établissement public hospitalier national",
					Source: game.Verified("Transformé en établissement public hospitalier national en 2022.", srcCHUStatus)},
			),
			abidjanCommune("adjame", "Adjamé", "Le cœur commerçant, ça bouge dans tous les sens.", 5.3550, -4.0240, "nord",
				Place{ID: "adjame-gare", Name: "Gare routière d'Adjamé", Kind: "transport", Lat: 5.3580, Lng: -4.0220, Real: true, Approx: true, Source: game.Unverified("Grande gare routière d'Adjamé ; à confirmer.")},
				Place{ID: "adjame-forum", Name: "Forum des marchés", Kind: "market", Lat: 5.3530, Lng: -4.0270, Real: true, Approx: true, Source: game.Unverified("Marché d'Adjamé ; nom à confirmer.")},
				Place{ID: "adjame-mosquee", Name: "Grande mosquée", Kind: "worship", Lat: 5.3500, Lng: -4.0215, Approx: true, Source: game.Unverified("Mosquée d'Adjamé ; nom exact à confirmer.")},
				Place{ID: "adjame-hopital", Name: "Hôpital général d'Adjamé", Kind: "health", Lat: 5.3610, Lng: -4.0290, Real: true, Approx: true, Operator: "Hôpital public",
					Source: game.Partial("Inauguré par le président de la République (après celui de Gagnoa, 2013).", srcHGAdjame)},
			),
			abidjanCommune("abobo", "Abobo", "La plus peuplée. Débrouillardise et solidarité.", 5.4250, -4.0170, "nord",
				Place{ID: "abobo-marche", Name: "Grand marché d'Abobo", Kind: "market", Lat: 5.4180, Lng: -4.0200, Real: true, Approx: true, Source: game.Unverified("Grand marché d'Abobo ; à confirmer.")},
				Place{ID: "abobo-terrain", Name: "Terrain de quartier", Kind: "sport", Lat: 5.4300, Lng: -4.0120, Approx: true, Source: invented},
				fictional("abobo-maquis", "Maquis du carrefour", "maquis", "", 5.4220, -4.0090),
				fictional("abobo-gare", "Gare des gbakas", "transport", "", 5.4160, -4.0130),
			),
			abidjanCommune("treichville", "Treichville", "Le vieux quartier mythique, le Palais des Sports.", 5.2990, -4.0090, "sud",
				Place{ID: "treich-marche", Name: "Marché de Treichville", Kind: "market", Lat: 5.3020, Lng: -4.0100, Real: true, Approx: true, Source: game.Unverified("Grand marché de Treichville ; à confirmer.")},
				Place{ID: "treich-palais", Name: "Palais des Sports", Kind: "sport", Lat: 5.2950, Lng: -4.0040, Real: true, Approx: true,
					Source: game.Verified("Salle couverte de 3 500 places (1978), à côté du Parc des sports.", srcPalaisSports)},
				Place{ID: "treich-maquis", Name: "Maquis de l'Avenue 16", Kind: "maquis", Lat: 5.3000, Lng: -4.0150, Approx: true, Source: invented},
				Place{ID: "treich-palais-culture", Name: "Palais de la Culture", Kind: "culture", Lat: 5.3050, Lng: -4.0170, Real: true, Approx: true,
					Source: game.Verified("Palais de la Culture de Treichville, 12 900 m², 7 salles.", srcVenues)},
				Place{ID: "treich-chu", Name: "CHU de Treichville", Kind: "health", Lat: 5.2960, Lng: -4.0150, Real: true, Approx: true, Operator: "Établissement public hospitalier national",
					Source: game.Verified("Transformé en établissement public hospitalier national en 2022.", srcCHUStatus)},
			),
			abidjanCommune("marcory", "Marcory", "Zone 4, Biétry, restos et sorties.", 5.3000, -3.9850, "sud",
				Place{ID: "marcory-zone4", Name: "Zone 4", Kind: "club", Quarter: "Zone 4", Lat: 5.2930, Lng: -3.9900, Approx: true, Source: game.Unverified("Quartier de sorties de Marcory ; le lieu est une ambiance générique.")},
				Place{ID: "marcory-bietry", Name: "Maquis de Biétry", Kind: "maquis", Quarter: "Biétry", Lat: 5.2860, Lng: -3.9770, Approx: true, Source: invented},
				Place{ID: "marcory-anoumabo", Name: "Village d'Anoumabo", Kind: "culture", Quarter: "Anoumabo", Lat: 5.2980, Lng: -3.9750, Real: true, Approx: true,
					Source: game.Partial("Lieu du FEMUA (festival fondé en 2008 par A'Salfo, de Magic System).", game.SrcFEMUA)},
			),
			abidjanCommune("koumassi", "Koumassi", "Populaire, vivante, au bord de la lagune.", 5.2930, -3.9500, "sud",
				Place{ID: "koumassi-marche", Name: "Marché de Koumassi", Kind: "market", Lat: 5.2960, Lng: -3.9520, Real: true, Approx: true, Source: game.Unverified("Marché de Koumassi ; à confirmer.")},
				fictional("koumassi-maquis", "Maquis de la lagune", "maquis", "", 5.2890, -3.9440),
				fictional("koumassi-terrain", "Terrain de Koumassi", "sport", "", 5.2990, -3.9440),
			),
			abidjanCommune("port-bouet", "Port-Bouët", "La plage, l'aéroport, le vent de l'océan.", 5.2560, -3.9260, "sud",
				Place{ID: "pb-plage", Name: "Plage de Port-Bouët", Kind: "beach", Lat: 5.2470, Lng: -3.9400, Real: true, Approx: true, Source: game.Unverified("Plage publique de Port-Bouët ; à confirmer.")},
				Place{ID: "pb-maquis", Name: "Maquis du Wharf", Kind: "maquis", Lat: 5.2520, Lng: -3.9530, Approx: true, Source: invented},
				Place{ID: "pb-aeroport", Name: "Aéroport Félix-Houphouët-Boigny", Kind: "transport", Lat: 5.2614, Lng: -3.9263, Real: true, Approx: true,
					Owner: "État de Côte d'Ivoire (concédant)", Operator: "AERIA (concession depuis 1996)",
					Source: game.Verified("Aéroport de Port-Bouët géré par AERIA depuis mai 1996 ; concession renouvelée par l'État en 2010 pour vingt ans.", srcAirport, srcAirport2)},
			),
			abidjanCommune("attecoube", "Attécoubé", "Entre lagune et forêt du Banco.", 5.3350, -4.0400, "nord",
				Place{ID: "attecoube-banco", Name: "Forêt du Banco", Kind: "nature", Lat: 5.3800, Lng: -4.0500, Real: true, Approx: true, Source: game.Unverified("Parc national du Banco ; rattachement à la commune à confirmer.")},
				fictional("attecoube-maquis", "Maquis de Santé", "maquis", "", 5.3330, -4.0350),
			),
			abidjanCommune("anyama", "Anyama", "Au nord d'Abidjan, entre ville et campagne.", 5.5000, -4.0500, "nord",
				fictional("anyama-marche", "Marché d'Anyama", "market", "", 5.4970, -4.0530),
				fictional("anyama-gare", "Gare d'Anyama", "transport", "", 5.5030, -4.0460),
				fictional("anyama-maquis", "Maquis de la route", "maquis", "", 5.4950, -4.0450),
			),
			abidjanCommune("bingerville", "Bingerville", "Ancienne capitale coloniale au bord de la lagune.", 5.3550, -3.8850, "nord",
				Place{ID: "bingerville-jardin", Name: "Jardin botanique de Bingerville", Kind: "nature", Lat: 5.3570, Lng: -3.8800, Real: true, Approx: true,
					Source: game.Unverified("Jardin botanique de l'époque coloniale ; aucune source consultée ne le confirme encore.", srcBingerville)},
				fictional("bingerville-maquis", "Maquis de la lagune", "maquis", "", 5.3520, -3.8900),
				fictional("bingerville-marche", "Marché de Bingerville", "market", "", 5.3590, -3.8880),
			),
			abidjanCommune("songon", "Songon", "À l'ouest, la lagune et les villages ébrié.", 5.3167, -4.2500, "nord",
				fictional("songon-maquis", "Maquis du bord de l'eau", "maquis", "", 5.3140, -4.2450),
				fictional("songon-marche", "Marché de Songon", "market", "", 5.3190, -4.2540),
			),
		},
	},
	{
		ID: "yamoussoukro", Name: "Yamoussoukro", Zoom: 12, Lat: 6.8276, Lng: -5.2893,
		Blurb: "La capitale politique et sa basilique géante.",
		Admin: CityAdmin{Type: "district autonome", Region: "District autonome de Yamoussoukro", Source: game.Verified("District autonome, distinct des régions.", srcVilles2026)},
		Communes: []Commune{
			{ID: "yakro-centre", Name: "Yamoussoukro", Lat: 6.8276, Lng: -5.2893, Blurb: "Larges avenues et lacs aux caïmans.",
				Admin: Admin{Type: "commune", Parent: "District autonome de Yamoussoukro", Mairie: "mairie-yakro-centre", Source: game.Verified("Commune du district autonome.", srcVilles2026)},
				Places: []Place{
					mairie("yakro-centre", "Yamoussoukro", 6.8230, -5.2830, srcVilles2026),
					{ID: "yakro-basilique", Name: "Basilique Notre-Dame de la Paix", Kind: "worship", Lat: 6.8113, Lng: -5.2970, Real: true, Approx: true,
						Source: game.Verified("Basilique de Yamoussoukro.", srcYakro, srcYakroSites)},
					{ID: "yakro-maquis", Name: "Maquis du Lac", Kind: "maquis", Lat: 6.8190, Lng: -5.2760, Approx: true, Source: invented},
					{ID: "yakro-inphb", Name: "INP-HB", Kind: "school", Lat: 6.8930, Lng: -5.2380, Real: true, Approx: true, Operator: "Institut public d'enseignement supérieur",
						Source: game.Verified("Institut national polytechnique Félix-Houphouët-Boigny.", srcINPHB)},
					{ID: "yakro-lac", Name: "Lac aux caïmans", Kind: "nature", Lat: 6.8170, Lng: -5.2690, Real: true, Approx: true,
						Source: game.Partial("Caïmans du lac artificiel du palais présidentiel.", srcYakro)},
				}},
		},
	},
	{
		ID: "bouake", Name: "Bouaké", Zoom: 12, Lat: 7.6906, Lng: -5.0303,
		Blurb: "Deuxième ville du pays, carrefour du centre.",
		Admin: CityAdmin{Type: "commune", Region: "Gbêkê", Source: game.Verified("Chef-lieu de la région du Gbêkê.", srcGbeke)},
		Communes: []Commune{
			{ID: "bouake-centre", Name: "Bouaké", Lat: 7.6906, Lng: -5.0303, Blurb: "Grand marché et ambiance du Carnaval.",
				Admin: Admin{Type: "commune", Parent: "Département de Bouaké, région du Gbêkê", Mairie: "mairie-bouake-centre", Source: game.Verified("Bouaké, chef-lieu du Gbêkê.", srcGbeke)},
				Places: []Place{
					mairie("bouake-centre", "Bouaké", 7.6930, -5.0330, srcGbeke),
					{ID: "bouake-marche", Name: "Grand marché de Bouaké", Kind: "market", Lat: 7.6890, Lng: -5.0290, Real: true, Approx: true, Source: game.Unverified("Grand marché ; à confirmer.")},
					{ID: "bouake-stade", Name: "Stade de la Paix", Kind: "sport", Lat: 7.7050, Lng: -5.0200, Real: true, Approx: true, Source: game.Unverified("Stade de Bouaké ; à confirmer.")},
					{ID: "bouake-universite", Name: "Université Alassane-Ouattara", Kind: "school", Lat: 7.6750, Lng: -5.0150, Real: true, Approx: true, Operator: "Université publique",
						Source: game.Verified("Créée en 2012 à partir de l'Université de Bouaké.", srcUniversities, srcUniversities2)},
					{ID: "bouake-chu", Name: "CHU de Bouaké", Kind: "health", Lat: 7.6980, Lng: -5.0400, Real: true, Approx: true, Operator: "Établissement public hospitalier national",
						Source: game.Verified("Transformé en établissement public hospitalier national en 2022.", srcCHUStatus)},
					fictional("bouake-gare", "Gare routière de Bouaké", "transport", "", 7.6860, -5.0360),
				}},
		},
	},
	{
		ID: "grand-bassam", Name: "Grand-Bassam", Zoom: 13, Lat: 5.2118, Lng: -3.7388,
		Blurb: "Ancienne capitale coloniale, patrimoine et plages.",
		Admin: CityAdmin{Type: "commune", Region: "Sud-Comoé", Source: game.Verified("Chef-lieu de département de la région du Sud-Comoé (chef-lieu régional : Aboisso).", srcSudComoe)},
		Communes: []Commune{
			{ID: "bassam-france", Name: "Grand-Bassam", Lat: 5.1990, Lng: -3.7380, Blurb: "Vieilles maisons coloniales face à la mer.",
				Admin: Admin{Type: "commune", Parent: "Département de Grand-Bassam, région du Sud-Comoé", Mairie: "mairie-bassam-france", Source: game.Verified("Département du Sud-Comoé.", srcSudComoe)},
				Places: []Place{
					mairie("bassam-france", "Grand-Bassam", 5.2100, -3.7400, srcSudComoe),
					{ID: "bassam-plage", Name: "Plage de Bassam", Kind: "beach", Quarter: "Quartier France", Lat: 5.1950, Lng: -3.7300, Real: true, Approx: true, Source: game.Unverified("Plage du Quartier France ; à confirmer.")},
					{ID: "bassam-maquis", Name: "Maquis de la plage", Kind: "maquis", Quarter: "Quartier France", Lat: 5.1975, Lng: -3.7450, Approx: true, Source: invented},
					{ID: "bassam-musee", Name: "Musée national du costume", Kind: "culture", Quarter: "Quartier France", Lat: 5.2000, Lng: -3.7360, Real: true, Approx: true,
						Source: game.Verified("Dans l'ancien palais du gouverneur ; la ville historique est inscrite au patrimoine mondial de l'UNESCO depuis 2012.", srcBassamMusee, srcBassamUNESCO)},
				}},
		},
	},
	{
		ID: "san-pedro", Name: "San-Pédro", Zoom: 12, Lat: 4.7485, Lng: -6.6363,
		Blurb: "Le grand port du cacao, et la plage de Monogaga.",
		Admin: CityAdmin{Type: "commune", Region: "San-Pédro", Source: game.Partial("Deuxième port du pays, district du Bas-Sassandra ; région à confirmer.", srcVilles2026)},
		Communes: []Commune{
			{ID: "sp-centre", Name: "San-Pédro", Lat: 4.7485, Lng: -6.6363, Blurb: "Port, cacao et poisson frais.",
				Admin: Admin{Type: "commune", Parent: "District du Bas-Sassandra", Mairie: "mairie-sp-centre", Source: game.Partial("District du Bas-Sassandra ; région et département à confirmer.", srcVilles2026)},
				Places: []Place{
					mairie("sp-centre", "San-Pédro", 4.7510, -6.6400, srcVilles2026),
					{ID: "sp-port", Name: "Port autonome", Kind: "office", Lat: 4.7400, Lng: -6.6150, Real: true, Approx: true, Source: game.Partial("Deuxième port du pays ; statut et gestionnaire à confirmer.", srcVilles2026)},
					{ID: "sp-plage", Name: "Plage de San-Pédro", Kind: "beach", Lat: 4.7380, Lng: -6.6500, Real: true, Approx: true, Source: game.Unverified("Plage de la ville ; à confirmer.")},
					fictional("sp-maquis", "Maquis du port", "maquis", "", 4.7450, -6.6280),
				}},
		},
	},
	{
		ID: "man", Name: "Man", Zoom: 12, Lat: 7.4125, Lng: -7.5538,
		Blurb: "La ville aux dix-huit montagnes.",
		Admin: CityAdmin{Type: "commune", Region: "Tonkpi", Source: game.Verified("Man, chef-lieu de la région du Tonkpi (district des Montagnes).", srcRegions)},
		Communes: []Commune{
			{ID: "man-centre", Name: "Man", Lat: 7.4125, Lng: -7.5538, Blurb: "Montagnes, cascades et danses masquées.",
				Admin: Admin{Type: "commune", Parent: "Département de Man, région du Tonkpi", Mairie: "mairie-man-centre", Source: game.Verified("Chef-lieu du Tonkpi.", srcRegions)},
				Places: []Place{
					mairie("man-centre", "Man", 7.4150, -7.5560, srcRegions),
					{ID: "man-dent", Name: "La Dent de Man", Kind: "nature", Lat: 7.4580, Lng: -7.5170, Real: true, Approx: true, Source: game.Unverified("Sommet emblématique ; aucune source consultée ne le cite encore.")},
					{ID: "man-cascade", Name: "La Cascade", Kind: "nature", Lat: 7.3900, Lng: -7.5870, Real: true, Approx: true, Source: game.Partial("Man est connue pour ses chutes d'eau ; site précis à confirmer.", srcYakroSites)},
					{ID: "man-marche", Name: "Marché de Man", Kind: "market", Lat: 7.4100, Lng: -7.5530, Real: true, Approx: true, Source: game.Unverified("Marché de la ville ; à confirmer.")},
				}},
		},
	},
	{
		ID: "korhogo", Name: "Korhogo", Zoom: 12, Lat: 9.4580, Lng: -5.6296,
		Blurb: "Capitale du pays sénoufo, toiles et tissages.",
		Admin: CityAdmin{Type: "commune", Region: "Poro", Source: game.Verified("Chef-lieu de la région du Poro.", srcPoro)},
		Communes: []Commune{
			{ID: "korhogo-centre", Name: "Korhogo", Lat: 9.4580, Lng: -5.6296, Blurb: "Artisans, toiles de Korhogo et chaleur du nord.",
				Admin: Admin{Type: "commune", Parent: "Département de Korhogo, région du Poro", Mairie: "mairie-korhogo-centre", Source: game.Verified("Chef-lieu du Poro.", srcPoro)},
				Places: []Place{
					mairie("korhogo-centre", "Korhogo", 9.4600, -5.6330, srcPoro),
					{ID: "korhogo-marche", Name: "Grand marché", Kind: "market", Lat: 9.4560, Lng: -5.6310, Real: true, Approx: true, Source: game.Unverified("Grand marché ; à confirmer.")},
					{ID: "korhogo-mosquee", Name: "Grande mosquée", Kind: "worship", Lat: 9.4600, Lng: -5.6270, Real: true, Approx: true, Source: game.Unverified("Mosquée principale ; nom exact à confirmer.")},
					{ID: "korhogo-universite", Name: "Université Peleforo-Gon-Coulibaly", Kind: "school", Lat: 9.4400, Lng: -5.6400, Real: true, Approx: true, Operator: "Université publique",
						Source: game.Verified("Université de plein exercice depuis 2012.", srcUniversities, srcUniversities2)},
				}},
		},
	},
	{
		ID: "daloa", Name: "Daloa", Zoom: 12, Lat: 6.8774, Lng: -6.4502,
		Blurb: "La cité des antilopes, au cœur de la boucle du cacao.",
		Admin: CityAdmin{Type: "commune", Region: "Haut-Sassandra", Source: game.Verified("Chef-lieu de la région du Haut-Sassandra.", srcRegions)},
		Communes: []Commune{
			{ID: "daloa-centre", Name: "Daloa", Lat: 6.8774, Lng: -6.4502, Blurb: "Commerce, cacao et bonne humeur.",
				Admin: Admin{Type: "commune", Parent: "Département de Daloa, région du Haut-Sassandra", Mairie: "mairie-daloa-centre", Source: game.Verified("Chef-lieu du Haut-Sassandra.", srcRegions)},
				Places: []Place{
					mairie("daloa-centre", "Daloa", 6.8800, -6.4530, srcRegions),
					{ID: "daloa-marche", Name: "Marché de Daloa", Kind: "market", Lat: 6.8760, Lng: -6.4500, Real: true, Approx: true, Source: game.Unverified("Marché de la ville ; à confirmer.")},
					{ID: "daloa-maquis", Name: "Maquis du centre", Kind: "maquis", Lat: 6.8800, Lng: -6.4460, Approx: true, Source: invented},
					{ID: "daloa-universite", Name: "Université Jean-Lorougnon-Guédé", Kind: "school", Lat: 6.8930, Lng: -6.4300, Real: true, Approx: true, Operator: "Université publique",
						Source: game.Verified("Université de plein exercice depuis 2012, tournée vers l'agroforesterie.", srcUniversities, srcUniversities2)},
				}},
		},
	},
}

func FindCity(id string) (City, bool) {
	for _, c := range Cities {
		if c.ID == id {
			return c, true
		}
	}
	return City{}, false
}

func (c City) Commune(id string) (Commune, bool) {
	for _, cm := range c.Communes {
		if cm.ID == id {
			return cm, true
		}
	}
	return Commune{}, false
}

// FindPlace looks a place up across the whole map.
func FindPlace(id string) (City, Commune, Place, bool) {
	for _, c := range Cities {
		for _, cm := range c.Communes {
			for _, p := range cm.Places {
				if p.ID == id {
					return c, cm, p, true
				}
			}
		}
	}
	return City{}, Commune{}, Place{}, false
}

// Trip returns the game minutes and FCFA fare to go from one commune to
// another: woro-woro/gbaka inside a city, intercity bus between cities.
func Trip(fromCity City, fromCommune Commune, toCity City, toCommune Commune) (minutes int64, fare int) {
	km := distanceKm(fromCommune.Lat, fromCommune.Lng, toCommune.Lat, toCommune.Lng)
	if fromCity.ID == toCity.ID {
		if fromCommune.ID == toCommune.ID {
			return 0, 0
		}
		return 20 + int64(km*4), 300 + 50*int(km/3)
	}
	// Roads are not straight: ~1.3× the crow-flies distance at 60 km/h.
	road := km * 1.3
	return int64(road) + 30, roundTo(road*25, 500)
}

func distanceKm(lat1, lng1, lat2, lng2 float64) float64 {
	const r = 6371
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * r * math.Asin(math.Sqrt(a))
}

func roundTo(v float64, step int) int {
	n := int(math.Round(v/float64(step))) * step
	if n < step {
		return step
	}
	return n
}
