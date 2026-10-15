# StayBlock safe preview

This directory is deliberately **UI-only**. It does not import `app.html`, authentication, reservation logic, localStorage, iCal, invitations, API endpoints, or real user data. The original main application remains untouched.

Security: no JavaScript, no forms, no cookies or API access; CSP blocks network resources, indexing disabled. Privacy still relies on the Vercel account's deployment SSO protection.

Vercel is intended to deploy **only this directory's index.html**; do not deploy the repository root.
