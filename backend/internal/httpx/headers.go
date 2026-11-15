package httpx

import "net/http"

// SecurityHeaders: the basic browser protections on every API answer. The API is only
// called by fetch and loaded as media (images, videos), never framed, so it may refuse
// framing outright; nosniff keeps an uploaded file from being read as another type.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}
