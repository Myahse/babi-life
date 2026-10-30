package push

import (
	"encoding/json"
	"strings"
	"testing"
)

// The picture goes in the browser's payload (the service worker shows it:
// web public/push-sw.js) and in Firebase's notification (Android shows it).
func TestImageInPayloads(t *testing.T) {
	m := Message{Title: "Nouveau", Body: "Le foot de rue", URL: "/jeu", Tag: "campagne-1", Image: "https://pub.example/campagnes/a.jpg"}
	web, _ := json.Marshal(m)
	if !strings.Contains(string(web), `"image":"https://pub.example/campagnes/a.jpg"`) {
		t.Errorf("web payload: %s", web)
	}
	p := FCMPayload("tok", m)["message"].(map[string]any)
	if n := p["notification"].(map[string]string); n["image"] != m.Image || n["title"] != "Nouveau" {
		t.Errorf("fcm notification: %v", n)
	}
	if d := p["data"].(map[string]string); d["url"] != "/jeu" || d["image"] != m.Image {
		t.Errorf("fcm data: %v", d)
	}

	// Without a picture: no empty image (Firebase refuses one that isn't a URL).
	m.Image = ""
	web, _ = json.Marshal(m)
	if strings.Contains(string(web), "image") {
		t.Errorf("web payload has an empty image: %s", web)
	}
	if _, ok := FCMPayload("tok", m)["message"].(map[string]any)["notification"].(map[string]string)["image"]; ok {
		t.Error("fcm notification has an empty image")
	}
}

// A notification in English for an English player: the game's words through the catalogue, a player's own words as written.
func TestSaid(t *testing.T) {
	m := Said("en", Message{Title: "Nouveau maire d'Abobo", Body: "La soirée a commencé, viens danser !"})
	if m.Title != "New mayor of Abobo" || m.Body != "The party has started, come and dance!" {
		t.Errorf("en: %+v", m)
	}
	if m := Said("en", Message{Title: "Awa · Gbairai", Body: "Bonjour", Written: true}); m.Body != "Bonjour" {
		t.Errorf("written: %+v", m)
	}
	if m := Said("fr", Message{Title: "Nouveau maire d'Abobo"}); m.Title != "Nouveau maire d'Abobo" {
		t.Errorf("fr: %+v", m)
	}
}
