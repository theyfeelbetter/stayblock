# TASK-003A — offline implementation preparation

Issue: https://github.com/theyfeelbetter/stayblock/issues/5

**Local scaffold, not a working secure host product. No Supabase/DB was created or contacted. SQL is NOT EXECUTED and RLS is NOT_VERIFIED.** The approved architecture is Supabase Auth + PostgreSQL RLS + same-origin thin BFF. Existing HTML/CSS/Vanilla JS and Host Free policy remain intact.

## Baseline and review boundary

- Latest main observed 2026-10-14: `7f29e48bb9be01c9c7940842821e30342c2e9c13`.
- PR #3 remains open, Draft, unmerged: https://github.com/theyfeelbetter/stayblock/pull/3
- Branch `codex/task-003a-offline-scaffold` starts at actual PR #3 remote head `e1682a0f720e2d8454efe87f8a4e067f0af9256a`, tree `850dbf4f0e392640dcd4959929254ebcc2b99a4a`. The earlier local TASK-002 equivalent commit `9b3310156234443ca157f044e5a043d461bf163b` has the same tree but is not this branch's parent.
- Submit this as a **stacked Draft PR targeting `codex/task-002-free-policy`**, so reviewers see TASK-003A additions only. No merging either PR. Retarget/rebase only after separate review/authorization when #3's disposition is known.
- Architecture source: https://github.com/theyfeelbetter/stayblock/issues/4#issuecomment-6162062862

## Run locally — no installation, configuration or credentials needed

Node used: **v24.15.0**. Node built-ins only (`http`, `crypto`, `node:test`); no package manager, SDK, ORM, Docker, Supabase CLI, database engine or paid API. New JS is CommonJS on the server and a standalone browser ES module adapter; no framework conversion. This is a deliberate dependency decision for the offline scope, not the final production stack choice.

```sh
node --test tests/*.test.cjs
node bff/dev.cjs
```

The second command binds only `127.0.0.1:8787`. Stop with Ctrl-C. It serves API errors only, not the existing HTML or repository files. `NODE_ENV=production` refuses startup. There is no env switch for live providers or mock login. `env.example` is a names/placeholders inventory and is not loaded. Do not fill it with credentials for this task.

In another local terminal (no login payload):

```sh
curl -i http://127.0.0.1:8787/api/session
```

Expected `501`, `Cache-Control: no-store`, JSON `code: NOT_CONFIGURED`. Invalid hosts, methods, origins, JSON and oversized bodies fail before routes. Test HTTP listener uses an ephemeral loopback port and closes after the test. Sandboxes may need explicit loopback permission; do not skip or report this check as passing if the listener is blocked.

Existing static app remains independently runnable using the README command. It still has legacy local authentication and must not be represented as the secure BFF product. No new adapter script is added to any HTML page.

## Boundaries / implemented status

| Boundary | What exists | Status |
|---|---|---|
| Existing UI and local records | HTML files untouched relative to #3; existing 15 tests retained | VERIFIED by source diff + synthetic VM tests; browser NOT_VERIFIED |
| `client/api-adapter.mjs` | Disabled by default; explicit loopback-only opt-in; request/error handling; pure reservation display projection | VERIFIED with injected fetch/fixtures; not wired to live UI |
| `bff/app.cjs`, `validation.cjs` | Method/origin/CSRF/session/role/validation guards and injectable route contracts | VERIFIED against test double only |
| `bff/dev.cjs` | Real loopback HTTP, no configured Auth/DB, 16 KiB input cap, 501 safe failure | VERIFIED loopback HTTP |
| `tests/support/offline-fixtures.cjs` | Synthetic memory sessions, organizations, memberships, CRUD/onboarding | Test-only; not authentication, persistence or RLS |
| `db/drafts/0001_schema.sql` | Versioned schema, composite tenant FKs, constraints, RLS enabled, default revoke | NOT EXECUTED; SQL engine syntax/behavior NOT_VERIFIED |
| `db/drafts/0002_rls.sql` | Policy/helper/grant/trigger drafts | NOT EXECUTED; direct REST, privilege ownership and concurrency NOT_VERIFIED |
| Supabase Auth/DB/email, secure cookie lifecycle | Contracts and design only | NOT_CONFIGURED; no SDK/connection code |

