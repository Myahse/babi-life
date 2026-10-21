-- « around » (sims/players.go) reads a Sim's friendships from either side of
-- the pair: bonds(sim_a, …) is the key, this is the other side.
CREATE INDEX IF NOT EXISTS bonds_sim_b_idx ON bonds (sim_b);
