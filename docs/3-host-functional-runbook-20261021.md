# StayBlock host A/B/C functional pilot — execution plan (Oct 20–21, 2026)

The participant flow is **functional testing, not a UX interview**. No account exists yet. The separate design-only web link does not log in or save reservations.

## Tuesday Oct 20: identity intake and provisioning
1. Collect exactly three unique tester email addresses and display names via an approved private channel. **Do not ask for current passwords.** Use three synthetic property and room names only.
2. A technical owner runs local-only `scripts/provision-three-beta-hosts.mjs` against **Neon development** with a separately verified `neondb_owner` development endpoint. The script refuses to run on CI/Vercel or if the DB already contains users/hosts, enforces 3 unique emails, individual strong initial passwords and 3 individual tenant memberships. It NEVER sends emails and should be run only once after owner approval and final runtime compatibility audit.
3. Passwords must be created privately and individually and transmitted separately by an approved secure one-to-one channel, ideally replaced on first login; do not store actual passwords in GitHub, Vercel, email threads or issue trackers. Delete local JSON files after provisioning.
4. Use `STAYBLOCK_OWNER_CONFIRM=PROVISION_3_DEV_HOSTS`, `EXPECTED_DEV_DATABASE_HOST=<exact Neon DEV host>`, `ADMIN_DATABASE_URL` set **locally**, and `STAYBLOCK_PASSWORD_FILE` pointing to private local JSON. Passwords JSON: `[{"email":"...","password":"..."}]` x3. Hosts JSON: `[{"email":"...","name":"...","property":"TEST Property","room":"TEST Room 1"}]` x3. Never run on production. **Verify auth schema/Better Auth hash routine and RLS/DB credentials first**.
5. Start each account in its own host/room; all data fictional, no real guest names or booking contents.

## Release prerequisites for Wednesday Oct 21
- Protected actual Vercel Preview deployment tested in an anonymous incognito browser and only individual testers can access. A Vercel project configured SSO alone **does not prove** access restriction; previous legacy deployments had anonymously accessible content.
- `BETTER_AUTH_URL` matches the **actual protected HTTPS Preview URL**. Existing `stayblock-preview.vercel.app` is the old production alias; do not assume it matches Preview.
- Better Auth authenticates all 3 accounts; cookies/session refresh/expired/logout verified.
- Test host A cannot GET/POST/PATCH/DELETE host B/C; booking DB role is non-owner, non-BYPASSRLS, RLS applies.
- Booking overlaps return HTTP 409; same day check-out/check-in allowed; stale versions rejected.
- Vercel Hobby commercial-use terms and budget approved before deployment; no upgrade without owner approval.
- Owner approves enabling `STAYBLOCK_BETA_AUTH_ENABLED` and `STAYBLOCK_BETA_API_ENABLED` **only after** preceding gates.

## Wednesday 30-minute functional acceptance test (per tester)
1. Login; confirm only assigned fictional property/room.
2. Create confirmed reservation on open days. Refresh; reservation persists.
3. Update dates and status, reload; updates persist.
4. Attempt overlapping reservation on same room; receive conflict 409, existing booking preserved.
5. Test same-day turnover: check-out 25th and check-in 25th should not overlap.
6. Cancel and delete synthetic reservation.
7. Logout; re-open a protected API without session, expect 401; an attempt to guess other host's ID must not expose records.
Acceptance sheet: A/B/C, device, login, context, create, update, conflict, delete, logout, RLS (must pass), blocker list; no UX interview necessary.

If any real HTTP authentication or cross-tenant test fails, functional host pilot is NO-GO; use internal dummy accounts only.

**NOTE:** The local provisioning script assumes an EMPTY Neon dev database. Verify account schema compatibility and whether development branch contains anything before running.
