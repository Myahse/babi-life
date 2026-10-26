package game

import "testing"

// The market: one id each, every post there at every price, a signing's price by his stars.
func TestFootRecruits(t *testing.T) {
	seen := map[string]bool{}
	posts := map[string]int{}
	for _, p := range FootRecruits {
		if seen[p.ID] || p.Name == "" {
			t.Errorf("%q: twice or nameless", p.ID)
		}
		seen[p.ID] = true
		if p.Price != FootPrice[p.Stars] || p.Price <= 0 {
			t.Errorf("%s: %d Djai for %d stars", p.ID, p.Price, p.Stars)
		}
		posts[p.Post]++
		if got, ok := FindFootRecruit(p.ID); !ok || got != p {
			t.Errorf("%s: not found", p.ID)
		}
	}
	for _, post := range []string{"G", "D", "M", "A"} {
		if posts[post] < 3 {
			t.Errorf("post %s: %d players", post, posts[post])
		}
	}
	if len(posts) != 4 {
		t.Errorf("posts: %v", posts)
	}
	if _, ok := FindFootRecruit("nobody"); ok {
		t.Error("an unknown player found")
	}
}
