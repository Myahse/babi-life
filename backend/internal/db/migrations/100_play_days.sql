-- The days each account came into the game, one row a day (the admin's retention: who came back, who
-- opened once and never again). Noted by a trigger when the account is made, signs in, or plays (the
-- game's ping, auth Playing); the days before this migration from what the accounts already hold
-- (made on, last signed in, last played). Abidjan is on UTC: a day is a UTC date.
CREATE TABLE user_days (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day     DATE NOT NULL,
    PRIMARY KEY (user_id, day)
);
CREATE INDEX user_days_day_idx ON user_days (day);

INSERT INTO user_days SELECT id, (created_at AT TIME ZONE 'UTC')::date FROM users ON CONFLICT DO NOTHING;
INSERT INTO user_days SELECT id, (last_login_at AT TIME ZONE 'UTC')::date FROM users WHERE last_login_at IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO user_days SELECT id, (play_seen_at AT TIME ZONE 'UTC')::date FROM users WHERE play_seen_at IS NOT NULL ON CONFLICT DO NOTHING;

CREATE FUNCTION note_user_day() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO user_days (user_id, day) VALUES (NEW.id, (now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING;
    RETURN NEW;
END
$$;
CREATE TRIGGER users_note_day AFTER INSERT OR UPDATE OF last_login_at, play_seen_at ON users
    FOR EACH ROW EXECUTE FUNCTION note_user_day();
