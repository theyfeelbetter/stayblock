# TASK-003B — real local PostgreSQL RLS verification

## Result and exact scope

Issue #7: https://github.com/theyfeelbetter/stayblock/issues/7

PostgreSQL **17.11 (Postgres.app)** executed the test-only schema, RLS policies, grants and triggers. **57 checks passed** (53 under non-owner anon/authenticated roles, 3 explicitly admin-only FK integrity checks, 1 client target-identity refusal). A separate two-connection optimistic concurrency check passed. Node regressions: **36 passed, 0 failed, 0 skipped** (the original32 plus4 harness-safety tests).

The disposable DB **`stayblock_task003b_90a77c679122`** and its four task-specific roles were removed successfully. Verification queries returned `TEARDOWN_DB_ABSENT|true` and `TEARDOWN_ROLES_ABSENT|true`.

This proves the tested local PostgreSQL operations, **not managed Supabase Auth, JWT verification or production isolation**. No cloud resource, paid service, real user/guest/password data, localStorage access, migration, UI integration, deployment or main merge. The existing `postgres` database received no application schema/fixture DML. Maintenance connections used it only to inspect catalog identity and issue the approved cluster-level CREATE/COMMENT/REVOKE/DROP commands for the named task DB.

## Source and files

- Branch: `codex/task-003b-local-rls`, stacked on Draft PR #6's actual head `abde49ea7a906d8ba7d1cf5c0bcb3399ce494e4b`.
- PR #6 remained Draft/unmerged when work began. Earlier PR #3 is still an unmerged dependency, not main.
- New: `db/local/run.py`; identity/provider stub/schema/RLS/helper owner/fixture/security/concurrency/teardown files under `db/local/sql/`; `tests/local-db-safety.test.cjs`; this document and four evidence outputs.
- `.gitignore` excludes `.task003b/` local creation receipts. No credentials/configuration are committed.
- **Unchanged:** HTML4, BFF/client modules, original tests, and both `db/drafts/*.sql`. The original execution guards remain. There are no automatic production migrations.
- `0001_schema.sql` and `0002_rls.sql` test copies preserve the draft SQL body, except the deliberate guard is replaced in the copies and generic role names are changed into task-specific psql variables. A separate `0003_helper_owners.sql` supplies the previously provisional owner/privilege setup.
- Final source SHA is recorded in the Draft PR/Issue evidence rather than a self-referencing hash here.

## Runtime and authority

Executable: `/Applications/Postgres.app/Contents/Versions/17/bin/psql`, version17.11. Fixed endpoint `127.0.0.1:5432`. No package installation, Docker or server restart. The local maintenance login is used only for database/fixture setup and switching to test roles; its identity is redacted as `ADMIN_SETUP` in evidence. No password or environment dump is printed.

Sandbox connections initially failed; each DB phase received a separate one-time execution approval scoped to `python3 db/local/run.py <phase> --host 127.0.0.1 --port 5432 --db <exact-name> --confirm <exact-name>`. The script only invokes the fixed Postgres.app psql with fixed loopback connection flags and controlled SQL files. No reusable prefix, unrestricted shell or cloud permission was requested. Node's existing loopback HTTP regression also required a scoped local execution approval.

## Reproduce safely

Requires the already installed PostgreSQL17 instance and ability to create a disposable database and four roles. No installation or connection to another server is automated. Run from the repository root. Use a **new**12-hex suffix for a fresh run. The example name below is the now-deleted DB from this run; an existing DB with the same name is always refused, even if it has a task-like name.

```sh
python3 db/local/run.py preflight --host 127.0.0.1 --port 5432 --db stayblock_task003b_90a77c679122 --confirm stayblock_task003b_90a77c679122
python3 db/local/run.py create --host 127.0.0.1 --port 5432 --db stayblock_task003b_90a77c679122 --confirm stayblock_task003b_90a77c679122
python3 db/local/run.py install --host 127.0.0.1 --port 5432 --db stayblock_task003b_90a77c679122 --confirm stayblock_task003b_90a77c679122
python3 db/local/run.py test --host 127.0.0.1 --port 5432 --db stayblock_task003b_90a77c679122 --confirm stayblock_task003b_90a77c679122
python3 db/local/run.py concurrency --host 127.0.0.1 --port 5432 --db stayblock_task003b_90a77c679122 --confirm stayblock_task003b_90a77c679122
node --test tests/*.test.cjs
python3 db/local/run.py teardown --host 127.0.0.1 --port 5432 --db stayblock_task003b_90a77c679122 --confirm stayblock_task003b_90a77c679122
```

