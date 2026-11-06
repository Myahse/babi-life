package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
	"github.com/myahse/babi-life/backend/internal/world"
)

// An online game: the Sims of other players who are in the same commune show
// up in the street. A Sim can greet them, or invite them to join what it's
// doing; whoever accepts starts the same activity at the same place. Players
// only exchange these set gestures, never free text.

const (
	// OnlineWindow: a player counts as around if their Sim was played lately.
	OnlineWindow = 20 * time.Minute
	// InviteWindow: how long an invitation stays open.
	InviteWindow = 15 * time.Minute
	// Friendship gained by greeting, and by doing something together.
	GreetFriendship = 8
	JoinFriendship  = 15
)

var (
	errNotHere       = errors.New("cette personne n'est pas dans ta commune")
	errNotJoinable   = errors.New("fais d'abord une activité dans un lieu du quartier, puis invite")
	errHostDone      = errors.New("c'est trop tard : l'activité est finie ou a changé")
	errInviteGone    = errors.New("cette invitation n'est plus valable")
	errAlreadyAsked  = errors.New("tu l'as déjà invité·e, attends sa réponse")
	errJustGreeted   = errors.New("vous venez de vous saluer")
	errNotYourPlayer = errors.New("c'est ton propre perso")
)

// Player is what other players see of a Sim.
type Player struct {
	ID         string          `json:"id"`
	FirstName  string          `json:"firstName"`
	Username   string          `json:"username"`
	Gender     string          `json:"gender"`
	Look       Look            `json:"look"`
	Stage      string          `json:"stage"`
	Activity   *PlayerActivity `json:"activity,omitempty"`
	Friendship int             `json:"friendship"`
	// Where they are, for the friends list.
	City    string `json:"city,omitempty"`
	Commune string `json:"commune,omitempty"`
	Online  bool   `json:"online"`
	// Friends (asked and accepted), and a friend request between the two: "sent" | "received" | "".
	Friend  bool   `json:"friend"`
	Request string `json:"request,omitempty"`
	// Together (couple.go), and a couple request between the two: "sent" | "received" | "".
	Couple        bool   `json:"couple,omitempty"`
	CoupleRequest string `json:"coupleRequest,omitempty"`
	// In office (politics: « Présidente », « Maire de Cocody »), and the gang's tag over the name.
	Title string `json:"title,omitempty"`
	Crew  string `json:"crew,omitempty"`
	// Family: the commune's players only (a baby out goes in its pram, its maman pushing).
	Family string `json:"family,omitempty"`
	// Npc: a PNJ player (pnj.go), shown as one, never counted online.
	Npc bool `json:"npc,omitempty"`
}

type PlayerActivity struct {
	PlaceID       string `json:"placeId"`
	PlaceName     string `json:"placeName"`
	InteractionID string `json:"interactionId"`
	Label         string `json:"label"`
	Icon          string `json:"icon"`
	Joinable      bool   `json:"joinable"`
}

type Invite struct {
	ID            string    `json:"id"`
	From          string    `json:"from"`
	FromName      string    `json:"fromName"`
	PlaceID       string    `json:"placeId"`
	InteractionID string    `json:"interactionId"`
	Label         string    `json:"label"`
	At            time.Time `json:"at"`
	// Pays: who pays the trip there when it's in another commune: "moi" (the one inviting) or "toi".
	Pays string `json:"pays,omitempty"`
	// Far: the commune it's in, when not this Sim's (accepting takes the taxi there); Travelling: on the way.
	Far        string `json:"far,omitempty"`
	Travelling bool   `json:"travelling,omitempty"`
}

// joinable: an activity others can come and share. Not a trip, not a work
// shift, not at home (each Sim has its own) and not in a police cell.
func joinable(a *game.Activity, now int64) bool {
	return a != nil && a.Kind == "do" && a.End > now && a.Career == "" &&
		a.PlaceID != HomePlaceID && a.PlaceID != custodyPlace && a.PlaceID != PrisonPlaceID && a.PlaceID != "ami" && a.PlaceID != "bande"
}

