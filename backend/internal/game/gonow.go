package game

// GoNow: the phone's adult night app (invented), and the same acts in the
// street after dark and at the hotel. Real 3D scenes (web avatar/intimacy.ts),
// nothing faded to black. Adults only: Sim grown up + users.adult_at.
// Feature « gonow » / app:gonow.

const (
	GoNowApp     = "gonow"
	GoNowKey     = "gonow"
	StreetGoKind = "go"
	// Club pole girls (barre de fer): watching, then a private dance.
	PoleWatchID   = "barre-regarder"
	PolePrivateID = "barre-privee"
)

// Interaction IDs (same everywhere: home with a partner, street, hotel, app).
const (
	IntimiteBJID         = "intimite-bj"
	IntimiteHJID         = "intimite-hj"
	IntimiteCowgirlID    = "intimite-cowgirl"
	IntimiteRevCowgirlID = "intimite-rev-cowgirl"
	IntimiteDoggyID      = "intimite-doggy"
	IntimiteMissionaryID = "intimite-missionary"
	IntimiteSpoonID      = "intimite-spoon"
	IntimiteStandID      = "intimite-stand"
	IntimiteLotusID      = "intimite-lotus"
	IntimiteSixtyID      = "intimite-sixty"
)

// IntimiteIDs: every intimacy interaction (features.List, client overlays).
func IntimiteIDs() []string {
	return []string{
		IntimiteBJID, IntimiteHJID, IntimiteCowgirlID, IntimiteRevCowgirlID,
		IntimiteDoggyID, IntimiteMissionaryID, IntimiteSpoonID, IntimiteStandID,
		IntimiteLotusID, IntimiteSixtyID,
	}
}

// GonowInteractionIDs: intimite acts + the club's pole girls (blocked while the update is closed).
func GonowInteractionIDs() []string {
	return append(IntimiteIDs(), PoleWatchID, PolePrivateID, "street-go")
}

// IsIntimite: one of the adult scenes.
func IsIntimite(id string) bool {
	_, ok := GoServiceOf(id)
	return ok
}

// GoService: one paid (or free-at-home) act.
type GoService struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	About   string `json:"about"`
	Icon    string `json:"icon"`
	Price   int    `json:"price"`  // street / app base
	Hotel   int    `json:"hotel"`  // at a hotel (room + company)
	Minutes int64  `json:"minutes"`
	Effect  Needs  `json:"effect"`
}

// GoServices: the menu (French labels for the game).
var GoServices = []GoService{
	{ID: IntimiteHJID, Label: "Branlette", About: "À la main. La scène se joue en 3D.", Icon: "heart", Price: 3000, Hotel: 18000, Minutes: 15, Effect: Needs{Fun: 25, Social: 12, Energy: -4, Hygiene: -4}},
	{ID: IntimiteBJID, Label: "Fellation", About: "À genoux. La scène se joue en 3D.", Icon: "heart", Price: 5000, Hotel: 25000, Minutes: 25, Effect: Needs{Fun: 35, Social: 20, Energy: -8, Hygiene: -6}},
	{ID: IntimiteMissionaryID, Label: "Missionnaire", About: "Face à face, allongés. La scène se joue en 3D.", Icon: "heart", Price: 12000, Hotel: 35000, Minutes: 40, Effect: Needs{Fun: 42, Social: 32, Energy: -12, Hygiene: -10}},
	{ID: IntimiteCowgirlID, Label: "À califourchon", About: "Iel monte. La scène se joue en 3D.", Icon: "heart", Price: 15000, Hotel: 40000, Minutes: 40, Effect: Needs{Fun: 45, Social: 30, Energy: -14, Hygiene: -10}},
	{ID: IntimiteRevCowgirlID, Label: "Califourchon inversé", About: "Dos tourné. La scène se joue en 3D.", Icon: "heart", Price: 16000, Hotel: 42000, Minutes: 40, Effect: Needs{Fun: 46, Social: 28, Energy: -14, Hygiene: -10}},
	{ID: IntimiteLotusID, Label: "Lotus", About: "Assis face à face. La scène se joue en 3D.", Icon: "heart", Price: 14000, Hotel: 38000, Minutes: 35, Effect: Needs{Fun: 44, Social: 35, Energy: -12, Hygiene: -8}},
	{ID: IntimiteSpoonID, Label: "Cuillère", About: "Collés sur le côté. La scène se joue en 3D.", Icon: "heart", Price: 11000, Hotel: 32000, Minutes: 35, Effect: Needs{Fun: 38, Social: 34, Energy: -10, Hygiene: -8}},
	{ID: IntimiteDoggyID, Label: "En levrette", About: "Par-derrière. La scène se joue en 3D.", Icon: "heart", Price: 20000, Hotel: 50000, Minutes: 45, Effect: Needs{Fun: 50, Social: 28, Energy: -16, Hygiene: -12}},
	{ID: IntimiteStandID, Label: "Debout", About: "Contre le mur. La scène se joue en 3D.", Icon: "heart", Price: 18000, Hotel: 45000, Minutes: 30, Effect: Needs{Fun: 48, Social: 22, Energy: -18, Hygiene: -10}},
	{ID: IntimiteSixtyID, Label: "69", About: "En même temps. La scène se joue en 3D.", Icon: "heart", Price: 22000, Hotel: 55000, Minutes: 35, Effect: Needs{Fun: 52, Social: 30, Energy: -14, Hygiene: -14}},
}

