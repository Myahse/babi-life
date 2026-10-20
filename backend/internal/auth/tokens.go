package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

const sessionTTL = 30 * 24 * time.Hour

// Tokens signs and checks the game's session tokens. With sessions set
// (sessions.go), a token signed out from another device stops working.
type Tokens struct {
	secret   []byte
	sessions *Sessions
}

func NewTokens(secret string) Tokens { return Tokens{secret: []byte(secret)} }

// WithSessions: the same tokens, checked against the sessions (signed out or not).
func (t Tokens) WithSessions(s *Sessions) Tokens {
	t.sessions = s
	return t
}

var errSignedOut = errors.New("session signed out")

// Issue: a token for one user's session (sid: its id, the JWT's own id).
func (t Tokens) Issue(userID, sid string) (string, error) {
	now := time.Now()
	return jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject:   userID,
		ID:        sid,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(sessionTTL)),
	}).SignedString(t.secret)
}

// Parse: the user of a valid token (signed, not expired, not signed out).
func (t Tokens) Parse(token string) (string, error) {
	user, _, err := t.ParseSession(context.Background(), token)
	return user, err
}

// ParseSession: the user and the session of a valid token.
func (t Tokens) ParseSession(ctx context.Context, token string) (string, string, error) {
	var claims jwt.RegisteredClaims
	_, err := jwt.ParseWithClaims(token, &claims, func(*jwt.Token) (any, error) { return t.secret, nil },
		jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
	if err != nil {
		return "", "", err
	}
	if claims.Subject == "" {
		return "", "", errors.New("missing subject")
	}
	if t.sessions != nil {
		var iat time.Time
		if claims.IssuedAt != nil {
			iat = claims.IssuedAt.Time
		}
		if !t.sessions.Valid(ctx, claims.Subject, claims.ID, iat) {
			return "", "", errSignedOut
		}
	}
	return claims.Subject, claims.ID, nil
}

type ctxKey struct{}

// Require rejects requests without a valid Bearer token and puts the user ID
// in the request context.
func (t Tokens) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok {
			httpx.Error(w, http.StatusUnauthorized, "missing token")
			return
		}
		userID, sid, err := t.ParseSession(r.Context(), raw)
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, "invalid token")
			return
		}
		ctx := context.WithValue(r.Context(), ctxKey{}, userID)
		next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, sidKey{}, sid)))
	})
}

type sidKey struct{}

// SessionID: the session (the device) a request comes from ("" for a token from before sessions).
func SessionID(ctx context.Context) string {
	id, _ := ctx.Value(sidKey{}).(string)
	return id
}

func UserID(ctx context.Context) string {
	id, _ := ctx.Value(ctxKey{}).(string)
	return id
}
