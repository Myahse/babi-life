package auth

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/myahse/babi-life/backend/internal/db"
)

// deleteDB: a fresh database migrated from scratch, beside the one TEST_DATABASE_URL names; without it, skipped.
func deleteDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	admin, err := db.Connect(ctx, base)
	if err != nil {
		t.Skipf("no database: %v", err)
	}
	defer admin.Close()
	name := fmt.Sprintf("babi_test_delete_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, `CREATE DATABASE `+name); err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(base)
	u.Path = "/" + name
	pool, err := db.Connect(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		if a, err := db.Connect(ctx, base); err == nil {
			_, _ = a.Exec(ctx, `DROP DATABASE IF EXISTS `+name+` WITH (FORCE)`)
			a.Close()
		}
	})
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	return pool
}

func TestDeleteMe(t *testing.T) {
	pool := deleteDB(t)
	ctx := context.Background()
	sessions := NewSessions(pool)
	tokens := NewTokens("test-secret").WithSessions(sessions)
	h := &Handler{DB: pool, Tokens: tokens, Sessions: sessions}
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(tokens.Require)
		r.Get("/me", h.Me)
		r.Get("/me/delete", h.DeleteInfo)
		r.Delete("/me", h.DeleteMe)
	})
	call := func(method, path, token, body string) (int, string) {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code, w.Body.String()
	}
	signedIn := func(user string) string {
		sid, err := sessions.Start(ctx, user, httptest.NewRequest(http.MethodGet, "/", nil))
		if err != nil {
			t.Fatal(err)
		}
		tok, err := tokens.Issue(user, sid)
		if err != nil {
			t.Fatal(err)
		}
		return tok
	}

	// A password account: its password, nothing else.
	hash, _ := bcrypt.GenerateFromPassword([]byte("motdepasse"), bcrypt.MinCost)
	var awa string
	if err := pool.QueryRow(ctx, `INSERT INTO users (email, name, username, password_hash) VALUES ('awa@test.ci', 'Awa', 'awa', $1) RETURNING id`, string(hash)).Scan(&awa); err != nil {
		t.Fatal(err)
	}
	tok := signedIn(awa)
	if c, body := call(http.MethodGet, "/me/delete", tok, ""); c != http.StatusOK || !strings.Contains(body, `"password":true`) {
		t.Fatalf("delete info: %d %s", c, body)
	}
	if c, _ := call(http.MethodDelete, "/me", tok, `{"password":"pas-le-bon"}`); c != http.StatusForbidden {
		t.Fatalf("wrong password: %d, want 403", c)
	}
	if c, _ := call(http.MethodDelete, "/me", tok, `{"confirm":"awa"}`); c != http.StatusForbidden {
		t.Fatalf("the username for a password account: %d, want 403", c)
	}
	if c, body := call(http.MethodDelete, "/me", tok, `{"password":"motdepasse"}`); c != http.StatusOK {
		t.Fatalf("delete: %d %s", c, body)
	}
	// Gone, and the token with it.
	if c, _ := call(http.MethodGet, "/me", tok, ""); c != http.StatusUnauthorized {
		t.Fatalf("after: %d, want 401", c)
	}
	var n int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE id = $1`, awa).Scan(&n)
	if n != 0 {
		t.Fatal("the account should be gone")
	}

	// A Google account: its username typed (any case).
	var koffi string
	if err := pool.QueryRow(ctx, `INSERT INTO users (google_sub, email, name, username) VALUES ('g-1', 'koffi@test.ci', 'Koffi', 'Koffi_225') RETURNING id`).Scan(&koffi); err != nil {
		t.Fatal(err)
	}
	tok = signedIn(koffi)
	if c, body := call(http.MethodGet, "/me/delete", tok, ""); c != http.StatusOK || !strings.Contains(body, `"word":"Koffi_225"`) {
		t.Fatalf("delete info: %d %s", c, body)
	}
	if c, _ := call(http.MethodDelete, "/me", tok, `{"confirm":"koffi"}`); c != http.StatusForbidden {
		t.Fatalf("wrong word: %d, want 403", c)
	}
	if c, body := call(http.MethodDelete, "/me", tok, `{"confirm":" koffi_225 "}`); c != http.StatusOK {
		t.Fatalf("delete: %d %s", c, body)
	}
	if c, _ := call(http.MethodGet, "/me", tok, ""); c != http.StatusUnauthorized {
		t.Fatalf("after: %d, want 401", c)
	}
}
