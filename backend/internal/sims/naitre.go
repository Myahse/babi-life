package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Born, then played grown up (the update « naitre-adulte », game/naitre.go; web components/Souvenirs.tsx,
// components/NaitreCards.tsx). Closed, nothing here runs: childhood is played as before. Open:
//   - A new Sim is born as before (the family drawn, the birth's card), then waits with souvenirs = 'due'
//     for its « Souvenirs d'enfance » (POST souvenirs): where it grew up, its school, its friend from
//     childhood, what it was like as a child. They're applied, then the Sim is aged to 18 through the usual
//     coming of age (ageTo, comeOfAge: the family's money, the first home, the mentor, the friend).
//   - A Sim that is still a baby, a child or a teenager is made an adult on its next load, in the same
//     transaction as the load (naitreTurn), through the same ageTo: its marks give the BEPC and the bac as
//     before, its friend from childhood stays. Once (grown_notice) the game says why.
//   - The players who had paid « grandir vite » are thanked as « Pionnier » once (the pionniers table).

// naitreOpen: the update is with the players (never in the tests that don't set the features up).
func naitreOpen(ctx context.Context) bool {
	return features.Default != nil && features.Default.BlocksKey(ctx, game.NaitreKey) == ""
}

// PionnierInfo: the account is a « Pionnier » (it had paid to grow up at once): the Djai it was given,
// and whether the thank-you card was seen.
type PionnierInfo struct {
	Djai int  `json:"djai"`
	Seen bool `json:"seen"`
}

// pionnierSQL: read with the Sim in mutateWith: the account's Pionnier row (its Djai, seen), and what it paid
// to grow up at once (credited, not a test, not refunded).
const pionnierSQL = `(SELECT p.djai FROM pionniers p WHERE p.user_id = sims.user_id),
	(SELECT p.seen_at IS NOT NULL FROM pionniers p WHERE p.user_id = sims.user_id),
	(SELECT COALESCE(sum(pu.price), 0)::int FROM purchases pu WHERE pu.user_id = sims.user_id AND pu.kind = 'grandir'
		AND pu.credited_at IS NOT NULL AND NOT pu.sandbox AND pu.status <> 'refunded')`

// pionnierRead: what pionnierSQL scans into.
type pionnierRead struct {
	djai *int
	seen *bool
	paid int
}

// grownLine: what the journal says to a Sim made an adult by the update.
const grownLine = "Babi Life change : on ne joue plus l'enfance, tout le monde vit sa vie d'adulte. %s a 18 ans aujourd'hui, avec ce que son enfance lui a laissé."

// naitreTurn, on every load of the Sim (mutateWith), the update open: a minor (not one answering its
// souvenirs) made an adult, said once; an account that paid « grandir vite » made a Pionnier, once.
func naitreTurn(ctx context.Context, tx pgx.Tx, s *Sim, userID string, p pionnierRead) ([]Event, error) {
	if p.djai != nil {
		s.Pionnier = &PionnierInfo{Djai: *p.djai, Seen: p.seen != nil && *p.seen}
	}
	if !naitreOpen(ctx) {
		return nil, nil
	}
	var events []Event
	if s.BornAt != 0 && s.minor() && s.Souvenirs != "due" {
		events = append(events, s.growUpNow()...)
		s.GrownNotice = "due"
		events = append(events, Event{Kind: "life", Text: fmt.Sprintf(grownLine, s.FirstName), GameTime: s.GameMinutes})
	}
	if s.Pionnier == nil && p.paid > 0 {
		djai := game.PionnierDjai(p.paid)
		tag, err := tx.Exec(ctx, `INSERT INTO pionniers (user_id, sim_id, paid, djai) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, userID, s.ID, p.paid, djai)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 1 {
			// The flag the quartier reads (update « mon-quartier »: it starts at level 2), on each of the account's Sims.
			if _, err := tx.Exec(ctx, `UPDATE sims SET pionnier = true WHERE user_id = $1`, userID); err != nil {
				return nil, err
			}
			s.Money += djai
			s.Pionnier = &PionnierInfo{Djai: djai}
			events = append(events, Event{Kind: "transfer", Text: fmt.Sprintf("Merci, Pionnier ! Tu avais payé pour grandir plus vite : %s Djai offerts, le badge « Pionnier » et le pin exclusif (Mon look).", thousands(djai)), Money: djai, GameTime: s.GameMinutes})
		}
	}
	return events, nil
}

// growUpNow: a minor made an adult at once (the update): the birthdays on the way and the coming of age
// (ageTo); a child's activity it can't do any more (the crèche, the bouillie…) stopped.
func (s *Sim) growUpNow() []Event {
	events := s.ageTo(game.StageByID(game.StageAdulte))
	if a := s.Activity; a != nil && a.Kind == "do" && a.Interaction.AllowedFor(game.StageAdulte) != nil {
		s.Activity = nil
	}
	return events
}

// thousands: 150000 → « 150 000 ».
func thousands(n int) string {
	s := fmt.Sprint(n)
	var b strings.Builder
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteRune(' ')
		}
		b.WriteRune(c)
	}
	return b.String()
}

var (
	errNoSouvenirs = errors.New("tes souvenirs d'enfance sont déjà là")
	errSouvenir    = errors.New("souvenir inconnu")
)

// souvenirsView: GET /sims/{id}/souvenirs: what the questions offer that the server makes (the three friends
// from childhood, the village's languages).
func (h *Handler) souvenirsView(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var commune, family, state string
	var minutes int64
	if err := h.DB.QueryRow(r.Context(), `SELECT home_commune, family, game_minutes, souvenirs FROM sims WHERE id = $1 AND user_id = $2`, id, auth.UserID(r.Context())).Scan(&commune, &family, &minutes, &state); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	f, _ := game.FindFamily(family)
	httpx.JSON(w, http.StatusOK, map[string]any{"due": state == "due", "friends": game.FriendChoices(id, commune, minutes), "languages": game.VillageLanguages(), "family": f,
		"savings": map[string]int{game.SchoolCM2: game.SchoolSavings(f, game.SchoolCM2), game.SchoolBEPC: game.SchoolSavings(f, game.SchoolBEPC), game.SchoolBac: f.BacGift}})
}

// souvenirsRequest: the four answers.
type souvenirsRequest struct {
	Grew     string `json:"grew"`
	Language string `json:"language,omitempty"`
	School   string `json:"school"`
	// Friend: the friend from childhood picked among the three (0..2), -1 for none.
	Friend int    `json:"friend"`
	Talent string `json:"talent,omitempty"`
}

// souvenirs: POST /sims/{id}/souvenirs: the answers applied, then the Sim at 18.
func (h *Handler) souvenirs(w http.ResponseWriter, r *http.Request) {
	if !naitreOpen(r.Context()) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	var req souvenirsRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		events, err := s.applySouvenirs(r.Context(), tx, req)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		_, _ = tx.Exec(r.Context(), `INSERT INTO user_funnel (user_id, step) VALUES ($1, 'souvenirs_done') ON CONFLICT DO NOTHING`, auth.UserID(r.Context()))
		return game.Outcome{Text: fmt.Sprintf("%s a 18 ans : la vie d'adulte commence !", s.FirstName)}, events, nil
	})
}

// applySouvenirs: the four souvenirs, then 18 years old (in tx: the traits and languages are saved apart).
func (s *Sim) applySouvenirs(ctx context.Context, tx pgx.Tx, req souvenirsRequest) ([]Event, error) {
	if s.Souvenirs != "due" || s.BornAt == 0 || !s.minor() {
		return nil, errNoSouvenirs
	}
	if !slices.Contains(game.GrewUp, req.Grew) || !slices.Contains(game.Schoolings, req.School) || req.Friend < -1 || req.Friend > 2 {
		return nil, errSouvenir
	}
	if req.Grew == game.GrewVillage && !slices.Contains(game.VillageLanguages(), req.Language) {
		return nil, errSouvenir
	}
	if req.Talent != "" && game.ChildTraits[req.Talent] == "" {
		return nil, errSouvenir
	}
	if s.Family == "" {
		s.Family = "poignon"
	}
	rng := newRand()
	at := s.GameMinutes
	var events []Event
	extra := 0
	// Where one grew up: the family nudged (or not), and its perk.
	f, moved := game.NudgeFamily(s.family(), req.Grew, rng)
	if moved {
		s.Family, s.Housing = f.ID, f.Housing
		events = append(events, Event{Kind: "life", Text: fmt.Sprintf("Pendant ton enfance, la famille a monté d'un cran : elle est maintenant %s. %s", strings.ToLower(f.Label), f.Hint), GameTime: at})
	}
	switch req.Grew {
	case game.GrewCour:
		for i := range game.CourNeighbours {
			n := game.Neighbour(s.ID, s.HomeCommune, i, at, rng)
			if s.findFriend(n.ID) == nil && len(s.Friends) < game.MaxFriends {
				s.Friends = append(s.Friends, n)
			}
		}
		events = append(events, Event{Kind: "life", Text: "Tu as grandi dans une cour commune : tout le quartier te connaît, et deux voisins de la cour sont restés tes amis.", GameTime: at})
	case game.GrewVilla:
		if !moved {
			extra += game.VillaBonus(f)
		}
		events = append(events, Event{Kind: "life", Text: "Tu as grandi dans une villa : la famille t'aide un peu plus pour démarrer.", GameTime: at})
	case game.GrewVillage:
		extra += game.VillageSavings
		if !slices.Contains(s.Languages, req.Language) {
			s.Languages = append(s.Languages, req.Language)
			if _, err := tx.Exec(ctx, `UPDATE sims SET languages = $2 WHERE id = $1`, s.ID, s.Languages); err != nil {
				return nil, err
			}
		}
		events = append(events, Event{Kind: "life", Text: fmt.Sprintf("Tu as grandi au village avant de venir à Abidjan : tu parles %s, et la débrouille t'a laissé un peu d'économies.", the(req.Language, false)), GameTime: at})
	}
	// The school: where one stopped sets the diplomas (comeOfAge reads the marks) and the savings.
	switch req.School {
	case game.SchoolBac:
		s.Performance = game.BacMarks
	case game.SchoolBEPC:
		s.Performance = game.BacMarks / 2
	default:
		s.Performance = 0
	}
	if etudesOpen(ctx) {
		// The studies' update open: the exams are in the studies (comeOfAge reads the bac there), the family's gift given here.
		e := s.etudes()
		if req.School != game.SchoolCM2 {
			e.BEPC = &game.Exam{Note: game.PassNote, On: at}
		}
		if req.School == game.SchoolBac {
			e.BAC = &game.Exam{Note: game.PassNote, On: at}
			extra += f.BacGift
		}
		s.paperSync = true
	}
	if save := game.SchoolSavings(f, req.School); save > 0 {
		extra += save
		events = append(events, Event{Kind: "life", Text: fmt.Sprintf("Tu as quitté l'école tôt et travaillé à côté : %s d'économies à 18 ans.", game.FCFA(save)), Money: save, GameTime: at})
	}
	// The friend from childhood (none if the update « ami-enfance »'s friend is already there).
	if req.Friend >= 0 && s.childhoodFriend() == nil {
		fr := game.FriendChoices(s.ID, s.HomeCommune, at)[req.Friend]
		s.Friends = append(s.Friends, fr)
	}
	// What one was like as a child: a trait.
	if req.Talent != "" {
		ev, err := s.childTrait(ctx, tx, req.Talent)
		if err != nil {
			return nil, err
		}
		events = append(events, ev...)
	}
	s.Money += extra
	s.Souvenirs = "done"
	// 18 years old: the family's money, the first home, the mentor, the friend grown up too (comeOfAge).
	events = append(events, s.growUpNow()...)
	return events, nil
}

// childLines: « Petit, tu étais… », said in the journal.
var childLines = map[string]string{
	"ballon":    "Petit, tu ne lâchais jamais le ballon : te voilà sportif·ve.",
	"tamtam":    "Petit, tu tapais sur tout ce qui sonnait : le rythme est resté, te voilà artiste.",
	"livre":     "Petit, tu avais toujours un livre à la main : te voilà travailleur·se.",
	"telephone": "Petit, tu prenais le téléphone de papa pour parler à tout le monde : te voilà charmeur·se.",
}

// childTrait: « Petit, tu étais… » answered (once: the talent column, like the baby's toy): its trait, even
// beyond the three chosen at creation (one more, the childhood's own).
func (s *Sim) childTrait(ctx context.Context, tx pgx.Tx, talent string) ([]Event, error) {
	trait := game.ChildTraits[talent]
	if trait == "" {
		return nil, errSouvenir
	}
	tag, err := tx.Exec(ctx, `UPDATE sims SET talent = $2 WHERE id = $1 AND talent = ''`, s.ID, talent)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, errChosen
	}
	if !slices.Contains(s.Traits, trait) && len(s.Traits) <= game.MaxTraits {
		s.Traits = append(s.Traits, trait)
		if _, err := tx.Exec(ctx, `UPDATE sims SET traits = $2 WHERE id = $1`, s.ID, s.Traits); err != nil {
			return nil, err
		}
	}
	return []Event{{Kind: "life", Text: childLines[talent], GameTime: s.GameMinutes}}, nil
}

// naitreSeen: POST /sims/{id}/naitre/vu {what: notice|pionnier}: a card read; {what: trait, talent}: « Petit,
// tu étais… » answered by a Sim made an adult by the update (once, if its baby never chose its toy).
func (h *Handler) naitreSeen(w http.ResponseWriter, r *http.Request) {
	var req struct {
		What   string `json:"what"`
		Talent string `json:"talent,omitempty"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		switch req.What {
		case "notice":
			if s.GrownNotice == "due" {
				s.GrownNotice = "seen"
			}
			return game.Outcome{}, nil, nil
		case "pionnier":
			if s.Pionnier != nil {
				s.Pionnier.Seen = true
				_, err := tx.Exec(r.Context(), `UPDATE pionniers SET seen_at = now() WHERE user_id = $1 AND seen_at IS NULL`, auth.UserID(r.Context()))
				return game.Outcome{}, nil, err
			}
			return game.Outcome{}, nil, nil
		case "trait":
			if s.GrownNotice == "" {
				return game.Outcome{}, nil, errSouvenir
			}
			ev, err := s.childTrait(r.Context(), tx, req.Talent)
			if err != nil {
				return game.Outcome{}, nil, err
			}
			return game.Outcome{Text: ev[0].Text}, ev, nil
		}
		return game.Outcome{}, nil, errSouvenir
	})
}
