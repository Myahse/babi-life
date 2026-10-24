-- La boutique, beyond the Djai packs (shop/shop.go): what a purchase is for
-- (kind: djai, pass, energie, prestige; pub: a campaign's price, paid by its
-- advertiser, who has no account) and which thing (item: the pack's or
-- item's id, the campaign's id).
ALTER TABLE purchases ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'djai';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS item TEXT NOT NULL DEFAULT '';
-- The Babi Pass (+25 % on the Djai earned, the gold star): until when; the
-- Pack Prestige (the crown), once and for good.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS pass_until TIMESTAMPTZ;
ALTER TABLE sims ADD COLUMN IF NOT EXISTS prestige BOOLEAN NOT NULL DEFAULT false;
