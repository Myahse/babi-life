package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
)

// La vie amoureuse (the update « vie-amoureuse », game/amour.go; web screens/CoeurApp.tsx,
// components/amour/RendezVous.tsx). « Mon cœur »: the partner (a player one is together with, else
// the one met in the game), how long together, the love as it reads now (game.LoveNow: never written
// by the clock), the next anniversary, the mots doux and the câlin, the dates played. Nothing runs by
// itself: a partner's stage, love language and « Bonjour mon cœur » are brought up to date when the
// Sim is read (loveSync, amourView). Adults only: the Sim grown up and the account 18 or over. While
// the update is shut, the routes refuse and the Sim is as before.

// amourOpen: the update is open with the players.
func amourOpen(ctx context.Context) bool {
	return features.Default == nil || features.Default.BlocksKey(ctx, game.AmourKey) == ""
}

// Amour: what la vie amoureuse keeps of a Sim (in its Life).
type Amour struct {
	// Hello: the day (2006-01-02) the partner last said « Bonjour mon cœur ».
	Hello string `json:"hello,omitempty"`
	// MotDay, Mots: the mots doux sent that day.
	MotDay string `json:"motDay,omitempty"`
	Mots   int    `json:"mots,omitempty"`
	// Calin: the last câlin at home (unix seconds).
	Calin int64 `json:"calin,omitempty"`
	// Dates: the last dates, the latest first.
	Dates []DateMemo `json:"dates,omitempty"`
	// Bag: the gifts bought, to give (phase 2).
	Bag []string `json:"bag,omitempty"`
}

// DateMemo: a date remembered: where, how it went, the selfie's seed and words.
type DateMemo struct {
	Kind  string `json:"kind"`
	Place string `json:"place"`
	With  string `json:"with"`
	Title string `json:"title"`
	Score int    `json:"score"`
	Love  int    `json:"love"`
	Seed  int64  `json:"seed"`
	At    int64  `json:"at"`
}

var (
	errAmourAdults  = errors.New("la vie amoureuse, c'est entre adultes : ton perso et ton compte (18 ans et plus)")
	errAmourNone    = errors.New("tu n'es avec personne pour l'instant")
	errMotUnknown   = errors.New("ce mot doux n'existe pas")
	errMotsDay      = errors.New("six mots doux aujourd'hui, c'est déjà beaucoup d'amour : demain encore !")
	errCalinWhere   = errors.New("un câlin, c'est à la maison, quand ta moitié vit avec toi")
	errCalinSoon    = errors.New("vous venez de vous faire un câlin : dans un moment encore")
	errRdvWith      = errors.New("un rendez-vous, c'est à deux : choisis-le avec ta moitié (appli « Mon cœur »)")
	errRdvPartner   = errors.New("un rendez-vous en amoureux se prend avec ta moitié, seulement elle ou lui")
	errRdvNotPlayed = errors.New("pas de rendez-vous en cours")
	errRdvPlayer    = errors.New("les rendez-vous entre joueurs arrivent bientôt : pour l'instant, écris-lui un mot doux")
)

// today: the day in Abidjan (UTC), as the bonjour and the mots doux count it.
func today(now time.Time) string { return now.UTC().Format("2006-01-02") }

func unixTime(s int64) time.Time {
	if s == 0 {
		return time.Time{}
	}
	return time.Unix(s, 0)
}

// loveSync: the partner met in the game brought up to date: together (from before the update too)
// means « ensemble », since now; what touches them is drawn once; no longer together, it's cleared.
func (s *Sim) loveSync(now time.Time) {
	for i := range s.Friends {
		f := &s.Friends[i]
		switch {
		case f.Partner && f.Stage == "":
			f.Stage, f.LoveSince, f.LoveTended = game.LoveEnsemble, now.Unix(), now.Unix()
			f.Romance = max(f.Romance, 60)
		case !f.Partner && f.Stage != "":
			f.Stage, f.LoveSince, f.LoveTended, f.AnnivSeen = "", 0, 0, 0
		}
		if f.Partner && f.Lang == "" {
			f.Lang = game.LangOf(f.ID)
		}
	}
}

