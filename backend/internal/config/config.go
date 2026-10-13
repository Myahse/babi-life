package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	GoogleClientID string
	AllowedOrigins []string
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
		Port:           getenv("PORT", "8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		GoogleClientID: os.Getenv("GOOGLE_CLIENT_ID"),
		AllowedOrigins: splitList(getenv("ALLOWED_ORIGINS", "http://localhost:5173")),
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

func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
