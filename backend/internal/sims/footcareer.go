package sims

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"slices"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Babi Foot's career (game/footcareer.go; web components/defi/foot/Career.tsx):
// the season is the phone's (it plays the matches), kept here as it sends it;
// the signings are the server's, paid for in Djai from the Sim's pocket.

var (
	errFootNone  = errors.New("commence d'abord ta carrière")
	errFootWho   = errors.New("joueur inconnu")
	errFootFull  = errors.New("ton effectif est complet : libère un joueur d'abord")
	errFootMoney = errors.New("pas assez de Djai pour ce transfert")
)

// footClub: a club's id (the phone's list, web foot/teams.ts).
var footClub = regexp.MustCompile(`^[a-z][a-z-]{1,23}$`)

// footSeasonMax: the most a season sent may weigh.
const footSeasonMax = 64 << 10

type footCareerRow struct {
	Club   string          `json:"club"`
	Squad  []string        `json:"squad"`
	Season json.RawMessage `json:"season"`
}

// footView: the Sim's career (null: none yet), the market, the most signings.
func (h *Handler) footView(w http.ResponseWriter, r *http.Request, id string) {
	var c footCareerRow
	var season []byte
	err := h.DB.QueryRow(r.Context(), `SELECT club, squad, season FROM foot_careers WHERE sim_id = $1`, id).Scan(&c.Club, &c.Squad, &season)
	var career *footCareerRow
	switch {
	case err == nil:
		c.Season = season
		if c.Squad == nil {
			c.Squad = []string{}
		}
		career = &c
	case !errors.Is(err, pgx.ErrNoRows):
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"career": career, "market": game.FootRecruits, "max": game.FootSquadMax})
}

// footCareer: GET /sims/{id}/foot.
func (h *Handler) footCareer(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	h.footView(w, r, id)
}

// footSave: PUT /sims/{id}/foot {club, season}: the career begun (the club set
// then, kept after) or the season as it stands.
func (h *Handler) footSave(w http.ResponseWriter, r *http.Request) {
	if !features.Default.Open(r.Context(), "foot-carriere") {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, footSeasonMax+1024)
	var req struct {
		Club   string          `json:"club"`
		Season json.RawMessage `json:"season"`
	}
	if err := httpx.Decode(r, &req); err != nil || !footClub.MatchString(req.Club) || len(req.Season) == 0 || len(req.Season) > footSeasonMax || req.Season[0] != '{' || !json.Valid(req.Season) {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if _, err := h.DB.Exec(r.Context(), `INSERT INTO foot_careers (sim_id, club, season) VALUES ($1, $2, $3)
		ON CONFLICT (sim_id) DO UPDATE SET season = EXCLUDED.season, updated_at = now()`, id, req.Club, []byte(req.Season)); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	h.footView(w, r, id)
}

// footSign: POST /sims/{id}/foot/sign/{player}: a player signed for his price, kept.
func (h *Handler) footSign(w http.ResponseWriter, r *http.Request) {
	if !features.Default.Open(r.Context(), "foot-carriere") {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		p, ok := game.FindFootRecruit(chi.URLParam(r, "player"))
		if !ok {
			return game.Outcome{}, nil, errFootWho
		}
		var club string
		var squad []string
		if err := tx.QueryRow(ctx, `SELECT club, squad FROM foot_careers WHERE sim_id = $1 FOR UPDATE`, s.ID).Scan(&club, &squad); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return game.Outcome{}, nil, errFootNone
			}
			return game.Outcome{}, nil, err
		}
		if slices.Contains(squad, p.ID) {
			return game.Outcome{Text: fmt.Sprintf("%s joue déjà pour toi.", p.Name)}, nil, nil
		}
		if len(squad) >= game.FootSquadMax {
			return game.Outcome{}, nil, errFootFull
		}
		if s.Money < p.Price {
			return game.Outcome{}, nil, errFootMoney
		}
		s.Money -= p.Price
		if _, err := tx.Exec(ctx, `UPDATE foot_careers SET squad = array_append(squad, $2), updated_at = now() WHERE sim_id = $1`, s.ID, p.ID); err != nil {
			return game.Outcome{}, nil, err
		}
		text := fmt.Sprintf("Babi Foot : %s signe dans ton club (%s Djai).", p.Name, money(p.Price))
		return game.Outcome{Text: text, Money: -p.Price}, []Event{{Kind: "money", Text: text, Money: -p.Price, GameTime: s.GameMinutes}}, nil
	})
}

// footRelease: POST /sims/{id}/foot/release/{player}: a signing let go, for nothing.
func (h *Handler) footRelease(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	if _, err := h.DB.Exec(r.Context(), `UPDATE foot_careers SET squad = array_remove(squad, $2), updated_at = now() WHERE sim_id = $1`, id, chi.URLParam(r, "player")); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	h.footView(w, r, id)
}
