package sims

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"math/rand/v2"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Babigram, the photo app of the Store, built like the well-known photo
// sharing apps: a home feed of square or portrait photos, stories on top,
// Explorer, profiles with their grid, comments, saves, an activity tab.
// Posting is instant (a photo, not a half-hour video like Tikitoko) but
// capped a day. Like Tikitoko, the game brings an audience (likes and
// followers that come over six hours, more at a photogenic place), and the
// game's own accounts post too, so the feed is never empty even with a few
// players: their photos aren't files, the app paints them from a scene and a
// seed. Safety as elsewhere: the pictures come from the game, captions and
// comments are cleaned like messages, a report blocks the author and goes to
// the moderators.

const (
	GramPerDay          = 6  // photos a real day, at most
	GramCommentsPerHour = 30 // comments a real hour, at most
	gramNPCPerReach     = 220
	gramNPCMaxComments  = 30
	gramBackfillDays    = 7  // the game's accounts' posts made at once, at launch
	gramKeepNPCDays     = 21 // then they go
	gramFeedSize        = 60
)

var (
	errGramTooMany   = errors.New("6 photos aujourd'hui, c'est déjà beaucoup : reviens demain")
	errGramNoPost    = errors.New("publication introuvable")
	errGramComment   = errors.New("écris ton commentaire (150 caractères au plus)")
	errGramChatty    = errors.New("beaucoup de commentaires d'un coup : souffle un peu")
	errGramNoAccount = errors.New("compte introuvable")
)

// The places where a photo does better: the beach, the lagoon, the zoo, the
// stadium, a good maquis… (world place kinds).
var gramPhotogenic = []string{"beach", "nature", "lagune", "zoo", "culture", "hotel", "mall", game.StadiumKind, "club", "restaurant", "maquis", "market"}

// gramAudience: what a player's photo brings from the game's audience: how
// many saw it, the likes, the new followers. More with followers already, at
// a photogenic place, with a filter and a caption, for an artist; one photo in
// fifteen is picked up by Explorer.
func gramAudience(fans int, placeKind string, filtered, captioned bool, traits []string, rng *rand.Rand) (reach, likes, newFans int) {
	fit := 1.0
	if slices.Contains(gramPhotogenic, placeKind) {
		fit = 1.5
	}
	if filtered {
		fit *= 1.1
	}
	if captioned {
		fit *= 1.1
	}
	if slices.Contains(traits, "artiste") {
		fit *= 1.25
	}
	luck := 0.6 + rng.Float64()*0.8
	if rng.IntN(15) == 0 {
		luck *= 4
	}
	reach = int((30 + float64(fans)*1.2) * fit * luck)
	likes = int(float64(reach) * (0.08 + rng.Float64()*0.07))
	// The first photos bring the friends and the quarter; then fewer per view as the account grows.
	newFans = max(1, int(math.Round(float64(reach)*0.03*fit/(1+float64(fans)/30000))))
	return reach, likes, newFans
}

// gramScore ranks a post on the home feed: its engagement, compressed (a
// photo with a thousand likes shouldn't bury a friend's with ten), over its
// age in hours: the fresh first.
func gramScore(likes, comments int, ageHours float64) float64 {
	return (1 + math.Log1p(float64(likes+3*comments))) / math.Pow(max(0, ageHours)+2, 1.2)
}

// gramExploreScore ranks Explorer: the popular first, staying there longer.
func gramExploreScore(likes, comments int, ageHours float64) float64 {
	return math.Pow(float64(likes+3*comments+1), 0.6) / math.Pow(max(0, ageHours)+2, 0.8)
}

// gramHomeScore: on the home feed, the accounts one follows weigh more, and
// one's own photo stays on top for its first hour.
func gramHomeScore(likes, comments int, ageHours float64, followed, mine bool) float64 {
	s := gramScore(likes, comments, ageHours)
	if followed {
		s *= 3
	}
	if mine && ageHours < 1 {
		s *= 40
	}
	return s
}

/* ---------- The game's accounts ---------- */

type gramNPC struct {
	ID, Name, Gender, Bio string
	Fans, Following       int
	Every                 int // hours between two posts
	Scenes                []string
}

// The game's accounts: invented people of Abidjan, each with what they post.
var gramNPCs = []gramNPC{
	{"awa.lagune", "Awa", "femme", "Photographe amateur · Cocody 📸", 18400, 312, 26, []string{"lagune", "coucher", "plage"}},
	{"koffi_style225", "Koffi", "homme", "Mode & wax · Treichville 🧵", 42100, 540, 22, []string{"studio", "rue"}},
	{"mariam.cuisine", "Mariam", "femme", "Garba, alloco & co 🍽️", 9300, 205, 30, []string{"maquis", "marche"}},
	{"yao.sport", "Yao", "homme", "Foot, course, sueur ⚽", 12700, 388, 34, []string{"stade", "rue"}},
	{"adjoua.voyage", "Adjoua", "femme", "De Bassam à Man 🌍", 27800, 610, 28, []string{"plage", "jardin", "coucher"}},
	{"serge_nuit", "Serge", "homme", "Babi by night 🌙", 6100, 150, 32, []string{"nuit", "maquis"}},
	{"grace.fleurs", "Grâce", "femme", "Jardins & couleurs 🌺", 3400, 98, 38, []string{"jardin", "studio"}},
	{"ibrahim.abj", "Ibrahim", "homme", "Le Plateau vu d'en haut 🏙️", 15200, 270, 30, []string{"rue", "lagune", "nuit"}},
	{"salimata.beaute", "Salimata", "femme", "Tresses, maquillage, confiance ✨", 56300, 720, 24, []string{"studio", "coucher"}},
	{"didier_maquis", "Didier", "homme", "Le meilleur poulet braisé de Yop' 🍗", 4800, 133, 36, []string{"maquis", "nuit", "marche"}},
}

func findGramNPC(id string) (gramNPC, bool) {
	for _, n := range gramNPCs {
		if n.ID == id {
			return n, true
		}
	}
	return gramNPC{}, false
}

type gramScene struct{ Places, Captions []string }

