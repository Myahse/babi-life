package admin

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/sims"
)

// The week's rendez-vous (game/rendezvous.go, sims/rendezvous.go) in /admin: each one with its
// switch (off: not held, no card, no post, no bonus), its next times this week, and who said « J'y
// serai » or came. The schedule itself is code; only the switches are stored.

type rendezRow struct {
	game.RendezVous
	Off  bool             `json:"off"`
	Next []rendezAdminOcc `json:"next"`
}

type rendezAdminOcc struct {
	game.Occurrence
	Going  int `json:"going"`
	Joined int `json:"joined"`
}

// rendezvous: GET /admin/rendezvous.
func (h *Handler) rendezvous(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	off := map[string]bool{}
	rows, err := h.DB.Query(ctx, `SELECT id, off FROM rendezvous_settings`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	for rows.Next() {
		var id string
		var o bool
		if rows.Scan(&id, &o) == nil {
			off[id] = o
		}
	}
	rows.Close()
	now := time.Now()
	occs := sims.RendezBetween(ctx, game.RendezVousList, now, now.Add(7*24*time.Hour))
	keys := make([]string, len(occs))
	for i, o := range occs {
		keys[i] = o.Key
	}
	counts := map[string][2]int{}
	rows, err = h.DB.Query(ctx, `SELECT occ, count(*) FILTER (WHERE remind), count(*) FILTER (WHERE joined_at IS NOT NULL) FROM rendezvous_joins WHERE occ = ANY($1) GROUP BY occ`, keys)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	for rows.Next() {
		var k string
		var c [2]int
		if rows.Scan(&k, &c[0], &c[1]) == nil {
			counts[k] = c
		}
	}
	rows.Close()
	out := make([]rendezRow, 0, len(game.RendezVousList))
	for _, rv := range game.RendezVousList {
		row := rendezRow{RendezVous: rv, Off: off[rv.ID], Next: []rendezAdminOcc{}}
		for _, o := range occs {
			if o.ID == rv.ID {
				c := counts[o.Key]
				row.Next = append(row.Next, rendezAdminOcc{Occurrence: o, Going: c[0], Joined: c[1]})
			}
		}
		out = append(out, row)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"open": features.Default.Open(ctx, game.RendezVousKey), "items": out})
}

// setRendezvous: POST /admin/rendezvous/{id} {"off": true} — a rendez-vous turned off, or on again.
func (h *Handler) setRendezvous(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Off bool `json:"off"`
	}
	id := chi.URLParam(r, "id")
	if _, ok := game.FindRendezVous(id); !ok {
		httpx.Error(w, http.StatusNotFound, "rendez-vous inconnu")
		return
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if _, err := h.DB.Exec(r.Context(), `INSERT INTO rendezvous_settings (id, off) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET off = $2, updated_at = now()`, id, req.Off); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	sims.RendezForget()
	state := "remis"
	if req.Off {
		state = "coupé"
	}
	h.Log(r.Context(), "Rendez-vous", id+" "+state)
	httpx.JSON(w, http.StatusOK, map[string]bool{"off": req.Off})
}
