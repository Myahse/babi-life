package game

// The clothes sold in the boutiques (« Faire les boutiques » at the malls, the
// market's wax sellers): pieces of invented brands, each a whole outfit or an
// accessory, bought once with Djai and kept in the wardrobe, put on with a
// tap. The base outfits and colours stay free in « Changer de look »; the
// pieces' own prints (bogolan, madras, fleurs, léopard, camouflage, adinkra)
// are only worn by those who bought one (sims/look.go); like every print, on
// the wax outfits (pagne, chemise en pagne, robe, kaba, boubou). Drawn in
// web/src/avatar/BlockHuman.tsx (waxPx).

type ClothingPiece struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Brand string `json:"brand"`
	// tenue: the whole outfit; accessoire: one more accessory, the rest kept.
	Kind string `json:"kind"`
	// "" for all, else femme or homme.
	Gender string `json:"gender,omitempty"`
	Price  int    `json:"price"`
	// What it puts on (empty: left as it is).
	Outfit         string `json:"outfit,omitempty"`
	OutfitColor    string `json:"outfitColor,omitempty"`
	Pattern        string `json:"pattern,omitempty"`
	BottomColor    string `json:"bottomColor,omitempty"`
	ShoeColor      string `json:"shoeColor,omitempty"`
	Accessory      string `json:"accessory,omitempty"`
	AccessoryColor string `json:"accessoryColor,omitempty"`
	// Where it's sold: mall (the centres' boutiques), marche (the wax and the pagne).
	Shop string `json:"shop"`
}

// The activities where the pieces are bought, by shop.
const (
	ShopMallID   = "boutique-mode"
	ShopMarketID = "boutique-wax"
)

// ShopOf: the shop an activity is in ("" when it isn't one).
func ShopOf(interactionID string) string {
	switch interactionID {
	case ShopMallID:
		return "mall"
	case ShopMarketID:
		return "marche"
	}
	return ""
}

// PiecePatterns: the prints that only come with a piece.
var PiecePatterns = []string{"bogolan", "madras", "fleurs", "leopard", "camo", "adinkra"}

func tenue(id, label, brand, gender string, price int, outfit, color, pattern, bottom, shoes, shop string) ClothingPiece {
	return ClothingPiece{ID: id, Label: label, Brand: brand, Kind: "tenue", Gender: gender, Price: price, Outfit: outfit, OutfitColor: color, Pattern: pattern, BottomColor: bottom, ShoeColor: shoes, Shop: shop}
}

func accessoire(id, label, brand string, price int, acc, color string) ClothingPiece {
	return ClothingPiece{ID: id, Label: label, Brand: brand, Kind: "accessoire", Price: price, Accessory: acc, AccessoryColor: color, Shop: "mall"}
}