// What each scene the app paints is called, and what's written under it.
var gramScenes = map[string]gramScene{
	"plage":   {[]string{"Plage de Grand-Bassam", "Assinie", "Plage de Port-Bouët", "Jacqueville"}, []string{"Le sable, le soleil, et rien d'autre ☀️", "Bassam ne déçoit jamais 🌊", "Week-end au bord de l'eau", "On a dit repos, c'est repos 😌", "La mer est calme aujourd'hui"}},
	"lagune":  {[]string{"Lagune Ébrié", "Pont HKB", "Baie de Cocody", "Le Plateau"}, []string{"Babi vue de l'eau 💙", "La lagune au petit matin", "Ce pont-là, toute une histoire", "Le calme avant la journée"}},
	"coucher": {[]string{"Corniche de Cocody", "Riviera", "Bingerville", "Marcory"}, []string{"Golden hour à Babi 🧡", "Le ciel a fait le show ce soir", "Pas de filtre… enfin presque 😅", "Fin de journée, cœur léger"}},
	"maquis":  {[]string{"Maquis à Yopougon", "Allocodrome de Cocody", "Rue Princesse", "Maquis à Treichville"}, []string{"Poulet braisé + attiéké = bonheur 🍗", "Le garba du jour 🤤", "Alloco bien doré, on dit merci", "On mange d'abord, on parle après", "Le patron a encore assuré"}},
	"marche":  {[]string{"Marché de Treichville", "Marché d'Adjamé", "Marché de Cocody", "Marché de Koumassi"}, []string{"Les couleurs du marché 🍅🌶️", "Tantie m'a fait un bon prix 😄", "Ananas, mangues, papayes… le paradis", "Samedi = marché"}},
	"rue":     {[]string{"Le Plateau", "Cocody Angré", "Deux-Plateaux", "Abobo", "Adjamé"}, []string{"Les rues de Babi ont du style", "Balade du dimanche 🚶🏾", "Le quartier se réveille", "Gbaka, woro-woro, et nous 🚐"}},
	"nuit":    {[]string{"Zone 4", "Le Plateau la nuit", "Rue Princesse", "Marcory"}, []string{"Babi by night 🌙✨", "Les lumières de la ville", "La nuit est jeune", "Ambiance garantie ce soir 🎶"}},
	"stade":   {[]string{"Stade Félix-Houphouët-Boigny", "Stade Alassane-Ouattara d'Ebimpé", "Terrain du quartier"}, []string{"Allez les Éléphants 🐘🇨🇮", "Match du dimanche avec les gars ⚽", "L'ambiance au stade, rien à dire", "Séance du matin, on lâche rien 💪"}},
	"studio":  {[]string{"Treichville", "Cocody", "Marcory Zone 4", "Adjamé"}, []string{"Nouveau wax, nouveau moi ✨", "Le look du jour", "Tresses fraîches, confiance au max", "Le couturier du quartier est un génie", "Sapé comme jamais 😎"}},
	"jardin":  {[]string{"Jardin botanique de Bingerville", "Parc national du Banco", "Cocody", "Riviera"}, []string{"Un peu de vert pour respirer 🌿", "Les fleurs du jardin de tantie 🌺", "Le Banco, c'est la forêt en pleine ville", "Pause nature"}},
}

func hash64(parts ...string) uint64 {
	f := fnv.New64a()
	for _, p := range parts {
		_, _ = f.Write([]byte(p))
		_, _ = f.Write([]byte{0})
	}
	return f.Sum64()
}

// gramNPCPost is one of the game's accounts' photos, before it's written.
type gramNPCPost struct {
	Key, NPC, Scene, Caption, Place string
	Seed                            int64
	Reach, Likes                    int
	At                              time.Time
}

// gramNPCSlots: an account's photos over the last days, from the time alone
// (one every Every hours, at a time of its own), always the same for an
// account and a slot: every server writes the same ones, and the key keeps
// them once. None in the future.
func gramNPCSlots(n gramNPC, now time.Time, days int) []gramNPCPost {
	every := int64(max(1, n.Every))
	off := int64(hash64(n.ID) % uint64(every))
	hour := now.Unix() / 3600
	last := (hour - off) / every
	var out []gramNPCPost
	for k := last - int64(days)*24/every; k <= last; k++ {
		rng := rand.New(rand.NewPCG(hash64(n.ID), uint64(k)))
		at := time.Unix((k*every+off)*3600+int64(rng.IntN(3600*int(min(every, 6)))), 0)
		if at.After(now) {
			continue
		}
		scene := n.Scenes[rng.IntN(len(n.Scenes))]
		sc := gramScenes[scene]
		reach := int(float64(n.Fans) * (0.25 + rng.Float64()*0.35))
		out = append(out, gramNPCPost{
			Key: fmt.Sprintf("npc:%s:%d", n.ID, k), NPC: n.ID, Scene: scene,
			Caption: sc.Captions[rng.IntN(len(sc.Captions))], Place: sc.Places[rng.IntN(len(sc.Places))],
			Seed: int64(rng.Uint32()), Reach: reach, Likes: int(float64(reach) * (0.12 + rng.Float64()*0.1)), At: at,
		})
	}
	return out
}

var gramSeed struct {
	sync.Mutex
	at time.Time
}

