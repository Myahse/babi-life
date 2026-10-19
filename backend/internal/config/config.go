package config

import (
	"fmt"
	"os"
	"slices"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	DatabaseURL       string
	JWTSecret         string
	GoogleClientID    string
	FirebaseProjectID string
	AllowedOrigins    []string
	// DevLogin enables POST /api/v1/auth/dev so the game can be played locally
	// without a Google client ID. Never enable it in production.
	DevLogin bool
	// NewsFeeds are RSS feeds for the in-game "Infos" app (comma-separated);
	// empty uses news.DefaultFeeds.
	NewsFeeds []string
}

func Load() (Config, error) {
	_ = godotenv.Load()

	cfg := Config{
		Port:              getenv("PORT", "8080"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		JWTSecret:         os.Getenv("JWT_SECRET"),
		GoogleClientID:    os.Getenv("GOOGLE_CLIENT_ID"),
		FirebaseProjectID: os.Getenv("FIREBASE_PROJECT_ID"),
		// The game's own site is always allowed, whatever ALLOWED_ORIGINS says
		// (a typo or a setting saved without a restart can't shut it out).
		AllowedOrigins: withSite(splitList(getenv("ALLOWED_ORIGINS", "http://localhost:5173"))),
		DevLogin:       os.Getenv("DEV_LOGIN") == "true",
		NewsFeeds:      splitList(os.Getenv("NEWS_FEEDS")),
	}

	if cfg.DatabaseURL == "" {
		return cfg, fmt.Errorf("DATABASE_URL is required")
	}
	if len(cfg.JWTSecret) < 32 {
		return cfg, fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Site: the game's own addresses, always allowed to call the API.
var Site = []string{"https://www.lifeinbabi.com", "https://lifeinbabi.com"}

func withSite(origins []string) []string {
	for _, o := range Site {
		if !slices.Contains(origins, o) {
			origins = append(origins, o)
		}
	}
	return origins
}

func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		// Forgiving: spaces, quotes and a trailing slash would make an origin never match.
		if p := strings.TrimRight(strings.Trim(strings.TrimSpace(part), `"'`), "/"); p != "" {
			out = append(out, p)
		}
	}
	return out
}
