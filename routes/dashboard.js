const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const [[{ totalJobs }]] = await db.query('SELECT COUNT(*) AS totalJobs FROM jobs');
    const [[{ openJobs }]] = await db.query(
      "SELECT COUNT(*) AS openJobs FROM jobs WHERE status = 'open'",
    );
    const [[{ totalCandidates }]] = await db.query(
      'SELECT COUNT(*) AS totalCandidates FROM candidates',
    );
    const [[{ shortlisted }]] = await db.query(
      "SELECT COUNT(*) AS shortlisted FROM candidates WHERE status = 'shortlisted'",
    );
    const [[{ interviews }]] = await db.query(
      "SELECT COUNT(*) AS interviews FROM candidates WHERE status = 'interview'",
    );
    const [[{ hired }]] = await db.query(
      "SELECT COUNT(*) AS hired FROM candidates WHERE status = 'hired'",
    );

    const [recentCandidates] = await db.query(
      `
      SELECT
        id,
        name,
        email,
        ai_score,
        status,
        created_at
      FROM candidates
      ORDER BY created_at DESC
      LIMIT 5
      `,
    );

    const [recentOpenJobs] = await db.query(
      `
      SELECT
        j.id,
        j.title,
        j.status,
        j.created_at,
        0 AS candidate_count
      FROM jobs j
      WHERE j.status = 'open'
      ORDER BY j.created_at DESC
      LIMIT 3
      `,
    );

    return res.json({
      totalJobs,
      openJobs,
      totalCandidates,
      shortlisted,
      interviews,
      hired,
      recentCandidates,
      recentOpenJobs,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
