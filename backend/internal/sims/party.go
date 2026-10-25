package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Soirées: a player throws one at home, in its own commune, for three
// hours. The others there see the lights over the house on the map and come
// to dance, mix at the decks, have a drink (game/soiree.go); friends
// elsewhere are told. It goes on at the house by itself: the host isn't held
// there (an action on the house, not on the Sim), and comes when it likes. The host pays for it (a sink): nothing done there
// pays. Its theme is picked from a list, like everything players say to one
// another (never free text).

// PartyThemes: what a soirée can be (its title is « <theme> chez <host> »).
var PartyThemes = []struct{ ID, Label string }{
	{"coupe-decale", "Soirée coupé-décalé"},
	{"zouglou", "Soirée zouglou"},
	{"anniversaire", "Anniversaire"},
	{"blanche", "Soirée blanche"},
	{"pagne", "Soirée pagne"},
	{"cremaillere", "Crémaillère"},
	{"afro", "Soirée afrobeats"},
	{"retro", "Soirée rétro"},
}

// Party is what the players of the commune see of a soirée.
type Party struct {
	ID       string    `json:"id"`
	Host     string    `json:"host"`
	HostName string    `json:"hostName"`
	Theme    string    `json:"theme"`
	Title    string    `json:"title"`
	City     string    `json:"city"`
	Commune  string    `json:"commune"`
	Ends     time.Time `json:"ends"`
	Guests   int       `json:"guests"`
}

// PlaceID: the virtual place it's held at.
func (p Party) PlaceID() string { return game.SoireePrefix + p.ID }

// Name: as the menus show it.
func (p Party) Name() string { return p.Title + " chez " + p.HostName }

func themeLabel(id string) (string, bool) {
	for _, t := range PartyThemes {
		if t.ID == id {
			return t.Label, true
		}
	}
	return "", false
}

var (
	errPartyGone   = errors.New("la soirée est finie")
	errPartyAway   = errors.New("rentre d'abord chez toi : la soirée se fait à la maison")
	errPartyOn     = errors.New("ta soirée bat déjà son plein")
	errPartyAdult  = errors.New("il faut être adulte pour organiser une soirée")
	errPartyHost   = errors.New("seul·e l'hôte reçoit ses invités")
	errPartyTheme  = errors.New("choisis le thème de ta soirée")
	errPartyNoneOn = errors.New("tu n'as pas de soirée en cours")
)

const partyColumns = `p.id, p.host_sim, h.first_name, p.theme, p.city, p.commune, p.ends_at, (SELECT count(*) FROM soiree_guests g WHERE g.soiree_id = p.id)`

func scanParty(row pgx.Row) (Party, error) {
	var p Party
	err := row.Scan(&p.ID, &p.Host, &p.HostName, &p.Theme, &p.City, &p.Commune, &p.Ends, &p.Guests)
	p.Title, _ = themeLabel(p.Theme)
	return p, err
}

