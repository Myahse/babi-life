package sims

import (
	"context"
	"github.com/myahse/babi-life/backend/internal/game"
	"hash/fnv"
	"math/rand/v2"
	"slices"
	"strings"
	"time"
)

// The game's own Tikitoko creators. At launch few players post, and an
// empty « Pour toi » kills the app: so a few made-up creators of Abidjan
// post every day. Their videos are never stored: each is made up from its
// id (negative, so it can't meet a player's post), always the same for
// everyone, and the app plays it as a small live 3D scene from the seeds
// (screens/TikiScene.tsx). The players' likes, favourites and comments on
// them are kept in tiki_npc_marks and tiki_npc_comments (036_tiki_video.sql).

type tikiCreator struct {
	Handle, FirstName, Gender string
	Fans                      int
	Themes                    []string
}

var tikiCreators = []tikiCreator{
	{"awa.danse225", "Awa", "femme", 52300, []string{"danse", "mode"}},
	{"koffi_le_drole", "Koffi", "homme", 128000, []string{"humour"}},
	{"tantie_bintou_garba", "Bintou", "femme", 31400, []string{"garba"}},
	{"yao_tribune_ci", "Yao", "homme", 18700, []string{"stade", "sport"}},
	{"mariam.style", "Mariam", "femme", 67100, []string{"mode"}},
	{"serge_vlog_babi", "Serge", "homme", 9400, []string{"vlog"}},
	{"adjoua_fit", "Adjoua", "femme", 22800, []string{"sport"}},
	{"ibrahim_zoo_abj", "Ibrahim", "homme", 4100, []string{"zoo", "vlog"}},
	{"grace.decale", "Grâce", "femme", 210000, []string{"danse"}},
	{"junior_sketch07", "Junior", "homme", 45600, []string{"humour", "vlog"}},
	{"salimata_cuisine", "Salimata", "femme", 12900, []string{"garba"}},
	{"didier_supporter", "Didier", "homme", 7800, []string{"stade"}},
	{"akissi_look", "Akissi", "femme", 3300, []string{"mode", "vlog"}},
	{"lassina_foot", "Lassina", "homme", 15200, []string{"sport", "stade"}},
	{"nadege_ambiance", "Nadège", "femme", 88000, []string{"danse", "humour"}},
	{"konan_yop", "Konan", "homme", 2600, []string{"vlog", "garba", "zoo"}},
}

var tikiNPCCaptions = map[string][]string{
	"danse":  {"Nouveau pas, qui fait mieux ? 💃", "Le coupé-décalé ne meurt jamais 🔥", "Apprenez ce pas avec moi, c'est facile !", "Ma petite sœur m'a battue au challenge 😂", "On a dansé jusqu'au matin à Yop"},
	"garba":  {"Le meilleur garba de Treichville, je vous dis 🤤", "Attiéké, thon frit, piment : la base", "Alloco du soir, bonheur du soir", "Je teste le garba à 500 F, verdict ?", "Le kédjénou de maman, rien ne bat ça"},
	"stade":  {"L'ambiance au stade, c'est autre chose 🐘", "Tribune en feu ce soir !", "Allez les Éléphants !! 🇨🇮", "Le but de la dernière minute 😭🔥", "Supporter un jour, supporter toujours"},
	"vlog":   {"Une journée à Cocody avec moi", "Le Plateau au lever du soleil ☀️", "Je vous fais visiter mon quartier", "Woro-woro, embouteillage, et on rigole quand même", "Petit tour au marché d'Adjamé"},
	"zoo":    {"L'éléphant m'a regardé dans les yeux 🐘", "Sortie au zoo avec les petits", "Le lion fait la sieste, comme moi le dimanche", "Vous saviez que l'hippo court vite ?"},
	"humour": {"Quand maman dit « on a du riz à la maison » 😂", "Le gbaka qui démarre avant que tu montes", "Moi quand le prof dit « interro surprise »", "POV : tu demandes le prix au marché", "Les gars du quartier quand il y a match"},
	"mode":   {"Mon look du jour en wax 🔥", "Bazin pour le mariage de ma cousine", "Trois façons de porter le pagne", "Le couturier du quartier est un génie", "Ensemble assorti avec mon frère"},
	"sport":  {"Footing sur la corniche à 6 h 💪", "Séance du jour : on lâche rien", "Foot de quartier, on a gagné 3-1", "Abdos en 5 minutes, essayez !", "Basket au terrain de Marcory"},
}

