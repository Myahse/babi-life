package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// A player who first signed in through Firebase (the old app: the account's google_sub is Firebase's
// user id) signs in from the new app with a plain Google token for the same e-mail: the same account.
func TestGoogleSignInSameEmailOtherID(t *testing.T) {
	pool := deleteDB(t)
	ctx := context.Background()
	var id string
	if err := pool.QueryRow(ctx, `INSERT INTO users (google_sub, email, name) VALUES ('firebase-uid', 'Awa@Example.com', 'Awa K') RETURNING id`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	sessions := NewSessions(pool)
	h := &Handler{DB: pool, Tokens: NewTokens("test-secret").WithSessions(sessions), Sessions: sessions}
	rec := httptest.NewRecorder()
	h.signIn(rec, httptest.NewRequest(http.MethodPost, "/auth/google", nil), GoogleIdentity{Sub: "google-sub", Email: "awa@example.com", Name: "Awa K"})
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	var got session
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.User.ID != id {
		t.Fatalf("signed into %s, want the existing account %s", got.User.ID, id)
	}
	var n int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&n)
	if n != 1 {
		t.Fatalf("%d accounts, want 1", n)
	}
}