// loadParty: the soirée a place id names (« soiree:<id> »), still going, onto the Sim (interactAt reads it); nothing for any other place.
func loadParty(ctx context.Context, q queryer, s *Sim, placeID string) error {
	id, ok := strings.CutPrefix(placeID, game.SoireePrefix)
	if !ok {
		return nil
	}
	p, err := scanParty(q.QueryRow(ctx, `SELECT `+partyColumns+` FROM soirees p JOIN sims h ON h.id = p.host_sim WHERE p.id::text = $1 AND p.ends_at > now()`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return errPartyGone
	}
	if err != nil {
		return err
	}
	s.party = &p
	return nil
}

// atParty: the soirée's place kind for interactAt, and its name; the Sim must be in its commune.
func (s *Sim) atParty(placeID, interactionID string) (game.PlaceKind, string, error) {
	p := s.party
	if p == nil || p.PlaceID() != placeID {
		return game.PlaceKind{}, "", errPartyGone
	}
	if p.City != s.City || p.Commune != s.Commune {
		if _, cm, ok := world.FindCommune(p.City, p.Commune); ok {
			return game.PlaceKind{}, "", fmt.Errorf("va d'abord %s", inCommune(cm.Name))
		}
		return game.PlaceKind{}, "", errPartyGone
	}
	if interactionID == game.SoireeHostID && p.Host != s.ID {
		return game.PlaceKind{}, "", errPartyHost
	}
	return game.Kinds[game.SoireeKind], p.Name(), nil
}

// arrive: a guest's first time at the soirée: counted, the host told, the two closer.
func (h *Handler) arrive(ctx context.Context, tx pgx.Tx, s *Sim) error {
	p := s.party
	if p == nil || p.Host == s.ID {
		return nil
	}
	tag, err := tx.Exec(ctx, `INSERT INTO soiree_guests (soiree_id, sim_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, p.ID, s.ID)
	if err != nil || tag.RowsAffected() == 0 {
		return err
	}
	if err := befriend(ctx, tx, s.ID, p.Host, JoinFriendship); err != nil {
		return err
	}
	return insertEvent(ctx, tx, p.Host, "social", fmt.Sprintf("%s est venu·e à ta soirée !", s.FirstName), 0, game.MinuteOf(time.Now()))
}

// throwParty: POST /sims/{id}/soiree {theme}: the soirée starts at home, the host receiving.
func (h *Handler) throwParty(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Theme string `json:"theme"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		title, ok := themeLabel(req.Theme)
		switch {
		case !ok:
			return game.Outcome{}, nil, errPartyTheme
		case s.stage().ID != game.StageAdulte:
			return game.Outcome{}, nil, errPartyAdult
		case s.City != s.HomeCity || s.Commune != s.HomeCommune:
			return game.Outcome{}, nil, errPartyAway
		case s.Money < game.SoireeCost:
			return game.Outcome{}, nil, fmt.Errorf("il te faut %d Djai pour la sono, le DJ et les boissons", game.SoireeCost)
		}
		var on bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM soirees WHERE host_sim = $1 AND ends_at > now())`, s.ID).Scan(&on); err != nil {
			return game.Outcome{}, nil, err
		}
		if on {
			return game.Outcome{}, nil, errPartyOn
		}
		p := Party{Host: s.ID, HostName: s.FirstName, Theme: req.Theme, Title: title, City: s.City, Commune: s.Commune}
		if err := tx.QueryRow(ctx, `INSERT INTO soirees (host_sim, city, commune, theme, ends_at) VALUES ($1, $2, $3, $4, now() + $5 * interval '1 hour') RETURNING id, ends_at`,
			s.ID, s.City, s.Commune, req.Theme, game.SoireeHours).Scan(&p.ID, &p.Ends); err != nil {
			return game.Outcome{}, nil, err
		}
		// The soirée goes on at the house on its own: the host isn't held there, busy or not (« Recevoir
		// tes invités » is one of its actions, when the host comes to it).
		s.Money -= game.SoireeCost
		// The friends are told, wherever they are; those with notifications on, on their phone.
		where := "chez " + s.FirstName
		if _, cm, ok := world.FindCommune(s.City, s.Commune); ok {
			where += " " + inCommune(cm.Name)
		}
		rows, err := tx.Query(ctx, `SELECT CASE WHEN sim_a = $1 THEN sim_b ELSE sim_a END FROM bonds WHERE (sim_a = $1 OR sim_b = $1) AND friends ORDER BY friendship DESC LIMIT 50`, s.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		friends, err := pgx.CollectRows(rows, pgx.RowTo[string])
		if err != nil {
			return game.Outcome{}, nil, err
		}
		now := game.MinuteOf(time.Now())
		for _, f := range friends {
			if err := insertEvent(ctx, tx, f, "social", fmt.Sprintf("%s %s : viens danser !", title, where), 0, now); err != nil {
				return game.Outcome{}, nil, err
			}
			h.Push.ToSim(f, push.Message{Title: title + " " + where, Body: "La soirée a commencé, viens danser !", URL: "/jeu", Tag: "soiree-" + p.ID})
		}
		text := fmt.Sprintf("%s : c'est parti chez toi pour %d h ! Les lumières sont allumées au-dessus de la maison, les joueurs du quartier peuvent venir. Rejoins-la quand tu veux.", title, game.SoireeHours)
		return game.Outcome{Text: text, Money: -game.SoireeCost}, []Event{{Kind: "social", Text: text, Money: -game.SoireeCost, GameTime: s.GameMinutes}}, nil
	})
}

// endParty: POST /sims/{id}/soiree/fin: the host turns the music off.
func (h *Handler) endParty(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		var id string
		err := tx.QueryRow(ctx, `UPDATE soirees SET ends_at = now() WHERE host_sim = $1 AND ends_at > now() RETURNING id`, s.ID).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return game.Outcome{}, nil, errPartyNoneOn
		}
		if err != nil {
			return game.Outcome{}, nil, err
		}
		// Receiving its guests still: that's over too.
		if a := s.Activity; a != nil && a.PlaceID == game.SoireePrefix+id {
			if _, err := s.stop(); err != nil {
				return game.Outcome{}, nil, err
			}
		}
		text := "Fin de la soirée : la musique s'arrête, les derniers invités rentrent."
		return game.Outcome{Text: text}, []Event{{Kind: "social", Text: text, GameTime: s.GameMinutes}}, nil
	})
}

// queueParties: the soirées going on in the Sim's commune (around, players.go).
func queueParties(b *pgx.Batch, simID string, into *[]Party) {
	b.Queue(`SELECT `+partyColumns+` FROM soirees p JOIN sims h ON h.id = p.host_sim JOIN sims me ON me.id = $1
		WHERE p.city = me.city AND p.commune = me.commune AND p.ends_at > now()
		ORDER BY p.created_at DESC LIMIT 10`, simID).Query(func(rows pgx.Rows) error {
		for rows.Next() {
			if p, err := scanParty(rows); err == nil {
				*into = append(*into, p)
			}
		}
		return nil
	})
}