The mocked memory tests do **not** prove production tenant isolation. Schema is intentionally outside `supabase/migrations`; both draft scripts begin with an unconditional safety exception. No migration runner is provided. Do not remove the guard or execute any SQL until a disposable local environment is separately approved.

## Route contracts

All routes return JSON and `Cache-Control: no-store`. Errors: `{code, request_id}`. Errors never echo a body, password, JWT, provider message or stack. No CORS allow-origin header. JSON mutations require exact Origin `http://127.0.0.1:8787`, `Content-Type: application/json`; authenticated mutations also require the session CSRF token. Header method overrides and cross-site fetch metadata are rejected. The runtime accepts no auth from `sb_session`, localStorage, supplied user/role headers or request-body actor fields.

| Route | Offline behavior / future contract |
|---|---|
| POST `/api/auth/register`, `/login` | Always501; future provider email/password + generic error, verified email, rate limiting. Never creates mock login or stores password |
| GET `/api/auth/callback` | Always501; future state/PKCE/allowlisted redirect, replay protection |
| POST `/api/auth/password-reset`, `/reset-complete` | Always501; future non-enumerating response, provider recovery and global session revoke |
| GET `/api/session` | Runtime501; test harness returns synthetic user/hosts/CSRF with `mode:test`; no opaque cookie token returned |
| POST `/api/auth/logout` | Runtime501; test harness revokes current synthetic session and expires its test cookie |
| POST `/api/onboarding` | Runtime501; test harness verified session, three names, UUID Idempotency-Key → new owner host/property/room, empty calendar; mismatched replay409 |
| GET/POST `/api/hosts/{h}/properties`, `/rooms`, `/reservations` | Runtime501; test harness scoped read/create, owner/manager write, viewer read |
| GET/PATCH/DELETE same paths + `/{id}` | Runtime501; test harness scoped detail, versioned update and archive (no hard deletion) |

Test-only session tokens are random 256-bit hex capabilities placed in the server-side fixture map by the test setup, not issued through HTTP. `mode:test` adapters cannot be passed to the default server; the standalone server always uses `not_configured`. No password or email address fixtures are needed. In production the intended cookie is `__Host-...; Secure; HttpOnly; SameSite=Lax; Path=/`, backed by a hashed opaque token and encrypted server-held provider tokens. Current HTTP harness uses a differently named test cookie and never issues a login cookie. Real JWT signature/issuer/audience/expiry, provider revocation, refresh rotation, encryption and CSRF issuance are all pending.

Property input: `{name}`. Room: `{property_id,name}`. Reservation minimal manual overnight subset: `{property_id,room_id,guest_name,check_in,check_out,amount_krw,status?}`. UUIDs are immutable identity; room names are not keys. A reservation's `(host_id,property_id,room_id)` must reference the same tenant/property. Amount is nonnegative safe integer KRW; checkout is exclusive and after check-in; date overflow is rejected. Unknown keys and privileged fields are rejected. Server determines actor/tenant/UUID/version. Mutations cannot rename identity or use a room from another property. Updating a room's parent is prohibited.

PATCH/DELETE require `If-Match: "<positive version>"`; missing428, malformed400, stale409. DELETE takes `{}` and archives with version increment. A future DB adapter must atomically `UPDATE ... WHERE host_id=:h AND id=:id AND version=:expected` with `version=:expected+1`, inspect row count, and serialize/transactionally recheck sensitive authorization. Memory compare/write has no await between the compare and write but is **not** evidence of Postgres locking semantics. Ordinary create retries/idempotency, pagination/date filtering, overlap policy and audit read API are not implemented; unsupported query filters return400 and a test list exceeding200 returns501 rather than silently truncating. Onboarding idempotency exists only in test memory.

## Schema, grants and RLS assumptions

