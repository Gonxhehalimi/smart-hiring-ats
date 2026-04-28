const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email: rawEmail, password, role: rawRole } = req.body || {};

    const nameTrimmed = String(name || '').trim();
    const email = normalizeEmail(rawEmail);

    if (!nameTrimmed || !email || !password) {
      return res.status(400).json({
        message: 'name, email, and password are required.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters.',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: 'Please provide a valid email address.',
      });
    }

    const roleInput =
      rawRole != null && String(rawRole).trim() !== '' ? String(rawRole).trim().toLowerCase() : 'hr';

    if (!['hr', 'hiring_manager'].includes(roleInput)) {
      return res.status(400).json({
        message: "role must be either 'hr' or 'hiring_manager'.",
      });
    }

    const [existingUsers] = await db.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email],
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [insertResult] = await db.query(
      `
      INSERT INTO users (name, email, password, role)
      VALUES (?, ?, ?, ?)
      `,
      [nameTrimmed, email, passwordHash, roleInput],
    );

    const userId = insertResult && insertResult.insertId != null ? insertResult.insertId : null;

    return res.status(201).json({
      message: 'Registration successful',
      userId,
    });
  } catch (error) {
    console.error('[auth/register]', error.code, error.errno, error.message);

    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return res.status(409).json({
        message: 'An account with this email already exists.',
      });
    }

    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'PROTOCOL_CONNECTION_LOST'
    ) {
      return res.status(503).json({
        message:
          'Cannot reach the database. Check that MySQL is running and DB_* settings in backend/.env.local are correct.',
      });
    }

    if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.errno === 1045) {
      return res.status(503).json({
        message:
          'Database access denied. Verify DB_USER and DB_PASSWORD in backend/.env.local (or .env).',
      });
    }

    if (error.code === 'ER_BAD_DB_ERROR' || error.errno === 1049) {
      return res.status(503).json({
        message: `Database "${process.env.DB_NAME || 'ats_db'}" does not exist. Create it or fix DB_NAME in .env.`,
      });
    }

    if (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146) {
      return res.status(503).json({
        message:
          'Database schema is missing (e.g. users table). Run backend/migrations/001_create_core_tables.sql against your DB.',
      });
    }

    return res.status(500).json({
      message:
        error.message && !String(error.message).includes('sql')
          ? error.message
          : 'Registration failed due to a server error. Check server logs.',
    });
  }
});

router.post('/login', async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: 'Server configuration error: JWT_SECRET is not set.',
      });
    }

    const { email: rawEmail, password } = req.body || {};
    const email = normalizeEmail(rawEmail);

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required.' });
    }

    const [rows] = await db.query(
      `
      SELECT id, name, email, password, role
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [email],
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const role = String(user.role || 'hr').toLowerCase();
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        name: payload.name,
      },
    });
  } catch (error) {
    console.error('[auth/login]', error.code, error.errno, error.message);

    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'PROTOCOL_CONNECTION_LOST'
    ) {
      return res.status(503).json({
        message:
          'Cannot reach the database. Check that MySQL is running and DB_* settings in backend/.env.local.',
      });
    }

    if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.errno === 1045) {
      return res.status(503).json({
        message: 'Database access denied. Verify DB_USER and DB_PASSWORD in .env.',
      });
    }

    if (error.code === 'ER_BAD_DB_ERROR' || error.errno === 1049) {
      return res.status(503).json({
        message: `Database "${process.env.DB_NAME || 'ats_db'}" does not exist. Create it or fix DB_NAME in .env.`,
      });
    }

    if (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146) {
      return res.status(503).json({
        message:
          'Database schema is missing (e.g. users table). Run backend/migrations/001_create_core_tables.sql against your DB.',
      });
    }

    return next(error);
  }
});

module.exports = router;
