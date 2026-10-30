package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// A baby's « premières fois » (update « premieres-fois », web
// components/Firsts.tsx): the first smile, the first bouillie, the first
// tooth… each one comes the first time the baby does what brings it, once,
// said in the journal; all of them, a happy baby. And its choices that count
// (update « choix-bebe »): the toy it goes for gives the child a gift (a
// trait, or marks ahead at school), and its first word stays its own.

type First struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	// How: what brings it (said in the list).
	How string `json:"how"`
	// Where: where it's done (the milestone childhood shows it, grandir.go).
	Where string `json:"where"`
	// Line: what the journal says when it comes.
	Line string `json:"-"`
	// By: the interaction that brings it.
	By string `json:"-"`
}

var Firsts = []First{
	{ID: "sourire", Label: "Le premier sourire", Icon: "heart", How: "Un câlin à maman", Where: "Chez toi", Line: "Premier sourire ! Maman fond, elle appelle toute la cour pour voir.", By: "calin"},
	{ID: "bouillie", Label: "La première bouillie", Icon: "soup", How: "Manger la bouillie", Where: "Chez toi, à la cuisine", Line: "Première bouillie : il y en a partout, et c'est délicieux.", By: "bouillie"},
	{ID: "bain", Label: "Le premier bain", Icon: "bath", How: "Le bain avec maman", Where: "Chez toi, à la salle de bain", Line: "Premier bain : ça éclabousse, ça rigole.", By: "bain-bebe"},
	{ID: "dent", Label: "La première dent", Icon: "baby", How: "Jouer avec le hochet", Where: "Chez toi", Line: "Première dent ! Le hochet en garde la trace.", By: "hochet"},
	{ID: "rire", Label: "Le premier éclat de rire", Icon: "party-popper", How: "Coucou-caché avec maman", Where: "Chez toi", Line: "Premier éclat de rire, au coucou de maman : toute la maison rit avec toi.", By: "coucou"},
	{ID: "pas", Label: "Les premiers pas", Icon: "footprints", How: "Les premiers pas vers papa", Where: "Chez toi", Line: "Premiers pas ! Trois petits pas jusqu'à papa, qui crie de joie.", By: "premiers-pas"},
	{ID: "creche", Label: "Le premier jour de crèche", Icon: "users", How: "Aller à la crèche", Where: "Chez toi, de 7 h à 17 h", Line: "Premier jour de crèche : de nouveaux copains, et la tantie nounou.", By: "creche"},
	{ID: "mot", Label: "Le premier mot", Icon: "messages-square", How: "Dire son premier mot", Where: "Chez toi", Line: "Premier mot !", By: "premier-mot"},
}

// firstFor: the « première fois » this interaction brings, if it's the first (and the baby's), said; all done, the treat.
func firstFor(ctx context.Context, tx pgx.Tx, s *Sim, interaction string) []Event {
	if s.stage().ID != game.StageBebe || !firstsOn(ctx) {
		return nil
	}
	i := slices.IndexFunc(Firsts, func(f First) bool { return f.By == interaction })
	// The first word: said when it's chosen (choose), unless the choices aren't open: then « Maman ».
	if i < 0 || (Firsts[i].ID == "mot" && features.Default.BlocksKey(ctx, "choix-bebe") == "") {
		return nil
	}
	return markFirst(ctx, tx, s, Firsts[i], "")
}

