package ads

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// Bucket is where the advertisers' files are kept: any S3-compatible store
// (Cloudflare R2, AWS S3, Backblaze B2…). The browser puts the file there
// itself with a short-lived signed URL; players read it from the bucket's
// public address. Signature Version 4, query-string form, path-style URLs.
type Bucket struct {
	Endpoint  string // https://<account>.r2.cloudflarestorage.com
	Region    string // "auto" for R2
	Name      string
	AccessKey string
	SecretKey string
	PublicURL string // where players read the files: https://pub-….r2.dev or a custom domain
}

// Ready: everything needed is set.
func (b *Bucket) Ready() bool {
	return b != nil && b.Endpoint != "" && b.Name != "" && b.AccessKey != "" && b.SecretKey != "" && b.PublicURL != ""
}

// Public: where a file is read from.
func (b *Bucket) Public(key string) string {
	return strings.TrimRight(b.PublicURL, "/") + "/" + escapePath(key)
}

// Presign: a URL that allows one method on one file until it expires.
func (b *Bucket) Presign(method, key string, expires time.Duration, now time.Time) string {
	return b.presignRaw(method, "/"+b.Name+"/"+escapePath(key), expires, now, "UNSIGNED-PAYLOAD")
}

// presignRaw signs a request for a path on the endpoint's host.
func (b *Bucket) presignRaw(method, path string, expires time.Duration, now time.Time, payload string) string {
	u, _ := url.Parse(strings.TrimRight(b.Endpoint, "/"))
	host := u.Host
	region := b.Region
	if region == "" {
		region = "auto"
	}
	t := now.UTC()
	date := t.Format("20060102")
	stamp := t.Format("20060102T150405Z")
	scope := date + "/" + region + "/s3/aws4_request"
	q := url.Values{}
	q.Set("X-Amz-Algorithm", "AWS4-HMAC-SHA256")
	q.Set("X-Amz-Credential", b.AccessKey+"/"+scope)
	q.Set("X-Amz-Date", stamp)
	q.Set("X-Amz-Expires", fmt.Sprint(int(expires.Seconds())))
	q.Set("X-Amz-SignedHeaders", "host")
	query := strings.ReplaceAll(q.Encode(), "+", "%20")
	canonical := strings.Join([]string{method, path, query, "host:" + host + "\n", "host", payload}, "\n")
	toSign := strings.Join([]string{"AWS4-HMAC-SHA256", stamp, scope, hexSHA(canonical)}, "\n")
	key4 := hmacSHA([]byte("AWS4"+b.SecretKey), date)
	key4 = hmacSHA(key4, region)
	key4 = hmacSHA(key4, "s3")
	key4 = hmacSHA(key4, "aws4_request")
	sig := hex.EncodeToString(hmacSHA(key4, toSign))
	return u.Scheme + "://" + host + path + "?" + query + "&X-Amz-Signature=" + sig
}

func hmacSHA(key []byte, data string) []byte {
	m := hmac.New(sha256.New, key)
	m.Write([]byte(data))
	return m.Sum(nil)
}

func hexSHA(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// escapePath: each part of a key, URI-encoded as S3 wants it (slashes kept).
func escapePath(key string) string {
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = strings.ReplaceAll(url.PathEscape(p), "+", "%2B")
	}
	return strings.Join(parts, "/")
}
