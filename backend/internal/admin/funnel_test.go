package admin

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
)

// The new players' path: each step counted once an account passed it; D1 and D7 only over the accounts
// old enough to have had the day.
func TestFunnel(t *testing.T) {
	pool := notifyDB(t)
	ctx := context.Background()
	for _, s := range []string{
		`INSERT INTO users (id, email, name, created_at, play_sessions) VALUES
			('00000000-0000-0000-0000-0000000000a1', 'a@x.ci', 'A', now() - interval '8 days', 5),
			('00000000-0000-0000-0000-0000000000a2', 'b@x.ci', 'B', now() - interval '2 days', 1),
			('00000000-0000-0000-0000-0000000000a3', 'c@x.ci', 'C', now(), 1)`,
		`DELETE FROM user_days`,
		`INSERT INTO user_days VALUES ('00000000-0000-0000-0000-0000000000a1', current_date - 8), ('00000000-0000-0000-0000-0000000000a1', current_date - 7), ('00000000-0000-0000-0000-0000000000a1', current_date - 1),
			('00000000-0000-0000-0000-0000000000a2', current_date - 2)`,
		`INSERT INTO user_funnel (user_id, step) VALUES ('00000000-0000-0000-0000-0000000000a1', 'tuto_start'), ('00000000-0000-0000-0000-0000000000a1', 'tuto_done'), ('00000000-0000-0000-0000-0000000000a1', 'first_activity'),
			('00000000-0000-0000-0000-0000000000a2', 'tuto_start'), ('00000000-0000-0000-0000-0000000000a2', 'tuto_skip'), ('00000000-0000-0000-0000-0000000000a3', 'tuto_start')`,
	} {
		if _, err := pool.Exec(ctx, s); err != nil {
			t.Fatal(err)
		}
	}
	h := &Handler{DB: pool}
	w := httptest.NewRecorder()
	h.retention(w, httptest.NewRequest("GET", "/admin/retention", nil))
	var out Retention
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err, w.Body.String())
	}
	want := Funnel{Signups: 3, TutoStart: 3, TutoDone: 1, TutoSkip: 1, FirstActivity: 1, SecondSession: 1, D1Base: 2, D1: 1, D7Base: 1, D7: 1}
	if out.Funnel != want {
		t.Errorf("%+v, want %+v", out.Funnel, want)
	}
}
