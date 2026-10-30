package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Soirées: a player throws one at home, in its own commune, for three
// hours. The others there see the lights over the house on the map and come
// to dance, mix at the decks, have a drink (game/soiree.go); friends
// elsewhere are told. It goes on at the house by itself: the host isn't held
// there (an action on the house, not on the Sim), and comes when it likes.
// The host pays for it (a sink): nothing done there pays. Its theme is picked
// from a list, like everything players say to one another (never free text).
//
// With the update « soiree-deco » (game.SoireeDecoKey), the host arranges the
// soirée's room (its own: the house's furniture stays as it is) and chooses
// the entry: free, or a price each guest pays coming in, to the host
// (game.FromEntry); the host's friends, and those it invited there, come in
// free. Closed, a soirée is as it was: free, in the club's own room.

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
	// Starts: when it began (the map shows it).
	Starts time.Time `json:"starts"`
	// Price: the entry, in Djai (0: free); Layout: the room as the host arranged it (none: the club's own).
	Price  int          `json:"price"`
	Layout []game.Piece `json:"layout,omitempty"`
	// Free: the one looking comes in without paying (the host's friend, invited, or in already).
	Free bool `json:"free,omitempty"`
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
	errDecoClosed  = errors.New("bientôt dans le jeu")
)

// decoOpen: the update « soiree-deco » is with the players (the room arranged, the entry paid).
func decoOpen(ctx context.Context) bool {
	return features.Default.BlocksKey(ctx, game.SoireeDecoKey) == ""
}

// pieceOpen: a piece of the room the host may put in now (a finer one waits for its own update).
func pieceOpen(ctx context.Context) func(game.Furniture) bool {
	return func(f game.Furniture) bool { return f.Key == "" || features.Default.BlocksKey(ctx, f.Key) == "" }
}

// partyColumns: a soirée as the players see it; $1 is the Sim looking (whether it comes in free).
const partyColumns = `p.id, p.host_sim, h.first_name, p.theme, p.city, p.commune, p.ends_at, (SELECT count(*) FROM soiree_guests g WHERE g.soiree_id = p.id),
	p.created_at, p.price, COALESCE(p.layout, 'null'::jsonb), ` + freeSQL

// freeSQL: the Sim $1 comes into the soirée p for nothing: the host's friend, invited there by the host, or in already.
const freeSQL = `(EXISTS (SELECT 1 FROM bonds b WHERE b.friends AND ((b.sim_a = p.host_sim AND b.sim_b = $1) OR (b.sim_b = p.host_sim AND b.sim_a = $1)))
	OR EXISTS (SELECT 1 FROM invites i WHERE i.from_sim = p.host_sim AND i.to_sim = $1 AND i.place_id = 'soiree:' || p.id::text)
	OR EXISTS (SELECT 1 FROM soiree_guests g WHERE g.soiree_id = p.id AND g.sim_id = $1))`

// scanParty: a soirée read; while « soiree-deco » is closed, free and in the club's own room, as before it.
func scanParty(ctx context.Context, row pgx.Row) (Party, error) {
	var p Party
	var layout []byte
	err := row.Scan(&p.ID, &p.Host, &p.HostName, &p.Theme, &p.City, &p.Commune, &p.Ends, &p.Guests, &p.Starts, &p.Price, &layout, &p.Free)
	p.Title, _ = themeLabel(p.Theme)
	if err == nil {
		_ = json.Unmarshal(layout, &p.Layout)
	}
	if !decoOpen(ctx) {
		p.Price, p.Layout = 0, nil
	}
	return p, err
}

