import { betterAuth } from 'better-auth';
import pg from 'pg';
const connectionString = process.env.DATABASE_URL;
const secret = process.env.BETTER_AUTH_SECRET;
if (!connectionString || !secret || secret.length < 32 || !process.env.BETTER_AUTH_URL) {
  throw new Error('AUTH_ENV_NOT_CONFIGURED');
}
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret,
  database: new pg.Pool({connectionString, max: 4, ssl: {rejectUnauthorized: true}}),
  emailAndPassword: {enabled: true, disableSignUp: true},
  trustedOrigins: [process.env.BETTER_AUTH_URL],
  session: {expiresIn: 60*60*24*7, updateAge: 60*60*24},
});
