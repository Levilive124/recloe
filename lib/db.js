const mysql = require('mysql2/promise');

let pool;

function getPool() {
  // Railway's copy action can include the variable name before the URL.
  // Accept that form safely, while always trimming whitespace/newlines.
  const databaseUrl = String(process.env.DATABASE_URL || '')
    .trim()
    .replace(/^DATABASE_URL\s*/i, '')
    .replace(/^MYSQL_PUBLIC_URL\s*/i, '')
    .trim();
  if (!databaseUrl) throw new Error('DATABASE_URL ist nicht gesetzt.');
  if (!pool) {
    pool = mysql.createPool(databaseUrl, {
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 2,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      ssl: process.env.DATABASE_SSL === 'false' ? undefined : { rejectUnauthorized: true },
      timezone: 'Z',
    });
  }
  return pool;
}

module.exports = { getPool };
