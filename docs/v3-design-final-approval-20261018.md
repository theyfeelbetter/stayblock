# StayBlock V3 — Final Design Approval (2026-10-18)

Status: **DESIGN APPROVED** by product owner in conversation on 2026-10-18.
Scope: visual design (not launch authorization).

## Approved visual foundation
Ice White `#F5F7FC`, Navy `#292750`, Indigo `#434180`, Coral `#FFB8BA`, Lavender `#D1D0ED`.
Unified editorial homepage, modular dashboard cards, soft rounded buttons/controls, desktop and mobile adaptation.

## Approved pages on feature/v3-app-shell
- `index.html` marketing homepage
- `app.html` legacy dashboard shell (visual CSS only; old localStorage authentication must be replaced)
- `pricing.html` free private-beta policy page (no paid tier)
- `invite.html` calendar invitation visual shell (not host account onboarding)
- `beta.html` server API-backed beta host console draft
- `ui/v3-unified.css` authoritative V3 source of truth

## Release controls
Approval **does not authorize** merging legacy insecure auth to main, deploying to Vercel, enabling HTTP auth or booking gates, exposing Vercel projects, or real host data collection.
Real beta release requires protected Preview URL independently verified, real Better Auth credential/session verification, tenant A/B/C RLS over HTTP, invitation provisioning, Vercel Hobby commercial-use decision and owner GO.
Current Vercel project paused. `app.html` dashboard inner calendar has NOT had authenticated browser visual QA. Visual parity is not full functional readiness.

## Change management
Treat this visual palette/layout as frozen V3 baseline. Future layout change requires intentional review; implement security/backend without restoring old dark/monochrome styles. User approval records final visual design but no security release approval.
