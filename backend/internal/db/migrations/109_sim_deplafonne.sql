-- Waye déplafonné (shop « deplafonnement », game.RaisedPlayers): this Sim's account sends and gets more
-- Djai from players a day.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS deplafonne BOOLEAN NOT NULL DEFAULT false;
