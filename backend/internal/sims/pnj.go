package sims

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"math/rand/v2"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Les PNJ joueurs: people of the game who play like players, not like the street's passers-by (npcchat):
// in the commune's list of players and walking the street as players do, with a username like theirs,
// shown in its own colour (and « PNJ » said when one greets them), never counted as online: each doing something real at a real place of the commune,
// that one can join (the same thing, next to them), greet (a word of advice for whoever's new) or invite
// to what one's doing. The same few come back to each commune, a different set every PnjSlot.

// PnjPrefix: a PNJ player's id, « ia-<commune>-<n> » (never a Sim's).
const PnjPrefix = "ia-"

// PnjSlot: how long a PNJ keeps doing the same thing.
const PnjSlot = 20 * time.Minute

type pnjPersona struct {
	name, user, gender string
	look               Look
}

var pnjCast = []pnjPersona{
	{"Koffi", "koffi_225", "homme", Look{Skin: "#5c3317", Hair: "short", HairColor: "#141010", Outfit: "casual", OutfitColor: "#1971c2", Beard: "bouc"}},
	{"Aya", "aya.babi", "femme", Look{Skin: "#6e4024", Hair: "braids", HairColor: "#141010", Outfit: "pagne", OutfitColor: "#e8590c", Accessory: "earrings"}},
	{"Yao", "yao_le_boss", "homme", Look{Skin: "#4a2a17", Hair: "degrade", HairColor: "#141010", Outfit: "jersey", OutfitColor: "#f08c00", Accessory: "chain"}},
	{"Fatou", "fatou.ci", "femme", Look{Skin: "#8d5524", Hair: "headwrap", HairColor: "#141010", Outfit: "kaba", OutfitColor: "#2f9e44"}},
	{"Ibrahim", "ibra_yop", "homme", Look{Skin: "#5c3317", Hair: "bald", HairColor: "#141010", Outfit: "boubou", OutfitColor: "#f1f3f5", Accessory: "kufi", Beard: "full"}},
	{"Mariam", "mariam_abj", "femme", Look{Skin: "#6e4024", Hair: "weave", HairColor: "#3b1f12", Outfit: "jupe", OutfitColor: "#d6336c"}},
	{"Serge", "serge.kouassi", "homme", Look{Skin: "#7a4a2a", Hair: "afro", HairColor: "#141010", Outfit: "chemise-pagne", OutfitColor: "#c2255c", Accessory: "glasses"}},
	{"Adjoua", "adjoua_belle", "femme", Look{Skin: "#4a2a17", Hair: "twists", HairColor: "#141010", Outfit: "robe", OutfitColor: "#7048e8"}},
	{"Moussa", "moussa.dj", "homme", Look{Skin: "#5c3317", Hair: "cornrows", HairColor: "#141010", Outfit: "survet", OutfitColor: "#212529", Accessory: "capback"}},
	{"Prisca", "prisca_225", "femme", Look{Skin: "#8d5524", Hair: "puffs", HairColor: "#141010", Outfit: "casual", OutfitColor: "#0ca678", Accessory: "headphones"}},
	{"Kouamé", "kouame.k", "homme", Look{Skin: "#4a2a17", Hair: "short", HairColor: "#141010", Outfit: "chemise", OutfitColor: "#4dabf7", Accessory: "watch"}},
	{"Awa", "awa_babi", "femme", Look{Skin: "#6e4024", Hair: "bun", HairColor: "#141010", Outfit: "bazin", OutfitColor: "#1098ad", Accessory: "beads"}},
	{"Junior", "junior_ballon", "homme", Look{Skin: "#7a4a2a", Hair: "twists", HairColor: "#141010", Outfit: "basket", OutfitColor: "#e03131"}},
	{"Bintou", "bintou.style", "femme", Look{Skin: "#5c3317", Hair: "ponytail", HairColor: "#141010", Outfit: "blouson", OutfitColor: "#343a40", Accessory: "sunglasses"}},
	{"Drissa", "drissa_zik", "homme", Look{Skin: "#5c3317", Hair: "locks", HairColor: "#141010", Outfit: "debardeur", OutfitColor: "#fab005", Accessory: "bandana"}},
	{"Grâce", "grace.abj", "femme", Look{Skin: "#7a4a2a", Hair: "bob", HairColor: "#141010", Outfit: "chemise", OutfitColor: "#f783ac", Accessory: "bag"}},
}

