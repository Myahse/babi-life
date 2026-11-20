package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/feats"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
)

// L'héritage, phase 2 (the same update « heritage », heritage.go; web screens/FamilleApp.tsx):
//   - a child of two players: a couple « officiel » or more (la vie amoureuse's stages, bonds.love_stage),
//     one asks, the other says yes (love_requests kind 'bebe'; 'officiel' first, the same way), fade to
//     black. The child is one row of couple_kids, mirrored into both families (Kid.Shared): each parent's
//     own clock in hours played brings it home and grows it. Whichever parent hands down to it first takes
//     it (couple_kids.taken_by, the row locked in the passation's transaction); the other is told « X a
//     repris la maison de Y » and picks another heir. No Djai ever goes from one row to the other. A couple
//     broken (or a block, a report) asks for no more babies; a child there stays with both till taken;
//   - the childhood friend's child as heir, when there is no child of one's own: the friend (friendship 60
//     or more) becomes its « tonton » or « tata »;
//   - the elders out in the world: in the commune's grin now and then (ids « ancien-<simId> »), in front of
//     the house in Mon quartier (greeted there), at the host's soirées; once gone to the village, nowhere;
//   - a parent's friends who are players: the heir's tontons and tatas (bonds.tonton_a/b);
//   - the generation's feats written as they happen (feats package, generation_feats);
//   - a passation told in Babi Direct and to the family's friends.

var (
	errCoupleNotYours  = errors.New("tu n'es pas en couple avec ce joueur ou cette joueuse")
	errCoupleOfficiel  = errors.New("un bébé à deux, c'est quand votre couple est officiel (« Ma famille » : officialiser d'abord)")
	errCoupleAlreadyOf = errors.New("votre couple est déjà officiel")
	errCoupleBlocked   = errors.New("pas possible entre vous deux")
	errLoveAsked       = errors.New("c'est demandé : attends sa réponse")
	errLoveKind        = errors.New("demande inconnue")
	errSharedTaken     = errors.New("cet enfant a déjà repris une maison : choisis un autre héritier")
)

// stageRank: how far a couple has gone (« ensemble » 1 … « mariés » 4; none 0).
func stageRank(stage string) int {
	for i, s := range game.LoveStages {
		if s.ID == stage {
			return i + 1
		}
	}
	return 0
}

/* ---------- The feats ---------- */

// featsFlush: the generation's feats of this request written (feats package), once each.
func (s *Sim) featsFlush(ctx context.Context, tx pgx.Tx) {
	for _, f := range s.feats {
		feats.Record(ctx, tx, s.ID, f[0], f[1])
	}
	s.feats = nil
}

// paperFeat: a paper issued for the first time that is a feat: the bac, a diploma, a marriage.
func paperFeat(ctx context.Context, tx pgx.Tx, sim, kind string) {
	switch kind {
	case game.DocBAC:
		feats.Record(ctx, tx, sim, feats.Diploma, "bac")
	case game.DocDiplome:
		feats.Record(ctx, tx, sim, feats.Diploma, "sup")
	case game.DocMariage:
		feats.Record(ctx, tx, sim, feats.Marriage, "")
	}
}

// featsIn: what the feats recorded add to the generation's renom: its best office, a diploma, a marriage,
// its highest rung.
func featsIn(list []string, in *game.RenomIn) {
	for _, f := range list {
		kind, detail, _ := strings.Cut(f, ":")
		switch kind {
		case feats.Office:
			if game.OfficeRenom[detail] > game.OfficeRenom[in.Office] {
				in.Office = detail
			}
		case feats.Diploma:
			in.Bac = true
			in.Sup = in.Sup || detail == "sup"
		case feats.Marriage:
			in.Married = true
		case feats.Career:
			if i := strings.LastIndexByte(detail, ':'); i >= 0 {
				if n, err := strconv.Atoi(detail[i+1:]); err == nil {
					in.CareerLevel = max(in.CareerLevel, n)
				}
			}
		}
	}
}

// FeatView: a feat of the generation, as « Ma famille » lists them.
type FeatView struct {
	Kind   string    `json:"kind"`
	Detail string    `json:"detail"`
	Label  string    `json:"label"`
	At     time.Time `json:"at"`
}

