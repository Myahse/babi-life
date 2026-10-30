// Package i18n says the server's words in the player's language. The game
// is written in French; a player who plays in English sends « X-Lang: en »
// (web lib/i18n.ts), and the JSON the server answers is translated on the way
// out (Middleware): every string that is one of the catalogue's French texts
// (en.json, kept by cmd/i18n) comes back in English, the action's label as the
// journal's line, whether it was written just now or stored in French long ago.
//
// A catalogue entry with fmt verbs (« Tu as gagné %d Djai au %s ») is a pattern:
// a string it matches is said with the English pattern, its parts translated
// in turn (the place's name, the activity's label).
package i18n

import (
	"context"
	_ "embed"
	"encoding/json"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
)

//go:embed en.json
var enJSON []byte

type ctxKey struct{}

// Lang: the player's language for this request, "fr" or "en".
func Lang(ctx context.Context) string {
	if l, ok := ctx.Value(ctxKey{}).(string); ok {
		return l
	}
	return "fr"
}

// WithLang: a context in that language (a background job working for a player).
func WithLang(ctx context.Context, lang string) context.Context {
	return context.WithValue(ctx, ctxKey{}, Norm(lang))
}

// Norm: "en" for any English, "fr" otherwise.
func Norm(lang string) string {
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(lang)), "en") {
		return "en"
	}
	return "fr"
}

// FromRequest: X-Lang, else the browser's Accept-Language (its first language).
func FromRequest(r *http.Request) string {
	if l := r.Header.Get("X-Lang"); l != "" {
		return Norm(l)
	}
	return Norm(r.Header.Get("Accept-Language"))
}

type pattern struct {
	re     *regexp.Regexp
	lit    string // its longest literal part: a cheap test before the regexp
	en     string
	nverbs int
}

type catalogue struct {
	exact    map[string]string
	patterns []pattern
	cache    sync.Map
	cached   int64
	mu       sync.Mutex
}

var (
	once sync.Once
	cat  *catalogue
	verb = regexp.MustCompile(`%(\[\d+\])?[-+# 0]*\d*(\.\d+)?[vsdqfgxXtTceEb]|%%`)
)

func load() *catalogue {
	once.Do(func() {
		c := &catalogue{exact: map[string]string{}}
		raw := map[string]string{}
		_ = json.Unmarshal(enJSON, &raw)
		for fr, en := range raw {
			if en == "" || en == "=" {
				continue
			}
			if !verb.MatchString(fr) || !strings.Contains(fr, "%") {
				c.exact[fr] = en
				continue
			}
			p, ok := compile(fr, en)
			if ok {
				c.patterns = append(c.patterns, p)
			}
			// A pattern may also be shown as written (no Sprintf): « 100 % ».
			c.exact[fr] = en
		}
		// The longest first: the most precise pattern wins.
		sort.Slice(c.patterns, func(i, j int) bool { return len(c.patterns[i].lit) > len(c.patterns[j].lit) })
		cat = c
	})
	return cat
}

func compile(fr, en string) (pattern, bool) {
	var b strings.Builder
	b.WriteString("^")
	last, n, longest := 0, 0, ""
	for _, m := range verb.FindAllStringIndex(fr, -1) {
		part := fr[last:m[0]]
		if len(part) > len(longest) {
			longest = part
		}
		b.WriteString(regexp.QuoteMeta(part))
		if fr[m[0]:m[1]] == "%%" {
			b.WriteString("%")
		} else {
			b.WriteString("(.+?)")
			n++
		}
		last = m[1]
	}
	if len(fr[last:]) > len(longest) {
		longest = fr[last:]
	}
	b.WriteString(regexp.QuoteMeta(fr[last:]))
	b.WriteString("$")
	if n == 0 || len(strings.TrimSpace(longest)) < 3 {
		return pattern{}, false
	}
	re, err := regexp.Compile(b.String())
	if err != nil {
		return pattern{}, false
	}
	return pattern{re: re, lit: longest, en: en, nverbs: n}, true
}

