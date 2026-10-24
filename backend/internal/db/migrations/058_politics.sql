-- La politique (politics/politics.go): parties, elections (the president,
-- a mayor per commune), candidates and their campaigns, the players' ballots,
-- the offices held (president, ministers, deputies, mayors), the crews
-- (players' gangs) and the sects joined.
CREATE TABLE IF NOT EXISTS parties (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    acronym    TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '#ff7a00',
    slogan     TEXT NOT NULL DEFAULT '',
    leader     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS party_members (
    sim_id    UUID PRIMARY KEY REFERENCES sims(id) ON DELETE CASCADE,
    party_id  BIGINT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS party_members_party ON party_members (party_id);
-- kind: president | maire (commune set). Candidacies and campaigning from
-- opens_at, the vote from votes_at to closes_at, the results at the close.
CREATE TABLE IF NOT EXISTS elections (
    id        BIGSERIAL PRIMARY KEY,
    kind      TEXT NOT NULL,
    commune   TEXT NOT NULL DEFAULT '',
    opens_at  TIMESTAMPTZ NOT NULL,
    votes_at  TIMESTAMPTZ NOT NULL,
    closes_at TIMESTAMPTZ NOT NULL,
    settled   BOOLEAN NOT NULL DEFAULT false,
    winner    UUID REFERENCES sims(id) ON DELETE SET NULL,
    turnout   INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS elections_open ON elections (settled, closes_at);
CREATE TABLE IF NOT EXISTS candidates (
    election_id BIGINT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    sim_id      UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    party_id    BIGINT REFERENCES parties(id) ON DELETE SET NULL,
    programme   TEXT NOT NULL DEFAULT '',
    votes       INT NOT NULL DEFAULT 0,
    npc_votes   INT NOT NULL DEFAULT 0,
    declared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (election_id, sim_id)
);
-- What a candidate bought for the campaign (points in a commune, or everywhere: commune '').
CREATE TABLE IF NOT EXISTS campaign_acts (
    id          BIGSERIAL PRIMARY KEY,
    election_id BIGINT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    sim_id      UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    commune     TEXT NOT NULL DEFAULT '',
    cost        INT NOT NULL,
    points      INT NOT NULL,
    at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_acts_election ON campaign_acts (election_id, sim_id);
-- One ballot per account and election (the players' votes).
CREATE TABLE IF NOT EXISTS ballots (
    election_id BIGINT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    candidate   UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (election_id, user_id)
);
-- office: president | ministre:<portfolio> | depute:<commune> | maire:<commune>.
CREATE TABLE IF NOT EXISTS offices (
    office     TEXT PRIMARY KEY,
    sim_id     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    since      TIMESTAMPTZ NOT NULL DEFAULT now(),
    until      TIMESTAMPTZ NOT NULL,
    named_by   UUID REFERENCES sims(id) ON DELETE SET NULL,
    paid_until DATE
);
CREATE INDEX IF NOT EXISTS offices_sim ON offices (sim_id);
-- A mayor's word to the commune (one a day).
CREATE TABLE IF NOT EXISTS communiques (
    id         BIGSERIAL PRIMARY KEY,
    commune    TEXT NOT NULL,
    sim_id     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The players' gangs (« crews » in the code: the Sim's gang column is the street's nouchis).
CREATE TABLE IF NOT EXISTS crews (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    tag        TEXT NOT NULL UNIQUE,
    color      TEXT NOT NULL DEFAULT '#111827',
    commune    TEXT NOT NULL,
    leader     UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    treasury   INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crew_members (
    sim_id    UUID PRIMARY KEY REFERENCES sims(id) ON DELETE CASCADE,
    crew_id   BIGINT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
    role      TEXT NOT NULL DEFAULT 'membre',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crew_members_crew ON crew_members (crew_id);
CREATE TABLE IF NOT EXISTS crew_requests (
    crew_id BIGINT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
    sim_id  UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (crew_id, sim_id)
);
-- The sect joined (politics.Sects), and since when (its dues each Monday).
ALTER TABLE sims ADD COLUMN IF NOT EXISTS sect TEXT NOT NULL DEFAULT '';
ALTER TABLE sims ADD COLUMN IF NOT EXISTS sect_since TIMESTAMPTZ;