func readFeats(ctx context.Context, q queryer, sim string, gen int) []FeatView {
	out := []FeatView{}
	rows, err := q.Query(ctx, `SELECT kind, detail, at FROM generation_feats WHERE sim_id = $1 AND gen = $2 ORDER BY at`, sim, gen)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var f FeatView
		if rows.Scan(&f.Kind, &f.Detail, &f.At) == nil {
			f.Label = game.FeatLabel(f.Kind, f.Detail)
			out = append(out, f)
		}
	}
	return out
}

/* ---------- The children of two players ---------- */

// sharedKid: a couple_kids row as one parent reads it.
type sharedKid struct {
	id                     int64
	kid                    Kid
	from                   string // the parent who took it: their name then
	taken                  string // the parent who took it (their sim)
	otherName, otherGender string
}

// coupleKidsSync: the children of two players brought into the Sim's family: one just made is on its way
// (its parent's own clock in hours played), its name as the other parent gave it, and once the other
// parent has handed down to it, « X a repris la maison de Y » (not an heir here any more).
func coupleKidsSync(ctx context.Context, tx pgx.Tx, s *Sim) error {
	if !s.heritageOn || s.minor() {
		return nil
	}
	rows, err := tx.Query(ctx, `SELECT c.id, c.kid, COALESCE(c.taken_by::text, ''), COALESCE(o.first_name, ''), COALESCE(o.gender, '')
		FROM couple_kids c LEFT JOIN sims o ON o.id = CASE WHEN c.sim_a = $1 THEN c.sim_b ELSE c.sim_a END
		WHERE c.sim_a = $1 OR c.sim_b = $1 ORDER BY c.id`, s.ID)
	if err != nil {
		return err
	}
	var list []sharedKid
	for rows.Next() {
		var k sharedKid
		var raw []byte
		if err := rows.Scan(&k.id, &raw, &k.taken, &k.otherName, &k.otherGender); err != nil {
			rows.Close()
			return err
		}
		var extra struct {
			From string `json:"from"`
		}
		_ = json.Unmarshal(raw, &k.kid)
		_ = json.Unmarshal(raw, &extra)
		k.from = extra.From
		list = append(list, k)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	if len(list) == 0 {
		return nil
	}
	f := s.fam()
	now := s.GameMinutes
	sp := s.spans()
	for _, k := range list {
		if k.taken == s.ID {
			continue // handed down to it here: it is the Sim now
		}
		if mine := f.sharedKid(k.id); mine != nil {
			mine.Name = k.kid.Name
			if k.taken != "" && mine.Took == "" {
				mine.Took = k.from
				s.pending = append(s.pending, Event{Kind: "life", Text: fmt.Sprintf("%s a repris la maison de %s. Choisis un autre héritier dans « Ma famille ».", mine.Name, k.from), GameTime: now})
			}
			continue
		}
		if e := f.Expecting; e != nil && e.Shared == k.id {
			if e.Kid != nil {
				e.Kid.Name = k.kid.Name
			}
			continue
		}
		if k.taken != "" || len(f.Kids) >= maxKids {
			continue // taken before it ever came here, or no room: the other parent's child
		}
		kid := k.kid
		kid.Shared, kid.With = k.id, k.otherName
		if f.Expecting == nil {
			// On its way here too, for a pregnancy's time of this parent's own play.
			mother := ""
			switch {
			case s.Gender == "femme":
				mother = "self"
			case k.otherGender == "femme":
				mother = "partner"
			}
			f.Expecting = &Expecting{Since: now, Due: now + game.Days(sp.Grossesse), Mother: mother, Shared: k.id, Kid: &kid}
			continue
		}
		// (A baby already on its way here: this one is home at once.)
		kid.Born, kid.Stage, kid.Years = now, game.StageBebe, 0
		f.Kids = append(f.Kids, kid)
		f.Arrival = kid.ID
		s.paperSync = true
		s.pending = append(s.pending, Event{Kind: "life", Text: fmt.Sprintf("%s est né·e : l'enfant de %s et toi. Bienvenue !", kid.Name, k.otherName), GameTime: now})
	}
	return nil
}

// sharedKid: the child of two players of that row, here.
func (f *Famille) sharedKid(id int64) *Kid {
	for i := range f.Kids {
		if f.Kids[i].Shared == id {
			return &f.Kids[i]
		}
	}
	return nil
}

// HeirCouple: the player one is with, as « Ma famille » shows them (the babies are asked there).
type HeirCouple struct {
	ID         string          `json:"id"`
	Name       string          `json:"name"`
	Gender     string          `json:"gender"`
	Look       json.RawMessage `json:"look,omitempty"`
	Stage      string          `json:"stage"`
	StageLabel string          `json:"stageLabel"`
	// Asked: what the Sim asked them and waits on (« officiel », « bebe »); Asking: what they ask.
	Asked  []string `json:"asked"`
	Asking []string `json:"asking"`
}

// readHeirCouple: the couple of players the Sim is in, with the requests between them (nil: none).
func readHeirCouple(ctx context.Context, q queryer, me string) *HeirCouple {
	other := inCouple(ctx, q, me)
	if other == "" {
		return nil
	}
	x, y := pair(me, other)
	c := HeirCouple{ID: other, Asked: []string{}, Asking: []string{}}
	var look []byte
	if err := q.QueryRow(ctx, `SELECT b.love_stage, o.first_name, o.gender, o.look FROM bonds b, sims o WHERE b.sim_a = $1 AND b.sim_b = $2 AND o.id = $3`, x, y, other).Scan(&c.Stage, &c.Name, &c.Gender, &look); err != nil {
		return nil
	}
	c.Look = look
	if c.Stage == "" {
		c.Stage = game.LoveEnsemble
	}
	c.StageLabel = game.LoveStageLabel(c.Stage)
	rows, err := q.Query(ctx, `SELECT from_sim::text, kind FROM love_requests WHERE ((from_sim = $1 AND to_sim = $2) OR (from_sim = $2 AND to_sim = $1)) AND kind IN ('officiel', 'bebe')`, me, other)
	if err == nil {
		for rows.Next() {
			var from, kind string
			if rows.Scan(&from, &kind) == nil {
				if from == me {
					c.Asked = append(c.Asked, kind)
				} else {
					c.Asking = append(c.Asking, kind)
				}
			}
		}
		rows.Close()
	}
	return &c
}

// babyBlock: why the Sim can't have a baby now (nil: it can).
func (s *Sim) babyBlock() error {
	f := s.fam()
	switch {
	case s.minor():
		return game.ErrTooYoung
	case f.Expecting != nil:
		return errExpecting
	case len(f.Kids) >= maxKids:
		return errTooManyKids
	case f.Stage == game.AgeSenior:
		return errTooOldBaby
	}
	return nil
}

// heritageCouple: POST /sims/{id}/heritage/couple {kind: officiel | bebe, action: demander | accepter |
// refuser | annuler}: a step asked of the player one is with, and their answer. Both must say yes; asked
// both ways, it's a yes. A baby: the couple officiel or more, both adults, neither blocked, nothing on the
// way; fade to black; the child made once (couple_kids), on its way here and, at their next turn, there.
func (h *Handler) heritageCouple(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind   string `json:"kind"`
		Action string `json:"action"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	var ring func()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if !s.heritageOn {
			return game.Outcome{}, nil, errLifeClosed
		}
		if req.Kind != game.LoveOfficiel && req.Kind != "bebe" {
			return game.Outcome{}, nil, errLoveKind
		}
		other := inCouple(ctx, tx, s.ID)
		if other == "" {
			return game.Outcome{}, nil, errCoupleNotYours
		}
		x, y := pair(s.ID, other)
		var stage, name, gender string
		var blocked bool
		if err := tx.QueryRow(ctx, `SELECT b.love_stage, o.first_name, o.gender, EXISTS(SELECT 1 FROM blocks k WHERE (k.sim = $3 AND k.blocked = $4) OR (k.sim = $4 AND k.blocked = $3))
			FROM bonds b, sims o WHERE b.sim_a = $1 AND b.sim_b = $2 AND o.id = $4`, x, y, s.ID, other).Scan(&stage, &name, &gender, &blocked); err != nil {
			return game.Outcome{}, nil, err
		}
		if blocked {
			return game.Outcome{}, nil, errCoupleBlocked
		}
		now := s.GameMinutes
		// (The other player's journal written after the save: Sim.outbox.)
		tell := func(text string) { s.outbox = append(s.outbox, outLine{other, "life", text}) }
		me := s.FirstName
		pushTo := func(body string) {
			ring = func() {
				if h.Push != nil {
					h.Push.ToSim(other, push.Message{Title: "Babi Life · Ma famille", Body: body, URL: "/jeu?app=famille", Tag: "famille-" + s.ID})
				}
			}
		}
		// What the step asks of both, checked when asked and again when said yes to.
		check := func() error {
			if !grownUp(ctx, tx, s.ID) || !grownUp(ctx, tx, other) {
				return errCoupleAdults
			}
			if req.Kind == game.LoveOfficiel {
				if stageRank(stage) >= stageRank(game.LoveOfficiel) {
					return errCoupleAlreadyOf
				}
				return nil
			}
			if stageRank(stage) < stageRank(game.LoveOfficiel) {
				return errCoupleOfficiel
			}
			return s.babyBlock()
		}
		var theyAsked, iAsked bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM love_requests WHERE from_sim = $1 AND to_sim = $2 AND kind = $3), EXISTS(SELECT 1 FROM love_requests WHERE from_sim = $2 AND to_sim = $1 AND kind = $3)`,
			other, s.ID, req.Kind).Scan(&theyAsked, &iAsked)
		yes := func() (game.Outcome, []Event, error) {
			if err := check(); err != nil {
				return game.Outcome{}, nil, err
			}
			if _, err := tx.Exec(ctx, `DELETE FROM love_requests WHERE ((from_sim = $1 AND to_sim = $2) OR (from_sim = $2 AND to_sim = $1)) AND kind = $3`, s.ID, other, req.Kind); err != nil {
				return game.Outcome{}, nil, err
			}
			if req.Kind == game.LoveOfficiel {
				if _, err := tx.Exec(ctx, `UPDATE bonds SET love_stage = $3, love_tended = now(), romance = LEAST(100, romance + 5) WHERE sim_a = $1 AND sim_b = $2`, x, y, game.LoveOfficiel); err != nil {
					return game.Outcome{}, nil, err
				}
				s.addMood("amoureux", name)
				tell(fmt.Sprintf("%s a dit oui : votre couple est officiel ❤", me))
				pushTo(fmt.Sprintf("%s a dit oui : votre couple est officiel ❤", me))
				text := fmt.Sprintf("C'est officiel : %s et toi, devant tout le monde ❤", name)
				return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: now}}, nil
			}
			// The child, once: its name and its face drawn now, the same in both families.
			rng := newRand()
			g := "femme"
			if rng.IntN(2) == 0 {
				g = "homme"
			}
			kid := Kid{Name: game.BabyName(g, rng), Gender: g, Seed: rng.IntN(1 << 30), Traits: game.BabyTraits(s.Traits, rng), Stage: game.StageBebe}
			var id int64
			if err := tx.QueryRow(ctx, `SELECT nextval(pg_get_serial_sequence('couple_kids', 'id'))`).Scan(&id); err != nil {
				return game.Outcome{}, nil, err
			}
			kid.ID = "c" + strconv.FormatInt(id, 10)
			raw, _ := json.Marshal(kid)
			if _, err := tx.Exec(ctx, `INSERT INTO couple_kids (id, sim_a, sim_b, kid) VALUES ($1, $2, $3, $4)`, id, other, s.ID, raw); err != nil {
				return game.Outcome{}, nil, err
			}
			kid.Shared, kid.With = id, name
			mother := ""
			switch {
			case s.Gender == "femme":
				mother = "self"
			case gender == "femme":
				mother = "partner"
			}
			sp := s.spans()
			s.fam().Expecting = &Expecting{Since: now, Due: now + game.Days(sp.Grossesse), Mother: mother, Shared: id, Kid: &kid}
			s.Needs = s.Needs.Add(game.Needs{Social: 25, Fun: 20})
			s.addMood("amoureux", name)
			_, _ = tx.Exec(ctx, `UPDATE bonds SET romance = LEAST(100, romance + 5), love_tended = now() WHERE sim_a = $1 AND sim_b = $2`, x, y)
			tell(fmt.Sprintf("%s a dit oui… Un moment rien qu'à vous deux. Un bébé est en route ❤", me))
			pushTo(fmt.Sprintf("%s a dit oui : un bébé est en route ❤", me))
			text := fmt.Sprintf("Un moment rien qu'à vous deux… Bonne nouvelle : un bébé est en route avec %s ! Il arrive dans %s de jeu.", name, humanDays(sp.Grossesse))
			return game.Outcome{Text: text}, []Event{{Kind: "life", Text: text, GameTime: now}}, nil
		}
		switch req.Action {
		case "demander":
			if err := check(); err != nil {
				return game.Outcome{}, nil, err
			}
			if theyAsked {
				return yes()
			}
			if iAsked {
				return game.Outcome{}, nil, errLoveAsked
			}
			if _, err := tx.Exec(ctx, `INSERT INTO love_requests (from_sim, to_sim, kind) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, s.ID, other, req.Kind); err != nil {
				return game.Outcome{}, nil, err
			}
			ask, text := fmt.Sprintf("%s veut officialiser votre couple ❤ Réponds dans « Ma famille ».", me), fmt.Sprintf("Tu demandes à %s d'officialiser votre couple. Réponse dans « Ma famille ».", name)
			if req.Kind == "bebe" {
				ask, text = fmt.Sprintf("%s aimerait avoir un bébé avec toi ❤ Réponds dans « Ma famille ».", me), fmt.Sprintf("Tu demandes à %s si vous faites un bébé. Réponse dans « Ma famille ».", name)
			}
			tell(ask)
			pushTo(ask)
			return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: now}}, nil
		case "accepter":
			if !theyAsked {
				return game.Outcome{}, nil, errNoRequest
			}
			return yes()
		case "refuser", "annuler":
			from, to := other, s.ID
			if req.Action == "annuler" {
				from, to = s.ID, other
			}
			tag, err := tx.Exec(ctx, `DELETE FROM love_requests WHERE from_sim = $1 AND to_sim = $2 AND kind = $3`, from, to, req.Kind)
			if err != nil {
				return game.Outcome{}, nil, err
			}
			if tag.RowsAffected() == 0 {
				return game.Outcome{}, nil, errNoRequest
			}
			if req.Action == "refuser" {
				tell(fmt.Sprintf("%s préfère attendre encore un peu. Ça viendra.", me))
				return game.Outcome{Text: fmt.Sprintf("Tu dis à %s : pas maintenant.", name)}, nil, nil
			}
			return game.Outcome{Text: "Demande retirée."}, nil, nil
		}
		return game.Outcome{}, nil, errors.New("réponse inconnue")
	})
	if ring != nil {
		ring()
	}
}

// takeShared: the passation's lock on a child of two players: the row held for this transaction, taken by
// this Sim if nobody did first (else errSharedTaken, nothing done).
func takeShared(ctx context.Context, tx pgx.Tx, s *Sim, id int64) error {
	var taken *string
	if err := tx.QueryRow(ctx, `SELECT taken_by::text FROM couple_kids WHERE id = $1 AND (sim_a = $2 OR sim_b = $2) FOR UPDATE`, id, s.ID).Scan(&taken); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errNoKid
		}
		return err
	}
	if taken != nil {
		return errSharedTaken
	}
	_, err := tx.Exec(ctx, `UPDATE couple_kids SET taken_by = $2, kid = kid || jsonb_build_object('from', $3::text) WHERE id = $1`, id, s.ID, s.FirstName)
	return err
}

/* ---------- The childhood friend's child ---------- */

// filleulSeed: the childhood friend's child of a generation, the same on every ask.
func filleulSeed(id, friend string, gen int) uint64 {
	h := fnv.New64a()
	h.Write([]byte(id + ":filleul:" + friend + ":" + strconv.Itoa(gen)))
	return h.Sum64()
}

// filleuls: the children of the Sim's childhood friends close enough (friendship 60 or more) to take over.
func (s *Sim) filleuls(gen int) []HeirOption {
	var out []HeirOption
	for _, fr := range s.Friends {
		if !fr.Childhood || fr.Enemy || fr.Friendship < game.FilleulFriendship {
			continue
		}
		seed := filleulSeed(s.ID, fr.ID, gen)
		name, gender := game.FilleulName(seed)
		out = append(out, HeirOption{ID: "filleul:" + fr.ID, Kind: game.HeirFilleul, Label: game.HeirKindLabel(game.HeirFilleul, gender), Name: name, Gender: gender, Seed: int(seed % (1 << 30)), Years: game.AdultAge, Share: game.FilleulShare, Parent: fr.Name, ParentLook: fr.Look})
	}
	return out
}

/* ---------- Tontons among players ---------- */

// tontonBonds: at a passation, no couple of players and no romance come down to the heir, and the parent's
// friends who are players are its tontons and tatas now (the heir no longer anybody's: a new person). One
// statement: a row updated twice in a transaction re-checks its keys, which would wait on the other
// player's row (and two players handing down at once would deadlock).
func tontonBonds(ctx context.Context, tx pgx.Tx, sim string) error {
	// (tonton_a: sim_a is a tonton to sim_b; tonton_b the other way.)
	_, err := tx.Exec(ctx, `UPDATE bonds SET couple = false, romance = 0, tonton_a = CASE WHEN sim_a = $1 THEN false ELSE friends END,
		tonton_b = CASE WHEN sim_b = $1 THEN false ELSE friends END WHERE sim_a = $1 OR sim_b = $1`, sim)
	return err
}

// tontons: the players of a list who are tontons or tatas to the Sim (« tonton » | « tata »), marked.
func (h *Handler) tontons(ctx context.Context, me string, list []Player) {
	if len(list) == 0 || !heritageOpen(ctx) {
		return
	}
	rows, err := h.DB.Query(ctx, `SELECT CASE WHEN sim_a = $1 THEN sim_b ELSE sim_a END FROM bonds WHERE (sim_a = $1 AND tonton_b) OR (sim_b = $1 AND tonton_a)`, me)
	if err != nil {
		return
	}
	is := map[string]bool{}
	for rows.Next() {
		var o string
		if rows.Scan(&o) == nil {
			is[o] = true
		}
	}
	rows.Close()
	for i := range list {
		if is[list[i].ID] {
			list[i].Tonton = "tonton"
			if list[i].Gender == "femme" {
				list[i].Tonton = "tata"
			}
		}
	}
}

/* ---------- The elders in the world ---------- */

// ancienPrefix: an elder's id in the grin, « ancien-<simId> ».
const ancienPrefix = "ancien-"

// ElderGrinEvery: a commune's grin hears an elder at most once in this, with ElderGrinChance in a hundred.
const (
	ElderGrinEvery  = 40 * time.Minute
	ElderGrinChance = 40
)

// worldElders: the elders of a family still about (not gone to the village), as stored.
func worldElders(raw []byte) []Elder {
	var all []Elder
	_ = json.Unmarshal(raw, &all)
	out := all[:0]
	for _, e := range all {
		if !e.Village {
			out = append(out, e)
		}
	}
	return out
}

// elderGrin: on a read of a commune's room, an elder of a family living there says something wise now and
// then (once per ElderGrinEvery at most, 8h to 21h): written at once, keyed so it's written once.
func (h *Handler) elderGrin(ctx context.Context, room string, now time.Time) {
	if room == "babi" || !heritageOpen(ctx) {
		return
	}
	hour := game.HourOf(game.MinuteOf(now))
	if hour < 8 || hour >= 21 {
		return
	}
	slot := now.Unix() / int64(ElderGrinEvery/time.Second)
	seed := pnjMix("ancien", room, strconv.FormatInt(slot, 10))
	if seed%100 >= ElderGrinChance {
		return
	}
	key := fmt.Sprintf("ancien:%s:%d", room, slot)
	var done bool
	if h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM grin WHERE pnj_key = $1)`, key).Scan(&done) != nil || done {
		return
	}
	rows, err := h.DB.Query(ctx, `SELECT s.id, s.life->'famille'->'elders' FROM sims s JOIN users u ON u.id = s.user_id
		WHERE s.home_commune = $1 AND s.generation > 1 AND jsonb_typeof(s.life->'famille'->'elders') = 'array' AND NOT u.tester
		ORDER BY md5(s.id::text || $2) LIMIT 5`, room, key)
	if err != nil {
		return
	}
	var sim string
	var who Elder
	for rows.Next() && sim == "" {
		var id string
		var raw []byte
		if rows.Scan(&id, &raw) == nil {
			if es := worldElders(raw); len(es) > 0 {
				sim, who = id, es[0]
			}
		}
	}
	rows.Close()
	if sim == "" {
		return
	}
	body := game.ElderGrinWords[(seed/100)%uint64(len(game.ElderGrinWords))]
	_, _ = h.DB.Exec(ctx, `INSERT INTO grin (room, pnj, pnj_name, body, pnj_key) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (pnj_key) DO NOTHING`, room, ancienPrefix+sim, who.Name, body, key)
}

