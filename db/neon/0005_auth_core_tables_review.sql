-- Adapted from Better Auth official CLI --adapter prisma generated on GitHub Actions run 38840171024.
-- Review first: schema-mapped PostgreSQL DDL for Neon DEVELOPMENT ONLY; no real users seeded.
-- Better Auth runtime uses `search_path=stayblock_auth`, not public/stayblock.
CREATE TABLE stayblock_auth."user"(
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE stayblock_auth."session"(
  id text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES stayblock_auth."user"(id) ON DELETE CASCADE
);
CREATE INDEX session_user_idx ON stayblock_auth."session"("userId");
CREATE TABLE stayblock_auth."account"(
  id text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES stayblock_auth."user"(id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_user_idx ON stayblock_auth."account"("userId");
CREATE TABLE stayblock_auth."verification"(
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_identifier_idx ON stayblock_auth."verification"(identifier);
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA stayblock_auth TO stayblock_auth_login;
-- Run an independent Better Auth runtime migration audit before enabling sign in.
