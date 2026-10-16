package main

import (
	"context"
	"errors"
	"log"
	"math"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/myahse/babi-life/backend/internal/ads"
	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/config"
	"github.com/myahse/babi-life/backend/internal/db"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/live"
	"github.com/myahse/babi-life/backend/internal/news"
	"github.com/myahse/babi-life/backend/internal/sims"
	"github.com/myahse/babi-life/backend/internal/waitlist"
	"github.com/myahse/babi-life/backend/internal/world"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatal(err)
	}

	tokens := auth.NewTokens(cfg.JWTSecret)
	authH := &auth.Handler{DB: pool, Tokens: tokens, DevLogin: cfg.DevLogin}
	if cfg.GoogleClientID != "" {
		authH.Verifier = auth.NewGoogleVerifier(cfg.GoogleClientID)
	}
	if cfg.FirebaseProjectID != "" {
		authH.Firebase = auth.NewFirebaseVerifier(cfg.FirebaseProjectID)
	}
	simsH := &sims.Handler{DB: pool, RealPhotos: os.Getenv("STORIES_REAL_PHOTOS") == "true"}
	headlines := news.New(cfg.NewsFeeds)
	go headlines.Run(ctx)
	// The players of a commune, live (positions and poses, over a WebSocket).
	players := live.NewHub(pool, tokens, cfg.AllowedOrigins)
	go players.Run(ctx)

	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger, middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: cfg.AllowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type", "X-Admin-Key"},
		MaxAge:         600,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.With(middleware.Compress(5, "application/json")).Get("/world", func(w http.ResponseWriter, r *http.Request) {
			httpx.JSON(w, http.StatusOK, map[string]any{
				"cities":        world.Cities,
				"kinds":         game.Kinds,
				"traits":        game.Traits,
				"aspirations":   game.Aspirations,
				"origins":       game.Origins,
				"housings":      game.Housings,
				"careers":       game.Careers,
				"expressions":   game.Expressions,
				"rideApps":      world.RideApps,
				"compteur":      world.Compteur,
				"roads":         world.Roads,
				"phoneApps":     world.PhoneApps,
				"contacts":      world.Contacts,
				"menus":         world.Menus,
				"families":      game.Families,
				"stages":        game.Stages,
				"yearMinutes":   game.YearMinutes,
				"growUp":        game.GrowUp,
				"friendActions": game.FriendActions,
				"holidays":      game.Holidays,
				"materials":     game.Materials,
				"plot":          map[string]int{"w": game.PlotW, "d": game.PlotD, "h": game.PlotH},
				"config":        map[string]any{"realPhotos": simsH.RealPhotos, "devLogin": cfg.DevLogin, "googleLogin": authH.Verifier != nil || authH.Firebase != nil},
			})
		})
		// A commune's places from the map (world/osm.go): those near a point
		// (?lat=&lng=&r=km, nearest first), those matching ?q= (search), or one (?id=).
		r.With(middleware.Compress(5, "application/json")).Get("/places", func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			commune := q.Get("commune")
			num := func(k string, def float64) float64 {
				if v, err := strconv.ParseFloat(q.Get(k), 64); err == nil {
					return v
				}
				return def
			}
			var places []world.MapPlace
			if id := q.Get("id"); id != "" {
				if p, ok := world.MapPlaceByID(id); ok {
					places = []world.MapPlace{p}
				}
			} else if s := strings.TrimSpace(q.Get("q")); s != "" {
				places = world.SearchMapPlaces(commune, s, 40)
			} else {
				places = world.MapPlacesNear(commune, num("lat", 0), num("lng", 0), math.Min(num("r", 1.2), 3), 1500)
			}
			if places == nil {
				places = []world.MapPlace{}
			}
			httpx.JSON(w, http.StatusOK, map[string]any{"places": places, "total": world.MapPlaceCount(commune), "source": world.OSMSource})
		})
		// The "Look to fix" list of the world data (see world.Audit).
		r.Get("/world/issues", func(w http.ResponseWriter, r *http.Request) {
			issues := world.Audit()
			httpx.JSON(w, http.StatusOK, map[string]any{"summary": world.Summary(issues), "issues": issues})
		})
		// What is going on in a commune at a game minute (null when it's quiet).
		r.Get("/happening", func(w http.ResponseWriter, r *http.Request) {
			t, err := strconv.ParseInt(r.URL.Query().Get("t"), 10, 64)
			if err != nil {
				httpx.Error(w, http.StatusBadRequest, "t is required")
				return
			}
			h, start, ok := game.HappeningAt(r.URL.Query().Get("city"), r.URL.Query().Get("commune"), t)
			if !ok {
				httpx.JSON(w, http.StatusOK, map[string]any{"happening": nil, "start": start, "end": start + game.HappeningMinutes})
				return
			}
			httpx.JSON(w, http.StatusOK, map[string]any{"happening": h, "start": start, "end": start + game.HappeningMinutes})
		})
		// A stadium's agenda: what's on now (from the doors opening) and the next seven days.
		r.Get("/stadium", func(w http.ResponseWriter, r *http.Request) {
			place := r.URL.Query().Get("place")
			if _, _, p, ok := world.FindPlace(place); !ok || p.Kind != game.StadiumKind {
				httpx.Error(w, http.StatusNotFound, "stade inconnu")
				return
			}
			now := game.MinuteOf(time.Now())
			var on *game.StadiumEvent
			if e, ok := game.StadiumEventAt(place, now); ok {
				on = &e
			}
			w.Header().Set("Cache-Control", "public, max-age=60")
			httpx.JSON(w, http.StatusOK, map[string]any{"now": now, "on": on, "agenda": game.StadiumAgenda(place, now, now, now+7*24*60)})
		})
		// The server's clock: every player's world runs on it (web/src/lib/worldClock.ts).
		r.Get("/time", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store")
			httpx.JSON(w, http.StatusOK, map[string]int64{"now": time.Now().UnixMilli()})
		})
		r.Get("/live", players.ServeHTTP)
		// The wish list: sign up before the game opens (export with WAITLIST_ADMIN_KEY).
		wish := &waitlist.Handler{DB: pool, AdminKey: os.Getenv("WAITLIST_ADMIN_KEY"), Verify: func(ctx context.Context, token string) (string, string, error) {
			id, err := authH.Identify(ctx, token)
			if err != nil {
				return "", "", err
			}
			name := id.FirstName
			if name == "" {
				name = id.Name
			}
			return id.Email, name, nil
		}}
		r.Post("/waitlist", wish.Join)
		r.Get("/waitlist/count", wish.Count)
		r.Get("/waitlist/export", wish.Export)
		// Babi Pub: the billboards' ads (files in an S3-compatible bucket; admin with ADS_ADMIN_KEY).
		pub := &ads.Handler{DB: pool, AdminKey: os.Getenv("ADS_ADMIN_KEY"), Head: ads.HeadHTTP, Bucket: &ads.Bucket{
			Endpoint: os.Getenv("ADS_S3_ENDPOINT"), Region: os.Getenv("ADS_S3_REGION"), Name: os.Getenv("ADS_S3_BUCKET"),
			AccessKey: os.Getenv("ADS_S3_ACCESS_KEY"), SecretKey: os.Getenv("ADS_S3_SECRET_KEY"), PublicURL: os.Getenv("ADS_PUBLIC_URL"),
		}}
		r.Get("/ads/invite/{code}", pub.Invite)
		r.Get("/ads/admin/invites", pub.AdminInvites)
		r.Post("/ads/admin/invites", pub.AdminInvite)
		r.Post("/ads/upload", pub.Upload)
		r.Post("/ads/campaigns", pub.Create)
		r.Get("/ads/campaigns/{token}", pub.Follow)
		r.Get("/ads/live", pub.Live)
		r.Post("/ads/views", pub.Viewed)
		r.Get("/ads/admin", pub.AdminList)
		r.Post("/ads/admin/{id}", pub.AdminUpdate)
		r.Get("/news", headlines.Handler)
		// Moderation of Gbairai's reports (MODERATION_KEY).
		mod := &sims.Moderation{H: simsH, Key: os.Getenv("MODERATION_KEY")}
		r.Get("/moderation/reports", mod.Reports)
		r.Post("/moderation/reports/{report}", mod.Resolve)
		r.Get("/moderation/photo", mod.Photo)
		r.Post("/auth/google", authH.Google)
		r.Post("/auth/register", authH.Register)
		r.Post("/auth/login", authH.Login)
		r.Get("/auth/username", authH.UsernameAvailable)
		if cfg.DevLogin {
			log.Println("⚠️  DEV_LOGIN is on: anyone can sign in without Google")
			r.Post("/auth/dev", authH.Dev)
		}

		r.Group(func(r chi.Router) {
			r.Use(tokens.Require)
			r.Get("/me", authH.Me)
			r.Put("/me/username", authH.SetUsername)
			simsH.Routes(r)
		})
	})

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		log.Printf("Babi Life API listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdown)
}