// seedGram writes the game's accounts' photos due by now (at most every ten
// minutes per server) and clears the old ones.
func (h *Handler) seedGram(ctx context.Context) {
	gramSeed.Lock()
	if time.Since(gramSeed.at) < 10*time.Minute {
		gramSeed.Unlock()
		return
	}
	gramSeed.at = time.Now()
	gramSeed.Unlock()
	var (
		keys, npcs, scenes, captions, places []string
		seeds                                []int64
		reach, likes                         []int32
		ats                                  []time.Time
	)
	now := time.Now()
	for _, n := range gramNPCs {
		for _, p := range gramNPCSlots(n, now, gramBackfillDays) {
			keys, npcs, scenes, captions, places = append(keys, p.Key), append(npcs, p.NPC), append(scenes, p.Scene), append(captions, p.Caption), append(places, p.Place)
			seeds, reach, likes, ats = append(seeds, p.Seed), append(reach, int32(p.Reach)), append(likes, int32(p.Likes)), append(ats, p.At)
		}
	}
	_, err := h.DB.Exec(ctx, `INSERT INTO gram_posts (key, npc, scene, caption, place, seed, reach, likes, created_at, ratio)
		SELECT k, n, s, c, pl, sd, r, l, a, CASE WHEN sd % 3 = 0 THEN 'portrait' ELSE 'carre' END
		FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::bigint[], $7::int[], $8::int[], $9::timestamptz[]) AS t(k, n, s, c, pl, sd, r, l, a)
		ON CONFLICT (key) DO NOTHING`, keys, npcs, scenes, captions, places, seeds, reach, likes, ats)
	if err != nil {
		// Try again on the next request.
		gramSeed.Lock()
		gramSeed.at = time.Time{}
		gramSeed.Unlock()
		return
	}
	_, _ = h.DB.Exec(ctx, `DELETE FROM gram_posts WHERE npc <> '' AND created_at < now() - make_interval(days => $1)`, gramKeepNPCDays)
}

/* ---------- Posts ---------- */

// GramAccount: a player (Author set) or one of the game's accounts (NPC).
type GramAccount struct {
	ID     string       `json:"id"` // a Sim's id, or "npc:<id>"
	Author *StoryAuthor `json:"author,omitempty"`
	NPC    bool         `json:"npc,omitempty"`
	Name   string       `json:"name"`
	Gender string       `json:"gender"`
	Handle string       `json:"handle"`
}

func npcAccount(n gramNPC) GramAccount {
	return GramAccount{ID: "npc:" + n.ID, NPC: true, Name: n.Name, Gender: n.Gender, Handle: n.ID}
}

func playerAccount(a StoryAuthor, username string) GramAccount {
	return GramAccount{ID: a.ID, Author: &a, Name: a.FirstName, Gender: a.Gender, Handle: tikiHandle(username, a.FirstName)}
}

// GramPost is a photo in a feed. Photo: the API path of a player's photo;
// the game's accounts' have Scene and Seed instead (the app paints them).
type GramPost struct {
	ID       int64       `json:"id"`
	Account  GramAccount `json:"account"`
	Followed bool        `json:"followed"`
	Mine     bool        `json:"mine"`
	Photo    string      `json:"photo,omitempty"`
	Scene    string      `json:"scene,omitempty"`
	Seed     int64       `json:"seed,omitempty"`
	Ratio    string      `json:"ratio"`
	Filter   string      `json:"filter,omitempty"`
	Caption  string      `json:"caption"`
	Place    string      `json:"place"`
	Likes    int         `json:"likes"`
	Liked    bool        `json:"liked"`
	LikedBy  string      `json:"likedBy,omitempty"` // « Aimé par … et N autres »
	Comments int         `json:"comments"`
	Saved    bool        `json:"saved"`
	Shares   int         `json:"shares"`
	At       time.Time   `json:"at"`
	reach    int
}

// The posts one may see: the game's, and the players' who haven't blocked one (nor been blocked).
const gramSelect = `
	SELECT p.id, p.sim, p.npc, COALESCE(o.first_name, ''), COALESCE(o.gender, 'femme'), COALESCE(o.look, '{}'::jsonb), COALESCE(u.username, ''),
		CASE WHEN p.sim IS NULL THEN EXISTS(SELECT 1 FROM gram_npc_follows f WHERE f.follower = $1 AND f.npc = p.npc)
			ELSE EXISTS(SELECT 1 FROM gram_follows f WHERE f.follower = $1 AND f.followed = p.sim) END,
		p.ratio, p.filter, p.caption, p.place, p.scene, p.seed, p.reach, p.likes,
		(SELECT count(*) FROM gram_likes l WHERE l.post = p.id),
		EXISTS(SELECT 1 FROM gram_likes l WHERE l.post = p.id AND l.sim = $1),
		(SELECT count(*) FROM gram_comments c WHERE c.post = p.id),
		EXISTS(SELECT 1 FROM gram_saves v WHERE v.post = p.id AND v.sim = $1),
		p.shares, p.created_at
	FROM gram_posts p LEFT JOIN sims o ON o.id = p.sim LEFT JOIN users u ON u.id = o.user_id
	WHERE (p.sim IS NULL OR NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $1 AND k.blocked = p.sim) OR (k.sim = p.sim AND k.blocked = $1)))`

