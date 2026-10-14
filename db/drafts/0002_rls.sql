-- TASK-003A / DRAFT / NOT EXECUTED. Requires 0001; no application/migration runner exists.
begin;
do $$ begin raise exception 'DRAFT_ONLY_NOT_APPROVED_FOR_EXECUTION'; end $$;

-- Threat assumption: owner of these tiny definers can read their referenced tables despite RLS.
-- REVIEW REQUIRED: provision a narrowly scoped NOLOGIN owner in the approved DB test task.
-- No dynamic SQL, no caller-controlled identity, fixed search_path. private must not be exposed
-- by PostgREST. BFF forwards verified user JWT for business CRUD, never service_role.
create function private.session_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from private.app_sessions s
    join auth.sessions a on a.id = s.provider_session_id and a.user_id = s.user_id
    join public.profiles p on p.user_id = s.user_id and p.active
    where s.user_id = auth.uid()
      -- Compare text rather than casting untrusted malformed JWT claim to uuid.
      and s.provider_session_id::text = auth.jwt()->>'session_id'
      and s.revoked_at is null and s.expires_at > now() and s.verified_email_at is not null
  );
$$;
create function private.can_host(wanted_host uuid, allowed_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.session_ok() and exists (
    select 1 from public.memberships m join public.organizations o on o.id = m.host_id
    where m.host_id = wanted_host and m.user_id = auth.uid()
      and m.status = 'active' and m.role = any(allowed_roles) and o.status = 'active'
  );
$$;
revoke all on function private.session_ok(), private.can_host(uuid,text[]) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.session_ok(), private.can_host(uuid,text[]) to authenticated;

grant select on public.profiles, public.organizations, public.memberships,
  public.properties, public.rooms, public.reservations to authenticated;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() and private.session_ok());
create policy organizations_read on public.organizations for select to authenticated
  using (private.can_host(id, array['owner','manager','viewer']));
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid() and private.can_host(host_id, array['owner','manager','viewer']));

-- No grants/policies for direct organization/profile/membership/session creation or changes.
-- Bootstrap, email verification, session registration/revocation, owner transfer are
-- NOT IMPLEMENTED. Future dedicated BFF-only limited role + audited transaction, no public RPC.
-- Lock organization row and preserve >=1 active owner; recheck requester inside transaction.
-- Do not loosen these policies to make unimplemented onboarding work.
create policy properties_read on public.properties for select to authenticated
  using (private.can_host(host_id, array['owner','manager','viewer']));
create policy rooms_read on public.rooms for select to authenticated
  using (private.can_host(host_id, array['owner','manager','viewer']));
create policy reservations_read on public.reservations for select to authenticated
  using (private.can_host(host_id, array['owner','manager','viewer']));

-- Column grants prohibit client-set IDs/actor/timestamps. Default actor is auth.uid().
grant insert (host_id,name) on public.properties to authenticated;
grant update (name,archived,version) on public.properties to authenticated;
grant insert (host_id,property_id,name) on public.rooms to authenticated;
grant update (name,archived,version) on public.rooms to authenticated;
grant insert (host_id,property_id,room_id,guest_name,check_in,check_out,amount_krw,status)
  on public.reservations to authenticated;
grant update (property_id,room_id,guest_name,check_in,check_out,amount_krw,status,archived,version)
  on public.reservations to authenticated;
create policy properties_insert on public.properties for insert to authenticated
  with check (private.can_host(host_id, array['owner','manager']) and created_by = auth.uid() and updated_by = auth.uid());
create policy properties_update on public.properties for update to authenticated
  using (private.can_host(host_id, array['owner','manager']))
  with check (private.can_host(host_id, array['owner','manager']) and updated_by = auth.uid());
create policy rooms_insert on public.rooms for insert to authenticated
  with check (private.can_host(host_id, array['owner','manager']) and created_by = auth.uid() and updated_by = auth.uid());
create policy rooms_update on public.rooms for update to authenticated
  using (private.can_host(host_id, array['owner','manager']))
  with check (private.can_host(host_id, array['owner','manager']) and updated_by = auth.uid());
create policy reservations_insert on public.reservations for insert to authenticated
  with check (private.can_host(host_id, array['owner','manager']) and created_by = auth.uid() and updated_by = auth.uid());
create policy reservations_update on public.reservations for update to authenticated
  using (private.can_host(host_id, array['owner','manager']))
  with check (private.can_host(host_id, array['owner','manager']) and updated_by = auth.uid());

-- DB-side immutability/version rules also apply to direct REST; not just BFF validation.
create function private.guard_business_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.host_id is distinct from old.host_id
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'IMMUTABLE_IDENTITY';
  end if;
  if tg_table_name = 'rooms' then
    if new.property_id is distinct from old.property_id then raise exception 'IMMUTABLE_PARENT'; end if;
  end if;
  if old.archived then raise exception 'ARCHIVED'; end if;
  if new.version <> old.version + 1 then raise exception 'VERSION_CONFLICT'; end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end;
$$;
-- FK proves tenant/parent identity. This trigger separately rejects inactive parents.
create function private.guard_active_parent() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.archived then return new; end if;
  perform 1 from public.properties where id = new.property_id and host_id = new.host_id and not archived for share;
  if not found then raise exception 'INVALID_PARENT'; end if;
  if tg_table_name = 'reservations' then
    perform 1 from public.rooms where id = new.room_id and host_id = new.host_id
      and property_id = new.property_id and not archived for share;
    if not found then raise exception 'INVALID_PARENT'; end if;
  end if;
  return new;
end;
$$;
create function private.audit_business_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.audit_events(host_id,actor_user_id,entity_type,entity_id,operation)
    values (new.host_id, auth.uid(), tg_table_name, new.id, tg_op);
  return new;
end;
$$;
revoke all on function private.guard_business_update(), private.guard_active_parent(), private.audit_business_write()
  from public, anon, authenticated;
create trigger properties_update_guard before update on public.properties
  for each row execute function private.guard_business_update();
create trigger rooms_update_guard before update on public.rooms
  for each row execute function private.guard_business_update();
create trigger reservations_update_guard before update on public.reservations
  for each row execute function private.guard_business_update();
create trigger rooms_parent_guard before insert or update on public.rooms
  for each row execute function private.guard_active_parent();
create trigger reservations_parent_guard before insert or update on public.reservations
  for each row execute function private.guard_active_parent();
create trigger properties_audit after insert or update on public.properties
  for each row execute function private.audit_business_write();
create trigger rooms_audit after insert or update on public.rooms
  for each row execute function private.audit_business_write();
create trigger reservations_audit after insert or update on public.reservations
  for each row execute function private.audit_business_write();
-- No DELETE grant/policy. Archive retains references. Hard deletion is a future approved workflow.
commit;
