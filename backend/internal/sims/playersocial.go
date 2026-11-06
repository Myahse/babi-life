package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Le mode vie with the other players (the update « mode-vie », web components/LifeHome.tsx playerPie): a
// player's Sim tapped in the street or in a place opens the wheel of what can be said or done with them,
// from what they are to each other (the bonds row they share: its friendship and romance gauges, fallen
// out or not, friends, together). The server decides what's offered (playerSocials) and what comes of
// it (playerSocial): the gauges move for both (one row), both feel it (their social need, a mood), and
// the other is told (a line in their journal, the toast on their screen). Romance follows the couple's
// rules (couple.go): between friends, both Sims grown up and both accounts 18 or over, never with
// someone already with another player, and a blocked player gets nothing. Being together is still asked
// and answered (« sortir »: couple.go's request). Said, never shown.

var (
	errBlockedPlayer = errors.New("pas possible avec cette personne")
	errTooSoon       = errors.New("laisse-lui un peu de temps avant de recommencer")
	errNoSocial      = errors.New("pas possible pour le moment")
	errWhatTopic     = errors.New("on ne peut pas dire ça ici")
)

// playerTopics: what the wheel may offer a player, in its order (« sortir » goes through couple.go).
var playerTopics = []string{"salut", "blague", "compliment", "gbairai", "chambrer", "confier", "calin", "drague", "embrasser", "sortir", "excuser", "disputer"}

// romantic: the topics that are romance (the couple's rules).
var romanceTopic = map[string]bool{"drague": true, "embrasser": true, "sortir": true}

// playerBond: what two players are to each other, and what the romance rules allow.
type playerBond struct {
	Name       string `json:"name"`
	Friendship int    `json:"friendship"`
	Romance    int    `json:"romance"`
	Enemy      bool   `json:"enemy,omitempty"`
	Friends    bool   `json:"friends,omitempty"`
	Couple     bool   `json:"couple,omitempty"`
	Known      bool   `json:"known,omitempty"`
	// Adults: both Sims grown up and both accounts 18 or over; Taken: one of them together with someone else.
	Adults  bool   `json:"-"`
	Taken   bool   `json:"-"`
	Blocked bool   `json:"-"`
	Status  string `json:"status"`
}

func readBond(ctx context.Context, tx pgx.Tx, me, other string) (playerBond, error) {
	var b playerBond
	x, y := pair(me, other)
	err := tx.QueryRow(ctx, `
		SELECT o.first_name, COALESCE(b.friendship, 0), COALESCE(b.romance, 0), COALESCE(b.enemy, false), COALESCE(b.friends, false), COALESCE(b.couple, false), b.sim_a IS NOT NULL,
		       EXISTS(SELECT 1 FROM blocks WHERE (sim = $3 AND blocked = $4) OR (sim = $4 AND blocked = $3))
		FROM sims o LEFT JOIN bonds b ON b.sim_a = $1 AND b.sim_b = $2
		WHERE o.id = $4`, x, y, me, other).Scan(&b.Name, &b.Friendship, &b.Romance, &b.Enemy, &b.Friends, &b.Couple, &b.Known, &b.Blocked)
	if err != nil {
		return b, errNotFound
	}
	b.Adults = grownUp(ctx, tx, me) && grownUp(ctx, tx, other)
	if !b.Couple {
		b.Taken = inCouple(ctx, tx, me) != "" || inCouple(ctx, tx, other) != ""
	}
	b.Status = game.RelStatus(b.Friendship, b.Romance, b.Enemy, b.Couple)
	return b, nil
}