var Clothes = []ClothingPiece{
	// Babi Denim: the jeans and the tee-shirts.
	tenue("denim-classique", "Jean brut & tee-shirt blanc", "Babi Denim", "", 6000, "casual", "#f8f9fa", "", "#1f3a68", "#f8f9fa", "mall"),
	tenue("denim-noir", "Jean noir & tee-shirt noir", "Babi Denim", "", 6500, "casual", "#1b1b1f", "", "#141416", "#141416", "mall"),
	tenue("denim-orange", "Tee-shirt Babi orange & jean clair", "Babi Denim", "", 6000, "casual", "#ff7a00", "", "#6d8fc7", "#f8f9fa", "mall"),
	tenue("denim-blouson", "Blouson en jean & jean délavé", "Babi Denim", "", 14000, "blouson", "#3b5f9a", "", "#7f9cc9", "#e9ecef", "mall"),
	tenue("denim-salopette", "Salopette en jean", "Babi Denim", "", 11000, "salopette", "#36598f", "", "#36598f", "#f8f9fa", "mall"),
	tenue("denim-cuir", "Blouson de cuir & jean noir", "Babi Denim", "", 28000, "blouson", "#2b1d14", "", "#141416", "#141416", "mall"),
	// Kôrô Wear: the street, the hoodies, the joggings.
	tenue("koro-sweat-gris", "Sweat à capuche gris chiné", "Kôrô Wear", "", 9000, "sweat", "#8d939a", "", "#2b2d31", "#f8f9fa", "mall"),
	tenue("koro-sweat-vert", "Sweat à capuche vert bouteille", "Kôrô Wear", "", 9500, "sweat", "#1e5a3a", "", "#141416", "#141416", "mall"),
	tenue("koro-camo", "Chemise camouflage & cargo", "Kôrô Wear", "", 15000, "chemise-pagne", "#5d6b3c", "camo", "#3a4128", "#141416", "mall"),
	tenue("koro-jogging-bordeaux", "Jogging bordeaux", "Kôrô Wear", "", 8000, "jogging", "#7a1f2b", "", "#7a1f2b", "#f8f9fa", "mall"),
	tenue("koro-jogging-blanc", "Jogging tout blanc", "Kôrô Wear", "", 8500, "jogging", "#f1f3f5", "", "#f1f3f5", "#f1f3f5", "mall"),
	tenue("koro-debardeur", "Débardeur & short de plage", "Kôrô Wear", "", 4500, "debardeur", "#f2c94c", "", "#1f6feb", "#141416", "mall"),
	tenue("koro-leopard", "Chemise léopard & jean noir", "Kôrô Wear", "", 16000, "chemise-pagne", "#c8913a", "leopard", "#141416", "#141416", "mall"),
	// Lagune Sport: the tracksuits and the jerseys.
	tenue("lagune-survet-orange", "Survêtement orange et vert", "Lagune Sport", "", 12000, "survet", "#ff7a00", "", "#00a862", "#f8f9fa", "mall"),
	tenue("lagune-survet-noir", "Survêtement noir à bandes", "Lagune Sport", "", 12000, "survet", "#141416", "", "#141416", "#f8f9fa", "mall"),
	tenue("lagune-basket-bleu", "Tenue de basket bleu roi", "Lagune Sport", "", 9000, "basket", "#1f4fd1", "", "#1f4fd1", "#f8f9fa", "mall"),
	tenue("lagune-basket-rouge", "Tenue de basket rouge", "Lagune Sport", "", 9000, "basket", "#c92a2a", "", "#c92a2a", "#141416", "mall"),
	tenue("lagune-maillot-blanc", "Maillot extérieur blanc", "Lagune Sport", "", 10000, "jersey", "#f8f9fa", "", "#00a862", "#ff7a00", "mall"),
	tenue("lagune-bain", "Maillot de bain turquoise", "Lagune Sport", "", 5000, "maillot", "#00a3a3", "", "#00a3a3", "#f8f9fa", "mall"),
	// Plateau Prestige: the office, the evenings.
	tenue("plateau-costume-bleu", "Costume bleu nuit", "Plateau Prestige", "", 45000, "suit", "#14213d", "", "#14213d", "#141416", "mall"),
	tenue("plateau-costume-gris", "Costume gris anthracite", "Plateau Prestige", "", 42000, "suit", "#3d4147", "", "#3d4147", "#2b1d14", "mall"),
	tenue("plateau-costume-beige", "Costume lin beige", "Plateau Prestige", "", 40000, "suit", "#cbb994", "", "#cbb994", "#6b4423", "mall"),
	tenue("plateau-chemise-blanche", "Chemise blanche & pantalon noir", "Plateau Prestige", "", 15000, "chemise", "#f8f9fa", "", "#141416", "#141416", "mall"),
	tenue("plateau-chemise-ciel", "Chemise bleu ciel & chino", "Plateau Prestige", "", 14000, "chemise", "#a5c8ff", "", "#c2a878", "#6b4423", "mall"),
	tenue("plateau-chemise-madras", "Chemise madras & pantalon beige", "Plateau Prestige", "", 17000, "chemise-pagne", "#d6336c", "madras", "#cbb994", "#6b4423", "mall"),
	// Ébène Chic: the dresses and the skirts.
	tenue("ebene-robe-noire", "Petite robe noire", "Ébène Chic", "femme", 25000, "robe", "#141416", "", "", "#141416", "mall"),
	tenue("ebene-robe-rouge", "Robe longue rouge", "Ébène Chic", "femme", 30000, "robe", "#c92a2a", "", "", "#c9a227", "mall"),
	tenue("ebene-robe-fleurs", "Robe fleurie", "Ébène Chic", "femme", 22000, "robe", "#f7c6d9", "fleurs", "", "#f8f9fa", "mall"),
	tenue("ebene-robe-leopard", "Robe léopard", "Ébène Chic", "femme", 27000, "robe", "#c8913a", "leopard", "", "#141416", "mall"),
	tenue("ebene-jupe-rose", "Top blanc & jupe rose", "Ébène Chic", "femme", 13000, "jupe", "#f8f9fa", "", "#e64980", "#f8f9fa", "mall"),
	tenue("ebene-jupe-noire", "Top doré & jupe noire", "Ébène Chic", "femme", 16000, "jupe", "#c9a227", "", "#141416", "#141416", "mall"),
	tenue("ebene-jupe-pastel", "Top pêche & jupe crème", "Ébène Chic", "femme", 14000, "jupe", "#ffd8a8", "", "#f3ead8", "#c9a227", "mall"),
	// Wax d'Adjamé: the pagne, the boubous, the kaba (sold at the market).
	tenue("wax-pagne-orange", "Pagne wax orange à cercles", "Wax d'Adjamé", "", 9000, "pagne", "#ff7a00", "cercles", "#ff7a00", "#6b4423", "marche"),
	tenue("wax-pagne-bleu", "Pagne wax bleu à losanges", "Wax d'Adjamé", "", 9000, "pagne", "#1f4fd1", "losanges", "#1f4fd1", "#6b4423", "marche"),
	tenue("wax-pagne-adinkra", "Pagne aux symboles adinkra", "Wax d'Adjamé", "", 13000, "pagne", "#f2c94c", "adinkra", "#f2c94c", "#6b4423", "marche"),
	tenue("wax-kaba-vert", "Kaba vert à feuilles", "Wax d'Adjamé", "femme", 12000, "kaba", "#2f9e44", "feuilles", "", "#c9a227", "marche"),
	tenue("wax-kaba-fleurs", "Kaba fleuri", "Wax d'Adjamé", "femme", 14000, "kaba", "#e64980", "fleurs", "", "#c9a227", "marche"),
	tenue("wax-chemise-zigzag", "Chemise en pagne zigzag", "Wax d'Adjamé", "", 8000, "chemise-pagne", "#7b5cff", "zigzag", "#141416", "#141416", "marche"),
	tenue("wax-chemise-kente", "Chemise kente", "Wax d'Adjamé", "", 11000, "chemise-pagne", "#1f4fd1", "kente", "#141416", "#6b4423", "marche"),
	tenue("wax-boubou-blanc", "Grand boubou blanc", "Wax d'Adjamé", "", 18000, "boubou", "#f8f9fa", "", "#f8f9fa", "#c9a227", "marche"),
	tenue("wax-boubou-adinkra", "Grand boubou adinkra", "Wax d'Adjamé", "", 24000, "boubou", "#7a1f2b", "adinkra", "#7a1f2b", "#c9a227", "marche"),
	tenue("wax-bazin-bleu", "Bazin brodé bleu", "Wax d'Adjamé", "", 26000, "bazin", "#1f6feb", "", "#1f6feb", "#c9a227", "marche"),
	tenue("wax-bazin-violet", "Bazin brodé violet", "Wax d'Adjamé", "", 26000, "bazin", "#6741d9", "", "#6741d9", "#c9a227", "marche"),
	// Bogolan & Co: the mud cloth, from the north.
	tenue("bogolan-chemise", "Chemise bogolan", "Bogolan & Co", "", 15000, "chemise-pagne", "#6b4423", "bogolan", "#3d2b1f", "#3d2b1f", "marche"),
	tenue("bogolan-pagne", "Pagne bogolan", "Bogolan & Co", "", 15000, "pagne", "#8a5a2b", "bogolan", "#8a5a2b", "#3d2b1f", "marche"),
	tenue("bogolan-robe", "Robe bogolan", "Bogolan & Co", "femme", 20000, "robe", "#5c3b1e", "bogolan", "", "#3d2b1f", "marche"),
	tenue("bogolan-boubou", "Boubou bogolan", "Bogolan & Co", "", 22000, "boubou", "#7a4f2a", "bogolan", "#7a4f2a", "#3d2b1f", "marche"),
	// Zôgô Street: the accessories.
	accessoire("zogo-casquette-noire", "Casquette noire Zôgô", "Zôgô Street", 3000, "cap", "#141416"),
	accessoire("zogo-casquette-orange", "Casquette orange", "Zôgô Street", 3000, "cap", "#ff7a00"),
	accessoire("zogo-bob", "Bob de plage", "Zôgô Street", 3500, "buckethat", "#f2c94c"),
	accessoire("zogo-bonnet", "Bonnet en laine", "Zôgô Street", 2500, "beanie", "#7a1f2b"),
	accessoire("zogo-chapeau", "Chapeau panama", "Zôgô Street", 6000, "hat", "#e9dcc0"),
	accessoire("zogo-lunettes", "Lunettes de soleil", "Zôgô Street", 4000, "sunglasses", "#141416"),
	accessoire("zogo-chaine", "Chaîne dorée", "Zôgô Street", 12000, "chain", "#c9a227"),
	accessoire("zogo-montre", "Montre argentée", "Zôgô Street", 15000, "watch", "#ced4da"),
	accessoire("zogo-sac", "Sac en bandoulière cuir", "Zôgô Street", 9000, "bag", "#6b4423"),
	accessoire("zogo-casque", "Casque audio", "Zôgô Street", 11000, "headphones", "#141416"),
	accessoire("zogo-boucles", "Boucles d'oreilles dorées", "Zôgô Street", 7000, "earrings", "#c9a227"),
	accessoire("zogo-perles", "Collier de perles", "Zôgô Street", 5000, "beads", "#ff7a00"),
}

