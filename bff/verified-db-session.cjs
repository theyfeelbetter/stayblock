'use strict';
// Design adapter for Better Auth + Neon. Not wired to public HTTP routes yet.
// auth.api.getSession MUST verify Better Auth cookie on server; never accept userId from client.
async function withVerifiedDbSession({ auth, headers, pool, work }) {
  if (!auth?.api?.getSession || !pool?.connect || typeof work !== 'function')
    throw new Error('AUTH_DB_NOT_CONFIGURED');
  const session = await auth.api.getSession({ headers });
  const userId = session?.user?.id;
  if (typeof userId !== 'string' || !userId || userId.length > 128)
    throw new Error('UNAUTHENTICATED');
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;
    // DB connection must authenticate as least-privileged stayblock_runtime,
    // NEVER as neondb_owner. This is a transaction-local setting on the SAME connection.
    const roleCheck = await client.query('SELECT current_user AS db_role');
    if (roleCheck.rows?.[0]?.db_role !== 'stayblock_runtime') throw new Error('UNSAFE_DATABASE_ROLE');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await work(client, { userId });
    await client.query('COMMIT');
    inTransaction = false;
    return result;
  } catch (error) {
    if (inTransaction) {
      try { await client.query('ROLLBACK'); } catch { /* original error takes priority */ }
    }
    throw error;
  } finally {
    client.release();
  }
}
module.exports={withVerifiedDbSession};
