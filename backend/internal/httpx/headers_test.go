package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSecurityHeaders(t *testing.T) {
	h := SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { JSON(w, http.StatusOK, map[string]bool{"ok": true}) }))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/world", nil))
	for k, want := range map[string]string{"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin"} {
		if got := rec.Header().Get(k); got != want {
			t.Errorf("%s: %q, want %q", k, got, want)
		}
	}
}
