package game

// Vehicles of one's own (sims/garage.go, web screens/BolideApp.tsx): bought on
// the Bolide app, each kept in one of one's own places for it (a bike rack, a
// moto parking, a garage, each bought in a commune), and driven in the street
// (web world3d/drive.ts). The brands are the game's own; the prices a game
// balance, set against the pay of a shift (game/economy.go Careers): a bike is
// a few days' work, a moto weeks, a car months, the limousine a dream.

// VehicleModel: what can be bought. Body is how it's drawn (web world3d/vehicles.tsx:
// "velo", "moto", or a car model); FuelPerKm is what a kilometre costs in petrol (0 on a bike).
type VehicleModel struct {
	ID        string   `json:"id"`
	Kind      string   `json:"kind"` // "velo", "moto", "voiture"
	Name      string   `json:"name"`
	Price     int      `json:"price"`
	TopSpeed  int      `json:"topSpeed"` // km/h, in town
	Body      string   `json:"body"`
	Colors    []string `json:"colors"`
	FuelPerKm int      `json:"fuelPerKm"`
	About     string   `json:"about"`
}

// ParkingKind: a place to keep vehicles of one kind, bought in a commune.
type ParkingKind struct {
	ID    string `json:"id"`
	For   string `json:"for"` // the vehicle kind it keeps
	Name  string `json:"name"`
	Slots int    `json:"slots"`
	Price int    `json:"price"`
	About string `json:"about"`
}

var VehicleModels = []VehicleModel{
	{ID: "velo-kodjo", Kind: "velo", Name: "Kodjo, vélo de ville", Price: 28000, TopSpeed: 20, Body: "velo", Colors: []string{"#1f6fd0", "#e03131", "#2f9e44", "#16161c"},
		About: "Le vélo solide du quartier : un porte-bagages, une sonnette, pas de vitesses. Ça ne coûte rien à faire rouler."},
	{ID: "velo-savane", Kind: "velo", Name: "Savane VTT", Price: 65000, TopSpeed: 27, Body: "velo", Colors: []string{"#ff7a00", "#16161c", "#f4c430", "#7b5cff"},
		About: "Vingt et une vitesses, des pneus larges : pour les côtes de Cocody et les pistes de Bingerville."},
	{ID: "moto-baobab", Kind: "moto", Name: "Baobab 110", Price: 320000, TopSpeed: 60, Body: "moto", FuelPerKm: 25, Colors: []string{"#c92a2a", "#1c7ed6", "#16161c", "#e9ecef"},
		About: "La petite moto de tout Abidjan : sobre, increvable, réparée à chaque coin de rue."},
	{ID: "moto-lagune", Kind: "moto", Name: "Lagune 150 Sport", Price: 640000, TopSpeed: 85, Body: "moto", FuelPerKm: 35, Colors: []string{"#00b86b", "#ff7a00", "#16161c", "#7b5cff"},
		About: "La moto qui fait tourner les têtes sur le boulevard : plus nerveuse, plus brillante."},
	{ID: "auto-akwaba", Kind: "voiture", Name: "Akwaba citadine", Price: 1800000, TopSpeed: 80, Body: "saloon", FuelPerKm: 60, Colors: []string{"#f8f9fa", "#c92a2a", "#1c7ed6", "#adb5bd"},
		About: "La petite voiture pour se faufiler dans les embouteillages et se garer partout."},
	{ID: "auto-kolatier", Kind: "voiture", Name: "Kolatier berline", Price: 4500000, TopSpeed: 90, Body: "berline", FuelPerKm: 75, Colors: []string{"#212529", "#f8f9fa", "#7a1f2b", "#1b2a4a"},
		About: "La berline des cadres du Plateau : confortable, climatisée, sérieuse."},
	{ID: "auto-comoe", Kind: "voiture", Name: "Comoé SUV", Price: 9000000, TopSpeed: 90, Body: "suv", FuelPerKm: 95, Colors: []string{"#f8f9fa", "#212529", "#c9b48a", "#6c757d"},
		About: "Haut sur roues, grand coffre : pour la famille, le marché et le week-end à Assinie."},
	{ID: "auto-nimba", Kind: "voiture", Name: "Nimba 4x4", Price: 14000000, TopSpeed: 85, Body: "4x4", FuelPerKm: 120, Colors: []string{"#f8f9fa", "#212529", "#2f6b3a", "#c9b48a"},
		About: "Le 4x4 qui passe partout, des pistes de l'intérieur aux caniveaux de la saison des pluies."},
	{ID: "auto-prestige", Kind: "voiture", Name: "Prestige limousine", Price: 32000000, TopSpeed: 90, Body: "limo", FuelPerKm: 150, Colors: []string{"#0f1115", "#f4f4f2"},
		About: "La longue voiture des mariages et des stars : on te regarde passer."},
}

var ParkingKinds = []ParkingKind{
	{ID: "range-velo", For: "velo", Name: "Range-vélo", Slots: 3, Price: 15000, About: "Un coin sous l'auvent et un bon cadenas : trois vélos à l'abri."},
	{ID: "parking-moto", For: "moto", Name: "Parking moto", Slots: 2, Price: 90000, About: "Deux places gardées jour et nuit par le gardien du parking."},
	{ID: "garage", For: "voiture", Name: "Garage", Slots: 2, Price: 700000, About: "Un garage fermé pour deux voitures : la clé est à toi."},
}

func FindVehicleModel(id string) (VehicleModel, bool) {
	for _, m := range VehicleModels {
		if m.ID == id {
			return m, true
		}
	}
	return VehicleModel{}, false
}

func FindParkingKind(id string) (ParkingKind, bool) {
	for _, p := range ParkingKinds {
		if p.ID == id {
			return p, true
		}
	}
	return ParkingKind{}, false
}

// ResaleShare: what a vehicle sells back for, of its price.
const ResaleShare = 0.6
