-- Kinéo tickets (sims/cinema.go): a session of a cinema's screen (starts: the
-- game minute), the seats (« F7 »), what was paid, the code shown at the door,
-- and whether it has been used.
CREATE TABLE IF NOT EXISTS cinema_tickets (
	id BIGSERIAL PRIMARY KEY,
	sim_id UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
	cinema TEXT NOT NULL,
	salle SMALLINT NOT NULL,
	film TEXT NOT NULL,
	starts BIGINT NOT NULL,
	seats TEXT[] NOT NULL,
	price INT NOT NULL,
	code TEXT NOT NULL,
	used BOOLEAN NOT NULL DEFAULT false,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cinema_tickets_sim ON cinema_tickets (sim_id, starts DESC);
CREATE INDEX IF NOT EXISTS cinema_tickets_session ON cinema_tickets (cinema, starts, salle);
