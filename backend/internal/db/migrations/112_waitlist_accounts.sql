-- No more wish list (the site signs in straight away): whoever on it has made an account leaves it,
-- now and from now on (an account made, or its e-mail changed, with the address of a sign-up there).
DELETE FROM waitlist w WHERE w.kind = 'email' AND EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(w.contact));

CREATE OR REPLACE FUNCTION leave_waitlist() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM waitlist WHERE kind = 'email' AND lower(contact) = lower(NEW.email);
    RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS users_leave_waitlist ON users;
CREATE TRIGGER users_leave_waitlist AFTER INSERT OR UPDATE OF email ON users
    FOR EACH ROW EXECUTE FUNCTION leave_waitlist();
