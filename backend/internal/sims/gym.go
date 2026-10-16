package sims

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/myahse/babi-life/backend/internal/game"
)

// The gym's month: buying the membership (« abonnement-salle ») writes an
// « abonnement » line in the journal; for 30 game days after it, the gym's
// paid sessions are free. The journal is the record: nothing else to store.

const gymMonth = 30 * 24 * 60 // game minutes

// gymMembership: the game minute the Sim's membership runs out, 0 if it never had one.
func gymMembership(ctx context.Context, tx pgx.Tx, simID string) (int64, error) {
	var last *int64
	if err := tx.QueryRow(ctx, `SELECT max(game_time) FROM sim_events WHERE sim_id = $1 AND kind = 'abonnement'`, simID).Scan(&last); err != nil {
		return 0, err
	}
	if last == nil {
		return 0, nil
	}
	return *last + gymMonth, nil
}

// atGym: a member pays nothing for a session; buying the month again while
// it still runs is refused.
func (s *Sim) atGym(it game.Interaction) (game.Interaction, error) {
	member := s.gymUntil > s.GameMinutes
	if it.ID == game.GymMembershipID {
		if member {
			days := (s.gymUntil - s.GameMinutes + 24*60 - 1) / (24 * 60)
			return it, fmt.Errorf("tu es déjà abonné·e : encore %d jour(s)", days)
		}
		return it, nil
	}
	if member && it.Cost > 0 {
		it.Cost = 0
		it.Label += " (abonné·e)"
	}
	return it, nil
}

// gymEvents: the journal line of a new membership.
func gymEvents(s *Sim, it game.Interaction) []Event {
	if it.ID != game.GymMembershipID {
		return nil
	}
	return []Event{{Kind: "abonnement", Text: fmt.Sprintf("Abonnement à la salle de sport : séances gratuites pendant 30 jours (%s).", game.FCFA(it.Cost)), Money: -it.Cost, GameTime: s.GameMinutes}}
}