func (h *Handler) gramPosts(ctx context.Context, me, sql string, args ...any) ([]GramPost, error) {
	rows, err := h.DB.Query(ctx, gramSelect+sql, append([]any{me}, args...)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	now := time.Now()
	out := []GramPost{}
	// Posts by people met in the game (gramfriends.go): their account read after.
	met := map[int]string{}
	for rows.Next() {
		var (
			p                         GramPost
			sim                       *string
			npc, username             string
			a                         StoryAuthor
			audLikes, players, people int
		)
		if err := rows.Scan(&p.ID, &sim, &npc, &a.FirstName, &a.Gender, &a.Look, &username, &p.Followed,
			&p.Ratio, &p.Filter, &p.Caption, &p.Place, &p.Scene, &p.Seed, &p.reach, &audLikes, &players, &p.Liked, &people, &p.Saved, &p.Shares, &p.At); err != nil {
			return nil, err
		}
		if sim != nil {
			a.ID = *sim
			p.Account, p.Mine = playerAccount(a, username), a.ID == me
			p.Photo = fmt.Sprintf("/sims/%s/gram/%d/photo", me, p.ID)
		} else if n, ok := findGramNPC(npc); ok {
			p.Account = npcAccount(n)
		} else {
			met[len(out)] = npc
		}
		p.Likes = grown(audLikes, p.At, now) + players
		p.Comments = people + gramNPCComments(grown(p.reach, p.At, now))
		p.Shares += p.Likes / 60
		if p.Likes > 1 {
			p.LikedBy = gramNPCHandle(rand.New(rand.NewPCG(uint64(p.ID), 0x6a)))
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil || len(met) == 0 {
		return out, err
	}
	rows.Close()
	ids := []string{}
	for _, id := range met {
		ids = append(ids, id)
	}
	found := h.gramPeople(ctx, ids)
	kept := out[:0]
	for i, p := range out {
		if id, ok := met[i]; ok {
			person, ok := found[id]
			if !ok {
				continue // an account the game no longer has
			}
			p.Account = person.account()
		}
		kept = append(kept, p)
	}
	return kept, nil
}

// gramFeed: ?tab=accueil (everyone's photos, ranked, the followed first),
// explorer (the popular ones, not one's own), auteur&author= (one account's,
// newest first), enregistres (the ones one saved).
func (h *Handler) gramFeed(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	h.seedGram(ctx)
	h.seedGramFriends(ctx, me)
	q := r.URL.Query()
	var posts []GramPost
	switch tab := q.Get("tab"); tab {
	case "auteur":
		posts, err = h.gramPosts(ctx, me, ` AND (p.sim::text = $2 OR 'npc:' || p.npc = $2) ORDER BY p.created_at DESC LIMIT 90`, q.Get("author"))
	case "enregistres":
		posts, err = h.gramPosts(ctx, me, ` AND EXISTS(SELECT 1 FROM gram_saves v WHERE v.post = p.id AND v.sim = $1) ORDER BY p.created_at DESC LIMIT 90`)
	default:
		explore := tab == "explorer"
		extra := ``
		if explore {
			extra = ` AND p.sim IS DISTINCT FROM $1::uuid`
		}
		posts, err = h.gramPosts(ctx, me, extra+` AND p.created_at > now() - interval '30 days' ORDER BY p.created_at DESC LIMIT 300`)
		if err == nil {
			now := time.Now()
			score := func(p GramPost) float64 {
				age := now.Sub(p.At).Hours()
				if explore {
					return gramExploreScore(p.Likes, p.Comments, age)
				}
				return gramHomeScore(p.Likes, p.Comments, age, p.Followed, p.Mine)
			}
			slices.SortStableFunc(posts, func(a, b GramPost) int {
				sa, sb := score(a), score(b)
				switch {
				case sa > sb:
					return -1
				case sa < sb:
					return 1
				}
				return 0
			})
			posts = posts[:min(len(posts), gramFeedSize)]
		}
	}
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, posts)
}

// gramPost: a photo of the game (or of the gallery), filtered by the app,
// with a caption and where it was taken. Instant, a few a day.
func (h *Handler) gramPost(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Photo   string `json:"photo"`
		PhotoID int64  `json:"photoId"` // a photo of the gallery (photos.go), instead of Photo
		Caption string `json:"caption"`
		PlaceID string `json:"placeId"`
		Filter  string `json:"filter"`
		Ratio   string `json:"ratio"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	var (
		raw  []byte
		mime string
		err  error
	)
	if req.PhotoID > 0 {
		var sim string
		if sim, err = h.phoneSim(r); err == nil {
			raw, mime, err = h.photoBytes(r.Context(), sim, req.PhotoID)
		}
		if err != nil {
			h.photoFail(w, err)
			return
		}
	} else if raw, mime, err = decodePhoto(req.Photo); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	caption, err := cleanCaption(req.Caption)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.Ratio != "portrait" {
		req.Ratio = "carre"
	}
	filter := strings.TrimSpace(req.Filter)
	if len([]rune(filter)) > 20 {
		filter = ""
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := needApp(s, "babigram"); err != nil {
			return game.Outcome{}, nil, err
		}
		var today, fans int
		if err := tx.QueryRow(ctx, `SELECT (SELECT count(*) FROM gram_posts WHERE sim = $1 AND created_at > now() - interval '24 hours'), gram_fans FROM sims WHERE id = $1`, s.ID).Scan(&today, &fans); err != nil {
			return game.Outcome{}, nil, err
		}
		if today >= GramPerDay {
			return game.Outcome{}, nil, errGramTooMany
		}
		// Where it's taken: a place of the Sim's commune (the app sends the nearest).
		kind, place := "", ""
		if city, cm, p, ok := world.FindPlace(req.PlaceID); ok && city.ID == s.City && cm.ID == s.Commune {
			kind, place = p.Kind, p.Name
		} else if req.PlaceID == "home" {
			place = "Chez moi"
		}
		reach, likes, newFans := gramAudience(fans, kind, filter != "", caption != "", s.Traits, tikiRand(s.ID, "gram", caption))
		if _, err := tx.Exec(ctx, `INSERT INTO gram_posts (sim, image, mime, ratio, filter, caption, place, reach, likes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			s.ID, raw, mime, req.Ratio, filter, caption, place, reach, likes); err != nil {
			return game.Outcome{}, nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE sims SET gram_fans = gram_fans + $2 WHERE id = $1`, s.ID, newFans); err != nil {
			return game.Outcome{}, nil, err
		}
		s.Needs = s.Needs.Add(game.Needs{Social: 4, Fun: 3})
		text := fmt.Sprintf("Photo publiée sur Babigram. Environ %s j'aime vont arriver, +%d abonnés.", compact(likes), newFans)
		return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
	})
}

func gramPostID(r *http.Request) int64 {
	id, _ := strconv.ParseInt(chi.URLParam(r, "post"), 10, 64)
	return id
}

// gramVisible: the post, if this Sim may see it: its author ("" for the game's), scene, reach and date.
func (h *Handler) gramVisible(ctx context.Context, id int64, me string) (owner, scene string, reach int, at time.Time, err error) {
	var sim *string
	err = h.DB.QueryRow(ctx, `SELECT p.sim, p.scene, p.reach, p.created_at FROM gram_posts p WHERE p.id = $1
		AND (p.sim IS NULL OR NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $2 AND k.blocked = p.sim) OR (k.sim = p.sim AND k.blocked = $2)))`, id, me).Scan(&sim, &scene, &reach, &at)
	if err != nil {
		return "", "", 0, at, errGramNoPost
	}
	if sim != nil {
		owner = *sim
	}
	return owner, scene, reach, at, nil
}

func (h *Handler) gramPhoto(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	var raw []byte
	var mime string
	err = h.DB.QueryRow(r.Context(), `SELECT p.image, p.mime FROM gram_posts p WHERE p.id = $1 AND p.image IS NOT NULL
		AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $2 AND k.blocked = p.sim) OR (k.sim = p.sim AND k.blocked = $2))`, gramPostID(r), me).Scan(&raw, &mime)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, errGramNoPost.Error())
		return
	}
	servePhoto(w, raw, mime)
}

// gramToggle: a like or a save, on or off (one's own photos can be saved, not liked).
func (h *Handler) gramToggle(table string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			On bool `json:"on"`
		}
		if err := httpx.Decode(r, &req); err != nil {
			httpx.Error(w, http.StatusBadRequest, "requête invalide")
			return
		}
		me, err := h.appSim(r, "babigram")
		if err != nil {
			h.gbairaiFail(w, err)
			return
		}
		ctx := r.Context()
		id := gramPostID(r)
		owner, _, _, _, err := h.gramVisible(ctx, id, me)
		if err != nil {
			httpx.Error(w, http.StatusNotFound, err.Error())
			return
		}
		switch {
		case req.On && table == "gram_likes" && owner == me:
		case req.On:
			_, err = h.DB.Exec(ctx, `INSERT INTO `+table+` (post, sim) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, me)
		default:
			_, err = h.DB.Exec(ctx, `DELETE FROM `+table+` WHERE post = $1 AND sim = $2`, id, me)
		}
		if err != nil {
			h.gbairaiFail(w, err)
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]bool{"on": req.On})
	}
}

