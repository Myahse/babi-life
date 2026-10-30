package i18n

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"errors"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
)

// Middleware: the request's language in its context (Lang), and, in English,
// the JSON answer translated on its way out. A stream (server-sent events) or
// an upgraded connection passes as it is.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lang := FromRequest(r)
		r = r.WithContext(WithLang(r.Context(), lang))
		// A cached answer (the browser's, a CDN's) is only good for the same language.
		w.Header().Add("Vary", "X-Lang")
		// The team's admin stays in French, as its screens are.
		if lang != "en" || r.Header.Get("Upgrade") != "" || r.Method == http.MethodOptions || strings.Contains(r.URL.Path, "/admin") {
			next.ServeHTTP(w, r)
			return
		}
		tw := &writer{ResponseWriter: w}
		next.ServeHTTP(tw, r)
		tw.finish()
	})
}

// writer holds a JSON answer back until it's whole, to translate it; anything else goes straight through.
type writer struct {
	http.ResponseWriter
	status  int
	decided bool
	hold    bool
	buf     bytes.Buffer
}

func (w *writer) decide() {
	if w.decided {
		return
	}
	w.decided = true
	ct := w.Header().Get("Content-Type")
	w.hold = strings.HasPrefix(ct, "application/json")
}

func (w *writer) WriteHeader(code int) {
	if w.decided && !w.hold {
		w.ResponseWriter.WriteHeader(code)
		return
	}
	w.decide()
	if !w.hold {
		w.ResponseWriter.WriteHeader(code)
		return
	}
	w.status = code
}

func (w *writer) Write(b []byte) (int, error) {
	if !w.decided {
		if w.Header().Get("Content-Type") == "" {
			w.Header().Set("Content-Type", http.DetectContentType(b))
		}
		w.decide()
		if !w.hold {
			return w.ResponseWriter.Write(b)
		}
		if w.status == 0 {
			w.status = http.StatusOK
		}
	}
	if !w.hold {
		return w.ResponseWriter.Write(b)
	}
	return w.buf.Write(b)
}

func (w *writer) finish() {
	if !w.hold {
		return
	}
	body := w.buf.Bytes()
	// Compressed by the route itself (the world, the places): opened, translated, compressed again.
	if w.Header().Get("Content-Encoding") == "gzip" {
		if zr, err := gzip.NewReader(bytes.NewReader(body)); err == nil {
			if plain, err := io.ReadAll(zr); err == nil {
				if out, ok := Translate(plain); ok {
					var z bytes.Buffer
					zw, _ := gzip.NewWriterLevel(&z, gzip.BestSpeed)
					_, _ = zw.Write(out)
					if zw.Close() == nil {
						body = z.Bytes()
					}
				}
			}
		}
	} else if out, ok := Translate(body); ok {
		body = out
	}
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.ResponseWriter.WriteHeader(w.status)
	_, _ = w.ResponseWriter.Write(body)
}

// Flush: a stream isn't held (decided at its first write); a held answer waits for its end.
func (w *writer) Flush() {
	if w.hold {
		return
	}
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (w *writer) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if h, ok := w.ResponseWriter.(http.Hijacker); ok {
		return h.Hijack()
	}
	return nil, nil, errors.New("i18n: hijack not supported")
}

func (w *writer) Unwrap() http.ResponseWriter { return w.ResponseWriter }