// whyPlayer: why this can't be said to them now ("" if it can).
func whyPlayer(topic string, b playerBond) string {
	if b.Blocked {
		return errBlockedPlayer.Error()
	}
	x, ok := game.SocialOf(topic)
	if !ok {
		return errWhatTopic.Error()
	}
	if romanceTopic[topic] {
		switch {
		case !b.Adults:
			return "Entre adultes seulement"
		case !b.Friends:
			return errOnlyFriends.Error()
		case b.Taken:
			return errCoupleTaken.Error()
		case topic == "embrasser" && !b.Couple:
			return "Seulement entre amoureux"
		case topic == "sortir" && b.Couple:
			return errCoupleAlready.Error()
		}
	}
	if topic == "excuser" && !b.Enemy && b.Friendship >= 40 {
		return "Pas de quoi s'excuser"
	}
	return game.SocialWhy(x, b.Known, game.Rel{Friendship: b.Friendship, Romance: b.Romance, Enemy: b.Enemy}, b.Adults || !x.Adult)
}

// socialOption: one choice of the wheel.
type socialOption struct {
	Topic string `json:"topic"`
	Why   string `json:"why,omitempty"`
}

// playerSocials: GET /sims/{id}/joueurs/{other}/social — the wheel for that player: what you are to
// each other, and what can be said now.
func (h *Handler) playerSocials(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !lifeModeOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	s, err := scanSim(tx.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(ctx)))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	o, err := otherSim(ctx, tx, &s, chi.URLParam(r, "other"))
	if err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	b, err := readBond(ctx, tx, s.ID, o.ID)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	opts := []socialOption{}
	if !b.Blocked {
		for _, t := range playerTopics {
			opts = append(opts, socialOption{Topic: t, Why: whyPlayer(t, b)})
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"bond": b, "options": opts})
}

// socialPace: one thing said to the same player every so often (no spamming them).
var socialPace = struct {
	sync.Mutex
	at map[string]time.Time
}{at: map[string]time.Time{}}

const socialEvery = 12 * time.Second

func paced(a, b string, now time.Time) bool {
	x, y := pair(a, b)
	k := x + y
	socialPace.Lock()
	defer socialPace.Unlock()
	if t, ok := socialPace.at[k]; ok && now.Sub(t) < socialEvery {
		return false
	}
	if len(socialPace.at) > 5000 {
		clear(socialPace.at)
	}
	socialPace.at[k] = now
	return true
}

// socialGood: whether it goes well: likelier between friends and with charisme; a quarrel never does.
func socialGood(topic string, b playerBond, charisme int, roll float64) bool {
	if topic == "disputer" {
		return false
	}
	p := 0.62 + float64(b.Friendship)/250 + 0.03*float64(charisme-1)
	if romanceTopic[topic] {
		p = 0.45 + float64(b.Romance)/200 + 0.03*float64(charisme-1)
	}
	if b.Enemy && topic != "excuser" {
		p -= 0.3
	}
	return roll < min(0.95, p)
}

// toPlayer: the line the other player reads (their journal, their toast).
func toPlayer(topic, name string, good bool) string {
	lines := map[string][2]string{
		"salut":      {"%s t'a salué·e.", "%s t'a salué·e."},
		"blague":     {"%s t'a lancé une blague : vous avez bien ri.", "%s a tenté une blague… bof."},
		"compliment": {"%s t'a fait un compliment.", "%s t'a fait un compliment un peu maladroit."},
		"gbairai":    {"%s t'a raconté le dernier gbairai du quartier.", "%s t'a raconté un gbairai qui ne t'a pas plu."},
		"chambrer":   {"%s t'a chambré·e, gentiment.", "%s t'a chambré·e un peu trop fort."},
		"confier":    {"%s s'est confié·e à toi.", "%s a voulu se confier, mais le moment était mal choisi."},
		"calin":      {"%s t'a fait un câlin.", "%s a voulu te faire un câlin, un peu tôt."},
		"drague":     {"%s a flirté avec toi ❤", "%s a tenté de flirter avec toi."},
		"embrasser":  {"%s t'a embrassé·e ❤", "%s a voulu t'embrasser, le moment n'y était pas."},
		"excuser":    {"%s s'est excusé·e auprès de toi : c'est réglé.", "%s s'est excusé·e, sans te convaincre."},
		"disputer":   {"%s s'est disputé·e avec toi.", "%s s'est disputé·e avec toi."},
	}
	l := lines[topic]
	if good {
		return fmt.Sprintf(l[0], name)
	}
	return fmt.Sprintf(l[1], name)
}