func publicActivity(a *game.Activity, now int64) *PlayerActivity {
	if a == nil || a.Kind != "do" || a.End <= now {
		return nil
	}
	return &PlayerActivity{PlaceID: a.PlaceID, PlaceName: a.PlaceName, InteractionID: a.Interaction.ID, Label: a.Interaction.Label, Icon: a.Interaction.Icon, Joinable: joinable(a, now)}
}

// pair orders two Sim IDs the way the bonds table keeps them.
func pair(a, b string) (string, string) {
	if a < b {
		return a, b
	}
	return b, a
}

func (h *Handler) mySim(r *http.Request) (id, city, commune string, err error) {
	err = h.DB.QueryRow(r.Context(), `SELECT id, city, commune FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())).Scan(&id, &city, &commune)
	return
}

// around: the players in the Sim's commune, the invitations waiting for it,
// and the players it is friends with. Every player asks it every 15 s: all of
// it goes to the database in one batch (one round trip, not ten), the Sim's
// own check included (its commune is read in the same queries).
func (h *Handler) around(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, user := chi.URLParam(r, "id"), auth.UserID(ctx)
	now := game.MinuteOf(time.Now())
	since := time.Now().Add(-OnlineWindow)

	b := &pgx.Batch{}
	mine := false
	var myCity, myCommune string
	b.Queue(`SELECT true, city, commune FROM sims WHERE id = $1 AND user_id = $2`, id, user).QueryRow(func(row pgx.Row) error {
		_ = row.Scan(&mine, &myCity, &myCommune) // no row: not this player's Sim
		return nil
	})
	var players, friends, requests []Player
	into := func(dst *[]Player) func(pgx.Rows) error {
		return func(rows pgx.Rows) (err error) {
			*dst, err = scanPlayers(rows, now)
			return err
		}
	}
	b.Queue(`
		SELECT s.id, s.first_name, COALESCE(u.username, ''), s.gender, s.look, s.born_at, s.activity, COALESCE(b.friendship, 0), s.city, s.commune, s.last_tick > $3,
		       COALESCE(b.friends, false), `+requestState("s.id", "$1::uuid")+`, s.family
		FROM sims me
		JOIN sims s ON s.city = me.city AND s.commune = me.commune
		JOIN users u ON u.id = s.user_id
		LEFT JOIN bonds b ON b.sim_a = LEAST(s.id, $1::uuid) AND b.sim_b = GREATEST(s.id, $1::uuid)
		WHERE me.id = $1::uuid AND s.user_id <> $2 AND s.last_tick > $3
		ORDER BY s.last_tick DESC`, id, user, since).Query(into(&players))
	b.Queue(`
		SELECT o.id, o.first_name, COALESCE(u.username, ''), o.gender, o.look, o.born_at, o.activity, b.friendship, o.city, o.commune, o.last_tick > $2, true, ''
		FROM bonds b
		JOIN sims o ON o.id = CASE WHEN b.sim_a = $1::uuid THEN b.sim_b ELSE b.sim_a END
		JOIN users u ON u.id = o.user_id
		WHERE (b.sim_a = $1::uuid OR b.sim_b = $1::uuid) AND b.friends
		ORDER BY b.friendship DESC LIMIT 50`, id, since).Query(into(&friends))
	// Friend requests waiting for an answer, from wherever the one asking is.
	b.Queue(`
		SELECT o.id, o.first_name, COALESCE(u.username, ''), o.gender, o.look, o.born_at, o.activity, COALESCE(b.friendship, 0), o.city, o.commune, o.last_tick > $2, false, 'received'
		FROM friend_requests f
		JOIN sims o ON o.id = f.from_sim
		JOIN users u ON u.id = o.user_id
		LEFT JOIN bonds b ON b.sim_a = LEAST(o.id, $1::uuid) AND b.sim_b = GREATEST(o.id, $1::uuid)
		WHERE f.to_sim = $1::uuid
		ORDER BY f.created_at DESC LIMIT 20`, id, since).Query(into(&requests))
	// Who played in the last hour, in all the game (the players' sheet: « 12 dans l'heure »).
	var hour int
	b.Queue(`SELECT count(DISTINCT user_id) FROM sims WHERE last_tick > now() - interval '1 hour'`).QueryRow(func(row pgx.Row) error {
		_ = row.Scan(&hour)
		return nil
	})
	invites := []Invite{}
	b.Queue(`
		SELECT i.id, i.from_sim, s.first_name, i.place_id, i.interaction_id, i.label, i.created_at, i.pays, i.status = 'travelling'
		FROM invites i JOIN sims s ON s.id = i.from_sim
		WHERE i.to_sim = $1 AND i.status IN ('pending', 'travelling') AND i.created_at > $2
		ORDER BY i.created_at DESC LIMIT 10`, id, time.Now().Add(-InviteWindow)).Query(func(rows pgx.Rows) error {
		for rows.Next() {
			var in Invite
			if rows.Scan(&in.ID, &in.From, &in.FromName, &in.PlaceID, &in.InteractionID, &in.Label, &in.At, &in.Pays, &in.Travelling) == nil {
				invites = append(invites, in)
			}
		}
		return nil
	})
	var c couples
	c.queue(b, id)
	var dame *DameInvite
	queuePendingDame(b, id, &dame)
	var huit *HuitInvite
	queuePendingHuit(b, id, &huit)
	parties := []Party{}
	queueParties(b, id, &parties)
	// Le mode vie (playersocial.go): what other players just said or did to this Sim, for its toast.
	social := []Event{}
	if lifeModeOpen(ctx) {
		b.Queue(`SELECT id, kind, text FROM sim_events WHERE sim_id = $1 AND kind = 'social-in' AND created_at > now() - interval '3 minutes' ORDER BY id DESC LIMIT 5`, id).Query(func(rows pgx.Rows) error {
			for rows.Next() {
				var e Event
				if rows.Scan(&e.ID, &e.Kind, &e.Text) == nil {
					social = append(social, e)
				}
			}
			return nil
		})
	}
	err := h.DB.SendBatch(ctx, b).Close()
	var pgErr *pgconn.PgError
	if !mine && (err == nil || errors.As(err, &pgErr) && pgErr.Code == "22P02") { // 22P02: not even an id
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	// In the street and in the list: every one connected now (the game open on a screen), all of
	// them, however many; « ici » counts them, so the chip says what the street shows.
	if h.Connected != nil {
		live := players[:0]
		for _, p := range players {
			if h.Connected(p.ID) {
				live = append(live, p)
			}
		}
		players = live
		for i := range friends {
			friends[i].Online = h.Connected(friends[i].ID)
		}
	}
	here := len(players)
	c.mark(friends)
	c.mark(players) // in the street too: a heart over one's partner
	h.titles(ctx, players)
	h.titles(ctx, friends)
	// Everyone in the game right now, wherever they are (the chip says « 7 ici · 132 en ligne »).
	online := len(players) + 1
	if h.Online != nil {
		online = max(h.Online(), 1) // connected now (« ici » counts the last 20 minutes); at least the one asking
	}
	// The PNJ players of the commune (pnj.go), after the real ones, counted nowhere.
	pnj := pnjAt(ctx, myCity, myCommune, time.Now(), len(players))
	players = append(players, pnj...)
	// An invitation to another commune: its name (accepting takes the taxi there).
	for i := range invites {
		if _, cm, _, ok := world.FindPlace(invites[i].PlaceID); ok && cm.ID != myCommune {
			invites[i].Far = cm.Name
		}
	}
	// Now and then, one of them asks this Sim along (pnj.go).
	if mine {
		if in := pnjInvite(ctx, h.DB, id, myCity, myCommune, time.Now(), pnj); in != nil {
			invites = append(invites, *in)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"hour": max(hour, online), "players": players, "here": here, "friends": friends, "invites": invites, "requests": requests, "online": online, "dames": dame, "huit": huit, "parties": parties, "social": social})
}

// everyone: the players in the game now, in every commune of the city (the
// players chip, « Tout Babi »): where each one is and what they're doing, the
// friends first. Seen from afar: greeting, joining and inviting stay for the
// ones in the same commune.
func (h *Handler) everyone(w http.ResponseWriter, r *http.Request) {
	id, city, _, err := h.mySim(r)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	ctx := r.Context()
	now := game.MinuteOf(time.Now())
	list, err := h.players(ctx, now, `
		SELECT s.id, s.first_name, COALESCE(u.username, ''), s.gender, s.look, s.born_at, s.activity, COALESCE(b.friendship, 0), s.city, s.commune, true,
		       COALESCE(b.friends, false), `+requestState("s.id", "$1::uuid")+`
		FROM sims s
		JOIN users u ON u.id = s.user_id
		LEFT JOIN bonds b ON b.sim_a = LEAST(s.id, $1::uuid) AND b.sim_b = GREATEST(s.id, $1::uuid)
		WHERE s.city = $2 AND s.user_id <> $3 AND s.last_tick > $4
		ORDER BY COALESCE(b.friends, false) DESC, s.last_tick DESC LIMIT 200`, id, city, auth.UserID(ctx), time.Now().Add(-OnlineWindow))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	// Connected now only, when the hub can say (the ones who closed the game a minute ago aren't « en ligne »).
	if h.Connected != nil {
		list = slices.DeleteFunc(list, func(p Player) bool { return !h.Connected(p.ID) })
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"players": list})
}

// requestState: the SQL for a friend request between `other` and `me`: "sent" (me → other), "received", or "".
func requestState(other, me string) string {
	return `CASE WHEN EXISTS(SELECT 1 FROM friend_requests WHERE from_sim = ` + me + ` AND to_sim = ` + other + `) THEN 'sent'
		WHEN EXISTS(SELECT 1 FROM friend_requests WHERE from_sim = ` + other + ` AND to_sim = ` + me + `) THEN 'received' ELSE '' END`
}

func (h *Handler) players(ctx context.Context, now int64, query string, args ...any) ([]Player, error) {
	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPlayers(rows, now)
}

func scanPlayers(rows pgx.Rows, now int64) ([]Player, error) {
	out := []Player{}
	for rows.Next() {
		var p Player
		var born int64
		var act *game.Activity
		dst := []any{&p.ID, &p.FirstName, &p.Username, &p.Gender, &p.Look, &born, &act, &p.Friendship, &p.City, &p.Commune, &p.Online, &p.Friend, &p.Request}
		// The commune's players also bring their family (who pushes a baby's pram).
		if len(rows.FieldDescriptions()) > len(dst) {
			dst = append(dst, &p.Family)
		}
		if err := rows.Scan(dst...); err != nil {
			return nil, err
		}
		p.Stage = game.StageOf(game.AgeAt(born, now)).ID
		if p.Online {
			p.Activity = publicActivity(act, now)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// other: another player's Sim, which must be in the same commune.
type other struct {
	ID, FirstName, City, Commune string
	Activity                     *game.Activity
}

func otherSim(ctx context.Context, tx pgx.Tx, s *Sim, id string) (other, error) {
	var o other
	var owner string
	err := tx.QueryRow(ctx, `SELECT id, first_name, city, commune, activity, user_id FROM sims WHERE id = $1`, id).
		Scan(&o.ID, &o.FirstName, &o.City, &o.Commune, &o.Activity, &owner)
	if errors.Is(err, pgx.ErrNoRows) {
		return o, errNoFriend
	}
	if err != nil {
		return o, err
	}
	if owner == auth.UserID(ctx) {
		return o, errNotYourPlayer
	}
	if o.City != s.City || o.Commune != s.Commune {
		return o, errNotHere
	}
	return o, nil
}

func befriend(ctx context.Context, tx pgx.Tx, a, b string, gain int) error {
	x, y := pair(a, b)
	_, err := tx.Exec(ctx, `
		INSERT INTO bonds (sim_a, sim_b, friendship) VALUES ($1, $2, $3)
		ON CONFLICT (sim_a, sim_b) DO UPDATE SET friendship = LEAST(100, bonds.friendship + $3), seen_at = now()`, x, y, gain)
	return err
}

// meet: greet a player, or invite them to join what the Sim is doing.
func (h *Handler) meet(w http.ResponseWriter, r *http.Request) {
	var req struct {
		To     string `json:"to"`
		Action string `json:"action"` // "saluer" | "inviter" | "rejoindre" | "ajouter"
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if strings.HasPrefix(req.To, PnjPrefix) {
			return s.pnjMeet(ctx, tx, req.To, req.Action)
		}
		o, err := otherSim(ctx, tx, s, req.To)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		switch req.Action {
		case "saluer":
			x, y := pair(s.ID, o.ID)
			var recent bool
			_ = tx.QueryRow(ctx, `SELECT seen_at > now() - interval '2 minutes' FROM bonds WHERE sim_a = $1 AND sim_b = $2`, x, y).Scan(&recent)
			if recent {
				return game.Outcome{}, nil, errJustGreeted
			}
			if err := befriend(ctx, tx, s.ID, o.ID, GreetFriendship); err != nil {
				return game.Outcome{}, nil, err
			}
			s.Needs = s.Needs.Add(game.Needs{Social: 5})
			_ = insertEvent(ctx, tx, o.ID, "social", fmt.Sprintf("%s t'a salué·e dans la rue.", s.FirstName), 0, game.MinuteOf(time.Now()))
			text := fmt.Sprintf("Tu salues %s.", o.FirstName)
			return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
		case "inviter":
			return h.invite(ctx, tx, s, o, "toi")
		case "ajouter":
			return h.askFriend(ctx, tx, s, o)
		case "rejoindre":
			// Walk up and do the same thing, next to them.
			return h.join(ctx, tx, s, o, o.Activity)
		}
		return game.Outcome{}, nil, errors.New("action inconnue")
	})
}

// invite: ask another player to come and do what the Sim is doing.
func (h *Handler) invite(ctx context.Context, tx pgx.Tx, s *Sim, o other, pays string) (game.Outcome, []Event, error) {
	if pays != "moi" {
		pays = "toi"
	}
	if !joinable(s.Activity, s.GameMinutes) {
		return game.Outcome{}, nil, errNotJoinable
	}
	a := s.Activity
	var pending bool
	_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM invites WHERE from_sim = $1 AND to_sim = $2 AND status = 'pending' AND place_id = $3 AND interaction_id = $4 AND created_at > $5)`,
		s.ID, o.ID, a.PlaceID, a.Interaction.ID, time.Now().Add(-InviteWindow)).Scan(&pending)
	if pending {
		return game.Outcome{}, nil, errAlreadyAsked
	}
	label := fmt.Sprintf("%s à %s", a.Interaction.Label, a.PlaceName)
	if _, err := tx.Exec(ctx, `INSERT INTO invites (from_sim, to_sim, place_id, interaction_id, label, pays) VALUES ($1, $2, $3, $4, $5, $6)`,
		s.ID, o.ID, a.PlaceID, a.Interaction.ID, label, pays); err != nil {
		return game.Outcome{}, nil, err
	}
	// Elsewhere: who pays the taxi there.
	trip := ""
	if o.City != s.City || o.Commune != s.Commune {
		trip = " Le taxi est à tes frais."
		if pays == "moi" {
			trip = fmt.Sprintf(" Le taxi, c'est %s qui paie.", s.FirstName)
		}
	}
	_ = insertEvent(ctx, tx, o.ID, "social", fmt.Sprintf("%s t'invite : %s.%s", s.FirstName, label, trip), 0, game.MinuteOf(time.Now()))
	h.Push.ToSim(o.ID, push.Message{Title: fmt.Sprintf("%s t'invite", s.FirstName), Body: fmt.Sprintf("Rendez-vous : %s à %s.%s", a.Interaction.Label, a.PlaceName, trip), URL: "/jeu", Tag: "invite-" + s.ID})
	text := fmt.Sprintf("Tu invites %s : %s.", o.FirstName, label)
	if trip != "" && pays == "moi" {
		text += " Tu paies son taxi."
	}
	return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
}

