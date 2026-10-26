-- A president's speech or address can be reported like a message (reports.word_id),
-- once per player; enough reports take it down (hidden). journal_from/journal_to:
-- the ids of its copies in every Sim's journal (sim_events), to take them down too.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS word_id BIGINT REFERENCES president_words(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reports_word_once ON reports (word_id, reporter) WHERE word_id IS NOT NULL;
ALTER TABLE president_words ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE president_words ADD COLUMN IF NOT EXISTS journal_from BIGINT NOT NULL DEFAULT 0;
ALTER TABLE president_words ADD COLUMN IF NOT EXISTS journal_to BIGINT NOT NULL DEFAULT 0;
