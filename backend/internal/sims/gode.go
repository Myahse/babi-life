package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Le godé on the phone (the app « godé », an update the team opens), against
// one of the game's players (game/gode.go). A round: the stake goes down first
// (whoever throws first, nobody can leave once the other's die is seen), then
// the first throws and calls « grand » or « petit » for both, then the other
// throws, the same die both throw again. The first throw goes to each in turn.
// Adults only, as the casino; what's won counts as FromGames (the day's limit:
// no stake past what can still be won today), the rounds a day are counted.

var (
	errGodeMinor  = errors.New("le godé avec mise, c'est à partir de 18 ans")
	errGodeStake  = fmt.Errorf("mise de 0 à %d Djai", game.GodeMax)
	errGodeOpen   = errors.New("une manche est déjà en cours : finis-la")
	errGodeNone   = errors.New("pas de manche en cours")
	errGodeCall   = errors.New("dis « mon grand » ou « mon petit »")
	errGodeNotNow = errors.New("ce n'est pas le moment")
)

// GodeRound: a round, as the phone shows it.
type GodeRound struct {
	Stake int `json:"stake"`
	// First: who throws first, "me" or "them"; Them: the one played against.
	First string `json:"first"`
	Them  string `json:"them"`
	Call  string `json:"call,omitempty"`
	// The dice thrown, in order (more than one each: they were the same, both threw again).
	Me   []int `json:"me"`
	Npc  []int `json:"npc"`
	Done bool  `json:"done,omitempty"`
	Won  bool  `json:"won,omitempty"`
	// Paid: what came back (the stake and the winnings, within the day's limit).
	Paid int `json:"paid,omitempty"`
}

var godeNames = []string{"Moussa", "Yao", "Koffi", "Ibrahim", "Serge", "Konan", "Drissa", "Aboubakar", "Didier", "Lassina"}

func godeLoad(ctx context.Context, tx pgx.Tx, simID string) (int, *GodeRound, error) {
	var played int
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT played, round FROM gode WHERE sim_id = $1 FOR UPDATE`, simID).Scan(&played, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil, nil
	}
	if err != nil {
		return 0, nil, err
	}
	if len(raw) == 0 {
		return played, nil, nil
	}
	var r GodeRound
	if err := json.Unmarshal(raw, &r); err != nil {
		return played, nil, nil
	}
	return played, &r, nil
}

func godeSave(ctx context.Context, tx pgx.Tx, simID string, played int, r *GodeRound) error {
	raw, err := json.Marshal(r)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO gode (sim_id, played, round) VALUES ($1, $2, $3)
		ON CONFLICT (sim_id) DO UPDATE SET played = $2, round = $3`, simID, played, raw)
	return err
}

// godeSettle: the other die thrown (and both again while they're the same), the winner paid.
func godeSettle(ctx context.Context, tx pgx.Tx, s *Sim, r *GodeRound, rng *rand.Rand) error {
	me, npc := r.Me[len(r.Me)-1], r.Npc[len(r.Npc)-1]
	for game.GodeBeats(r.Call, me, npc) == 0 {
		me, npc = game.GodeRoll(rng), game.GodeRoll(rng)
		r.Me, r.Npc = append(r.Me, me), append(r.Npc, npc)
	}
	r.Done = true
	r.Won = game.GodeBeats(r.Call, me, npc) > 0
	if r.Won && r.Stake > 0 {
		paid, err := payWinner(ctx, tx, s.ID, r.Stake, 2*r.Stake, game.FromGames)
		if err != nil {
			return err
		}
		r.Paid = paid
		s.Money += paid
	}
	return nil
}

func godeText(r *GodeRound) string {
	switch {
	case !r.Done:
		return ""
	case r.Won && r.Stake > 0:
		return fmt.Sprintf("Godé : tu gagnes contre %s, %s pour toi !", r.Them, game.FCFA(r.Paid))
	case r.Won:
		return fmt.Sprintf("Godé : tu gagnes contre %s !", r.Them)
	case r.Stake > 0:
		return fmt.Sprintf("Godé : %s gagne, il ramasse les %s.", r.Them, game.FCFA(2*r.Stake))
	default:
		return fmt.Sprintf("Godé : %s gagne cette fois.", r.Them)
	}
}

