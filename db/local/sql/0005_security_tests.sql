-- All tests roll back, including helper test permissions. Not a migration.
begin;
CREATE FUNCTION task_harness.check_sql(label text, expected_state text, query text, expected_value text DEFAULT NULL)
 RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actual_state text := '00000'; value text; detail text;
BEGIN
 BEGIN EXECUTE query INTO value;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_state=RETURNED_SQLSTATE,detail=MESSAGE_TEXT;
 END;
 IF actual_state <> expected_state OR (expected_value IS NOT NULL AND value IS DISTINCT FROM expected_value) THEN
   RAISE EXCEPTION 'FAIL % role=% state=% expected=% value=% message=%',label,current_user,actual_state,expected_state,value,detail;
 END IF;
 RETURN 'PASS|'||label||'|role='||current_user||'|SQLSTATE='||actual_state||'|value='||coalesce(value,'<none>');
END $$;
REVOKE ALL ON FUNCTION task_harness.check_sql(text,text,text,text) FROM PUBLIC;
GRANT USAGE ON SCHEMA task_harness TO :"anon",:"authenticated";
GRANT EXECUTE ON FUNCTION task_harness.check_sql(text,text,text,text) TO :"anon",:"authenticated";
SELECT user_id AS ua,session_id AS sa FROM task_harness.identities WHERE label='a' \gset
SELECT user_id AS ub,session_id AS sb FROM task_harness.identities WHERE label='b' \gset
SELECT user_id AS uv,session_id AS sv FROM task_harness.identities WHERE label='viewer' \gset
SELECT user_id AS um,session_id AS sm FROM task_harness.identities WHERE label='manager' \gset
SELECT id AS ha FROM task_harness.entities WHERE label='ha' \gset
SELECT id AS hb FROM task_harness.entities WHERE label='hb' \gset
SELECT id AS pa FROM task_harness.entities WHERE label='pa' \gset
SELECT id AS pb FROM task_harness.entities WHERE label='pb' \gset
SELECT id AS ra FROM task_harness.entities WHERE label='ra' \gset
SELECT id AS rb FROM task_harness.entities WHERE label='rb' \gset
SELECT id AS resa FROM task_harness.entities WHERE label='resa' \gset
SELECT id AS resb FROM task_harness.entities WHERE label='resb' \gset

SET LOCAL ROLE :"anon";
SELECT task_harness.check_sql('anonymous SELECT','42501','SELECT count(*) FROM public.reservations');
SELECT task_harness.check_sql('anonymous INSERT','42501',format('INSERT INTO public.properties(host_id,name) VALUES (%L,''synthetic'')',:'ha'));
SELECT task_harness.check_sql('anonymous private helper','42501','SELECT private.session_ok()');

SET LOCAL ROLE :"authenticated";
SELECT task_harness.check_sql('non-owner non-superuser RLS context','00000',
 $$SELECT (NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin AND row_security_active('public.reservations')
 AND (SELECT relowner FROM pg_class WHERE oid='public.reservations'::regclass)<>oid)::text FROM pg_roles WHERE rolname=current_user$$,'true');
