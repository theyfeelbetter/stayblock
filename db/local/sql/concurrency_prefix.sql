SELECT user_id AS ua,session_id AS sa FROM task_harness.identities WHERE label='a' \gset
begin;
SET LOCAL ROLE :"authenticated";
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',:'ua','session_id',:'sa')::text,true) IS NOT NULL;
SELECT 'CONTEXT|' || (NOT rolsuper AND NOT rolbypassrls AND row_security_active('public.reservations'))::text
 FROM pg_roles WHERE rolname=current_user;
