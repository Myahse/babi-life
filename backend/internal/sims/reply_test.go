package sims

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/db"
	"github.com/myahse/babi-life/backend/internal/game"
)

// replyDB: a fresh database migrated from scratch, beside the one TEST_DATABASE_URL
// names (e.g. postgres://postgres:pg@localhost:5432/babi); without it, the test is skipped.
func replyDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	admin, err := db.Connect(ctx, base)
	if err != nil {
		t.Skipf("no database: %v", err)
	}
	defer admin.Close()
	name := fmt.Sprintf("babi_test_reply_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, `CREATE DATABASE `+name); err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(base)
	u.Path = "/" + name
	pool, err := db.Connect(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		if a, err := db.Connect(ctx, base); err == nil {
			_, _ = a.Exec(ctx, `DROP DATABASE IF EXISTS `+name+` WITH (FORCE)`)
			a.Close()
		}
	})
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	return pool
}

// replySim: a player and their Sim, named so.
func replySim(t *testing.T, pool *pgxpool.Pool, first string) string {
	t.Helper()
	ctx := context.Background()
	var user, sim string
	if err := pool.QueryRow(ctx, `INSERT INTO users (email, name, first_name, last_name, username, password_hash) VALUES ($1, $2, $2, 'Test', $3, 'x') RETURNING id`,
		strings.ToLower(first)+"@test.ci", first, strings.ToLower(first)).Scan(&user); err != nil {
		t.Fatal(err)
	}
	now := game.MinuteOf(time.Now())
	if err := pool.QueryRow(ctx, `
		INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration,
		                  home_city, home_commune, city, commune, money, needs, game_minutes,
		                  origin, housing, loan, born_at, family, apps)
		VALUES ($1, $2, 'Test', 'femme', '{}', '{}', '', 'abidjan', 'cocody', 'abidjan', 'cocody', 0, $3, $4, '', '', 0, $4, '', '{}')
		RETURNING id`, user, first, game.FreshNeeds(), now).Scan(&sim); err != nil {
		t.Fatal(err)
	}
	return sim
}

func TestReplyToMessage(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	awa, koffi := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi")

	first, err := sendMessage(ctx, pool, awa, koffi, "On se voit au maquis ce soir ?", nil)
	if err != nil || first.ReplyTo != nil || first.Quote != nil {
		t.Fatalf("a plain message: %+v %v", first, err)
	}
	// Koffi answers that very message: linked, and quoted with Awa's name.
	reply, err := sendMessage(ctx, pool, koffi, awa, "Vers 20 h !", &first.ID)
	if err != nil || reply.ReplyTo == nil || *reply.ReplyTo != first.ID {
		t.Fatalf("the reply: %+v %v", reply, err)
	}
	if q := reply.Quote; q == nil || q.Name != "Awa" || q.Body != first.Body || q.Kind != "text" || q.Mine || q.Deleted {
		t.Errorf("its quote: %+v", reply.Quote)
	}
	// Awa reads the thread: the quote is there, and it's hers.
	thread, err := threadMessages(ctx, pool, awa, koffi, 0)
	if err != nil || len(thread) != 2 || thread[1].Quote == nil || !thread[1].Quote.Mine {
		t.Fatalf("the thread: %+v %v", thread, err)
	}
	// A sticker is quoted as a sticker; a long message is cut.
	st, _ := sendMessage(ctx, pool, awa, koffi, "[sticker:on-dit-quoi]", nil)
	long, _ := sendMessage(ctx, pool, awa, koffi, strings.Repeat("ah ", 100), nil)
	if r, err := sendMessage(ctx, pool, koffi, awa, "😂", &st.ID); err != nil || r.Quote.Kind != "sticker" {
		t.Errorf("sticker quote: %+v %v", r.Quote, err)
	}
	if r, err := sendMessage(ctx, pool, koffi, awa, "ok", &long.ID); err != nil || len([]rune(r.Quote.Body)) > quoteRunes+1 || !strings.HasSuffix(r.Quote.Body, "…") {
		t.Errorf("long quote: %+v %v", r.Quote, err)
	}
}

