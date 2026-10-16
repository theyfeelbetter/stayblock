# StayBlock October beta release checklist (2026-10-31 target)

> Decision date: Oct 30. Target is conditional, not permission to launch. See Issue #16.

## Release blocking checks
- [ ] Verified server-side auth/logout/session lifecycle; no client-forged identity.
- [ ] Distinct host A/B cross-tenant read/write denied through actual HTTP + DB RLS.
- [ ] Atomic room-date overlap prevention / concurrent 409; day-boundary KST.
- [ ] Guest free text escaped; no guest PII in invitation URL/telemetry/public build.
- [ ] Unsafe existing localStorage auth, iCal sync & invites not exposed to hosts.
- [ ] Database restore and rollback drill against disposable synthetic data.
- [ ] V3 exact integrated app browser E2E 375/390/768/1440, keyboard and calendar.
- [ ] Approved commercial-compatible hosting and verified anonymous deployment protection.
- [ ] Operator privacy policy and minimum host beta support/incident response.

## Scope freeze
MVP: Auth, property/room, manual booking CRUD, reliable calendar, mobile.
Deferred: iCal, Invite, Orient VIA, Pro pricing, OTA APIs, paid checkout, legacy migration.

## Decision
If any blocker is incomplete: **NO REAL-HOST BOOKING BETA**. A design-only static preview may be shown only after deployment protection is proved, with no login/data capture.
