package ads

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Against a database (TEST_DATABASE_URL): a tap on a board counts a click for its campaign (by commune and
// day), an unknown commune is refused, and the advertiser's totals carry the clicks beside the views.
func TestClicks(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL unset")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	var id string
	if err := pool.QueryRow(ctx, `INSERT INTO ad_campaigns (token, advertiser, contact, title, media_key, media_type, communes, starts, ends, status, paid, price, note, places, link, app_name, icon_key, start_min, end_min, tiki_key, tiki_type, gram_key, gram_type, sucette_key, sucette_type, banderole_key, banderole_type)
		VALUES (md5(random()::text), 'Test', '', 'Vitrine', 'k', 'image', '{cocody}', current_date, current_date + 1, 'approved', true, 0, '', '{panneaux}', '', '', '', 0, 1440, '', '', '', '', '', '', '', '') RETURNING id::text`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM ad_campaigns WHERE id = $1`, id) })
	h := &Handler{DB: pool}
	post := func(body string) int {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodPost, "/ads/clicks", strings.NewReader(body))
		r.RemoteAddr = "10.9.8.7:1234"
		h.Clicked(w, r)
		return w.Code
	}
	for range 3 {
		if c := post(`{"commune":"cocody","id":"` + id + `"}`); c != http.StatusNoContent {
			t.Fatalf("click: %d", c)
		}
	}
	if c := post(`{"commune":"nulle-part","id":"` + id + `"}`); c != http.StatusBadRequest {
		t.Fatalf("unknown commune: %d", c)
	}
	list := []Status{{ID: id}}
	if err := h.views(ctx, list); err != nil || list[0].Clicks != 3 || list[0].Views != 0 {
		t.Fatalf("totals: %+v %v", list[0], err)
	}
}
