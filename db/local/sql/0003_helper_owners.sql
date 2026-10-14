-- Narrow NOLOGIN/non-owner/non-BYPASSRLS definer roles. No membership granted to client roles.
begin;
GRANT USAGE ON SCHEMA private TO :"reader", :"audit";
GRANT SELECT ON auth.sessions, public.profiles, public.organizations, public.memberships, private.app_sessions TO :"reader";
CREATE POLICY helper_profiles ON public.profiles FOR SELECT TO :"reader" USING (true);
CREATE POLICY helper_organizations ON public.organizations FOR SELECT TO :"reader" USING (true);
CREATE POLICY helper_memberships ON public.memberships FOR SELECT TO :"reader" USING (true);
CREATE POLICY helper_sessions ON private.app_sessions FOR SELECT TO :"reader" USING (true);
-- Ownership transfer needs temporary CREATE in the destination schema, revoked immediately.
GRANT CREATE ON SCHEMA private TO :"reader", :"audit";
ALTER FUNCTION private.session_ok() OWNER TO :"reader";
ALTER FUNCTION private.can_host(uuid,text[]) OWNER TO :"reader";
ALTER FUNCTION private.audit_business_write() OWNER TO :"audit";
REVOKE CREATE ON SCHEMA private FROM :"reader", :"audit";
GRANT INSERT ON private.audit_events TO :"audit";
CREATE POLICY audit_append ON private.audit_events FOR INSERT TO :"audit" WITH CHECK (actor_user_id=auth.uid());
commit;
