package world

import "github.com/myahse/babi-life/backend/internal/game"

// The communes in detail (the update « communes-detail », game/quartiers.go): the carrefours and
// rond-points everybody knows and meets at, and the préfectures and sous-préfectures, each where
// OpenStreetMap has it (names and points read through Nominatim on 2026-11-12). A carrefour's point is
// the junction's; the game sets its corner beside the street (web world3d/open/carrefours.tsx), so it is
// approximate. (Run before osm.go's init: the map's own « Préfecture de Bouaké » is then left out as the
// same place.)

const srcNominatim = "https://nominatim.openstreetmap.org/"

type extraPlace struct {
	commune, id, name, kind, quarter string
	lat, lng                         float64
	what                             string
}

var quartierPlaces = []extraPlace{
	// Yopougon.
	{"yopougon", "yop-carrefour-siporex", "Rond-point de Siporex", "carrefour", "Siporex", 5.35580, -4.07400, "le rond-point de Siporex, boulevard Principal et route de Dabou"},
	{"yopougon", "yop-carrefour-sable", "Carrefour Sable", "carrefour", "Sable", 5.35638, -4.06626, "le carrefour Sable, sur la route de Dabou"},
	{"yopougon", "yop-carrefour-koute", "Carrefour Kouté", "carrefour", "Kouté", 5.32900, -4.06925, "l'arrêt « Carrefour Kouté », rue O130 (un autre arrêt du même nom est au village de Kouté)"},
	// Cocody.
	{"cocody", "cocody-carrefour-saint-jean", "Carrefour Saint-Jean", "carrefour", "Vieux Cocody", 5.33606, -4.00390, "le carrefour Saint-Jean, boulevard Thérèse-Houphouët-Boigny"},
	{"cocody", "cocody-carrefour-riviera2", "Carrefour Riviera 2", "carrefour", "Riviera 2", 5.35328, -3.97872, "les arrêts « Carrefour Riviera 2 », boulevard Germain-Koffi-Gadeau, près de l'échangeur"},
	{"cocody", "cocody-rond-point-palmeraie", "Rond-point de la Palmeraie", "carrefour", "Riviera Palmeraie", 5.36440, -3.95988, "le rond-point de la Palmeraie"},
	{"cocody", "cocody-angre-chateau", "Angré Château", "carrefour", "Angré", 5.41240, -3.98160, "les arrêts « Carrefour Château » et « Angré Château », près du château d'eau d'Angré"},
	// Adjamé, Plateau.
	{"adjame", "adjame-carrefour-liberte", "Carrefour Liberté", "carrefour", "Williamsville", 5.35344, -4.01680, "le rond-point de la Liberté (arrêt « Carrefour Liberté Adjamé »)"},
	{"plateau", "plateau-carrefour-indenie", "Carrefour de l'Indénié", "carrefour", "Indénié", 5.34110, -4.01700, "le carrefour de l'Indénié, boulevard Alassane-Ouattara, entre le Plateau, Adjamé et Cocody"},
	{"plateau", "plateau-prefecture", "Préfecture d'Abidjan", "prefecture", "Indénié", 5.33577, -4.02043, "la préfecture d'Abidjan, avenue Guy-Nairay"},
	// Treichville, Koumassi, Port-Bouët.
	{"treichville", "treich-grand-carrefour", "Grand carrefour de Treichville", "carrefour", "Arras", 5.29850, -4.00230, "le grand carrefour de Treichville, boulevard Félix-Houphouët-Boigny, à la gare de Bassam"},
	{"koumassi", "koumassi-grand-carrefour", "Grand carrefour de Koumassi", "carrefour", "Koumassi", 5.28822, -3.97050, "le grand carrefour de Koumassi, boulevard Félix-Houphouët-Boigny"},
	{"port-bouet", "pb-carrefour-akwaba", "Carrefour Akwaba", "carrefour", "Déhita", 5.26697, -3.96097, "le rond-point Akwaba, à l'échangeur sur le boulevard VGE"},
	// Abobo.
	{"abobo", "abobo-gare-carrefour", "Abobo Gare", "carrefour", "Sagbé", 5.42086, -4.01789, "le carrefour d'Abobo Gare, au rond-point de la Mairie"},
	{"abobo", "abobo-carrefour-samake", "Carrefour Samaké", "carrefour", "Samaké", 5.41586, -4.00797, "l'arrêt « Carrefour Samaké »"},
	// The sous-préfectures of the district's outer communes.
	{"bingerville", "bingerville-sous-prefecture", "Sous-préfecture de Bingerville", "prefecture", "", 5.35737, -3.89042, "la sous-préfecture, rue Adjê-Pêssi"},
	{"anyama", "anyama-sous-prefecture", "Sous-préfecture d'Anyama", "prefecture", "Sossokoua", 5.49547, -4.05860, "la sous-préfecture, rue Colonel-Major-Kouamé-Brou"},
	{"songon", "songon-sous-prefecture", "Sous-préfecture de Songon", "prefecture", "Djèpoto", 5.31898, -4.20081, "la sous-préfecture, boulevard Koui-Mamadou"},
	// The other towns.
	{"yakro-centre", "yakro-rond-point-chateau", "Rond-point du Château d'Eau", "carrefour", "Habitat", 6.82450, -5.27382, "le rond-point du Château d'Eau"},
	{"yakro-centre", "yakro-prefecture", "Préfecture de Yamoussoukro", "prefecture", "Assabou", 6.83954, -5.26385, "la préfecture, à Assabou"},
	{"bouake-centre", "bouake-rond-point-gare", "Rond-point de la Gare routière", "carrefour", "Koko", 7.68862, -5.02783, "le rond-point de la Gare routière"},
	{"bouake-centre", "bouake-place-paix", "Place de la Paix", "carrefour", "TSF Nord", 7.68388, -5.02018, "la place de la Paix"},
	{"bouake-centre", "bouake-rond-point-kennedy", "Rond-point de Kennedy", "carrefour", "TSF Nord", 7.68727, -5.01250, "le rond-point de Kennedy"},
	{"bouake-centre", "bouake-prefecture", "Préfecture de Bouaké", "prefecture", "Koko", 7.69950, -5.03376, "la préfecture, à Koko"},
	{"sp-centre", "sp-rond-point-gare", "Rond-point de la Gare routière", "carrefour", "Séwéké", 4.77830, -6.64675, "le rond-point de la Gare routière"},
	{"sp-centre", "sp-rond-point-cite", "Rond-point de la Cité", "carrefour", "La Cité", 4.74858, -6.63593, "le rond-point de la Cité"},
	{"sp-centre", "sp-prefecture", "Préfecture de San-Pédro", "prefecture", "Séwéké", 4.76233, -6.64748, "la préfecture, à Séwéké"},
	{"korhogo-centre", "korhogo-prefecture", "Préfecture de Korhogo", "prefecture", "Air France", 9.45199, -5.63417, "la préfecture de région"},
	{"bassam-france", "bassam-rond-point-moossou", "Rond-point de Moossou", "carrefour", "Moossou", 5.22373, -3.72836, "le rond-point de Moossou, à l'entrée de la ville"},
	{"bassam-france", "bassam-prefecture", "Préfecture de Grand-Bassam", "prefecture", "Quartier France", 5.19621, -3.73741, "la préfecture, au Quartier France"},
}

// QuartierPlaceIDs: the places the update brings (features.go: hidden while it's closed).
func QuartierPlaceIDs() []string {
	out := make([]string, len(quartierPlaces))
	for i, p := range quartierPlaces {
		out[i] = p.id
	}
	return out
}

func init() {
	for _, e := range quartierPlaces {
		cm := communeRef(e.commune)
		if cm == nil {
			panic("carrefours.go: unknown commune " + e.commune)
		}
		p := Place{ID: e.id, Name: e.name, Kind: e.kind, Quarter: e.quarter, Lat: e.lat, Lng: e.lng, Real: true, Approx: e.kind == "carrefour",
			Source: game.Partial("Nom et position d'après OpenStreetMap : "+e.what+".", srcOSM, srcNominatim)}
		if e.kind == "prefecture" {
			p.Operator = "État de Côte d'Ivoire (administration territoriale)"
		}
		cm.Places = append(cm.Places, p)
	}
}

// communeRef: the commune of that ID, to add to it.
func communeRef(id string) *Commune {
	for i := range Cities {
		for j := range Cities[i].Communes {
			if Cities[i].Communes[j].ID == id {
				return &Cities[i].Communes[j]
			}
		}
	}
	return nil
}
