package world

import "github.com/myahse/babi-life/backend/internal/game"

// Abidjan's banks (game/braquage.go, the place kind « banque »): the game's own banks, each where the
// map has a real bank's branch (OpenStreetMap, amenity=bank), under a name made up for the game (as
// Oranjo for the operator, Babi Burger for the burgers): the guichet, the distributeur, the conseiller,
// and, with the update « braquages », the big job. The branch they stand on is noted in each source.

type bankBranch struct {
	commune, id, name, quarter, onMap string
	lat, lng                          float64
}

var bankBranches = []bankBranch{
	{"plateau", "plateau-banque-lagunaire", "Banque Lagunaire (siège)", "Plateau", "Bank of Africa, avenue Terrasson de Fougères", 5.32436, -4.01900},
	{"plateau", "plateau-babi-banque", "Babi Banque", "Plateau", "Versus Bank, avenue Botreau Roussel", 5.32099, -4.01538},
	{"cocody", "cocody-credit-elephant", "Crédit de l'Éléphant", "Riviera 2", "BNI, avenue Marcel Zadi Kessy", 5.34022, -3.97460},
	{"cocody", "cocody-banque-golfe", "Banque du Golfe", "Attoban", "une agence, rue C23", 5.36708, -3.97945},
	{"yopougon", "yop-caisse-populaire", "Caisse Populaire de Yop", "Siporex", "une agence, route de Dabou", 5.35574, -4.07650},
	{"adjame", "adjame-banque-lagunes", "Banque des Lagunes", "Williamsville", "une agence, avenue Djeni Kobena", 5.36749, -4.02317},
	{"abobo", "abobo-banque-sagbe", "Banque de Sagbé", "Sagbé", "BNI, rond-point de la mairie", 5.42341, -4.01568},
	{"treichville", "treich-union-bancaire", "Union Bancaire du Sud", "Zone 2", "Coris Bank, avenue Désiré Boni", 5.30288, -4.01401},
	{"marcory", "marcory-banque-zone4", "Banque de la Zone 4", "Zone 4", "Ecobank, rue Alliali Hervé", 5.29414, -3.98208},
	{"koumassi", "koumassi-credit-remblais", "Crédit des Remblais", "Remblais", "Coris Bank, avenue Kassoum Coulibaly", 5.29375, -3.95628},
}

func init() {
	for _, b := range bankBranches {
		for ci := range Cities {
			if Cities[ci].ID != "abidjan" {
				continue
			}
			for mi := range Cities[ci].Communes {
				m := &Cities[ci].Communes[mi]
				if m.ID != b.commune {
					continue
				}
				m.Places = append(m.Places, Place{ID: b.id, Name: b.name, Kind: game.BanqueKind, Quarter: b.quarter, Lat: b.lat, Lng: b.lng, Approx: true,
					Source: game.Partial("Banque du jeu (nom inventé), placée sur une vraie agence bancaire de la carte : "+b.onMap+" (position d'après OpenStreetMap).", "https://www.openstreetmap.org/copyright")})
			}
		}
	}
}
