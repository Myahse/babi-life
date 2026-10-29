-- Replying to one message or comment (update « repondre-message »): the one it
-- answers, in the same chat, grin room or video. No foreign key: when the
-- original goes, the reply keeps its id and shows « Message supprimé ».
ALTER TABLE messages ADD COLUMN reply_to BIGINT;
ALTER TABLE grin ADD COLUMN reply_to BIGINT;
ALTER TABLE tiki_comments ADD COLUMN reply_to BIGINT;
ALTER TABLE tiki_npc_comments ADD COLUMN reply_to BIGINT;
