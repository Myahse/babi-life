package sims

import (
	"context"
	"testing"
)

// A deleted account's chats stay with the other player (098_deleted_chats.sql): its
// side signed « Compte supprimé », found by the conversation's own id, never answered.
func TestDeletedAccountChat(t *testing.T) {
	pool := replyDB(t)
	ctx := context.Background()
	awa, koffi, yao := replySim(t, pool, "Awa"), replySim(t, pool, "Koffi"), replySim(t, pool, "Yao")
	hi, err := sendMessage(ctx, pool, awa, koffi, "On se voit au maquis ?", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := sendMessage(ctx, pool, koffi, awa, "Vers 20 h !", &hi.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := sendMessage(ctx, pool, awa, yao, "Yako", nil); err != nil {
		t.Fatal(err)
	}
	g, err := sayInGrin(ctx, pool, awa, "babi", "Bonjour le grin", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM sims WHERE id = $1`, awa); err != nil {
		t.Fatal(err)
	}

	chats, err := goneChats(ctx, pool, koffi)
	if err != nil || len(chats) != 1 {
		t.Fatalf("Koffi's chats with deleted accounts: %+v %v", chats, err)
	}
	c := chats[0]
	if !c.Gone || c.Friend.FirstName != deletedName || c.Friend.ID == awa || c.Unread != 1 || c.Last == nil || !c.Last.Mine {
		t.Errorf("the chat: %+v", c)
	}
	if !goneChat(ctx, pool, koffi, c.Friend.ID) || goneChat(ctx, pool, yao, c.Friend.ID) || goneChat(ctx, pool, koffi, "pas-un-id") {
		t.Error("the chat's id is Koffi's only")
	}
	if other, _ := goneChats(ctx, pool, yao); len(other) != 1 || other[0].Friend.ID == c.Friend.ID || other[0].Unread != 1 {
		t.Errorf("Yao's chat with Awa: its own id, unread: %+v", other)
	}
	msgs, err := goneMessages(ctx, pool, koffi, c.Friend.ID, 0)
	if err != nil || len(msgs) != 2 || msgs[0].Mine || !msgs[1].Mine {
		t.Fatalf("the thread: %+v %v", msgs, err)
	}
	if q := msgs[1].Quote; q == nil || q.Deleted || q.Name != deletedName || q.Body != hi.Body {
		t.Errorf("Koffi's reply quotes « Compte supprimé »: %+v", q)
	}
	if q := grinQuote(ctx, pool, koffi, &g); q == nil || q.Deleted || q.Name != deletedName {
		t.Errorf("the grin's quote: %+v", q)
	}
	if err := canWrite(ctx, pool, koffi, c.Friend.ID); err != errNotFriends {
		t.Errorf("writing to a deleted account: %v", err)
	}
}
