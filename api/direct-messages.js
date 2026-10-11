const { randomUUID } = require('node:crypto');
const { getPool } = require('../lib/db');
const { currentUser } = require('../lib/session');
const { send, methodNotAllowed } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST']);
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'Bitte melde dich an.' });
  const id = String(req.method === 'GET' ? req.query.conversationId : req.body?.conversationId || '');
  const pool = getPool();
  const [membership] = await pool.execute('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?', [id, user.id]);
  if (!membership.length) return send(res, 404, { error: 'Unterhaltung nicht gefunden.' });
  if (req.method === 'GET') {
    const [messages] = await pool.execute(
      `SELECT dm.id, dm.content, dm.created_at AS createdAt, u.id AS userId, u.display_name AS displayName
         FROM direct_messages dm JOIN users u ON u.id=dm.user_id
        WHERE dm.conversation_id=? AND dm.deleted_at IS NULL ORDER BY dm.created_at DESC LIMIT 100`, [id]);
    return send(res, 200, { messages: messages.reverse() });
  }
  const content = String(req.body?.content || '').trim();
  if (!content || content.length > 4000) return send(res, 400, { error: 'Nachrichten müssen 1 bis 4.000 Zeichen lang sein.' });
  const messageId = randomUUID();
  await pool.execute('INSERT INTO direct_messages (id,conversation_id,user_id,content) VALUES (?,?,?,?)', [messageId, id, user.id, content]);
  return send(res, 201, { message: { id: messageId, conversationId: id, content, userId: user.id, displayName: user.displayName, createdAt: new Date().toISOString() } });
};
