-- TEST ONLY: emulates provider-owned schema; not JWT verification / Supabase Auth.
begin;
CREATE ROLE :"anon" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE :"authenticated" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE :"reader" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE :"audit" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
COMMENT ON ROLE :"anon" IS :'marker';
COMMENT ON ROLE :"authenticated" IS :'marker';
COMMENT ON ROLE :"reader" IS :'marker';
COMMENT ON ROLE :"audit" IS :'marker';
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA auth;
CREATE SCHEMA task_harness;
REVOKE ALL ON SCHEMA auth,task_harness FROM PUBLIC;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE auth.sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id));
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT (auth.jwt()->>'sub')::uuid
$$;
REVOKE ALL ON FUNCTION auth.uid(),auth.jwt() FROM PUBLIC;
GRANT USAGE ON SCHEMA public,auth TO :"anon", :"authenticated", :"reader", :"audit";
GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO :"anon", :"authenticated", :"reader", :"audit";
CREATE TABLE task_harness.identities (label text PRIMARY KEY, user_id uuid NOT NULL, session_id uuid NOT NULL);
CREATE TABLE task_harness.entities (label text PRIMARY KEY, id uuid NOT NULL);
commit;
