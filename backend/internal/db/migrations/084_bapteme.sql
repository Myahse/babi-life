-- The baptism (update « bapteme »): the family welcomes the baby once.
ALTER TABLE sims ADD COLUMN baptised BOOLEAN NOT NULL DEFAULT false;
