-- DEV ONLY: reviewed SQL role to avoid Neon API auto-created BYPASSRLS login roles.
-- Password is deliberately not stored in source or provisioned here.
-- Connect runtime only after credentials are established in a secure Vercel secret store.
CREATE ROLE stayblock_http LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT stayblock_runtime TO stayblock_http WITH INHERIT TRUE, SET FALSE;
-- The name stayblock_http is pinned in bff/verified-db-session.cjs.
-- NEVER authenticate BFF as neondb_owner or any role with BYPASSRLS.
-- In this branch SQL was applied on development separately and verified.
