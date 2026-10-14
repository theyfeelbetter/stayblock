-- TASK-003A / DRAFT / NOT EXECUTED. Not an auto-discovered Supabase migration.
-- Intentional safety stop: remove only in a separately approved disposable DB test task.
begin;
do $$ begin raise exception 'DRAFT_ONLY_NOT_APPROVED_FOR_EXECUTION'; end $$;

-- Assumes Supabase-provided auth.users, auth.sessions, auth.uid(), auth.jwt() and roles.
-- No CREATE DATABASE/extension/provider provisioning is included.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active','suspended','deleting')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.memberships (
  host_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  role text not null check (role in ('owner','manager','viewer')),
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  primary key (host_id, user_id)
);
create index memberships_user_host on public.memberships(user_id, host_id);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 120),
  timezone text not null default 'Asia/Seoul' check (timezone = 'Asia/Seoul'),
  archived boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (host_id, id)
);
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.organizations(id) on delete restrict,
  property_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  archived boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (host_id, property_id, id), unique (host_id, id),
  foreign key (host_id, property_id) references public.properties(host_id, id) on delete restrict
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.organizations(id) on delete restrict,
  property_id uuid not null, room_id uuid not null,
  guest_name text not null check (length(btrim(guest_name)) between 1 and 120),
  -- Minimal manual overnight contract only. Timed stays/legacy extension fields remain future.
  check_in date not null, check_out date not null,
  amount_krw bigint not null check (amount_krw between 0 and 9007199254740991),
  status text not null default 'confirmed' check (status in ('confirmed','pending','cancelled')),
  source text not null default 'manual' check (source = 'manual'),
  archived boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (host_id, id),
  foreign key (host_id, property_id, room_id) references public.rooms(host_id, property_id, id) on delete restrict,
  check (check_out > check_in and check_in >= date '1900-01-01' and check_out <= date '9999-12-31')
);
create index rooms_host_property on public.rooms(host_id, property_id);
create index reservations_calendar on public.reservations(host_id, room_id, check_in, check_out) where not archived;

create table private.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  provider_session_id uuid not null unique references auth.sessions(id) on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  csrf_hash bytea not null check (octet_length(csrf_hash) = 32),
  -- Auth access/refresh tokens encrypted by BFF with external key; never returned to browser.
  provider_tokens_ciphertext bytea not null,
  key_version integer not null check (key_version > 0),
  verified_email_at timestamptz not null,
  expires_at timestamptz not null, revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index app_sessions_user on private.app_sessions(user_id);
create table private.audit_events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  entity_type text not null, entity_id uuid not null,
  operation text not null check (operation in ('INSERT','UPDATE')),
  created_at timestamptz not null default now()
  -- Deliberately no guest values, credentials or arbitrary request JSON.
);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.properties enable row level security;
alter table public.rooms enable row level security;
alter table public.reservations enable row level security;
alter table private.app_sessions enable row level security;
alter table private.audit_events enable row level security;
-- Tables with no policies are deny-by-default for non-owner roles.
revoke all on public.profiles, public.organizations, public.memberships,
  public.properties, public.rooms, public.reservations from public, anon, authenticated;
revoke all on private.app_sessions, private.audit_events from public, anon, authenticated;
commit;