// join: start the host's activity, at the host's place, side by side.
func (h *Handler) join(ctx context.Context, tx pgx.Tx, s *Sim, host other, a *game.Activity) (game.Outcome, []Event, error) {
	if !joinable(a, game.MinuteOf(time.Now())) {
		return game.Outcome{}, nil, errHostDone
	}
	if err := loadParty(ctx, tx, s, a.PlaceID); err != nil {
		return game.Outcome{}, nil, err
	}
	// The host receiving its guests: the guest comes to dance.
	id := a.Interaction.ID
	if id == game.SoireeHostID {
		id = "danser-soiree"
	}
	it, err := s.interactAt(a.PlaceID, id)
	if err != nil {
		return game.Outcome{}, nil, err
	}
	entry, err := h.arrive(ctx, tx, s)
	if err != nil {
		return game.Outcome{}, nil, err
	}
	// Better together.
	s.Needs = s.Needs.Add(game.Needs{Social: 10, Fun: 5})
	if err := befriend(ctx, tx, s.ID, host.ID, JoinFriendship); err != nil {
		return game.Outcome{}, nil, err
	}
	_ = insertEvent(ctx, tx, host.ID, "social", fmt.Sprintf("%s t'a rejoint·e : %s à %s.", s.FirstName, it.Label, a.PlaceName), 0, game.MinuteOf(time.Now()))
	text := entryNote(fmt.Sprintf("Tu rejoins %s : %s.", host.FirstName, it.Label), entry)
	return game.Outcome{Text: text, Money: -max(it.Cost, 0) - entry}, []Event{{Kind: "social", Text: text, Money: -entry, GameTime: s.GameMinutes}}, nil
}