// fill: the English pattern with the parts found, in order or by their number (%[2]s).
func fill(en string, args []string) string {
	next := 0
	return verb.ReplaceAllStringFunc(en, func(v string) string {
		if v == "%%" {
			return "%"
		}
		i := next
		if strings.HasPrefix(v, "%[") {
			if k, err := strconv.Atoi(v[2:strings.Index(v, "]")]); err == nil {
				i = k - 1
			}
		} else {
			next++
		}
		if i >= 0 && i < len(args) {
			return args[i]
		}
		return ""
	})
}

// English: the French text in English, or the text as it is when the catalogue doesn't know it.
func English(s string) string {
	return load().translate(s, 0)
}

func (c *catalogue) translate(s string, depth int) string {
	if len(s) < 2 || len(s) > 2000 {
		return s
	}
	if en, ok := c.exact[s]; ok {
		return en
	}
	// Surrounding spaces or a final full stop added by the code: the text inside.
	if t := strings.TrimSpace(s); t != s && t != "" {
		if en, ok := c.exact[t]; ok {
			return strings.Replace(s, t, en, 1)
		}
	}
	if depth > 1 || !strings.ContainsAny(s, " '’") {
		return s
	}
	if v, ok := c.cache.Load(s); ok {
		return v.(string)
	}
	out := s
	for _, p := range c.patterns {
		if !strings.Contains(s, p.lit) {
			continue
		}
		m := p.re.FindStringSubmatch(s)
		if m == nil {
			continue
		}
		args := make([]string, len(m)-1)
		for i, a := range m[1:] {
			args[i] = c.translate(a, depth+1)
		}
		out = fill(p.en, args)
		break
	}
	c.mu.Lock()
	if c.cached > 50000 {
		c.cache = sync.Map{}
		c.cached = 0
	}
	c.cached++
	c.mu.Unlock()
	c.cache.Store(s, out)
	return out
}

// SameVerbs: the English pattern gives every part the French one has (cmd/i18n -check).
func SameVerbs(fr, en string) bool {
	count := func(s string) (n int, max int) {
		for _, v := range verb.FindAllString(s, -1) {
			if v == "%%" {
				continue
			}
			n++
			if strings.HasPrefix(v, "%[") {
				if k, err := strconv.Atoi(v[2:strings.Index(v, "]")]); err == nil && k > max {
					max = k
				}
			}
		}
		return
	}
	nf, _ := count(fr)
	ne, maxE := count(en)
	if maxE > 0 {
		return maxE <= nf && ne == nf
	}
	return ne == nf
}

// Keys whose strings are never the game's words to translate: ids, kinds,
// what the client compares; and what players wrote themselves.
var keep = map[string]bool{
	"id": true, "kind": true, "type": true, "slug": true, "key": true, "icon": true, "state": true, "status": true, "phase": true,
	"gender": true, "city": true, "commune": true, "quartier": true, "token": true, "email": true, "username": true, "handle": true,
	"firstName": true, "lastName": true, "url": true, "photo": true, "avatarUrl": true, "image": true, "video": true, "src": true,
	"code": true, "lang": true, "from": true, "to": true, "at": true, "createdAt": true, "game": true, "interactionId": true,
	"placeId": true, "app": true, "topic": true, "source": true, "link": true, "caption": true, "bio": true, "comment": true,
	"aspiration": true, "traits": true, "career": true, "look": true, "role": true, "tag": true, "plate": true, "room": true,
}

// translateJSON: every string of the value in English, but under the keys above.
func translateJSON(v any, c *catalogue) any {
	switch x := v.(type) {
	case map[string]any:
		for k, val := range x {
			if keep[k] || strings.HasSuffix(k, "Id") || strings.HasSuffix(k, "ID") || strings.HasSuffix(k, "At") {
				continue
			}
			x[k] = translateJSON(val, c)
		}
		return x
	case []any:
		for i, val := range x {
			x[i] = translateJSON(val, c)
		}
		return x
	case string:
		return c.translate(x, 0)
	}
	return v
}

// Translate: JSON in French, in English (what the middleware does to an answer).
func Translate(body []byte) ([]byte, bool) {
	dec := json.NewDecoder(strings.NewReader(string(body)))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return body, false
	}
	v = translateJSON(v, load())
	var b strings.Builder
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return body, false
	}
	return []byte(b.String()), true
}
