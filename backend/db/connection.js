const { Pool } = require('pg');

const useSsl = String(process.env.DATABASE_SSL).toLowerCase() === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Idle client errors shouldn't crash the whole process
  console.error('Unexpected error on idle Postgres client', err);
});

/**
 * Thin helper around pool.query so callers don't have to import pg directly.
 * @param {string} text
 * @param {Array<any>} params
 */
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