func TestReplyToAnotherChatRefused(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	awa, koffi, yao := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi"), replySim(t, pool, "Yao")
	other, err := sendMessage(ctx, pool, yao, koffi, "Secret entre nous", nil)
	if err != nil {
		t.Fatal(err)
	}
	// Koffi can't quote Yao's message to Awa.
	if _, err := sendMessage(ctx, pool, koffi, awa, "Regarde ça", &other.ID); !errors.Is(err, errNoReplyTo) {
		t.Errorf("a message of another chat: %v", err)
	}
	missing := int64(999999)
	if _, err := sendMessage(ctx, pool, koffi, awa, "Et ça", &missing); !errors.Is(err, errNoReplyTo) {
		t.Errorf("a message that doesn't exist: %v", err)
	}
	var n int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM messages WHERE from_sim = $1 AND to_sim = $2`, koffi, awa).Scan(&n)
	if n != 0 {
		t.Errorf("refused replies were written: %d", n)
	}
	// The grin: only a message of the same room.
	g, err := sayInGrin(ctx, pool, yao, "plateau", "Qui est au Plateau ?", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := sayInGrin(ctx, pool, awa, "babi", "Moi !", &g); !errors.Is(err, errNoReplyTo) {
		t.Errorf("a grin message of another room: %v", err)
	}
	if _, err := sayInGrin(ctx, pool, awa, "plateau", "Moi !", &g); err != nil {
		t.Errorf("same room: %v", err)
	}
	// Tikitoko: a comment of another video is refused, one of the same is fine.
	var p1, p2 int64
	for _, p := range []*int64{&p1, &p2} {
		if err := pool.QueryRow(ctx, `INSERT INTO tiki_posts (sim, image, mime, theme) VALUES ($1, '\x00', 'image/jpeg', 'danse') RETURNING id`, yao).Scan(p); err != nil {
			t.Fatal(err)
		}
	}
	c1, err := addTikiComment(ctx, pool, awa, p1, "Trop fort 🔥", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := addTikiComment(ctx, pool, koffi, p2, "Vrai", c1); !errors.Is(err, errNoReplyTo) {
		t.Errorf("a comment of another video: %v", err)
	}
	if _, err := addTikiComment(ctx, pool, koffi, p1, "Vrai", "n"+c1); !errors.Is(err, errNoReplyTo) {
		t.Errorf("a game post's comment id under a player's video: %v", err)
	}
	if _, err := addTikiComment(ctx, pool, koffi, p1, "Vrai de vrai", c1); err != nil {
		t.Errorf("same video: %v", err)
	}
	list, err := tikiCommentList(ctx, pool, yao, p1, yao)
	if err != nil || len(list) != 2 || list[0].ReplyTo != c1 || list[0].Quote == nil || list[0].Quote.Name != "awa" {
		t.Errorf("the comments: %+v %v", list, err)
	}
}

func TestReplyToDeletedMessage(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	awa, koffi := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi")
	first, _ := sendMessage(ctx, pool, awa, koffi, "Message de trop", nil)
	reply, err := sendMessage(ctx, pool, koffi, awa, "Hein ?", &first.ID)
	if err != nil {
		t.Fatal(err)
	}
	// The moderation deletes the original: the reply stays, its quote says « supprimé ».
	if _, err := pool.Exec(ctx, `DELETE FROM messages WHERE id = $1`, first.ID); err != nil {
		t.Fatal(err)
	}
	thread, err := threadMessages(ctx, pool, koffi, awa, 0)
	if err != nil || len(thread) != 1 || thread[0].ID != reply.ID {
		t.Fatalf("the thread: %+v %v", thread, err)
	}
	if m := thread[0]; m.ReplyTo == nil || *m.ReplyTo != first.ID || m.Quote == nil || !m.Quote.Deleted || m.Quote.Body != "" {
		t.Errorf("deleted original: %+v %+v", m, m.Quote)
	}
	// Same for a Tikitoko comment deleted by its author.
	var post int64
	if err := pool.QueryRow(ctx, `INSERT INTO tiki_posts (sim, image, mime, theme) VALUES ($1, '\x00', 'image/jpeg', 'danse') RETURNING id`, awa).Scan(&post); err != nil {
		t.Fatal(err)
	}
	c, _ := addTikiComment(ctx, pool, koffi, post, "Premier !", "")
	if _, err := addTikiComment(ctx, pool, awa, post, "Merci", c); err != nil {
		t.Fatal(err)
	}
	_, _ = pool.Exec(ctx, `DELETE FROM tiki_comments WHERE body = 'Premier !'`)
	list, err := tikiCommentList(ctx, pool, awa, post, awa)
	if err != nil || len(list) != 1 || list[0].Quote == nil || !list[0].Quote.Deleted {
		t.Errorf("deleted comment: %+v %v", list, err)
	}
}
