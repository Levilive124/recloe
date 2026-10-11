export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!apiKey.startsWith('bhk_')) return res.status(401).json({ error: 'Bot-Hosting.net API-Key fehlt oder ist ungültig.' });
  const { path, method = 'GET', body } = req.body || {};
  if (typeof path !== 'string' || !/^\/(deployments|projects)(\/|\?|$)/.test(path) || path.includes('..') || path.length > 500) return res.status(400).json({ error: 'Ungültiger API-Pfad.' });
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) return res.status(405).json({ error: 'Methode nicht erlaubt.' });
  try {
    const upstream = await fetch(`https://bot-hosting.net/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await upstream.text();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(upstream.status).send(text || '{}');
  } catch {
    return res.status(502).json({ error: 'Bot-Hosting.net ist gerade nicht erreichbar.' });
  }
}
