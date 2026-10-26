// Package push sends notifications to players' phones: a new message on
// Gbairai, a bet whose matches are over. Two ways: the browser's Web Push
// (the site, added to the home screen or not: VAPID keys, VAPID_PUBLIC_KEY
// and VAPID_PRIVATE_KEY on Render) and Firebase Cloud Messaging for the
// Android app (FCM_SERVICE_ACCOUNT: the service account's JSON, from the
// Firebase console of the project babilife-38e39). Without them, nothing is
// sent and the game works the same.
package push

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

type Service struct {
	DB *pgxpool.Pool
	// VAPID: the site's push keys (base64url); Subject: who to write to (mailto: or https:).
	VAPIDPublic, VAPIDPrivate, Subject string
	// FCM: the Android app's pushes (nil without a service account).
	FCM *FCM
}

// Message is one notification: what it says, where a tap opens the game, and
// a tag (a newer one with the same tag replaces it, as WhatsApp's do).
type Message struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
	Tag   string `json:"tag"`
}

// Enabled: whether anything can be sent at all.
func (s *Service) Enabled() bool { return s != nil && (s.VAPIDPrivate != "" || s.FCM != nil) }

// Key: GET /push/key — the site's public key, and what can be sent.
func (s *Service) Key(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]any{"key": s.VAPIDPublic, "web": s.VAPIDPrivate != "", "app": s.FCM != nil})
}

type subscription struct {
	// Kind: "web" (a browser's Web Push) or "fcm" (the Android app's token).
	Kind     string `json:"kind"`
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
	Token string `json:"token"`
}

// Subscribe: POST /me/push — a browser's subscription or the app's token, for this player.
func (s *Service) Subscribe(w http.ResponseWriter, r *http.Request) {
	var req subscription
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	endpoint, p256, au := req.Endpoint, req.Keys.P256dh, req.Keys.Auth
	switch req.Kind {
	case "web":
		if !strings.HasPrefix(endpoint, "https://") || p256 == "" || au == "" || len(endpoint) > 1000 {
			httpx.Error(w, http.StatusBadRequest, "abonnement invalide")
			return
		}
	case "fcm":
		if req.Token == "" || len(req.Token) > 1000 {
			httpx.Error(w, http.StatusBadRequest, "jeton invalide")
			return
		}
		endpoint = req.Token
	default:
		httpx.Error(w, http.StatusBadRequest, "abonnement invalide")
		return
	}
	_, err := s.DB.Exec(r.Context(), `
		INSERT INTO push_subs (user_id, kind, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, kind = $2, p256dh = $4, auth = $5, created_at = now()`,
		auth.UserID(r.Context()), req.Kind, endpoint, p256, au)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Unsubscribe: DELETE /me/push — no more notifications there.
func (s *Service) Unsubscribe(w http.ResponseWriter, r *http.Request) {
	var req subscription
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	endpoint := req.Endpoint
	if req.Kind == "fcm" {
		endpoint = req.Token
	}
	_, _ = s.DB.Exec(r.Context(), `DELETE FROM push_subs WHERE user_id = $1 AND endpoint = $2`, auth.UserID(r.Context()), endpoint)
	w.WriteHeader(http.StatusNoContent)
}

// ToSim sends a notification to the player of a Sim, on all their phones and
// browsers. In the background: it never slows the request that caused it.
func (s *Service) ToSim(simID string, m Message) {
	if !s.Enabled() {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		var user string
		if err := s.DB.QueryRow(ctx, `SELECT user_id FROM sims WHERE id = $1`, simID).Scan(&user); err != nil {
			return
		}
		s.toUser(ctx, user, m)
	}()
}

// ToAll sends a notification to every player who takes them (the new
// president, the president's words), in the background.
func (s *Service) ToAll(m Message) {
	s.toUsers(`SELECT DISTINCT user_id FROM push_subs`, m)
}

// ToCommune sends a notification to the players with a Sim living in a commune (its new mayor).
func (s *Service) ToCommune(commune string, m Message) {
	s.toUsers(`SELECT DISTINCT p.user_id FROM push_subs p JOIN sims s ON s.user_id = p.user_id WHERE s.home_commune = $1`, m, commune)
}

// toUsers: the players a query finds, one after the other (a few minutes at most).
func (s *Service) toUsers(query string, m Message, args ...any) {
	if !s.Enabled() {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		rows, err := s.DB.Query(ctx, query, args...)
		if err != nil {
			return
		}
		var users []string
		for rows.Next() {
			var u string
			if rows.Scan(&u) == nil {
				users = append(users, u)
			}
		}
		rows.Close()
		for _, u := range users {
			s.toUser(ctx, u, m)
		}
	}()
}

func (s *Service) toUser(ctx context.Context, user string, m Message) {
	rows, err := s.DB.Query(ctx, `SELECT kind, endpoint, p256dh, auth FROM push_subs WHERE user_id = $1`, user)
	if err != nil {
		return
	}
	type sub struct{ kind, endpoint, p256, auth string }
	var subs []sub
	for rows.Next() {
		var x sub
		if rows.Scan(&x.kind, &x.endpoint, &x.p256, &x.auth) == nil {
			subs = append(subs, x)
		}
	}
	rows.Close()
	payload, _ := json.Marshal(m)
	for _, x := range subs {
		gone := false
		switch x.kind {
		case "web":
			if s.VAPIDPrivate == "" {
				continue
			}
			res, err := webpush.SendNotificationWithContext(ctx, payload, &webpush.Subscription{Endpoint: x.endpoint, Keys: webpush.Keys{P256dh: x.p256, Auth: x.auth}}, &webpush.Options{
				Subscriber: s.Subject, VAPIDPublicKey: s.VAPIDPublic, VAPIDPrivateKey: s.VAPIDPrivate, TTL: 3600, Topic: topic(m.Tag), Urgency: webpush.UrgencyNormal,
			})
			if err != nil {
				log.Printf("push: web: %v", err)
				continue
			}
			res.Body.Close()
			gone = res.StatusCode == http.StatusGone || res.StatusCode == http.StatusNotFound
		case "fcm":
			if s.FCM == nil {
				continue
			}
			var err error
			if gone, err = s.FCM.send(ctx, x.endpoint, m); err != nil {
				log.Printf("push: fcm: %v", err)
			}
		}
		// A phone or browser that left (the app removed, the site's permission taken back): forgotten.
		if gone {
			_, _ = s.DB.Exec(ctx, `DELETE FROM push_subs WHERE endpoint = $1`, x.endpoint)
		}
	}
}

// topic: Web Push's « Topic » header (a newer message replaces an older one not yet delivered): base64url, 32 at most.
func topic(tag string) string {
	var b strings.Builder
	for _, c := range tag {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			b.WriteRune(c)
		}
		if b.Len() == 32 {
			break
		}
	}
	return b.String()
}

