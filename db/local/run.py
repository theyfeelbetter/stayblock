#!/usr/bin/env python3
"""TASK-003B only. No remote URLs, SQL arguments, existing DB reuse or force cleanup."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
PSQL = '/Applications/Postgres.app/Contents/Versions/17/bin/psql'
PHASES = ('preflight', 'create', 'install', 'test', 'concurrency', 'teardown')

def validate(host, port, database, confirm):
    if host != '127.0.0.1' or port != 5432:
        raise ValueError('Only explicit 127.0.0.1:5432 is allowed')
    if not re.fullmatch(r'stayblock_task003b_[0-9a-f]{12}', database) or confirm != database:
        raise ValueError('Exact task DB identity and matching --confirm required')

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('phase', choices=PHASES)
    p.add_argument('--host', required=True)
    p.add_argument('--port', required=True, type=int)
    p.add_argument('--db', required=True)
    p.add_argument('--confirm', required=True)
    a = p.parse_args()
    validate(a.host, a.port, a.db, a.confirm)
    workspace = ROOT / '.task003b' / a.db
    workspace.mkdir(parents=True, exist_ok=True)
    marker = 'TASK-003B:' + a.db
    roles = {key: a.db + '_' + key for key in ('anon', 'authenticated', 'reader', 'audit')}
    # Do not inherit PGHOST/PGSERVICE/PGOPTIONS/password values or print environment/credentials.
    env = {'PATH': '/usr/bin:/bin', 'LC_ALL': 'C', 'PGCONNECT_TIMEOUT': '3', 'PGSSLMODE': 'disable'}
    base = [PSQL, '-X', '-w', '-h', a.host, '-p', str(a.port), '-v', 'ON_ERROR_STOP=1',
            '-v', 'VERBOSITY=verbose', '-v', 'task_db=' + a.db, '-v', 'marker=' + marker]
    for key, value in roles.items():
        base += ['-v', key + '=' + value]

    def sql(text, db=a.db, check=True):
        r = subprocess.run(base + ['-qAt', '-d', db], input=text, text=True,
                           capture_output=True, env=env, timeout=40)
        if r.stdout.strip():
            # Admin-constraint cases are not RLS proof; redact the real maintenance identity.
            output = re.sub(r'(ADMIN-CONSTRAINT[^\n]*\|role=)[^|]+', r'\1ADMIN_SETUP', r.stdout.strip())
            print(output, flush=True)
        if r.returncode and check:
            # Only controlled synthetic SQL is sent; do not print arbitrary server DETAIL data.
            states = re.findall(r'(?:ERROR|FATAL):\s+([0-9A-Z]{5}):\s*([^\n]*)', r.stderr)
            print(json.dumps({'phase': a.phase, 'exit': r.returncode,
                              'errors': states or ['connection/command failed; no server details logged']}), flush=True)
            raise RuntimeError('PostgreSQL phase failed; no automatic cleanup or permission expansion')
        return r

    maintenance_guard = """
SELECT current_database() = 'postgres' AND inet_server_addr() = inet '127.0.0.1'
 AND inet_server_port() = 5432 AS target_ok \gset
\if :target_ok
\else
 SELECT 1 / 0; -- ON_ERROR_STOP must produce nonzero exit status
\endif
"""
    identity = (ROOT / 'db/local/sql/identity.sql').read_text()
    if a.phase in ('preflight', 'create'):
        absence = """
SELECT NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'task_db')
 AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN (:'anon',:'authenticated',:'reader',:'audit')) AS unused \gset
\if :unused
\else
 \echo REFUSE_EXISTING_DATABASE_OR_ROLE
 SELECT 1 / 0; -- ON_ERROR_STOP must produce nonzero exit status
\endif
SELECT 'TARGET_UNUSED|' || current_setting('server_version');
"""
        if a.phase == 'preflight':
            sql(maintenance_guard + absence, db='postgres')
            return
        # Exact marker recorded before CREATE; reusing an existing DB is always refused.
        sql(maintenance_guard + absence + """
SELECT format('CREATE DATABASE %I TEMPLATE template0', :'task_db') \gexec
SELECT format('COMMENT ON DATABASE %I IS %L', :'task_db', :'marker') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'task_db') \gexec
SELECT 'CREATED_TASK_DATABASE';
""", db='postgres')
        (workspace / 'created.json').write_text(json.dumps({'database': a.db, 'marker': marker}))
        sql(identity + "SELECT 'EMPTY_USER_TABLES|' || count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p');")
        return

    receipt = workspace / 'created.json'
    if not receipt.is_file() or json.loads(receipt.read_text()) != {'database': a.db, 'marker': marker}:
        raise ValueError('Missing matching local creation receipt; no connection attempted')
    if a.phase == 'install':
        # Versioned test-only copies have no production execution guard. Identity guard runs first.
        sql(identity + """
SELECT NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','private','task_harness')) AS fresh \gset
\if :fresh
\else
 \echo REFUSE_REINSTALL
 SELECT 1 / 0; -- ON_ERROR_STOP must produce nonzero exit status
