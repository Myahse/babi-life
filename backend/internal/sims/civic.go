package sims

import (
	"context"
	"fmt"
	"slices"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/politics"
)

// The republic in the Sim's day (game/civic.go, politics/presidency.go): the
// president's measures lower some prices for everyone (read with the Sim, a
// shared cache of half a minute); the candidate's tour and the militant's
// day counted for the campaign; the Fête de la Nation and the meetings at
// the stadium, lasting as long as the big day.

var measuresCache struct {
	sync.Mutex
	at   time.Time
	list []string
}

// activeMeasures: the measures in force (read again every 30 s at most).
func (h *Handler) activeMeasures(ctx context.Context) []string {
	measuresCache.Lock()
	defer measuresCache.Unlock()
	if time.Since(measuresCache.at) < 30*time.Second {
		return measuresCache.list
	}
	list, err := politics.ActiveMeasures(ctx, h.DB)
	if err != nil {
		return measuresCache.list
	}
	measuresCache.at, measuresCache.list = time.Now(), list
	return list
}

// publicFare: whether a trip's mode is public transport (the « transport » measure halves it).
func publicFare(mode string) bool {
	return slices.Contains([]string{"taxi", "woro", "compteur", "gbaka", "car", "metro"}, mode)
}

// civicAct: what an interaction of the republic does once started (interactAt has
// checked the place, the age, the money): the campaign's points, the militant's pay,
// the guest at the stadium's big day; the line said, or why not (the start undone).
func (h *Handler) civicAct(ctx context.Context, tx pgx.Tx, s *Sim, placeID string, it game.Interaction) (string, int, error) {
	switch it.ID {
	case game.CampaignTourID:
		if err := politics.Tour(ctx, tx, s.ID, placeID); err != nil {
			return "", 0, err
		}
		return fmt.Sprintf("%s fait campagne : poignées de main, casquettes et t-shirts. +%d points dans la commune.", s.FirstName, game.TourPoints), 0, nil
	case game.MilitantID:
		name, paid, err := politics.Militate(ctx, tx, s.ID, s.Commune, func(pay int) int {
			return s.wallet().Take(s.today(), game.FromPlayers, pay, s.passOn())
		})
		if err != nil {
			return "", 0, err
		}
		s.Money += paid
		return fmt.Sprintf("%s milite pour %s : tracts, affiches et porte-à-porte. +%s Djai.", s.FirstName, name, money(paid)), paid, nil
	case game.FeteID, game.MeetingID:
		title, end, err := politics.Attend(ctx, tx, s.ID, placeID, it.ID)
		if err != nil {
			return "", 0, err
		}
		// Till the end of the big day (from the doors, the wait is part of it).
		a := s.Activity
		a.Interaction.Label = it.Label + " : " + title
		if left := int64(time.Until(end).Minutes()); left > 0 {
			a.End = s.GameMinutes + left
		}
		return fmt.Sprintf("%s est au stade pour %s.", s.FirstName, title), 0, nil
	}
	return "", 0, nil
}
