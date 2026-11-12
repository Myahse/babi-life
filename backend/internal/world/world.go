// Package world describes the map of Côte d'Ivoire: cities, their communes
// and the places a Sim can visit. It is static content, seeded in code: every
// record says whether it is real or made up for the game, and where the real
// ones were checked (see Audit for what still needs work).
package world

import (
	"fmt"
	"math"
	"slices"

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
	Closed string `json:"closed,omitempty"`
	// Faith: a place of worship's (game.FaithOf): catholique, protestant, evangelique, musulman.
	Faith string `json:"faith,omitempty"`
	// Parent: a place inside another (a club in the Rue Princesse), drawn by it at its Slot.
	Parent string       `json:"parent,omitempty"`
	Slot   int          `json:"slot,omitempty"`
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
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Blurb string  `json:"blurb"`
	Lat   float64 `json:"lat"`
	Lng   float64 `json:"lng"`
	Admin Admin   `json:"admin"`
	// Woro: the colour of its woro-woro (Abidjan), set in taxis.go.
	Woro   *Woro   `json:"woro,omitempty"`
	Places []Place `json:"places"`
	// MapCount: how many more places the map has here (osm.go: churches, shops, maquis…), sent a few at a time.
	MapCount int `json:"mapCount,omitempty"`
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
	srcOSM             = "https://www.openstreetmap.org/"
	srcOSMBlockhauss   = "https://www.openstreetmap.org/relation/4525193"
	srcKarting         = "https://www.openstreetmap.org/way/333399974"
	srcKarting2        = "https://abidjan4you.com/en/kids-activities/karting"
	srcYopougon        = "https://fr.wikipedia.org/wiki/Yopougon"
	srcYopBitume2026   = "https://www.koaci.com/article/2026/07/12/cote-divoire/politique/cote-divoire-independance-a-yopougon-le-gouvernement-accorde-55-kilometres-de-voies-a-bitumer-dans-la-commune_198503.html"
	srcMarcheSelmer    = "https://news.abidjan.net/articles/426900/inauguration-du-marche-dominique-ouattara-de-selmer-dr-yao-yao-bertin-maire-de-yopougon-le-marche-est-une-expression-de-la-vie"
	srcFicgayo2013     = "https://connectionivoirienne.net/2013/06/27/un-hotel-communal-bientot-construit-sur-la-place-ficgayo-kafana-kone/"
	srcFicgayo2026     = "https://www.koaci.com/article/2026/08/05/cote-divoire/politique/cote-divoire-yopougon-la-place-ficgayo-va-changer-de-nom-le-projet-officialise-le-6-aout_199269.html"
	srcGareSiporex     = "https://www.koaci.com/article/2026/03/04/cote-divoire/societe/cote-divoire-yopougon-siporex-un-comite-mis-en-place-pour-veiller-a-la-proprete-de-la-gare-et-lutter-contre-les-installations-des-fumoirs-le-depute-maire-de-yopougon-adama-bictogo-veut-donner-une-nouv_194834.html"
	srcStAndre         = "https://gcatholic.org/churches/africa/6581"
	srcKoute           = "https://www.aip.ci/?p=349306"
	srcKoute2          = "https://www.fratmat.info/article/230709/societe/yopougon-koute-apres-lobtention-de-son-arrete-le-chef-du-village-appelle-a-la-cohesion-pour-le-developpement"
	srcLyceeProYop     = "https://fr.allafrica.com/stories/202210200659.html"
	srcBanco           = "https://fr.wikipedia.org/wiki/Parc_national_du_Banco"
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
	srcOSMBouakeGare   = "https://www.openstreetmap.org/#map=18/7.68909/-5.02848"
	srcNziDecret       = "https://leap.unep.org/en/countries/ci/national-legislation/decret-ndeg-2018-511-du-30-mai-2018-portant-creation-de-la"
	srcNziAIP          = "https://www.koaci.com/article/2025/03/10/cote-divoire/societe/cote-divoire-deux-braconniers-apprehendes-au-nzi-river-lodges-les-investigations-de-la-gendarmerie-de-brobo-decriees-par-le-responsable-de-cette-reserve_185106.html"
	srcBroboOSM        = "https://www.openstreetmap.org/search?query=Brobo"
	srcSPPortCacao     = "https://www.teamfrance-export.fr/infos-sectorielles/11269/11269-port-de-san-pedro-de-belles-perspectives-de-developpement"
	srcTaiUNESCO       = "https://whc.unesco.org/fr/list/195"
	srcTaiEcotourisme  = "https://wildchimps.org/projects/ecotourism.html"
	srcKorhogoArtisans = "https://www.fratmat.info/article/236441/regions/korhogo/korhogo-quand-la-can-suscite-lespoir-chez-les-artisans"
	srcWaraniene       = "https://doaj.org/article/f03ff5a3cd174183803a7bc2222dfe2b"
	srcBereby          = "https://www.openstreetmap.org/search?query=Baie%20des%20Sir%C3%A8nes"
	srcTonkpi          = "https://www.openstreetmap.org/search?query=Mont%20Tonkpi"
	srcLianes          = "https://www.openstreetmap.org/search?query=Pont%20de%20lianes%20Vatouo"
	srcGbepleu         = "https://www.openstreetmap.org/search?query=For%C3%AAt%20sacr%C3%A9e%20de%20Gb%C3%AApleu"
	srcDaloaWorship    = "https://www.openstreetmap.org/search?query=Daloa%20cath%C3%A9drale%20Christ-Roi"
	srcLobo            = "https://www.openstreetmap.org/search?query=Lobo%20Haut-Sassandra"
	srcBridges         = game.SrcBridges
	srcSococe          = "https://business.abidjan.net/pages-jaunes/details-1-services-aux-entreprises-39-commerce-general/10137-club-sococe-sa"
	srcSococePharma    = "https://annuaireci.com/entreprises/pharmacie-des-deux-plateaux-grde-cocody-cote-divoire/"
	srcPlayceToyota    = "https://www.toyota-tsusho.com/english/press/detail/170704_003995.html"
	srcPlayceFA        = "https://financialafrik.com/2017/06/29/cote-divoire-playce-palmeraie-une-nouvelle-etape-du-deploiement-de-cfao-retail"
	srcPlayceMarcory   = "https://www.financialafrik.com/2015/12/18/cote-divoire-playce-centre-commercial-de-nouvelle-generation-est-inaugure-ce-jour-a-abidjan/"
	srcCFAORetail      = "https://www.foodbusinessmea.com/cfao-consumer-retail-expands-footprint-in-ivory-coast-acquires-leader-prices-stores/"
	srcBurgerKing      = "https://www.qsrweb.com/news/burger-king-to-open-first-ivory-coast-location/"
	srcHotelIvoire     = "https://en.wikipedia.org/wiki/Village_Ivoire"
	srcRadisson        = "https://www.businesstraveller.com/news/radisson-blu-opens-abidjan-airport-property/"
	srcHotelsAbj       = "https://www.climate-chance.org/wp-content/uploads/2026/06/hotels-plateau-cocody-marcory.docx.pdf"
	srcOrangeVillage   = "https://worldarchitecture.org/architecture-news/enhnz/the-new-headquarters-of-orange-village-in-abidjan-c%C3%B4te-d-ivoire-by-koffi-diabat-architects.html"
	srcOrangeVillage2  = "https://www.koaci.com/article/2022/01/14/cote-divoire/economie/orange-cote-divoire-inaugure-orange-village-son-nouveau-siege-a-abidjan-et-confirme-son-attachement-et-ses-ambitions-pour-la-cote-divoire_156877.html"
	srcPyramide        = "https://en.wikipedia.org/wiki/La_Pyramide_(building)"
	srcMusee           = "https://en.wikipedia.org/wiki/Mus%C3%A9e_des_Civilisations_de_C%C3%B4te_d%27Ivoire"
	srcMusee2          = "https://mainlymuseums.com/post/1245/mus-e-des-civilisations-de-c-te-d-ivoire/"
	srcAssemblee       = "https://en.wikipedia.org/wiki/National_Assembly_(Ivory_Coast)"
	srcPalaisCulture   = "https://en.wikipedia.org/wiki/Culture_Palace_of_Abidjan"
	srcPalaisCulture2  = "https://connectionivoirienne.net/2012/11/28/palais-de-la-culture-la-salle-anoumabo-dans-un-etat-inquietant/"
	srcMarcheTreich    = "https://news.abidjan.net/articles/614296/dossier-nos-marches-implantation-specificites-histoire"
	srcMarcheTreich2   = "https://news.abidjan.net/articles/514019/a-laffiche-treichville-la-cite-aux-grands-espaces-commerciaux"
	srcMarcheCocody    = "https://connectionivoirienne.net/2018/06/19/nouveau-marche-de-cocody-en-cote-divoire-70-des-places-occupees-six-mois-apres-la-livraison/"
	srcMarcheCocody2   = "https://connectionivoirienne.net/2017/08/04/cote-divoire-visite-guidee-du-chantier-en-finition-du-nouveau-centre-commercial-de-cocody/"
	srcMarcheCocodyOSM = "https://www.openstreetmap.org/way/630374575"
	srcTourIvoireOSM   = "https://www.openstreetmap.org/way/1247592584"
	srcTourIvoire      = "https://www.expat.com/fr/immobilier/afrique/cote-d-ivoire/44-terrains-a-vendre/798755-a-vendre-terrain-strategique-de-1-135-m2-a-koumassi-en-bordure-du-boulevard-houphouet-boigny-ancien-vge.html"
	srcCathedrale      = "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Saint-Paul_d%27Abidjan"
	srcCathedrale2     = "https://en.wikipedia.org/wiki/St._Paul%27s_Cathedral,_Abidjan"
	srcMosqueeM6       = "https://fr.allafrica.com/stories/202404050438.html"
	srcMosqueeM62      = "https://fr.hespress.com/361344-en-images-la-mosquee-mohammed-vi-un-chef-doeuvre-architectural-au-coeur-dabidjan.html"
	srcPyramide2       = "https://structurae.net/en/structures/la-pyramide"
	srcBoulay          = "https://en.wikipedia.org/wiki/%C3%8Ele_Boulay"
	srcCinemas2024     = "https://connectionivoirienne.net/2024/06/24/les-abidjanais-redecouvrent-les-plaisirs-des-salles-de-cinema/"
	srcPatheAbj        = "https://www.aip.ci/cote-divoire-aip-le-groupe-pathe-souvre-aux-cinephiles-abidjanais/"
	srcCapSudOSM       = "https://www.openstreetmap.org/way/331986589"
	srcSococeOSM       = "https://www.openstreetmap.org/way/329764129"
	srcParcExpo        = "https://www.fratmat.info/article/230674/economie/inauguration-du-parc-des-expositions-un-reve-dhouphouet-boigny-depuis-1985-qui-se-realise"
	srcParcExpo2       = "https://news.abidjan.net/articles/717535/parc-dexposition-dabidjan-un-edifice-devenementiels-dote-dequipements-de-pointe"
	srcParcExpoOSM     = "https://www.openstreetmap.org/way/1026355392"
	srcTourF           = "https://fr.wikipedia.org/wiki/Tour_F"
	srcTourF2          = "https://pfoafrica.com/projets/la-tour-f/"
	srcTourFOSM        = "https://www.openstreetmap.org/way/1470146068"
	srcCiteAdminOSM    = "https://www.openstreetmap.org/way/340336729"
	srcBoulayAIP       = "https://www.aip.ci/?p=338986"
	srcBlockhauss      = "https://news.abidjan.net/articles/374315/le-chef-de-letat-aux-populations-de-blockhauss-hier-on-ne-doit-pas-vous-deposseder-totalement-de-vos-terres"
	srcCocodyVillages  = "https://participate.oidp.net/processes/award2024/f/288/proposals/3254"
	srcUCAO            = "https://annuaireci.com/entreprises/ucao-uua-universite-catholique-de-lafrique-de-louest-unite-universitaire-a-abidjan-abidjan-cote-divoire/"
	srcUCAO2           = "https://www.goafricaonline.com/ci/62662-ucao-uua-enseignement-superieur-universite-abidjan-cote-ivoire"
	srcIUA             = "https://timeshighereducation.com/cn/node/720903"
	srcZoo             = "https://news.abidjan.net/articles/702208/cote-divoire-le-zoo-national-dabidjan-fait-peau-neuve"
	srcZoo2            = "https://www.koaci.com/article/2021/12/20/cote-divoire/societe/cote-divoire-reouverture-officielle-du-zoo-grace-au-concours-de-la-premiere-dame-augmentation-du-prix-du-ticket-annoncee_156315.html"
	srcZoo3            = "https://afrique.le360.ma/cote-divoire/societe/2020/09/09/31815-cote-divoire-le-zoo-dabidjan-ferme-apres-une-serie-de-scandales-31815/"
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
	all := append(append(append([]Place{mairie(id, name, lat+0.0025, lng-0.0035, srcAbidjanDistrict)}, places...), coiffeurs(id, lat, lng)...), services(id, name, lat, lng)...)
	for i := range all {
		if at, ok := ashore[all[i].ID]; ok {
			all[i].Lat, all[i].Lng = at[0], at[1]
		}
	}
	return Commune{ID: id, Name: name, Blurb: blurb, Lat: lat, Lng: lng,
		Admin:  Admin{Type: "commune", Parent: "District autonome d'Abidjan", Mairie: "mairie-" + id, Bank: bank, Source: src},
		Places: all}
}

