-- Run before EVERY task database phase. Plain PG17 local harness, never production.
SELECT current_database() = :'task_db'
 AND current_database() ~ '^stayblock_task003b_[0-9a-f]{12}$'
 AND inet_server_addr() = inet '127.0.0.1' AND inet_server_port() = 5432
 AND EXISTS (SELECT 1 FROM pg_database WHERE datname=current_database()
   AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user)
   AND shobj_description(oid,'pg_database')=:'marker') AS identity_ok \gset
\if :identity_ok
\else
 \echo REFUSE_TARGET_IDENTITY
 SELECT 1 / 0; -- ON_ERROR_STOP must produce nonzero exit status
\endif
SET statement_timeout='10s';
SET lock_timeout='5s';
