-- Inviting a friend from anywhere (sims/players.go): who pays the trip there, the one inviting
-- (« moi ») or the one invited (« toi »); 'travelling': accepted, on the way.
ALTER TABLE invites ADD COLUMN IF NOT EXISTS pays TEXT NOT NULL DEFAULT 'toi';
