package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const googleCertsURL = "https://www.googleapis.com/oauth2/v3/certs"

// GoogleIdentity is what we keep from a verified Google ID token.
type GoogleIdentity struct {
	Sub       string
	Email     string
	Name      string
	FirstName string
	LastName  string
	Picture   string
}

// AppWebClientID is the Firebase project's web OAuth client (public: it is in every installed
// app). The Android app (native/, @react-native-google-signin with webClientId) asks Google for an
// ID token for it, so its tokens' audience is this client, whatever GOOGLE_CLIENT_ID says.
const AppWebClientID = "115685300024-jo2jvvpg0p1ue1gsv156lcmkjjb99s9t.apps.googleusercontent.com"

// GoogleVerifier checks ID tokens issued by Google Sign-In against Google's
// published signing keys, which it caches for an hour. A token is taken for
// any of its client ids (the website's button, the Android app's web client).
type GoogleVerifier struct {
	clientIDs []string
	keys      *keySet
}

func NewGoogleVerifier(clientIDs ...string) *GoogleVerifier {
	var ids []string
	for _, id := range clientIDs {
		if id = strings.TrimSpace(id); id != "" && !slices.Contains(ids, id) {
			ids = append(ids, id)
		}
	}
	return &GoogleVerifier{clientIDs: ids, keys: newKeySet(googleCertsURL)}
}

// keySet caches an issuer's RSA public keys for an hour.
type keySet struct {
	url    string
	client *http.Client

	mu      sync.Mutex
	keys    map[string]*rsa.PublicKey
	fetched time.Time
}

func newKeySet(url string) *keySet {
	return &keySet{url: url, client: &http.Client{Timeout: 10 * time.Second}}
}

type googleClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
	jwt.RegisteredClaims
}

func (v *GoogleVerifier) Verify(ctx context.Context, idToken string) (GoogleIdentity, error) {
	var claims googleClaims
	_, err := jwt.ParseWithClaims(idToken, &claims, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		return v.keys.key(ctx, kid)
	},
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithAudience(v.clientIDs...),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return GoogleIdentity{}, err
	}
	if claims.Issuer != "accounts.google.com" && claims.Issuer != "https://accounts.google.com" {
		return GoogleIdentity{}, errors.New("unexpected issuer")
	}
	if !claims.EmailVerified || claims.Email == "" {
		return GoogleIdentity{}, errors.New("email not verified")
	}
	return GoogleIdentity{Sub: claims.Subject, Email: claims.Email, Name: claims.Name, FirstName: claims.GivenName, LastName: claims.FamilyName, Picture: claims.Picture}, nil
}

func (s *keySet) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if k, ok := s.keys[kid]; ok && time.Since(s.fetched) < time.Hour {
		return k, nil
	}
	if err := s.refresh(ctx); err != nil {
		return nil, err
	}
	if k, ok := s.keys[kid]; ok {
		return k, nil
	}
	return nil, fmt.Errorf("unknown key id %q", kid)
}

func (s *keySet) refresh(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.url, nil)
	if err != nil {
		return err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch google certs: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch google certs: %s", resp.Status)
	}

	var set struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return err
	}

	keys := make(map[string]*rsa.PublicKey, len(set.Keys))
	for _, k := range set.Keys {
		n, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			return err
		}
		e, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			return err
		}
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
	}
	s.keys, s.fetched = keys, time.Now()
	return nil
}