// gramShare counts a share (the app sends the photo's link in Gbairai).
func (h *Handler) gramShare(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	id := gramPostID(r)
	if _, _, _, _, err := h.gramVisible(r.Context(), id, me); err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	_, _ = h.DB.Exec(r.Context(), `UPDATE gram_posts SET shares = shares + 1 WHERE id = $1`, id)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) gramDelete(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	if _, err := h.DB.Exec(r.Context(), `DELETE FROM gram_posts WHERE id = $1 AND sim = $2`, gramPostID(r), me); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// gramReport: flag a player's photo; its author is blocked for the reporter.
func (h *Handler) gramReport(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Reason string `json:"reason"`
	}
	if err := httpx.Decode(r, &req); err != nil || !validReason(req.Reason) {
		h.gbairaiFail(w, errNoReason)
		return
	}
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	id := gramPostID(r)
	var owner, caption string
	if err := h.DB.QueryRow(ctx, `SELECT sim, caption FROM gram_posts WHERE id = $1 AND sim IS NOT NULL`, id).Scan(&owner, &caption); err != nil || owner == me {
		httpx.Error(w, http.StatusNotFound, errGramNoPost.Error())
		return
	}
	if _, err := h.DB.Exec(ctx, `INSERT INTO reports (reporter, reported, gram_post_id, excerpt, reason) VALUES ($1, $2, $3, $4, $5)`, me, owner, id, caption, req.Reason); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	_, _ = h.DB.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING`, me, owner)
	httpx.JSON(w, http.StatusOK, map[string]string{"text": "Merci. C'est signalé : on va regarder. Tu ne verras plus ses photos."})
}

/* ---------- Comments ---------- */

var gramSays = map[string][]string{
	"": {
		"Trop belle photo 😍", "La lumière là ! ✨", "Magnifique 🔥", "Tu gères 👏", "J'adore !", "Babi est belle hein 💛",
		"Le cadrage 👌", "C'est où exactement ?", "Wahou 😮", "Trop stylé", "Encore une pépite", "Ça donne envie 😍",
		"Joli joli", "Tu es trop fort·e avec ton téléphone", "Le filtre est parfait", "On veut plus de photos comme ça 🙏",
	},
	"plage":   {"Emmène-moi 🏖️", "Bassam c'est la vie", "L'eau a l'air trop bonne"},
	"lagune":  {"La lagune Ébrié 💙", "Babi vue comme ça, c'est autre chose", "Le pont là 😍"},
	"coucher": {"Ce ciel 🧡", "Golden hour réussie", "Fond d'écran direct"},
	"maquis":  {"J'ai faim maintenant 😭", "C'est quel maquis ?", "Ajoute piment 🌶️", "Le poulet là a l'air trop bon"},
	"marche":  {"Les couleurs 😍", "Tantie va me voir demain", "Les mangues là !"},
	"rue":     {"Mon quartier ❤️", "Je connais ce coin !", "Babi a du style"},
	"nuit":    {"Les lumières ✨", "Babi la nuit c'est autre chose", "On sort quand ?"},
	"stade":   {"Allez les Éléphants 🐘🇨🇮", "L'ambiance 🔥", "J'étais là aussi !"},
	"studio":  {"Le style ! 🔥", "C'est quel couturier ?", "Wax propre", "Dix sur dix 💯"},
	"jardin":  {"Que c'est vert 🌿", "Les fleurs 🌺", "Un coin de paradis"},
}

// gramNPCComments: how many of the game's audience comment, from the reach.
func gramNPCComments(reach int) int { return min(gramNPCMaxComments, reach/gramNPCPerReach) }

// gramNPCHandle: one of the audience's @pseudos, from a random source.
func gramNPCHandle(rng *rand.Rand) string {
	name := tikiNPCNames[rng.IntN(len(tikiNPCNames))]
	h := strings.ToLower(name) + tikiNPCTags[rng.IntN(len(tikiNPCTags))]
	return strings.NewReplacer("é", "e", "è", "e", "ï", "i", "â", "a").Replace(h)
}

// GramComment has the shape of a Tikitoko comment (Author nil: the game's audience).
type GramComment = TikiComment

// gramNPCCommentList: the audience's comments on a post, always the same for a post.
func gramNPCCommentList(post int64, scene string, n int, at time.Time) []GramComment {
	rng := rand.New(rand.NewPCG(uint64(post), 0x6767))
	pool := append(slices.Clone(gramSays[""]), gramSays[scene]...)
	out := make([]GramComment, 0, n)
	for i := range n {
		handle := gramNPCHandle(rng)
		out = append(out, GramComment{
			ID:     fmt.Sprintf("npc-%d-%d", post, i),
			Name:   handle,
			Handle: handle,
			Body:   pool[rng.IntN(len(pool))],
			Likes:  int(rng.ExpFloat64() * 12),
			At:     at.Add(time.Duration(5+rng.IntN(360)) * time.Minute),
		})
	}
	return out
}

func (h *Handler) gramComments(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	id := gramPostID(r)
	owner, scene, reach, at, err := h.gramVisible(ctx, id, me)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	rows, err := h.DB.Query(ctx, `
		SELECT c.id, o.id, o.first_name, o.gender, o.look, COALESCE(u.username, ''), c.body, c.created_at,
			(SELECT count(*) FROM gram_comment_likes l WHERE l.comment = c.id),
			EXISTS(SELECT 1 FROM gram_comment_likes l WHERE l.comment = c.id AND l.sim = $2)
		FROM gram_comments c JOIN sims o ON o.id = c.sim JOIN users u ON u.id = o.user_id
		WHERE c.post = $1
			AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $2 AND k.blocked = c.sim) OR (k.sim = c.sim AND k.blocked = $2))
		ORDER BY c.created_at DESC LIMIT 200`, id, me)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	defer rows.Close()
	out := []GramComment{}
	for rows.Next() {
		var c GramComment
		var a StoryAuthor
		var cid int64
		var username string
		if err := rows.Scan(&cid, &a.ID, &a.FirstName, &a.Gender, &a.Look, &username, &c.Body, &c.At, &c.Likes, &c.Liked); err != nil {
			h.gbairaiFail(w, err)
			return
		}
		c.ID, c.Author, c.Name, c.Handle = strconv.FormatInt(cid, 10), &a, a.FirstName, tikiHandle(username, a.FirstName)
		c.Mine, c.ByCreator = a.ID == me, a.ID == owner
		c.CanDelete = c.Mine || (owner != "" && owner == me)
		out = append(out, c)
	}
	now := time.Now()
	npc := gramNPCCommentList(id, scene, gramNPCComments(grown(reach, at, now)), at)
	npc = slices.DeleteFunc(npc, func(c GramComment) bool { return c.At.After(now) })
	slices.SortFunc(npc, func(a, b GramComment) int { return b.Likes - a.Likes })
	httpx.JSON(w, http.StatusOK, append(out, npc...))
}

func (h *Handler) gramComment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Body string `json:"body"`
	}
	if err := httpx.Decode(r, &req); err != nil || strings.TrimSpace(req.Body) == "" {
		httpx.Error(w, http.StatusBadRequest, errGramComment.Error())
		return
	}
	body, err := cleanCaption(req.Body)
	if err != nil || body == "" {
		httpx.Error(w, http.StatusBadRequest, errGramComment.Error())
		return
	}
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	id := gramPostID(r)
	if _, _, _, _, err := h.gramVisible(ctx, id, me); err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	var lately int
	_ = h.DB.QueryRow(ctx, `SELECT count(*) FROM gram_comments WHERE sim = $1 AND created_at > now() - interval '1 hour'`, me).Scan(&lately)
	if lately >= GramCommentsPerHour {
		httpx.Error(w, http.StatusTooManyRequests, errGramChatty.Error())
		return
	}
	var cid int64
	if err := h.DB.QueryRow(ctx, `INSERT INTO gram_comments (post, sim, body) VALUES ($1, $2, $3) RETURNING id`, id, me, body).Scan(&cid); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"id": strconv.FormatInt(cid, 10), "body": body})
}

// gramUncomment: one's own comment, or any comment under one's own photo.
func (h *Handler) gramUncomment(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	cid, _ := strconv.ParseInt(chi.URLParam(r, "comment"), 10, 64)
	if _, err := h.DB.Exec(r.Context(), `DELETE FROM gram_comments c WHERE c.id = $1
		AND (c.sim = $2 OR EXISTS(SELECT 1 FROM gram_posts p WHERE p.id = c.post AND p.sim = $2))`, cid, me); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) gramCommentLike(w http.ResponseWriter, r *http.Request) {
	var req struct {
		On bool `json:"on"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	cid, _ := strconv.ParseInt(chi.URLParam(r, "comment"), 10, 64)
	if req.On {
		_, err = h.DB.Exec(r.Context(), `INSERT INTO gram_comment_likes (comment, sim) SELECT id, $2 FROM gram_comments WHERE id = $1 ON CONFLICT DO NOTHING`, cid, me)
	} else {
		_, err = h.DB.Exec(r.Context(), `DELETE FROM gram_comment_likes WHERE comment = $1 AND sim = $2`, cid, me)
	}
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"on": req.On})
}

