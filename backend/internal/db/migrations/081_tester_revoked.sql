-- « Retirer tous les testeurs » (admin): the accounts lose the toolbox and the
-- game before its opening; the code a browser kept no longer brings them back.
ALTER TABLE users ADD COLUMN tester_revoked BOOLEAN NOT NULL DEFAULT false;
