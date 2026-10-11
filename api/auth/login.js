const bcrypt = require('bcryptjs');
const { randomUUID, createHash } = require('node:crypto');
const { getPool } = require('../../lib/db');
const { send, setSessionCookie, methodNotAllowed } = require('../../lib/http');
const { createSessionToken } = require('../../lib/session');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return send(res, 400, { error: 'E-Mail und Passwort sind erforderlich.' });
  const pool = getPool();
  const [rows] = await pool.execute('SELECT id, email, password_hash, display_name AS displayName FROM users WHERE email = ? AND status = \'active\' LIMIT 1', [email]);
  const user = rows[0];
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!valid) return send(res, 401, { error: 'E-Mail oder Passwort ist nicht korrekt.' });
  const token = createSessionToken();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await pool.execute('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))', [randomUUID(), user.id, tokenHash]);
  setSessionCookie(res, token);
  return send(res, 200, { user: { id: user.id, email: user.email, displayName: user.displayName } });
};