// FindPiece: a piece of the boutiques by its id.
func FindPiece(id string) (ClothingPiece, bool) {
	for _, p := range Clothes {
		if p.ID == id {
			return p, true
		}
	}
	return ClothingPiece{}, false
}

// The exclusive collection: only in the phone's Boutique (shop « exclu »), for more Djai, the
// pieces one sees on the stars of Babi; and the boutiques' pieces, all of them, can be bought
// there too (sims/clothes.go: from the app).
var Exclusives = []ClothingPiece{
	exclu("exclu-elephants-or", "Maillot des Éléphants, édition or", "Babi Life Édition", "", 60000, "jersey", "#c9a227", "", "#00a862", "#ff7a00"),
	exclu("exclu-coupe-decale", "Costume du coupé-décalé, doré", "Babi Life Édition", "", 150000, "suit", "#d4af37", "", "#141416", "#c9a227"),
	exclu("exclu-boubou-roi", "Grand boubou brodé or, blanc", "Babi Life Édition", "", 120000, "bazin", "#f8f9fa", "", "#f8f9fa", "#d4af37"),
	exclu("exclu-robe-gala", "Robe de gala rouge et or", "Babi Life Édition", "femme", 130000, "robe", "#9b111e", "", "", "#d4af37"),
	exclu("exclu-kaba-reine", "Kaba de la reine, kente", "Babi Life Édition", "femme", 90000, "kaba", "#6741d9", "kente", "", "#d4af37"),
	exclu("exclu-survet-babi", "Survêtement Babi Life orange et vert", "Babi Life Édition", "", 45000, "survet", "#ff7a00", "", "#00a862", "#f8f9fa"),
	exclu("exclu-bogolan-noir", "Boubou bogolan noir et blanc", "Babi Life Édition", "", 80000, "boubou", "#1d120b", "bogolan", "#1d120b", "#f8f9fa"),
	exclu("exclu-leopard-soiree", "Chemise léopard de soirée & pantalon blanc", "Babi Life Édition", "", 70000, "chemise-pagne", "#b8860b", "leopard", "#f8f9fa", "#d4af37"),
	{ID: "exclu-chaine-or", Label: "Grosse chaîne en or", Brand: "Babi Life Édition", Kind: "accessoire", Price: 50000, Accessory: "chain", AccessoryColor: "#ffd700", Shop: "exclu"},
	{ID: "exclu-lunettes-star", Label: "Lunettes de star dorées", Brand: "Babi Life Édition", Kind: "accessoire", Price: 35000, Accessory: "sunglasses", AccessoryColor: "#d4af37", Shop: "exclu"},
}