// loadParty: the soirée a place id names (« soiree:<id> »), still going, onto the Sim (interactAt reads it); nothing for any other place.
func loadParty(ctx context.Context, q queryer, s *Sim, placeID string) error {
	id, ok := strings.CutPrefix(placeID, game.SoireePrefix)
	if !ok {
		return nil
	}
	p, err := scanParty(ctx, q.QueryRow(ctx, `SELECT `+partyColumns+` FROM soirees p JOIN sims h ON h.id = p.host_sim WHERE p.id::text = $2 AND p.ends_at > now()`, s.ID, id))
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

// arrive: a guest's first time at the soirée: counted, its entry paid (the
// price, to the host: none for a friend or one invited), the host told, the
// two closer. What the guest paid to come in.
func (h *Handler) arrive(ctx context.Context, tx pgx.Tx, s *Sim) (int, error) {
	p := s.party
	if p == nil || p.Host == s.ID {
		return 0, nil
	}
	tag, err := tx.Exec(ctx, `INSERT INTO soiree_guests (soiree_id, sim_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, p.ID, s.ID)
	if err != nil || tag.RowsAffected() == 0 {
		return 0, err
	}
	paid := 0
	if p.Price > 0 && !p.Free {
		if paid, err = payEntry(ctx, tx, s, p); err != nil {
			return 0, err
		}
		if _, err := tx.Exec(ctx, `UPDATE soiree_guests SET paid = $3 WHERE soiree_id = $1 AND sim_id = $2`, p.ID, s.ID, paid); err != nil {
			return 0, err
		}
	}
	if err := befriend(ctx, tx, s.ID, p.Host, JoinFriendship); err != nil {
		return 0, err
	}
	line := fmt.Sprintf("%s est venu·e à ta soirée !", s.FirstName)
	if paid > 0 {
		line = fmt.Sprintf("%s est venu·e à ta soirée : %s d'entrée pour toi !", s.FirstName, game.FCFA(paid))
	}
	return paid, insertEvent(ctx, tx, p.Host, "social", line, paid, game.MinuteOf(time.Now()))
}

// payEntry: the soirée's entry, from the guest to the host, within what the
// host may still take in today (game.FromEntry: past it, the entry is
// offered). A guest without the money, or whose Djai can't go to another
// player yet (money.go heldBack), doesn't come in.
func payEntry(ctx context.Context, tx pgx.Tx, s *Sim, p *Party) (int, error) {
	left, err := leftFor(ctx, tx, p.Host, game.FromEntry)
	if err != nil {
		return 0, err
	}
	price := min(p.Price, left)
	if price <= 0 {
		return 0, nil
	}
	if s.Money < price {
		return 0, fmt.Errorf("l'entrée est à %s : il te manque %s", game.FCFA(price), game.FCFA(price-max(s.Money, 0)))
	}
	if err := heldBack(ctx, tx, s.ID); err != nil {
		return 0, err
	}
	s.Money -= price
	return takeFor(ctx, tx, p.Host, game.FromEntry, price)
}

// entryNote: the journal's line with the entry paid said.
func entryNote(text string, paid int) string {
	if paid <= 0 {
		return text
	}
	return fmt.Sprintf("%s (entrée : %s)", text, game.FCFA(paid))
}

// partyDeco: the entry and the room asked for a new soirée, checked; while
// « soiree-deco » is closed, none may be asked (errDecoClosed). No room sent:
// the host's last soirée's, else game.PartyStart.
func partyDeco(ctx context.Context, tx pgx.Tx, hostID string, price int, layout *[]game.Piece) (int, []game.Piece, error) {
	if !decoOpen(ctx) {
		if price != 0 || layout != nil {
			return 0, nil, errDecoClosed
		}
		return 0, nil, nil
	}
	if err := game.CheckEntry(price); err != nil {
		return 0, nil, err
	}
	if layout != nil {
		if err := game.CheckLayout(*layout, pieceOpen(ctx)); err != nil {
			return 0, nil, err
		}
		return price, *layout, nil
	}
	var last []byte
	err := tx.QueryRow(ctx, `SELECT layout FROM soirees WHERE host_sim = $1 AND layout IS NOT NULL ORDER BY created_at DESC LIMIT 1`, hostID).Scan(&last)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return 0, nil, err
	}
	var pieces []game.Piece
	if json.Unmarshal(last, &pieces) != nil || game.CheckLayout(pieces, pieceOpen(ctx)) != nil {
		pieces = game.PartyStart
	}
	return price, pieces, nil
}

// arrangeParty: POST /sims/{id}/soiree/salle {layout}: the host rearranges its soirée's room while it goes on.
func (h *Handler) arrangeParty(w http.ResponseWriter, r *http.Request) {
	if !decoOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, errDecoClosed.Error())
		return
	}
	var req struct {
		Layout []game.Piece `json:"layout"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if err := setLayout(ctx, tx, s.ID, req.Layout); err != nil {
			return game.Outcome{}, nil, err
		}
		text := "La salle de ta soirée est prête : tes invités la voient comme tu l'as arrangée."
		return game.Outcome{Text: text}, nil, nil
	})
}