// GoServiceOf: the act of that interaction id.
func GoServiceOf(id string) (GoService, bool) {
	for _, s := range GoServices {
		if s.ID == id {
			return s, true
		}
	}
	return GoService{}, false
}

// GoProfile: a booked companion on the app (fictional).
type GoProfile struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Commune string  `json:"commune"`
	About   string  `json:"about"`
	Tier    string  `json:"tier"` // rue | studio | suite
	Mult    float64 `json:"mult"`
	Gender  string  `json:"gender"`
	Seed    int     `json:"seed"`
}

// GoProfiles: the app's cast (Abidjan, invented names).
var GoProfiles = []GoProfile{
	{ID: "awa-yop", Name: "Awa", Commune: "yopougon", About: "Yopougon, dispo le soir. Directe.", Tier: "rue", Mult: 1, Gender: "femme", Seed: 11},
	{ID: "blessing-marcory", Name: "Blessing", Commune: "marcory", About: "Marcory Zone 4. Soft ou hard.", Tier: "studio", Mult: 1.4, Gender: "femme", Seed: 22},
	{ID: "sarah-cocody", Name: "Sarah", Commune: "cocody", About: "Cocody. Hôtel seulement.", Tier: "suite", Mult: 2.2, Gender: "femme", Seed: 33},
	{ID: "fatou-treich", Name: "Fatou", Commune: "treichville", About: "Treichville, coin rue. Prix doux.", Tier: "rue", Mult: 0.9, Gender: "femme", Seed: 44},
	{ID: "melissa-plateau", Name: "Mélissa", Commune: "plateau", About: "Plateau, après les bureaux.", Tier: "studio", Mult: 1.6, Gender: "femme", Seed: 55},
	{ID: "grace-koumassi", Name: "Grace", Commune: "koumassi", About: "Koumassi. Chaude, pas pressée.", Tier: "studio", Mult: 1.2, Gender: "femme", Seed: 77},
	{ID: "chris-yop", Name: "Chris", Commune: "yopougon", About: "Yopougon. Pour celles qui savent.", Tier: "studio", Mult: 1.3, Gender: "homme", Seed: 66},
	{ID: "kevin-marcory", Name: "Kevin", Commune: "marcory", About: "Marcory. Discret, sérieux.", Tier: "suite", Mult: 1.8, Gender: "homme", Seed: 88},
}

// GoProfileOf finds a profile by id.
func GoProfileOf(id string) (GoProfile, bool) {
	for _, p := range GoProfiles {
		if p.ID == id {
			return p, true
		}
	}
	return GoProfile{}, false
}

// GoPrice: what a profile charges for a service (street / app).
func GoPrice(p GoProfile, s GoService) int {
	n := int(float64(s.Price) * p.Mult)
	if n < 1000 {
		return 1000
	}
	return ((n + 249) / 500) * 500
}

// Interaction builds the catalog-style act (adults, night hours).
func (s GoService) Interaction(cost int) Interaction {
	return Interaction{
		ID: s.ID, Label: s.Label, Icon: s.Icon, Minutes: s.Minutes, Cost: cost,
		Effect: s.Effect, Ages: Adults, MinHour: 20, MaxHour: 5,
	}
}

// HomeIntimite: free with a partner living at home (same acts, no cost, any hour once adult).
func (s GoService) HomeIntimite() Interaction {
	it := s.Interaction(0)
	it.MinHour, it.MaxHour = 0, 0
	it.Room = RoomBed
	return it
}