func exclu(id, label, brand, gender string, price int, outfit, color, pattern, bottom, shoes string) ClothingPiece {
	p := tenue(id, label, brand, gender, price, outfit, color, pattern, bottom, shoes, "exclu")
	return p
}

func init() { Clothes = append(Clothes, Exclusives...) }

// ClothingPack: a lot of pieces at once, a quarter off what they'd cost one by one (only those
// the Sim can wear and hasn't yet: PackPrice).
type ClothingPack struct {
	ID     string   `json:"id"`
	Label  string   `json:"label"`
	About  string   `json:"about"`
	Pieces []string `json:"pieces"`
}

var ClothingPacks = []ClothingPack{
	{ID: "pack-wax", Label: "Pack Wax", About: "Le pagne, la chemise, le boubou et le kaba du marché.", Pieces: []string{"wax-pagne-orange", "wax-chemise-kente", "wax-boubou-blanc", "wax-kaba-vert", "wax-chemise-zigzag"}},
	{ID: "pack-street", Label: "Pack Street", About: "Le sweat, le jogging, la casquette et le casque de Kôrô Wear et Zôgô Street.", Pieces: []string{"koro-sweat-gris", "koro-jogging-blanc", "koro-leopard", "zogo-casquette-noire", "zogo-casque"}},
	{ID: "pack-soiree", Label: "Pack Soirée", About: "De quoi briller la nuit : la tenue chic, la chaîne et la montre.", Pieces: []string{"plateau-costume-bleu", "ebene-robe-rouge", "zogo-chaine", "zogo-montre", "zogo-lunettes"}},
	{ID: "pack-bureau", Label: "Pack Bureau", About: "Pour le Plateau : chemises, costume et le sac.", Pieces: []string{"plateau-chemise-blanche", "plateau-chemise-ciel", "plateau-costume-gris", "ebene-jupe-noire", "zogo-sac"}},
	{ID: "pack-sport", Label: "Pack Sport", About: "Le survêtement, la tenue de basket, le maillot et le bob.", Pieces: []string{"lagune-survet-orange", "lagune-basket-bleu", "lagune-maillot-blanc", "lagune-bain", "zogo-bob"}},
	{ID: "pack-babi", Label: "Pack Babi Life Édition", About: "Toute la collection exclusive.", Pieces: []string{"exclu-elephants-or", "exclu-coupe-decale", "exclu-boubou-roi", "exclu-robe-gala", "exclu-kaba-reine", "exclu-survet-babi", "exclu-bogolan-noir", "exclu-leopard-soiree", "exclu-chaine-or", "exclu-lunettes-star"}},
}

// FindClothingPack: a lot by its id.
func FindClothingPack(id string) (ClothingPack, bool) {
	for _, p := range ClothingPacks {
		if p.ID == id {
			return p, true
		}
	}
	return ClothingPack{}, false
}

// PackPieces and PackPrice: what a lot brings a Sim of this gender who has `owned`, and for how
// much (three quarters of the pieces' prices, to the 500 Djai).
func PackPieces(p ClothingPack, gender string, owned []string) []ClothingPiece {
	var out []ClothingPiece
	for _, id := range p.Pieces {
		c, ok := FindPiece(id)
		if !ok || c.Gender != "" && c.Gender != gender {
			continue
		}
		had := false
		for _, o := range owned {
			had = had || o == id
		}
		if !had {
			out = append(out, c)
		}
	}
	return out
}

func PackPrice(pieces []ClothingPiece) int {
	sum := 0
	for _, c := range pieces {
		sum += c.Price
	}
	return (sum*3/4 + 250) / 500 * 500
}