The commands are reproducible instructions, not authorization to rerun without the requested local sandbox approvals. Do not execute the SQL files directly or remove the original draft guards. `run.py` checks identity before each file and supplies the role/db variables. The standalone `test` phase assumes the fresh installed fixture version1; it rolls back and is repeatable before `concurrency`. The concurrency phase commits one synthetic row's version increment, so repeat the entire lifecycle with a fresh name to rerun the full ordered suite.

Safety checks:

- CLI rejects remote hosts, other ports, URIs, `postgres`, malformed names, and missing/mismatched `--confirm` before connecting.
- Preflight/create assert the server-reported loopback endpoint, no existing database of that name and no pre-existing test roles. CREATE uses template0; after creation, user table count was0. Default PUBLIC DB privileges are revoked.
- Every task phase requires the local creation receipt plus matching DB name, database owner and exact database comment `TASK-003B:<name>`. Normal PostgreSQL auth/session must connect to that same server. This is an accidental-target guard, not protection from a malicious local superuser.
- `psql -X -w`, ON_ERROR_STOP, statement/lock/connect timeouts; no password prompt, `.psqlrc`, service URL or inherited PG configuration. No supplied arbitrary SQL argument or external database address.
- Test-role names are `<db>_anon`, `_authenticated`, `_reader`, `_audit`, all NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/NOCREATEROLE/NOINHERIT. No pre-existing role is reused or modified.
- Teardown verifies all four role comments/attributes and absence of dependencies in another database. It removes explicit schemas and four roles inside this task DB, then checks the task DB owner/comment and absence of active sessions before dropping that database. No FORCE, termination of another session, wildcard deletion or filesystem cleanup.
- On failure, there is no automatic destructive cleanup or permission escalation. A partially installed DB may deliberately remain if receipt/role identity cannot be proven; inspect the named resource and obtain a narrowly scoped recovery instruction. The driver does not claim recovery from every partial setup/teardown crash is automatic.

## Actual role and provider model

`auth.users`, `auth.sessions`, `auth.uid()` and `auth.jwt()` are **local test stubs** in the disposable DB. The harness sets `request.jwt.claims`; UUIDs are random synthetic values. There are no real emails, passwords or provider tokens. The ciphertext field contains a dummy byte, not an encryption implementation.

Tests establish `current_user` as the task authenticated/anon role and assert `NOT rolsuper`, `NOT rolbypassrls`, NOLOGIN, non-table ownership and `row_security_active('public.reservations')`. Fixture setup uses the maintenance identity; its success is never counted as RLS proof. Roles are selected with SET LOCAL ROLE; this tests PostgreSQL effective-role policy behavior, not login authentication.

Helper functions are owned by the task reader role, which is neither superuser, BYPASSRLS nor business-table owner. It has SELECT only on the needed membership/organization/profile/session tables, with explicit SELECT policies. The separate audit owner has only the required audit INSERT grant/policy. Temporary CREATE permission used for function ownership transfer is immediately revoked. Browser roles are not members of either role. SECURITY DEFINER search_path is empty, names are qualified, and PUBLIC/default function execution is revoked. Trigger functions are not directly executable by client roles. This resolves the original draft's owner setup for the **local harness only**; managed-provider provisioning remains a future review.

Manually setting a valid known synthetic sub/session pair is trusted by this stub. Therefore malformed/missing/mismatched/revoked claims tests do not prove resistance to a forged **signed JWT**. Production must validate issuer/audience/signature/expiry before the DB claim context is set. Supabase/PostgREST own claim processing and `auth.sessions` lifecycle are not exercised.

## Results matrix and SQLSTATE

Complete emitted results: [SQL checks](evidence/task-003b-sql.txt), [concurrency](evidence/task-003b-concurrency.txt), [Node](evidence/task-003b-node.txt), [teardown](evidence/task-003b-teardown.txt).

