-- StayBlock OTA v0.2: encrypted feed references; development only.
-- Run as neondb_owner on Neon DEVELOPMENT after review; never on production.
CREATE TABLE IF NOT EXISTS stayblock.ota_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES stayblock.hosts(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES stayblock.rooms(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('airbnb','booking')),
  url_ciphertext text NOT NULL,
  url_nonce text NOT NULL,
  url_tag text NOT NULL,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, provider)
);
CREATE INDEX IF NOT EXISTS ota_feeds_host_idx ON stayblock.ota_feeds(host_id);
ALTER TABLE stayblock.ota_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE stayblock.ota_feeds FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON stayblock.ota_feeds TO stayblock_http;
DROP POLICY IF EXISTS ota_feeds_select ON stayblock.ota_feeds;
CREATE POLICY ota_feeds_select ON stayblock.ota_feeds FOR SELECT TO stayblock_http USING (
 EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=ota_feeds.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active));
DROP POLICY IF EXISTS ota_feeds_insert ON stayblock.ota_feeds;
CREATE POLICY ota_feeds_insert ON stayblock.ota_feeds FOR INSERT TO stayblock_http WITH CHECK (
 EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=ota_feeds.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager'))
 AND EXISTS (SELECT 1 FROM stayblock.rooms r WHERE r.id=ota_feeds.room_id AND r.host_id=ota_feeds.host_id));
DROP POLICY IF EXISTS ota_feeds_update ON stayblock.ota_feeds;
CREATE POLICY ota_feeds_update ON stayblock.ota_feeds FOR UPDATE TO stayblock_http USING (
 EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=ota_feeds.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')))
 WITH CHECK (
 EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=ota_feeds.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager'))
 AND EXISTS (SELECT 1 FROM stayblock.rooms r WHERE r.id=ota_feeds.room_id AND r.host_id=ota_feeds.host_id));
DROP POLICY IF EXISTS ota_feeds_delete ON stayblock.ota_feeds;
CREATE POLICY ota_feeds_delete ON stayblock.ota_feeds FOR DELETE TO stayblock_http USING (
 EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=ota_feeds.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')));
