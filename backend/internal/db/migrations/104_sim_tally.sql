-- What each Sim has done since it was made, activity by activity (the journal keeps only its last lines):
-- how many times, the game minutes spent, the money made or spent, the first time and the last.
-- For the admin's player page (admin/players.go).
CREATE TABLE IF NOT EXISTS sim_tally (
    sim_id         UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    interaction_id TEXT NOT NULL,
    label          TEXT NOT NULL,
    times          INTEGER NOT NULL DEFAULT 0,
    minutes        BIGINT NOT NULL DEFAULT 0,
    money          BIGINT NOT NULL DEFAULT 0,
    first_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (sim_id, interaction_id)
);

-- From before: what the journals still keep of the activities done (« Place — Activity … » lines).
INSERT INTO sim_tally (sim_id, interaction_id, label, times, money, first_at, last_at)
SELECT sim_id, 'journal:' || label, label, count(*), sum(money), min(created_at), max(created_at)
FROM (
    SELECT sim_id, money, created_at,
           trim(regexp_replace(regexp_replace(regexp_replace(split_part(text, ' — ', 2), '\s*\(.*$', ''), '\s*[:.].*$', ''), '\s*·.*$', '')) AS label
    FROM sim_events WHERE kind = 'interaction' AND text LIKE '% — %'
) j
WHERE label <> ''
GROUP BY sim_id, label
ON CONFLICT DO NOTHING;