// pnjTips: what a PNJ says when greeted: a word of welcome, and a tip that's true of the game.
var pnjTips = []string{
	"Si tu cherches du travail, regarde l'appli Boulot sur ton téléphone : un service par jour, et tu montes en grade.",
	"Les Demandes du quartier, sur le téléphone : les gens ont besoin d'un coup de main, et ça rapporte un peu.",
	"Quand ton énergie baisse, rentre dormir : un perso fatigué, ça ne fait rien de bien.",
	"Rejoindre quelqu'un, c'est faire la même chose à côté de lui : l'amitié monte beaucoup plus vite.",
	"Ajoute les vrais joueurs en ami : vous pourrez vous écrire sur Gbairai et vous envoyer des Djai avec Waye.",
	"Les histoires du quartier, dans l'appli Demandes : un chapitre par jour, comme une série.",
	"Au maquis, un garba et ton ventre est content pour pas cher.",
	"Les activités avec un petit jeu, joue-les bien : ton score compte.",
	"Le soir, le quartier bouge : maquis, boîtes, soirées chez les joueurs. Le matin, c'est le boulot.",
	"Si tu veux voir du pays, « Où aller ? » t'emmène partout dans Abidjan.",
}

// pnjSeed: a number from the commune, the slot and the PNJ's place in it.
func pnjSeed(parts ...string) uint64 {
	f := fnv.New64a()
	for _, p := range parts {
		_, _ = f.Write([]byte(p))
		_, _ = f.Write([]byte{0})
	}
	return f.Sum64()
}

// pnjCount: how many PNJ players a commune shows, with that many real players there now.
func pnjCount(real int) int {
	switch {
	case real == 0:
		return 3
	case real < 4:
		return 2
	}
	return 1
}

// pnjAt: the PNJ players of a commune at a time: who, and what each is doing (a real interaction, open
// now, at a real place of the commune, that an adult can join).
func pnjAt(ctx context.Context, city, commune string, now time.Time, real int) []Player {
	_, cm, ok := world.FindCommune(city, commune)
	if !ok || len(cm.Places) == 0 {
		return nil
	}
	slot := now.Unix() / int64(PnjSlot.Seconds())
	from := time.Unix(slot*int64(PnjSlot.Seconds()), 0)
	start, end := game.MinuteOf(from), game.MinuteOf(from.Add(PnjSlot))
	minute := game.MinuteOf(now)
	rng := rand.New(rand.NewPCG(pnjSeed(city, commune, fmt.Sprint(slot)), 0x9e3779b9))
	cast := rng.Perm(len(pnjCast))
	var out []Player
	hour := game.HourOf(minute)
	n := pnjCount(real)
	if hour >= 1 && hour < 6 {
		n = min(n, 1) // the night: most have gone home to sleep
	}
	favoured := pnjDay(hour)
	for k := 0; k < n && k < len(cast); k++ {
		who := pnjCast[cast[k]]
		p := Player{ID: fmt.Sprintf("%s%s-%d", PnjPrefix, commune, cast[k]), FirstName: who.name, Username: who.user, Gender: who.gender, Look: who.look, Stage: game.StageAdulte, City: city, Commune: commune, Npc: true}
		// What they're doing: a few tries at a place and something to do there, open now.
		// A day that makes sense: the market and the office in the morning, the maquis at noon, the
		// club at night (the hour's places tried first, then anywhere).
		for try := 0; try < 20 && p.Activity == nil; try++ {
			place := cm.Places[rng.IntN(len(cm.Places))]
			kind, ok := game.Kinds[place.Kind]
			if !ok || len(kind.Interactions) == 0 || try < 14 && !containsStage(favoured, place.Kind) {
				continue
			}
			it := kind.Interactions[rng.IntN(len(kind.Interactions))]
			if !pnjCanDo(ctx, it, place.ID, minute) {
				continue
			}
			a := &game.Activity{Kind: "do", PlaceID: place.ID, PlaceKind: place.Kind, PlaceName: place.Name, Interaction: it, Start: start, End: max(end, minute+5)}
			p.Activity = publicActivity(a, minute)
		}
		out = append(out, p)
	}
	return out
}

