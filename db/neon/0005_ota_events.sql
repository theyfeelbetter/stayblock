-- Development branch only. Apply after explicit owner approval.
-- Store availability snapshots (not guest names or raw OTA URLs).
CREATE TABLE IF NOT EXISTS stayblock.ota_events (
 feed_id uuid NOT NULL REFERENCES stayblock.ota_feeds(id) ON DELETE CASCADE,
 host_id uuid NOT NULL REFERENCES stayblock.hosts(id) ON DELETE CASCADE,
 room_id uuid NOT NULL REFERENCES stayblock.rooms(id) ON DELETE CASCADE,
 uid_hash text NOT NULL CHECK(length(uid_hash)=64),
 check_in date NOT NULL,
 check_out date NOT NULL,
 missing_since timestamptz,
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(feed_id,uid_hash),
 CHECK(check_out>check_in)
);
CREATE INDEX IF NOT EXISTS ota_events_host_room_idx ON stayblock.ota_events(host_id,room_id,check_in);
ALTER TABLE stayblock.ota_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stayblock.ota_events FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON stayblock.ota_events TO stayblock_http;
CREATE POLICY ota_events_select ON stayblock.ota_events FOR SELECT TO stayblock_http USING (
 EXISTS(SELECT 1 FROM stayblock.memberships m WHERE m.host_id=ota_events.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active));
CREATE POLICY ota_events_insert ON stayblock.ota_events FOR INSERT TO stayblock_http WITH CHECK (
 EXISTS(SELECT 1 FROM stayblock.memberships m WHERE m.host_id=ota_events.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager'))
 AND EXISTS(SELECT 1 FROM stayblock.ota_feeds f WHERE f.id=ota_events.feed_id AND f.host_id=ota_events.host_id AND f.room_id=ota_events.room_id));
CREATE POLICY ota_events_update ON stayblock.ota_events FOR UPDATE TO stayblock_http USING (
 EXISTS(SELECT 1 FROM stayblock.memberships m WHERE m.host_id=ota_events.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')))
 WITH CHECK (
 EXISTS(SELECT 1 FROM stayblock.memberships m WHERE m.host_id=ota_events.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')));
CREATE POLICY ota_events_delete ON stayblock.ota_events FOR DELETE TO stayblock_http USING (
 EXISTS(SELECT 1 FROM stayblock.memberships m WHERE m.host_id=ota_events.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')));
