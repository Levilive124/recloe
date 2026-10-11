const bcrypt = require('bcryptjs');
const { randomUUID, createHash } = require('node:crypto');
const { getPool } = require('../../lib/db');
const { send, setSessionCookie, methodNotAllowed } = require('../../lib/http');
const { createSessionToken } = require('../../lib/session');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const confirmation = String(req.body?.passwordConfirmation || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return send(res, 400, { error: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  if (password.length < 10 || password.length > 128) return send(res, 400, { error: 'Dein Passwort muss zwischen 10 und 128 Zeichen lang sein.' });
  if (password !== confirmation) return send(res, 400, { error: 'Die Passwörter stimmen nicht überein.' });

  const pool = getPool();
  const userId = randomUUID();
  const sessionToken = createSessionToken();
  const sessionHash = createHash('sha256').update(sessionToken).digest('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)', [userId, email, passwordHash, email.split('@')[0].slice(0, 32)]);
    const spaceId = randomUUID();
    await connection.execute('INSERT INTO spaces (id, owner_id, name) VALUES (?, ?, ?)', [spaceId, userId, 'The Loft']);
    await connection.execute('INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, ?)', [spaceId, userId, 'owner']);
    for (const name of ['lobby', 'inspiration', 'screenshots', 'now-playing']) {
      await connection.execute('INSERT INTO channels (id, space_id, name, kind) VALUES (?, ?, ?, ?)', [randomUUID(), spaceId, name, 'text']);
    }
    await connection.execute('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))', [randomUUID(), userId, sessionHash]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return send(res, 409, { error: 'Für diese E-Mail-Adresse gibt es bereits ein Konto.' });
    console.error('recloe registration failed', error.code || error.message);
    return send(res, 500, { error: 'Registrierung gerade nicht möglich. Prüfe die Datenbankverbindung.' });
  } finally {
    connection.release();
  }
  setSessionCookie(res, sessionToken);
  return send(res, 201, { user: { id: userId, email, displayName: email.split('@')[0].slice(0, 32) } });
};
