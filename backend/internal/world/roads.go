package world

import (
	"container/heap"
	"math"

	"github.com/myahse/babi-life/backend/internal/game"
)

// Abidjan's main roads, simplified: the communes, the junctions between them
// and the five bridges over the lagoon. Trips follow the shortest way through
// it, so going from the north bank to the south means a bridge, and the map
// draws the real crossing. Bridge positions come from published coordinates
// where there are some; everything else is placed from the roads' described
// routes and is approximate.
const (
	srcPontFHB  = "https://fr.wikipedia.org/wiki/Pont_F%C3%A9lix-Houphou%C3%ABt-Boigny"
	srcPontCDG  = "https://structurae.net/fr/ouvrages/pont-charles-de-gaulle-1967-abidjan"
	srcPontHKB  = "https://fr.wikipedia.org/wiki/Pont_Henri-Konan-B%C3%A9di%C3%A9"
	srcPontADO  = "https://news.abidjan.net/articles/724046/pont-alassane-ouattara-une-reponse-aux-defis-de-mobilite-dans-le-district-dabidjan"
	srcPont5    = "https://www.fratmat.info/article/231510/economie/5e-pont-dabidjan-le-president-ouattara-met-en-service-louvrage-dart-qui-porte-son-nom"
	srcPont4    = "https://www.yeclo.com/yopougon-plateau-voici-litineraire-du-4e-pont-dabidjan"
	srcPont4Len = "https://www.agenceecofin.com/transports/1401-115193-cote-d-ivoire-le-4e-pont-d-abidjan-et-5-autres-axes-routiers-construits-sur-financement-de-la-bad-ouverts-a-la-circulation"
)

// A RoadNode is a junction or a bridge end; communes are nodes too, at their centre.
type RoadNode struct {
	ID   string  `json:"id"`
	Name string  `json:"name,omitempty"`
	Lat  float64 `json:"lat"`
	Lng  float64 `json:"lng"`
}

// A Road joins two nodes, through Via points (lat, lng) so it bends where the
// real road does. Bridge: the bridge's name when the road is one.
type Road struct {
	A      string       `json:"a"`
	B      string       `json:"b"`
	Name   string       `json:"name,omitempty"`
	Bridge string       `json:"bridge,omitempty"`
	Via    [][2]float64 `json:"via,omitempty"`
	Source *game.Source `json:"source,omitempty"`
}

type RoadNet struct {
	Nodes []RoadNode `json:"nodes"`
	Roads []Road     `json:"roads"`
}

func bridge(a, b, name string, src *game.Source) Road {
	return Road{A: a, B: b, Name: name, Bridge: name, Source: src}
}

// Roads, by city. Communes are added as nodes from the world data.
var Roads = map[string]*RoadNet{
	"abidjan": {
		Nodes: []RoadNode{
			// The Félix-Houphouët-Boigny bridge, 372 m, centre 5°18′43″N 4°01′10″O.
			{ID: "fhb-n", Lat: 5.3150, Lng: -4.0203}, {ID: "fhb-s", Lat: 5.3088, Lng: -4.0186},
			// The Charles-de-Gaulle bridge, centre 5°18′57″N 4°00′36″O.
			{ID: "cdg-n", Lat: 5.3178, Lng: -4.0118}, {ID: "cdg-s", Lat: 5.3125, Lng: -4.0098},
			// The Henri-Konan-Bédié bridge, 1,5 km, centre 5°19′19″N 3°58′50″O.
			{ID: "hkb-n", Lat: 5.3290, Lng: -3.9812}, {ID: "hkb-s", Lat: 5.3140, Lng: -3.9800},
			// The Alassane-Ouattara bridge over the baie de Cocody, 630 m.
			{ID: "ado-o", Lat: 5.3290, Lng: -4.0122}, {ID: "ado-e", Lat: 5.3300, Lng: -4.0045},
			// The 4th bridge over the baie du Banco, about 1,4 km.
			{ID: "4p-o", Lat: 5.3385, Lng: -4.0590}, {ID: "4p-e", Lat: 5.3372, Lng: -4.0465},
			{ID: "banco", Name: "Autoroute du Nord", Lat: 5.3640, Lng: -4.0520},
			{ID: "corniche", Name: "Boulevard de la Corniche", Lat: 5.3485, Lng: -4.0030},
		},
		Roads: []Road{
			bridge("fhb-n", "fhb-s", "pont Félix-Houphouët-Boigny", game.Verified("Pont de 372 m entre le Plateau et Treichville ; coordonnées de son centre publiées.", srcPontFHB)),
			bridge("cdg-n", "cdg-s", "pont Charles-de-Gaulle", game.Verified("Pont de 1967 entre le Plateau et Treichville ; coordonnées publiées.", srcPontCDG)),
			bridge("hkb-n", "hkb-s", "3e pont", game.Verified("Pont Henri-Konan-Bédié (le « 3e pont »), 1 500 m, entre la Riviera (Cocody) et Marcory ; coordonnées publiées.", srcPontHKB)),
			bridge("ado-o", "ado-e", "5e pont", game.Partial("Pont Alassane-Ouattara (le « 5e pont »), 630 m dont 200 m à haubans, sur la baie de Cocody entre le Plateau et Cocody, ouvert en août 2023 ; position approximative.", srcPontADO, srcPont5)),
			bridge("4p-o", "4p-e", "4e pont", game.Partial("Relie Yopougon au Plateau par Attécoubé en franchissant la baie du Banco ; position approximative.", srcPont4, srcPont4Len)),
			{A: "yopougon", B: "4p-o"}, {A: "4p-e", B: "attecoube"},
			{A: "songon", B: "yopougon", Name: "route de Dabou"},
			{A: "yopougon", B: "banco", Name: "autoroute du Nord"}, {A: "banco", B: "adjame", Name: "autoroute du Nord"},
			{A: "attecoube", B: "adjame"}, {A: "attecoube", B: "plateau"},
			{A: "adjame", B: "plateau"}, {A: "adjame", B: "abobo"}, {A: "abobo", B: "anyama"},
			{A: "adjame", B: "cocody"}, {A: "abobo", B: "cocody", Name: "boulevard Latrille"},
			{A: "plateau", B: "corniche", Name: "boulevard de la Corniche", Via: [][2]float64{{5.3445, -4.0120}}}, {A: "corniche", B: "cocody", Name: "boulevard de la Corniche"},
			{A: "plateau", B: "fhb-n"}, {A: "plateau", B: "cdg-n"}, {A: "plateau", B: "ado-o"},
			{A: "ado-e", B: "cocody"}, {A: "cocody", B: "hkb-n"}, {A: "cocody", B: "bingerville"},
			{A: "fhb-s", B: "treichville"}, {A: "cdg-s", B: "treichville"},
			{A: "treichville", B: "marcory", Name: "boulevard VGE"}, {A: "hkb-s", B: "marcory"},
			{A: "marcory", B: "koumassi", Name: "boulevard VGE"}, {A: "koumassi", B: "port-bouet"},
		},
	},
}