func markFirst(ctx context.Context, tx pgx.Tx, s *Sim, f First, extra string) []Event {
	tag, err := tx.Exec(ctx, `INSERT INTO sim_firsts (sim_id, id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, s.ID, f.ID)
	if err != nil || tag.RowsAffected() == 0 {
		return nil
	}
	line := f.Line
	if f.ID == "mot" && extra == "" {
		line = "Premier mot : « Maman » ! Elle en pleure de joie."
	} else if extra != "" {
		line += " " + extra
	}
	events := []Event{{Kind: "life", Text: line, GameTime: s.GameMinutes}}
	// All of them (those it can do, growing up by milestones: grandir.go firstsDue), the treat.
	due := Firsts
	if stepsOpen(ctx) {
		due = firstsDue(ctx)
	}
	if done, err := doneIDs(ctx, tx, "sim_firsts", s.ID); err == nil && allDone(firstIDs(due), done) {
		s.Needs = s.Needs.Add(game.Needs{Fun: 25, Social: 25})
		events = append(events, Event{Kind: "life", Text: fmt.Sprintf("Toutes les premières fois de %s ! Papa et maman les racontent à toute la famille. Le bébé est aux anges.", s.FirstName), GameTime: s.GameMinutes})
	}
	return events
}

// firsts: GET /sims/{id}/firsts: the list, those done, and the choices made.
func (h *Handler) firsts(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var talent, word string
	if err := h.DB.QueryRow(r.Context(), `SELECT talent, first_word FROM sims WHERE id = $1 AND user_id = $2`, id, auth.UserID(r.Context())).Scan(&talent, &word); err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	done := []string{}
	rows, err := h.DB.Query(r.Context(), `SELECT id FROM sim_firsts WHERE sim_id = $1`, id)
	if err == nil {
		for rows.Next() {
			var f string
			if rows.Scan(&f) == nil {
				done = append(done, f)
			}
		}
		rows.Close()
	}
	// Growing up by milestones (grandir.go): only those it can do now, and the baby becomes a child once they're done.
	list, grow := Firsts, stepsOpen(r.Context())
	if grow {
		list = firstsDue(r.Context())
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"list": list, "done": done, "talent": talent, "word": word, "talents": Talents, "words": Words, "grow": grow})
}

/* ---------- The choices that count ---------- */

type Talent struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	Gift  string `json:"gift"`
	trait string
}

// Talents: the toy the baby goes for, and what the child gets from it.
var Talents = []Talent{
	{ID: "ballon", Label: "Le ballon", Icon: "volleyball", Gift: "Sportif : le foot dans le sang", trait: "sportif"},
	{ID: "tamtam", Label: "Le tam-tam", Icon: "drum", Gift: "Artiste : le rythme dans la peau", trait: "artiste"},
	{ID: "livre", Label: "Le livre", Icon: "book-open", Gift: "Studieux : de bonnes notes d'avance pour le bac"},
	{ID: "telephone", Label: "Le téléphone de papa", Icon: "smartphone", Gift: "Charmeur : le verbe facile", trait: "dragueur"},
}

// Words: the first words to choose from.
var Words = []string{"Maman", "Papa", "Garba !", "Dêh !", "Ma-ma-man", "Tonton"}

var errChosen = errors.New("c'est déjà choisi")

// choose: POST /sims/{id}/choice {kind: talent|mot, value}: once each, while a baby.
func (h *Handler) choose(w http.ResponseWriter, r *http.Request) {
	if features.Default.BlocksKey(r.Context(), "choix-bebe") != "" {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	var req struct {
		Kind  string `json:"kind"`
		Value string `json:"value"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if s.stage().ID != game.StageBebe {
			return game.Outcome{}, nil, errors.New("c'est un choix de bébé")
		}
		switch req.Kind {
		case "talent":
			i := slices.IndexFunc(Talents, func(t Talent) bool { return t.ID == req.Value })
			if i < 0 {
				return game.Outcome{}, nil, errors.New("jouet inconnu")
			}
			t := Talents[i]
			tag, err := tx.Exec(r.Context(), `UPDATE sims SET talent = $2 WHERE id = $1 AND talent = ''`, s.ID, t.ID)
			if err != nil {
				return game.Outcome{}, nil, err
			}
			if tag.RowsAffected() == 0 {
				return game.Outcome{}, nil, errChosen
			}
			// Its gift: a trait (if there's room for it), or the marks ahead for the bac.
			if t.trait == "" {
				s.Performance += 15
			} else if !slices.Contains(s.Traits, t.trait) && len(s.Traits) < game.MaxTraits {
				s.Traits = append(s.Traits, t.trait)
				if _, err := tx.Exec(r.Context(), `UPDATE sims SET traits = $2 WHERE id = $1`, s.ID, s.Traits); err != nil {
					return game.Outcome{}, nil, err
				}
			}
			text := fmt.Sprintf("Parmi tous les jouets, %s va droit vers %s. %s.", s.FirstName, game.LowerFirst(t.Label), t.Gift)
			return game.Outcome{Text: text}, []Event{{Kind: "life", Text: text, GameTime: s.GameMinutes}}, nil
		case "mot":
			if !slices.Contains(Words, req.Value) {
				return game.Outcome{}, nil, errors.New("mot inconnu")
			}
			tag, err := tx.Exec(r.Context(), `UPDATE sims SET first_word = $2 WHERE id = $1 AND first_word = ''`, s.ID, req.Value)
			if err != nil {
				return game.Outcome{}, nil, err
			}
			if tag.RowsAffected() == 0 {
				return game.Outcome{}, nil, errChosen
			}
			text := fmt.Sprintf("« %s » : le premier mot de %s ! Toute la famille le répète ; on l'entendra encore longtemps.", req.Value, s.FirstName)
			events := []Event{{Kind: "life", Text: text, GameTime: s.GameMinutes}}
			if firstsOn(r.Context()) {
				events = append(events, markFirst(r.Context(), tx, s, Firsts[len(Firsts)-1], fmt.Sprintf("« %s ».", req.Value))...)
			}
			return game.Outcome{Text: text}, events, nil
		}
		return game.Outcome{}, nil, errors.New("choix inconnu")
	})
}
