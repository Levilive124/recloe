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
    const channelId = String(req.query.channelId || '');
    const [membership] = await pool.execute(
      `SELECT c.id FROM channels c JOIN space_members sm ON sm.space_id = c.space_id
        WHERE c.id = ? AND sm.user_id = ? AND c.deleted_at IS NULL LIMIT 1`, [channelId, user.id]);
    if (!membership.length) return send(res, 404, { error: 'Kanal nicht gefunden.' });
    const [messages] = await pool.execute(
      `SELECT m.id, m.content, m.created_at AS createdAt, u.id AS userId, u.display_name AS displayName
         FROM messages m JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ? AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 100`, [channelId]);
    return send(res, 200, { messages: messages.reverse() });
  }
  const channelId = String(req.body?.channelId || '');
  const content = String(req.body?.content || '').trim();
  if (!channelId || !content || content.length > 4000) return send(res, 400, { error: 'Nachrichten müssen 1 bis 4.000 Zeichen lang sein.' });
  const [membership] = await pool.execute(
    `SELECT c.id FROM channels c JOIN space_members sm ON sm.space_id = c.space_id
      WHERE c.id = ? AND sm.user_id = ? AND c.kind = 'text' AND c.deleted_at IS NULL LIMIT 1`, [channelId, user.id]);
  if (!membership.length) return send(res, 404, { error: 'Kanal nicht gefunden.' });
  const id = randomUUID();
  await pool.execute('INSERT INTO messages (id, channel_id, user_id, content) VALUES (?, ?, ?, ?)', [id, channelId, user.id, content]);
  return send(res, 201, { message: { id, channelId, content, userId: user.id, displayName: user.displayName, createdAt: new Date().toISOString() } });
};