func init() {
	for _, c := range Cities {
		net := Roads[c.ID]
		if net == nil {
			continue
		}
		for _, cm := range c.Communes {
			net.Nodes = append(net.Nodes, RoadNode{ID: cm.ID, Name: cm.Name, Lat: cm.Lat, Lng: cm.Lng})
		}
	}
}

// Winding: roads are longer than the straight lines between their points.
const winding = 1.25

// A Path is the way a trip goes: points as [lng, lat] for the map, its length
// on the road, and the bridges it crosses.
type Path struct {
	Points  [][2]float64 `json:"points"`
	Km      float64      `json:"km"`
	Bridges []string     `json:"bridges,omitempty"`
}

// RouteIn finds the shortest way between two communes of a city on its roads.
// ok is false when the city has no road network (then trips go straight).
func RouteIn(city string, from, to string) (Path, bool) {
	net := Roads[city]
	if net == nil {
		return Path{}, false
	}
	pos := map[string]RoadNode{}
	for _, n := range net.Nodes {
		pos[n.ID] = n
	}
	type edge struct {
		to   string
		road int
		km   float64
		fwd  bool
	}
	adj := map[string][]edge{}
	for i, r := range net.Roads {
		km := roadKm(pos, r)
		adj[r.A] = append(adj[r.A], edge{r.B, i, km, true})
		adj[r.B] = append(adj[r.B], edge{r.A, i, km, false})
	}
	dist := map[string]float64{from: 0}
	prev := map[string]edge{}
	q := &nodeQueue{{from, 0}}
	for q.Len() > 0 {
		cur := heap.Pop(q).(queued)
		if cur.d > dist[cur.id] {
			continue
		}
		if cur.id == to {
			break
		}
		for _, e := range adj[cur.id] {
			nd := cur.d + e.km
			if d, seen := dist[e.to]; !seen || nd < d {
				dist[e.to] = nd
				prev[e.to] = edge{cur.id, e.road, e.km, e.fwd}
				heap.Push(q, queued{e.to, nd})
			}
		}
	}
	if _, ok := dist[to]; !ok {
		return Path{}, false
	}
	// Walk back from the destination, then lay the points out in order.
	var legs []edge
	for at := to; at != from; at = prev[at].to {
		legs = append(legs, prev[at])
	}
	p := Path{Km: math.Round(dist[to]*10) / 10}
	start := pos[from]
	p.Points = append(p.Points, [2]float64{start.Lng, start.Lat})
	for i := len(legs) - 1; i >= 0; i-- {
		r := net.Roads[legs[i].road]
		pts := roadPoints(pos, r)
		if !legs[i].fwd {
			for a, b := 0, len(pts)-1; a < b; a, b = a+1, b-1 {
				pts[a], pts[b] = pts[b], pts[a]
			}
		}
		for _, pt := range pts[1:] {
			p.Points = append(p.Points, [2]float64{pt[1], pt[0]})
		}
		if r.Bridge != "" {
			p.Bridges = append(p.Bridges, r.Bridge)
		}
	}
	return p, true
}

// roadPoints: a road's points as (lat, lng), from A to B.
func roadPoints(pos map[string]RoadNode, r Road) [][2]float64 {
	a, b := pos[r.A], pos[r.B]
	pts := [][2]float64{{a.Lat, a.Lng}}
	pts = append(pts, r.Via...)
	return append(pts, [2]float64{b.Lat, b.Lng})
}

func roadKm(pos map[string]RoadNode, r Road) float64 {
	pts := roadPoints(pos, r)
	km := 0.0
	for i := 1; i < len(pts); i++ {
		km += distanceKm(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1])
	}
	if r.Bridge != "" {
		return km // a bridge is straight
	}
	return km * winding
}

type queued struct {
	id string
	d  float64
}
type nodeQueue []queued

func (q nodeQueue) Len() int           { return len(q) }
func (q nodeQueue) Less(i, j int) bool { return q[i].d < q[j].d }
func (q nodeQueue) Swap(i, j int)      { q[i], q[j] = q[j], q[i] }
func (q *nodeQueue) Push(x any)        { *q = append(*q, x.(queued)) }
func (q *nodeQueue) Pop() any {
	old := *q
	x := old[len(old)-1]
	*q = old[:len(old)-1]
	return x
}
