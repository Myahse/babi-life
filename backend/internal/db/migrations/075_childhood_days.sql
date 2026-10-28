-- Childhood now lasts real days (game.GrowUp): a baby for a day, a child and
-- a teenager for the next, adult two days after birth. Every Sim keeps the
-- age it had: its birth moved back to match the new table (it was 3 years at
-- 5 minutes, 12 at 25, 18 at 55; now 3 at 1 440, 12 at 2 160, 18 at 2 880).
UPDATE sims SET born_at = CASE WHEN n.born = 0 THEN -1 ELSE n.born END -- (0 means « no birth date »)
FROM (
    SELECT id, game_minutes - (CASE
        WHEN game_minutes - born_at >= 55 THEN (game_minutes - born_at) + 2825
        WHEN game_minutes - born_at >= 25 THEN 2160 + (game_minutes - born_at - 25) * 24
        WHEN game_minutes - born_at >= 5 THEN 1440 + (game_minutes - born_at - 5) * 36
        WHEN game_minutes - born_at > 0 THEN (game_minutes - born_at) * 288
        ELSE game_minutes - born_at END) AS born
    FROM sims WHERE born_at <> 0
) n
WHERE sims.id = n.id;
