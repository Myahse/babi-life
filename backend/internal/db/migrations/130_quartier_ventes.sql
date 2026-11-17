-- Mon quartier (sims/monquartier.go quartierSale): the visitors who bought at a player's quartier building;
-- the first purchase of the day by each buyer brings the owner reputation (and a line in its journal).
CREATE TABLE IF NOT EXISTS quartier_sales (
    owner UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    buyer UUID NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    day   BIGINT NOT NULL,
    PRIMARY KEY (owner, buyer, day)
);
