-- Growing up at once, bought in the shop (shop: grandir-enfant, grandir-adulte):
-- the stage to reach on the Sim's next turn, '' when none.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS grow_to TEXT NOT NULL DEFAULT '';