// fromPlayer: what the player who said it reads.
func fromPlayer(topic, name string, good bool) string {
	if topic == "disputer" {
		return fmt.Sprintf("Tu t'es disputé·e avec %s.", name)
	}
	if good {
		return fmt.Sprintf("Ça s'est bien passé avec %s.", name)
	}
	return fmt.Sprintf("Avec %s, ce n'était pas le moment.", name)
}

// playerSocial: POST /sims/{id}/joueurs/{other}/social {topic} — said to them; both feel it.
func (h *Handler) playerSocial(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Topic string `json:"topic"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if !s.lifeOn {
			return game.Outcome{}, nil, errLifeClosed
		}
		// (Being together is asked through the couple's request.)
		if req.Topic == "sortir" || !slices.Contains(playerTopics, req.Topic) {
			return game.Outcome{}, nil, errWhatTopic
		}
		o, err := otherSim(ctx, tx, s, chi.URLParam(r, "other"))
		if err != nil {
			return game.Outcome{}, nil, err
		}
		b, err := readBond(ctx, tx, s.ID, o.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if why := whyPlayer(req.Topic, b); why != "" {
			return game.Outcome{}, nil, errors.New(why)
		}
		if !paced(s.ID, o.ID, time.Now()) {
			return game.Outcome{}, nil, errTooSoon
		}
		x, _ := game.SocialOf(req.Topic)
		good := socialGood(req.Topic, b, s.skillLevel("charisme"), newRand().Float64())
		rel := game.Rel{Friendship: b.Friendship, Romance: b.Romance, Enemy: b.Enemy}.Apply(x, good)
		// A word between strangers that went well: they've met (the bond is there).
		if !b.Known && rel.Friendship == 0 && good {
			rel.Friendship = 2
		}
		p, q := pair(s.ID, o.ID)
		if _, err := tx.Exec(ctx, `
			INSERT INTO bonds (sim_a, sim_b, friendship, romance, enemy) VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (sim_a, sim_b) DO UPDATE SET friendship = $3, romance = $4, enemy = $5, seen_at = now()`, p, q, rel.Friendship, rel.Romance, rel.Enemy); err != nil {
			return game.Outcome{}, nil, err
		}
		// Both feel it: their social need, a mood (the other's when they next play: Life.Hits).
		gain := 3.0
		if good {
			gain = 8
		}
		s.Needs = s.Needs.Add(game.Needs{Social: gain, Fun: gain / 2})
		if _, err := tx.Exec(ctx, `UPDATE sims SET needs = jsonb_set(needs, '{social}', to_jsonb(LEAST(100, COALESCE((needs->>'social')::float8, 0) + $2))) WHERE id = $1`, o.ID, gain); err != nil {
			return game.Outcome{}, nil, err
		}
		mood := ""
		switch {
		case req.Topic == "disputer":
			mood = "dispute"
			s.addMood("dispute", o.FirstName)
		case req.Topic == "excuser" && good:
			s.dropMood("dispute", o.FirstName)
		case romanceTopic[req.Topic] && good:
			mood = "amoureux"
			s.addMood("amoureux", o.FirstName)
		case romanceTopic[req.Topic]:
			s.addMood("rejete", o.FirstName)
		case good && rel.Friendship >= 40:
			mood = "bon-moment"
			s.addMood("bon-moment", o.FirstName)
		}
		if mood != "" {
			lifeHit(ctx, tx, o.ID, "mood:"+mood+":"+s.FirstName)
		}
		if good {
			s.wishGoal("player")
		}
		events := s.gainSkill("charisme", map[bool]int{true: 6, false: 3}[good])
		_ = insertEvent(ctx, tx, o.ID, "social-in", toPlayer(req.Topic, s.FirstName, good), 0, game.MinuteOf(time.Now()))
		text := fromPlayer(req.Topic, o.FirstName, good)
		return game.Outcome{Text: text, Mood: map[bool]string{true: "good", false: "bad"}[good]}, events, nil
	})
}
