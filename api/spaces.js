const { randomUUID } = require('node:crypto');
const { getPool } = require('../lib/db');
const { currentUser } = require('../lib/session');
const { send, methodNotAllowed } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST']);
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'Bitte melde dich an.' });
  const pool = getPool();
  if (req.method === 'GET') {
    const [spaces] = await pool.execute(
      `SELECT s.id, s.name, sm.role FROM spaces s JOIN space_members sm ON sm.space_id=s.id
       WHERE sm.user_id=? AND s.deleted_at IS NULL ORDER BY s.created_at`, [user.id]);
    return send(res, 200, { spaces });
  }
  const name = String(req.body?.name || '').trim();
  if (name.length < 2 || name.length > 80) return send(res, 400, { error: 'Der Space-Name muss 2 bis 80 Zeichen lang sein.' });
  const id = randomUUID();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT INTO spaces (id, owner_id, name) VALUES (?, ?, ?)', [id, user.id, name]);
    await connection.execute('INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, \'owner\')', [id, user.id]);
    for (const channel of ['lobby', 'inspiration']) await connection.execute(
      'INSERT INTO channels (id, space_id, name, kind) VALUES (?, ?, ?, \'text\')', [randomUUID(), id, channel]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('recloe space create failed', error.code || error.message);
    return send(res, 500, { error: 'Der Space konnte gerade nicht gespeichert werden.' });
  } finally { connection.release(); }
  return send(res, 201, { space: { id, name, role: 'owner' } });
};
