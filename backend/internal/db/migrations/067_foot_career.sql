-- Babi Foot's career (web components/defi/foot/Career.tsx, sims/footcareer.go):
-- the Sim's club, the players signed on the market (paid in Djai once, kept),
-- and the season as the phone plays it (the league, the matchdays played, the
-- honours), one career per Sim.
CREATE TABLE IF NOT EXISTS foot_careers (
	sim_id UUID PRIMARY KEY REFERENCES sims(id) ON DELETE CASCADE,
	club TEXT NOT NULL,
	squad TEXT[] NOT NULL DEFAULT '{}',
	season JSONB NOT NULL DEFAULT '{}',
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
