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
    const [rows] = await pool.execute(
      `SELECT c.id, other.id AS userId, other.display_name AS displayName, other.email,
              (SELECT dm.content FROM direct_messages dm WHERE dm.conversation_id=c.id AND dm.deleted_at IS NULL ORDER BY dm.created_at DESC LIMIT 1) AS lastMessage,
              (SELECT dm.created_at FROM direct_messages dm WHERE dm.conversation_id=c.id AND dm.deleted_at IS NULL ORDER BY dm.created_at DESC LIMIT 1) AS lastMessageAt
         FROM conversation_members mine
         JOIN conversations c ON c.id=mine.conversation_id
         JOIN conversation_members theirs ON theirs.conversation_id=c.id AND theirs.user_id<>mine.user_id
         JOIN users other ON other.id=theirs.user_id
        WHERE mine.user_id=? ORDER BY COALESCE(lastMessageAt,c.created_at) DESC`, [user.id]);
    return send(res, 200, { conversations: rows });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || email === user.email) return send(res, 400, { error: 'Gib die E-Mail-Adresse einer anderen recloe-Person ein.' });
  const [people] = await pool.execute('SELECT id, email, display_name AS displayName FROM users WHERE email=? AND status=\'active\' LIMIT 1', [email]);
  if (!people.length) return send(res, 404, { error: 'Zu dieser E-Mail-Adresse wurde kein recloe-Konto gefunden.' });
  const peer = people[0];
  const [existing] = await pool.execute(
    `SELECT mine.conversation_id AS id FROM conversation_members mine
      JOIN conversation_members peer ON peer.conversation_id=mine.conversation_id
     WHERE mine.user_id=? AND peer.user_id=? LIMIT 1`, [user.id, peer.id]);
  if (existing.length) return send(res, 200, { conversation: { id: existing[0].id, userId: peer.id, displayName: peer.displayName, email: peer.email } });
  const id = randomUUID(); const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT INTO conversations (id) VALUES (?)', [id]);
    await connection.execute('INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?),(?,?)', [id, user.id, id, peer.id]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
  return send(res, 201, { conversation: { id, userId: peer.id, displayName: peer.displayName, email: peer.email } });
};
