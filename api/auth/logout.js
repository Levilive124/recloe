const crypto = require('node:crypto');
const { getPool } = require('../../lib/db');
const { readCookie, clearSessionCookie, send, methodNotAllowed } = require('../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const token = readCookie(req, 'recloe_session');
  if (token) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await getPool().execute('DELETE FROM sessions WHERE token_hash = ?', [hash]);
  }
  clearSessionCookie(res);
  return send(res, 200, { ok: true });
};