// loveMissed: the partner met in the game left untended long enough to miss each other (the moodlet « manque », vie.go).
func (s *Sim) loveMissed(now time.Time) bool {
	p := s.partner()
	return p != nil && game.Missing(unixTime(p.LoveTended), now)
}

// tendNPC: the partner met in the game cared for: the love up (to 100), tended now.
func tendNPC(p *game.Friend, love int, now time.Time) {
	p.Romance = game.Clamp100(max(p.Romance, game.LoveNow(p.Romance, unixTime(p.LoveTended), now, true)) + love)
	p.LoveTended = now.Unix()
	p.Friendship = min(100, p.Friendship+love/2)
}

// amourAdults: the Sim grown up and the account 18 or over.
func amourAdults(ctx context.Context, tx pgx.Tx, s *Sim) error {
	if s.stage().ID != game.StageAdulte {
		return errAmourAdults
	}
	if adult, err := accountAdult(ctx, tx); err != nil || !adult {
		return errAmourAdults
	}
	return nil
}

// AmourPartner: who one is with, as « Mon cœur » shows them.
type AmourPartner struct {
	Kind       string          `json:"kind"` // joueur | pnj
	ID         string          `json:"id"`
	Name       string          `json:"name"`
	Gender     string          `json:"gender"`
	Seed       int             `json:"seed,omitempty"`
	Look       json.RawMessage `json:"look,omitempty"`
	Stage      string          `json:"stage"`
	StageLabel string          `json:"stageLabel"`
	Love       int             `json:"love"`
	Since      int64           `json:"since"`
	Days       int             `json:"days"`
	Foyer      bool            `json:"foyer,omitempty"`
	Lang       string          `json:"lang,omitempty"`
	LangLabel  string          `json:"langLabel,omitempty"`
}

// PartnerMessage: a line of the thread with a partner met in the game.
type PartnerMessage struct {
	ID   int64     `json:"id"`
	Mine bool      `json:"mine"`
	Body string    `json:"body"`
	At   time.Time `json:"at"`
}

// AmourView: « Mon cœur ».
type AmourView struct {
	Partner *AmourPartner    `json:"partner"`
	Next    *AmourNext       `json:"next,omitempty"`
	Dates   []DateMemo       `json:"dates"`
	Hello   string           `json:"hello,omitempty"`
	Thread  []PartnerMessage `json:"thread"`
	Mots    int              `json:"mots"`
	MotsMax int              `json:"motsMax"`
	// Calin: a câlin can be had now (at home, the partner living there, not just had); else why not.
	Calin    bool   `json:"calin"`
	CalinWhy string `json:"calinWhy,omitempty"`
	// Requests: couple requests from players waiting for an answer (in Amis).
	Requests int `json:"requests"`
}

// AmourNext: the next anniversary.
type AmourNext struct {
	Label string `json:"label"`
	At    int64  `json:"at"`
	Days  int    `json:"days"`
}

// playerCouple: the player one is together with, and the couple's love fields.
type playerCouple struct {
	id, name, gender string
	look             json.RawMessage
	romance          int
	since, tended    time.Time
	stage            string
	annivSeen        int
}

func readPlayerCouple(ctx context.Context, tx pgx.Tx, me string) (*playerCouple, error) {
	other := inCouple(ctx, tx, me)
	if other == "" {
		return nil, nil
	}
	x, y := pair(me, other)
	c := playerCouple{id: other}
	var since, tended *time.Time
	var look []byte
	if err := tx.QueryRow(ctx, `SELECT b.romance, b.love_since, b.love_tended, b.love_stage, b.anniv_seen, o.first_name, o.gender, o.look
		FROM bonds b, sims o WHERE b.sim_a = $1 AND b.sim_b = $2 AND o.id = $3`, x, y, other).Scan(&c.romance, &since, &tended, &c.stage, &c.annivSeen, &c.name, &c.gender, &look); err != nil {
		return nil, err
	}
	c.look = look
	if since != nil {
		c.since = *since
	}
	if tended != nil {
		c.tended = *tended
	}
	if c.stage == "" {
		c.stage = game.LoveEnsemble
	}
	return &c, nil
}

