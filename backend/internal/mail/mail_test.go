package mail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestReset(t *testing.T) {
	m, err := Reset("https://www.lifeinbabi.com", "awa@mail.com", "Awa <3", "https://www.lifeinbabi.com/mot-de-passe?token=abc", 30)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Bonjour Awa &lt;3,", `href="https://www.lifeinbabi.com/mot-de-passe?token=abc"`, "30 minutes", "mail-pin.png"} {
		if !strings.Contains(m.HTML, want) {
			t.Errorf("html lacks %q", want)
		}
	}
	if !strings.Contains(m.Text, "https://www.lifeinbabi.com/mot-de-passe?token=abc") || !strings.Contains(m.Text, "Bonjour Awa <3,") {
		t.Errorf("text: %s", m.Text)
	}
}

func TestBrevo(t *testing.T) {
	var got map[string]any
	var key string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key = r.Header.Get("api-key")
		if r.URL.Path != "/smtp/email" {
			http.NotFound(w, r)
			return
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"messageId":"<x@brevo>"}`))
	}))
	defer srv.Close()
	b := &Brevo{Key: "k", From: "Babi Life <noreply@lifeinbabi.com>", API: srv.URL}
	m, _ := Reset("https://www.lifeinbabi.com", "awa@mail.com", "Awa", "https://x/y", 30)
	if err := b.Send(context.Background(), m); err != nil {
		t.Fatal(err)
	}
	sender := got["sender"].(map[string]any)
	if key != "k" || sender["email"] != "noreply@lifeinbabi.com" || sender["name"] != "Babi Life" || got["subject"] != m.Subject || got["htmlContent"] == "" || got["textContent"] == "" {
		t.Errorf("payload: key %q %v", key, got)
	}
	if err := b.Send(context.Background(), Message{To: "a@b.c\r\nBcc: x@y.z"}); err == nil {
		t.Error("header injection let through")
	}
	bad := &Brevo{Key: "k", From: "Babi Life <noreply@lifeinbabi.com>", API: srv.URL + "/nope"}
	if err := bad.Send(context.Background(), m); err == nil {
		t.Error("an error from Brevo is an error")
	}
}

func TestNews(t *testing.T) {
	tpl, ok := FindTemplate("sortie")
	if !ok {
		t.Fatal("no « sortie » model")
	}
	m, err := News("https://www.lifeinbabi.com", tpl, "awa@example.com", "Awa", "https://api.example.com/api/v1/mail/stop?e=x&t=y")
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Bonjour Awa,", "https://www.lifeinbabi.com/jeu", "Ne plus recevoir ces e-mails", "mail/stop?e=x&amp;t=y"} {
		if !strings.Contains(m.HTML, want) {
			t.Errorf("HTML lacks %q", want)
		}
	}
	if strings.Contains(m.Text, "{prénom}") || !strings.Contains(m.Text, "Bonjour Awa,") {
		t.Errorf("text not named: %q", m.Text[:80])
	}
	// No first name: the greeting without a gap.
	m, _ = News("https://www.lifeinbabi.com", tpl, "x@example.com", "", "")
	if !strings.Contains(m.Text, "Bonjour,") || strings.Contains(m.HTML, "Ne plus recevoir") {
		t.Errorf("unnamed greeting or a stray link: %q", m.Text[:60])
	}
}
