# October private beta — database and authentication decision (candidate, no resources created)

**Owner target:** invitation-only beta for 2–3 real hosts by Oct 31, 2026, ONLY if all data-security/hosting gates pass. Issue #16.

## Shortlist (current provider evidence)
1. **Preferred: Neon Free PostgreSQL + Better Auth in StayBlock BFF**, reuse PostgreSQL schema concepts and local TASK-003B RLS tests. Neon Oct 2 Free documentation: 1GB/project, 100 CU-hours monthly, 10 branches, six-hour instant restore. Free limits don't replace off-provider backups or restore drills. Better Auth supports PostgreSQL and DB-backed cookie sessions.
2. **Alternative: Neon managed Better Auth:** potentially fewer moving parts, but must verify API availability, configuration, user lifecycle, stable signing/session semantics and database authorization bridge; never assume the managed auth service's claims satisfy existing Supabase policy helpers.
3. **Alternative: existing Supabase Free:** previously blocked by UX and version/region issues; do not touch the paused Seoul and Mumbai projects; owner explicitly pivoted away.

Official evidence:
- https://neon.com/blog/neon-free-plan-1-gb-per-project
- https://better-auth.com/docs/adapters/postgresql
- https://better-auth.com/docs/concepts/session-management
- https://vercel.com/legal/terms

## Nonnegotiable bridge and migration differences

Draft PR #6 and verified local TASK-003B PR #8 assumed Supabase-style `auth.uid()`, `auth.jwt()`, `auth.users` and `auth.sessions`. **Never execute that SQL directly on Neon.** Author a reviewed Neon-specific migration using Better Auth-owned identity tables and an explicit verified server session -> user mapping.

For business queries: authenticate cookie **on the server**, resolve current host membership, establish a transaction-local, server-only principal/host context (never client-supplied), execute under a least-privileged DB role with `NOBYPASSRLS` and no ownership of business tables, and commit/rollback within the same connection. Test pool reuse cannot leak tenant context. DB constraints and RLS must enforce actor/host/room foreign keys; do not use privileged maintenance credentials for runtime CRUD. No user-writable custom claim substitutes for session verification.

Invitation-only new accounts and safe bootstrap of organization owner must be transactional with explicit role checks; never trust arbitrary role/host fields from the UI. Restrict account creation until email delivery and verification are tested. Rate limit auth endpoints. Store keys in server-only local files or deployment secrets, never GitHub, client JS or build assets.

Reservation interval semantics: **[check-in, checkout)**, same-day turnover allowed, cancelled excluded; atomic DB-level exclusion/locking with cross-tenant isolation, verified with two true concurrent authenticated requests. A client-side overlap alert alone is insufficient.

## Pre-launch provider and legal gates

- Account-level Free plan and Seoul/appropriate available region confirmed; developer explicitly approves one test-only Neon project and synthetic fixtures before resource creation.
- Record separate deploy host approval. Vercel Hobby is for personal/non-commercial uses under its terms; a real host/business beta requires approved compliant hosting or a confirmed exception from Vercel. `stayblock-preview` paused because SSO did not block anonymous access after Resume.
- Explicit backups/restore verification, availability/spend alarms; free-plan autosuspend and quota exhaustion may make beta unavailable. Never assume zero-cost permanence.
- No legacy localStorage reservation import, live iCal, guest data, or real customer accounts until end-to-end audit.

## Acceptance evidence

Real provider and authorized HTTP BFF: A cannot view or edit B, viewer vs manager, anonymous, revoked/expired session, forged host/role header and cookie, logout, reload, multi-context state, FK, race/409, reservation deletion & cancellation, mobile screenshots, safe output, backup/restore. SQLSTATE/HTTP errors and exact versions. A checklist or mock pass is not launch permission.

**Status:** architecture candidate only; no Neon or other cloud account/project provisioned; no paid activation; no deployment.
