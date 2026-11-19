package admin

import "testing"

func TestLinkOK(t *testing.T) {
	for _, c := range []struct {
		url  string
		host string
		ok   bool
	}{
		{"https://groups.google.com/g/babi-life-testeurs", "groups.google.com", true},
		{"https://play.google.com/apps/testing/com.lifeinbabi.babi_life", "play.google.com", true},
		{"http://play.google.com/apps/testing/x", "play.google.com", false},
		{"https://play.google.com.evil.com/x", "play.google.com", false},
		{"https://user@play.google.com/x", "play.google.com", false},
		{"javascript:alert(1)", "play.google.com", false},
		{"https://groups.google.com/g/x", "play.google.com", false},
	} {
		if got := linkOK(c.url, []string{c.host}); got != c.ok {
			t.Errorf("%s for %s: %v, want %v", c.url, c.host, got, c.ok)
		}
	}
}
