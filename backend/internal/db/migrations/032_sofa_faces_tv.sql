-- The house plans set the sofa with its back to the TV (a piece could only
-- turn a quarter): in the houses already built, a sofa with a TV behind it
-- (same floor, smaller z, a few blocks across) is turned round to face it.
UPDATE plots p SET furniture = (
    SELECT jsonb_agg(
        CASE WHEN e->>4 = 'canape' AND (e->>3)::int = 0 AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(p.furniture) t
            WHERE t->>4 = 'tele' AND (t->>1)::int = (e->>1)::int AND (t->>2)::int < (e->>2)::int AND abs((t->>0)::int - (e->>0)::int) <= 3)
        THEN jsonb_set(e, '{3}', '2') ELSE e END ORDER BY ord)
    FROM jsonb_array_elements(p.furniture) WITH ORDINALITY AS a(e, ord)
)
WHERE jsonb_typeof(p.furniture) = 'array' AND jsonb_array_length(p.furniture) > 0;
