package auth

import (
	"bytes"
	"context"
	"math/rand/v2"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Idempotency: a write sent twice (a double tap, the app sending again after
// a bad network, two taps on two devices of the same account on the same
// thing) is done once. The app sends each write with an Idempotency-Key; the
// first one with a key runs and its answer is kept a day; the same key again
// gets that same answer back (Idempotent-Replay: true) without running again.
// While the first is still running, the second is told so (409). An answer
// the server failed on (5xx) is not kept: sending again tries again.

const (
	idemKeep    = 24 * time.Hour
	idemMaxBody = 512 << 10
)

// Idempotent is the middleware (after Require: it's by user).
func Idempotent(db *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("Idempotency-Key")
			user := UserID(r.Context())
			if key == "" || user == "" || r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions || len(key) > 100 {
				next.ServeHTTP(w, r)
				return
			}
			ctx := r.Context()
			what := r.Method + " " + r.URL.Path
			tag, err := db.Exec(ctx, `INSERT INTO idempotency (user_id, key, request) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, user, key, what)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			if tag.RowsAffected() == 0 {
				// Seen already: its answer, or « still running ».
				var (
					status int
					body   []byte
					was    string
				)
				if err := db.QueryRow(ctx, `SELECT status, body, request FROM idempotency WHERE user_id = $1 AND key = $2`, user, key).Scan(&status, &body, &was); err != nil {
					httpx.Error(w, http.StatusConflict, "action déjà en cours")
					return
				}
				if was != what {
					httpx.Error(w, http.StatusUnprocessableEntity, "clé d'action déjà utilisée pour autre chose")
					return
				}
				if status == 0 {
					httpx.Error(w, http.StatusConflict, "action déjà en cours")
					return
				}
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Idempotent-Replay", "true")
				w.WriteHeader(status)
				_, _ = w.Write(body)
				return
			}
			rec := &recorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)
			// Kept for the next time the same key comes (not a server failure: that one may be tried again).
			bg, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if rec.status >= 500 || rec.body.Len() > idemMaxBody {
				_, _ = db.Exec(bg, `DELETE FROM idempotency WHERE user_id = $1 AND key = $2`, user, key)
			} else {
				_, _ = db.Exec(bg, `UPDATE idempotency SET status = $3, body = $4 WHERE user_id = $1 AND key = $2`, user, key, rec.status, rec.body.Bytes())
			}
			// Now and then, the old keys go.
			if rand.IntN(200) == 0 {
				_, _ = db.Exec(bg, `DELETE FROM idempotency WHERE created_at < now() - $1::interval`, strconv.Itoa(int(idemKeep.Hours()))+" hours")
			}
		})
	}
}

// recorder passes the answer through and keeps a copy of it.
type recorder struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
	wrote  bool
}

func (r *recorder) WriteHeader(code int) {
	if !r.wrote {
		r.status = code
		r.wrote = true
	}
	r.ResponseWriter.WriteHeader(code)
}

func (r *recorder) Write(b []byte) (int, error) {
	r.wrote = true
	if r.body.Len() <= idemMaxBody {
		r.body.Write(b)
	}
	return r.ResponseWriter.Write(b)
}