// ashore: the game's own shops whose usual spot round their commune's centre
// (coiffeurs, services) falls in the lagoon, set on dry ground by a street
// instead (OpenStreetMap's water and roads, 2026-10-25).
var ashore = map[string][2]float64{
	"attecoube-salon": {5.33549, -4.03872},
}

// services: every commune has its pharmacy and its police station (where
// the pharmacists and the police work, game.Careers), named for the game.
func services(communeID, name string, lat, lng float64) []Place {
	pharmacies := []string{"Pharmacie du Marché", "Pharmacie Sainte-Anne", "Pharmacie de la Paix", "Pharmacie de l'Espoir"}
	n := 0
	for _, r := range communeID {
		n += int(r)
	}
	return []Place{
		fictional(communeID+"-pharmacie", pharmacies[n%len(pharmacies)], "pharmacie", "", lat+0.0012, lng-0.0018),
		fictional(communeID+"-police", "Commissariat de police de "+name, "police", "", lat-0.0016, lng-0.0026),
	}
}

// coiffeurs: every quarter has its barbier and its salon de coiffure,
// invented for the game.
func coiffeurs(communeID string, lat, lng float64) []Place {
	barbiers := []string{"Barbier « Le Dégradé »", "Barbier « Top Coupe »", "Barbier « Chez Prince »", "Barbier « Le Contour »"}
	salons := []string{"Salon « Belle Go »", "Salon « Tantie Awa »", "Salon « Mami Coiffure »", "Salon « Doigts de fée »"}
	n := 0
	for _, r := range communeID {
		n += int(r)
	}
	return []Place{
		fictional(communeID+"-barbier", barbiers[n%len(barbiers)], "barbier", "", lat-0.0020, lng+0.0015),
		fictional(communeID+"-salon", salons[n%len(salons)], "salon", "", lat+0.0018, lng+0.0030),
	}
}

// withMairie puts a commune's mairie where it really is, when that is known.
func withMairie(c Commune, lat, lng float64, src *game.Source) Commune {
	for i := range c.Places {
		if c.Places[i].ID == c.Admin.Mairie {
			c.Places[i].Lat, c.Places[i].Lng, c.Places[i].Source, c.Places[i].Approx = lat, lng, src, false
		}
	}
	return c
}

// townHalls: the mairies where OpenStreetMap has them (the town hall's point,
// checked on 2026-10-25), by commune; the others stay placed by their commune.
var townHalls = map[string]struct {
	Lat, Lng float64
	Where    string
}{
	"plateau":        {5.32393, -4.02411, "avenue Charles-Konan-Banny"},
	"cocody":         {5.33276, -4.00384, "boulevard André-Latrille, à Val Doyen"},
	"adjame":         {5.34287, -4.02662, "rue Benjamin-Amoa, à Saint-Michel"},
	"abobo":          {5.42117, -4.01670, "au rond-point de la Mairie, à Sagbé"},
	"treichville":    {5.31021, -4.01289, "rue du Havre"},
	"marcory":        {5.29055, -3.98985, "avenue Noël-Nemin, Zone 4"},
	"koumassi":       {5.28851, -3.96263, "l'hôtel communal"},
	"port-bouet":     {5.25910, -3.96525, "l'hôtel communal, à Petit-Bassam"},
	"attecoube":      {5.34778, -4.03423, "avenue des Bidjans, quartier École"},
	"bingerville":    {5.35675, -3.88985, "rue Adjê-Pêssi"},
	"songon":         {5.32390, -4.19346, "boulevard Koui-Mamadou, à Songon Gare"},
	"yakro-centre":   {6.83589, -5.26657, "l'hôtel de ville, route de Mami-Adjoua"},
	"bassam-france":  {5.19699, -3.73723, "rue Marcel-Monnier, Quartier France"},
	"bouake-centre":  {7.67896, -5.03042, "l'hôtel de ville, avenue Gabriel-Dadié"},
	"sp-centre":      {4.73555, -6.62224, "boulevard Félix-Houphouët-Boigny"},
	"man-centre":     {7.40508, -7.55702, "sur l'A8"},
	"korhogo-centre": {9.45179, -5.63354, "rue des Banques, à Koko"},
	"daloa-centre":   {6.88615, -6.45153, "route de Man, au Commerce"},
}

func mairie(communeID, communeName string, lat, lng float64, src string) Place {
	p := Place{ID: "mairie-" + communeID, Name: "Mairie " + de(communeName), Kind: "mairie", Lat: lat, Lng: lng, Real: true, Approx: true,
		Operator: "Commune " + de(communeName), Source: game.Partial(mairieNote, src)}
	if t, ok := townHalls[communeID]; ok {
		p.Lat, p.Lng, p.Approx = t.Lat, t.Lng, false
		p.Source = game.Partial("La mairie "+de(communeName)+", "+t.Where+" ; position d'après OpenStreetMap.", src, srcOSM)
	}
	return p
}

// de: "de Cocody", "d'Adjamé", "d'Abobo".
func de(name string) string {
	// The Plateau takes its article: « la mairie du Plateau ».
	if name == "Plateau" {
		return "du Plateau"
	}
	switch name[0] {
	case 'A', 'E', 'I', 'O', 'U':
		return "d'" + name
	}
	if len(name) > 1 && name[:2] == "É" {
		return "d'" + name
	}
	return "de " + name
}

// inRue: a club of the game in the Rue Princesse, at one of its slots (the lane's buildings, from the arch).
func inRue(id, name string, slot int) Place {
	return Place{ID: id, Name: name, Kind: "club", Lat: 5.34787, Lng: -4.07777, Quarter: "Selmer", Approx: true, Parent: "yop-rue-princesse", Slot: slot, Source: invented}
}

func fictional(id, name, kind, quarter string, lat, lng float64) Place {
	return Place{ID: id, Name: name, Kind: kind, Lat: lat, Lng: lng, Quarter: quarter, Approx: true, Source: invented}
}

// babiBurger is an outlet of the game's burger chain where the map has a
// Burger King: its node on OpenStreetMap gives the position.
func babiBurger(id, name, quarter string, lat, lng float64, where string, node int64) Place {
	return Place{ID: id, Name: name, Kind: "restaurant", Quarter: quarter, Lat: lat, Lng: lng, Real: true,
		Source: game.Partial(fmt.Sprintf("Nom du jeu pour le Burger King de %s ; activité actuelle à confirmer. Position d'après OpenStreetMap (nœud %d).", where, node),
			srcBurgerKing, fmt.Sprintf("https://www.openstreetmap.org/node/%d", node))}
}