// elderOfGrin: the face and the family of an elder who spoke in the grin (« ancien-<simId> », their name).
func elderOfGrin(ctx context.Context, q rowQuerier, id, name string) (Elder, string, bool) {
	sim, ok := strings.CutPrefix(id, ancienPrefix)
	if !ok || !reUUID.MatchString(sim) {
		return Elder{}, "", false
	}
	var raw []byte
	var family string
	if q.QueryRow(ctx, `SELECT COALESCE(life->'famille'->'elders', '[]'), last_name FROM sims WHERE id = $1`, sim).Scan(&raw, &family) != nil {
		return Elder{}, "", false
	}
	for _, e := range worldElders(raw) {
		if e.Name == name {
			return e, family, true
		}
	}
	return Elder{}, family, false
}

// elderPublic: an elder as the world shows them (the face, the name), never their pot.
type elderPublic struct {
	ID     string          `json:"id"`
	Name   string          `json:"name"`
	Gender string          `json:"gender"`
	Kin    string          `json:"kin"`
	Look   json.RawMessage `json:"look,omitempty"`
	Seed   int             `json:"seed,omitempty"`
	Stage  string          `json:"stage,omitempty"`
	Years  int             `json:"years,omitempty"`
}

// publicElders: a family's elders still about, for the quartier and the soirées (`most` at most).
func publicElders(raw []byte, most int) []elderPublic {
	out := []elderPublic{}
	for _, e := range worldElders(raw) {
		if len(out) >= most {
			break
		}
		out = append(out, elderPublic{ID: e.ID, Name: e.Name, Gender: e.Gender, Kin: e.Kin, Look: e.Look, Seed: e.Seed, Stage: e.Stage, Years: e.Years})
	}
	return out
}

