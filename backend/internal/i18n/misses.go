package i18n

import (
	"os"
	"regexp"
	"strings"
	"sync"
)

// misses: the French an English answer still carried (a sentence built in a
// way the catalogue can't match), written once each to the file named by
// I18N_MISSES. A dev tool, to find what to fix: off when the variable is unset.
var misses = func() func(string) {
	path := os.Getenv("I18N_MISSES")
	if path == "" {
		return nil
	}
	var mu sync.Mutex
	seen := map[string]bool{}
	return func(s string) {
		mu.Lock()
		defer mu.Unlock()
		if seen[s] {
			return
		}
		seen[s] = true
		if f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {
			_, _ = f.WriteString(strings.ReplaceAll(s, "\n", `\n`) + "\n")
			_ = f.Close()
		}
	}
}()

var (
	frenchWord   = regexp.MustCompile(`(?i)(^|[\s'’])(le|la|les|une|des|du|tu|ton|ta|tes|il|elle|et|au|aux|est|pour|avec|pas|ne|sur|dans|qui|que|ça|cette|chez|plus|je|mon|nous|vous|ils|leur|à)([\s'’,.!]|$)`)
	frenchAccent = regexp.MustCompile(`[àâéèêëîïôùûçœ«»]`)
)

// looksFrench: a text that reads as French (two French words, or one and an accent).
func looksFrench(s string) bool {
	n := len(frenchWord.FindAllString(s, -1))
	return strings.Contains(s, " ") && (n >= 2 || n == 1 && frenchAccent.MatchString(s))
}
