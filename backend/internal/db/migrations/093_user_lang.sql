-- The game's language the player chose in « Réglages » (web lib/i18n.ts):
-- 'fr', 'en', or '' never chosen (the device's own then). It follows the
-- account onto another phone.
ALTER TABLE users ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT '';
