-- A soirée's room and entry (update « soiree-deco », sims/party.go): the
-- pieces the host put in its room ([x, y, z, r, "id"], game.CheckLayout),
-- the entry price (0: free), and what each guest paid coming in.
ALTER TABLE soirees ADD COLUMN IF NOT EXISTS price INT NOT NULL DEFAULT 0;
ALTER TABLE soirees ADD COLUMN IF NOT EXISTS layout JSONB;
ALTER TABLE soiree_guests ADD COLUMN IF NOT EXISTS paid INT NOT NULL DEFAULT 0;