// setLayout: the room of the soirée the Sim is hosting (only its host's), checked and saved.
func setLayout(ctx context.Context, tx pgx.Tx, hostID string, layout []game.Piece) error {
	if err := game.CheckLayout(layout, pieceOpen(ctx)); err != nil {
		return err
	}
	if layout == nil {
		layout = []game.Piece{}
	}
	raw, err := json.Marshal(layout)
	if err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `UPDATE soirees SET layout = $2 WHERE host_sim = $1 AND ends_at > now()`, hostID, raw)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errPartyNoneOn
	}
	return nil
}

// throwParty: POST /sims/{id}/soiree {theme}: the soirée starts at home, the host receiving.
func (h *Handler) throwParty(w http.ResponseWriter, r *http.Request) {
	// An update the team opens from the admin (features).
	if features.Default.BlocksKey(r.Context(), "soiree") != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	var req struct {
		Theme string `json:"theme"`
		// With « soiree-deco »: the entry (0: free) and the room (none: the last soirée's).
		Price  int           `json:"price"`
		Layout *[]game.Piece `json:"layout"`
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
		price, layout, err := partyDeco(ctx, tx, s.ID, req.Price, req.Layout)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		var room []byte
		if layout != nil {
			if room, err = json.Marshal(layout); err != nil {
				return game.Outcome{}, nil, err
			}
		}
		p := Party{Host: s.ID, HostName: s.FirstName, Theme: req.Theme, Title: title, City: s.City, Commune: s.Commune, Price: price}
		if err := tx.QueryRow(ctx, `INSERT INTO soirees (host_sim, city, commune, theme, ends_at, price, layout) VALUES ($1, $2, $3, $4, now() + $5 * interval '1 hour', $6, $7) RETURNING id, ends_at`,
			s.ID, s.City, s.Commune, req.Theme, game.SoireeHours, price, room).Scan(&p.ID, &p.Ends); err != nil {
			return game.Outcome{}, nil, err
		}
		// The soirée goes on at the house on its own: the host isn't held there, busy or not (« Recevoir
		// tes invités » is one of its actions, when the host comes to it).
		s.Money -= game.SoireeCost
		// The friends are told, wherever they are; those with notifications on, on their phone.
		// Said as one pattern (the catalogue's), the party's title and the host's name in it.
		where := fmt.Sprintf("%s chez %s", title, s.FirstName)
		if _, cm, ok := world.FindCommune(s.City, s.Commune); ok {
			if cm.Name == "Plateau" {
				where = fmt.Sprintf("%s chez %s au Plateau", title, s.FirstName)
			} else {
				where = fmt.Sprintf("%s chez %s à %s", title, s.FirstName, cm.Name)
			}
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
			if err := insertEvent(ctx, tx, f, "social", fmt.Sprintf("%s : viens danser !", where), 0, now); err != nil {
				return game.Outcome{}, nil, err
			}
			h.Push.ToSim(f, push.Message{Title: where, Body: "La soirée a commencé, viens danser !", URL: "/jeu", Tag: "soiree-" + p.ID})
		}
		text := fmt.Sprintf("%s : c'est parti chez toi pour %d h ! Les lumières sont allumées au-dessus de la maison, les joueurs du quartier peuvent venir. Rejoins-la quand tu veux.", title, game.SoireeHours)
		if price > 0 {
			text += fmt.Sprintf(" L'entrée est à %s (gratuite pour tes amis).", game.FCFA(price))
		}
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
			if p, err := scanParty(context.Background(), rows); err == nil {
				*into = append(*into, p)
			}
		}
		return nil
	})
}