// answerInvite: join the host where they are, or say no.
func (h *Handler) answerInvite(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Answer string `json:"answer"` // "accepter" | "refuser"
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if inv := chi.URLParam(r, "invite"); strings.HasPrefix(inv, PnjPrefix) {
			return s.pnjAnswer(ctx, tx, inv, req.Answer)
		}
		var in Invite
		err := tx.QueryRow(ctx, `SELECT id, from_sim, place_id, interaction_id, label, pays FROM invites
			WHERE id = $1 AND to_sim = $2 AND status IN ('pending', 'travelling') AND created_at > $3`, chi.URLParam(r, "invite"), s.ID, time.Now().Add(-InviteWindow)).
			Scan(&in.ID, &in.From, &in.PlaceID, &in.InteractionID, &in.Label, &in.Pays)
		if err != nil {
			return game.Outcome{}, nil, errInviteGone
		}
		now := game.MinuteOf(time.Now())
		var hostName string
		_ = tx.QueryRow(ctx, `SELECT first_name FROM sims WHERE id = $1`, in.From).Scan(&hostName)
		if req.Answer == "refuser" {
			_, _ = tx.Exec(ctx, `UPDATE invites SET status = 'declined' WHERE id = $1`, in.ID)
			_ = insertEvent(ctx, tx, in.From, "social", fmt.Sprintf("%s ne peut pas venir.", s.FirstName), 0, now)
			return game.Outcome{Text: fmt.Sprintf("Tu dis non à %s.", hostName)}, nil, nil
		}
		if req.Answer != "accepter" {
			return game.Outcome{}, nil, errors.New("réponse inconnue")
		}
		host, err := otherSim(ctx, tx, s, in.From)
		if errors.Is(err, errNotHere) {
			if city, cm, _, ok := world.FindPlace(in.PlaceID); ok {
				// In the same city: the taxi there, paid as agreed (inviteTrip); farther, one goes oneself.
				if city.ID == s.City {
					return h.inviteTrip(ctx, tx, s, in, hostName, city, cm)
				}
				return game.Outcome{}, nil, fmt.Errorf("%s est %s : vas-y d'abord (« Où aller ? »), puis rejoins-le", hostName, inCommune(cm.Name))
			}
			// At a soirée: where it's held.
			if loadParty(ctx, tx, s, in.PlaceID) == nil && s.party != nil {
				_, _, err := s.atParty(in.PlaceID, "")
				return game.Outcome{}, nil, err
			}
		}
		if err != nil {
			return game.Outcome{}, nil, err
		}
		a := host.Activity
		if a == nil || a.PlaceID != in.PlaceID || a.Interaction.ID != in.InteractionID {
			return game.Outcome{}, nil, errHostDone
		}
		out, events, err := h.join(ctx, tx, s, host, a)
		if err == nil {
			_, _ = tx.Exec(ctx, `UPDATE invites SET status = 'accepted' WHERE id = $1`, in.ID)
		}
		return out, events, err
	})
}