var tikiNPCPlaces = map[string][]string{
	"danse":  {"Maquis Le Kpata", "Boîte de Yopougon", "Rue Princesse"},
	"garba":  {"Maquis de Treichville", "Marché d'Adjamé", "Cour de maman"},
	"stade":  {"Stade de Babi", "Tribune populaire"},
	"vlog":   {"Cocody", "Le Plateau", "Marcory", "Adjamé"},
	"zoo":    {"Zoo d'Abidjan"},
	"humour": {"Dans la cour", "Au quartier", "Dans le gbaka"},
	"mode":   {"Atelier du couturier", "Boutique de Cocody", "Devant la maison"},
	"sport":  {"Corniche", "Terrain de Marcory", "Salle de sport"},
}

const (
	tikiNPCPerDay = 10 // the game's creators' posts a day
	tikiNPCDays   = 4  // how far back the feed goes for them
)

// TikiNPC: the seeds the app plays a game creator's video from (the creator's
// look, the scene's own randomness).
type TikiNPC struct {
	Look  uint32 `json:"look"`
	Scene uint32 `json:"scene"`
}

func npcCreator(handle string) (int, bool) {
	i := slices.IndexFunc(tikiCreators, func(c tikiCreator) bool { return c.Handle == handle })
	return i, i >= 0
}

// npcLookSeed: a creator looks the same in every video.
func npcLookSeed(c tikiCreator) uint32 {
	f := fnv.New32a()
	_, _ = f.Write([]byte(c.Handle))
	return f.Sum32()
}

func npcAuthorID(c tikiCreator) string { return "npc-" + c.Handle }

// npcID: the id of the post slot of a day (days since 1970, UTC), always < 0.
func npcID(day int64, slot int) int64 { return -(day*100 + int64(slot) + 1) }

// npcPost: the game's post with that id, as it is at now (views growing like
// a player's post); false when there's none (yet).
func npcPost(id int64, now time.Time) (TikiPost, bool) {
	if id >= 0 {
		return TikiPost{}, false
	}
	n := -id - 1
	day, slot := n/100, int(n%100)
	if slot >= tikiNPCPerDay {
		return TikiPost{}, false
	}
	rng := rand.New(rand.NewPCG(uint64(-id), 0x7177))
	at := time.Unix(day*86400, 0).UTC().Add(time.Duration(6*60+slot*100+rng.IntN(60)) * time.Minute)
	if at.After(now) || now.Sub(at) > (tikiNPCDays+1)*24*time.Hour {
		return TikiPost{}, false
	}
	c := tikiCreators[rng.IntN(len(tikiCreators))]
	theme := c.Themes[rng.IntN(len(c.Themes))]
	caps, places := tikiNPCCaptions[theme], tikiNPCPlaces[theme]
	views := 300 + int(float64(c.Fans)*(0.3+rng.Float64()*1.2))
	if rng.IntN(12) == 0 {
		views *= 5
	}
	likes := int(float64(views) * (0.07 + rng.Float64()*0.06))
	p := TikiPost{
		ID:         id,
		Author:     StoryAuthor{ID: npcAuthorID(c), FirstName: c.FirstName, Gender: c.Gender},
		Handle:     c.Handle,
		Fans:       c.Fans,
		Tier:       tikiTier(c.Fans),
		Caption:    caps[rng.IntN(len(caps))],
		Theme:      theme,
		Place:      places[rng.IntN(len(places))],
		Sound:      tikiSounds[1+rng.IntN(len(tikiSounds)-1)],
		DurationMs: 8000 + rng.IntN(5)*1000,
		NPC:        &TikiNPC{Look: npcLookSeed(c), Scene: rng.Uint32()},
		At:         at,
	}
	// A caption that names a place is tagged there (« Le Plateau au lever du soleil » isn't in Cocody).
	if named := namedPlace(p.Caption, places); named != "" {
		p.Place = named
	}
	p.Views, p.Likes = grown(views, at, now), grown(likes, at, now)
	p.Comments = npcComments(p.Views)
	p.Saves, p.Shares = p.Likes/25, p.Likes/40
	return p, true
}

// npcPosts: the game's posts of the last days, newest first; handle: one
// creator's only ("" for all).
func npcPosts(now time.Time, handle string) []TikiPost {
	out := []TikiPost{}
	today := now.Unix() / 86400
	for d := today; d > today-tikiNPCDays; d-- {
		for s := tikiNPCPerDay - 1; s >= 0; s-- {
			if p, ok := npcPost(npcID(d, s), now); ok && (handle == "" || p.Handle == handle) {
				out = append(out, p)
			}
		}
	}
	return out
}

