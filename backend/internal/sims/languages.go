package sims

import (
	"errors"
	"math/rand/v2"
	"net/http"
	"slices"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The languages the player speaks besides French, and the greetings said in
// them in the street (game/languages.go).

// maxLanguages: a player speaks a few, not the whole list.
const maxLanguages = 6

var errNotSpoken = errors.New("tu ne parles pas cette langue : ajoute-la dans ton profil (Langues parlées)")

// greetIn: a greeting in one of the Sim's languages. A passer-by who speaks
// it answers in it, delighted; one who doesn't smiles and says what theirs is.
func (s *Sim) greetIn(lang string, p Passerby, rng *rand.Rand) (chatAnswer, game.Needs, error) {
	if game.LanguageLabel(lang) == "" || !slices.Contains(s.Languages, lang) {
		return chatAnswer{}, game.Needs{}, errNotSpoken
	}
	theirs := game.NpcLanguages(p.Seed)
	if !slices.Contains(theirs, lang) {
		line := "{name} sourit : « " + the(lang, true) + ", moi je ne parle pas dèh. Moi c'est " + the(theirs[0], false) + " ! Mais on se comprend en français. »"
		return chatAnswer{Text: say([]string{line}, p, s, rng)}, game.Needs{Social: 3}, nil
	}
	line, _ := game.GreetReply(lang, int((s.GameMinutes/60)%24), s.Gender == "femme", p.Gender == "femme")
	return chatAnswer{Text: say([]string{line}, p, s, rng), Mood: "good"}, game.Needs{Social: 12, Fun: 6}, nil
}

// the: « le baoulé », « l'anglais » (« Le », « L' » first in a sentence).
func the(lang string, first bool) string {
	name := strings.ToLower(game.LanguageLabel(lang))
	art := "le "
	if strings.ContainsRune("aeéiou", []rune(name)[0]) {
		art = "l'"
	}
	if first {
		art = strings.ToUpper(art[:1]) + art[1:]
	}
	return art + name
}

// setLanguages: PUT /sims/{id}/languages {languages} — the languages the player speaks.
func (h *Handler) setLanguages(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Languages []string `json:"languages"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	out := []string{}
	for _, l := range req.Languages {
		if game.LanguageLabel(l) != "" && !slices.Contains(out, l) {
			out = append(out, l)
		}
	}
	if len(out) > maxLanguages {
		httpx.Error(w, http.StatusUnprocessableEntity, "six langues au plus")
		return
	}
	tag, err := h.DB.Exec(r.Context(), `UPDATE sims SET languages = $1 WHERE id = $2 AND user_id = $3`, out, chi.URLParam(r, "id"), auth.UserID(r.Context()))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"languages": out})
}