// pnjCanDo: something a PNJ may be seen doing, and a player join: open now, for adults, in an update open,
// not a robbery, a job's shift, a hotel room's, a trip.
func pnjCanDo(ctx context.Context, it game.Interaction, placeID string, minute int64) bool {
	switch {
	case it.Minutes < 20, it.Stay, game.IsBraquage(it.ID), it.ID == game.WorkInteractionID:
		return false
	case len(it.Ages) > 0 && !containsStage(it.Ages, game.StageAdulte):
		return false
	case len(it.Places) > 0 && !containsStage(it.Places, placeID):
		return false
	case len(it.Cities) > 0, len(it.Faiths) > 0, it.Requires != nil, it.Fed, it.Cost > 3000:
		return false
	case !it.OpenAt(minute):
		return false
	}
	return features.Default.Blocks(ctx, it.ID) == ""
}

// pnjDay: the kinds of places a PNJ player goes to at an hour.
func pnjDay(hour int) []string {
	switch {
	case hour < 6:
		return []string{"club", "maquis", "rue"}
	case hour < 12:
		return []string{"market", "office", "sport", "gym", "transport", "boutique", "pharmacie", "worship", "station"}
	case hour < 14:
		return []string{"maquis", "restaurant", "market", "rue"}
	case hour < 18:
		return []string{"mall", "beach", "cinema", "sport", "culture", "boutique", "gaming", "salon", "barbier"}
	}
	return []string{"maquis", "club", "restaurant", "cinema", "rue", "beach", "gaming"}
}

