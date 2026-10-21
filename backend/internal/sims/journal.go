package sims

import (
	"context"
	"log"
	"time"
)

// What a Sim's journal keeps: the game reads only its last 30 lines, the last
// line of a kind (the last robbery, the last gym membership) and the first
// (the birth, on the admin page). The rest only fills the database, whose free
// plan is small: PruneJournal deletes it, apart from the requests.
const (
	journalKeep  = 300
	journalBatch = 5000
	journalEvery = 6 * time.Hour
)

// PruneJournal deletes the old lines of the journals now and then, in small
// batches, until ctx ends. Never on a request's path.
func (h *Handler) PruneJournal(ctx context.Context) {
	t := time.NewTimer(10 * time.Minute) // not while the server is waking up
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if n := h.pruneJournal(ctx); n > 0 {
				log.Printf("journal: %d old lines deleted", n)
			}
			t.Reset(journalEvery)
		}
	}
}

func (h *Handler) pruneJournal(ctx context.Context) int64 {
	var total int64
	for ctx.Err() == nil {
		tag, err := h.DB.Exec(ctx, `
			DELETE FROM sim_events WHERE id IN (
				SELECT id FROM (
					SELECT id,
					       row_number() OVER (PARTITION BY sim_id ORDER BY id DESC) AS recent,
					       row_number() OVER (PARTITION BY sim_id, kind ORDER BY id DESC) AS of_kind,
					       row_number() OVER (PARTITION BY sim_id ORDER BY id) AS first
					FROM sim_events
					WHERE sim_id IN (SELECT sim_id FROM sim_events GROUP BY sim_id HAVING count(*) > $1)
				) e
				WHERE recent > $1 AND of_kind > 1 AND first > 1
				LIMIT $2)`, journalKeep, journalBatch)
		if err != nil {
			log.Printf("journal: %v", err)
			return total
		}
		total += tag.RowsAffected()
		if tag.RowsAffected() < journalBatch {
			return total
		}
		time.Sleep(time.Second) // the players' requests first
	}
	return total
}