// npcRank: « Pour toi » for the game's posts too: liked and fresh first.
func npcRank(ps []TikiPost, now time.Time) {
	score := func(p TikiPost) float64 {
		h := now.Sub(p.At).Hours() + 2
		return float64(p.Likes+1) / (h * h)
	}
	slices.SortStableFunc(ps, func(a, b TikiPost) int {
		sa, sb := score(a), score(b)
		switch {
		case sa > sb:
			return -1
		case sa < sb:
			return 1
		}
		return 0
	})
}

// interleave: the players' posts first and boosted (the first two, then one
// in two), the game's filling the gaps and the end, so the feed is never empty.
func interleave(real, npc []TikiPost) []TikiPost {
	out := make([]TikiPost, 0, len(real)+len(npc))
	i, j := 0, 0
	for i < len(real) || j < len(npc) {
		takeReal := i < len(real) && (j >= len(npc) || len(out) < 2 || len(out)%2 == 1)
		if takeReal {
			out = append(out, real[i])
			i++
		} else {
			out = append(out, npc[j])
			j++
		}
	}
	return out
}

// npcStats adds the players' likes, favourites and comments on the game's
// posts (and whether this player liked or saved them).
func (h *Handler) npcStats(ctx context.Context, me string, ps []TikiPost) {
	if len(ps) == 0 {
		return
	}
	ids := make([]int64, len(ps))
	at := map[int64]int{}
	for i, p := range ps {
		ids[i], at[p.ID] = p.ID, i
	}
	rows, err := h.DB.Query(ctx, `SELECT post, kind, count(*), bool_or(sim = $2) FROM tiki_npc_marks WHERE post = ANY($1) GROUP BY post, kind`, ids, me)
	if err == nil {
		for rows.Next() {
			var id int64
			var kind string
			var n int
			var mine bool
			if rows.Scan(&id, &kind, &n, &mine) != nil {
				continue
			}
			p := &ps[at[id]]
			if kind == "like" {
				p.Likes, p.Liked = p.Likes+n, mine
			} else {
				p.Saves, p.Saved = p.Saves+n, mine
			}
		}
		rows.Close()
	}
	rows, err = h.DB.Query(ctx, `SELECT post, count(*) FROM tiki_npc_comments WHERE post = ANY($1) GROUP BY post`, ids)
	if err == nil {
		for rows.Next() {
			var id int64
			var n int
			if rows.Scan(&id, &n) == nil {
				ps[at[id]].Comments += n
			}
		}
		rows.Close()
	}
}

// npcSaved: the game's posts this player saved (a creator's or a friend's), the latest first.
func (h *Handler) npcSaved(ctx context.Context, me string, now time.Time) []TikiPost {
	out := []TikiPost{}
	rows, err := h.DB.Query(ctx, `SELECT post FROM tiki_npc_marks WHERE sim = $1 AND kind = 'save' ORDER BY created_at DESC LIMIT 60`, me)
	if err != nil {
		return out
	}
	var ids []int64
	for rows.Next() {
		var id int64
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	var friends []game.Friend
	read := false
	for _, id := range ids {
		if p, ok := npcPost(id, now); ok {
			out = append(out, p)
			continue
		}
		if !read {
			friends, read = h.simFriends(ctx, me), true
		}
		if p, ok := findFriendPost(me, friends, id, now); ok {
			out = append(out, p)
		}
	}
	return out
}

// npcProfile: a game creator's page.
func npcProfile(handle string, now time.Time) (TikiProfile, bool) {
	i, ok := npcCreator(strings.TrimPrefix(handle, "npc-"))
	if !ok {
		return TikiProfile{}, false
	}
	c := tikiCreators[i]
	posts := npcPosts(now, c.Handle)
	likes := c.Fans * 3
	for _, p := range posts {
		likes += p.Likes
	}
	return TikiProfile{
		Author:    StoryAuthor{ID: npcAuthorID(c), FirstName: c.FirstName, Gender: c.Gender},
		Handle:    c.Handle,
		Tier:      tikiTier(c.Fans),
		Following: 40 + c.Fans%300,
		Fans:      c.Fans,
		Likes:     likes,
		Posts:     len(posts) + c.Fans/2000,
		NPC:       &TikiNPC{Look: npcLookSeed(c)},
	}, true
}

// namedPlace: the place of the list a caption names (by one of its longer words), or "".
func namedPlace(caption string, places []string) string {
	low := strings.ToLower(caption)
	for _, pl := range places {
		for _, w := range strings.Fields(strings.ToLower(pl)) {
			if len([]rune(w)) >= 5 && strings.Contains(low, w) {
				return pl
			}
		}
	}
	return ""
}