// gramCommentReport: flags a comment for the moderators; its author is blocked for the reporter.
func (h *Handler) gramCommentReport(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Reason string `json:"reason"`
	}
	if err := httpx.Decode(r, &req); err != nil || !validReason(req.Reason) {
		h.gbairaiFail(w, errNoReason)
		return
	}
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	cid, _ := strconv.ParseInt(chi.URLParam(r, "comment"), 10, 64)
	var author, body string
	var post int64
	if err := h.DB.QueryRow(ctx, `SELECT sim, body, post FROM gram_comments WHERE id = $1`, cid).Scan(&author, &body, &post); err != nil || author == me {
		httpx.Error(w, http.StatusNotFound, errNoComment.Error())
		return
	}
	if _, err := h.DB.Exec(ctx, `INSERT INTO reports (reporter, reported, gram_post_id, gram_comment_id, excerpt, reason) VALUES ($1, $2, $3, $4, $5, $6)`, me, author, post, cid, body, req.Reason); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	_, _ = h.DB.Exec(ctx, `INSERT INTO blocks (sim, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING`, me, author)
	httpx.JSON(w, http.StatusOK, map[string]string{"text": "Merci. C'est signalé : on va regarder. Tu ne verras plus ce joueur."})
}

/* ---------- Accounts: follow, profile, search ---------- */

