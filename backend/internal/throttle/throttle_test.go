package throttle

import (
	"testing"
	"time"
)

// Past the limit, refused; once the window has gone by, allowed again.
func TestLimiter(t *testing.T) {
	l := New(3, time.Minute)
	now := time.Now()
	for i := 0; i < 3; i++ {
		if !l.at("k", now, true) {
			t.Fatalf("try %d refused", i+1)
		}
	}
	if l.at("k", now, true) {
		t.Fatal("a 4th try within the window should be refused")
	}
	if !l.at("other", now, true) {
		t.Fatal("another key has its own tries")
	}
	if !l.at("k", now.Add(2*time.Minute), true) {
		t.Fatal("after the window, tries come back")
	}
	l2 := New(2, time.Minute)
	l2.Hit("x")
	l2.Hit("x")
	if !l2.Full("x") {
		t.Fatal("two failures should fill a limit of two")
	}
}
