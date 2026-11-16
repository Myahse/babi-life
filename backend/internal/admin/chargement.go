package admin

import (
	"context"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// The admin's « Chargement » (update « mesures-chargement », auth/perf.go, migration 127): how long the game
// takes to load on the players' phones, from what the game measured and sent. For each measure, its median
// and 90th percentile (the slow tenth), over the whole window, by device class, by connection and by day;
// how many left while it loaded, and on which screen; the caches' hits; the communes slowest to arrive in.

// LoadMetric: a measure's count, median and 90th percentile (ms, or frames a second for fps).
type LoadMetric struct {
	N   int `json:"n"`
	P50 int `json:"p50"`
	P90 int `json:"p90"`
}

// LoadGroup: the loadings of one group (all, a class, a connection, a day).
type LoadGroup struct {
	Key        string                `json:"key"`
	Starts     int                   `json:"starts"`
	StartQuits int                   `json:"startQuits"`
	Trips      int                   `json:"trips"`
	TripQuits  int                   `json:"tripQuits"`
	Metrics    map[string]LoadMetric `json:"metrics"`
}

// LoadCommune: a commune arrived in after a trip, slowest first.
type LoadCommune struct {
	Commune string `json:"commune"`
	N       int    `json:"n"`
	Quits   int    `json:"quits"`
	P50     int    `json:"p50"`
	P90     int    `json:"p90"`
}

// LoadCache: the street's chunks and the map's tiles, from the phone or downloaded.
type LoadCache struct {
	ChunkHit  int `json:"chunkHit"`
	ChunkMiss int `json:"chunkMiss"`
	MemHit    int `json:"memHit"`
	TileHit   int `json:"tileHit"`
	TileMiss  int `json:"tileMiss"`
	// Median kilobytes a start downloaded: map tiles (the street's workers) and the page's own files.
	TileKB int `json:"tileKB"`
	NetKB  int `json:"netKB"`
}

type Loading struct {
	Days     int           `json:"days"`
	All      LoadGroup     `json:"all"`
	Classes  []LoadGroup   `json:"classes"`
	Nets     []LoadGroup   `json:"nets"`
	Light    []LoadGroup   `json:"light"`
	ByDay    []LoadGroup   `json:"byDay"`
	Communes []LoadCommune `json:"communes"`
	Cache    LoadCache     `json:"cache"`
	// Where the ones who left while it loaded were (the game's screen names, as « Nouveaux joueurs »).
	QuitScreens []ScreenCount `json:"quitScreens"`
	// New accounts whose last screen ever seen was the loading one (user_last_screen, migration 125).
	LastOnLoading int `json:"lastOnLoading"`
}

// loadMetrics: the measures, their column and the loadings they're about.
var loadMetrics = []struct{ name, col, kind string }{
	{"hud", "hud_ms", "start"},
	{"chunk", "chunk_ms", "start"},
	{"ready", "ready_ms", "start"},
	{"tap", "tap_ms", "start"},
	{"fps", "fps", "start"},
	{"tripReady", "ready_ms", "trip"},
	{"tripTotal", "total_ms", "trip"},
}

// loadSelect: the counts and percentiles of every measure, for the rows of the window ($1 days).
func loadSelect(group string) string {
	var b strings.Builder
	b.WriteString(`SELECT ` + group + ` AS g,
		count(*) FILTER (WHERE kind = 'start'), count(*) FILTER (WHERE kind = 'start' AND quit),
		count(*) FILTER (WHERE kind = 'trip'), count(*) FILTER (WHERE kind = 'trip' AND quit)`)
	for _, m := range loadMetrics {
		f := ` FILTER (WHERE kind = '` + m.kind + `')`
		b.WriteString(`, count(` + m.col + `)` + f +
			`, percentile_cont(0.5) WITHIN GROUP (ORDER BY ` + m.col + `)` + f +
			`, percentile_cont(0.9) WITHIN GROUP (ORDER BY ` + m.col + `)` + f)
	}
	b.WriteString(` FROM perf_samples WHERE at > now() - make_interval(days => $1) GROUP BY g ORDER BY g`)
	return b.String()
}

type loadDB interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

func loadGroups(ctx context.Context, db loadDB, days int, group string) ([]LoadGroup, error) {
	rows, err := db.Query(ctx, loadSelect(group), days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []LoadGroup{}
	for rows.Next() {
		var g LoadGroup
		dest := []any{&g.Key, &g.Starts, &g.StartQuits, &g.Trips, &g.TripQuits}
		ns := make([]int, len(loadMetrics))
		ps := make([]*float64, 2*len(loadMetrics))
		for i := range loadMetrics {
			dest = append(dest, &ns[i], &ps[2*i], &ps[2*i+1])
		}
		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}
		g.Metrics = map[string]LoadMetric{}
		for i, m := range loadMetrics {
			if ns[i] == 0 {
				continue
			}
			g.Metrics[m.name] = LoadMetric{N: ns[i], P50: round(ps[2*i]), P90: round(ps[2*i+1])}
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func round(p *float64) int {
	if p == nil {
		return 0
	}
	return int(math.Round(*p))
}

// loadingStats: the window's last days (1 to 30).
func loadingStats(ctx context.Context, db loadDB, days int) (Loading, error) {
	out := Loading{Days: days, Communes: []LoadCommune{}, QuitScreens: []ScreenCount{}}
	all, err := loadGroups(ctx, db, days, `''`)
	if err != nil {
		return out, err
	}
	if len(all) > 0 {
		out.All = all[0]
	} else {
		out.All.Metrics = map[string]LoadMetric{}
	}
	if out.Classes, err = loadGroups(ctx, db, days, `class`); err != nil {
		return out, err
	}
	if out.Nets, err = loadGroups(ctx, db, days, `CASE WHEN net = '' THEN 'inconnu' ELSE net END`); err != nil {
		return out, err
	}
	if out.Light, err = loadGroups(ctx, db, days, `CASE WHEN light THEN 'léger' ELSE 'normal' END`); err != nil {
		return out, err
	}
	if out.ByDay, err = loadGroups(ctx, db, days, `to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`); err != nil {
		return out, err
	}
	// The newest day first, as « Nouveaux joueurs ».
	for i, j := 0, len(out.ByDay)-1; i < j; i, j = i+1, j-1 {
		out.ByDay[i], out.ByDay[j] = out.ByDay[j], out.ByDay[i]
	}
	rows, err := db.Query(ctx, `SELECT commune, count(*), count(*) FILTER (WHERE quit),
			COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(total_ms, ready_ms)), 0),
			COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY COALESCE(total_ms, ready_ms)), 0)
		FROM perf_samples WHERE kind = 'trip' AND commune <> '' AND at > now() - make_interval(days => $1)
		GROUP BY commune ORDER BY 4 DESC, commune LIMIT 10`, days)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var c LoadCommune
		var p50, p90 float64
		if err := rows.Scan(&c.Commune, &c.N, &c.Quits, &p50, &p90); err != nil {
			rows.Close()
			return out, err
		}
		c.P50, c.P90 = int(math.Round(p50)), int(math.Round(p90))
		out.Communes = append(out.Communes, c)
	}
	rows.Close()
	var tileKB, netKB float64
	if err := db.QueryRow(ctx, `SELECT COALESCE(sum(chunk_hit), 0), COALESCE(sum(chunk_miss), 0), COALESCE(sum(mem_hit), 0), COALESCE(sum(tile_hit), 0), COALESCE(sum(tile_miss), 0),
			COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY tile_kb) FILTER (WHERE kind = 'start'), 0),
			COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY net_kb) FILTER (WHERE kind = 'start'), 0)
		FROM perf_samples WHERE at > now() - make_interval(days => $1)`, days).Scan(&out.Cache.ChunkHit, &out.Cache.ChunkMiss, &out.Cache.MemHit, &out.Cache.TileHit, &out.Cache.TileMiss, &tileKB, &netKB); err != nil {
		return out, err
	}
	out.Cache.TileKB, out.Cache.NetKB = int(math.Round(tileKB)), int(math.Round(netKB))
	rows, err = db.Query(ctx, `SELECT CASE WHEN screen = '' THEN 'inconnu' ELSE screen END AS s, count(*) FROM perf_samples
		WHERE quit AND at > now() - make_interval(days => $1) GROUP BY s ORDER BY count(*) DESC, s LIMIT 10`, days)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var s ScreenCount
		if err := rows.Scan(&s.Screen, &s.N); err != nil {
			rows.Close()
			return out, err
		}
		out.QuitScreens = append(out.QuitScreens, s)
	}
	rows.Close()
	err = db.QueryRow(ctx, `SELECT count(*) FROM user_last_screen ls JOIN users u ON u.id = ls.user_id
		WHERE ls.screen = 'chargement' AND NOT u.official AND u.created_at > now() - make_interval(days => $1)`, days).Scan(&out.LastOnLoading)
	return out, err
}

// loading: GET /admin/chargement?days=1|7|14|30.
func (h *Handler) loading(w http.ResponseWriter, r *http.Request) {
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days < 1 || days > 30 {
		days = 7
	}
	out, err := loadingStats(r.Context(), h.DB, days)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, out)
}
