-- Le mode vie, its next pillars (sims/vie.go, the update « mode-vie »): what a Sim's life holds beyond its
-- needs, in one document. Its moods (moodlets: a reason, a weight, until when, in game minutes), its skills
-- (the points earned in each: cuisine, charisme, forme…), its family's gauges (papa, maman), and when the
-- house was last cleaned. Written by the server only (actions finished, chats, the clock).
ALTER TABLE sims ADD COLUMN IF NOT EXISTS life JSONB NOT NULL DEFAULT '{}';
