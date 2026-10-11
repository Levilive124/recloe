const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ist nicht gesetzt.');
  if (!pool) {
    pool = mysql.createPool(process.env.DATABASE_URL, {
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
