-- A WhatsApp campaign set for later (the game's opening at 21:30): status
-- 'scheduled' until send_at, then it starts by itself (admin WatchWhatsApp).
ALTER TABLE wa_campaigns ADD COLUMN send_at timestamptz;
