package sims

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// GoNow (game/gonow.go): the phone app, street corners, hotel company.
// Real 3D scenes; adults only (Sim + account adult_at). Risks: theft, police,
// partner jealousy. Feature « gonow ».

var (
	errGoClosed  = errors.New("bientôt dans le jeu")
	errGoMinor   = errors.New("GoNow, c'est à partir de 18 ans")
	errGoService = errors.New("service inconnu")
	errGoProfile = errors.New("profil inconnu")
)

func goOpen() bool {
	return features.Default.BlocksKey(context.Background(), "app:"+game.GoNowApp) == ""
}

// gonowView: GET /sims/{id}/gonow — profiles + services + prices.
func (h *Handler) gonowView(w http.ResponseWriter, r *http.Request) {
	if !goOpen() {
		httpx.Error(w, http.StatusForbidden, errGoClosed.Error())
		return
	}
	var adult bool
	if err := h.DB.QueryRow(r.Context(), `SELECT u.adult_at IS NOT NULL FROM sims s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context())).Scan(&adult); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	prices := map[string]map[string]int{}
	for _, p := range game.GoProfiles {
		prices[p.ID] = map[string]int{}
		for _, svc := range game.GoServices {
			prices[p.ID][svc.ID] = game.GoPrice(p, svc)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"adult":    adult,
		"profiles": game.GoProfiles,
		"services": game.GoServices,
		"prices":   prices,
	})
}

// gonowBook: POST /sims/{id}/gonow {profileId, serviceId, where: app|hotel}
func (h *Handler) gonowBook(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProfileID string `json:"profileId"`
		ServiceID string `json:"serviceId"`
		Where     string `json:"where"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if !goOpen() {
			return game.Outcome{}, nil, errGoClosed
		}
		if err := needApp(s, game.GoNowApp); err != nil {
			return game.Outcome{}, nil, err
		}
		if s.stage().ID != game.StageAdulte {
			return game.Outcome{}, nil, errGoMinor
		}
		adult, err := accountAdult(r.Context(), tx)
		if err != nil || !adult {
			return game.Outcome{}, nil, errNotAdult
		}
		p, ok := game.GoProfileOf(req.ProfileID)
		if !ok {
			return game.Outcome{}, nil, errGoProfile
		}
		svc, ok := game.GoServiceOf(req.ServiceID)
		if !ok {
			return game.Outcome{}, nil, errGoService
		}
		cost := game.GoPrice(p, svc)
		placeID, placeKind, placeName := "gonow", "home", p.Name
		if req.Where == "hotel" {
			cost = svc.Hotel
			placeID, placeKind, placeName = "gonow-hotel", "hotel", p.Name
		} else if p.Tier == "suite" {
			return game.Outcome{}, nil, errors.New("ce profil ne se voit qu'à l'hôtel")
		}
		it := svc.Interaction(cost)
		it.Label = svc.Label + " · " + p.Name
		if err := s.start(it, placeID, placeKind, placeName, nil, ""); err != nil {
			return game.Outcome{}, nil, err
		}
		text, riskMoney := goRisks(s, p.Name, rand.New(rand.NewPCG(uint64(s.GameMinutes), uint64(p.Seed))))
		note := fmt.Sprintf("GoNow · %s avec %s (%s).", svc.Label, p.Name, game.FCFA(cost))
		if text != "" {
			note += " " + text
		}
		return game.Outcome{Text: note, Money: -cost + riskMoney, Data: map[string]any{"profileId": p.ID, "gender": p.Gender, "seed": p.Seed, "name": p.Name}}, nil, nil
	})
}

// goRisks: theft (~10 %), police (~8 %), partner jealousy if someone lives at home (~20 %).
func goRisks(s *Sim, with string, rng *rand.Rand) (text string, moneyDelta int) {
	if home := s.partner(); home != nil && home.Home && rng.Float64() < 0.2 {
		home.Friendship = max(0, home.Friendship-25)
		if rng.Float64() < 0.35 {
			home.Partner, home.Home = false, false
			return fmt.Sprintf("%s a tout su. C'est fini.", home.Name), 0
		}
		return fmt.Sprintf("%s a des doutes… « T'étais où avec %s ? »", home.Name, with), 0
	}
	if rng.Float64() < 0.1 {
		lost := min(s.Money, 5000+rng.IntN(15000))
		if lost > 0 {
			s.Money -= lost
			return "On t'a détroussé·e en sortant. Portefeuille allégé.", -lost
		}
	}
	if rng.Float64() < 0.08 {
		fine := min(s.Money, 10000)
		s.Money -= fine
		s.Needs = s.Needs.Add(game.Needs{Fun: -15, Social: -10})
		return "Contrôle de police. Amende, et on te laisse partir.", -fine
	}
	return "", 0
}

// ensureIntimite: shared gates for intimite acts, pole girls, street go (feature + adult).
func ensureIntimite(ctx context.Context, tx pgx.Tx, s *Sim, id string) error {
	if !game.IsIntimite(id) && id != game.PoleWatchID && id != game.PolePrivateID && id != "street-go" {
		return nil
	}
	check := id
	if id == game.PoleWatchID || id == game.PolePrivateID || id == "street-go" {
		check = id
	}
	if features.Default.Blocks(ctx, check) != "" {
		return errGoClosed
	}
	if s.stage().ID != game.StageAdulte {
		return errGoMinor
	}
	adult, err := accountAdult(ctx, tx)
	if err != nil || !adult {
		return errNotAdult
	}
	return nil
}
