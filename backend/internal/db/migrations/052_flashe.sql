-- Flashé, the snap app (sims/flashe.go): a photo sent to friends, seen once
-- for a few seconds, then gone. A snap is always some player's: from_sim
-- sends it to another player (to_sim), or it's between from_sim and one of
-- the friends met in the game (npc, a game.Friend id), sent by them when
-- npc_sent (no image: the app paints it from scene and seed). A friend's
-- reply is written at once, its created_at a few minutes ahead: it shows
-- then. The photo goes a day after it's opened (kept that long for a
-- report), or after a month unopened; the line stays two months, for the
-- flames.
CREATE TABLE snaps (
    id         BIGSERIAL PRIMARY KEY,
    from_sim   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    to_sim     UUID REFERENCES sims(id) ON DELETE CASCADE,
    npc        TEXT,
    npc_sent   BOOLEAN NOT NULL DEFAULT false,
    image      BYTEA,
    mime       TEXT NOT NULL DEFAULT '',
    scene      TEXT NOT NULL DEFAULT '',
    seed       BIGINT NOT NULL DEFAULT 0,
    caption    TEXT NOT NULL DEFAULT '',
    place      TEXT NOT NULL DEFAULT '',
    seconds    INT NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    opened_at  TIMESTAMPTZ,
    CHECK ((to_sim IS NOT NULL) <> (npc IS NOT NULL))
);
CREATE INDEX snaps_from_idx ON snaps (from_sim, created_at DESC);
CREATE INDEX snaps_to_idx ON snaps (to_sim, created_at DESC) WHERE to_sim IS NOT NULL;

ALTER TABLE reports ADD COLUMN snap_id BIGINT REFERENCES snaps(id) ON DELETE SET NULL;
