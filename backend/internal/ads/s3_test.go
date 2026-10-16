package ads

import (
	"strings"
	"testing"
	"time"
)

// The worked example of AWS's documentation (« Authenticating Requests:
// Using Query Parameters »), virtual-hosted there: the same request
// path-style gives the same signature once the host and path are the same.
func TestPresignMatchesAWSExample(t *testing.T) {
	b := &Bucket{Endpoint: "https://examplebucket.s3.amazonaws.com", Region: "us-east-1", Name: "", AccessKey: "AKIAIOSFODNN7EXAMPLE", SecretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"}
	at := time.Date(2013, 5, 24, 0, 0, 0, 0, time.UTC)
	got := b.presignRaw("GET", "/test.txt", 86400*time.Second, at, "UNSIGNED-PAYLOAD")
	const want = "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"
	if !strings.HasSuffix(got, "X-Amz-Signature="+want) {
		t.Fatalf("signature differs:\n%s", got)
	}
}

func TestPresignShape(t *testing.T) {
	b := &Bucket{Endpoint: "https://acc.r2.cloudflarestorage.com", Name: "babi-pub", AccessKey: "K", SecretKey: "S", PublicURL: "https://pub.example/"}
	u := b.Presign("PUT", "ads/abc def.mp4", 15*time.Minute, time.Now())
	if !strings.HasPrefix(u, "https://acc.r2.cloudflarestorage.com/babi-pub/ads/abc%20def.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256") || !strings.Contains(u, "X-Amz-Expires=900") || !strings.Contains(u, "%2Fauto%2Fs3%2Faws4_request") {
		t.Fatalf("bad URL %s", u)
	}
	if got := b.Public("ads/x.jpg"); got != "https://pub.example/ads/x.jpg" {
		t.Fatalf("public %s", got)
	}
}
