-- A deleted account's chats stay with the players it talked to (account.Delete):
-- its side of a Gbairai conversation and its messages in the grin are kept,
-- signed « Compte supprimé », without anything that says who it was.
--
-- messages: the deleted Sim's side (from_sim or to_sim) becomes NULL, and the
-- conversation is told apart by gone, a random id drawn for it alone (never
-- the old Sim's id, and a different one for each player it talked to, so two
-- conversations can't be tied together). The other player opens it by that id.
-- When the other side is already gone too, the conversation goes entirely.
-- grin: the message's sim becomes NULL.
-- Either way, what the deleted Sim sent as a card (a bet or Loto ticket, a
-- défi's score, a live challenge: lib/share.ts) is replaced by « [retire] »:
-- it points at its bets and games, which go with it.
ALTER TABLE messages ADD COLUMN gone UUID;
ALTER TABLE messages ALTER COLUMN from_sim DROP NOT NULL, ALTER COLUMN to_sim DROP NOT NULL;
ALTER TABLE messages DROP CONSTRAINT messages_from_sim_fkey, DROP CONSTRAINT messages_to_sim_fkey;
ALTER TABLE messages
    ADD CONSTRAINT messages_from_sim_fkey FOREIGN KEY (from_sim) REFERENCES sims(id) ON DELETE SET NULL,
    ADD CONSTRAINT messages_to_sim_fkey FOREIGN KEY (to_sim) REFERENCES sims(id) ON DELETE SET NULL,
    ADD CONSTRAINT messages_one_side CHECK (from_sim IS NOT NULL OR to_sim IS NOT NULL);
CREATE INDEX messages_gone_idx ON messages (gone, id DESC) WHERE gone IS NOT NULL;

ALTER TABLE grin ALTER COLUMN sim DROP NOT NULL;
ALTER TABLE grin DROP CONSTRAINT grin_sim_fkey;
ALTER TABLE grin ADD CONSTRAINT grin_sim_fkey FOREIGN KEY (sim) REFERENCES sims(id) ON DELETE SET NULL;

-- Before a Sim is deleted (the foreign keys then clear its side): however it
-- goes (the account deleted, the Sim deleted from the game, a test bot).
CREATE FUNCTION sim_chats_gone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- Nobody left on the other side: the conversation goes.
    DELETE FROM messages
    WHERE (from_sim = OLD.id AND (to_sim IS NULL OR to_sim = OLD.id))
       OR (to_sim = OLD.id AND from_sim IS NULL);
    -- Its cards: nothing of it to open any more.
    UPDATE messages SET body = '[retire]' WHERE from_sim = OLD.id AND body ~ '^\s*\[(ticket|defi|jeu):';
    UPDATE grin SET body = '[retire]' WHERE sim = OLD.id AND body ~ '^\s*\[(ticket|defi|jeu):';
    -- One new id for each conversation it leaves.
    UPDATE messages m SET gone = g.gone
    FROM (SELECT other, gen_random_uuid() AS gone FROM (
            SELECT DISTINCT CASE WHEN from_sim = OLD.id THEN to_sim ELSE from_sim END AS other
            FROM messages WHERE from_sim = OLD.id OR to_sim = OLD.id) d) g
    WHERE (m.from_sim = OLD.id AND m.to_sim = g.other) OR (m.to_sim = OLD.id AND m.from_sim = g.other);
    RETURN OLD;
END $$;
CREATE TRIGGER sims_chats_gone BEFORE DELETE ON sims FOR EACH ROW EXECUTE FUNCTION sim_chats_gone();
