-- One's own house: the lot bought (its size in metres, where, what it cost),
-- the furniture in it, and the pieces a Sim living there has (sims.furnished).
ALTER TABLE plots
    ADD COLUMN lot_w INT NOT NULL DEFAULT 0,
    ADD COLUMN lot_d INT NOT NULL DEFAULT 0,
    ADD COLUMN lot_city TEXT NOT NULL DEFAULT '',
    ADD COLUMN lot_commune TEXT NOT NULL DEFAULT '',
    ADD COLUMN lot_paid INT NOT NULL DEFAULT 0,
    ADD COLUMN furniture JSONB NOT NULL DEFAULT '[]';
-- The plots built before lots keep their 12 × 12 m, where their owner lives.
UPDATE plots p SET lot_w = 12, lot_d = 12, lot_city = s.home_city, lot_commune = s.home_commune
FROM sims s WHERE s.id = p.sim_id AND jsonb_array_length(p.blocks) > 0;
ALTER TABLE sims ADD COLUMN furnished TEXT[] NOT NULL DEFAULT '{}';