// amourView: « Mon cœur » as it is now. Writes only what's due: the partner's « Bonjour mon cœur » (once a
// day), an anniversary come (once each). The love's fading is read, never written.
func (s *Sim) amourView(ctx context.Context, tx pgx.Tx, now time.Time) (AmourView, []Event, error) {
	if s.Life.Amour == nil {
		s.Life.Amour = &Amour{}
	}
	am := s.Life.Amour
	v := AmourView{Dates: am.Dates, Thread: []PartnerMessage{}, MotsMax: game.MotsPerDay}
	if v.Dates == nil {
		v.Dates = []DateMemo{}
	}
	if am.MotDay == today(now) {
		v.Mots = am.Mots
	}
	_ = tx.QueryRow(ctx, `SELECT count(*) FROM couple_requests WHERE to_sim = $1`, s.ID).Scan(&v.Requests)
	var events []Event
	say := func(text string) {
		events = append(events, Event{Kind: "social", Text: text, GameTime: s.GameMinutes})
	}
	var since time.Time
	var seen int
	pc, err := readPlayerCouple(ctx, tx, s.ID)
	if err != nil {
		return v, nil, err
	}
	if pc != nil {
		since, seen = pc.since, pc.annivSeen
		v.Partner = &AmourPartner{Kind: "joueur", ID: pc.id, Name: pc.name, Gender: pc.gender, Look: pc.look, Stage: pc.stage, StageLabel: game.LoveStageLabel(pc.stage),
			Love: game.LoveNow(pc.romance, pc.tended, now, true), Since: pc.since.Unix(), Days: game.LoveDays(pc.since, now)}
		if i, newSeen, ok := game.AnnivDue(pc.since, pc.annivSeen, now); ok {
			x, y := pair(s.ID, pc.id)
			if _, err := tx.Exec(ctx, `UPDATE bonds SET anniv_seen = GREATEST(anniv_seen, $3) WHERE sim_a = $1 AND sim_b = $2`, x, y, newSeen); err != nil {
				return v, nil, err
			}
			seen = newSeen
			s.addMood("anniversaire-couple", "")
			say(fmt.Sprintf("Joyeux anniversaire : %s avec %s ❤", game.Annivs[i].Label, pc.name))
		}
	} else if p := s.partner(); p != nil {
		s.loveSync(now)
		since, seen = unixTime(p.LoveSince), p.AnnivSeen
		v.Partner = &AmourPartner{Kind: "pnj", ID: p.ID, Name: p.Name, Gender: p.Gender, Seed: p.Seed, Look: p.Look, Stage: p.Stage, StageLabel: game.LoveStageLabel(p.Stage),
			Love: game.LoveNow(p.Romance, unixTime(p.LoveTended), now, true), Since: p.LoveSince, Days: game.LoveDays(since, now), Foyer: p.Home, Lang: p.Lang, LangLabel: game.LangLabel[p.Lang]}
		if i, newSeen, ok := game.AnnivDue(since, p.AnnivSeen, now); ok {
			p.AnnivSeen, seen = newSeen, newSeen
			s.addMood("anniversaire-couple", "")
			tendNPC(p, 5, now)
			say(fmt.Sprintf("Joyeux anniversaire : %s avec %s ❤", game.Annivs[i].Label, p.Name))
		}
		// The morning's « Bonjour mon cœur », once a day, the first time the Sim is seen that day.
		if am.Hello != today(now) {
			am.Hello = today(now)
			line := strings.ReplaceAll(game.Hellos[int(now.Unix()/86400+int64(p.Seed))%len(game.Hellos)], "{toi}", s.FirstName)
			if _, err := tx.Exec(ctx, `INSERT INTO partner_messages (sim_id, friend, mine, body) VALUES ($1, $2, false, $3)`, s.ID, p.ID, line); err != nil {
				return v, nil, err
			}
			v.Hello = line
		}
		thread, err := partnerThread(ctx, tx, s.ID, p.ID)
		if err != nil {
			return v, nil, err
		}
		v.Thread = thread
		switch {
		case !p.Home:
			v.CalinWhy = fmt.Sprintf("À la maison, quand %s vivra avec toi", p.Name)
		case !s.inHouse():
			v.CalinWhy = "Rentre à la maison pour un câlin"
		case now.Unix()-am.Calin < 3600:
			v.CalinWhy = "Vous venez de vous faire un câlin"
		default:
			v.Calin = true
		}
	}
	if v.Partner != nil && pc != nil {
		v.CalinWhy = "Les câlins entre joueurs arrivent bientôt"
	}
	if label, at, ok := game.NextAnniv(since, seen, now); ok && v.Partner != nil {
		v.Next = &AmourNext{Label: label, At: at.Unix(), Days: int(at.Sub(now).Hours()/24) + 1}
	}
	return v, events, nil
}

