package game

// Babi Foot's career (web components/defi/foot/Career.tsx): the Sim's club,
// the one of its neighbourhood, and the players it can sign on the market
// for Djai to make its side stronger. A signing is paid once and kept;
// released, he's gone for nothing: the career costs, it never pays out.
// The names are made up.

// FootRecruit: a player on the market: where he plays (G keeper, D back, M
// midfield, A forward), how good (3 to 5 stars), his price.
type FootRecruit struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Post  string `json:"post"`
	Stars int    `json:"stars"`
	Price int    `json:"price"`
}

// FootSquadMax: how many signings a club has at once.
const FootSquadMax = 5

// FootPrice: a signing's price by his stars.
var FootPrice = map[int]int{3: 3000, 4: 7500, 5: 15000}

func footRecruit(id, name, post string, stars int) FootRecruit {
	return FootRecruit{ID: id, Name: name, Post: post, Stars: stars, Price: FootPrice[stars]}
}

var FootRecruits = []FootRecruit{
	footRecruit("ahoure", "Didier Ahouré", "G", 3),
	footRecruit("oupoh", "Félix Oupoh", "G", 4),
	footRecruit("gnagne", "Ange Gnagne", "G", 5),
	footRecruit("djedje", "Ismaël Djédjé", "D", 3),
	footRecruit("kouadio", "Hermann Kouadio", "D", 3),
	footRecruit("able", "Serge Ablé", "D", 4),
	footRecruit("yapi", "Rodrigue Yapi", "D", 5),
	footRecruit("ehouman", "Junior Ehouman", "M", 3),
	footRecruit("akpa", "Blaise Akpa", "M", 3),
	footRecruit("gbane", "Arnaud Gbané", "M", 4),
	footRecruit("meite", "Fousseni Méité", "M", 5),
	footRecruit("blehi", "Yannick Bléhi", "A", 3),
	footRecruit("fofie", "Abdoul Fofié", "A", 3),
	footRecruit("gnepa", "Elvis Gnépa", "A", 4),
	footRecruit("amani", "Christ Amani", "A", 4),
	footRecruit("kipre", "Jonathan Kipré", "A", 5),
}

// FindFootRecruit: a player on the market by his id.
func FindFootRecruit(id string) (FootRecruit, bool) {
	for _, p := range FootRecruits {
		if p.ID == id {
			return p, true
		}
	}
	return FootRecruit{}, false
}