SELECT set_config('request.jwt.claims','{}',true) IS NOT NULL;
SELECT task_harness.check_sql('missing claims hides rows','00000','SELECT count(*)::text FROM public.reservations','0');
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',:'ua','session_id','not-a-session')::text,true) IS NOT NULL;
SELECT task_harness.check_sql('forged session hides rows','00000','SELECT count(*)::text FROM public.reservations','0');
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',:'ua','session_id',:'sb')::text,true) IS NOT NULL;
SELECT task_harness.check_sql('mismatched user session hides rows','00000','SELECT count(*)::text FROM public.reservations','0');
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',:'ua','session_id',:'sa')::text,true) IS NOT NULL;
SELECT task_harness.check_sql('A reads only A','00000',format('SELECT (count(*)=1 AND bool_and(host_id=%L))::text FROM public.reservations',:'ha'),'true');
SELECT task_harness.check_sql('A IDOR SELECT B','00000',format('SELECT count(*)::text FROM public.reservations WHERE id=%L',:'resb'),'0');
SELECT task_harness.check_sql('A IDOR UPDATE B','00000',format('WITH x AS (UPDATE public.reservations SET amount_krw=5,version=2 WHERE id=%L RETURNING id) SELECT count(*)::text FROM x',:'resb'),'0');
SELECT task_harness.check_sql('A foreign tenant INSERT','42501',format('INSERT INTO public.properties(host_id,name) VALUES (%L,''injected'')',:'hb'));
SELECT task_harness.check_sql('A valid property INSERT','00000',format('WITH x AS (INSERT INTO public.properties(host_id,name) VALUES (%L,''Synthetic extra'') RETURNING id) SELECT count(*)::text FROM x',:'ha'),'1');
SELECT task_harness.check_sql('A valid reservation INSERT','00000',format('WITH x AS (INSERT INTO public.reservations(host_id,property_id,room_id,guest_name,check_in,check_out,amount_krw) VALUES (%L,%L,%L,''Synthetic extra'',''2026-10-23'',''2026-10-24'',0) RETURNING id) SELECT count(*)::text FROM x',:'ha',:'pa',:'ra'),'1');
SELECT task_harness.check_sql('cross-tenant room injection','P0001',format('INSERT INTO public.reservations(host_id,property_id,room_id,guest_name,check_in,check_out,amount_krw) VALUES (%L,%L,%L,''Synthetic denied'',''2026-10-23'',''2026-10-24'',0)',:'ha',:'pa',:'rb'));
SELECT task_harness.check_sql('cross-tenant property injection','P0001',format('INSERT INTO public.rooms(host_id,property_id,name) VALUES (%L,%L,''Synthetic denied'')',:'ha',:'pb'));
SELECT task_harness.check_sql('immutable tenant column','42501',format('UPDATE public.reservations SET host_id=%L,version=2 WHERE id=%L',:'hb',:'resa'));
SELECT task_harness.check_sql('immutable actor column','42501',format('UPDATE public.reservations SET created_by=%L,version=2 WHERE id=%L',:'ub',:'resa'));
SELECT task_harness.check_sql('immutable UUID column','42501',format('UPDATE public.reservations SET id=gen_random_uuid(),version=2 WHERE id=%L',:'resa'));
SELECT task_harness.check_sql('hard DELETE denied','42501',format('DELETE FROM public.reservations WHERE id=%L',:'resa'));
SELECT task_harness.check_sql('private sessions unreadable','42501','SELECT count(*) FROM private.app_sessions');
SELECT task_harness.check_sql('audit cannot be forged','42501','INSERT INTO private.audit_events DEFAULT VALUES');
SELECT task_harness.check_sql('fixed helper search_path','00000',
 $$SELECT bool_and(prosecdef AND proconfig @> array['search_path=""'])::text FROM pg_proc WHERE oid IN ('private.can_host(uuid,text[])'::regprocedure,'private.session_ok()'::regprocedure)$$,'true');
SELECT task_harness.check_sql('helper owner not superuser/BYPASSRLS','00000',
 $$SELECT bool_and(NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcanlogin)::text FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid IN ('private.can_host(uuid,text[])'::regprocedure,'private.session_ok()'::regprocedure,'private.audit_business_write()'::regprocedure)$$,'true');
SELECT task_harness.check_sql('cannot create function in private schema','42501','CREATE FUNCTION private.injected() RETURNS int LANGUAGE sql AS ''SELECT 1''');
SELECT task_harness.check_sql('cannot create table in public schema','42501','CREATE TABLE public.injected(id int)');
SELECT task_harness.check_sql('no auth schema CREATE','00000','SELECT has_schema_privilege(current_user,''auth'',''CREATE'')::text','false');
SELECT task_harness.check_sql('cannot assume helper reader role','00000',format('SELECT pg_has_role(current_user,%L,''MEMBER'')::text',:'reader'),'false');
SELECT task_harness.check_sql('cannot assume audit role','00000',format('SELECT pg_has_role(current_user,%L,''MEMBER'')::text',:'audit'),'false');
SELECT task_harness.check_sql('trigger functions not directly executable','00000',
 $$SELECT bool_and(NOT has_function_privilege(current_user,p.oid,'EXECUTE'))::text FROM pg_proc p WHERE p.oid IN ('private.guard_business_update()'::regprocedure,'private.guard_active_parent()'::regprocedure,'private.audit_business_write()'::regprocedure)$$,'true');
