package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Inviting one's friends (sims/parrainage.go): each account has a short code
// of its own for its link, lifeinbabi.com/?p=code. The site keeps the code it
// came with (web lib/parrain.ts) and sends it with the sign-up (?p=code on
// /auth/register, /auth/google, /auth/dev): a new account records whose link
// it came by, even while the update is closed. Never one's own, never an
// account that already existed, never changed after.

// refAlphabet: no 0/o, 1/l/i, to be read out and typed without a doubt.
const refAlphabet = "abcdefghjkmnpqrstuvwxyz23456789"

// RefCodeLen: the code's letters.
const RefCodeLen = 6

var refCodeRe = regexp.MustCompile(`^[a-z0-9]{4,12}$`)

// NewRefCode: a random code.
func NewRefCode() string {
	b := make([]byte, RefCodeLen)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = refAlphabet[int(b[i])%len(refAlphabet)]
	}
	return string(b)
}

// CleanRefCode: the code as typed or in a link, "" when it can't be one.
func CleanRefCode(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if !refCodeRe.MatchString(s) {
		return ""
	}
	return s
}

type dbConn interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// RefCode: the account's code, given the first time it's asked and the same ever after.
func RefCode(ctx context.Context, db dbConn, user string) (string, error) {
	var code *string
	if err := db.QueryRow(ctx, `SELECT ref_code FROM users WHERE id = $1`, user).Scan(&code); err != nil {
		return "", err
	}
	if code != nil {
		return *code, nil
	}
	for range 8 {
		var got string
		err := db.QueryRow(ctx, `UPDATE users SET ref_code = coalesce(ref_code, $2) WHERE id = $1 RETURNING ref_code`, user, NewRefCode()).Scan(&got)
		var pg *pgconn.PgError
		if errors.As(err, &pg) && pg.Code == "23505" {
			continue // someone has that one: another
		}
		return got, err
	}
	return "", errors.New("could not make a code")
}

// RecordReferral: a new account came by the link of the account with that
// code: kept, unless it's its own code, or it already has one.
func RecordReferral(ctx context.Context, db dbConn, newUser, code string) error {
	code = CleanRefCode(code)
	if code == "" {
		return nil
	}
	_, err := db.Exec(ctx, `UPDATE users u SET referred_by = r.id FROM users r
		WHERE u.id = $1 AND u.referred_by IS NULL AND r.ref_code = $2 AND r.id <> u.id`, newUser, code)
	return err
}

// refOf: the code a sign-up came with (?p=code), from the link the site kept.
func refOf(r *http.Request) string { return r.URL.Query().Get("p") }
