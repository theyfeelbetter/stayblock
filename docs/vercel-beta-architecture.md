# StayBlock beta — Vercel stays the deployment platform

Owner decision 2026-10-16: GitHub -> Vercel for frontend and BFF deployment. Neon Free PostgreSQL is only a candidate remote data store, not a replacement deployment provider. Better Auth runs server-side in BFF pending proven sessions and RLS.

## Release blockers
1. Existing stayblock-preview must remain PAUSED: anonymously viewable prior to pause despite SSO settings.
2. Current Vercel connector get_project returned 403 forbidden on scope 80-5573. Access must be restored for matching account/scope before changes. Project state not freshly verified.
3. A real-host commercial beta must be allowed under the actual Vercel plan terms; no assuming Hobby allows commercial use and no unapproved paid upgrade.
4. Any preview requires proof of access denial from an anonymous browser on deployed URL, not only configuration checkbox.
5. Launch needs real server auth, tenant-separated PostgreSQL, atomic reservation conflicts, privacy, restoration and mobile E2E. Otherwise NO-GO.

No deploy or Vercel modification authorized/executed in this step.
