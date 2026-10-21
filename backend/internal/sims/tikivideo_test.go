package sims

import (
	"bytes"
	"mime/multipart"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func fakeMP4(n int) []byte {
	b := make([]byte, n)
	copy(b, []byte{0, 0, 0, 0x18, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'})
	return b
}

func TestSniffVideo(t *testing.T) {
	if m, ok := sniffVideo(fakeMP4(64)); !ok || m != "video/mp4" {
		t.Errorf("mp4: %q %v", m, ok)
	}
	if m, ok := sniffVideo([]byte{0x1A, 0x45, 0xDF, 0xA3, 1, 2}); !ok || m != "video/webm" {
		t.Errorf("webm: %q %v", m, ok)
	}
	for _, bad := range [][]byte{nil, []byte("<html>"), []byte("GIF89a......")} {
		if _, ok := sniffVideo(bad); ok {
			t.Errorf("%q taken for a video", bad)
		}
	}
}

func postForm(t *testing.T, video []byte, sound string, ms int) (tikiInput, error) {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	_ = mw.WriteField("poster", pngURL(90, 160))
	_ = mw.WriteField("caption", "Au maquis")
	_ = mw.WriteField("theme", "danse")
	_ = mw.WriteField("sound", sound)
	_ = mw.WriteField("durationMs", strconv.Itoa(ms))
	f, _ := mw.CreateFormFile("video", "clip.mp4")
	_, _ = f.Write(video)
	_ = mw.Close()
	r := httptest.NewRequest("POST", "/sims/x/tiki", &body)
	r.Header.Set("Content-Type", mw.FormDataContentType())
	return readTikiInput(httptest.NewRecorder(), r)
}

func TestReadTikiVideo(t *testing.T) {
	in, err := postForm(t, fakeMP4(2000), "decale", 9000)
	if err != nil || in.VideoMime != "video/mp4" || len(in.Video) != 2000 || in.DurationMs != 9000 || in.Theme != "danse" || in.Sound != "decale" || in.Photo == "" {
		t.Fatalf("a good clip: %v %+v", err, in.DurationMs)
	}
	if _, err := postForm(t, fakeMP4(TikiVideoMax+10), "", 9000); err == nil {
		t.Error("a clip over the cap is taken")
	}
	if _, err := postForm(t, fakeMP4(100), "", 60000); err == nil {
		t.Error("a minute-long clip is taken")
	}
	if _, err := postForm(t, fakeMP4(100), "un-tube-connu", 5000); err == nil {
		t.Error("an unknown sound is taken")
	}
	if _, err := postForm(t, []byte("not a video at all, really"), "", 5000); err == nil {
		t.Error("something else than a video is taken")
	}
}

func TestNPCPosts(t *testing.T) {
	now := time.Date(2026, 10, 21, 15, 0, 0, 0, time.UTC)
	ps := npcPosts(now, "")
	if len(ps) < 2*tikiNPCPerDay {
		t.Fatalf("the game's creators post too little: %d", len(ps))
	}
	for _, p := range ps {
		if p.ID >= 0 || p.At.After(now) || p.NPC == nil || p.Caption == "" {
			t.Fatalf("bad game post %+v", p)
		}
		again, ok := npcPost(p.ID, now)
		if !ok || again.Caption != p.Caption || again.Handle != p.Handle || again.NPC.Scene != p.NPC.Scene {
			t.Fatal("a game post is not the same each time")
		}
		if _, ok := findTheme(p.Theme); !ok {
			t.Errorf("unknown theme %q", p.Theme)
		}
	}
	if _, ok := npcPost(npcID(now.Unix()/86400+1, 0), now); ok {
		t.Error("tomorrow's post shows already")
	}
	if _, ok := npcPost(5, now); ok {
		t.Error("a player's id taken for a game post")
	}
	if prof, ok := npcProfile(ps[0].Author.ID, now); !ok || prof.Handle != ps[0].Handle {
		t.Error("a game creator has no page")
	}
}

func TestInterleave(t *testing.T) {
	real := []TikiPost{{ID: 1}, {ID: 2}, {ID: 3}}
	npc := []TikiPost{{ID: -1}, {ID: -2}, {ID: -3}, {ID: -4}}
	got := interleave(real, npc)
	want := []int64{1, 2, -1, 3, -2, -3, -4}
	if len(got) != len(want) {
		t.Fatalf("%d posts", len(got))
	}
	for i := range want {
		if got[i].ID != want[i] {
			t.Fatalf("order %v", got)
		}
	}
	if len(interleave(nil, npc)) != 4 || len(interleave(real, nil)) != 3 {
		t.Error("one side empty")
	}
}

func TestNPCCaptionNamesItsPlace(t *testing.T) {
	if got := namedPlace("Le Plateau au lever du soleil ☀️", tikiNPCPlaces["vlog"]); got != "Le Plateau" {
		t.Fatalf("got %q", got)
	}
	if got := namedPlace("Footing sur la corniche à 6 h 💪", tikiNPCPlaces["sport"]); got != "Corniche" {
		t.Fatalf("got %q", got)
	}
	if got := namedPlace("Je vous fais visiter mon quartier", tikiNPCPlaces["vlog"]); got != "" {
		t.Fatalf("got %q", got)
	}
}
