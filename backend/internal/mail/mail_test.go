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
	for _, want := range []string{"Bonjour Awa &lt;3,", `href="https://www.lifeinbabi.com/mot-de-passe?token=abc"`, "30 minutes", "pin-192.png"} {
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