func (h *Handler) gramFollow(w http.ResponseWriter, r *http.Request) {
	var req struct {
		On bool `json:"on"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	other := chi.URLParam(r, "other")
	if npc, ok := strings.CutPrefix(other, "npc:"); ok {
		if _, ok := findGramNPC(npc); !ok && len(h.gramPeople(ctx, []string{npc})) == 0 {
			httpx.Error(w, http.StatusNotFound, errGramNoAccount.Error())
			return
		}
		if req.On {
			_, err = h.DB.Exec(ctx, `INSERT INTO gram_npc_follows (follower, npc) VALUES ($1, $2) ON CONFLICT DO NOTHING`, me, npc)
		} else {
			_, err = h.DB.Exec(ctx, `DELETE FROM gram_npc_follows WHERE follower = $1 AND npc = $2`, me, npc)
		}
	} else {
		if other == me {
			httpx.Error(w, http.StatusBadRequest, "tu ne peux pas t'abonner à toi-même")
			return
		}
		if req.On {
			_, err = h.DB.Exec(ctx, `INSERT INTO gram_follows (follower, followed) SELECT $1, id FROM sims WHERE id::text = $2
				AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $1 AND k.blocked = sims.id) OR (k.sim = sims.id AND k.blocked = $1)) ON CONFLICT DO NOTHING`, me, other)
		} else {
			_, err = h.DB.Exec(ctx, `DELETE FROM gram_follows WHERE follower = $1 AND followed::text = $2`, me, other)
		}
	}
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"on": req.On})
}

// GramProfile is an account's page: who, the counters, the bio, whether one follows it.
type GramProfile struct {
	Account   GramAccount `json:"account"`
	Bio       string      `json:"bio"`
	Posts     int         `json:"posts"`
	Fans      int         `json:"fans"`
	Following int         `json:"following"`
	Followed  bool        `json:"followed"`
	Mine      bool        `json:"mine"`
	// Mine only: photos left today.
	Left int `json:"left,omitempty"`
}

func (h *Handler) gramProfile(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	h.seedGram(ctx)
	other := chi.URLParam(r, "other")
	var p GramProfile
	if npc, ok := strings.CutPrefix(other, "npc:"); ok {
		n, ok := findGramNPC(npc)
		var account GramAccount
		if ok {
			account = npcAccount(n)
		} else if person, found := h.gramPeople(ctx, []string{npc})[npc]; found {
			// Someone met in the game: no bio of their own, where they come from.
			n, account = person.npc(), person.account()
			n.Bio = "Rencontré·e à Babi 🤝"
		} else {
			httpx.Error(w, http.StatusNotFound, errGramNoAccount.Error())
			return
		}
		var players int
		if err := h.DB.QueryRow(ctx, `SELECT (SELECT count(*) FROM gram_posts WHERE npc = $2), (SELECT count(*) FROM gram_npc_follows WHERE npc = $2),
			EXISTS(SELECT 1 FROM gram_npc_follows WHERE follower = $1 AND npc = $2)`, me, npc).Scan(&p.Posts, &players, &p.Followed); err != nil {
			h.gbairaiFail(w, err)
			return
		}
		p.Account, p.Bio, p.Fans, p.Following = account, n.Bio, n.Fans+players, n.Following
		httpx.JSON(w, http.StatusOK, p)
		return
	}
	var a StoryAuthor
	var username string
	var today int
	err = h.DB.QueryRow(ctx, `
		SELECT o.id, o.first_name, o.gender, o.look, COALESCE(u.username, ''), o.gram_bio,
			(SELECT count(*) FROM gram_posts p WHERE p.sim = o.id),
			o.gram_fans + (SELECT count(*) FROM gram_follows f WHERE f.followed = o.id),
			(SELECT count(*) FROM gram_follows f WHERE f.follower = o.id) + (SELECT count(*) FROM gram_npc_follows f WHERE f.follower = o.id),
			EXISTS(SELECT 1 FROM gram_follows f WHERE f.follower = $2 AND f.followed = o.id),
			(SELECT count(*) FROM gram_posts p WHERE p.sim = o.id AND p.created_at > now() - interval '24 hours')
		FROM sims o JOIN users u ON u.id = o.user_id
		WHERE o.id::text = $1
			AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $2 AND k.blocked = o.id) OR (k.sim = o.id AND k.blocked = $2))`, other, me).
		Scan(&a.ID, &a.FirstName, &a.Gender, &a.Look, &username, &p.Bio, &p.Posts, &p.Fans, &p.Following, &p.Followed, &today)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, errGramNoAccount.Error())
		return
	}
	p.Account, p.Mine = playerAccount(a, username), a.ID == me
	if p.Mine {
		p.Left = max(0, GramPerDay-today)
	}
	httpx.JSON(w, http.StatusOK, p)
}

// gramBio: one's bio, cleaned like a caption.
func (h *Handler) gramBio(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Bio string `json:"bio"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	bio, err := cleanCaption(req.Bio)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	if _, err := h.DB.Exec(r.Context(), `UPDATE sims SET gram_bio = $2 WHERE id = $1`, me, bio); err != nil {
		h.gbairaiFail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"bio": bio})
}

// GramFound is an account in the search.
type GramFound struct {
	Account  GramAccount `json:"account"`
	Bio      string      `json:"bio"`
	Fans     int         `json:"fans"`
	Followed bool        `json:"followed"`
}

