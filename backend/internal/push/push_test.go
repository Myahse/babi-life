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
