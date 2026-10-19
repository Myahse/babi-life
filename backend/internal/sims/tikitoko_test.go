package sims

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/png"
	"math/rand/v2"
	"testing"
	"time"
)

func pngURL(w, h int) string {
	var b bytes.Buffer
	_ = png.Encode(&b, image.NewRGBA(image.Rect(0, 0, w, h)))
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(b.Bytes())
}

func TestDecodePhoto(t *testing.T) {
	if raw, mime, err := decodePhoto(pngURL(320, 200)); err != nil || mime != "image/png" || len(raw) == 0 {
		t.Fatalf("a small PNG: %v %q", err, mime)
	}
	for name, bad := range map[string]string{
		"not an image": "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte("<svg onload=alert(1)>")),
		"svg":          "data:image/svg+xml;base64,PHN2Zy8+",
		"no data url":  "https://example.com/x.png",
		"too big":      pngURL(2000, 100),
		"too small":    pngURL(8, 8),
	} {
		if _, _, err := decodePhoto(bad); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestTikiAudience(t *testing.T) {
	th, _ := findTheme("danse")
	avg := func(fans int, place string, traits []string) (v, f, pay int) {
		r := rand.New(rand.NewPCG(1, 2))
		for i := 0; i < 400; i++ {
			views, _, nf, p := tikiAudience(fans, th, place, traits, r)
			v, f, pay = v+views, f+nf, p
		}
		return v / 400, f / 400, pay
	}
	v0, f0, p0 := avg(0, "", nil)
	vClub, fClub, _ := avg(0, "club", nil)
	vBig, _, pBig := avg(20000, "", nil)
	if v0 <= 0 || f0 <= 0 {
		t.Fatalf("a first post brings nobody: %d views, %d fans", v0, f0)
	}
	if vClub <= v0 || fClub <= f0 {
		t.Errorf("a dance at the club does no better than in the street: %d/%d vs %d/%d", vClub, fClub, v0, f0)
	}
	if vBig <= vClub {
		t.Errorf("20 000 fans bring fewer views (%d) than none (%d)", vBig, vClub)
	}
	if p0 != 0 || pBig != 5000 {
		t.Errorf("brand pay: %d with no fans, %d with 20 000", p0, pBig)
	}
	if tikiTier(0) != "Débutant·e" || tikiTier(1000) != "Créateur·rice" || tikiTier(250000) != "Star de Babi" {
		t.Error("tiers")
	}
	if compact(1234) != "1.2 k" && compact(1234) != "1,2 k" {
		t.Errorf("compact(1234) = %q", compact(1234))
	}
	now := time.Now()
	if g := grown(1000, now.Add(-7*time.Hour), now); g != 1000 {
		t.Errorf("after 7 h: %d", g)
	}
	if g := grown(1000, now, now); g >= 200 {
		t.Errorf("just posted: %d", g)
	}
}

func TestCaption(t *testing.T) {
	if c, err := cleanCaption("  "); err != nil || c != "" {
		t.Error("an empty caption is fine")
	}
	if c, _ := cleanCaption("Au stade !\nviens 0707070707"); c != "Au stade ! viens [numéro masqué]" {
		t.Errorf("caption %q", c)
	}
}

func TestTikiAudienceComments(t *testing.T) {
	at := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	a, b := npcCommentList(7, "garba", 5, at), npcCommentList(7, "garba", 5, at)
	if len(a) != 5 || a[2].Body != b[2].Body || a[2].Handle != b[2].Handle {
		t.Error("a post's audience comments are always the same")
	}
	if npcComments(100) != 0 || npcComments(10_000_000) != tikiNPCMax {
		t.Error("audience comments come with the views, up to a cap")
	}
	if tikiHandle("", "Awa Grâce") != "awagrâce" || tikiHandle("awa225", "Awa") != "awa225" {
		t.Error("handle")
	}
}
