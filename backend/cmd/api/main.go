package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/config"
	"github.com/myahse/babi-life/backend/internal/db"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/sims"
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
	simsH := &sims.Handler{DB: pool}

	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger, middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: cfg.AllowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
		MaxAge:         600,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/world", func(w http.ResponseWriter, r *http.Request) {
			httpx.JSON(w, http.StatusOK, map[string]any{
				"cities":      world.Cities,
				"kinds":       game.Kinds,
				"traits":      game.Traits,
				"aspirations": game.Aspirations,
				"origins":     game.Origins,
				"housings":    game.Housings,
				"careers":     game.Careers,
				"config":      map[string]any{"devLogin": cfg.DevLogin, "googleLogin": authH.Verifier != nil},
			})
		})
		// What is going on in a commune at a game minute (null when it's quiet).
		r.Get("/happening", func(w http.ResponseWriter, r *http.Request) {
			t, err := strconv.ParseInt(r.URL.Query().Get("t"), 10, 64)
			if err != nil {
				httpx.Error(w, http.StatusBadRequest, "t is required")
				return
			}
			h, start, ok := game.HappeningAt(r.URL.Query().Get("commune"), t)
			if !ok {
				httpx.JSON(w, http.StatusOK, map[string]any{"happening": nil, "start": start, "end": start + game.HappeningMinutes})
				return
			}
			httpx.JSON(w, http.StatusOK, map[string]any{"happening": h, "start": start, "end": start + game.HappeningMinutes})
		})
		r.Post("/auth/google", authH.Google)
		r.Post("/auth/register", authH.Register)
		r.Post("/auth/login", authH.Login)
		if cfg.DevLogin {
			log.Println("⚠️  DEV_LOGIN is on: anyone can sign in without Google")
			r.Post("/auth/dev", authH.Dev)
		}

		r.Group(func(r chi.Router) {
			r.Use(tokens.Require)
			r.Get("/me", authH.Me)
			simsH.Routes(r)
		})
	})

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		log.Printf("Ivoire Life API listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdown)
}