\endif
""" + (ROOT / 'db/local/sql/0000_provider_stub.sql').read_text())
        for name in ('0001_schema.sql', '0002_rls.sql', '0003_helper_owners.sql', '0004_fixtures.sql'):
            sql(identity + (ROOT / 'db/local/sql' / name).read_text())
        return
    if a.phase == 'test':
        # Only read-only checks against this task DB: an identity mismatch must stop before SQL.
        bad_identity = identity.replace("current_database() = :'task_db'", "current_database() = 'not_the_task_database'")
        refused = sql(bad_identity + "SELECT 'UNSAFE_CONTINUATION';", check=False)
        if refused.returncode != 3 or 'UNSAFE_CONTINUATION' in refused.stdout:
            raise RuntimeError('Identity mismatch was not refused')
        print('PASS|wrong database identity refuses before DDL|SQLSTATE=N/A')
        sql(identity + (ROOT / 'db/local/sql/0005_security_tests.sql').read_text())
        return
    if a.phase == 'concurrency':
        # Both sessions execute as authenticated non-owner; parent transaction serializes row writes.
        prefix = identity + (ROOT / 'db/local/sql/concurrency_prefix.sql').read_text()
        holder = prefix + """
WITH changed AS (UPDATE public.reservations SET amount_krw=111, version=version+1 WHERE id=:'reservation_a' AND version=:version RETURNING id)
 SELECT 'HOLDER_ROWS|' || count(*) FROM changed;
\echo HOLDER_LOCKED
SELECT pg_sleep(2);
COMMIT;
"""
        contender = prefix + """
WITH changed AS (UPDATE public.reservations SET amount_krw=222,version=version+1
 WHERE id=:'reservation_a' AND version=:version RETURNING id) SELECT 'CONTENDER_ROWS|' || count(*) FROM changed;
COMMIT;
"""
        # Capture the same original version into both connection scripts before either write.
        info = sql(identity + "SELECT id::text || '|' || version FROM public.reservations WHERE guest_name='Synthetic A';")
        reservation, version = info.stdout.strip().splitlines()[-1].split('|')
        args = base + ['-qAt', '-d', a.db, '-v', 'reservation_a=' + reservation, '-v', 'version=' + version]
        first = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
        first.stdin.write(holder); first.stdin.close()
        try:
            holder_lines = []
            while True:
                line = first.stdout.readline()
                if not line: raise RuntimeError('Lock holder failed before acquiring lock')
                holder_lines.append(line.strip())
                if line.strip() == 'HOLDER_LOCKED': break
            started = time.monotonic()
            second = subprocess.run(args, input=contender, capture_output=True, text=True, env=env, timeout=15)
            elapsed = time.monotonic() - started
            first.wait(timeout=15)
            if (first.returncode or second.returncode or 'CONTENDER_ROWS|0' not in second.stdout or elapsed < 1
                or 'CONTEXT|true' not in holder_lines or 'HOLDER_ROWS|1' not in holder_lines
                or 'CONTEXT|true' not in second.stdout):
                raise RuntimeError('Concurrent update assertion failed')
            final = sql(identity + "SELECT 'FINAL_CONCURRENCY|' || amount_krw || '|' || version FROM public.reservations WHERE guest_name='Synthetic A';")
            if f'FINAL_CONCURRENCY|111|{int(version)+1}' not in final.stdout:
                raise RuntimeError('Concurrent final row differs from the winning transaction')
            print(json.dumps({'case': 'concurrent stale update', 'role': roles['authenticated'],
                              'sqlstate': '00000', 'contender_rows': 0, 'waited_for_lock': True, 'result': 'PASS'}))
        finally:
            if first.poll() is None: first.terminate(); first.wait(timeout=5)
        return
    if a.phase == 'teardown':
        sql(identity + (ROOT / 'db/local/sql/teardown_roles.sql').read_text())
        # Recheck name/owner/comment + absence of other sessions; never FORCE or terminate peers.
        sql(maintenance_guard + """
SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname=:'task_db' AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user)
 AND shobj_description(oid,'pg_database')=:'marker')
 AND NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=:'task_db') AS removable \gset
\if :removable
\else
 \echo REFUSE_TEARDOWN_IDENTITY_OR_ACTIVE_CONNECTION
 SELECT 1 / 0; -- ON_ERROR_STOP must produce nonzero exit status
\endif
SELECT format('DROP DATABASE %I', :'task_db') \gexec
SELECT 'TEARDOWN_DB_ABSENT|' || NOT EXISTS (SELECT 1 FROM pg_database WHERE datname=:'task_db');
SELECT 'TEARDOWN_ROLES_ABSENT|' || NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN (:'anon',:'authenticated',:'reader',:'audit'));
""", db='postgres')
        receipt.unlink()  # Only this task's successful creation receipt; no database/filesystem catch-all.

if __name__ == '__main__':
    try: main()
    except (ValueError, RuntimeError, subprocess.TimeoutExpired) as e:
        print(str(e), file=sys.stderr); sys.exit(1)
