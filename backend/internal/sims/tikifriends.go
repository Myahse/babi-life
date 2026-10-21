package sims

import (
	"context"
	"encoding/json"
	"hash/fnv"
	"math/rand/v2"
	"strings"
	"time"
	"unicode"

	"golang.org/x/text/unicode/norm"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The Sim's friends post too. Someone met at the maquis, in the street or at
// the club (game.Friend) puts up a video every other day or so, with the face
// they had when met: in this player's « Pour toi », first, since they know
// them. Like the game's creators (tikinpc.go), nothing is stored: a post is
// worked out again from its id, the day and the friend it hashes to.

const (
	// friendPostBase: the friends' post ids, far below the creators' (npcID).
	friendPostBase = 10_000_000_000_000
	friendDays     = 1e5 // the day's place in an id
	// friendPostChance: the chance a friend posts on a given day.
	friendPostChance = 0.45
)

// friendThemes: what a friend films, from their seed (always the same person, the same kind of video).
var friendThemes = []string{"danse", "humour", "garba", "vlog", "mode", "sport"}

func friendHash(me, friend string) int64 {
	f := fnv.New32a()
	_, _ = f.Write([]byte(me + "|" + friend))
	return int64(f.Sum32() % 10_000_000)
}

func friendPostID(me, friend string, day int64) int64 {
	return -(friendPostBase + friendHash(me, friend)*friendDays + day%friendDays)
}

// friendAuthorID: a friend as a Tikitoko author (their page: the "auteur" tab).
func friendAuthorID(f game.Friend) string { return "friend-" + f.ID }

// friendHandle: their @, from the name (no accents, no spaces) and a number of their own.
func friendHandle(f game.Friend) string {
	var b strings.Builder
	for _, r := range norm.NFD.String(strings.ToLower(f.Name)) {
		if r < 128 && (unicode.IsLetter(r) || unicode.IsDigit(r)) {
			b.WriteRune(r)
		}
	}
	return b.String() + "_" + string(rune('0'+f.Seed%10)) + string(rune('0'+(f.Seed/10)%10))
}

func friendFans(f game.Friend) int { return 40 + (f.Seed*37)%900 }

// friendPost: what this friend posted that day (for the Sim `me`), if anything yet.
func friendPost(me string, f game.Friend, day int64, now time.Time) (TikiPost, bool) {
	if f.Gang {
		return TikiPost{}, false // the bande doesn't film itself
	}
	id := friendPostID(me, f.ID, day)
	rng := rand.New(rand.NewPCG(uint64(-id), 0xf41e))
	if rng.Float64() >= friendPostChance {
		return TikiPost{}, false
	}
	at := time.Unix(day*86400, 0).UTC().Add(time.Duration(8*60+rng.IntN(14*60)) * time.Minute)
	if at.After(now) || now.Sub(at) > (tikiNPCDays+1)*24*time.Hour {
		return TikiPost{}, false
	}
	theme := friendThemes[(f.Seed+int(day%3)/2)%len(friendThemes)]
	caps, places := tikiNPCCaptions[theme], tikiNPCPlaces[theme]
	fans := friendFans(f)
	views := 30 + int(float64(fans)*(0.4+rng.Float64()*1.4))
	likes := int(float64(views) * (0.08 + rng.Float64()*0.08))
	var look Look
	if len(f.Look) > 0 {
		_ = json.Unmarshal(f.Look, &look)
	}
	p := TikiPost{
		ID:         id,
		Author:     StoryAuthor{ID: friendAuthorID(f), FirstName: f.Name, Gender: f.Gender, Look: look},
		Handle:     friendHandle(f),
		Fans:       fans,
		Tier:       tikiTier(fans),
		Caption:    caps[rng.IntN(len(caps))],
		Theme:      theme,
		Place:      places[rng.IntN(len(places))],
		Sound:      tikiSounds[1+rng.IntN(len(tikiSounds)-1)],
		DurationMs: 6000 + rng.IntN(6)*1000,
		NPC:        &TikiNPC{Look: uint32(f.Seed), Scene: rng.Uint32()},
		Friend:     true,
		At:         at,
	}
	if named := namedPlace(p.Caption, places); named != "" {
		p.Place = named
	}
	p.Views, p.Likes = grown(views, at, now), grown(likes, at, now)
	p.Comments = npcComments(p.Views)
	p.Saves, p.Shares = p.Likes/25, p.Likes/40
	return p, true
}

// friendPosts: the friends' posts of the last days, newest first; author: one friend's only ("" for all).
func friendPosts(me string, friends []game.Friend, now time.Time, author string) []TikiPost {
	out := []TikiPost{}
	today := now.Unix() / 86400
	for d := today; d > today-tikiNPCDays; d-- {
		for _, f := range friends {
			if author != "" && friendAuthorID(f) != author {
				continue
			}
			if p, ok := friendPost(me, f, d, now); ok {
				out = append(out, p)
			}
		}
	}
	return out
}

// findFriendPost: the friend's post with that id, for the Sim `me`.
func findFriendPost(me string, friends []game.Friend, id int64, now time.Time) (TikiPost, bool) {
	n := -id - friendPostBase
	if n < 0 {
		return TikiPost{}, false
	}
	hash, day := n/friendDays, n%friendDays
	today := now.Unix() / 86400
	for _, f := range friends {
		if friendHash(me, f.ID) != hash {
			continue
		}
		// The day's last digits only are in the id: the one of the last days with them.
		for d := today; d > today-tikiNPCDays-1; d-- {
			if d%friendDays == day {
				return friendPost(me, f, d, now)
			}
		}
	}
	return TikiPost{}, false
}

// simFriends: the Sim's friends (none if it can't be read).
func (h *Handler) simFriends(ctx context.Context, me string) []game.Friend {
	var fs []game.Friend
	_ = h.DB.QueryRow(ctx, `SELECT friends FROM sims WHERE id = $1`, me).Scan(&fs)
	return fs
}

// gamePost: a post nobody stores, the game's creators' or a friend's.
func (h *Handler) gamePost(ctx context.Context, me string, id int64) (TikiPost, bool) {
	if p, ok := npcPost(id, time.Now()); ok {
		return p, true
	}
	if -id < friendPostBase {
		return TikiPost{}, false
	}
	return findFriendPost(me, h.simFriends(ctx, me), id, time.Now())
}

// friendProfile: a friend's Tikitoko page.
func friendProfile(me string, friends []game.Friend, author string, now time.Time) (TikiProfile, bool) {
	for _, f := range friends {
		if friendAuthorID(f) != author || f.Gang {
			continue
		}
		posts := friendPosts(me, friends, now, author)
		likes := 0
		for _, p := range posts {
			likes += p.Likes
		}
		var look Look
		if len(f.Look) > 0 {
			_ = json.Unmarshal(f.Look, &look)
		}
		fans := friendFans(f)
		return TikiProfile{
			Author:    StoryAuthor{ID: author, FirstName: f.Name, Gender: f.Gender, Look: look},
			Handle:    friendHandle(f),
			Tier:      tikiTier(fans),
			Following: 30 + f.Seed%200,
			Fans:      fans,
			Likes:     likes + fans,
			Posts:     len(posts) + f.Seed%12,
			NPC:       &TikiNPC{Look: uint32(f.Seed)},
		}, true
	}
	return TikiProfile{}, false
}
