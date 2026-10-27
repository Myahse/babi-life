// Package throttle counts tries (a password, a code) per key over a window,
// in this process's memory: past the limit, more are refused until the
// oldest fall out of the window. Brute force then takes years, not minutes.
package throttle

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Limiter struct {
	mu   sync.Mutex
	seen map[string][]time.Time
	// Max tries per key within Per.
	Max int
	Per time.Duration
}

func New(max int, per time.Duration) *Limiter {
	return &Limiter{seen: map[string][]time.Time{}, Max: max, Per: per}
}

// Allow: one more try for key, if it's still under the limit (counted either way).
func (l *Limiter) Allow(key string) bool {
	return l.at(key, time.Now(), true)
}

// Full: the key has used all its tries (nothing counted).
func (l *Limiter) Full(key string) bool {
	return !l.at(key, time.Now(), false)
}

// Hit: count a try (a failed one) without asking.
func (l *Limiter) Hit(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.seen[key] = append(l.seen[key], time.Now())
}

func (l *Limiter) at(key string, now time.Time, count bool) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	cut := now.Add(-l.Per)
	recent := l.seen[key][:0]
	for _, t := range l.seen[key] {
		if t.After(cut) {
			recent = append(recent, t)
		}
	}
	if len(recent) >= l.Max {
		l.seen[key] = recent
		return false
	}
	if count {
		recent = append(recent, now)
	}
	if len(recent) == 0 {
		delete(l.seen, key)
	} else {
		l.seen[key] = recent
	}
	// Now and then, the keys nobody has tried for a while are forgotten.
	if len(l.seen) > 50000 {
		for k, ts := range l.seen {
			if len(ts) == 0 || ts[len(ts)-1].Before(cut) {
				delete(l.seen, k)
			}
		}
	}
	return true
}

// IP: the caller's address as the proxy in front of the API reports it (else the connection's).
func IP(r *http.Request) string {
	if f := r.Header.Get("X-Forwarded-For"); f != "" {
		return strings.TrimSpace(strings.Split(f, ",")[0])
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}