func containsStage(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

var errPnjFriend = errors.New("les PNJ ne se mettent pas en ami : ajoute de vrais joueurs, tu pourras leur écrire")

// pnjFind: a PNJ player of the Sim's commune now, by id.
func pnjFind(ctx context.Context, s *Sim, id string) (Player, error) {
	if !strings.HasPrefix(id, PnjPrefix+s.Commune+"-") {
		return Player{}, errNotHere
	}
	for _, p := range pnjAt(ctx, s.City, s.Commune, time.Now(), 0) {
		if p.ID == id {
			return p, nil
		}
	}
	return Player{}, errors.New("cette personne est partie")
}

// pnjMeet: greeting, joining or inviting a PNJ player.
func (s *Sim) pnjMeet(ctx context.Context, tx pgx.Tx, id, action string) (game.Outcome, []Event, error) {
	p, err := pnjFind(ctx, s, id)
	if err != nil {
		return game.Outcome{}, nil, err
	}
	var text string
	switch action {
	case "saluer":
		met, err := pnjMet(ctx, tx, s.ID, id)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		s.Needs = s.Needs.Add(game.Needs{Social: 5})
		tip := pnjTips[pnjSeed(id, s.ID, fmt.Sprint(time.Now().Unix()/600))%uint64(len(pnjTips))]
		hello := "Bonne arrivée !"
		switch {
		case met >= 6:
			hello = fmt.Sprintf("Mon gars sûr %s ! On se voit tout le temps, toi et moi.", s.FirstName)
			if s.Gender == "femme" {
				hello = fmt.Sprintf("Ma copine %s ! On se voit tout le temps, toi et moi.", s.FirstName)
			}
		case met >= 2:
			hello = fmt.Sprintf("Encore toi, %s ! Ça va depuis ?", s.FirstName)
		case met == 1:
			hello = "Ah, on s'est déjà vus, non ? Ça va ?"
		}
		text = fmt.Sprintf("Tu salues %s (PNJ). « %s %s »", p.FirstName, hello, tip)
	case "rejoindre":
		if p.Activity == nil || !p.Activity.Joinable {
			return game.Outcome{}, nil, errHostDone
		}
		it, err := s.interactAt(p.Activity.PlaceID, p.Activity.InteractionID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		s.Needs = s.Needs.Add(game.Needs{Social: 10, Fun: 5})
		text = fmt.Sprintf("Tu rejoins %s (PNJ) : %s à %s.", p.FirstName, it.Label, p.Activity.PlaceName)
		return game.Outcome{Text: text, Money: -max(it.Cost, 0)}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
	case "inviter":
		if !joinable(s.Activity, game.MinuteOf(time.Now())) {
			return game.Outcome{}, nil, errNotJoinable
		}
		s.Needs = s.Needs.Add(game.Needs{Social: 10, Fun: 5})
		text = fmt.Sprintf("%s (PNJ) te rejoint : %s, ensemble, c'est mieux.", p.FirstName, s.Activity.Interaction.Label)
	case "ajouter":
		return game.Outcome{}, nil, errPnjFriend
	default:
		return game.Outcome{}, nil, errors.New("action inconnue")
	}
	return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
}

// pnjMet: a greeting counted; how many times they had met before.
func pnjMet(ctx context.Context, tx pgx.Tx, simID, pnj string) (int, error) {
	var met int
	err := tx.QueryRow(ctx, `INSERT INTO pnj_bonds (sim_id, pnj, met) VALUES ($1, $2, 1)
		ON CONFLICT (sim_id, pnj) DO UPDATE SET met = pnj_bonds.met + 1 RETURNING met - 1`, simID, pnj).Scan(&met)
	return met, err
}

// pnjInviteSep: a PNJ's invitation id, « <its id>~<slot> ».
const pnjInviteSep = "~"

// pnjInvite: the invitation a PNJ player sends to the Sims of its commune now and then (one slot in three,
// to join what it's doing), unless this Sim already answered it.
func pnjInvite(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, simID, city, commune string, now time.Time, players []Player) *Invite {
	slot := now.Unix() / int64(PnjSlot.Seconds())
	if pnjSeed(commune, fmt.Sprint(slot), "invite")%3 != 0 {
		return nil
	}
	for _, p := range players {
		if !p.Npc || p.Activity == nil || !p.Activity.Joinable {
			continue
		}
		var answered int64
		_ = q.QueryRow(ctx, `SELECT answered_slot FROM pnj_bonds WHERE sim_id = $1 AND pnj = $2`, simID, p.ID).Scan(&answered)
		if answered == slot {
			return nil
		}
		return &Invite{ID: p.ID + pnjInviteSep + fmt.Sprint(slot), From: p.ID, FromName: p.FirstName + " (PNJ)", PlaceID: p.Activity.PlaceID, InteractionID: p.Activity.InteractionID, Label: p.Activity.Label, At: time.Unix(slot*int64(PnjSlot.Seconds()), 0)}
	}
	return nil
}

// pnjAnswer: a PNJ's invitation answered: remembered, and joined if accepted.
func (s *Sim) pnjAnswer(ctx context.Context, tx pgx.Tx, inviteID, answer string) (game.Outcome, []Event, error) {
	id, slot, ok := strings.Cut(inviteID, pnjInviteSep)
	if !ok || slot != fmt.Sprint(time.Now().Unix()/int64(PnjSlot.Seconds())) {
		return game.Outcome{}, nil, errInviteGone
	}
	p, err := pnjFind(ctx, s, id)
	if err != nil {
		return game.Outcome{}, nil, errInviteGone
	}
	if _, err := tx.Exec(ctx, `INSERT INTO pnj_bonds (sim_id, pnj, answered_slot) VALUES ($1, $2, $3)
		ON CONFLICT (sim_id, pnj) DO UPDATE SET answered_slot = EXCLUDED.answered_slot`, s.ID, id, slot); err != nil {
		return game.Outcome{}, nil, err
	}
	if answer == "refuser" {
		return game.Outcome{Text: fmt.Sprintf("Tu dis non à %s (PNJ). « Pas de souci, une autre fois ! »", p.FirstName)}, nil, nil
	}
	return s.pnjMeet(ctx, tx, id, "rejoindre")
}
