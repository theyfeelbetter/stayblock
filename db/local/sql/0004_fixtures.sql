-- Synthetic random identities only, no passwords/emails or existing data.
begin;
INSERT INTO task_harness.identities SELECT label,gen_random_uuid(),gen_random_uuid()
 FROM unnest(array['a','b','viewer','manager']) AS label;
INSERT INTO auth.users SELECT user_id FROM task_harness.identities;
INSERT INTO auth.sessions SELECT session_id,user_id FROM task_harness.identities;
INSERT INTO public.profiles SELECT user_id,'Synthetic '||label,true,now() FROM task_harness.identities;
INSERT INTO task_harness.entities SELECT label,gen_random_uuid()
 FROM unnest(array['ha','hb','pa','pb','ra','rb','resa','resb']) AS label;
INSERT INTO public.organizations(id,name,created_by)
 SELECT e.id,'Synthetic host '||i.label,i.user_id FROM task_harness.identities i
 JOIN task_harness.entities e ON e.label='h'||i.label WHERE i.label IN ('a','b');
INSERT INTO public.memberships(host_id,user_id,role)
 SELECT e.id,i.user_id,CASE WHEN i.label IN ('a','b') THEN 'owner' ELSE i.label END
 FROM task_harness.identities i JOIN task_harness.entities e ON e.label=CASE WHEN i.label='b' THEN 'hb' ELSE 'ha' END;
INSERT INTO private.app_sessions(user_id,provider_session_id,token_hash,csrf_hash,provider_tokens_ciphertext,key_version,verified_email_at,expires_at)
 SELECT user_id,session_id,decode(md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),'hex'),
 decode(md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),'hex'),decode('00','hex'),1,now(),now()+interval '1 day'
 FROM task_harness.identities;
-- Seed with explicit synthetic auth claims so audit actor is never real login identity.
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',user_id,'session_id',session_id)::text,true) IS NOT NULL
 FROM task_harness.identities WHERE label='a';
INSERT INTO public.properties(id,host_id,name)
 SELECT p.id,h.id,'Synthetic property A' FROM task_harness.entities p,task_harness.entities h WHERE p.label='pa' AND h.label='ha';
INSERT INTO public.rooms(id,host_id,property_id,name)
 SELECT r.id,p.host_id,p.id,'Same room name' FROM task_harness.entities r,public.properties p WHERE r.label='ra';
INSERT INTO public.reservations(id,host_id,property_id,room_id,guest_name,check_in,check_out,amount_krw)
 SELECT e.id,r.host_id,r.property_id,r.id,'Synthetic A','2026-10-20','2026-10-22',100
 FROM task_harness.entities e,public.rooms r WHERE e.label='resa';
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',user_id,'session_id',session_id)::text,true) IS NOT NULL
 FROM task_harness.identities WHERE label='b';
INSERT INTO public.properties(id,host_id,name)
 SELECT p.id,h.id,'Synthetic property B' FROM task_harness.entities p,task_harness.entities h WHERE p.label='pb' AND h.label='hb';
INSERT INTO public.rooms(id,host_id,property_id,name)
 SELECT r.id,p.host_id,p.id,'Same room name' FROM task_harness.entities r,public.properties p
 WHERE r.label='rb' AND p.name='Synthetic property B';
INSERT INTO public.reservations(id,host_id,property_id,room_id,guest_name,check_in,check_out,amount_krw)
 SELECT e.id,r.host_id,r.property_id,r.id,'Synthetic B','2026-10-20','2026-10-22',200
 FROM task_harness.entities e,public.rooms r JOIN task_harness.entities ref ON ref.id=r.id AND ref.label='rb'
 WHERE e.label='resb';
commit;
SELECT 'SYNTHETIC_FIXTURES_CREATED';
