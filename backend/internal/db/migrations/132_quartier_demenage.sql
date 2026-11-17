-- Mon quartier follows the home (sims/monquartier.go quartierMove): when the Sim moves house, its quartier is
-- offered to move round the new home, its buildings onto the same lots there. stay_lat/stay_lng: the home the
-- owner chose to keep its quartier away from (not asked again for it). on_street: false for a building moved with
-- its quartier, set on its new lot's place until the phone snaps it onto the street there (POST quartier/place).
ALTER TABLE quartiers ADD COLUMN IF NOT EXISTS stay_lat DOUBLE PRECISION;
ALTER TABLE quartiers ADD COLUMN IF NOT EXISTS stay_lng DOUBLE PRECISION;
ALTER TABLE quartier_buildings ADD COLUMN IF NOT EXISTS on_street BOOLEAN NOT NULL DEFAULT true;
