-- The baby lasts 2 hours of play instead of 24 (game.GrowUp). Every Sim keeps
-- its age: one already past babyhood is born 22 hours later on the clock
-- (the same child, the same teenager); a baby now has its time scaled down
-- (half its 24 hours gone, half its 2 hours gone).
UPDATE sims SET born_at = born_at + 22 * 60
WHERE born_at <> 0 AND game_minutes - born_at >= 24 * 60;
UPDATE sims SET born_at = game_minutes - (game_minutes - born_at) / 12
WHERE born_at <> 0 AND game_minutes - born_at < 24 * 60 AND game_minutes > born_at;
