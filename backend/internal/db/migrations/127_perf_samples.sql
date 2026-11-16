-- The update « mesures-chargement » (auth/perf.go, admin/chargement.go): how long the game takes to load on the
-- players' own phones, and who leaves while it does. One small row per loading (the game's start, or a new
-- commune's street after a trip), sent by the game in a few batches a session; kept 30 days (pruned now and
-- then as rows come in, so only while someone plays). Times in milliseconds, NULL when not reached.
CREATE TABLE IF NOT EXISTS perf_samples (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 'start': the game opened; 'trip': another commune's street after a trip.
    kind       TEXT NOT NULL,
    commune    TEXT NOT NULL DEFAULT '',
    -- start: from the page's start to the HUD (buttons usable), the first chunk of street drawn, the street « ready »
    -- (the progress card gone), the first tap; trip: the same from the new street's start, and total from the departure.
    hud_ms     INT,
    chunk_ms   INT,
    ready_ms   INT,
    tap_ms     INT,
    total_ms   INT,
    -- Left (the page hidden or closed) before the street was ready; the screen it was on then.
    quit       BOOLEAN NOT NULL DEFAULT false,
    screen     TEXT NOT NULL DEFAULT '',
    -- The street's chunks from the phone's cache, built afresh, or still in memory; the map tiles kept or downloaded.
    chunk_hit  SMALLINT NOT NULL DEFAULT 0,
    chunk_miss SMALLINT NOT NULL DEFAULT 0,
    mem_hit    SMALLINT NOT NULL DEFAULT 0,
    tile_hit   SMALLINT NOT NULL DEFAULT 0,
    tile_miss  SMALLINT NOT NULL DEFAULT 0,
    tile_kb    INT,
    net_kb     INT,
    -- Frames a second in the street (median of its first seconds), and the device: its class (faible, normal,
    -- fort), cores, memory, pixel ratio, the light's tier, « téléphone léger », the connection, the Android app.
    fps        SMALLINT,
    class      TEXT NOT NULL DEFAULT '',
    cores      SMALLINT,
    mem_gb     REAL,
    dpr        REAL,
    tier       TEXT NOT NULL DEFAULT '',
    light      BOOLEAN NOT NULL DEFAULT false,
    net        TEXT NOT NULL DEFAULT '',
    app        BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS perf_samples_at_idx ON perf_samples (at);
