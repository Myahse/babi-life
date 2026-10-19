-- A pool in the house a Sim built lets it swim at home (game.CanSwimAtHome):
-- it counts among the pieces it has, for the houses built before.
UPDATE sims s SET furnished = array_append(s.furnished, 'piscine')
FROM plots p
WHERE p.sim_id = s.id
  AND NOT ('piscine' = ANY(s.furnished))
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(p.zones) z WHERE z->>4 = 'piscine');