var Cities = []City{
	{
		ID: "abidjan", Name: "Abidjan", Zoom: 11.2, Lat: 5.33, Lng: -4.01,
		Blurb: "Babi, la perle des lagunes. Ça ne dort jamais.",
		Admin: CityAdmin{Type: "district autonome", Region: "District autonome d'Abidjan", Source: abidjanAdmin},
		Communes: []Commune{
			abidjanCommune("plateau", "Plateau", "Les tours, les bureaux, les costumes.", 5.3237, -4.0197, "nord",
				fictional("plateau-basket", "Terrain de basket du Plateau", "sport", "", 5.3250, -4.0150),
				// A hard tennis court among the offices (game.Courts: tennis, two players).
				fictional("plateau-tennis", "Court de tennis du Plateau", "sport", "", 5.3268, -4.0128),
				fictional("plateau-cine", "Ciné du Plateau", "cinema", "", 5.3220, -4.0180),
				Place{ID: "plateau-tours", Name: "Cité administrative", Kind: "office", Lat: 5.33424, Lng: -4.02257, Real: true,
					Source: game.Partial("Les tours administratives A à E du Plateau, entre l'avenue Carde et l'avenue Camille Aliali ; la place est à la tour A, d'après OpenStreetMap.", srcCiteAdminOSM)},
				Place{ID: game.TourFID, Name: "Chantier de la Tour F", Kind: "chantier", Quarter: "Cité administrative", Lat: 5.33559, Lng: -4.02222, Real: true,
					Owner: "État de Côte d'Ivoire", Operator: "Ministère de la Construction, du Logement et de l'Urbanisme",
					Source: game.Verified("La Tour F de la Cité administrative, sixième tour après les tours A à E (architecte Pierre Fakhoury) : 76 étages de bureaux, environ 333 m de tour, une lanterne vitrée de 30 m sous le toit-terrasse, la flèche à 421 m ; un plan qui s'affine en montant, deux grandes faces symétriques dessinées comme un masque africain, une double peau de verre (16 000 panneaux), un noyau de béton. Chantier commencé en juillet 2021, structure achevée, livraison annoncée pour 2026. Dans le jeu, le verre monte encore sur la façade et les grues sont sur le toit. Emprise et position d'après OpenStreetMap.", srcTourF, srcTourF2, srcTourFOSM)},
				Place{ID: "plateau-cathedrale", Name: "Cathédrale Saint-Paul", Kind: "worship", Lat: 5.33297, Lng: -4.02006, Real: true,
					Source: game.Verified("Cathédrale du Plateau (Aldo Spirito, consacrée en 1985) : un triangle de 4 200 m², 4 500 places assises en gradins autour de l'autel, une tour en croix de 70 m tenue par 7 haubans, les vitraux de Roberto Franzosi (370 m²). Face au Palais de justice ; position d'après OpenStreetMap.", srcCathedrale, srcCathedrale2)},
				Place{ID: "plateau-tribunal", Name: "Palais de justice", Kind: "tribunal", Lat: 5.33133, Lng: -4.02019, Real: true,
					Source: game.Partial("Le Palais de justice d'Abidjan, boulevard Angoulvant au Plateau, en face de la cathédrale Saint-Paul ; position d'après OpenStreetMap (le Palais de justice du Plateau, avenue John-Creppy).", srcCathedrale, srcOSM)},
				Place{ID: "plateau-presidence", Name: "Palais présidentiel", Kind: "presidence", Lat: 5.31921, Lng: -4.02371, Real: true,
					Owner: "État de Côte d'Ivoire", Source: game.Partial("Le Palais présidentiel du Plateau, à la pointe sud de la commune, boulevard Clozel au bord de la lagune ; position d'après le point d'intérêt de la carte (OpenStreetMap). Dans le jeu, le président élu, ses ministres et les députés y siègent (politics).", srcCathedrale, srcOSM)},
				Place{ID: "plateau-pyramide", Name: "La Pyramide", Kind: "office", Lat: 5.32231, Lng: -4.01643, Real: true,
					Source: game.Verified("Immeuble de bureaux du Plateau (Rinaldo Olivieri, 1973) : pyramide à gradins de 15 niveaux, environ 62 m. Position d'après OpenStreetMap (le bâtiment « La Pyramide »).", srcPyramide, srcPyramide2, srcOSM)},
				Place{ID: "plateau-poulman", Name: "Hôtel Poulman", Kind: "hotel", Lat: 5.32216, Lng: -4.01379, Real: true,
					Source: game.Partial("Nom du jeu pour le Pullman Abidjan (5 étoiles, rue Abdoulaye Fadiga, Plateau) ; position d'après OpenStreetMap, au bord du boulevard, voisin du Noom.", srcHotelsAbj, srcOSM)},
				Place{ID: "plateau-noum", Name: "Noum Hôtel", Kind: "hotel", Lat: 5.32343, Lng: -4.01502, Real: true,
					Source: game.Partial("Nom du jeu pour le Noom Hôtel (5 étoiles, boulevard Général-de-Gaulle, Plateau) ; position d'après OpenStreetMap, à côté du Pullman.", srcHotelsAbj, srcOSM)},
				Place{ID: "plateau-stade", Name: "Stade Félix-Houphouët-Boigny", Kind: "stade", Lat: 5.32831, Lng: -4.01852, Real: true,
					Source: game.Verified("Stade du Plateau, ouvert en 1961 sur le site du stade Géo-André ; capacité variable selon les sources (27 000 à 40 000). Position d'après OpenStreetMap.", srcVenues, srcStadeFHB, srcOSM)},
				Place{ID: game.MuseeID, Name: "Musée des Civilisations", Kind: "culture", Lat: 5.33355, Lng: -4.02417, Real: true, Operator: "Ministère de la Culture",
					Source: game.Partial("Musée d'État du Plateau, avenue Nangui-Abrogoua : né en 1942 d'un centre artisanal, plus de 15 000 pièces de toutes les régions (statues, masques, instruments de musique, poids à peser l'or, portes sculptées, regalia, textiles), exposées sur un seul niveau ; pillé en 2011, rouvert en juillet 2017. La salle du jeu est dessinée pour le jeu ; position d'après OpenStreetMap.", srcMusee, srcMusee2, srcOSM)},
				babiBurger("plateau-babi-burger", "Babi Burger Plateau", "", 5.32173, -4.01732, "l'avenue Jean-Delafosse", 4572949935),
				Place{ID: game.AssembleeID, Name: "Assemblée nationale", Kind: "assemblee", Lat: 5.32883, Lng: -4.02015, Real: true, Owner: "État de Côte d'Ivoire",
					Source: game.Partial("Siège de l'Assemblée nationale, avenue Jeanne-Gervais au Plateau : 255 députés élus dans 205 circonscriptions. Le bâtiment et l'hémicycle du jeu sont dessinés pour le jeu ; position d'après OpenStreetMap.", srcAssemblee, srcOSM)},
			),
			abidjanCommune("cocody", "Cocody", "Résidences, université et Riviera.", 5.3480, -3.9870, "nord",
				Place{ID: "cocody-danga", Name: "Maquis de Danga", Kind: "maquis", Quarter: "Danga", Lat: 5.3420, Lng: -4.0010, Approx: true, Source: invented},
				Place{ID: "cocody-ufhb", Name: "Terrain de l'Université", Kind: "sport", Lat: 5.3460, Lng: -3.9890, Approx: true, Source: invented},
				fictional("cocody-basket", "Terrain de basket de la Riviera", "sport", "Riviera", 5.3540, -3.9700),
				// The tennis club: its clay courts, its club house (game.Courts: tennis, two players).
				fictional("cocody-tennis", "Club de tennis de Cocody", "sport", "Riviera", 5.3505, -3.9765),
				fictional("cocody-cine", "Ciné Le Baobab", "cinema", "Riviera", 5.3500, -3.9760),
				Place{ID: "cocody-riviera", Name: "Bureaux de la Riviera", Kind: "office", Quarter: "Riviera", Lat: 5.3560, Lng: -3.9640, Approx: true, Source: invented},
				Place{ID: "cocody-universite", Name: "Université Félix-Houphouët-Boigny", Kind: "universite", Lat: 5.34274, Lng: -3.98713, Real: true, Operator: "Université publique",
					Source: game.Verified("Ex-Université de Cocody (1964), la plus grande université publique du pays. Position d'après OpenStreetMap.", srcUniversities, srcUniversities2, srcOSM)},
				Place{ID: "cocody-chu", Name: "CHU de Cocody", Kind: "health", Lat: 5.34207, Lng: -3.99361, Real: true, Operator: "Établissement public hospitalier national",
					Source: game.Verified("Transformé en établissement public hospitalier national en 2022. Position d'après OpenStreetMap.", srcCHUStatus, srcOSM)},
				Place{ID: "cocody-chu-angre", Name: "CHU d'Angré", Kind: "health", Quarter: "Angré", Lat: 5.40102, Lng: -3.95744, Real: true, Operator: "Établissement public hospitalier national",
					Source: game.Partial("4e CHU d'Abidjan, 250 lits ; boulevard Charles-Bauza-Donwahi à Angré (Cocody) ; position d'après OpenStreetMap.", srcCHUAngre, srcCHUStatus, srcOSM)},
				Place{ID: "cocody-sococe", Name: "Sococé", Kind: "mall", Quarter: "Deux-Plateaux", Lat: 5.37286, Lng: -3.99925, Real: true,
					Source: game.Partial("Centre commercial des Deux-Plateaux, près du boulevard Latrille (repère d'annuaires) ; position d'après OpenStreetMap.", srcSococe, srcSococePharma, srcSococeOSM)},
				// Its cinema, of the game's chain (game/cinema.go): one screen of 180 seats, like the real one.
				Place{ID: "cocody-kineo", Name: "Kinéo Sococé", Kind: "cinema", Quarter: "Deux-Plateaux", Lat: 5.37351, Lng: -3.99930, Real: true,
					Source: game.Partial("Nom du jeu pour la salle de cinéma du centre commercial Sococé (180 places), aux Deux-Plateaux ; position d'après OpenStreetMap (le cinéma du centre).", srcCinemas2024, srcSococeOSM, srcOSM)},
				Place{ID: "cocody-playce", Name: "PlaYce Palmeraie", Kind: "mall", Quarter: "Riviera Palmeraie", Lat: 5.37353, Lng: -3.93359, Real: true,
					Operator: "CFAO (CFAO Consumer Retail)",
					Source:   game.Verified("Centre commercial ouvert le 29 juin 2017 à Cocody-Riviera Palmeraie (Génie 2000) : 29 000 m², Carrefour Market, 24 enseignes ; exploité par CFAO. Position d'après OpenStreetMap (le point « PlaYce Palmeraie » de la carte).", srcPlayceToyota, srcPlayceFA, srcCFAORetail)},
				Place{ID: "cocody-hotel-ivoire", Name: "Hôtel Ivoire", Kind: "hotel", Lat: 5.32648, Lng: -4.00432, Real: true,
					Source: game.Partial("Hôtel du complexe Village Ivoire, boulevard Hassan II à Cocody, face à la lagune et au Plateau ; exploitant actuel à confirmer ; position d'après OpenStreetMap.", srcHotelIvoire, srcOSM)},
				Place{ID: "cocody-oranjo", Name: "Oranjo Village", Kind: "office", Quarter: "Riviera Golf", Lat: 5.33110, Lng: -3.96908, Real: true, Operator: "Oranjo CI (opérateur du jeu)",
					Source: game.Partial("Nom du jeu pour Orange Village, siège d'Orange Côte d'Ivoire inauguré le 14 janvier 2022 à la Riviera Golf, au bord de la lagune (Koffi & Diabaté Architectes : sept niveaux en anneaux de 68 m de diamètre, double peau en balle de golf). Position d'après OpenStreetMap (le siège, avenue du Golf).", srcOrangeVillage, srcOrangeVillage2, srcOSM)},
				Place{ID: "cocody-baie", Name: "Baie de Cocody", Kind: "lagune", Lat: 5.33273, Lng: -4.01362, Real: true, Approx: true,
					Source: game.Partial("Baie de la lagune Ébrié entre Cocody et le Plateau, que domine l'Hôtel Ivoire, traversée par le pont Alassane-Ouattara (inauguré le 12 août 2023). La promenade du jeu est sur la rive de Cocody, au bord du chenal, juste au sud du pont, sur les terres gagnées sur la baie par son aménagement (quais de promenade, plaine sportive, parc urbain, marina) ; le jeu l'adosse à l'eau de la carte. Elle était avant posée en pleine terre, à plus d'un kilomètre de l'eau. Position d'après OpenStreetMap (la baie, le pont) ; le décor est celui du jeu.", srcHotelIvoire)},
				Place{ID: "cocody-blockhauss", Name: "Village de Blockhauss", Kind: "village", Quarter: "Blockhauss", Lat: 5.32322, Lng: -4.00183, Real: true, Approx: true,
					Source: game.Partial("Village ébrié de Cocody (avec Cocody village, M'badon, M'pouto, Anono, Akouédo), où l'on produit l'attiéké ; position : le quartier « Blockauss » d'OpenStreetMap (relation 4525193), entre la rue Zouzoua Robert Séri et la lagune.", srcBlockhauss, srcCocodyVillages, srcOSMBlockhauss)},
				Place{ID: "cocody-blockhauss-maquis", Name: "Les maquis de Blockhauss", Kind: "maquis", Quarter: "Blockhauss", Lat: 5.32120, Lng: -4.00290, Real: true, Approx: true,
					Source: game.Partial("Les maquis du village de Blockhauss, au bord de la lagune Ébrié, connus pour le poisson braisé et l'ambiance des soirs de week-end. Un lieu d'ambiance, pas un établissement : le nom est celui du jeu. Placé au sud du quartier « Blockauss » d'OpenStreetMap, côté lagune ; à relever.", srcBlockhauss, srcOSMBlockhauss)},
				Place{ID: "cocody-ucao", Name: "UCAO-UUA", Kind: "universite", Lat: 5.33125, Lng: -3.99572, Real: true, Operator: "Université catholique de l'Afrique de l'Ouest (privée)",
					Source: game.Partial("Université catholique de l'Afrique de l'Ouest, unité universitaire d'Abidjan, rue Sainte-Marie à Cocody ; position d'après OpenStreetMap (Val Doyen).", srcUCAO, srcUCAO2, srcOSM)},
				Place{ID: "cocody-zoo", Name: "Zoo national d'Abidjan", Kind: "zoo", Lat: 5.38019, Lng: -4.00554, Real: true, Operator: "Ministère des Eaux et Forêts",
					Source: game.Partial("Zoo public entre Cocody et Abobo ; fermé le 8 septembre 2020 pour audit, rouvert le 20 décembre 2021 après rénovation, avec des tickets à 500, 1 000 et 1 500 F selon le public. Éléphants, lions, hippopotames, crocodiles et chimpanzés ; les enclos du jeu sont dessinés pour le jeu ; position d'après OpenStreetMap.", srcZoo, srcZoo2, srcZoo3, srcOSM)},
				// The market of Saint-Jean, rebuilt after the fire on the old market's ground, and the drive of the burger chain across the road.
				Place{ID: game.MarcheCocodyID, Name: "Marché de Cocody", Kind: "market", Quarter: "Saint-Jean", Lat: 5.33497, Lng: -4.00224, Real: true, Operator: "Adam TP (BOT de 30 ans avec la mairie de Cocody)",
					Source: game.Partial("Le centre commercial N'Goan Aka Mathias de Cocody Saint-Jean, entre l'église Saint-Jean et l'ancienne mairie, reconstruit après l'incendie de l'ancien marché : environ 500 places (étals, box et boutiques) sur plusieurs niveaux, livré en janvier 2018, construit et géré par Adam TP pour 30 ans. Les étals du jeu (vivriers, poisson, pagnes, mèches, téléphones) sont dessinés pour le jeu ; position et emprise d'après OpenStreetMap (bâtiment de 4 niveaux).", srcMarcheCocody, srcMarcheCocody2, srcMarcheCocodyOSM)},
				babiBurger("cocody-babi-burger-stjean", "Babi Burger Saint-Jean", "Saint-Jean", 5.33546, -4.00179, "le boulevard Thérèse-Houphouët-Boigny, avec un drive", 4983385324),
				babiBurger("cocody-babi-burger-sococe", "Babi Burger Sococé", "Deux-Plateaux", 5.37360, -3.99894, "la rue K131, à côté de Sococé", 9202510907),
				babiBurger("cocody-babi-burger-jardins", "Babi Burger Rue des Jardins", "Deux-Plateaux", 5.36245, -3.98987, "la rue des Jardins", 13285355028),
				babiBurger("cocody-babi-burger-palmeraie", "Babi Burger Palmeraie", "Riviera Palmeraie", 5.37286, -3.93315, "les résidences Génie 2000, près de PlaYce Palmeraie", 6900316188),
				Place{ID: "cocody-iua", Name: "Institut universitaire d'Abidjan (IUA)", Kind: "universite", Lat: 5.37602, Lng: -3.98193, Real: true, Operator: "Établissement privé",
					Source: game.Partial("Université privée fondée en 2004, aux Deux-Plateaux (Cocody) ; position d'après OpenStreetMap.", srcIUA, srcOSM)},
				// The national radio and television, its studios and its mast (web/src/world3d/open/rti.tsx).
				Place{ID: game.RTIID, Name: "RTI", Kind: "office", Quarter: "Vieux Cocody", Lat: 5.34270, Lng: -4.00214, Real: true, Operator: "Radiodiffusion Télévision Ivoirienne (service public)",
					Source: game.Partial("Le site de la Radiodiffusion Télévision Ivoirienne à Cocody : ses studios et son pylône. Position d'après OpenStreetMap (« Radiodiffusion-Télévision-Ivoirienne », Vieux Cocody) ; les bâtiments et la hauteur du pylône sont des estimations du jeu.", srcOSM)},
				Place{ID: "cocody-carrefour-vie", Name: "Carrefour de la Vie", Kind: "rue", Quarter: "Cité BAD", Lat: 5.34882, Lng: -4.00280, Real: true, Approx: true,
					Source: game.Partial("Grand carrefour du Vieux Cocody, près de la Cité BAD, sur le tracé du BRT en construction (le carrefour d'après OpenStreetMap : 5.34856, -4.00243). Le jeu en fait un lieu d'ambiance, posé sur son coin nord-ouest, au bord de la route (au milieu, il tombait sur les voies) : kiosques, terrasse, woro-woro, travaux du BRT.", srcOSM)},
				Place{ID: "cocody-mosquee-aghien", Name: "Mosquée d'Aghien", Kind: "worship", Quarter: "Aghien", Lat: 5.38286, Lng: -3.99375, Real: true,
					Source: game.Partial("Nom et position d'après OpenStreetMap (rue L16, à Aghien, près du boulevard Latrille et de son arrêt « Mosquée Aghien »).", srcOSM)},
				Place{ID: "cocody-espace-opera", Name: "Espace Opéra", Kind: "maquis", Quarter: "Aghien", Lat: 5.38542, Lng: -3.99335, Real: true,
					Source: game.Partial("Restaurant et espace de détente, rue des Flamboyants à Aghien ; nom et position d'après OpenStreetMap. Ce que l'on y fait est celui des maquis du jeu.", srcOSM)},
			),
			withMairie(abidjanCommune("yopougon", "Yopougon", "Yop City, capitale de l'ambiance.", 5.3450, -4.0820, "nord",
				// The island across the water from Azito: reached by pinasse from the shore (web/src/world3d/interior/BoulayScene.tsx).
				Place{ID: "yop-ile-boulay", Name: "Embarcadère de l'île Boulay", Kind: "lagune", Lat: 5.3005, Lng: -4.0825, Real: true, Approx: true,
					Source: game.Partial("Île Boulay, dans la lagune Ébrié au sud de Yopougon : environ 2 000 ha, les villages N'gandikro et Jeankouamékro (terres des villages de Yopougon Santé, Yopougon Kouté, Azito et Béago), des résidences de week-end, le ski nautique au large ; à 15 minutes en bateau du centre ; déclarée d'utilité publique en 2010 pour l'extension du port. L'embarcadère est placé par le jeu sur la rive d'Azito, en face de l'île ; à relever.", srcBoulay, srcBoulayAIP)},
				Place{ID: "yop-rue-princesse", Name: "Rue Princesse", Kind: "rue", Lat: 5.34787, Lng: -4.07777, Real: true, Approx: true, Closed: "2011-08",
					Source: game.Partial("Rue des maquis et boîtes de nuit (« Rue Princesse / Rue P60 » sur OpenStreetMap), rasée en août 2011 pendant l'opération « Pays propre », bitumée en juillet 2026 avant la fête de l'Indépendance à Yopougon. Le jeu garde un lieu d'ambiance à cet endroit ; le tronçon exact des maquis est à confirmer.", game.SrcRuePrincesse2011, srcYopBitume2026, srcOSM)},
				// The clubs of the street, between its maquis (web/src/world3d/open/ruePrincesse.tsx draws them at their slot).
				inRue("yop-rp-saphir", "Le Saphir", 3),
				inRue("yop-rp-225", "Club 225", 4),
				inRue("yop-rp-nuit", "Nuit de Yop", 7),
				fictional("yop-terrain", "Terrain de Selmer", "sport", "Selmer", 5.3420, -4.0710),
				fictional("yop-basket", "Terrain de basket de Niangon", "sport", "Niangon", 5.3380, -4.0900),
				fictional("yop-cine", "Ciné Princesse", "cinema", "Selmer", 5.3400, -4.0740),
				fictional("yop-ecole", "Groupe scolaire de Niangon", "school", "Niangon", 5.3400, -4.0880),
				Place{ID: "yop-maquis", Name: "Maquis de Sideci", Kind: "maquis", Quarter: "Sideci", Lat: 5.3320, Lng: -4.0690, Approx: true, Source: invented},
				Place{ID: "yop-marche", Name: "Marché Dominique-Ouattara de Selmer", Kind: "market", Quarter: "Selmer", Lat: 5.34032, Lng: -4.06846, Real: true, Operator: "Commune de Yopougon",
					Source: game.Verified("Marché municipal d'un hectare et de 1 000 places, inauguré le 17 février 2012 (environ 1,5 milliard FCFA). Position d'après OpenStreetMap.", srcMarcheSelmer, srcOSM)},
				Place{ID: "yop-chu", Name: "CHU de Yopougon", Kind: "health", Lat: 5.35842, Lng: -4.08969, Real: true, Operator: "Établissement public hospitalier national",
					Source: game.Verified("Transformé en établissement public hospitalier national en 2022. Position d'après OpenStreetMap.", srcCHUStatus, srcOSM)},
				Place{ID: "yop-ficgayo", Name: "Place Ficgayo", Kind: "culture", Lat: 5.35030, Lng: -4.07281, Real: true, Operator: "Commune de Yopougon",
					Source: game.Verified("Esplanade d'environ un hectare au centre de Yopougon, nommée d'après la Ficgayo (foire industrielle, commerciale et gastronomique de Yopougon des années 1990) : spectacles, veillées, tournois, meetings. Rénovée avant le 7 août 2026 ; un changement de nom a été annoncé. Position d'après OpenStreetMap.", srcFicgayo2013, srcFicgayo2026, srcOSM)},
				Place{ID: "yop-gare-siporex", Name: "Gare de Siporex", Kind: "transport", Quarter: "Siporex", Lat: 5.35615, Lng: -4.07545, Real: true,
					Source: game.Verified("Gare routière sur la route de Dabou, au carrefour Siporex, première correspondance des gbakas venant d'Adjamé. Position d'après OpenStreetMap.", srcGareSiporex, srcYopougon, srcOSM)},
				Place{ID: "yop-cathedrale", Name: "Cathédrale Saint-André", Kind: "worship", Quarter: "Selmer", Lat: 5.34268, Lng: -4.07411, Real: true, Operator: "Diocèse de Yopougon",
					Source: game.Verified("Cathédrale du diocèse de Yopougon (créé le 8 juin 1982). Position d'après GCatholic et OpenStreetMap.", srcStAndre, srcYopougon)},
				Place{ID: "yop-zone-industrielle", Name: "Zone industrielle de Yopougon", Kind: "office", Quarter: "Zone industrielle", Lat: 5.37441, Lng: -4.08454, Real: true, Approx: true,
					Source: game.Verified("Zone industrielle ouverte en 1972 : cimenteries, plasturgie, pharmacie, textile (Uniwax), boissons (Solibra), agroalimentaire (Nestlé, Cémoi). Position d'après OpenStreetMap.", srcYopougon, srcOSM)},
				Place{ID: "yop-koute", Name: "Kouté village", Kind: "village", Quarter: "Kouté", Lat: 5.32152, Lng: -4.07489, Real: true,
					Source: game.Verified("Village atchan (ébrié) de Yopougon, organisé en générations (Tchagba, Blessoué) ; l'un des villages de la commune. Position d'après OpenStreetMap.", srcKoute, srcKoute2, srcYopougon)},
				babiBurger("yop-babi-burger", "Babi Burger Ficgayo", "Figayo", 5.34967, -4.07439, "le boulevard Principal, près de la place Ficgayo", 6040188940),
				Place{ID: "yop-lycee-pro", Name: "Lycée professionnel sectoriel de Yopougon", Kind: "school", Quarter: "Siporex", Lat: 5.35712, Lng: -4.07996, Real: true, Operator: "Établissement public",
					Source: game.Verified("Lycée professionnel construit avec le C2D (9 milliards FCFA, 390 apprenants), inauguré le 20 octobre 2022. Position d'après OpenStreetMap.", srcLyceeProYop, srcOSM)},
			), 5.34389, -4.06745, game.Partial("Hôtel de ville de Yopougon, à Selmer ; position d'après OpenStreetMap.", srcYopougon, srcOSM)),
			abidjanCommune("adjame", "Adjamé", "Le cœur commerçant, ça bouge dans tous les sens.", 5.3550, -4.0240, "nord",
				Place{ID: "adjame-gare", Name: "Gare routière d'Adjamé", Kind: "transport", Quarter: "220 Logements", Lat: 5.35182, Lng: -4.02213, Real: true, Approx: true,
					Source: game.Partial("Le quartier des gares de cars d'Adjamé, autour du 220 Logements et de la rue du Black Market, d'où partent les cars vers tout le pays. Placée sur la gare UTB d'Adjamé (position d'après OpenStreetMap) ; la cour, les lignes et les compagnies du jeu sont inventées. La nouvelle gare routière d'Adjamé-Liberté est en construction plus à l'est.", srcOSM)},
				Place{ID: "adjame-forum", Name: "Forum des marchés", Kind: "market", Lat: 5.34522, Lng: -4.02665, Real: true, Source: game.Partial("Le grand marché d'Adjamé (« Forum des Marchés » sur la carte) ; position d'après OpenStreetMap.", srcOSM)},
				Place{ID: "adjame-mosquee", Name: "Grande mosquée d'Adjamé", Kind: "worship", Quarter: "Bromakoté", Lat: 5.353468, Lng: -4.026495, Real: true, Source: game.Partial("Nom et position d'après OpenStreetMap.", "https://www.openstreetmap.org/copyright")},
				Place{ID: "adjame-hopital", Name: "Hôpital général d'Adjamé", Kind: "health", Lat: 5.34882, Lng: -4.02468, Real: true, Operator: "Hôpital public",
					Source: game.Partial("Inauguré par le président de la République (après celui de Gagnoa, 2013). Position d'après OpenStreetMap.", srcHGAdjame, srcOSM)},
			),
			abidjanCommune("abobo", "Abobo", "La plus peuplée. Débrouillardise et solidarité.", 5.4250, -4.0170, "nord",
				Place{ID: "abobo-marche", Name: "Grand marché d'Abobo", Kind: "market", Lat: 5.42563, Lng: -4.01546, Real: true, Source: game.Partial("Grand marché d'Abobo ; position d'après OpenStreetMap.", srcOSM)},
				Place{ID: "abobo-una", Name: "Université Nangui-Abrogoua", Kind: "universite", Lat: 5.38855, Lng: -4.01605, Real: true, Operator: "Université publique",
					Source: game.Partial("Université publique (ex-Université d'Abobo-Adjamé) ; position d'après OpenStreetMap.", srcUniversities, srcUniversities2, srcOSM)},
				Place{ID: "abobo-terrain", Name: "Terrain de quartier", Kind: "sport", Lat: 5.4300, Lng: -4.0120, Approx: true, Source: invented},
				fictional("abobo-ecole", "Groupe scolaire d'Abobo-Baoulé", "school", "Abobo-Baoulé", 5.4290, -4.0210),
				fictional("abobo-maquis", "Maquis du carrefour", "maquis", "", 5.4220, -4.0090),
				fictional("abobo-gare", "Gare des gbakas", "transport", "", 5.4160, -4.0130),
			),
			abidjanCommune("treichville", "Treichville", "Le vieux quartier mythique, le Palais des Sports.", 5.2990, -4.0090, "sud",
				Place{ID: game.MarcheTreichID, Name: "Grand Marché de Treichville", Kind: "market", Lat: 5.30888, Lng: -4.01362, Real: true, Operator: "SGMT (Sicogi et mairie de Treichville)",
					Source: game.Partial("Grand marché de Treichville, rue Pierre-Billon : deux niveaux sur environ 18 500 m², reconstruit après un incendie et inauguré en 2003 ; vivriers, pagnes, volaille, friperie, viande, les commerçants regroupés par marchandise. Le plan du jeu (les vivriers en bas, les pagnes en haut) est dessiné pour le jeu ; position d'après OpenStreetMap.", srcMarcheTreich, srcMarcheTreich2, srcOSM)},
				Place{ID: "treich-palais", Name: "Palais des Sports", Kind: "sport", Lat: 5.29807, Lng: -4.00545, Real: true,
					Source: game.Verified("Salle couverte de 3 500 places (1978), à côté du Parc des sports : la rotonde de 66 m de diamètre, rue du Stade (position et taille d'après OpenStreetMap).", srcPalaisSports, "https://www.openstreetmap.org/way/123174041")},
				Place{ID: "treich-maquis", Name: "Maquis de l'Avenue 16", Kind: "maquis", Lat: 5.3000, Lng: -4.0150, Approx: true, Source: invented},
				Place{ID: game.PalaisCultureID, Name: "Palais de la Culture", Kind: "culture", Lat: 5.31226, Lng: -4.01258, Real: true,
					Source: game.Verified("Palais de la Culture de Treichville, au bord de la lagune, offert par la Chine : 12 900 m², 7 salles, dont la grande salle Anoumabo (environ 4 000 places), les salles Louga-François (1 500), Kodjo-Ebouclé (700) et Niangoran-Porquet (300), et l'espace lagunaire. Sa forme dans le jeu est dessinée pour le jeu ; position d'après OpenStreetMap.", srcVenues, srcPalaisCulture, srcPalaisCulture2, srcOSM)},
				Place{ID: "treich-chu", Name: "CHU de Treichville", Kind: "health", Lat: 5.29119, Lng: -4.00356, Real: true, Operator: "Établissement public hospitalier national",
					Source: game.Verified("Transformé en établissement public hospitalier national en 2022. Position d'après OpenStreetMap.", srcCHUStatus, srcOSM)},
				Place{ID: "treich-mosquee-m6", Name: "Mosquée Mohammed VI", Kind: "worship", Quarter: "Biafra", Lat: 5.310947, Lng: -4.003406, Real: true,
					Source: game.Verified("Mosquée de style marocain inaugurée le 5 avril 2024 (architecte Mustapha Zeghari) : 25 000 m², 7 000 fidèles, un minaret de plus de 69 m, une bibliothèque et une salle de conférence. Position d'après OpenStreetMap.", srcMosqueeM6, srcMosqueeM62)},
			),
			abidjanCommune("marcory", "Marcory", "Zone 4, Biétry, restos et sorties.", 5.3000, -3.9850, "sud",
				Place{ID: "marcory-azale", Name: "Azalé Hôtel", Kind: "hotel", Lat: 5.29957, Lng: -3.98636, Real: true,
					Source: game.Partial("Nom du jeu pour l'Azalaï Hôtel Abidjan, à Marcory ; position d'après OpenStreetMap.", srcHotelsAbj, srcOSM)},
				fictional("marcory-terrain", "Terrain de Biétry", "sport", "Biétry", 5.2880, -3.9800),
				fictional("marcory-cine", "Ciné Lagune", "cinema", "Zone 4", 5.2930, -3.9880),
				Place{ID: "marcory-zone4", Name: "Zone 4", Kind: "club", Quarter: "Zone 4", Lat: 5.2930, Lng: -3.9900, Approx: true, Source: game.Unverified("Quartier de sorties de Marcory ; le lieu est une ambiance générique.")},
				Place{ID: "marcory-bietry", Name: "Maquis de Biétry", Kind: "maquis", Quarter: "Biétry", Lat: 5.2860, Lng: -3.9770, Approx: true, Source: invented},
				Place{ID: "marcory-anoumabo", Name: "Village d'Anoumabo", Kind: "culture", Quarter: "Anoumabo", Lat: 5.30966, Lng: -3.96822, Real: true, Approx: true,
					Source: game.Partial("Lieu du FEMUA (festival fondé en 2008 par A'Salfo, de Magic System). Placé au point du quartier Anoumabo d'OpenStreetMap ; le site du festival est à relever.", game.SrcFEMUA, srcOSM)},
				Place{ID: "marcory-capsud", Name: "Cap Sud", Kind: "mall", Quarter: "Zone 4", Lat: 5.29827, Lng: -3.98677, Real: true,
					Source: game.Partial("Centre commercial Cap Sud, au bord du boulevard VGE à Marcory ; position d'après OpenStreetMap.", srcCapSudOSM)},
				// The multiplex at Cap Sud, of the game's chain (game/cinema.go): six screens, two of them VIP.
				Place{ID: "marcory-kineo", Name: "Kinéo Cap Sud", Kind: "cinema", Quarter: "Zone 4", Lat: 5.29887, Lng: -3.98728, Real: true,
					Source: game.Partial("Nom du jeu pour le multiplexe ouvert en avril 2024 au centre commercial Cap Sud (six salles dont deux VIP, environ 1 000 fauteuils) ; position d'après OpenStreetMap (le cinéma du centre).", srcCinemas2024, srcPatheAbj, srcCapSudOSM, srcOSM)},
				Place{ID: "marcory-playce", Name: "PlaYce Marcory", Kind: "mall", Lat: 5.30240, Lng: -3.99218, Real: true, Operator: "CFAO",
					Source: game.Verified("Centre commercial de CFAO ouvert le 18 décembre 2015 sur le boulevard Valéry Giscard d'Estaing : 20 000 m², un hypermarché de 3 200 m², 55 boutiques, un food court de plus de 400 places, 510 places de parking. Position d'après OpenStreetMap (le point « PlaYce Marcory » de la carte).", srcPlayceMarcory, srcBurgerKing)},
				Place{ID: "marcory-burger-king", Name: "Babi Burger PlaYce", Kind: "restaurant", Lat: 5.30246, Lng: -3.99274, Real: true,
					Operator: "Servair Abidjan (franchise, 2015)",
					Source:   game.Partial("Nom du jeu pour le premier Burger King du pays, ouvert en 2015 dans PlaYce Marcory, en franchise avec Servair Abidjan ; activité actuelle à confirmer. Position d'après OpenStreetMap, à côté du centre.", srcBurgerKing, srcOSM)},
				Place{ID: "marcory-karting", Name: "Babi Karting", Kind: "karting", Quarter: "Zone 4", Lat: 5.29454, Lng: -3.99252, Real: true,
					Source: game.Partial("Nom du jeu pour le karting de Marcory (Abidjan Karting, « Superkart » sur OpenStreetMap), 9 rue du Canal, entre Zone 3 et Zone 4 ; position d'après OpenStreetMap. Le circuit, les tarifs et les horaires du jeu sont dessinés pour le jeu ; l'activité actuelle du lieu est à confirmer.", srcKarting, srcKarting2)},
				babiBurger("marcory-babi-burger-capsud", "Babi Burger Cap Sud", "Zone 4", 5.29783, -3.98619, "la rue Angeline-Nadié, à l'échangeur, près de Cap Sud", 5203033005),
			),
			abidjanCommune("koumassi", "Koumassi", "Populaire, vivante, au bord de la lagune.", 5.2930, -3.9500, "sud",
				Place{ID: "koumassi-marche", Name: "Marché de Koumassi", Kind: "market", Lat: 5.29278, Lng: -3.95828, Real: true, Source: game.Partial("Grand marché de Koumassi ; position d'après OpenStreetMap.", srcOSM)},
				fictional("koumassi-maquis", "Maquis de la lagune", "maquis", "", 5.2890, -3.9440),
				fictional("koumassi-ecole", "Groupe scolaire de Koumassi", "school", "", 5.2990, -3.9560),
				fictional("koumassi-terrain", "Terrain de Koumassi", "sport", "", 5.2990, -3.9440),
				// The tower over the boulevard (web/src/world3d/open/tourIvoire.tsx).
				Place{ID: game.TourIvoireID, Name: "Tour Ivoire", Kind: "office", Quarter: "Cité Hibiscus", Lat: 5.29182, Lng: -3.97274, Real: true,
					Source: game.Partial("Immeuble « Tour Ivoire » de 16 niveaux sur la contre-allée du boulevard Félix-Houphouët-Boigny (ex-VGE), à l'échangeur, côté Koumassi, près de l'hôtel Ibis ; emprise (environ 47 × 24 m), niveaux et position d'après OpenStreetMap. Son allure d'après des photos du bâtiment, dont une vue aérienne : une seule barre qui part de la rue vers l'arrière, son bout côté rue arrondi en verre bleu, ses quatre derniers étages à balcons courbes cerclés de bandeaux sombres ; le grand côté gauche gris clair à panneau sombre et emblème IVOIRE, le droit anthracite ; le socle sombre à lames et ses boutiques, le magasin voisin aux cadres rouges (les noms des boutiques sont ceux du jeu) ; les bureaux sont dessinés pour le jeu.", srcTourIvoireOSM, srcTourIvoire)},
			),
			// The commune's middle is the town's (OpenStreetMap's centre of Port-Bouët, by the Hôtel communal),
			// not the airfield: one arrives in its streets, its houses stand there, not between the runways.
			abidjanCommune("port-bouet", "Port-Bouët", "La plage, l'aéroport, le vent de l'océan.", 5.2569, -3.9586, "sud",
				Place{ID: "pb-plage", Name: "Plage de Port-Bouët", Kind: "beach", Lat: 5.2470, Lng: -3.9400, Real: true, Approx: true, Source: game.Unverified("Plage publique de Port-Bouët ; à confirmer.")},
				fictional("portbouet-terrain", "Terrain du Wharf", "sport", "", 5.2540, -3.9480),
				Place{ID: "pb-maquis", Name: "Maquis du Wharf", Kind: "maquis", Lat: 5.2520, Lng: -3.9530, Approx: true, Source: invented},
				Place{ID: "pb-rabisson", Name: "Rabisson Aéroport", Kind: "hotel", Lat: 5.25895, Lng: -3.93641, Real: true,
					Source: game.Partial("Nom du jeu pour le Radisson Blu de l'aéroport (boulevard de l'Aéroport, à environ 500 m de l'aéroport) ; position d'après OpenStreetMap.", srcRadisson, srcOSM)},
				Place{ID: "pb-aeroport", Name: "Aéroport Félix-Houphouët-Boigny", Kind: "aeroport", Lat: 5.25440, Lng: -3.93268, Real: true,
					Owner: "État de Côte d'Ivoire (concédant)", Operator: "AERIA (concession depuis 1996)",
					Source: game.Verified("Aéroport de Port-Bouët géré par AERIA depuis mai 1996 ; concession renouvelée par l'État en 2010 pour vingt ans. Placé à l'aérogare internationale, d'après OpenStreetMap.", srcAirport, srcAirport2, srcOSM)},
				// The airline's head office, across the car parks from the terminal (its counter: game/catalog.go).
				Place{ID: game.AirLaguneID, Name: "Siège d'Air Lagune", Kind: "office", Lat: 5.25575, Lng: -3.93545, Real: true,
					Source: game.Partial("Nom du jeu pour le siège d'Air Côte d'Ivoire, boulevard de l'Aéroport (Cité Douane), près de l'aérogare ; position d'après OpenStreetMap (nœud 11217949138).", "https://www.openstreetmap.org/node/11217949138")},
				// Its central building under the dome (web/src/world3d/open/parcExpo.tsx); no game houses on its grounds.
				Place{ID: "portbouet-parc-expo", Name: "Parc des Expositions d'Abidjan", Kind: "culture", Lat: 5.26465, Lng: -3.94603, Real: true,
					Source: game.Partial("Parc des Expositions d'Abidjan, boulevard de l'Aéroport à Port-Bouët, inauguré en juillet 2023 : 16 ha en première phase, un hall d'exposition de 7 200 m², le Convention Center sous son dôme (plus de 5 000 places assises, environ 10 000 debout), un écran LED de 250 m², 800 places de parking. Le dôme est posé sur le grand bâtiment central d'OpenStreetMap ; ses dimensions sont celles du jeu.", srcParcExpo, srcParcExpo2, srcParcExpoOSM)},
			),
			abidjanCommune("attecoube", "Attécoubé", "Entre lagune et forêt du Banco.", 5.3350, -4.0400, "nord",
				Place{ID: "attecoube-banco", Name: "Forêt du Banco", Kind: "nature", Lat: 5.36024, Lng: -4.04645, Real: true,
					Source: game.Partial("Parc national du Banco : forêt classée en 1926, parc national en 1953, environ 3 438 ha dont 600 ha de forêt primaire ; ses forages donnent une large part de l'eau d'Abidjan. Il touche Attécoubé, Yopougon, Abobo et Adjamé. Placé à son entrée, sur l'autoroute du Nord, d'après OpenStreetMap.", srcBanco, srcOSM)},
				fictional("attecoube-maquis", "Maquis de Santé", "maquis", "Santé-Village", 5.33265, -4.03917),
			),
			abidjanCommune("anyama", "Anyama", "Au nord d'Abidjan, entre ville et campagne.", 5.5000, -4.0500, "nord",
				fictional("anyama-marche", "Marché d'Anyama", "market", "", 5.4970, -4.0530),
				fictional("anyama-gare", "Gare d'Anyama", "transport", "", 5.5030, -4.0460),
				fictional("anyama-maquis", "Maquis de la route", "maquis", "", 5.4950, -4.0450),
			),
			abidjanCommune("bingerville", "Bingerville", "Ancienne capitale coloniale au bord de la lagune.", 5.3550, -3.8850, "nord",
				Place{ID: "bingerville-jardin", Name: "Jardin botanique de Bingerville", Kind: "nature", Lat: 5.35997, Lng: -3.88997, Real: true,
					Source: game.Partial("Jardin botanique de l'époque coloniale ; placé à son entrée, d'après OpenStreetMap.", srcBingerville, srcOSM)},
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
					{ID: "yakro-aeroport", Name: "Aéroport de Yamoussoukro", Kind: "aeroport", Lat: 6.90607, Lng: -5.35955, Real: true, Approx: true, Source: game.Partial("Aéroport de Yamoussoukro ; vols intérieurs, à confirmer. Placé au plus grand bâtiment au bord du tarmac, d'après OpenStreetMap.", srcOSM)},
					mairie("yakro-centre", "Yamoussoukro", 6.8230, -5.2830, srcVilles2026),
					{ID: "yakro-basilique", Name: "Basilique Notre-Dame de la Paix", Kind: "worship", Lat: 6.81133, Lng: -5.29709, Real: true,
						Source: game.Verified("Basilique de Yamoussoukro. Position d'après OpenStreetMap.", srcYakro, srcYakroSites, srcOSM)},
					{ID: "yakro-maquis", Name: "Maquis du Lac", Kind: "maquis", Lat: 6.8190, Lng: -5.2760, Approx: true, Source: invented},
					{ID: "yakro-inphb", Name: "INP-HB", Kind: "universite", Lat: 6.88138, Lng: -5.22991, Real: true, Operator: "Institut public d'enseignement supérieur",
						Source: game.Verified("Institut national polytechnique Félix-Houphouët-Boigny ; placé à la bibliothèque de l'INP-HB Centre, d'après OpenStreetMap.", srcINPHB, srcOSM)},
					{ID: "yakro-lac", Name: "Lac aux caïmans", Kind: "nature", Lat: 6.82538, Lng: -5.28031, Real: true,
						Source: game.Partial("Caïmans du lac artificiel du palais présidentiel ; placé sur la rive ouest, côté palais (le « Lac n°4 » d'OpenStreetMap).", srcYakro, srcOSM)},
					{ID: "yakro-gare", Name: "Gare routière de Yamoussoukro", Kind: "transport", Quarter: "Dioulabougou", Lat: 6.81090, Lng: -5.26520, Real: true, Approx: true,
						Source: game.Partial("Les gares des compagnies de cars de la ville sont côte à côte à Dioulabougou et aux 220 Logements, d'après OpenStreetMap ; la gare du jeu est placée au milieu. Ses compagnies de cars sont celles du jeu, inventées.", srcOSM)},
					// Yamoussoukro alive (the update « yakro-vivant », game/villes.go): its mosque and its Fondation where
					// OpenStreetMap has them (Nominatim, 2026-11-05); the hotel, the golf, the maquis and the clubs are the
					// game's, under names of its own (the Hôtel Président and its golf club are real businesses).
					{ID: game.YakroMosqueeID, Name: "Grande mosquée de Yamoussoukro", Kind: "worship", Quarter: "Énergie", Lat: 6.81131, Lng: -5.27581, Real: true, Faith: game.FaithMuslim,
						Source: game.Partial("La grande mosquée de la ville, rue de la Grande Mosquée ; position d'après OpenStreetMap.", srcOSM)},
					{ID: game.YakroFondationID, Name: "Fondation Félix-Houphouët-Boigny", Kind: "culture", Quarter: "Dioulabougou", Lat: 6.79669, Lng: -5.26475, Real: true, Operator: "Fondation Félix-Houphouët-Boigny pour la recherche de la paix",
						Source: game.Partial("Le centre de conférences de la Fondation, rue de Sopim ; position d'après OpenStreetMap. Ses heures de visite sont celles du jeu.", srcYakro, srcOSM)},
					{ID: game.YakroHotelID, Name: "Hôtel Le Résident", Kind: "hotel", Quarter: "Énergie", Lat: 6.80261, Lng: -5.25154, Real: true,
						Source: game.Partial("Nom du jeu pour la grande tour hôtelière de l'avenue Houphouët-Boigny (l'Hôtel Président) ; son restaurant tout en haut. Position d'après OpenStreetMap.", srcYakro, srcOSM)},
					{ID: game.YakroGolfID, Name: "Golf Club du Résident", Kind: "golf", Quarter: "Énergie", Lat: 6.79573, Lng: -5.24949, Real: true, Approx: true,
						Source: game.Partial("Nom du jeu pour le parcours de golf de la ville, au sud de l'hôtel ; position d'après OpenStreetMap.", srcOSM)},
					fictional(game.YakroMaquisID, "Maquis Le Grand Braisé", "maquis", "Habitat, rue des Maquis", 6.82440, -5.26720),
					fictional(game.YakroClubID, "Le Caïman Club", "club", "Habitat, rue des Maquis", 6.82560, -5.26580),
					fictional(game.YakroClub2ID, "Le Totem", "club", "Dioulabougou", 6.81240, -5.26840),
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
					{ID: "bouake-aeroport", Name: "Aéroport de Bouaké", Kind: "aeroport", Lat: 7.73576, Lng: -5.06910, Real: true, Approx: true, Source: game.Partial("Aéroport de Bouaké ; vols intérieurs, à confirmer. Placé au bâtiment du tarmac civil, d'après OpenStreetMap.", srcOSM)},
					mairie("bouake-centre", "Bouaké", 7.6930, -5.0330, srcGbeke),
					{ID: "bouake-marche", Name: "Grand marché de Bouaké", Kind: "market", Lat: 7.68984, Lng: -5.02480, Real: true, Source: game.Partial("Grand marché de Bouaké (en reconstruction sur la carte) ; position d'après OpenStreetMap.", srcOSM)},
					{ID: "bouake-stade", Name: "Stade de la Paix", Kind: "stade", Lat: 7.68299, Lng: -5.04456, Real: true, Source: game.Partial("Stade de la Paix de Bouaké ; position d'après OpenStreetMap.", srcOSM)},
					{ID: "bouake-universite", Name: "Université Alassane-Ouattara", Kind: "universite", Lat: 7.68804, Lng: -5.06629, Real: true, Operator: "Université publique",
						Source: game.Verified("Créée en 2012 à partir de l'Université de Bouaké. Placée au campus 1, d'après OpenStreetMap.", srcUniversities, srcUniversities2, srcOSM)},
					{ID: "bouake-chu", Name: "CHU de Bouaké", Kind: "health", Lat: 7.69966, Lng: -5.03679, Real: true, Operator: "Établissement public hospitalier national",
						Source: game.Verified("Transformé en établissement public hospitalier national en 2022. Position d'après OpenStreetMap.", srcCHUStatus, srcOSM)},
					{ID: "bouake-gare", Name: "Gare routière de Bouaké", Kind: "transport", Lat: 7.68909, Lng: -5.02848, Real: true,
						Source: game.Partial("La gare routière du Grand marché, à côté du marché (quartier Koko) ; position d'après OpenStreetMap.", srcOSMBouakeGare)},
					// Bouaké alive (the update « bouake-vivant », game/villes.go): the allocodrome where OpenStreetMap has it;
					// the hotel with its garden of animals, the maquis and the club are the game's.
					{ID: game.BouakeAllocoID, Name: "Allocodrome de Bouaké", Kind: "maquis", Quarter: "TSF Nord", Lat: 7.68260, Lng: -5.02748, Real: true,
						Source: game.Partial("L'allocodrome de la rue Bernard-Dadié, ses tables et ses vendeuses d'alloco ; position d'après OpenStreetMap.", srcOSM)},
					fictional(game.BouakeHotelID, "Hôtel Le Jardin des Paons", "hotel", "Nimbo", 7.67000, -5.02560),
					fictional(game.BouakeMaquisID, "Maquis Ambiance d'Air France", "maquis", "Air France I", 7.68060, -5.01720),
					fictional(game.BouakeClubID, "Le Gbêkê Night", "club", "Commerce", 7.68620, -5.02560),
				}},
			// The reserve on the N'Zi, north-east of the town (the update « bouake-vivant »): in the commune of
			// Brobo, by N'Dokro, where the decree of 2018 puts it. The commune's middle is the reserve's gate on the
			// road (the trip from Bouaké ends there); its mairie stands in Brobo itself.
			{ID: game.BroboCommune, Name: "Brobo", Lat: 7.80400, Lng: -4.77450, Blurb: "La savane de la N'Zi, ses éléphants et son lodge.",
				Admin: Admin{Type: "commune", Parent: "Département de Bouaké, région du Gbêkê", Mairie: "mairie-" + game.BroboCommune, Source: game.Partial("Brobo, sous-préfecture du Gbêkê, où se trouve N'Dokro.", srcGbeke, srcNziDecret)},
				Places: []Place{
					mairie(game.BroboCommune, "Brobo", 7.64080, -4.82548, srcBroboOSM),
					{ID: game.NziReserveID, Name: "Réserve de la N'Zi", Kind: "nature", Quarter: "N'Dokro", Lat: 7.80400, Lng: -4.77450, Real: true, Approx: true,
						Source: game.Partial("Réserve de faune au bord de la N'Zi, à N'Dokro (sous-préfecture de Brobo), 41 000 ha, créée par décret en 2018 ; à 45 km au nord-est de Bouaké par la route. Ses animaux et ses pistes sont dessinés par le jeu.", srcNziDecret, srcNziAIP)},
					{ID: game.NziLodgeID, Name: "Lodge des Rives de la N'Zi", Kind: "hotel", Quarter: "N'Dokro", Lat: 7.80400, Lng: -4.77450, Approx: true, Parent: game.NziReserveID, Slot: 0,
						Source: &game.Source{Status: game.StatusFictional, Note: "Le lodge du jeu, au bord de la réserve (le vrai lodge de la N'Zi est une entreprise : nom inventé)."}},
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
					// The International University of Grand-Bassam: private, teaching in English (with American partners), on the route de Bonoua.
					{ID: "bassam-iugb", Name: "International University of Grand-Bassam (IUGB)", Kind: "universite", Quarter: "Route de Bonoua", Lat: 5.22300, Lng: -3.72300, Real: true, Approx: true, Operator: "Université privée anglophone",
						Source: game.Partial("Université privée où l'on étudie en anglais, route de Bonoua (B.P. 564, Grand-Bassam) ; sa position exacte sur la route est à confirmer.", "https://www.whed.net/institutions/IAU-026643", "https://en.wikipedia.org/wiki/International_University_of_Grand-Bassam", "https://iugb.edu.ci/about-us")},
					{ID: "bassam-plage", Name: "Plage de Bassam", Kind: "beach", Quarter: "Quartier France", Lat: 5.1950, Lng: -3.7300, Real: true, Approx: true, Source: game.Unverified("Plage du Quartier France ; à confirmer.")},
					{ID: "bassam-maquis", Name: "Maquis de la plage", Kind: "maquis", Quarter: "Quartier France", Lat: 5.1975, Lng: -3.7450, Approx: true, Source: invented},
					{ID: "bassam-musee", Name: "Musée national du costume", Kind: "culture", Quarter: "Quartier France", Lat: 5.19614, Lng: -3.73692, Real: true,
						Source: game.Verified("Dans l'ancien palais du gouverneur ; la ville historique est inscrite au patrimoine mondial de l'UNESCO depuis 2012. Position d'après OpenStreetMap.", srcBassamMusee, srcBassamUNESCO, srcOSM)},
					{ID: "bassam-gare", Name: "Gare routière de Grand-Bassam", Kind: "transport", Quarter: "Quartier Phare", Lat: 5.20680, Lng: -3.73500, Real: true, Approx: true,
						Source: game.Partial("Les gares des compagnies de cars de la ville sont côte à côte au Quartier Phare, d'après OpenStreetMap ; la gare du jeu est placée au milieu. Ses compagnies de cars sont celles du jeu, inventées.", srcOSM)},
					// Grand-Bassam has no airport: the game gives it a little one (the update « voyages-villes »), on dry land
					// north-west of the town, along the road from Abidjan, away from the lagoon, the beach and the houses.
					{ID: "bassam-aerodrome", Name: "Aérodrome de Grand-Bassam", Kind: "aeroport", Quarter: "Route d'Abidjan", Lat: 5.24800, Lng: -3.77200, Approx: true,
						Source: &game.Source{Status: game.StatusFictional, Checked: game.Checked, Note: "Aérodrome inventé pour le jeu : Grand-Bassam n'a pas d'aéroport (les vols partent d'Abidjan, à une trentaine de kilomètres). Placé sur la terre ferme au nord-ouest de la ville, le long de la route d'Abidjan, loin de la lagune, de la plage et des maisons."}},
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
					{ID: "sp-aeroport", Name: "Aéroport de San-Pédro", Kind: "aeroport", Lat: 4.7461, Lng: -6.6603, Real: true, Approx: true, Source: game.Unverified("Aéroport de San-Pédro ; vols intérieurs, à confirmer.")},
					mairie("sp-centre", "San-Pédro", 4.7510, -6.6400, srcVilles2026),
					{ID: "sp-port", Name: "Port autonome", Kind: "office", Lat: 4.74228, Lng: -6.62083, Real: true, Source: game.Partial("Deuxième port du pays, premier port d'exportation de cacao au monde ; statut et gestionnaire à confirmer. Placé à sa direction générale, d'après OpenStreetMap.", srcVilles2026, srcSPPortCacao, srcOSM)},
					{ID: "sp-plage", Name: "Plage de San-Pédro", Kind: "beach", Lat: 4.72290, Lng: -6.63990, Real: true, Approx: true, Source: game.Partial("Plage de la ville ; placée au bord du sable, au bout de la route de l'hôtel Balmer, d'après OpenStreetMap.", srcOSM)},
					fictional("sp-maquis", "Maquis du port", "maquis", "", 4.7450, -6.6280),
					{ID: "sp-gare", Name: "Gare routière de San-Pédro", Kind: "transport", Quarter: "Séwéké", Lat: 4.77780, Lng: -6.64780, Real: true, Approx: true,
						Source: game.Partial("Les gares des compagnies de cars de la ville sont côte à côte à Séwéké, d'après OpenStreetMap ; la gare du jeu est placée au milieu. Ses compagnies de cars sont celles du jeu, inventées.", srcOSM)},
					// San-Pédro alive (the update « sanpedro-vivant », game/villes2.go): the fishing port, the Bardot, the
					// cathedral and Monogaga where OpenStreetMap has them (Nominatim, 2026-11-05); the maquis, the club and
					// the excursion agency are the game's, under names of its own.
					{ID: game.SPPecheID, Name: "Port de pêche de San-Pédro", Kind: "peche", Quarter: "Port", Lat: 4.74640, Lng: -6.62123, Real: true,
						Source: game.Partial("Le port de pêche artisanale, au bout de la route du Port, ses pirogues et ses fumeuses ; position d'après OpenStreetMap.", srcOSM)},
					{ID: game.SPBardotID, Name: "Le Bardot", Kind: "rue", Quarter: "Bardot", Lat: 4.77135, Lng: -6.65100, Real: true, Approx: true,
						Source: game.Partial("Le grand quartier populaire de San-Pédro, entre la route des Grumiers et la route de Tabou ; placé au milieu de ses écoles, églises et mosquées « du Bardot » d'OpenStreetMap.", srcOSM)},
					{ID: game.SPCathedraleID, Name: "Cathédrale de San-Pédro", Kind: "worship", Quarter: "Cité Ivosep", Lat: 4.76802, Lng: -6.67523, Real: true, Faith: game.FaithCatholic,
						Source: game.Partial("La cathédrale du diocèse, route de Tabou ; position d'après OpenStreetMap.", srcOSM)},
					{ID: game.SPMonogagaID, Name: "Plage de Monogaga", Kind: "beach", Quarter: "Monogaga", Lat: 4.80501, Lng: -6.44515, Real: true,
						Source: game.Partial("La plage du village de Monogaga, à une vingtaine de kilomètres à l'est de la ville ; position d'après OpenStreetMap.", srcOSM)},
					fictional(game.SPMaquisID, "Maquis Le Mérou Braisé", "maquis", "Balmer", 4.72460, -6.63800),
					fictional(game.SPClubID, "Le Cargo Club", "club", "Poro 1", 4.74900, -6.63350),
					{ID: game.SPTaiID, Name: "Taï Forêt Excursions", Kind: "excursion", Quarter: "Poro 1", Lat: 4.74780, Lng: -6.63050, Approx: true,
						Source: game.Partial("L'agence du jeu (nom inventé) : les sorties d'une journée au parc national de Taï, patrimoine mondial de l'UNESCO, par l'écotourisme de Djouroutou, à trois heures de route.", srcTaiUNESCO, srcTaiEcotourisme)},
				}},
			// The Baie des Sirènes (the update « sanpedro-vivant »): in the commune of Grand-Béréby, 30 km west of the
			// town by the coast road. The commune's middle is the bay (the trip from San-Pédro ends there).
			{ID: game.BerebyCommune, Name: "Grand-Béréby", Lat: 4.64660, Lng: -6.91788, Blurb: "La Baie des Sirènes, ses rochers et ses tortues.",
				Admin: Admin{Type: "commune", Parent: "Département de San-Pédro, région de San-Pédro", Mairie: "mairie-" + game.BerebyCommune, Source: game.Partial("Grand-Béréby, commune de la région de San-Pédro, sur la côte.", srcVilles2026, srcOSM)},
				Places: []Place{
					mairie(game.BerebyCommune, "Grand-Béréby", 4.65083, -6.92290, srcOSM),
					{ID: game.BerebySirenesID, Name: "Baie des Sirènes", Kind: "beach", Quarter: "Grand-Béréby", Lat: 4.64660, Lng: -6.91788, Real: true,
						Source: game.Partial("La baie de Grand-Béréby, sa crique entre les rochers ; les tortues marines viennent pondre sur les plages de la côte. Position d'après OpenStreetMap.", srcBereby)},
					{ID: game.BerebyHotelID, Name: "Le Campement des Tortues", Kind: "hotel", Quarter: "Grand-Béréby", Lat: 4.64760, Lng: -6.91540, Approx: true,
						Source: &game.Source{Status: game.StatusFictional, Note: "Le campement du jeu, au bord de la baie (les hôtels de la baie sont des entreprises : nom inventé)."}},
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
					{ID: "man-aeroport", Name: "Aéroport de Man", Kind: "aeroport", Lat: 7.2720, Lng: -7.5869, Real: true, Approx: true, Source: game.Unverified("Aéroport de Man ; vols intérieurs, à confirmer.")},
					mairie("man-centre", "Man", 7.4150, -7.5560, srcRegions),
					{ID: "man-dent", Name: "La Dent de Man", Kind: "nature", Lat: 7.45635, Lng: -7.54433, Real: true, Source: game.Partial("Sommet emblématique de Man ; le sommet d'après OpenStreetMap.", srcOSM)},
					{ID: "man-cascade", Name: "La Cascade", Kind: "nature", Lat: 7.41192, Lng: -7.58662, Real: true, Source: game.Partial("Man est connue pour ses chutes d'eau ; les Cascades naturelles de Man, d'après OpenStreetMap ; placée sur la rive, au bord du chemin.", srcYakroSites, srcOSM)},
					{ID: "man-marche", Name: "Marché de Man", Kind: "market", Lat: 7.40970, Lng: -7.54818, Real: true, Source: game.Partial("Marché de Man ; position d'après OpenStreetMap.", srcOSM)},
					{ID: "man-gare", Name: "Gare routière de Man", Kind: "transport", Quarter: "Air France", Lat: 7.40900, Lng: -7.55200, Real: true, Approx: true,
						Source: game.Partial("Les gares des compagnies de cars de la ville sont côte à côte au quartier Air France, d'après OpenStreetMap ; la gare du jeu est placée au milieu. Ses compagnies de cars sont celles du jeu, inventées.", srcOSM)},
					// Man alive (the update « man-vivant », game/villes3.go): Mont Tonkpi and the sacred forest of Gbêpleu where
					// OpenStreetMap has them (Nominatim, 2026-11-12); the masks' yard, the plantation, the excursion agency
					// (the liana bridges of Lieupleu are 75 km off, too far for a commune of Man), the maquis, the club and
					// the hotel are the game's, under names of their own.
					{ID: game.ManTonkpiID, Name: "Mont Tonkpi", Kind: "nature", Quarter: "Gouimpleu", Lat: 7.45409, Lng: -7.63705, Real: true,
						Source: game.Partial("Le plus haut des dix-huit monts autour de Man (1 189 m), sa piste jusqu'aux antennes et son belvédère ; le sommet d'après OpenStreetMap.", srcTonkpi, srcOSM)},
					{ID: game.ManGbepleuID, Name: "Forêt sacrée des singes de Gbêpleu", Kind: "sacre", Quarter: "Gbêpleu", Lat: 7.41572, Lng: -7.57253, Real: true, Approx: true,
						Source: game.Partial("La forêt sacrée du quartier Gbêpleu, où les singes ne sont pas chassés et viennent aux visiteurs ; position d'après OpenStreetMap.", srcGbepleu, srcOSM)},
					fictional(game.ManMasquesID, "La Cour des Masques", "culture", "Gbêpleu", 7.41380, -7.56620),
					fictional(game.ManPlantationID, "Plantation de café de la famille Gueu", "plantation", "Zadépleu", 7.42350, -7.59900),
					{ID: game.ManLianesID, Name: "Lianes & Montagnes Excursions", Kind: "excursion", Quarter: "Kennedy", Lat: 7.41250, Lng: -7.55020, Approx: true,
						Source: game.Partial("L'agence du jeu (nom inventé) : les sorties d'une journée aux ponts de lianes de Lieupleu et de Vatouo, près de Danané, à 75 km à l'ouest de Man.", srcLianes)},
					fictional(game.ManMaquisID, "Maquis Le Pied de la Dent", "maquis", "Libreville", 7.41850, -7.55050),
					fictional(game.ManClubID, "Le Sommet Club", "club", "Air France", 7.40650, -7.55450),
					fictional(game.ManHotelID, "Hôtel La Brume du Tonkpi", "hotel", "Domoraud", 7.42150, -7.56200),
					// The town's own square, where people meet (the préfecture, the CHR, the stadium, the lycées and the mairie
					// are the map's places already, osm/man-centre.json).
					{ID: game.ManPlaceID, Name: "Place de la Paix", Kind: "rue", Quarter: "Kennedy", Lat: 7.41330, Lng: -7.54740, Real: true,
						Source: game.Partial("La place du quartier Kennedy, au centre ; position d'après OpenStreetMap.", srcOSM)},
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
					{ID: "korhogo-aeroport", Name: "Aéroport de Korhogo", Kind: "aeroport", Lat: 9.39037, Lng: -5.55448, Real: true, Approx: true, Source: game.Partial("Aéroport de Korhogo ; vols intérieurs, à confirmer. Placé au plus grand bâtiment au bord du tarmac, d'après OpenStreetMap.", srcOSM)},
					mairie("korhogo-centre", "Korhogo", 9.4600, -5.6330, srcPoro),
					{ID: "korhogo-marche", Name: "Grand marché", Kind: "market", Lat: 9.45871, Lng: -5.63102, Real: true, Source: game.Partial("Grand marché de Korhogo ; position d'après OpenStreetMap.", srcOSM)},
					{ID: "korhogo-mosquee", Name: "Grande mosquée", Kind: "worship", Lat: 9.45983, Lng: -5.63912, Real: true, Source: game.Partial("Grande mosquée de Korhogo ; position d'après OpenStreetMap.", srcOSM)},
					{ID: "korhogo-universite", Name: "Université Peleforo-Gon-Coulibaly", Kind: "universite", Lat: 9.42813, Lng: -5.63330, Real: true, Operator: "Université publique",
						Source: game.Verified("Université de plein exercice depuis 2012. Position d'après OpenStreetMap.", srcUniversities, srcUniversities2, srcOSM)},
					{ID: "korhogo-gare", Name: "Gare routière de Korhogo", Kind: "transport", Quarter: "Koko", Lat: 9.45870, Lng: -5.63380, Real: true, Approx: true,
						Source: game.Partial("Les gares des compagnies de cars de la ville sont côte à côte à Koko, près du grand marché, d'après OpenStreetMap ; la gare du jeu est placée au milieu. Ses compagnies de cars sont celles du jeu, inventées.", srcOSM)},
					// Korhogo alive (the update « korhogo-vivant », game/villes2.go): the rock, the sacred wood, the villages of
					// the Senufo crafts round the town where OpenStreetMap has them (Nominatim, 2026-11-05); Koni and Fakaha
					// stand some twenty kilometres out, in the town's countryside. The maquis and the club are the game's.
					{ID: game.KoMontID, Name: "Mont Korhogo", Kind: "nature", Quarter: "Koko", Lat: 9.45101, Lng: -5.65096, Real: true,
						Source: game.Partial("Le rocher de granite à l'ouest de la ville ; position d'après OpenStreetMap.", srcOSM)},
					{ID: game.KoBoisSacreID, Name: "Bois sacré de Koko", Kind: "sacre", Quarter: "Koko", Lat: 9.46229, Lng: -5.63614, Real: true, Approx: true,
						Source: game.Partial("Un des bois sacrés du Poro de la ville, au quartier Koko ; on n'en visite que l'orée. Position d'après OpenStreetMap.", srcOSM)},
					{ID: game.KoWaranieneID, Name: "Waraniéné, village des tisserands", Kind: "artisans", Quarter: "Waraniéné", Lat: 9.42556, Lng: -5.66862, Real: true,
						Source: game.Partial("Le village des tisserands, à 6 km au sud-ouest de la ville ; position d'après OpenStreetMap.", srcWaraniene, srcKorhogoArtisans, srcOSM)},
					{ID: game.KoFakahaID, Name: "Fakaha, village des peintres", Kind: "artisans", Quarter: "Fakaha", Lat: 9.29542, Lng: -5.49100, Real: true,
						Source: game.Partial("Le village des peintres des « toiles de Korhogo », au sud-est de la ville ; position d'après OpenStreetMap.", srcKorhogoArtisans, srcOSM)},
					{ID: game.KoKoniID, Name: "Koni, village des forgerons", Kind: "artisans", Quarter: "Koni", Lat: 9.63629, Lng: -5.73582, Real: true, Approx: true,
						Source: game.Partial("Le village des forgerons, au nord de la ville sur la route de Niellé ; placé sur la route dans le village, d'après OpenStreetMap.", srcKorhogoArtisans, srcOSM)},
					fictional(game.KoMaquisID, "Maquis Le Tô de Mama Sita", "maquis", "Air France", 9.45380, -5.62680),
					fictional(game.KoClubID, "Le Balafon Club", "club", "Haoussabougou", 9.47050, -5.63300),
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
					{ID: "daloa-aeroport", Name: "Aéroport de Daloa", Kind: "aeroport", Lat: 6.7928, Lng: -6.4731, Real: true, Approx: true, Source: game.Unverified("Aéroport de Daloa ; vols intérieurs, à confirmer.")},
					mairie("daloa-centre", "Daloa", 6.8800, -6.4530, srcRegions),
					{ID: "daloa-marche", Name: "Marché de Daloa", Kind: "market", Lat: 6.87950, Lng: -6.45650, Real: true, Approx: true, Source: game.Unverified("Le grand marché ; placé entre la pharmacie et le cabinet dentaire « du Grand Marché » d'OpenStreetMap, son emprise est à relever.", srcOSM)},
					{ID: "daloa-maquis", Name: "Maquis du centre", Kind: "maquis", Lat: 6.8800, Lng: -6.4460, Approx: true, Source: invented},
					{ID: "daloa-universite", Name: "Université Jean-Lorougnon-Guédé", Kind: "universite", Lat: 6.89446, Lng: -6.44112, Real: true, Operator: "Université publique",
						Source: game.Verified("Université de plein exercice depuis 2012, tournée vers l'agroforesterie. Position d'après OpenStreetMap.", srcUniversities, srcUniversities2, srcOSM)},
					{ID: "daloa-gare", Name: "Gare routière de Daloa", Kind: "transport", Quarter: "Commerce", Lat: 6.88800, Lng: -6.44700, Real: true, Approx: true,
						Source: game.Partial("Les gares des compagnies de cars de la ville sont côte à côte au quartier Commerce, d'après OpenStreetMap ; la gare du jeu est placée au milieu. Ses compagnies de cars sont celles du jeu, inventées.", srcOSM)},
					// Daloa alive (the update « daloa-vivant », game/villes3.go): the cathedral, the great mosque and the Lobo
					// where OpenStreetMap has them (Nominatim, 2026-11-12); the plantation, the Bété yard, the maquis, the club
					// and the hotel are the game's, under names of their own.
					{ID: game.DaloaCathedraleID, Name: "Cathédrale du Christ-Roi", Kind: "worship", Quarter: "Dioulabougou", Lat: 6.88321, Lng: -6.44799, Real: true, Faith: game.FaithCatholic,
						Source: game.Partial("La cathédrale du diocèse de Daloa, route d'Issia ; position d'après OpenStreetMap.", srcDaloaWorship, srcOSM)},
					{ID: game.DaloaMosqueeID, Name: "Grande mosquée de Daloa", Kind: "worship", Quarter: "Dioulabougou", Lat: 6.87655, Lng: -6.44947, Real: true, Faith: game.FaithMuslim,
						Source: game.Partial("La grande mosquée de la ville, route d'Issia ; position d'après OpenStreetMap.", srcOSM)},
					{ID: game.DaloaLoboID, Name: "Bord de la Lobo", Kind: "riviere", Quarter: "Lobo", Lat: 6.94467, Lng: -6.64665, Real: true, Approx: true,
						Source: game.Partial("La Lobo, affluent du Sassandra, à une vingtaine de kilomètres à l'ouest de la ville ; un point de son cours d'après OpenStreetMap, l'embarcadère des pêcheurs est à relever.", srcLobo, srcOSM)},
					fictional(game.DaloaPlantationID, "Plantation de cacao des Gnaoré", "plantation", "Route d'Issia", 6.83600, -6.43100),
					fictional(game.DaloaBeteID, "La Cour des Anciens bétés", "culture", "Kirman", 6.87900, -6.43950),
					fictional(game.DaloaMaquisID, "Maquis La Cabosse d'Or", "maquis", "Commerce", 6.88350, -6.45850),
					fictional(game.DaloaClubID, "Le Ziglibithy Club", "club", "Orly", 6.86550, -6.46000),
					fictional(game.DaloaHotelID, "Hôtel L'Antilope Dorée", "hotel", "Piscine", 6.89300, -6.43900),
					// The town's fabric the map's file lacks: its regional hospital, its stadium, the rond-point at the heart of
					// the Commerce, the Zone industrielle where the exporters' warehouses take the cocoa in (the préfecture, the
					// mairie, the lycées and the university are there already, osm/daloa-centre.json, world.go).
					{ID: game.DaloaCHRID, Name: "Centre hospitalier régional de Daloa", Kind: "health", Quarter: "Kirman", Lat: 6.88270, Lng: -6.43963, Real: true,
						Source: game.Partial("Le CHR, rue du CHR ; position d'après OpenStreetMap.", srcOSM)},
					{ID: game.DaloaStadeID, Name: "Stade municipal de Daloa", Kind: "sport", Quarter: "Commerce", Lat: 6.88930, Lng: -6.45650, Real: true, Approx: true,
						Source: game.Unverified("Le stade de la ville, rue du Stade, entre les écoles « Stade » d'OpenStreetMap ; son emprise et son nom exact sont à relever.", srcOSM)},
					{ID: game.DaloaRondPointID, Name: "Rond-point du Commerce", Kind: "rue", Quarter: "Commerce", Lat: 6.88777, Lng: -6.44843, Real: true,
						Source: game.Partial("Le rond-point au cœur du quartier Commerce, sur la grande route ; position d'après OpenStreetMap.", srcOSM)},
					{ID: game.DaloaZoneID, Name: "Magasins de cacao de la Zone industrielle", Kind: "office", Quarter: "Zone Industrielle", Lat: 6.89526, Lng: -6.46952, Real: true, Approx: true,
						Source: game.Partial("La Zone industrielle, à l'ouest du centre, où les exportateurs reçoivent le cacao de la région ; le quartier d'après OpenStreetMap, les magasins sont ceux du jeu.", srcOSM)},
				}},
		},
	},
}

