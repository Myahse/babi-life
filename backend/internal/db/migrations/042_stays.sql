-- A stay away from home: a hotel room rented for hours or nights, or a home
-- booked on Dodo (sims/hotel.go, sims/dodo.go). NULL: none.
ALTER TABLE sims ADD COLUMN stay JSONB;
CREATE INDEX sims_stay_place ON sims ((stay->>'place')) WHERE stay IS NOT NULL;
