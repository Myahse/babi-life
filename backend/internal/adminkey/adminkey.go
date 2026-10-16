// Package adminkey checks the admin key of a request (header X-Admin-Key).
// Each admin part has its own key (ADS_ADMIN_KEY, MODERATION_KEY,
// WAITLIST_ADMIN_KEY), and ADMIN_KEY opens them all: the /admin page uses it.
package adminkey

import (
	"crypto/subtle"
	"net/http"
)

// Master is ADMIN_KEY (set once at start); empty: only the parts' own keys.
var Master string

// OK: the request carries the part's own key or the master key.
func OK(r *http.Request, own string) bool {
	got := []byte(r.Header.Get("X-Admin-Key"))
	if len(got) == 0 {
		return false
	}
	for _, k := range []string{own, Master} {
		if k != "" && subtle.ConstantTimeCompare(got, []byte(k)) == 1 {
			return true
		}
	}
	return false
}
