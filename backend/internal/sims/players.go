package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
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
	errNotYourPlayer = errors.New("c'est ton propre Sim")
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
}

// joinable: an activity others can come and share. Not a trip, not a work
// shift, not at home (each Sim has its own) and not in a police cell.
func joinable(a *game.Activity, now int64) bool {
	return a != nil && a.Kind == "do" && a.End > now && a.Career == "" &&
		a.PlaceID != HomePlaceID && a.PlaceID != custodyPlace && a.PlaceID != "ami" && a.PlaceID != "bande"
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
// and the players it is friends with.
func (h *Handler) around(w http.ResponseWriter, r *http.Request) {
	id, city, commune, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	ctx := r.Context()
	now := game.MinuteOf(time.Now())
	since := time.Now().Add(-OnlineWindow)

	players, err := h.players(ctx, now, `
		SELECT s.id, s.first_name, COALESCE(u.username, ''), s.gender, s.look, s.born_at, s.activity, COALESCE(b.friendship, 0), s.city, s.commune, s.last_tick > $5
		FROM sims s JOIN users u ON u.id = s.user_id
		LEFT JOIN bonds b ON b.sim_a = LEAST(s.id, $1::uuid) AND b.sim_b = GREATEST(s.id, $1::uuid)
		WHERE s.city = $2 AND s.commune = $3 AND s.user_id <> $4 AND s.last_tick > $5
		ORDER BY s.last_tick DESC LIMIT 20`, id, city, commune, auth.UserID(ctx), since)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	friends, err := h.players(ctx, now, `
		SELECT o.id, o.first_name, COALESCE(u.username, ''), o.gender, o.look, o.born_at, o.activity, b.friendship, o.city, o.commune, o.last_tick > $2
		FROM bonds b
		JOIN sims o ON o.id = CASE WHEN b.sim_a = $1::uuid THEN b.sim_b ELSE b.sim_a END
		JOIN users u ON u.id = o.user_id
		WHERE b.sim_a = $1::uuid OR b.sim_b = $1::uuid
		ORDER BY b.friendship DESC LIMIT 50`, id, since)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	invites := []Invite{}
	rows, err := h.DB.Query(ctx, `
		SELECT i.id, i.from_sim, s.first_name, i.place_id, i.interaction_id, i.label, i.created_at
		FROM invites i JOIN sims s ON s.id = i.from_sim
		WHERE i.to_sim = $1 AND i.status = 'pending' AND i.created_at > $2
		ORDER BY i.created_at DESC LIMIT 10`, id, time.Now().Add(-InviteWindow))
	if err == nil {
		for rows.Next() {
			var in Invite
			if rows.Scan(&in.ID, &in.From, &in.FromName, &in.PlaceID, &in.InteractionID, &in.Label, &in.At) == nil {
				invites = append(invites, in)
			}
		}
		rows.Close()
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"players": players, "friends": friends, "invites": invites})
}

func (h *Handler) players(ctx context.Context, now int64, query string, args ...any) ([]Player, error) {
	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Player{}
	for rows.Next() {
		var p Player
		var born int64
		var act *game.Activity
		if err := rows.Scan(&p.ID, &p.FirstName, &p.Username, &p.Gender, &p.Look, &born, &act, &p.Friendship, &p.City, &p.Commune, &p.Online); err != nil {
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
		Action string `json:"action"` // "saluer" | "inviter"
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
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
			if _, err := tx.Exec(ctx, `INSERT INTO invites (from_sim, to_sim, place_id, interaction_id, label) VALUES ($1, $2, $3, $4, $5)`,
				s.ID, o.ID, a.PlaceID, a.Interaction.ID, label); err != nil {
				return game.Outcome{}, nil, err
			}
			_ = insertEvent(ctx, tx, o.ID, "social", fmt.Sprintf("%s t'invite : %s.", s.FirstName, label), 0, game.MinuteOf(time.Now()))
			text := fmt.Sprintf("Tu invites %s : %s.", o.FirstName, label)
			return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
		case "rejoindre":
			// Walk up and do the same thing, next to them.
			return h.join(ctx, tx, s, o, o.Activity)
		}
		return game.Outcome{}, nil, errors.New("action inconnue")
	})
}

// join: start the host's activity, at the host's place, side by side.
func (h *Handler) join(ctx context.Context, tx pgx.Tx, s *Sim, host other, a *game.Activity) (game.Outcome, []Event, error) {
	if !joinable(a, game.MinuteOf(time.Now())) {
		return game.Outcome{}, nil, errHostDone
	}
	it, err := s.interactAt(a.PlaceID, a.Interaction.ID)
	if err != nil {
		return game.Outcome{}, nil, err
	}
	// Better together.
	s.Needs = s.Needs.Add(game.Needs{Social: 10, Fun: 5})
	if err := befriend(ctx, tx, s.ID, host.ID, JoinFriendship); err != nil {
		return game.Outcome{}, nil, err
	}
	_ = insertEvent(ctx, tx, host.ID, "social", fmt.Sprintf("%s t'a rejoint·e : %s à %s.", s.FirstName, it.Label, a.PlaceName), 0, game.MinuteOf(time.Now()))
	text := fmt.Sprintf("Tu rejoins %s : %s.", host.FirstName, it.Label)
	return game.Outcome{Text: text, Money: -max(it.Cost, 0)}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
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
		var in Invite
		err := tx.QueryRow(ctx, `SELECT id, from_sim, place_id, interaction_id, label FROM invites
			WHERE id = $1 AND to_sim = $2 AND status = 'pending' AND created_at > $3`, chi.URLParam(r, "invite"), s.ID, time.Now().Add(-InviteWindow)).
			Scan(&in.ID, &in.From, &in.PlaceID, &in.InteractionID, &in.Label)
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
			if _, cm, _, ok := world.FindPlace(in.PlaceID); ok {
				return game.Outcome{}, nil, fmt.Errorf("va d'abord à %s", cm.Name)
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
