package sims

import (
	"bytes"
	"encoding/base64"
	"errors"
	"image"
	_ "image/jpeg" // decode the size of the photos sent
	_ "image/png"
	"net/http"
	"strings"
)

// The photos of the stories and of Tikitoko: sent as a data URL (the app
// shrinks them first), checked to be a real JPEG or PNG of a sane size,
// kept in the database (they're small, and stories go after 24 hours).

const (
	MaxPhotoBytes = 300 << 10
	MaxPhotoSide  = 1600
)

var errBadPhoto = errors.New("photo illisible (JPEG ou PNG, 300 Ko au plus)")

// decodePhoto: the bytes and type of a data:image/…;base64 URL.
func decodePhoto(dataURL string) ([]byte, string, error) {
	head, b64, ok := strings.Cut(dataURL, ",")
	if !ok || !strings.HasPrefix(head, "data:image/") || !strings.HasSuffix(head, ";base64") {
		return nil, "", errBadPhoto
	}
	if base64.StdEncoding.DecodedLen(len(b64)) > MaxPhotoBytes+3 {
		return nil, "", errBadPhoto
	}
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil || len(raw) > MaxPhotoBytes {
		return nil, "", errBadPhoto
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || cfg.Width < 16 || cfg.Height < 16 || cfg.Width > MaxPhotoSide || cfg.Height > MaxPhotoSide {
		return nil, "", errBadPhoto
	}
	mime := map[string]string{"jpeg": "image/jpeg", "png": "image/png"}[format]
	if mime == "" {
		return nil, "", errBadPhoto
	}
	return raw, mime, nil
}

// servePhoto sends a photo, cached privately by the browser.
func servePhoto(w http.ResponseWriter, raw []byte, mime string) {
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "private, max-age=86400")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(raw)
}