/* ---------- The passation told ---------- */

// outLine: a line for another player's journal (Sim.outbox), written after the save.
type outLine struct{ sim, kind, text string }

// flushOutbox: the lines for other players' journals, written once the Sim's own transaction is over.
func (h *Handler) flushOutbox(ctx context.Context, lines []outLine) {
	for _, l := range lines {
		_ = insertEvent(context.WithoutCancel(ctx), h.DB, l.sim, l.kind, l.text, 0, game.MinuteOf(time.Now()))
	}
}

// passationMoment: the passation in Babi Direct.
func passationMoment(s *Sim, old string, gen int) *directItem {
	return &directItem{Key: fmt.Sprintf("passation:%s:%d", s.ID, gen), Kind: "joueur", Emoji: "🔑", Sim: s.ID, Commune: s.HomeCommune,
		Body: fmt.Sprintf("Famille %s : %s passe la main à %s. %s commence !", s.LastName, old, s.FirstName, game.GenerationLabel(gen))}
}

// passationFriends: the family's friends who are players (to tell them), the ones blocked left out.
func passationFriends(ctx context.Context, tx pgx.Tx, sim string) []string {
	rows, err := tx.Query(ctx, `SELECT CASE WHEN b.sim_a = $1 THEN b.sim_b ELSE b.sim_a END FROM bonds b
		WHERE (b.sim_a = $1 OR b.sim_b = $1) AND b.friends
		AND NOT EXISTS (SELECT 1 FROM blocks k WHERE (k.sim = b.sim_a AND k.blocked = b.sim_b) OR (k.sim = b.sim_b AND k.blocked = b.sim_a)) LIMIT 100`, sim)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			out = append(out, id)
		}
	}
	return out
}

// tellPassation: the family's friends told on their phone (their journal: the outbox).
func (h *Handler) tellPassation(friends []string, last, old, heir string, gen int) {
	if h.Push == nil {
		return
	}
	for _, id := range friends {
		h.Push.ToSim(id, push.Message{Title: "Babi Life · " + game.GenerationLabel(gen), Body: fmt.Sprintf("Famille %s : %s passe la main à %s.", last, old, heir), URL: "/jeu", Tag: "passation-" + id})
	}
}
