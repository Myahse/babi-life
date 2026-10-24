package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Friends between players. Greeting someone in the street makes them someone
// the Sim knows (a bond, its friendship growing as they meet); being friends
// is asked, face to face, and accepted. Friends can write to each other on
// Gbairai, send each other money with Waye, and invite each other to come
// and do something together from wherever they are.

// FriendGain: what becoming friends adds to the friendship.
const FriendGain = 20

var (
	errAlreadyFriends = errors.New("vous êtes déjà ami·es")
	errAlreadyAskedFr = errors.New("tu lui as déjà demandé, attends sa réponse")
	errNoRequest      = errors.New("cette demande n'est plus valable")
	errOnlyFriends    = errors.New("seulement entre ami·es : ajoute d'abord cette personne")
)

// areFriends: a bond that was asked and accepted.
func areFriends(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, a, b string) bool {
	x, y := pair(a, b)
	var ok bool
	_ = q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM bonds WHERE sim_a = $1 AND sim_b = $2 AND friends)`, x, y).Scan(&ok)
	return ok
}

// makeFriends: the bond becomes a friendship; the requests either way are done.
func makeFriends(ctx context.Context, tx pgx.Tx, a, b string) error {
	x, y := pair(a, b)
	if _, err := tx.Exec(ctx, `
		INSERT INTO bonds (sim_a, sim_b, friendship, friends) VALUES ($1, $2, $3, true)
		ON CONFLICT (sim_a, sim_b) DO UPDATE SET friends = true, friendship = LEAST(100, bonds.friendship + $3), seen_at = now()`, x, y, FriendGain); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `DELETE FROM friend_requests WHERE (from_sim = $1 AND to_sim = $2) OR (from_sim = $2 AND to_sim = $1)`, a, b)
	return err
}

// askFriend: ask a player the Sim has met, here in the street, to be friends;
// if they had already asked, it's done.
func (h *Handler) askFriend(ctx context.Context, tx pgx.Tx, s *Sim, o other) (game.Outcome, []Event, error) {
	if areFriends(ctx, tx, s.ID, o.ID) {
		return game.Outcome{}, nil, errAlreadyFriends
	}
	var theyAsked, iAsked bool
	_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM friend_requests WHERE from_sim = $1 AND to_sim = $2),
		EXISTS(SELECT 1 FROM friend_requests WHERE from_sim = $2 AND to_sim = $1)`, o.ID, s.ID).Scan(&theyAsked, &iAsked)
	now := game.MinuteOf(time.Now())
	if theyAsked {
		if err := makeFriends(ctx, tx, s.ID, o.ID); err != nil {
			return game.Outcome{}, nil, err
		}
		s.Needs = s.Needs.Add(game.Needs{Social: 10})
		_ = insertEvent(ctx, tx, o.ID, "social", fmt.Sprintf("%s et toi, vous êtes ami·es maintenant.", s.FirstName), 0, now)
		text := fmt.Sprintf("%s et toi, vous êtes ami·es maintenant.", o.FirstName)
		return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
	}
	if iAsked {
		return game.Outcome{}, nil, errAlreadyAskedFr
	}
	if _, err := tx.Exec(ctx, `INSERT INTO friend_requests (from_sim, to_sim) VALUES ($1, $2) ON CONFLICT DO NOTHING`, s.ID, o.ID); err != nil {
		return game.Outcome{}, nil, err
	}
	_ = insertEvent(ctx, tx, o.ID, "social", fmt.Sprintf("%s veut être ton ami·e : réponds dans « Joueurs ».", s.FirstName), 0, now)
	text := fmt.Sprintf("Tu demandes à %s d'être ton ami·e.", o.FirstName)
	return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
}

