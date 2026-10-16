package admin

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWhatsAppSend(t *testing.T) {
	var got map[string]any
	var path, auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.Path, r.Header.Get("Authorization")
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, &got)
		if got["to"] == "2250700000000" {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":{"message":"Recipient phone number not in allowed list"}}`))
			return
		}
		_, _ = w.Write([]byte(`{"messages":[{"id":"wamid.x"}]}`))
	}))
	defer srv.Close()
	wa := &WhatsApp{Token: "tok", PhoneID: "123", API: srv.URL}
	if !wa.Configured() || (&WhatsApp{Token: "tok"}).Configured() {
		t.Fatal("configured")
	}
	if err := wa.send(context.Background(), "+2250102030405", "ouverture_babi", "fr", "Awa"); err != nil {
		t.Fatal(err)
	}
	if path != "/123/messages" || auth != "Bearer tok" || got["to"] != "2250102030405" || got["type"] != "template" {
		t.Errorf("request: %s %s %v", path, auth, got)
	}
	tpl := got["template"].(map[string]any)
	if tpl["name"] != "ouverture_babi" || tpl["language"].(map[string]any)["code"] != "fr" {
		t.Errorf("template: %v", tpl)
	}
	if b, _ := json.Marshal(tpl["components"]); !strings.Contains(string(b), `"text":"Awa"`) {
		t.Errorf("the first name isn't in the message: %s", b)
	}
	if err := wa.send(context.Background(), "+2250700000000", "ouverture_babi", "fr", ""); err == nil || !strings.Contains(err.Error(), "allowed list") {
		t.Errorf("WhatsApp's error isn't passed on: %v", err)
	}
	if !reTemplate.MatchString("ouverture_babi") || reTemplate.MatchString("Ouverture Babi") || !reLang.MatchString("en_US") || reLang.MatchString("fr-FR") {
		t.Error("template and language checks")
	}
}
