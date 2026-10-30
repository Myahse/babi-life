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
	"unicode"
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
	re    *regexp.Regexp
	lit   string // its longest literal part: a cheap test before the regexp
	en    string
	names []string // what each group is: "" for a fmt verb, the name of a {name}
}

type catalogue struct {
	exact    map[string]string
	patterns []pattern
	mu       sync.RWMutex
	cache    map[string]string
}

var (
	once sync.Once
	cat  *catalogue
	verb = regexp.MustCompile(`%(\[\d+\])?[-+#0]*\d*(\.\d+)?[vsdqfgxXtTceEb]|%%`)
	// A part of a text: a fmt verb, or a {name} the code fills in (sims/chat.go).
	hole = regexp.MustCompile(`%(\[\d+\])?[-+#0]*\d*(\.\d+)?[vsdqfgxXtTceEb]|%%|\{[A-Za-z]\w*\}`)
)

func load() *catalogue {
	once.Do(func() {
		c := &catalogue{exact: map[string]string{}, cache: map[string]string{}}
		raw := map[string]string{}
		_ = json.Unmarshal(enJSON, &raw)
		for fr, en := range raw {
			if en == "" || en == "=" {
				continue
			}
			// As written (no Sprintf, nothing filled in): « 100 % », « Bonjour {name} » never shown as is but harmless.
			c.exact[fr] = en
			if !hole.MatchString(fr) {
				continue
			}
			if p, ok := compile(fr, en); ok {
				c.patterns = append(c.patterns, p)
			}
		}
		// The days and months the code writes out (dates said in French: « lundi 3 novembre à 20 h »).
		for fr, en := range calendar {
			if _, ok := c.exact[fr]; !ok {
				c.exact[fr] = en
			}
		}
		// The longest literal first: the most precise pattern wins.
		sort.Slice(c.patterns, func(i, j int) bool { return len(c.patterns[i].lit) > len(c.patterns[j].lit) })
		cat = c
	})
	return cat
}

func compile(fr, en string) (pattern, bool) {
	var b strings.Builder
	b.WriteString("^")
	last, longest := 0, ""
	var names []string
	for _, m := range hole.FindAllStringIndex(fr, -1) {
		part := fr[last:m[0]]
		if len(part) > len(longest) {
			longest = part
		}
		b.WriteString(regexp.QuoteMeta(part))
		switch h := fr[m[0]:m[1]]; {
		case h == "%%":
			b.WriteString("%")
		case h[0] == '{':
			// A name may be empty ({e}: the feminine ending).
			b.WriteString("(.*?)")
			names = append(names, h[1:len(h)-1])
		default:
			b.WriteString("(.+?)")
			names = append(names, "")
		}
		last = m[1]
	}
	if len(fr[last:]) > len(longest) {
		longest = fr[last:]
	}
	b.WriteString(regexp.QuoteMeta(fr[last:]))
	b.WriteString("$")
	if len(names) == 0 || len(strings.TrimSpace(longest)) < 3 {
		return pattern{}, false
	}
	re, err := regexp.Compile(b.String())
	if err != nil {
		return pattern{}, false
	}
	return pattern{re: re, lit: longest, en: en, names: names}, true
}

// fill: the English pattern with the parts found: the fmt verbs in order or by
// their number (%[2]s), the {names} by name.
func fill(en string, names, args []string) string {
	var verbs []string
	byName := map[string]string{}
	for i, n := range names {
		if n == "" {
			verbs = append(verbs, args[i])
		} else if _, had := byName[n]; !had {
			byName[n] = args[i]
		}
	}
	next := 0
	return hole.ReplaceAllStringFunc(en, func(v string) string {
		switch {
		case v == "%%":
			return "%"
		case v[0] == '{':
			if a, ok := byName[v[1:len(v)-1]]; ok {
				return a
			}
			return v
		}
		i := next
		if strings.HasPrefix(v, "%[") {
			if k, err := strconv.Atoi(v[2:strings.Index(v, "]")]); err == nil {
				i = k - 1
			}
		} else {
			next++
		}
		if i >= 0 && i < len(verbs) {
			return verbs[i]
		}
		return ""
	})
}

// calendar: the days and months in French, lower case and capitalised.
var calendar = func() map[string]string {
	m := map[string]string{}
	add := func(fr, en string) {
		m[fr] = en
		m[strings.ToUpper(fr[:1])+fr[1:]] = en
	}
	for i, d := range []string{"lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"} {
		add(d, []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}[i])
	}
	for i, d := range []string{"janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"} {
		add(d, []string{"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"}[i])
	}
	return m
}()

