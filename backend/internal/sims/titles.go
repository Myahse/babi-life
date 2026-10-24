package sims

import (
	"context"

	"github.com/myahse/babi-life/backend/internal/politics"
)

// titles sets, on players listed, the office each holds (politics: the
// president, a minister, a deputy, a mayor) and the tag of their gang: the
// street shows them over the name.
func (h *Handler) titles(ctx context.Context, list []Player) {
	if len(list) == 0 {
		return
	}
	ids := make([]string, len(list))
	at := map[string]int{}
	for i, p := range list {
		ids[i] = p.ID
		at[p.ID] = i
	}
	rows, err := h.DB.Query(ctx, `SELECT sim_id, office FROM offices WHERE until > now() AND sim_id = ANY($1::uuid[]) ORDER BY office`, ids)
	if err == nil {
		for rows.Next() {
			var id, office string
			if rows.Scan(&id, &office) == nil {
				if i, ok := at[id]; ok && list[i].Title == "" {
					list[i].Title = politics.OfficeLabel(office, list[i].Gender)
				}
			}
		}
		rows.Close()
	}
	rows, err = h.DB.Query(ctx, `SELECT m.sim_id, c.tag FROM crew_members m JOIN crews c ON c.id = m.crew_id WHERE m.sim_id = ANY($1::uuid[])`, ids)
	if err == nil {
		for rows.Next() {
			var id, tag string
			if rows.Scan(&id, &tag) == nil {
				if i, ok := at[id]; ok {
					list[i].Crew = tag
				}
			}
		}
		rows.Close()
	}
}
