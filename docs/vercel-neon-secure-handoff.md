# Vercel ↔ Neon secure linking: credential handoff (2026-10-16)

## Verified
- Vercel project `stayblock-preview` is queryable **without teamId** through connected Vercel plugin. Project reports `live:false`, SSO enabled, **0 env variables**. SSO is not sufficient evidence that URL rejects anonymous access.
- Neon project `stayblock`, branch `development`, PostgreSQL 18. Two SQL-created login roles `stayblock_http` and `stayblock_auth_login` have LOGIN=true, BYPASSRLS=false, and **no passwords**. Neon `production` branch must not be targeted.
- Attempts to transfer Neon-generated secret values to Vercel via connector were blocked by platform security screening. We must not circumvent by relaying secrets through GitHub, stdout, issues, chat or files.
- No Vercel production / Preview deployment or Pause change. No guest data.

## Owner-mediated secure credential setup
1. In Neon console select **stayblock → development** (not production). Use a Neon supported secure credential provisioning flow for each least-privileged role, avoiding the automatic native role creation default that was observed assigning `BYPASSRLS`. If the console cannot set/reset role passwords without privilege escalation, stop and use provider support or redesign the authentication technique; **do not use neondb_owner**.
2. In Vercel dashboard open **stayblock-preview → Settings → Environment Variables**. Set each credential **directly in Vercel** without sharing in chat:
   - `DATABASE_URL`: Neon **development** URI for `stayblock_http`, TLS required.
   - `AUTH_DATABASE_URL`: Neon **development** URI for `stayblock_auth_login`, TLS required.
   - `BETTER_AUTH_SECRET`: independently generated high-entropy ≥32-char secret.
   - `BETTER_AUTH_URL`: exact HTTPS URL planned for protected Preview (not a published/open URL).
3. Scope secrets to **Preview** (or only approved development branch). Never Production; avoid shared Preview URLs carrying customer data before gate.
4. Tell assistant **only that the 4 variable names exist**, never paste values. Inspect metadata using `filter_project_envs` decrypt=false; do not retrieve secret values.
5. Confirm both database roles `NOBYPASSRLS`, separate auth/business grants, and authenticate role/branch on live connection. Test actual session, RLS, two synthetic hosts, CRUD, conflicting concurrency and logouts before any public deployment or production merge.

## Launch stop
Vercel commercial plan permissibility unresolved. No external beta use before strict anonymous protection and actual HTTP E2E evidence.