// date: a date as the code writes it out, « dimanche 2 novembre à 20 h » (politics.frenchDate).
var date = regexp.MustCompile(`^(\p{L}+) (\d{1,2}) (\p{L}+) à (\d{1,2}) h(?: (\d{2}))?$`)

// thousandsFR: a number with its thousands apart, « 3 000 », « 1 250 000 ».
// An amount too (game.FCFA: « 5 000F »).
var thousandsFR = regexp.MustCompile(`^(-?\d{1,3}(?:[ \x{00a0}\x{202f}]\d{3})+)([ \x{00a0}\x{202f}]?F)?$`)

// placeOf: a proper name after its French preposition (communeDe, inCommune).
var placeOf = regexp.MustCompile(`^(de |d'|d’|du |à |au )(\p{Lu}[\p{L}\-’' ]{1,30})$`)

// hour: a time as French writes it, « 20 h » or « 9 h 05 ».
var hour = regexp.MustCompile(`^(\d{1,2}) h(?: (\d{2}))?$`)

// Open: whether English is with the players now (the update « anglais »).
func Open(ctx context.Context) bool { return Allowed == nil || Allowed(ctx) }

// For: the language to speak to a player who chose lang (users.lang): English
// only while it is open, French otherwise.
func For(ctx context.Context, lang string) string {
	if Norm(lang) == "en" && Open(ctx) {
		return "en"
	}
	return "fr"
}

// In: the French text in that language.
func In(lang, s string) string {
	if lang == "en" {
		return English(s)
	}
	return s
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
	// Surrounding spaces added by the code: the text inside.
	if t := strings.TrimSpace(s); t != s && t != "" {
		if en, ok := c.exact[t]; ok {
			return strings.Replace(s, t, en, 1)
		}
	}
	if depth > 0 {
		// A part the code put in a sentence: « d'Abobo », « au Plateau » (a commune, said with
		// its French preposition), « ministre de la Santé » (lowered to go mid-sentence).
		if m := placeOf.FindStringSubmatch(s); m != nil {
			if strings.HasPrefix(m[1], "à") || m[1] == "au " {
				return "in " + m[2]
			}
			return "of " + m[2]
		}
		// A number written the French way, « 3 000 »: « 3,000 ».
		if m := thousandsFR.FindStringSubmatch(s); m != nil {
			return strings.NewReplacer(" ", ",", "\u00a0", ",", "\u202f", ",").Replace(m[1]) + m[2]
		}
		if r := []rune(s); unicode.IsLower(r[0]) {
			up := string(unicode.ToUpper(r[0])) + string(r[1:])
			if en, ok := c.exact[up]; ok {
				e := []rune(en)
				return string(unicode.ToLower(e[0])) + string(e[1:])
			}
		}
	}
	if m := hour.FindStringSubmatch(s); m != nil {
		if m[2] == "" {
			m[2] = "00"
		}
		return m[1] + ":" + m[2]
	}
	if m := date.FindStringSubmatch(s); m != nil && calendar[m[1]] != "" && calendar[m[3]] != "" {
		at := m[4] + ":00"
		if m[5] != "" {
			at = m[4] + ":" + m[5]
		}
		return calendar[m[1]] + " " + m[2] + " " + calendar[m[3]] + " at " + at
	}
	if depth > 2 || !strings.ContainsAny(s, " '’") {
		return s
	}
	c.mu.RLock()
	v, ok := c.cache[s]
	c.mu.RUnlock()
	if ok {
		return v
	}
	out := c.match(s, depth)
	c.mu.Lock()
	if len(c.cache) > 50000 {
		c.cache = map[string]string{}
	}
	c.cache[s] = out
	c.mu.Unlock()
	return out
}

func (c *catalogue) match(s string, depth int) string {
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
		return fill(p.en, p.names, args)
	}
	// Two texts the code put one after the other (« A. » + « B »): each in English.
	for i := 1; depth == 0 && i < len(s)-1; i++ {
		if s[i] != ' ' || !strings.ContainsRune(".!?»)…:", rune(s[i-1])) && !strings.HasSuffix(s[:i], "…") && !strings.HasSuffix(s[:i], "»") {
			continue
		}
		left, right := s[:i], s[i+1:]
		l, r := c.translate(left, depth+1), c.translate(right, depth+1)
		if l != left && r != right {
			return l + " " + r
		}
	}
	return s
}

// SameVerbs: the English pattern gives every part the French one has (cmd/i18n -check).
func SameVerbs(fr, en string) bool {
	for _, n := range hole.FindAllString(en, -1) {
		if n[0] == '{' && !strings.Contains(fr, n) {
			return false
		}
	}
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
