const mysql = require('mysql2');

const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error(
    `[DB CONFIG] Missing required environment variables: ${missingEnvVars.join(', ')}`,
  );
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

const db = pool.promise();

async function testConnection() {
  let connection;

  try {
    connection = await db.getConnection();
    const [[{ currentDb }]] = await connection.query(
      'SELECT DATABASE() AS currentDb',
    );
    const [databaseRows] = await connection.query(
      'SHOW DATABASES LIKE ?',
      [process.env.DB_NAME],
    );

    if (databaseRows.length === 0) {
      console.error(
        `[DB CHECK] Connected, but database "${process.env.DB_NAME}" was not found.`,
      );
      console.error(
        `[DB CHECK] Create it with: CREATE DATABASE ${process.env.DB_NAME};`,
      );
      return;
    }

    connection.release();
    console.log(
      `[DB CHECK] MySQL connected successfully to "${currentDb}" at ${process.env.DB_HOST}:${process.env.DB_PORT || 3306} as "${process.env.DB_USER}".`,
    );
  } catch (error) {
    if (connection) {
      connection.release();
    }

    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(
        `[DB CHECK] Access denied for "${process.env.DB_USER}"@\"${process.env.DB_HOST}\".`,
      );
      console.error(
        '[DB CHECK] Verify DB_USER/DB_PASSWORD in backend/.env.local (or .env) and grant privileges for ats_db.',
      );
      return;
    }

    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(
        `[DB CHECK] Database "${process.env.DB_NAME}" does not exist.`,
      );
      console.error(
        `[DB CHECK] Create it with: CREATE DATABASE ${process.env.DB_NAME};`,
      );
      return;
    }

    console.error('[DB CHECK] MySQL connection failed:', error.message);
  }
}

module.exports = db;
module.exports.testConnection = testConnection;
