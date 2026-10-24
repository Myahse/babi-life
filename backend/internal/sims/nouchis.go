package sims

import (
	"context"
	"fmt"
	"hash/fnv"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The nouchis of the couloirs: in some narrow alleys between the cours, a few
// young guys hang about, and one comes up to whoever passes without paying
// attention. In the street (web world3d/open/nouchis.tsx) the player has a
// moment to stay vigilant or get away; when they don't, the client says so
// here and the nouchis take what's in the pockets: between 500 and 5 000 F,
// never more than there is. Once robbed, the Sim is left alone for a while
// (robbedRest game minutes): the alleys don't empty a wallet in one evening.

const robbedRest = 6 * 60

// robbery: what is taken and what is said, for a Sim with this money, at
// this spot and game minute, and the game minute of the last robbery (-1: never).
func robbery(s *Sim, spot string, last int64) (string, int) {
	if s.Gang == "member" {
		return "« Laisse, c'est notre gars ! » Les nouchis te laissent passer.", 0
	}
	if s.Sect == "sept" {
		return "L'un d'eux voit la marque du Cercle à ton poignet : « Lui, on ne touche pas. » Ils baissent les yeux.", 0
	}
	if last >= 0 && s.GameMinutes-last < robbedRest {
		return "Les nouchis te regardent passer : ils t'ont déjà eu aujourd'hui.", 0
	}
	if s.Money < 100 {
		return "Ils fouillent tes poches… rien dedans. « Tchrr, y a rien sur lui ! » Ils repartent.", 0
	}
	f := fnv.New32a()
	_, _ = f.Write([]byte(spot))
	day := uint32(s.GameMinutes / (24 * 60))
	f.Write([]byte{byte(day), byte(day >> 8), byte(day >> 16)})
	amount := min(500+int(f.Sum32()%10)*500, s.Money)
	return fmt.Sprintf("Dans le couloir, les nouchis t'ont pris %s ! La prochaine fois, reste vigilant·e.", game.FCFA(amount)), amount
}

func (h *Handler) robbed(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Spot string `json:"spot"`
	}
	if err := httpx.Decode(r, &req); err != nil || req.Spot == "" || len(req.Spot) > 80 {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		last, err := lastRobbed(r.Context(), tx, s.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		// A gang's member on its own turf (politics: crews): the nouchis know the tag.
		var tag string
		if err := tx.QueryRow(r.Context(), `SELECT c.tag FROM crew_members m JOIN crews c ON c.id = m.crew_id WHERE m.sim_id = $1 AND c.commune = $2`, s.ID, s.Commune).Scan(&tag); err == nil {
			return game.Outcome{Text: "« Eh, c'est un gars du " + tag + " ! » Les nouchis reculent : ici, c'est le quartier de ton gang."}, nil, nil
		}
		text, amount := robbery(s, req.Spot, last)
		if amount == 0 {
			return game.Outcome{Text: text}, nil, nil
		}
		s.Money -= amount
		return game.Outcome{Text: text, Money: -amount}, []Event{{Kind: "robbed", Text: text, Money: -amount, GameTime: s.GameMinutes}}, nil
	})
}

// lastRobbed: the game minute of the Sim's last robbery, -1 if never.
func lastRobbed(ctx context.Context, tx pgx.Tx, simID string) (int64, error) {
	var last *int64
	if err := tx.QueryRow(ctx, `SELECT max(game_time) FROM sim_events WHERE sim_id = $1 AND kind = 'robbed'`, simID).Scan(&last); err != nil {
		return 0, err
	}
	if last == nil {
		return -1, nil
	}
	return *last, nil
}
