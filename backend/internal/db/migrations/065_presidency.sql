-- The republic's week (politics/politics.go, game/civic.go): the campaign on
-- Friday evening and Saturday, the vote on Sunday, the results on Monday at 9 h.
ALTER TABLE elections ADD COLUMN IF NOT EXISTS campaign_at TIMESTAMPTZ;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS results_at TIMESTAMPTZ;
UPDATE elections SET campaign_at = opens_at WHERE campaign_at IS NULL;
UPDATE elections SET results_at = closes_at WHERE results_at IS NULL;
ALTER TABLE elections ALTER COLUMN campaign_at SET NOT NULL;
ALTER TABLE elections ALTER COLUMN results_at SET NOT NULL;

-- The election an office came from (the president's week: its measures, its rating, its words).
ALTER TABLE offices ADD COLUMN IF NOT EXISTS election_id BIGINT REFERENCES elections(id) ON DELETE SET NULL;

-- A tour of a place counts once an election (campaign_acts.kind 'terrain').
ALTER TABLE campaign_acts ADD COLUMN IF NOT EXISTS place_id TEXT NOT NULL DEFAULT '';

-- The president's words: the inaugural speech (discours, one a week) and the addresses to the nation (one a day).
CREATE TABLE IF NOT EXISTS president_words (
    id          BIGSERIAL PRIMARY KEY,
    election_id BIGINT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    sim_id      UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    text        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS president_words_election ON president_words (election_id, created_at);

-- The measures decreed for the week (game.Measures), in force until the next results.
CREATE TABLE IF NOT EXISTS measures (
    election_id BIGINT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    measure     TEXT NOT NULL,
    until       TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (election_id, measure)
);
CREATE INDEX IF NOT EXISTS measures_until ON measures (until);

-- The citizens' rating of the president: one a day per account, from 1 to 5.
CREATE TABLE IF NOT EXISTS president_ratings (
    election_id BIGINT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day         DATE NOT NULL,
    score       SMALLINT NOT NULL,
    PRIMARY KEY (election_id, user_id, day)
);

-- The stadium's big days: the president's Fête de la Nation, a candidate's meeting.
CREATE TABLE IF NOT EXISTS state_events (
    id          BIGSERIAL PRIMARY KEY,
    kind        TEXT NOT NULL, -- 'fete' | 'meeting'
    election_id BIGINT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    sim_id      UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    place_id    TEXT NOT NULL,
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS state_events_when ON state_events (place_id, ends_at);
CREATE TABLE IF NOT EXISTS state_event_guests (
    event_id BIGINT NOT NULL REFERENCES state_events(id) ON DELETE CASCADE,
    sim_id   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, sim_id)
);

-- A candidate's call to the party's militants: a commune, the pay of each, the places;
-- the pay of all held from the candidate, what's left given back at the results.
CREATE TABLE IF NOT EXISTS militant_calls (
    id          BIGSERIAL PRIMARY KEY,
    election_id BIGINT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    sim_id      UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    party_id    BIGINT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    commune     TEXT NOT NULL,
    pay         INT NOT NULL,
    slots       INT NOT NULL,
    taken       INT NOT NULL DEFAULT 0,
    held        INT NOT NULL,
    settled     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS militant_calls_open ON militant_calls (party_id, settled);
CREATE TABLE IF NOT EXISTS militant_runs (
    call_id BIGINT NOT NULL REFERENCES militant_calls(id) ON DELETE CASCADE,
    sim_id  UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    paid    INT NOT NULL,
    at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (call_id, sim_id)
);