SELECT task_harness.check_sql('invalid negative amount constraint','23514',format('UPDATE public.reservations SET amount_krw=-1,version=2 WHERE id=%L',:'resa'));
SELECT task_harness.check_sql('invalid date range constraint','23514',format('UPDATE public.reservations SET check_out=check_in,version=2 WHERE id=%L',:'resa'));
SELECT task_harness.check_sql('invalid date syntax','22008',format('UPDATE public.reservations SET check_in=''2026-02-30'',version=2 WHERE id=%L',:'resa'));
SELECT task_harness.check_sql('valid versioned UPDATE','00000',format('UPDATE public.reservations SET amount_krw=101,version=2 WHERE id=%L RETURNING version::text',:'resa'),'2');
SELECT task_harness.check_sql('stale explicit version rejected','P0001',format('UPDATE public.reservations SET amount_krw=102,version=2 WHERE id=%L',:'resa'));
SELECT task_harness.check_sql('missing next version rejected','P0001',format('UPDATE public.reservations SET amount_krw=102 WHERE id=%L',:'resa'));
SELECT task_harness.check_sql('conditional stale update affects zero','00000',format('WITH x AS (UPDATE public.reservations SET amount_krw=102,version=2 WHERE id=%L AND version=1 RETURNING id) SELECT count(*)::text FROM x',:'resa'),'0');
SELECT task_harness.check_sql('stable room UUID on rename','00000',format('UPDATE public.rooms SET name=''Renamed synthetic'',version=2 WHERE id=%L RETURNING (id=%L)::text',:'ra',:'ra'),'true');

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',:'ub','session_id',:'sb')::text,true) IS NOT NULL;
SELECT task_harness.check_sql('B reads only B','00000',format('SELECT (count(*)=1 AND bool_and(host_id=%L))::text FROM public.reservations',:'hb'),'true');
SELECT task_harness.check_sql('B INSERT A denied','42501',format('INSERT INTO public.properties(host_id,name) VALUES (%L,''denied'')',:'ha'));
SELECT task_harness.check_sql('B UPDATE A affects zero','00000',format('WITH x AS (UPDATE public.reservations SET version=3 WHERE id=%L RETURNING id) SELECT count(*)::text FROM x',:'resa'),'0');
SELECT task_harness.check_sql('B valid UPDATE','00000',format('UPDATE public.reservations SET version=2 WHERE id=%L RETURNING version::text',:'resb'),'2');

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',:'uv','session_id',:'sv')::text,true) IS NOT NULL;
SELECT task_harness.check_sql('viewer reads A','00000','SELECT count(*)::text FROM public.reservations','2');
SELECT task_harness.check_sql('viewer INSERT denied','42501',format('INSERT INTO public.properties(host_id,name) VALUES (%L,''denied'')',:'ha'));
SELECT task_harness.check_sql('viewer UPDATE affects zero','00000',format('WITH x AS (UPDATE public.reservations SET version=3 WHERE id=%L RETURNING id) SELECT count(*)::text FROM x',:'resa'),'0');
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',:'um','session_id',:'sm')::text,true) IS NOT NULL;
SELECT task_harness.check_sql('manager valid UPDATE','00000',format('UPDATE public.reservations SET version=3 WHERE id=%L RETURNING version::text',:'resa'),'3');
SELECT task_harness.check_sql('manager cannot elevate membership','42501',format('UPDATE public.memberships SET role=''owner'' WHERE user_id=%L',:'um'));
SELECT task_harness.check_sql('manager cannot create membership','42501',format('INSERT INTO public.memberships(host_id,user_id,role) VALUES (%L,%L,''owner'')',:'hb',:'um'));

RESET ROLE;
UPDATE public.memberships SET status='revoked' WHERE user_id=:'um';
SET LOCAL ROLE :"authenticated";
SELECT task_harness.check_sql('revoked member SELECT zero','00000','SELECT count(*)::text FROM public.reservations','0');
SELECT task_harness.check_sql('revoked member INSERT denied','42501',format('INSERT INTO public.properties(host_id,name) VALUES (%L,''denied'')',:'ha'));
RESET ROLE;
UPDATE private.app_sessions SET revoked_at=now() WHERE user_id=:'ua';
SET LOCAL ROLE :"authenticated";
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',:'ua','session_id',:'sa')::text,true) IS NOT NULL;
SELECT task_harness.check_sql('revoked session SELECT zero','00000','SELECT count(*)::text FROM public.reservations','0');
RESET ROLE;
UPDATE private.app_sessions SET revoked_at=NULL,created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE user_id=:'ua';
SET LOCAL ROLE :"authenticated";
SELECT task_harness.check_sql('expired session SELECT zero','00000','SELECT count(*)::text FROM public.reservations','0');
RESET ROLE;
UPDATE private.app_sessions SET expires_at=now()+interval '1 day' WHERE user_id=:'ua';
UPDATE public.organizations SET status='suspended' WHERE id=:'ha';
SET LOCAL ROLE :"authenticated";
SELECT task_harness.check_sql('suspended organization SELECT zero','00000','SELECT count(*)::text FROM public.reservations','0');
RESET ROLE;
UPDATE public.organizations SET status='active' WHERE id=:'ha';
DELETE FROM auth.sessions WHERE user_id=:'ua';
SET LOCAL ROLE :"authenticated";
SELECT task_harness.check_sql('missing provider session SELECT zero','00000','SELECT count(*)::text FROM public.reservations','0');
RESET ROLE;
-- Structural integrity checks are explicitly ADMIN-CONSTRAINT tests, not RLS evidence.
SELECT task_harness.check_sql('ADMIN-CONSTRAINT orphan room restriction','23503',format('DELETE FROM public.rooms WHERE id=%L',:'ra'));
SELECT task_harness.check_sql('ADMIN-CONSTRAINT orphan property restriction','23503',format('DELETE FROM public.properties WHERE id=%L',:'pa'));
-- Archived insert skips active-parent trigger; FK must STILL independently reject foreign tenant.
SELECT task_harness.check_sql('ADMIN-CONSTRAINT composite FK independent of guard','23503',format('INSERT INTO public.reservations(host_id,property_id,room_id,guest_name,check_in,check_out,amount_krw,archived) VALUES (%L,%L,%L,''Synthetic FK denied'',''2026-10-23'',''2026-10-24'',0,true)',:'ha',:'pa',:'rb'));
SELECT 'NOT_IMPLEMENTED|last-owner transfer/bootstrap';
SELECT 'NOT_VERIFIED|Supabase JWT signatures/PostgREST/provider session lifecycle';
rollback;
