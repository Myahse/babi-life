-- Vehicles of one's own (sims/garage.go, game/vehicles.go): the places bought
-- to keep them (a bike rack, a moto parking, a garage, in a commune) and the
-- vehicles, each kept in one of them; km: how far it has been driven.
CREATE TABLE IF NOT EXISTS parkings (
	id BIGSERIAL PRIMARY KEY,
	sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
	kind TEXT NOT NULL,
	city TEXT NOT NULL,
	commune TEXT NOT NULL,
	bought_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parkings_sim ON parkings (sim_id);
CREATE TABLE IF NOT EXISTS vehicles (
	id BIGSERIAL PRIMARY KEY,
	sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
	model TEXT NOT NULL,
	color TEXT NOT NULL,
	parking BIGINT REFERENCES parkings(id) ON DELETE SET NULL,
	km DOUBLE PRECISION NOT NULL DEFAULT 0,
	bought_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicles_sim ON vehicles (sim_id);