// inHouse: in its own house (famille.go atHome), not busy out.
func (s *Sim) inHouse() bool {
	return s.atHome() && (s.Activity == nil || s.Activity.PlaceID == HomePlaceID)
}

// partnerThread: the last lines with a partner met in the game, the oldest first.
func partnerThread(ctx context.Context, tx pgx.Tx, sim, friend string) ([]PartnerMessage, error) {
	rows, err := tx.Query(ctx, `SELECT id, mine, body, created_at FROM (SELECT id, mine, body, created_at FROM partner_messages WHERE sim_id = $1 AND friend = $2 ORDER BY id DESC LIMIT 40) t ORDER BY id`, sim, friend)
	if err != nil {
		return nil, err
	}
	out, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (PartnerMessage, error) {
		var m PartnerMessage
		err := row.Scan(&m.ID, &m.Mine, &m.Body, &m.At)
		return m, err
	})
	if out == nil {
		out = []PartnerMessage{}
	}
	return out, err
}

// amourGate: the update open (else « bientôt »), for the routes.
func amourGate(w http.ResponseWriter, r *http.Request) bool {
	if !amourOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return false
	}
	return true
}

// amour: GET « Mon cœur » (written: the bonjour of the day, an anniversary come).
func (h *Handler) amour(w http.ResponseWriter, r *http.Request) {
	if !amourGate(w, r) {
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := amourAdults(ctx, tx, s); err != nil {
			return game.Outcome{}, nil, err
		}
		v, events, err := s.amourView(ctx, tx, time.Now())
		if err != nil {
			return game.Outcome{}, nil, err
		}
		s.reply = v
		return game.Outcome{}, events, nil
	})
}

// amourMessages: GET the thread with the partner met in the game.
func (h *Handler) amourMessages(w http.ResponseWriter, r *http.Request) {
	if !amourGate(w, r) {
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := amourAdults(ctx, tx, s); err != nil {
			return game.Outcome{}, nil, err
		}
		p := s.partner()
		if p == nil {
			return game.Outcome{}, nil, errAmourNone
		}
		thread, err := partnerThread(ctx, tx, s.ID, p.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		_, _ = tx.Exec(ctx, `UPDATE partner_messages SET read_at = now() WHERE sim_id = $1 AND friend = $2 AND read_at IS NULL`, s.ID, p.ID)
		s.reply = thread
		return game.Outcome{}, nil, nil
	})
}