- `auth.users` and `auth.sessions` are provider-managed assumptions, not defined/modified by this task. `profiles` holds display data, not credentials; no role claims from editable metadata.
- `organizations` is the host tenant; `memberships` has `(host_id,user_id)` primary key, owner/manager/viewer, active/revoked. Each API request re-reads membership; a UUID alone gives no authority.
- Stable UUID `properties`, `rooms`, `reservations`; tenant composite uniqueness/FKs prohibit cross-host parent references even with a valid UUID. Parent rows are restricted on deletion. Room parent is immutable. Cancellation/archiving preserves history.
- `private.app_sessions` records hashed opaque cookie/CSRF tokens, ciphertext provider tokens, key version, verified email time, expiry/revocation. Private session access is not granted to browser roles.
- Session helper requires authenticated UUID + matching JWT provider session ID + unrevoked/unexpired app session + existing matching `auth.sessions` + active profile. Text comparison handles malformed session claims without a uuid-cast error.
- Host helper reads current membership and active organization. Narrow read-only SECURITY DEFINER helpers avoid recursive membership RLS; fixed empty search_path, fully qualified relations and revoked PUBLIC execute. Their owner/privileges and provider `auth.sessions` compatibility MUST be reviewed/tested in the approved disposable environment. The draft does not claim its owner provisioning is ready.
- Anonymous business access is revoked. Authenticated SELECT is RLS-scoped. Only specific business INSERT/UPDATE columns are granted; actor/IDs/timestamps cannot be written. Policies separately restrict owner/manager writes; viewer reads only. No business DELETE, membership modification, tenant bootstrap, profile modification or session registration grant.
- BEFORE UPDATE checks immutable fields and explicit next version (not automatic blind version increment). Trigger sets updated actor/time. Parent guard rejects archived/missing property/room; composite FK enforces identity. Minimal audit trigger records entity/action/actor, not guest values or request bodies. Private audit is append-only via trigger, no client access.
- Organization/profile/membership/bootstrap and session management remain deny-by-default until separate audited BFF-only transactions exist. Preserve last active owner under organization row lock. Do not add a permissive public RPC merely to make onboarding run.
- PostgreSQL table owners/BYPASSRLS/service-role can bypass policies. Ordinary business BFF requests must use the verified user's JWT, never admin/service_role credentials. SQL tests must use real anon/authenticated roles, not an administrator-only happy path. No public views or RPCs are introduced.
- RLS direct-REST, constraint errors and hidden-ID leakage need real PostgREST tests; BFF maps missing/foreign resources to404. Interactions between parent locks, column grants and triggers are explicitly NOT_VERIFIED.

References checked 2026-10-14: [Supabase RLS and grants](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html). These support the security model; they are not evidence that these drafts execute correctly.

## Existing-code integration plan (not activated)

`app.html` currently loads/saves whole arrays using shared localStorage, `saveRes()` uses numeric IDs and `room` display names, and inline onclick handlers interpolate numeric IDs. Do not connect the new UUID rows to those handlers as-is. `calendarRows()` is a **partial, read-only display projection**, mapping `amount_krw→amount`, dates→`cin/cout`, guest→`name`, and validating host/property/room identity. It does not read, normalize, import or rewrite any existing records.

After approval and TASK-004 escaping/event-delegation work, introduce an explicit server-backed mode: verify session → choose authorized host → fetch scoped data → render ready/empty/error distinctly. Replace resource mutations individually, never post the shared full array. Display pending/error/conflict, preserve UUID/version in data attributes, and never fall back to shared localStorage on501/401/network error. Existing extra fields (guest counts, memo, channels, colors, timed stays, invites/feeds) need a reviewed lossless schema/API expansion before production cutover. No field-dropping legacy import is authorized.

iCal/operational invitations are deliberately omitted from executable routes and schema drafts. Future additions need `(host,property,room,feed)` composite identity, encrypted write-only URL, per-feed UID/recurrence uniqueness and SSRF-safe worker (TASK-005). Operational capability invitations and membership invites must remain separate, hashed/expiring and audited. No automatic synchronization, proxy, OTA login, token generation, live email or public invite is enabled here.

## Migration, backup and rollback plan — document only

