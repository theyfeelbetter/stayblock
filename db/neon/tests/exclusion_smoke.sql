-- Disposable data regression for Neon development. This DO block cleans up on success.
-- Run against development ONLY as an authorized maintenance role; never production.
DO $$
DECLARE h uuid; p uuid; room uuid; overlap_blocked boolean := false;
BEGIN
 INSERT INTO stayblock.hosts(name) VALUES('SB-TEST-HOST-TEMP') RETURNING id INTO h;
 INSERT INTO stayblock.properties(host_id,name) VALUES(h,'SB-TEST-PROPERTY') RETURNING id INTO p;
 INSERT INTO stayblock.rooms(host_id,property_id,name) VALUES(h,p,'SB-TEST-ROOM') RETURNING id INTO room;
 INSERT INTO stayblock.reservations(host_id,room_id,check_in,check_out) VALUES(h,room,'2026-10-20','2026-10-22');
 BEGIN
   INSERT INTO stayblock.reservations(host_id,room_id,check_in,check_out) VALUES(h,room,'2026-10-21','2026-10-23');
 EXCEPTION WHEN exclusion_violation THEN overlap_blocked := true;
 END;
 IF NOT overlap_blocked THEN RAISE EXCEPTION 'OVERLAP_NOT_BLOCKED'; END IF;
 INSERT INTO stayblock.reservations(host_id,room_id,check_in,check_out) VALUES(h,room,'2026-10-22','2026-10-23');
 INSERT INTO stayblock.reservations(host_id,room_id,check_in,check_out,status) VALUES(h,room,'2026-10-21','2026-10-22','cancelled');
 DELETE FROM stayblock.reservations WHERE host_id=h;
 DELETE FROM stayblock.rooms WHERE host_id=h;
 DELETE FROM stayblock.properties WHERE host_id=h;
 DELETE FROM stayblock.hosts WHERE id=h;
 RAISE NOTICE 'OVERLAP_AND_TURNOVER_TESTS_PASS';
END $$;
