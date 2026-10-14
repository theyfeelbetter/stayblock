# TASK-003A test evidence — 2026-10-14

Baseline PR #3 source SHA: `e1682a0f720e2d8454efe87f8a4e067f0af9256a`.
Branch: `codex/task-003a-offline-scaffold`. Final source SHA is recorded in the Draft PR / Issue #5 submission, avoiding a self-referencing commit hash in this file.

## Executed

Node **v24.15.0**, macOS local workspace. No dependencies installed. Only synthetic memory fixtures and a temporary `127.0.0.1` HTTP listener; no outbound provider requests.

```text
$ node --test tests/*.test.cjs
tests 32
suites 0
pass 32
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 172.333542
exit 0
```

The first HTTP run was blocked by sandbox `listen EPERM 127.0.0.1` (30 passed / 1 failed); it was not counted as a pass. With explicit loopback execution permission, all31 tests passed. After the public-origin adapter test and UTF-8 body handling refinement, the final full suite above passed32. No HTTP test was skipped.

- 15 unchanged TASK-002 tests: inline JS syntax for four HTML files; Free reservation/room CRUD at days0/29/30/365; legacy synthetic values preserved; empty/new/reset data; no sample persistence; paid-query no-op; simple ICS/CSV; individual invitation ICS; no paid gating/fake success regression.
- 12 BFF contract tests: safe501; forged local identity/anonymous denial; A/B lists/IDOR/cross-parent denial; viewer/role revocation; stable room UUIDs; mass assignment/date/amount validation; CSRF/origin/host/method; stale update/delete; empty/idempotent synthetic onboarding; expiry/revoke/logout; property/room parent/archive handling; future capabilities unavailable.
- 4 adapter tests: disabled/no network; public-origin denial/no browser storage;501/network error propagation without fallback; injected adapter→dispatcher→memory→display projection.
- 1 real loopback HTTP test: session/login501, host403, invalid JSON400, body limit413, no static HTML serving404. Listener closed by test cleanup.

```sh
node --check bff/app.cjs
node --check bff/dev.cjs
node --check bff/validation.cjs
node --check client/api-adapter.mjs
git diff --check
git diff e1682a0f720e2d8454efe87f8a4e067f0af9256a -- index.html app.html pricing.html invite.html tests/free-policy.test.cjs
```

All exit0; last command has **empty output** (existing UI/test files identical to #3). SQL was read as text only; not parsed/executed by a database engine.

## Changed files relative to PR #3

`.gitignore`, `README.md`, `env.example`; `bff/app.cjs`, `bff/dev.cjs`, `bff/validation.cjs`; `client/api-adapter.mjs`; `db/drafts/0001_schema.sql`, `db/drafts/0002_rls.sql`; `docs/task-003a-offline-scaffold.md`, this evidence file; `tests/offline-api.test.cjs`, `tests/offline-adapter.test.cjs`, `tests/offline-http.test.cjs`, `tests/support/offline-fixtures.cjs`.

## Not verified / not performed

Real Auth/JWT/cookie encryption/SMTP, persistent storage, SQL syntax/RLS/grants/locking/direct REST, browser/mobile/accessibility, production tenant security, performance/cost, migration and restore remain **NOT_VERIFIED**. The route test double is not a Supabase emulator. No real passwords/host data were accessed; no legacy localStorage was uploaded/copied/transformed/deleted. No Supabase project/DB/schema/auth users, paid APIs, hosted resources, deployment, main merge or migration was created/executed. Authorized GitHub writes are the development branch/Draft PR/evidence only.

## Reproduce / rollback

Use the exact test command above. For offline501 inspection: `node bff/dev.cjs`, then `curl -i http://127.0.0.1:8787/api/session`; stop with Ctrl-C. Detailed contracts, SQL threat assumptions, unexecuted DB verification plan, future migration/backup and approval gates: [scaffold document](task-003a-offline-scaffold.md).

Rollback preparation by stopping the local process and switching back to the PR #3 development branch after preserving any work. There is no database/deployment/data migration to roll back. Do not execute the guarded SQL drafts. **STOP — GPT review pending.**