// FCM sends to the Android app through Firebase Cloud Messaging (HTTP v1).
type FCM struct {
	project string
	client  *http.Client
}

// NewFCM: from the service account's JSON (FCM_SERVICE_ACCOUNT), or nil.
func NewFCM(serviceAccount string) (*FCM, error) {
	if strings.TrimSpace(serviceAccount) == "" {
		return nil, nil
	}
	var sa struct {
		ProjectID string `json:"project_id"`
	}
	if err := json.Unmarshal([]byte(serviceAccount), &sa); err != nil || sa.ProjectID == "" {
		return nil, fmt.Errorf("FCM_SERVICE_ACCOUNT: not a service account's JSON")
	}
	creds, err := google.CredentialsFromJSON(context.Background(), []byte(serviceAccount), "https://www.googleapis.com/auth/firebase.messaging")
	if err != nil {
		return nil, err
	}
	return &FCM{project: sa.ProjectID, client: oauth2.NewClient(context.Background(), creds.TokenSource)}, nil
}

// send: one message to one app; gone when the app was removed (its token is no longer valid).
func (f *FCM) send(ctx context.Context, token string, m Message) (bool, error) {
	body, _ := json.Marshal(map[string]any{"message": map[string]any{
		"token":        token,
		"notification": map[string]string{"title": m.Title, "body": m.Body},
		"data":         map[string]string{"url": m.URL, "tag": m.Tag},
		"android":      map[string]any{"priority": "high", "notification": map[string]string{"tag": m.Tag, "color": "#FF7A00"}},
	}})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://fcm.googleapis.com/v1/projects/"+f.project+"/messages:send", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	res, err := f.client.Do(req)
	if err != nil {
		return false, err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusGone {
		return true, nil
	}
	if res.StatusCode >= 300 {
		var e bytes.Buffer
		_, _ = e.ReadFrom(res.Body)
		// An unregistered or bad token: forgotten too.
		return strings.Contains(e.String(), "UNREGISTERED") || strings.Contains(e.String(), "INVALID_ARGUMENT"), fmt.Errorf("fcm %d: %s", res.StatusCode, e.String())
	}
	return false, nil
}