// Without: the cities with these places and communes left out (the updates not opened yet,
// features.HiddenPlaces); the cities themselves untouched when there is nothing to hide.
func Without(hidden map[string]bool) []City {
	if len(hidden) == 0 {
		return Cities
	}
	out := make([]City, len(Cities))
	for i, c := range Cities {
		c.Communes = slices.Clone(c.Communes)
		c.Communes = slices.DeleteFunc(c.Communes, func(cm Commune) bool { return hidden[cm.ID] })
		for j, cm := range c.Communes {
			c.Communes[j].Places = slices.DeleteFunc(slices.Clone(cm.Places), func(p Place) bool { return hidden[p.ID] })
		}
		out[i] = c
	}
	return out
}

// Nearest: the commune closest to a real position, if one is within maxKm.
// Its places count as well as its centre, since communes aren't round. Only
// the commune is kept: the player's coordinates are never stored.
func Nearest(lat, lng, maxKm float64) (City, Commune, bool) {
	var bestCity City
	var best Commune
	bestKm := math.Inf(1)
	for _, c := range Cities {
		for _, cm := range c.Communes {
			if d := distanceKm(lat, lng, cm.Lat, cm.Lng); d < bestKm {
				bestCity, best, bestKm = c, cm, d
			}
			for _, p := range cm.Places {
				if d := distanceKm(lat, lng, p.Lat, p.Lng); d < bestKm {
					bestCity, best, bestKm = c, cm, d
				}
			}
		}
	}
	return bestCity, best, bestKm <= maxKm
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
// FindCommune: a commune of a city.
func FindCommune(city, commune string) (City, Commune, bool) {
	c, ok := FindCity(city)
	if !ok {
		return City{}, Commune{}, false
	}
	for _, m := range c.Communes {
		if m.ID == commune {
			return c, m, true
		}
	}
	return c, Commune{}, false
}

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
	// Not a hand-made place: one of the commune's places from the map?
	return mapPlace(id)
}