// amourMot: POST {id, to?}: a mot doux to one's partner (an id: nothing typed travels). A player gets it in
// Gbairai as a card ([amour:id]); the one met in the game answers in « Mon cœur ». Six a day.
func (h *Handler) amourMot(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID string `json:"id"`
		To string `json:"to"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if !amourGate(w, r) {
		return
	}
	ctx := r.Context()
	var ring func()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := amourAdults(ctx, tx, s); err != nil {
			return game.Outcome{}, nil, err
		}
		mot, ok := game.FindMot(req.ID)
		if !ok {
			return game.Outcome{}, nil, errMotUnknown
		}
		if s.Life.Amour == nil {
			s.Life.Amour = &Amour{}
		}
		am := s.Life.Amour
		now := time.Now()
		if am.MotDay != today(now) {
			am.MotDay, am.Mots = today(now), 0
		}
		if am.Mots >= game.MotsPerDay {
			return game.Outcome{}, nil, errMotsDay
		}
		var text string
		if other := inCouple(ctx, tx, s.ID); other != "" {
			if req.To != "" && req.To != other {
				return game.Outcome{}, nil, errAmourNone
			}
			if err := canWrite(ctx, tx, s.ID, other); err != nil {
				return game.Outcome{}, nil, err
			}
			body := "[amour:" + mot.ID + "]"
			if _, err := sendMessage(ctx, tx, s.ID, other, body, nil); err != nil {
				return game.Outcome{}, nil, err
			}
			// Tended for both: the couple's row is theirs.
			x, y := pair(s.ID, other)
			if _, err := tx.Exec(ctx, `UPDATE bonds SET romance = LEAST(100, romance + 2), love_tended = now() WHERE sim_a = $1 AND sim_b = $2`, x, y); err != nil {
				return game.Outcome{}, nil, err
			}
			var name string
			_ = tx.QueryRow(ctx, `SELECT first_name FROM sims WHERE id = $1`, other).Scan(&name)
			text = fmt.Sprintf("Mot doux envoyé à %s : « %s »", name, mot.Text)
			me, preview := s.FirstName, "t'envoie un mot doux ❤"
			ring = func() {
				h.Push.ToSim(other, push.Message{Title: me + " · Gbairai", Body: preview, URL: "/jeu?app=gbairai", Tag: "gbairai-" + s.ID})
				if h.Ring != nil && features.Default.BlocksKey(ctx, "sonnerie-gbairai") == "" {
					h.Ring(other, s.ID, me, preview, true)
				}
			}
		} else {
			p := s.partner()
			if p == nil || (req.To != "" && req.To != p.ID) {
				return game.Outcome{}, nil, errAmourNone
			}
			reply := game.MotReplies[(am.Mots+int(now.Unix()/60))%len(game.MotReplies)]
			if _, err := tx.Exec(ctx, `INSERT INTO partner_messages (sim_id, friend, mine, body) VALUES ($1, $2, true, $3), ($1, $2, false, $4)`, s.ID, p.ID, "[amour:"+mot.ID+"]", reply); err != nil {
				return game.Outcome{}, nil, err
			}
			tendNPC(p, 2, now)
			s.addMood("mot-doux", p.Name)
			text = fmt.Sprintf("%s te répond : « %s »", p.Name, reply)
		}
		am.Mots++
		s.Needs = s.Needs.Add(game.Needs{Social: 4})
		v, events, err := s.amourView(ctx, tx, now)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		s.reply = v
		return game.Outcome{Text: text}, events, nil
	})
	if ring != nil {
		ring()
	}
}

// amourCalin: POST: a câlin at home with the partner living there (once an hour).
func (h *Handler) amourCalin(w http.ResponseWriter, r *http.Request) {
	if !amourGate(w, r) {
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := amourAdults(ctx, tx, s); err != nil {
			return game.Outcome{}, nil, err
		}
		p := s.partner()
		if p == nil || !p.Home || !s.inHouse() || inCouple(ctx, tx, s.ID) != "" {
			return game.Outcome{}, nil, errCalinWhere
		}
		if s.Life.Amour == nil {
			s.Life.Amour = &Amour{}
		}
		now := time.Now()
		if now.Unix()-s.Life.Amour.Calin < 3600 {
			return game.Outcome{}, nil, errCalinSoon
		}
		s.Life.Amour.Calin = now.Unix()
		tendNPC(p, 3, now)
		s.Needs = s.Needs.Add(game.Needs{Social: 10, Fun: 5})
		s.addMood("bon-moment", p.Name)
		v, events, err := s.amourView(ctx, tx, now)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		s.reply = v
		return game.Outcome{Text: fmt.Sprintf("Un gros câlin avec %s ❤", p.Name)}, events, nil
	})
}

// rdvGo: an outing that is a date (outing.go): only with one's partner met in the game, adults only.
func rdvGo(ctx context.Context, tx pgx.Tx, s *Sim, interactionID string, friends, players []string) error {
	if !game.IsRdv(interactionID) {
		return nil
	}
	if !amourOpen(ctx) {
		return errors.New("bientôt dans le jeu")
	}
	if err := amourAdults(ctx, tx, s); err != nil {
		return err
	}
	if len(players) > 0 {
		return errRdvPlayer
	}
	p := s.partner()
	if p == nil {
		if inCouple(ctx, tx, s.ID) != "" {
			return errRdvPlayer
		}
		return errAmourNone
	}
	if len(friends) != 1 || friends[0] != p.ID {
		return errRdvPartner
	}
	return nil
}

// amourRdv: POST {choices}: the date being had played to its end. The answers are scored here
// (game.ScoreDate: never the phone's score); the love goes up by what they bring (3..12), the date
// is remembered, and it's over there and then.
func (h *Handler) amourRdv(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Choices []string `json:"choices"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if !amourGate(w, r) {
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := amourAdults(ctx, tx, s); err != nil {
			return game.Outcome{}, nil, err
		}
		a := s.Activity
		p := s.partner()
		if a == nil || a.Kind != "do" || !game.IsRdv(a.Interaction.ID) || a.Defi > 0 || p == nil || !slices.Contains(a.With, p.ID) {
			return game.Outcome{}, nil, errRdvNotPlayed
		}
		gift := s.Life.Amour != nil && len(s.Life.Amour.Bag) > 0
		sc, err := game.ScoreDate(a.Interaction.ID, req.Choices, p.Lang, gift)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		now := time.Now()
		a.Defi = sc.Score
		tendNPC(p, sc.Love, now)
		s.addMood("rendez-vous", p.Name)
		if s.Life.Amour == nil {
			s.Life.Amour = &Amour{}
		}
		k := game.DateKinds[a.Interaction.ID]
		memo := DateMemo{Kind: k.ID, Place: a.PlaceName, With: p.Name, Title: k.Title, Score: sc.Score, Love: sc.Love, Seed: a.Start, At: now.Unix()}
		s.Life.Amour.Dates = append([]DateMemo{memo}, s.Life.Amour.Dates...)
		if len(s.Life.Amour.Dates) > game.MaxDateMemos {
			s.Life.Amour.Dates = s.Life.Amour.Dates[:game.MaxDateMemos]
		}
		// Played: all its good at once (played well, all of it), and over now.
		s.Needs = homeDone(s.Needs, a, sc.Score)
		a.End = s.GameMinutes
		events := s.advanceTo(s.GameMinutes, newRand())
		s.reply = sc
		var text string
		switch {
		case sc.Love >= 10:
			text = fmt.Sprintf("Quelle soirée avec %s ! Vous êtes sur un petit nuage (+%d d'amour).", p.Name, sc.Love)
		case sc.Love >= 6:
			text = fmt.Sprintf("Un beau moment avec %s (+%d d'amour).", p.Name, sc.Love)
		default:
			text = fmt.Sprintf("Un rendez-vous un peu maladroit avec %s, mais vous étiez ensemble (+%d d'amour).", p.Name, sc.Love)
		}
		return game.Outcome{Text: text}, events, nil
	})
}

// loveEnd: a block or a report between two players (gbairai.go): with the update open, their couple
// ends there and then, and every request between them goes. Safety first: nothing is asked of either.
func loveEnd(ctx context.Context, q execer, me, other string) {
	if !amourOpen(ctx) {
		return
	}
	x, y := pair(me, other)
	_, _ = q.Exec(ctx, `UPDATE bonds SET couple = false, love_stage = '', love_since = NULL, love_tended = NULL, anniv_seen = 0, shared_home = NULL, romance = LEAST(romance, 20) WHERE sim_a = $1 AND sim_b = $2 AND (couple OR love_stage <> '')`, x, y)
	_, _ = q.Exec(ctx, `DELETE FROM couple_requests WHERE (from_sim = $1 AND to_sim = $2) OR (from_sim = $2 AND to_sim = $1)`, me, other)
	_, _ = q.Exec(ctx, `DELETE FROM love_requests WHERE (from_sim = $1 AND to_sim = $2) OR (from_sim = $2 AND to_sim = $1)`, me, other)
}