1. Obtain owner approval for provider project/region, separate environments, costs, SMTP/domain, retention/deletion and migration scope. Real data access is not included in this task.
2. In separately approved disposable local DB, remove safety guards in a reviewed test-only copy; validate drafts, grants/helpers/triggers with synthetic A/B fixtures and ordinary DB roles. No remote execution. Add CI only after its resources/permissions are reviewed.
3. After implementation approval, establish verified identity and host ownership first. Existing shared localStorage has no trusted ownership evidence; ambiguous records are held for owner adjudication. Never infer owner from `sb_session`, names or active browser account.
4. Only with explicit data consent: encrypted business snapshot, checksums/counts, room-name ambiguity report, dry-run mapping to stable IDs. Exclude `sb_users`, password/session/plan values, old invite tokens and fake sync metadata. Dry-run writes no business rows. **No snapshot/data access occurred now.**
5. Explicit commit approval → transactional idempotent batch with source hashes, item mapping and result validation; compare totals/amounts and multi-device readback. Keep source bytes unchanged. Source deletion requires separate approval. No import endpoint exists in this scaffold.
6. Backup future DB/schema/RLS/config and separately encrypted key recovery; verify provider Auth/Storage backup boundaries, restore into isolated target with synthetic drill before production. Proposed RPO24h/RTO4h require owner approval and measurement; tighter goals/costs require a separate decision. Revoke sessions/invites after restore and honor deletion tombstones.
7. Current rollback: stop the local server and return to PR #3 branch; there is no live data/schema to reverse. Preserve the Draft branch for review. Future rollback pauses writes and returns to a secure compatible version or forward fix; never restore insecure localStorage auth as a fallback. Batch reversal must check unchanged target versions and references, never truncate a tenant or overwrite new edits.

## Required security verification before any real integration

| Area | Local evidence here | Required later / NOT_VERIFIED |
|---|---|---|
| Identity | Forged sb_session/header/body, anonymous, expired/revoked/unverified test session rejected | Real JWT, issuer/aud, refresh, verified email, reset, current/global logout, two devices |
| Isolation | A/B list/ID/write and cross-property/room fixtures, viewer denial, next-request revocation | Actual RLS roles; direct REST GET/POST/PATCH/DELETE/upsert/join/count; no admin bypass in tests |
| Grants | Draft column grants, deny-by-default owner/session paths | Cannot mutate host/id/actor/membership; definer ownership/search_path, schema exposure, unauthenticated RPC denial |
| Mutation | Body allowlist, invalid dates/amounts, stable IDs, optimistic conflict/soft-delete fixtures | DB FK/check/trigger execution; concurrent parent/archive/version/role races and last-owner lock |
| Web boundary | Host/origin/CSRF/method/input-size guards; disabled public adapter | HTTPS cookie lifecycle, XSS/CSP, CSRF issuance, rate limits, request timeout/DoS tests |
| Data safety | Existing synthetic Free tests and untouched HTML; no fallback/import | Consented migration dry-run hash/count preservation, restore, deletion retention |
| UX | Pure adapter projection and failure propagation | Calendar E2E, mobile360/390/768, iOS/Android, keyboard/focus/accessibility and date/month boundaries |

## Launch blockers and next approvals

Real Auth/DB adapters, encrypted persistent session store/rotation and reviewed grant owners are missing. API bootstrap and ownership changes need atomic audited procedures; the minimal reservation subset cannot yet represent all legacy fields. SQL engine tests, direct PostgREST security checks and recovery drills are mandatory. Existing XSS/escaping (TASK-004), unsafe iCal proxy/feed identity (TASK-005), date/calendar/mobile (TASK-006), and legacy local passwords/session remain blockers. This scaffold must not be marketed as secure onboarding.

Next approvals: external Supabase project/DB/region and budget; disposable local DB test environment; BFF same-origin hosting/domain/TLS (GitHub Pages cannot run this API); SMTP/verified email/MFA; role/overlap/retention/deletion policy; storage encryption and backup goals; actual data ownership/consent and migration plan; reviewed UI integration/dependency order. No resources, email, payment, deployment or migration have been initiated.

STOP after Draft PR and evidence. GPT review must precede further implementation tasks.
