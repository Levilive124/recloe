const { currentUser } = require('../../lib/session');
const { send, methodNotAllowed } = require('../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const user = await currentUser(req);
  if (!user) return send(res, 401, { user: null });
  return send(res, 200, { user });
};
