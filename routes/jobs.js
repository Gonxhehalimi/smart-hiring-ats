const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { mapCandidateRow } = require('../utils/mapCandidateRow');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const openOnly = String(req.query.openOnly || 'true').toLowerCase() !== 'false';
    const whereClause = openOnly
      ? "WHERE LOWER(TRIM(COALESCE(j.status, ''))) = 'open'"
      : '';

    const [rows] = await db.query(
      `
      SELECT
        j.id,
        j.title,
        j.description,
        j.skills,
        j.skills AS required_skills,
        j.min_experience,
        j.min_experience AS experience_required,
        LOWER(TRIM(COALESCE(j.status, ''))) AS status,
        j.created_at,
        u.name AS created_by_name,
        COUNT(c.id) AS candidate_count
      FROM jobs j
      LEFT JOIN users u ON u.id = j.created_by
      LEFT JOIN candidates c ON c.job_id = j.id
      ${whereClause}
      GROUP BY
        j.id,
        j.title,
        j.description,
        j.skills,
        j.min_experience,
        j.status,
        j.created_at,
        u.name
      ORDER BY j.created_at DESC
      `,
    );
    console.log('AVAILABLE JOBS:', rows?.length ?? 0, openOnly ? 'open rows' : 'rows');
    return res.json(rows);
  } catch (error) {
    console.error('[jobs] GET / failed:', error.errno, error.code, error.message);
    return next(error);
  }
});

router.post('/', authorize('hr'), async (req, res, next) => {
  try {
    const {
      title,
      description = null,
      skills,
      min_experience = 0,
      status = 'open',
    } = req.body;

    if (!title || !skills) {
      return res.status(400).json({
        message: 'title and skills are required.',
      });
    }

    const [insertResult] = await db.query(
      `
      INSERT INTO jobs (title, description, skills, min_experience, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [title, description, skills, min_experience, status, req.user.id],
    );

    return res.status(201).json({ jobId: insertResult.insertId });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const jobId = Number(req.params.id);

    if (!jobId) {
      return res.status(400).json({ message: 'Invalid job id.' });
    }

    const [jobs] = await db.query(
      `
      SELECT
        j.*,
        u.name AS created_by_name
      FROM jobs j
      LEFT JOIN users u ON u.id = j.created_by
      WHERE j.id = ?
      LIMIT 1
      `,
      [jobId],
    );

    if (jobs.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const [candidates] = await db.query(
      `
      SELECT
        c.*,
        j.title AS jobTitle,
        j.skills AS jobSkills
      FROM candidates c
      LEFT JOIN jobs j ON c.job_id = j.id
      WHERE c.job_id = ?
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [jobId],
    );

    return res.json({
      job: jobs[0],
      candidates: candidates.map((row) => mapCandidateRow(row)),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', authorize('hr'), async (req, res, next) => {
  try {
    const jobId = Number(req.params.id);

    if (!jobId) {
      return res.status(400).json({ message: 'Invalid job id.' });
    }

    const { title, description, skills, min_experience, status } = req.body;

    const [result] = await db.query(
      `
      UPDATE jobs
      SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        skills = COALESCE(?, skills),
        min_experience = COALESCE(?, min_experience),
        status = COALESCE(?, status)
      WHERE id = ?
      `,
      [title, description, skills, min_experience, status, jobId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    return res.json({ message: 'Job updated successfully.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
