-- Neon development ONLY. Adds DB-atomic day-booking overlap protection.
-- Requires btree_gist for UUID equality within GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE stayblock.reservations
  ADD CONSTRAINT reservations_no_overlapping_active_nights
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status IN ('confirmed', 'pending'));
-- check-out boundary is exclusive; status cancelled releases dates.
-- Real application must translate SQLSTATE 23P01 to HTTP 409.
-- Deployment intentionally blocked until server-verified Better Auth and RLS are proven.
