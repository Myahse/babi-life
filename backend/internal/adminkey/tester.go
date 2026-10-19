package adminkey

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"strings"
)

// TesterCodeSHA256: the SHA-256 of the testers' code, as in web/src/lib/launch.ts.
// The code itself is never in the repository.
const TesterCodeSHA256 = "92b21e0ee6aa63de70e43ad4d37d005b992d0c44837a0e4f6ad4773123971e4d"

// Tester: the testers' code (any case) or the master key.
func Tester(pass string) bool {
	pass = strings.TrimSpace(pass)
	if pass == "" {
		return false
	}
	sum := sha256.Sum256([]byte(strings.ToLower(pass)))
	if hex.EncodeToString(sum[:]) == TesterCodeSHA256 {
		return true
	}
	return Master != "" && subtle.ConstantTimeCompare([]byte(pass), []byte(Master)) == 1
}
