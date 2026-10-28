package auth

import "testing"

func TestWishList(t *testing.T) {
	for _, c := range []struct {
		method, path string
		ok           bool
	}{
		{"GET", "/api/v1/sims", true},
		{"POST", "/api/v1/sims", true},
		{"GET", "/api/v1/sims/abc", true},
		{"DELETE", "/api/v1/sims/abc", false},
		{"POST", "/api/v1/sims/abc/interact", false},
		{"GET", "/api/v1/sims/abc/shop", false},
		{"POST", "/api/v1/sims/abc/shop", false},
		{"GET", "/api/v1/simsx", false},
	} {
		if got := WishList(c.method, c.path); got != c.ok {
			t.Errorf("%s %s: %v, want %v", c.method, c.path, got, c.ok)
		}
	}
}
