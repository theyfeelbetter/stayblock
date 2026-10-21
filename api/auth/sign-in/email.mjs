// Explicit Vercel route for Better Auth credential sign-in.
// Reuse the same guarded handler as the catch-all endpoint.
export { default } from '../[...all].mjs';
