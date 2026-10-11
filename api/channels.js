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
    const spaceId = String(req.query.spaceId || '');
    const [rows] = await pool.execute(
      `SELECT c.id, c.space_id AS spaceId, c.name, c.kind
         FROM channels c JOIN space_members sm ON sm.space_id = c.space_id
        WHERE sm.user_id = ? AND c.space_id = ? AND c.deleted_at IS NULL ORDER BY c.position, c.created_at`, [user.id, spaceId]);
    return send(res, 200, { channels: rows });
  }
  const name = String(req.body?.name || '').trim().toLowerCase().replace(/\s+/g, '-');
  const spaceId = String(req.body?.spaceId || '');
  const kind = req.body?.kind === 'voice' ? 'voice' : 'text';
  if (!/^[a-z0-9_-]{1,50}$/.test(name) || !spaceId) return send(res, 400, { error: 'Bitte gib einen gültigen Kanalnamen ein.' });
  const [membership] = await pool.execute('SELECT role FROM space_members WHERE space_id = ? AND user_id = ?', [spaceId, user.id]);
  if (!membership.length) return send(res, 404, { error: 'Space nicht gefunden.' });
  const id = randomUUID();
  try {
    await pool.execute('INSERT INTO channels (id, space_id, name, kind) VALUES (?, ?, ?, ?)', [id, spaceId, name, kind]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return send(res, 409, { error: 'Dieser Kanal existiert bereits.' });
    throw error;
  }
  return send(res, 201, { channel: { id, spaceId, name, kind } });
};
