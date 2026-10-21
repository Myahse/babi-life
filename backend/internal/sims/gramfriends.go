package sims

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The people met in the game post on Babigram too. Once someone is a
// player's friend (game.Friend, an id from the world: "p-…"), they get an
// account (gram_people) and photos every day or so, written like the game's
// own accounts' (gramNPCSlots): the same for everyone, public, with the face
// they had when met. Friends made up by the game ("f1"…) aren't anyone's in
// particular, and the bande doesn't post.

// gramPersonScenes: what a person photographs, from their seed.
var gramPersonScenes = [][]string{
	{"maquis", "nuit"}, {"rue", "marche"}, {"plage", "coucher"}, {"studio", "rue"}, {"stade", "rue"}, {"jardin", "lagune"},
}

// gramPerson: a person met in the game, as a Babigram account.
type gramPerson struct {
	ID, Name, Gender string
	Look             Look
	Seed             int
}

func (p gramPerson) npc() gramNPC {
	return gramNPC{ID: p.ID, Name: p.Name, Gender: p.Gender, Fans: 60 + (p.Seed*31)%800, Following: 80 + p.Seed%300, Every: 30, Scenes: gramPersonScenes[p.Seed%len(gramPersonScenes)]}
}

func (p gramPerson) account() GramAccount {
	a := StoryAuthor{ID: "npc:" + p.ID, FirstName: p.Name, Gender: p.Gender, Look: p.Look}
	return GramAccount{ID: "npc:" + p.ID, Author: &a, NPC: true, Name: p.Name, Gender: p.Gender, Handle: friendHandle(game.Friend{Name: p.Name, Seed: p.Seed})}
}

// A world person, not one the game made up for this Sim alone.
func postsOnGram(f game.Friend) bool { return strings.HasPrefix(f.ID, "p-") && !f.Gang }

var gramFriendsSeeded = struct {
	sync.Mutex
	at map[string]time.Time
}{at: map[string]time.Time{}}

// seedGramFriends: this Sim's friends get their account, and their photos due by now (every ten minutes at most).
func (h *Handler) seedGramFriends(ctx context.Context, me string) {
	gramFriendsSeeded.Lock()
	if time.Since(gramFriendsSeeded.at[me]) < 10*time.Minute {
		gramFriendsSeeded.Unlock()
		return
	}
	gramFriendsSeeded.at[me] = time.Now()
	gramFriendsSeeded.Unlock()
	var (
		keys, npcs, scenes, captions, places []string
		seeds                                []int64
		reach, likes                         []int32
		ats                                  []time.Time
	)
	now := time.Now()
	for _, f := range h.simFriends(ctx, me) {
		if !postsOnGram(f) {
			continue
		}
		look := f.Look
		if len(look) == 0 {
			look = json.RawMessage(`{}`)
		}
		// The account: the face kept once there is one.
		if _, err := h.DB.Exec(ctx, `INSERT INTO gram_people (id, name, gender, look, seed) VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO UPDATE SET look = EXCLUDED.look WHERE gram_people.look = '{}'::jsonb`, f.ID, f.Name, f.Gender, look, f.Seed); err != nil {
			continue
		}
		for _, p := range gramNPCSlots(gramPerson{ID: f.ID, Name: f.Name, Gender: f.Gender, Seed: f.Seed}.npc(), now, gramBackfillDays) {
			keys, npcs, scenes, captions, places = append(keys, p.Key), append(npcs, p.NPC), append(scenes, p.Scene), append(captions, p.Caption), append(places, p.Place)
			seeds, reach, likes, ats = append(seeds, p.Seed), append(reach, int32(p.Reach)), append(likes, int32(p.Likes)), append(ats, p.At)
		}
	}
	if len(keys) == 0 {
		return
	}
	_, _ = h.DB.Exec(ctx, `INSERT INTO gram_posts (key, npc, scene, caption, place, seed, reach, likes, created_at, ratio)
		SELECT k, n, s, c, pl, sd, r, l, a, CASE WHEN sd % 3 = 0 THEN 'portrait' ELSE 'carre' END
		FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::bigint[], $7::int[], $8::int[], $9::timestamptz[]) AS t(k, n, s, c, pl, sd, r, l, a)
		ON CONFLICT (key) DO NOTHING`, keys, npcs, scenes, captions, places, seeds, reach, likes, ats)
}

// gramPeople: the accounts of these people met in the game, by id.
func (h *Handler) gramPeople(ctx context.Context, ids []string) map[string]gramPerson {
	out := map[string]gramPerson{}
	if len(ids) == 0 {
		return out
	}
	rows, err := h.DB.Query(ctx, `SELECT id, name, gender, look, seed FROM gram_people WHERE id = ANY($1)`, ids)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var p gramPerson
		if rows.Scan(&p.ID, &p.Name, &p.Gender, &p.Look, &p.Seed) == nil {
			out[p.ID] = p
		}
	}
	return out
}
