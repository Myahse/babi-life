package sims

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The betting apps of the phone, on the Babi virtual football (game/betting.go):
// Bet225, many markets and a boost on big combined bets (like the sites with
// everything), and ParisFoot, simple, a little better on single bets. The
// stake is paid when the bet is placed; a winning bet pays stake × odds when
// its last match is over (settled when the app is opened, or the next bet).
// Adults only (the Sim must be 18), from 100 to 50 000 F, 30 bets a day,
// 8 matches at most in a combined bet. It's the game's money only.

type betApp struct {
	ID, Name string
	Margin   float64
	// Boost: extra winnings on combined bets of 3 matches or more, per match.
	Boost float64
}

var betApps = map[string]betApp{
	"bet225":    {"bet225", "Bet225", 0.08, 0.05},
	"parisfoot": {"parisfoot", "ParisFoot", 0.06, 0},
}

const (
	MinStake   = 100
	MaxStake   = 50000
	MaxLegs    = 8
	BetsPerDay = 30
	MaxOdds    = 1000
)

var (
	errBetApp      = errors.New("appli de paris inconnue")
	errTooYoung    = errors.New("les paris, c'est à partir de 18 ans")
	errStake       = fmt.Errorf("mise entre %d et %d F", MinStake, MaxStake)
	errNoLegs      = fmt.Errorf("choisis entre 1 et %d matchs", MaxLegs)
	errSameMatch   = errors.New("un seul pari par match dans un combiné")
	errBetClosed   = errors.New("ce match a déjà commencé : les paris sont fermés")
	errBadPick     = errors.New("pari inconnu")
	errTooManyBets = fmt.Errorf("%d paris aujourd'hui, c'est assez : reviens demain", BetsPerDay)
)

// boostOf: the boost a combined bet of n matches gets on an app.
func boostOf(a betApp, n int) float64 {
	if n < 3 {
		return 1
	}
	return 1 + a.Boost*float64(n-2)
}

// betRounds: the last round's results, the one under way, and the next two (GET /bets/rounds?app=).
func (h *Handler) betRounds(w http.ResponseWriter, r *http.Request) {
	a, ok := betApps[r.URL.Query().Get("app")]
	if !ok {
		a = betApps["parisfoot"]
	}
	now := time.Now().Unix()
	cur := game.RoundAt(now)
	type round struct {
		Round   int64               `json:"round"`
		Kickoff int64               `json:"kickoff"`
		Matches []game.VirtualMatch `json:"matches"`
	}
	out := []round{}
	for r := cur - 1; r <= cur+2; r++ {
		ms := game.Round(r, now, a.Margin)
		out = append(out, round{r, ms[0].Kickoff, ms})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"now": now, "app": a.Name, "boost": a.Boost, "rounds": out})
}

type legReq struct {
	Match string `json:"match"`
	Pick  string `json:"pick"`
}

