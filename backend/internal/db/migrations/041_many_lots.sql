-- Several lots a Sim (two at most in a commune): a plot is known by its own
-- id now, not by its Sim's. The house the Sim lives in is sims.home_plot.
ALTER TABLE plots ADD COLUMN id BIGSERIAL;
ALTER TABLE plots DROP CONSTRAINT plots_pkey;
ALTER TABLE plots ADD PRIMARY KEY (id);
CREATE INDEX plots_sim ON plots (sim_id);
CREATE INDEX plots_commune ON plots (lot_city, lot_commune) WHERE lot_w > 0;
ALTER TABLE sims ADD COLUMN home_plot BIGINT;
UPDATE sims s SET home_plot = p.id FROM plots p WHERE p.sim_id = s.id AND s.housing = 'maison';
