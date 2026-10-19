-- Tester accounts: before launch, the team plays everything without waiting
-- (the toolbox, backend/internal/sims/tester.go). Set with the testers' code
-- (POST /me/tester) or from /admin.
ALTER TABLE users ADD COLUMN tester BOOLEAN NOT NULL DEFAULT false;