// answerFriend: say yes or no to a friend request, from wherever the Sim is.
func (h *Handler) answerFriend(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Answer string `json:"answer"` // "accepter" | "refuser"
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	from := chi.URLParam(r, "other")
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		var name string
		if err := tx.QueryRow(ctx, `SELECT s.first_name FROM friend_requests f JOIN sims s ON s.id = f.from_sim WHERE f.from_sim = $1 AND f.to_sim = $2`, from, s.ID).Scan(&name); err != nil {
			return game.Outcome{}, nil, errNoRequest
		}
		now := game.MinuteOf(time.Now())
		switch req.Answer {
		case "refuser":
			_, _ = tx.Exec(ctx, `DELETE FROM friend_requests WHERE from_sim = $1 AND to_sim = $2`, from, s.ID)
			return game.Outcome{Text: fmt.Sprintf("Tu ne donnes pas suite à la demande de %s.", name)}, nil, nil
		case "accepter":
			if err := makeFriends(ctx, tx, s.ID, from); err != nil {
				return game.Outcome{}, nil, err
			}
			s.Needs = s.Needs.Add(game.Needs{Social: 10})
			_ = insertEvent(ctx, tx, from, "social", fmt.Sprintf("%s a accepté : vous êtes ami·es maintenant.", s.FirstName), 0, now)
			text := fmt.Sprintf("%s et toi, vous êtes ami·es maintenant.", name)
			return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
		}
		return game.Outcome{}, nil, errors.New("réponse inconnue")
	})
}

// inviteFriend: from the phone, ask a friend wherever they are to come and do
// what the Sim is doing (they go there, then join it).
func (h *Handler) inviteFriend(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	to := chi.URLParam(r, "other")
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		o, err := otherSim(ctx, tx, s, to)
		if err != nil && !errors.Is(err, errNotHere) {
			return game.Outcome{}, nil, err
		}
		if !areFriends(ctx, tx, s.ID, o.ID) {
			return game.Outcome{}, nil, errOnlyFriends
		}
		return h.invite(ctx, tx, s, o)
	})
}

// sendToFriend: Waye money to a friend: the 1 % fee, and it's in their pocket at once.
func (h *Handler) sendToFriend(ctx context.Context, tx pgx.Tx, s *Sim, to string, amount int) (game.Outcome, []Event, error) {
	if err := needApp(s, "waye"); err != nil {
		return game.Outcome{}, nil, err
	}
	o, err := otherSim(ctx, tx, s, to)
	if err != nil && !errors.Is(err, errNotHere) {
		return game.Outcome{}, nil, err
	}
	if !areFriends(ctx, tx, s.ID, o.ID) {
		return game.Outcome{}, nil, errOnlyFriends
	}
	if amount < 100 {
		return game.Outcome{}, nil, errors.New("100 Djai minimum")
	}
	fee := world.SendFee(amount)
	if s.Money < amount+fee {
		return game.Outcome{}, nil, game.ErrNotEnoughMoney
	}
	// Between players, the day's limits (money.go): an account made to farm
	// can't pass its Djai on, nor any account more than a little a day.
	if err := heldBack(ctx, tx, s.ID); err != nil {
		return game.Outcome{}, nil, err
	}
	if s.left(game.ToPlayers) < amount {
		return game.Outcome{}, nil, game.ErrFull(game.ToPlayers)
	}
	if left, err := leftFor(ctx, tx, o.ID, game.FromPlayers); err != nil {
		return game.Outcome{}, nil, err
	} else if left < amount {
		return game.Outcome{}, nil, fmt.Errorf("%s : %s", o.FirstName, game.Full(game.FromPlayers))
	}
	if _, err := takeFor(ctx, tx, o.ID, game.FromPlayers, amount); err != nil {
		return game.Outcome{}, nil, err
	}
	s.wallet().Take(s.today(), game.ToPlayers, amount, s.passOn())
	s.Money -= amount + fee
	s.Needs = s.Needs.Add(game.Needs{Social: 4})
	_ = befriend(ctx, tx, s.ID, o.ID, 2)
	_ = insertEvent(ctx, tx, o.ID, "transfer", fmt.Sprintf("Waye : %s t'a envoyé %s.", s.FirstName, game.FCFA(amount)), amount, game.MinuteOf(time.Now()))
	text := fmt.Sprintf("Waye : %s envoyés à %s (frais %s).", game.FCFA(amount), o.FirstName, game.FCFA(fee))
	return game.Outcome{Text: text, Money: -(amount + fee)}, []Event{{Kind: "transfer", Text: text, Money: -(amount + fee), GameTime: s.GameMinutes}}, nil
}