// gramSearch: ?q= the players with Babigram (first name or @pseudo) and the
// game's accounts; with no q, the biggest accounts.
func (h *Handler) gramSearch(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	q := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(r.URL.Query().Get("q")), "@"))
	if len([]rune(q)) > 30 {
		q = string([]rune(q)[:30])
	}
	like := "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(q) + "%"
	rows, err := h.DB.Query(ctx, `
		SELECT o.id, o.first_name, o.gender, o.look, COALESCE(u.username, ''), o.gram_bio,
			o.gram_fans + (SELECT count(*) FROM gram_follows f WHERE f.followed = o.id),
			EXISTS(SELECT 1 FROM gram_follows f WHERE f.follower = $1 AND f.followed = o.id)
		FROM sims o JOIN users u ON u.id = o.user_id
		WHERE o.id <> $1 AND 'babigram' = ANY(o.apps)
			AND (o.first_name ILIKE $2 OR u.username ILIKE $2)
			AND NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $1 AND k.blocked = o.id) OR (k.sim = o.id AND k.blocked = $1))
		ORDER BY 7 DESC LIMIT 20`, me, like)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	defer rows.Close()
	out := []GramFound{}
	for rows.Next() {
		var f GramFound
		var a StoryAuthor
		var username string
		if err := rows.Scan(&a.ID, &a.FirstName, &a.Gender, &a.Look, &username, &f.Bio, &f.Fans, &f.Followed); err != nil {
			h.gbairaiFail(w, err)
			return
		}
		f.Account = playerAccount(a, username)
		out = append(out, f)
	}
	rows.Close()
	followed := map[string]bool{}
	if fr, err := h.DB.Query(ctx, `SELECT npc FROM gram_npc_follows WHERE follower = $1`, me); err == nil {
		for fr.Next() {
			var n string
			if fr.Scan(&n) == nil {
				followed[n] = true
			}
		}
		fr.Close()
	}
	lq := strings.ToLower(q)
	for _, n := range gramNPCs {
		if q == "" || strings.Contains(strings.ToLower(n.Name), lq) || strings.Contains(n.ID, lq) {
			out = append(out, GramFound{Account: npcAccount(n), Bio: n.Bio, Fans: n.Fans, Followed: followed[n.ID]})
		}
	}
	slices.SortStableFunc(out, func(a, b GramFound) int { return b.Fans - a.Fans })
	httpx.JSON(w, http.StatusOK, out[:min(len(out), 30)])
}

/* ---------- Activité: what happens to one's photos ---------- */

// GramActivity is a line of the activity tab: a player liked, commented or
// followed, or the game's audience did (Who has no Author then).
type GramActivity struct {
	Kind   string       `json:"kind"` // like | comment | follow | audience | fans
	Who    *GramAccount `json:"who,omitempty"`
	Others int          `json:"others,omitempty"`
	Post   int64        `json:"post,omitempty"`
	Photo  string       `json:"photo,omitempty"`
	Text   string       `json:"text,omitempty"`
	At     time.Time    `json:"at"`
}

func (h *Handler) gramActivity(w http.ResponseWriter, r *http.Request) {
	me, err := h.appSim(r, "babigram")
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	ctx := r.Context()
	out := []GramActivity{}
	photo := func(id int64) string { return fmt.Sprintf("/sims/%s/gram/%d/photo", me, id) }
	// The players: likes, comments on one's photos, new followers.
	rows, err := h.DB.Query(ctx, `
		SELECT x.kind, x.at, x.post, x.body, o.id, o.first_name, o.gender, o.look, COALESCE(u.username, '') FROM (
			SELECT 'like' AS kind, l.created_at AS at, l.post AS post, '' AS body, l.sim AS sim FROM gram_likes l JOIN gram_posts p ON p.id = l.post WHERE p.sim = $1 AND l.sim <> $1
			UNION ALL SELECT 'comment', c.created_at, c.post, c.body, c.sim FROM gram_comments c JOIN gram_posts p ON p.id = c.post WHERE p.sim = $1 AND c.sim <> $1
			UNION ALL SELECT 'follow', f.created_at, 0, '', f.follower FROM gram_follows f WHERE f.followed = $1
		) x JOIN sims o ON o.id = x.sim JOIN users u ON u.id = o.user_id
		WHERE NOT EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $1 AND k.blocked = x.sim) OR (k.sim = x.sim AND k.blocked = $1))
		ORDER BY x.at DESC LIMIT 40`, me)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	for rows.Next() {
		var it GramActivity
		var a StoryAuthor
		var username string
		if err := rows.Scan(&it.Kind, &it.At, &it.Post, &it.Text, &a.ID, &a.FirstName, &a.Gender, &a.Look, &username); err != nil {
			rows.Close()
			h.gbairaiFail(w, err)
			return
		}
		acc := playerAccount(a, username)
		it.Who = &acc
		if it.Post > 0 {
			it.Photo = photo(it.Post)
		}
		out = append(out, it)
	}
	rows.Close()
	// The game's audience on one's last photos.
	now := time.Now()
	pr, err := h.DB.Query(ctx, `SELECT id, likes, reach, created_at FROM gram_posts WHERE sim = $1 ORDER BY created_at DESC LIMIT 8`, me)
	if err != nil {
		h.gbairaiFail(w, err)
		return
	}
	for pr.Next() {
		var id int64
		var likes, reach int
		var at time.Time
		if pr.Scan(&id, &likes, &reach, &at) != nil {
			continue
		}
		n := grown(likes, at, now)
		if n < 1 {
			continue
		}
		who := gramNPCHandle(rand.New(rand.NewPCG(uint64(id), 0x6a)))
		when := at.Add(time.Duration(min(6*60, int(now.Sub(at).Minutes()))) * time.Minute / 2)
		out = append(out, GramActivity{Kind: "audience", Who: &GramAccount{ID: "", Name: who, Handle: who}, Others: n - 1, Post: id, Photo: photo(id), At: when})
		if c := gramNPCComments(grown(reach, at, now)); c > 0 {
			out = append(out, GramActivity{Kind: "audience-comments", Others: c, Post: id, Photo: photo(id), At: when.Add(-time.Minute)})
		}
	}
	pr.Close()
	var fans int
	_ = h.DB.QueryRow(ctx, `SELECT gram_fans FROM sims WHERE id = $1`, me).Scan(&fans)
	if fans > 0 {
		out = append(out, GramActivity{Kind: "fans", Others: fans, At: now.Add(-time.Hour)})
	}
	slices.SortStableFunc(out, func(a, b GramActivity) int { return b.At.Compare(a.At) })
	httpx.JSON(w, http.StatusOK, out)
}
