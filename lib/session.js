const crypto = require('node:crypto');
const { getPool } = require('./db');
const { readCookie } = require('./http');

async function currentUser(req) {
  const rawToken = readCookie(req, 'recloe_session');
  if (!rawToken) return null;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const [rows] = await getPool().execute(
    `SELECT u.id, u.email, u.display_name AS displayName
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP() AND u.status = 'active'
      LIMIT 1`,
    [tokenHash],
  );
  return rows[0] || null;
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

module.exports = { currentUser, createSessionToken };
