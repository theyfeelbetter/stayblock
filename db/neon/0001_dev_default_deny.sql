-- StayBlock Neon development bootstrap. Additive only. DO NOT apply to production.
-- Default deny until Better Auth principal and membership policy are independently audited.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS stayblock;
CREATE TABLE IF NOT EXISTS stayblock.hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stayblock.memberships (
  host_id uuid NOT NULL REFERENCES stayblock.hosts(id) ON DELETE RESTRICT,
  user_id text NOT NULL CHECK (length(user_id) BETWEEN 1 AND 128),
  role text NOT NULL CHECK(role IN ('owner','manager','viewer')),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(host_id,user_id)
);
CREATE TABLE IF NOT EXISTS stayblock.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES stayblock.hosts(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  UNIQUE(id,host_id)
);
CREATE TABLE IF NOT EXISTS stayblock.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  property_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  FOREIGN KEY(property_id,host_id) REFERENCES stayblock.properties(id,host_id) ON DELETE RESTRICT,
  UNIQUE(id,host_id)
);
CREATE TABLE IF NOT EXISTS stayblock.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  room_id uuid NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','pending','cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(room_id,host_id) REFERENCES stayblock.rooms(id,host_id) ON DELETE RESTRICT,
  CHECK(check_out>check_in)
);
CREATE INDEX IF NOT EXISTS reservations_room_dates ON stayblock.reservations(room_id,check_in,check_out);
ALTER TABLE stayblock.hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stayblock.hosts FORCE ROW LEVEL SECURITY;
ALTER TABLE stayblock.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE stayblock.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE stayblock.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE stayblock.properties FORCE ROW LEVEL SECURITY;
ALTER TABLE stayblock.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE stayblock.rooms FORCE ROW LEVEL SECURITY;
ALTER TABLE stayblock.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stayblock.reservations FORCE ROW LEVEL SECURITY;
-- No RLS policies and no runtime GRANT by design: all business data inaccessible from app until Gate B.
