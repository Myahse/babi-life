package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// A token for the Android app's web client is taken alongside the website's client; another client's is refused.
func TestGoogleVerifierAudiences(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kid": "k1",
			"n":   base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
		}}})
	}))
	defer srv.Close()

	v := NewGoogleVerifier("web-site-client", " ", AppWebClientID)
	v.keys = newKeySet(srv.URL)
	token := func(aud string) string {
		tok := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
			"iss": "https://accounts.google.com", "aud": aud, "sub": "1", "email": "a@b.ci", "email_verified": true,
			"exp": time.Now().Add(time.Hour).Unix(),
		})
		tok.Header["kid"] = "k1"
		s, err := tok.SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	for _, aud := range []string{"web-site-client", AppWebClientID} {
		if _, err := v.Verify(context.Background(), token(aud)); err != nil {
			t.Errorf("audience %s refused: %v", aud, err)
		}
	}
	if _, err := v.Verify(context.Background(), token("someone-else")); err == nil {
		t.Error("an unknown audience was taken")
	}
}
