-- Positive identity checked by identity.sql; no other DB touched, no catch-all role deletion.
SELECT count(*)=4 AND bool_and(NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin
 AND shobj_description(oid,'pg_authid')=:'marker') AS roles_owned
 FROM pg_roles WHERE rolname IN (:'anon',:'authenticated',:'reader',:'audit') \gset
\if :roles_owned
\else
 \echo REFUSE_ROLE_IDENTITY
 SELECT 1 / 0; -- ON_ERROR_STOP must produce nonzero exit status
\endif
SELECT NOT EXISTS (SELECT 1 FROM pg_shdepend WHERE refobjid IN
 (SELECT oid FROM pg_roles WHERE rolname IN (:'anon',:'authenticated',:'reader',:'audit'))
 AND dbid<>0 AND dbid<>(SELECT oid FROM pg_database WHERE datname=current_database())) AS no_other_db_deps \gset
\if :no_other_db_deps
\else
 \echo REFUSE_CROSS_DATABASE_ROLE_DEPENDENCY
 SELECT 1 / 0; -- ON_ERROR_STOP must produce nonzero exit status
\endif
begin;
-- Explicit schemas inside the positively identified disposable DB only.
DROP SCHEMA task_harness,private,auth,public CASCADE;
DROP ROLE :"anon", :"authenticated", :"reader", :"audit";
commit;
SELECT 'TASK_ROLES_REMOVED';
