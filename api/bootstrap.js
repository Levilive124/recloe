const { randomUUID } = require('node:crypto');
const { getPool } = require('../lib/db');
const { currentUser } = require('../lib/session');
const { send, methodNotAllowed } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'Bitte melde dich an.' });
  const pool = getPool();
  const [spaces] = await pool.execute(
    `SELECT s.id, s.name, sm.role
       FROM spaces s JOIN space_members sm ON sm.space_id = s.id
      WHERE sm.user_id = ? AND s.deleted_at IS NULL ORDER BY s.created_at`, [user.id]);
  const [channels] = await pool.execute(
    `SELECT c.id, c.space_id AS spaceId, c.name, c.kind
       FROM channels c JOIN space_members sm ON sm.space_id = c.space_id
      WHERE sm.user_id = ? AND c.deleted_at IS NULL ORDER BY c.position, c.created_at`, [user.id]);
  return send(res, 200, { user, spaces, channels });
};