// godeHandler: GET /sims/{id}/gode the round going on (or the last); POST {action: start|throw|call, stake, call}.
func (h *Handler) godeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		h.godeGet(w, r)
		return
	}
	var req struct {
		Action string `json:"action"`
		Stake  int    `json:"stake"`
		Call   string `json:"call"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := needApp(s, "gode"); err != nil {
			return game.Outcome{}, nil, err
		}
		if s.stage().ID != game.StageAdulte {
			return game.Outcome{}, nil, errGodeMinor
		}
		if adult, err := accountAdult(ctx, tx); err != nil || !adult {
			return game.Outcome{}, nil, errNotAdult
		}
		played, cur, err := godeLoad(ctx, tx, s.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		rng := casinoRng()
		var money int
		switch req.Action {
		case "start":
			if cur != nil && !cur.Done {
				return game.Outcome{}, nil, errGodeOpen
			}
			if req.Stake < 0 || req.Stake > game.GodeMax {
				return game.Outcome{}, nil, errGodeStake
			}
			if req.Stake > s.Money {
				return game.Outcome{}, nil, game.ErrNotEnoughMoney
			}
			// No stake past what can still be won today (game/money.go FromGames).
			if req.Stake > 0 && s.left(game.FromGames) < req.Stake {
				return game.Outcome{}, nil, game.ErrFull(game.FromGames)
			}
			if !s.wallet().Can(s.today(), game.Gode) {
				return game.Outcome{}, nil, game.ErrFull(game.Gode)
			}
			s.wallet().Use(s.today(), game.Gode)
			s.Money -= req.Stake
			money = -req.Stake
			cur = &GodeRound{Stake: req.Stake, First: "me", Them: godeNames[rng.IntN(len(godeNames))], Me: []int{}, Npc: []int{}}
			// The first throw to each in turn: the other one throws and calls at once.
			if played%2 == 1 {
				cur.First = "them"
				d := game.GodeRoll(rng)
				cur.Npc = []int{d}
				cur.Call = game.GodeCallFor(d)
			}
			played++
		case "throw":
			if cur == nil || cur.Done || len(cur.Me) > 0 {
				return game.Outcome{}, nil, errGodeNotNow
			}
			cur.Me = []int{game.GodeRoll(rng)}
			// The other called already: his die against this one.
			if cur.First == "them" {
				if err := godeSettle(ctx, tx, s, cur, rng); err != nil {
					return game.Outcome{}, nil, err
				}
			}
		case "call":
			if cur == nil || cur.Done || cur.First != "me" || len(cur.Me) == 0 || cur.Call != "" {
				return game.Outcome{}, nil, errGodeNotNow
			}
			if req.Call != game.GodeGrand && req.Call != game.GodePetit {
				return game.Outcome{}, nil, errGodeCall
			}
			cur.Call = req.Call
			cur.Npc = []int{game.GodeRoll(rng)}
			if err := godeSettle(ctx, tx, s, cur, rng); err != nil {
				return game.Outcome{}, nil, err
			}
		default:
			return game.Outcome{}, nil, errGodeNone
		}
		if err := godeSave(ctx, tx, s.ID, played, cur); err != nil {
			return game.Outcome{}, nil, err
		}
		if cur.Paid > 0 {
			money = cur.Paid
		}
		mood := ""
		if cur.Done {
			mood = map[bool]string{true: "good", false: "bad"}[cur.Won]
		}
		return game.Outcome{Text: godeText(cur), Money: money, Mood: mood, Data: cur}, nil, nil
	})
}

// godeGet: the round going on, or the last one (nil: never played).
func (h *Handler) godeGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	var raw []byte
	if err := h.DB.QueryRow(ctx, `SELECT round FROM gode WHERE sim_id = $1`, id).Scan(&raw); err != nil || len(raw) == 0 {
		httpx.JSON(w, http.StatusOK, map[string]any{"round": nil})
		return
	}
	var cur GodeRound
	_ = json.Unmarshal(raw, &cur)
	httpx.JSON(w, http.StatusOK, map[string]any{"round": cur})
}