// placeBet: a single or combined bet; the stake is paid now.
func (h *Handler) placeBet(w http.ResponseWriter, r *http.Request) {
	var req struct {
		App   string   `json:"app"`
		Stake int      `json:"stake"`
		Legs  []legReq `json:"legs"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		a, ok := betApps[req.App]
		if !ok {
			return game.Outcome{}, nil, errBetApp
		}
		if err := needApp(s, a.ID); err != nil {
			return game.Outcome{}, nil, err
		}
		if s.stage().ID != game.StageAdulte {
			return game.Outcome{}, nil, errTooYoung
		}
		if req.Stake < MinStake || req.Stake > MaxStake {
			return game.Outcome{}, nil, errStake
		}
		if s.Money < req.Stake {
			return game.Outcome{}, nil, game.ErrNotEnoughMoney
		}
		if len(req.Legs) == 0 || len(req.Legs) > MaxLegs {
			return game.Outcome{}, nil, errNoLegs
		}
		var today int
		_ = tx.QueryRow(ctx, `SELECT count(*) FROM bets WHERE sim = $1 AND created_at > now() - interval '24 hours'`, s.ID).Scan(&today)
		if today >= BetsPerDay {
			return game.Outcome{}, nil, errTooManyBets
		}
		now := time.Now().Unix()
		seen := map[string]bool{}
		odds := 1.0
		var settles int64
		type leg struct {
			key, label, pick string
			odds             float64
		}
		legs := []leg{}
		for _, l := range req.Legs {
			round, i, err := parseMatch(l.Match)
			if err != nil {
				return game.Outcome{}, nil, errBadPick
			}
			if seen[l.Match] {
				return game.Outcome{}, nil, errSameMatch
			}
			seen[l.Match] = true
			m, ok := game.Match(round, i, now, a.Margin)
			if !ok {
				return game.Outcome{}, nil, errBadPick
			}
			if now >= m.Kickoff {
				return game.Outcome{}, nil, errBetClosed
			}
			o, ok := game.PickOdds(m.Odds, l.Pick)
			if !ok {
				return game.Outcome{}, nil, errBadPick
			}
			odds *= o
			settles = max(settles, m.End)
			legs = append(legs, leg{l.Match, m.Home + " – " + m.Away, l.Pick, o})
		}
		odds = math.Min(MaxOdds, math.Round(odds*boostOf(a, len(legs))*100)/100)
		var id int64
		if err := tx.QueryRow(ctx, `INSERT INTO bets (sim, app, stake, odds, settles_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`, s.ID, a.ID, req.Stake, odds, settles).Scan(&id); err != nil {
			return game.Outcome{}, nil, err
		}
		for _, l := range legs {
			if _, err := tx.Exec(ctx, `INSERT INTO bet_legs (bet, match, label, pick, odds) VALUES ($1, $2, $3, $4, $5)`, id, l.key, l.label, l.pick, l.odds); err != nil {
				return game.Outcome{}, nil, err
			}
		}
		s.Money -= req.Stake
		kind := "Pari simple"
		if len(legs) > 1 {
			kind = fmt.Sprintf("Combiné de %d matchs", len(legs))
		}
		text := fmt.Sprintf("%s sur %s : %s F à la cote %.2f. Gain possible : %s F.", kind, a.Name, money(req.Stake), odds, money(int(float64(req.Stake)*odds)))
		return game.Outcome{Text: text, Money: -req.Stake}, []Event{{Kind: "money", Text: text, Money: -req.Stake, GameTime: s.GameMinutes}}, nil
	})
}

func parseMatch(key string) (int64, int, error) {
	a, b, ok := strings.Cut(key, ":")
	if !ok {
		return 0, 0, errBadPick
	}
	round, err := strconv.ParseInt(a, 10, 64)
	if err != nil {
		return 0, 0, err
	}
	i, err := strconv.Atoi(b)
	return round, i, err
}

func money(n int) string {
	s := strconv.Itoa(n)
	out := []byte{}
	for i, c := range []byte(s) {
		if i > 0 && (len(s)-i)%3 == 0 {
			out = append(out, ' ')
		}
		out = append(out, c)
	}
	return string(out)
}

// settleBets: the open bets whose last match is over are won or lost; the winnings are paid.
func (h *Handler) settleBets(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		now := time.Now().Unix()
		rows, err := tx.Query(ctx, `SELECT b.id, b.app, b.stake, b.odds::float8, l.match, l.pick FROM bets b JOIN bet_legs l ON l.bet = b.id
			WHERE b.sim = $1 AND b.status = 'open' AND b.settles_at <= $2 ORDER BY b.id`, s.ID, now)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		type open struct {
			app   string
			stake int
			odds  float64
			lost  bool
		}
		bets := map[int64]*open{}
		order := []int64{}
		for rows.Next() {
			var id int64
			var o open
			var key, pick string
			if err := rows.Scan(&id, &o.app, &o.stake, &o.odds, &key, &pick); err != nil {
				rows.Close()
				return game.Outcome{}, nil, err
			}
			if bets[id] == nil {
				bets[id] = &open{app: o.app, stake: o.stake, odds: o.odds}
				order = append(order, id)
			}
			round, i, err := parseMatch(key)
			if err != nil {
				bets[id].lost = true
				continue
			}
			m, _ := game.Match(round, i, now, 0)
			if won, ok := game.Won(m, pick, now); ok && !won {
				bets[id].lost = true
			}
		}
		rows.Close()
		var events []Event
		total := 0
		for _, id := range order {
			b := bets[id]
			name := betApps[b.app].Name
			if b.lost {
				if _, err := tx.Exec(ctx, `UPDATE bets SET status = 'lost' WHERE id = $1`, id); err != nil {
					return game.Outcome{}, nil, err
				}
				events = append(events, Event{Kind: "money", Text: fmt.Sprintf("%s : pari perdu (%s F). La prochaine fois !", name, money(b.stake)), GameTime: s.GameMinutes})
				continue
			}
			pay := int(math.Round(float64(b.stake) * b.odds))
			if _, err := tx.Exec(ctx, `UPDATE bets SET status = 'won', payout = $2 WHERE id = $1`, id, pay); err != nil {
				return game.Outcome{}, nil, err
			}
			s.Money += pay
			total += pay
			events = append(events, Event{Kind: "money", Text: fmt.Sprintf("%s : pari gagné ! +%s F (cote %.2f).", name, money(pay), b.odds), Money: pay, GameTime: s.GameMinutes})
		}
		text := ""
		if total > 0 {
			text = fmt.Sprintf("Paris gagnés : +%s F", money(total))
		}
		return game.Outcome{Text: text, Money: total}, events, nil
	})
}

// BetView is a bet as the app shows it.
type BetView struct {
	ID     int64     `json:"id"`
	App    string    `json:"app"`
	Stake  int       `json:"stake"`
	Odds   float64   `json:"odds"`
	Status string    `json:"status"`
	Payout int       `json:"payout"`
	At     time.Time `json:"at"`
	Legs   []struct {
		Match string  `json:"match"`
		Label string  `json:"label"`
		Pick  string  `json:"pick"`
		Odds  float64 `json:"odds"`
		// Won: true/false once its match is over, null before.
		Won   *bool   `json:"won"`
		Score *[2]int `json:"score,omitempty"`
	} `json:"legs"`
}

// myBets: the Sim's last 30 bets, with each match's score so far.
func (h *Handler) myBets(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	ctx := r.Context()
	rows, err := h.DB.Query(ctx, `SELECT b.id, b.app, b.stake, b.odds::float8, b.status, b.payout, b.created_at, l.match, l.label, l.pick, l.odds::float8
		FROM bets b JOIN bet_legs l ON l.bet = b.id
		WHERE b.id IN (SELECT id FROM bets WHERE sim = $1 ORDER BY id DESC LIMIT 30) ORDER BY b.id DESC, l.match`, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	now := time.Now().Unix()
	out := []*BetView{}
	byID := map[int64]*BetView{}
	for rows.Next() {
		var b BetView
		var leg struct {
			Match string  `json:"match"`
			Label string  `json:"label"`
			Pick  string  `json:"pick"`
			Odds  float64 `json:"odds"`
			Won   *bool   `json:"won"`
			Score *[2]int `json:"score,omitempty"`
		}
		if err := rows.Scan(&b.ID, &b.App, &b.Stake, &b.Odds, &b.Status, &b.Payout, &b.At, &leg.Match, &leg.Label, &leg.Pick, &leg.Odds); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		if round, i, err := parseMatch(leg.Match); err == nil {
			m, _ := game.Match(round, i, now, 0)
			leg.Score = m.Score
			if won, ok := game.Won(m, leg.Pick, now); ok {
				leg.Won = &won
			}
		}
		cur := byID[b.ID]
		if cur == nil {
			cur = &b
			byID[b.ID] = cur
			out = append(out, cur)
		}
		cur.Legs = append(cur.Legs, leg)
	}
	httpx.JSON(w, http.StatusOK, out)
}
