package adminkey

import (
	"net/http/httptest"
	"testing"
)

func TestOK(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	Master = ""
	if OK(r, "") || OK(r, "own") {
		t.Error("no header passes")
	}
	r.Header.Set("X-Admin-Key", "own")
	if !OK(r, "own") || OK(r, "other") || OK(r, "") {
		t.Error("own key")
	}
	Master = "master"
	r.Header.Set("X-Admin-Key", "master")
	if !OK(r, "own") || !OK(r, "") {
		t.Error("the master key opens every part")
	}
	r.Header.Set("X-Admin-Key", "")
	if OK(r, "") {
		t.Error("an empty key matched an empty master")
	}
}
