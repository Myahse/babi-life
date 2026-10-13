// Package news brings real headlines from Côte d'Ivoire into the game: the
// in-game phone has an "Infos" app. Feeds are RSS, read every half hour and
// kept in memory; only titles, sources and links are shown, with a link to
// the publisher.
package news

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/myahse/babi-life/backend/internal/httpx"
)

// DefaultFeeds are used when NEWS_FEEDS is empty.
var DefaultFeeds = []string{
	"https://news.google.com/rss/search?q=C%C3%B4te+d%27Ivoire&hl=fr&gl=CI&ceid=CI:fr",
	"https://news.abidjan.net/rss",
}

const (
	refresh  = 30 * time.Minute
	keep     = 40
	maxBytes = 2 << 20
)

type Item struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Source    string    `json:"source"`
	Link      string    `json:"link"`
	Published time.Time `json:"published"`
	Topic     string    `json:"topic"` // sport, politique, economie, societe, culture, meteo
}

type Service struct {
	feeds  []string
	client *http.Client
	mu     sync.RWMutex
	items  []Item
	when   time.Time
}

func New(feeds []string) *Service {
	if len(feeds) == 0 {
		feeds = DefaultFeeds
	}
	return &Service{feeds: feeds, client: &http.Client{Timeout: 15 * time.Second}}
}

// Run refreshes the headlines until ctx ends.
func (s *Service) Run(ctx context.Context) {
	for {
		s.Refresh(ctx)
		select {
		case <-ctx.Done():
			return
		case <-time.After(refresh):
		}
	}
}

func (s *Service) Refresh(ctx context.Context) {
	var all []Item
	for _, f := range s.feeds {
		items, err := s.fetch(ctx, f)
		if err != nil {
			log.Printf("news: %s: %v", f, err)
			continue
		}
		all = append(all, items...)
	}
	if len(all) == 0 {
		return // keep what we had
	}
	all = dedupe(all)
	sort.Slice(all, func(i, j int) bool { return all[i].Published.After(all[j].Published) })
	if len(all) > keep {
		all = all[:keep]
	}
	s.mu.Lock()
	s.items, s.when = all, time.Now()
	s.mu.Unlock()
}

func (s *Service) Items() ([]Item, time.Time) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.items, s.when
}

// Handler serves GET /news.
func (s *Service) Handler(w http.ResponseWriter, r *http.Request) {
	items, when := s.Items()
	if items == nil {
		items = []Item{}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items, "updated": when})
}

/* ---------- RSS ---------- */

type rss struct {
	Channel struct {
		Title string `xml:"title"`
		Items []struct {
			Title   string `xml:"title"`
			Link    string `xml:"link"`
			GUID    string `xml:"guid"`
			PubDate string `xml:"pubDate"`
			Source  string `xml:"source"`
		} `xml:"item"`
	} `xml:"channel"`
}

func (s *Service) fetch(ctx context.Context, url string) ([]Item, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "BabiLife/1.0 (+https://github.com/myahse/babi-life)")
	res, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", res.StatusCode)
	}
	return Parse(io.LimitReader(res.Body, maxBytes))
}

// Parse reads an RSS 2.0 document.
func Parse(r io.Reader) ([]Item, error) {
	var doc rss
	dec := xml.NewDecoder(r)
	dec.CharsetReader = func(_ string, in io.Reader) (io.Reader, error) { return in, nil }
	if err := dec.Decode(&doc); err != nil {
		return nil, err
	}
	var out []Item
	for _, it := range doc.Channel.Items {
		title := strings.TrimSpace(it.Title)
		source := strings.TrimSpace(it.Source)
		// Google News appends " - Publisher" to titles.
		if i := strings.LastIndex(title, " - "); i > 0 && (source == "" || strings.EqualFold(title[i+3:], source)) {
			if source == "" {
				source = title[i+3:]
			}
			title = strings.TrimSpace(title[:i])
		}
		if source == "" {
			source = strings.TrimSpace(doc.Channel.Title)
		}
		if title == "" || it.Link == "" {
			continue
		}
		pub, _ := parseDate(it.PubDate)
		id := it.GUID
		if id == "" {
			id = it.Link
		}
		out = append(out, Item{ID: id, Title: title, Source: source, Link: strings.TrimSpace(it.Link), Published: pub, Topic: Topic(title)})
	}
	return out, nil
}

func parseDate(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	for _, layout := range []string{time.RFC1123Z, time.RFC1123, "Mon, 2 Jan 2006 15:04:05 -0700", "Mon, 2 Jan 2006 15:04:05 MST", time.RFC3339} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("bad date %q", s)
}

func dedupe(items []Item) []Item {
	seen := map[string]bool{}
	var out []Item
	for _, it := range items {
		k := strings.ToLower(it.Title)
		if seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, it)
	}
	return out
}

var topics = []struct {
	id    string
	words []string
}{
	{"sport", []string{"éléphants", "elephants", "can ", "football", "foot", "match", "asec", "africa sports", "basket", "athlét", "coupe", "ligue", "fif"}},
	{"meteo", []string{"pluie", "inondation", "météo", "sodexam", "orage", "saison des pluies"}},
	{"politique", []string{"président", "gouvernement", "ministre", "élection", "election", "assemblée", "sénat", "parti", "pdci", "rhdp", "ppa-ci", "conseil des ministres"}},
	{"economie", []string{"cacao", "économ", "econom", "fcfa", "prix", "budget", "investis", "banque", "bourse", "port autonome", "emploi", "entreprise"}},
	{"culture", []string{"musique", "concert", "festival", "coupé-décalé", "zouglou", "film", "cinéma", "masa", "femua", "artiste"}},
}

// Topic sorts a headline into a rough category, for an icon and a colour.
func Topic(title string) string {
	t := strings.ToLower(title) + " "
	for _, tp := range topics {
		for _, w := range tp.words {
			if strings.Contains(t, w) {
				return tp.id
			}
		}
	}
	return "societe"
}
