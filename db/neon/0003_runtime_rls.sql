-- StayBlock Neon development only. Better Auth user id must be verified by server before
-- SET LOCAL app.user_id inside same transaction and connection. Never take from request body/headers.
-- Runtime role MUST NOT own tables, have BYPASSRLS or execute arbitrary client SQL.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='stayblock_runtime') THEN
 CREATE ROLE stayblock_runtime NOLOGIN NOBYPASSRLS;
END IF; END $$;
GRANT USAGE ON SCHEMA stayblock TO stayblock_runtime;
GRANT SELECT ON stayblock.hosts,stayblock.memberships TO stayblock_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON stayblock.properties,stayblock.rooms,stayblock.reservations TO stayblock_runtime;
CREATE POLICY memberships_self_read ON stayblock.memberships FOR SELECT TO stayblock_runtime
 USING (user_id = NULLIF(current_setting('app.user_id',true),'') AND active);
CREATE POLICY hosts_member_read ON stayblock.hosts FOR SELECT TO stayblock_runtime
 USING (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active));
CREATE POLICY properties_member_read ON stayblock.properties FOR SELECT TO stayblock_runtime
 USING (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=properties.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active));
CREATE POLICY properties_manager_insert ON stayblock.properties FOR INSERT TO stayblock_runtime
 WITH CHECK (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=properties.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')));
CREATE POLICY properties_manager_update ON stayblock.properties FOR UPDATE TO stayblock_runtime
 USING (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=properties.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')))
 WITH CHECK (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=properties.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')));
CREATE POLICY properties_manager_delete ON stayblock.properties FOR DELETE TO stayblock_runtime
 USING (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=properties.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')));
CREATE POLICY rooms_member_read ON stayblock.rooms FOR SELECT TO stayblock_runtime
 USING (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=rooms.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active));
CREATE POLICY rooms_manager_insert ON stayblock.rooms FOR INSERT TO stayblock_runtime
 WITH CHECK (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=rooms.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')));
CREATE POLICY rooms_manager_update ON stayblock.rooms FOR UPDATE TO stayblock_runtime
 USING (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=rooms.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')))
 WITH CHECK (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=rooms.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')));
CREATE POLICY rooms_manager_delete ON stayblock.rooms FOR DELETE TO stayblock_runtime
 USING (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=rooms.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')));
CREATE POLICY reservations_member_read ON stayblock.reservations FOR SELECT TO stayblock_runtime
 USING (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=reservations.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active));
CREATE POLICY reservations_manager_insert ON stayblock.reservations FOR INSERT TO stayblock_runtime
 WITH CHECK (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=reservations.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')));
CREATE POLICY reservations_manager_update ON stayblock.reservations FOR UPDATE TO stayblock_runtime
 USING (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=reservations.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')))
 WITH CHECK (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=reservations.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')));
CREATE POLICY reservations_manager_delete ON stayblock.reservations FOR DELETE TO stayblock_runtime
 USING (EXISTS (SELECT 1 FROM stayblock.memberships m WHERE m.host_id=reservations.host_id AND m.user_id=NULLIF(current_setting('app.user_id',true),'') AND m.active AND m.role IN ('owner','manager')));
-- A NOLOGIN role is ONLY a policy/grant blueprint. Credentials/role binding need audit.
