# StayBlock 3-host private beta — operator and participant playbook
**Status as of 2026-10-18: PRE-LAUNCH ONLY. Do not send a login link or request real guest data until all security gates pass.**

## Current truth
- `main/index.html` is the original landing page, unchanged on `feature/v3-app-shell`. The approved V3 concept lives in PR #13 (`design/modular-productivity-ui/design-preview/index.html`); `beta.html` with auth, membership context and CRUD lives in PR #15 branch. These are SOURCE files, not currently deployed/live visual links.
- Neon development has Better Auth schema and host RLS; Vercel Preview env keys are set, but **live sign-in, endpoint↔database connectivity, anonymous Preview protection, invitation bootstrap and E2E tests remain unproven**.
- Both auth and booking endpoints explicitly default OFF until reviewed flags are set. Vercel reports `live:false`. Do not unpause or redeploy without explicit release approval.

## Phase A: invite to participate, NOT to log in (can do now)
Send individualized interest check to max 3 hosts. Collect only host contact email (through a chosen approved business contact channel), preferred device, and a 30-minute test slot; no passwords, guest names, booking screenshots or personal reservations. Keep these emails off GitHub issues/public docs.

**Korean message draft:**
안녕하세요. StayBlock에서 소규모 숙소 호스트를 위한 무료 예약·캘린더 관리 도구를 개발 중입니다. 실제 운영자의 의견을 반영하고자 3분만 초대하는 비공개 베타 참여 의사를 여쭙습니다. 약 30분 동안 가상의 숙소·예약 정보로 로그인, 객실 선택, 예약 등록·수정·삭제를 체험하고 사용성 의견을 주시면 됩니다. 현재는 사전 참여 의사만 확인하는 단계이며, 보안 검증이 끝난 후에만 개별 테스트 주소와 계정을 전달하겠습니다. 참여 가능하시면 사용하실 기기(휴대폰/PC)와 편한 시간을 알려주세요. 감사합니다.

**English:**
Hello! We’re inviting just three accommodation hosts to privately test StayBlock, a free reservation-management tool. The session takes around 30 minutes using **fictional properties and bookings**, not real guest information. We’ll ask you to try logging in and managing a few example reservations and to share usability feedback. This is an expression-of-interest invitation only; we will send a personal login link after security checks are complete. If interested, please reply with your device (mobile/desktop) and a convenient time. Thank you!

## Phase B: release prerequisites — Gate B/D must be green
[ ] Better Auth account provisioning/invitation is implemented and tested with invite-only controls, no open signup or shared password.
[ ] Real logged-in session, refresh, logout, expired/revoked sessions tested on actual protected HTTP endpoint.
[ ] RLS data separation verified with 3 genuine synthetic accounts through API; cross-host GET/POST/PATCH/DELETE all blocked.
[ ] Neon app login is non-owner/non-BYPASSRLS; database credentials server-only; password reset/credential exposure review.
[ ] Reservation checkin/checkout same-day turnover, conflict SQLSTATE 23P01=>409, cancellations and stale version tested.
[ ] Actual Vercel Preview URL blocks anonymous requests, not solely SSO setting; exact HTTPS Better Auth origin and cookies checked.
[ ] Commercial hosting allowed under approved Vercel plan; do not assume Hobby is allowed for business beta.
[ ] User-data treatment/retention and user assistance channel documented. Pilot limits and exit/rollback plan approved by owner.
If ANY are false, **NO GO** for real hosts. Use internal synthetic tests only.

## Phase C: assign separate accounts and isolated tenants (after Gate)
- Host A, B, C each gets an individual verified identity and individual host membership; never share login credentials.
- Give each host one or two clearly marked sample properties and 2-3 invented room labels, entirely synthetic reservations.
- Individually issue a one-time invitation/activation link from a verified sender with expiry. Never distribute secret tokens in a group message or GitHub.
- Provide a link ONLY to the approved protected Preview hostname, with sign-in guidance. No plaintext passwords sent by DM.
- Lock each user to their own host UUID; log and investigate any visibility outside membership.

## Phase D: 30-minute guided session
00-05 min: Sign in on personal device; confirm property/room names correspond ONLY to allocated fictional host.
05-10 min: List bookings, choose a different room, inspect dates/status and mobile layout.
10-15 min: Add a pending booking for a free date; refresh/re-login; confirm persistence.
15-20 min: Edit date and status; intentionally attempt overlapping same-room booking — expect a non-destructive conflict message. Same-day check-out/check-in should work.
20-25 min: Delete an invented booking, cancel another; confirm status changes after refresh. Log out and confirm protected pages no longer show bookings.
25-30 min: Share 1–5 ratings for ease of use and visual clarity; note confusing labels, mobile friction and defects, without guest PII.

## Suggested results sheet
Use separate protected worksheet: host tester alias (A/B/C), device, date, login success, properties visible, booking add/edit/delete, overlap warning, data outside host? (must be NO), logout works, bugs, satisfaction (1-5), next improvement. NEVER record passwords, full session URLs, real guest details, or DB credentials.

## Day-of stop rules
- An unauthorized tenant record is visible, unauthenticated data loads, or real guest data leaks: **stop pilot immediately**, disable the auth/API flags at Vercel, invalidate exposed sessions and investigate.
- Any session/auth/DB server error: no external tester until corrected. Critical blockers require rollback, not a cosmetic workaround.
- Only share synthetic test datasets until formal privacy readiness.