| Case group | Effective role / outcome |
|---|---|
| Anonymous SELECT/INSERT/helper | anon;42501 insufficient privilege |
| A/B direct SELECT/IDOR/UPDATE | authenticated; foreign rows invisible and UPDATE0; own rows read/write succeed (00000) |
| Foreign-tenant INSERT | authenticated;42501 RLS denial |
| Cross-tenant room/property injection | authenticated;P0001 active-parent guard, no row created |
| Viewer | reads own tenant; INSERT42501, UPDATE0 |
| Manager | valid reservation UPDATE; membership elevate/create42501 |
| Revoked membership, revoked/expired/missing provider session, suspended host | authenticated; zero visible rows; revoked-member INSERT42501 |
| Missing or mismatched mock claims/session | authenticated; zero visible rows |
| Immutable host/id/creator, hard DELETE, private session read, audit forgery | authenticated;42501 |
| Fixed search_path and narrow definer roles/grants | authenticated metadata assertions true; private/public/auth schema CREATE disallowed; no role membership escalation |
| Amount/date CHECK and invalid calendar date | authenticated;23514 /22008 |
| Versioned UPDATE; stale version; omitted version; conditional update | authenticated; success thenP0001 or UPDATE0; no overwrite |
| Room rename | stable UUID preserved |
| Orphan room/property and independent composite FK | **ADMIN-CONSTRAINT**,23503; integrity checks only, not counted as non-owner RLS evidence |
| Wrong database identity | psql exits3 before following SQL; expected refusal, not a migration failure |

For concurrency, both psql sessions confirm non-superuser/non-BYPASSRLS with active RLS. They receive the same version1. Holder updates to amount111/version2 and keeps the transaction open for2s; contender starts while lock is held and waits >1s. After the first commit, contender's `WHERE version=1` matches0 rows. Final row is amount111/version2. Assertions verify holder1, contender0, both role contexts and final row. This checks PostgreSQL READ COMMITTED optimistic-update semantics, not every role-revocation/parent-archive race.

## Failure found and fixed (before/after)

First schema/RLS run passed49 checks. An added negative target-identity test then exposed a harness bug: `psql` treated `\quit 3` as quit rather than exit status3. It stopped execution but returned0, which the Python runner could misinterpret as success. No foreign DB or data was changed.

All refusal paths now intentionally execute `SELECT 1 / 0` under ON_ERROR_STOP, producing nonzero psql exit3. The actual wrong-identity test confirms exit3 and absence of the following sentinel statement. The corrected final run passed57 checks. A Node regression prevents reintroducing the unsupported quit argument, and other Node tests reject unsafe host/name/confirmation or missing receipts without connecting. Original schema/RLS semantics required no changes in this run; the fix is in the harness failure handling.

## Remaining limitations / next gate

- **NOT_IMPLEMENTED:** last-owner transfer/bootstrap atomic procedures. Membership DML remains denied to client roles; no claim that last-owner behavior is implemented.
- **NOT_VERIFIED:** managed Supabase Auth/signatures/refresh/email/verified-user lifecycle, PostgREST direct HTTP, service-role configuration, production session encryption, real SMTP/cookies, provider-specific ownership/grants and restore/migration.
- BFF IDOR/failure-mode fixtures re-pass in Node; BFF has **no real DB adapter**. HTTP API pagination is still unimplemented and rejected as documented in TASK-003A. SQL RLS data access tests do not validate end-to-end HTTP pagination.
- Tests cover next-statement membership/session revocation, not all in-flight transaction authorization races; no concurrency claim for owner transfer, overlapping stays, parent archive or invite acceptance.
- No browser/mobile tests or production UX changes. Existing TASK-004/005/006 blockers remain. This is not approval to turn on real host onboarding.
- Next owner/GPT gate: review this Draft PR, choose scope for BFF-to-DB integration and managed Supabase-specific validation, and separately approve any external resources/SMTP/domain/costs. Nothing external is provisioned now.

Official references consulted: [PostgreSQL17 RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [SELECT locking](https://www.postgresql.org/docs/17/sql-select.html), [SET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html). Actual local outputs above are the evidence for this implementation.

**STOP — GPT review pending; no merge or deployment.**