// inviteTrip: an invitation accepted from another commune of the city: the taxi there (the woro-woro or
// the compteur, as « Où aller ? » would take), paid by whoever the invitation said; on arrival, the
// invitation is there still, and « J'arrive » joins.
func (h *Handler) inviteTrip(ctx context.Context, tx pgx.Tx, s *Sim, in Invite, hostName string, city world.City, cm world.Commune) (game.Outcome, []Event, error) {
	// The fare, as the trip would cost (on a copy, with money enough).
	quote := *s
	quote.Money = 1 << 30
	quote.Activity = nil
	if err := quote.leave(city, cm); err != nil {
		return game.Outcome{}, nil, err
	}
	fare := 0
	if quote.Activity != nil && quote.Activity.Trip != nil {
		fare = quote.Activity.Trip.Fare
	}
	paid := in.Pays == "moi" && fare > 0
	if paid {
		// The host pays: from its pocket, if it has it.
		tag, err := tx.Exec(ctx, `UPDATE sims SET money = money - $1 WHERE id = $2 AND money >= $1`, fare, in.From)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if tag.RowsAffected() == 0 {
			return game.Outcome{}, nil, fmt.Errorf("%s n'a plus de quoi payer ton taxi : vas-y à tes frais (« Où aller ? »)", hostName)
		}
		s.Money += fare
	}
	if err := s.leave(city, cm); err != nil {
		if paid {
			s.Money -= fare
			_, _ = tx.Exec(ctx, `UPDATE sims SET money = money + $1 WHERE id = $2`, fare, in.From)
		}
		return game.Outcome{}, nil, err
	}
	now := game.MinuteOf(time.Now())
	_, _ = tx.Exec(ctx, `UPDATE invites SET status = 'travelling' WHERE id = $1`, in.ID)
	if paid {
		_ = insertEvent(ctx, tx, in.From, "transfer", fmt.Sprintf("%s arrive en taxi : tu paies la course (%s).", s.FirstName, game.FCFA(fare)), -fare, now)
	} else {
		_ = insertEvent(ctx, tx, in.From, "social", fmt.Sprintf("%s arrive en taxi !", s.FirstName), 0, now)
	}
	who := "à tes frais"
	if paid {
		who = "payé par " + hostName
	}
	text := fmt.Sprintf("Tu pars rejoindre %s %s, en taxi (%s). À l'arrivée, « J'arrive » pour le rejoindre.", hostName, inCommune(cm.Name), who)
	return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
}
