package i18n

import (
	"compress/gzip"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEnglish(t *testing.T) {
	cases := map[string]string{
		// As written in the catalogue.
		"Aller à l'école": "Go to school",
		// A fmt pattern, its parts in English too (a job's title).
		"Aller au travail (Caissier·ère)":    "Go to work (Cashier)",
		"Samedi : loyer de ton Studio payé.": "Saturday: rent for your Studio paid.",
		// Unknown: as it is.
		"Mon frère a écrit ça tout seul": "Mon frère a écrit ça tout seul",
	}
	for fr, want := range cases {
		if want == "" {
			continue
		}
		if got := English(fr); got != want {
			t.Errorf("English(%q) = %q, want %q", fr, got, want)
		}
	}
	// {name} : « … » patterns.
	if got := English("Awa rigole : « Encore ? Change de disque un peu ! »"); got != "Awa laughs: « Again? Change the record a bit! »" {
		t.Errorf("brace pattern: %q", got)
	}
	// Two texts put one after the other.
	if got := English("Défi refusé. Bonne année !"); got != "Challenge declined. Happy New Year!" {
		t.Errorf("split: %q", got)
	}
}

func TestComposed(t *testing.T) {
	cases := map[string]string{
		// A date the code writes out, its day, month and hour in English.
		"Le vote ouvre dimanche 2 novembre à 20 h. D'ici là, lis les programmes.": "Voting opens Sunday 2 November at 20:00. Until then, read the programmes.",
		// A commune after its French preposition.
		"Nouveau maire d'Abobo": "New mayor of Abobo",
		"Tu es candidat·e à la mairie du Plateau ! Fais campagne : affiches, tournées, meeting.": "You're a candidate at the town hall of Plateau! Campaign: posters, tours, a rally.",
	}
	for fr, want := range cases {
		if got := English(fr); got != want {
			t.Errorf("English(%q) = %q, want %q", fr, got, want)
		}
	}
}

func TestSameVerbs(t *testing.T) {
	if !SameVerbs("Tu as %d amis à %s", "You have %d friends in %s") {
		t.Error("same verbs")
	}
	if !SameVerbs("%s est %s", "%[2]s is %[1]s") {
		t.Error("numbered verbs")
	}
	if SameVerbs("%s", "%s %s") {
		t.Error("one verb too many")
	}
	if SameVerbs("{name} rit", "{other} laughs") {
		t.Error("a {name} the French hasn't")
	}
}

func TestMiddleware(t *testing.T) {
	h := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "Dormir", "label": "Dormir", "n": 12345678901, "lang": Lang(r.Context())})
	}))
	for _, lang := range []string{"en", "fr"} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v1/world", nil)
		req.Header.Set("X-Lang", lang)
		h.ServeHTTP(rec, req)
		var out map[string]any
		dec := json.NewDecoder(rec.Body)
		dec.UseNumber()
		if err := dec.Decode(&out); err != nil {
			t.Fatal(err)
		}
		want := map[string]string{"en": "Sleep", "fr": "Dormir"}[lang]
		if out["label"] != want || out["id"] != "Dormir" || out["lang"] != lang || out["n"].(json.Number).String() != "12345678901" {
			t.Errorf("%s: %v", lang, out)
		}
	}
}

// A route that compresses its own answer (middleware.Compress on /world): still translated.
func TestMiddlewareGzip(t *testing.T) {
	h := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Encoding", "gzip")
		zw := gzip.NewWriter(w)
		_ = json.NewEncoder(zw).Encode(map[string]string{"label": "Dormir"})
		_ = zw.Close()
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/v1/world", nil)
	req.Header.Set("X-Lang", "en")
	h.ServeHTTP(rec, req)
	zr, err := gzip.NewReader(rec.Body)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]string
	if err := json.NewDecoder(zr).Decode(&out); err != nil || out["label"] != "Sleep" {
		t.Errorf("gzip: %v %v", out, err)
	}
}