// Trip returns the game minutes and FCFA fare to go from one commune to
// another: woro-woro/gbaka inside a city, intercity bus between cities.
func Trip(fromCity City, fromCommune Commune, toCity City, toCommune Commune) (minutes int64, fare int) {
	minutes, fare, _ = TripPath(fromCity, fromCommune, toCity, toCommune)
	return minutes, fare
}

// Trips are shortened for the game: a ride across Abidjan takes minutes, not
// the hour it can take for real, and the bus to Bouaké under an hour.
const (
	cityMinBase, cityMinPerKm = 2, 0.6   // + 1 min per bridge
	busMinBase, busKmPerMin   = 10, 12.0 // road km covered per game minute
)

// TripPath is Trip plus the way the trip goes: on the city's roads (and over
// its bridges) when it has a road network, otherwise straight.
func TripPath(fromCity City, fromCommune Commune, toCity City, toCommune Commune) (minutes int64, fare int, path Path) {
	km := distanceKm(fromCommune.Lat, fromCommune.Lng, toCommune.Lat, toCommune.Lng)
	straight := Path{Points: [][2]float64{{fromCommune.Lng, fromCommune.Lat}, {toCommune.Lng, toCommune.Lat}}, Km: math.Round(km*winding*10) / 10}
	if fromCity.ID == toCity.ID {
		if fromCommune.ID == toCommune.ID {
			return 0, 0, Path{}
		}
		path, ok := RouteIn(fromCity.ID, fromCommune.ID, toCommune.ID)
		if !ok {
			path = straight
		}
		minutes = int64(math.Round(cityMinBase+path.Km*cityMinPerKm)) + int64(len(path.Bridges))
		return minutes, 300 + 50*int(path.Km/3) + TollOf(path.Bridges)/TollSeats, path
	}
	// Roads are not straight: ~1.3× the crow-flies distance.
	road := km * 1.3
	straight.Km = math.Round(road*10) / 10
	return busMinBase + int64(road/busKmPerMin), roundTo(road*25, 500), straight
}

// The 3e pont (Henri-Konan-Bédié) is a toll bridge: 500 F for a car when the
// toll opened (category I, light vehicles), and taxi drivers pass it on to
// their passengers. A taxi compteur or an app ride adds the whole toll; a
// woro-woro shares it between its seats (a game rule: about five a car).
const (
	TollBridge = "3e pont"
	HKBToll    = 500
	TollSeats  = 5
)

// TollOf is the toll a car pays on a trip over these bridges.
func TollOf(bridges []string) int {
	if slices.Contains(bridges, TollBridge) {
		return HKBToll
	}
	return 0
}

// withToll turns a seat-fare multiple into a car's fare: the shared toll comes
// out of the seat price, the whole toll goes on top.
func withToll(seat int, bridges []string, times float64, min, round int) int {
	toll := TollOf(bridges)
	return max(min, roundTo(float64(seat-toll/TollSeats)*times, round)) + toll
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
