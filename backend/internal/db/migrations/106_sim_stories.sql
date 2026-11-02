-- The quartier's stories (game/stories.go): where each Sim is in each story it began, the chapter
-- and step it's at, the real day the chapter can be done from (one a day), and when it ended.
CREATE TABLE IF NOT EXISTS sim_stories (
    sim_id     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    story_id   TEXT NOT NULL,
    chapter    INTEGER NOT NULL DEFAULT 0,
    step       INTEGER NOT NULL DEFAULT 0,
    ready_day  BIGINT NOT NULL,
    done_at    TIMESTAMPTZ,
    PRIMARY KEY (sim_id, story_id)
);
