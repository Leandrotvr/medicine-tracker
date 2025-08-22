const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Utilidad: convierte ? -> , ... y devuelve { text, values }
function toParam(query, params = []) {
  let index = 0;
  const text = query.replace(/\?/g, () => \pg{++index});
  return { text, values: params || [] };
}

// Inicializa tablas (equivalentes a las que usabas en SQLite)
(async () => {
  const client = await pool.connect();
  try {
    await client.query(
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    );
    await client.query(
      CREATE TABLE IF NOT EXISTS medicines (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        dose VARCHAR(255) NOT NULL,
        frequency VARCHAR(255) NOT NULL
      );
    );
  } finally {
    client.release();
  }
})().catch(err => console.error('Error inicializando la base de datos', err));

// API compatible con sqlite3:

// db.get(sql, params, cb) -> primer registro
function get(sql, params, cb) {
  const { text, values } = toParam(sql, params);
  pool.query(text, values)
    .then(r => cb && cb(null, r.rows[0]))
    .catch(e => cb && cb(e));
}

// db.all(sql, params, cb) -> todos los registros
function all(sql, params, cb) {
  const { text, values } = toParam(sql, params);
  pool.query(text, values)
    .then(r => cb && cb(null, r.rows))
    .catch(e => cb && cb(e));
}

// db.run(sql, params, cb) -> INSERT/UPDATE/DELETE
// Emulamos this.lastID para INSERT añadiendo RETURNING id si falta.
function run(sql, params, cb) {
  let text = sql.trim();
  const isInsert = /^insert\s+/i.test(text);
  const needsReturning = isInsert && !/returning\s+id/i.test(text);
  if (needsReturning) text += ' RETURNING id';

  const { text: finalText, values } = toParam(text, params);
  pool.query(finalText, values)
    .then(r => {
      // Contexto tipo sqlite: this.lastID
      const ctx = isInsert ? { lastID: r.rows?.[0]?.id } : {};
      cb && cb.call(ctx, null);
    })
    .catch(e => cb && cb(e));
}

module.exports = { get, all, run, query: (q, p) => pool.query(q, p) };
