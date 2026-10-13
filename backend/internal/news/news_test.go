package news

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestParseGoogleNews(t *testing.T) {
	f, err := os.Open("testdata/google.xml")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	items, err := Parse(f)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 4 {
		t.Fatalf("got %d items", len(items))
	}
	a := items[0]
	if a.Title != "Les Éléphants qualifiés pour la CAN" || a.Source != "Fratmat.info" || a.Topic != "sport" || a.Published.IsZero() {
		t.Errorf("first item: %+v", a)
	}
	if got := Topic("Conseil des ministres : un programme pour l'emploi des jeunes"); got != "politique" {
		t.Errorf("politics should win over economy words, got %s", got)
	}
	if items[1].Topic != "economie" || items[2].Topic != "meteo" || items[2].Source != "AIP" {
		t.Errorf("topics/sources: %+v %+v", items[1], items[2])
	}
}

func TestRefreshSortsDedupesAndKeepsOldOnFailure(t *testing.T) {
	body, _ := os.ReadFile("testdata/google.xml")
	ok := true
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !ok {
			http.Error(w, "down", http.StatusBadGateway)
			return
		}
		w.Write(body)
	}))
	defer srv.Close()

	s := New([]string{srv.URL})
	s.Refresh(context.Background())
	items, _ := s.Items()
	if len(items) != 3 {
		t.Fatalf("duplicates should be dropped, got %d", len(items))
	}
	if items[0].Title != "Le prix du cacao bord champ fixé pour la campagne" {
		t.Errorf("newest first, got %q", items[0].Title)
	}
	ok = false
	s.Refresh(context.Background())
	if again, _ := s.Items(); len(again) != 3 {
		t.Errorf("a failed refresh must keep the old headlines")
	}
}
