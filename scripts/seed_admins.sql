-- Creates/updates admin users in Supabase/Postgres.
-- 1) Replace passwords below.
-- 2) Run in Supabase SQL editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin1_email text := 'romant997@gmail.com';
  admin2_email text := 'kolyadov.denis@gmail.com';
  admin1_password text := 'CHANGE_ME_1';
  admin2_password text := 'CHANGE_ME_2';
  salt text;
  hash text;
  user_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = admin1_email) THEN
    salt := encode(gen_random_bytes(8), 'hex');
    hash := encode(digest(salt || admin1_password, 'sha256'), 'hex');
    INSERT INTO users (email, password_hash, salt) VALUES (admin1_email, hash, salt)
    RETURNING id INTO user_id;
    INSERT INTO user_profiles (user_id, language) VALUES (user_id, 'ru')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE email = admin2_email) THEN
    salt := encode(gen_random_bytes(8), 'hex');
    hash := encode(digest(salt || admin2_password, 'sha256'), 'hex');
    INSERT INTO users (email, password_hash, salt) VALUES (admin2_email, hash, salt)
    RETURNING id INTO user_id;
    INSERT INTO user_profiles (user_id, language) VALUES (user_id, 'ru')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;
