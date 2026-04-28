const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { insertCandidateRow } = require('../utils/candidateDb');
const pdfParse = require('pdf-parse');
const {
  parseResumeText,
  normalizeSkills,
} = require('../utils/resumeParse');
const { mapCandidateRow } = require('../utils/mapCandidateRow');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'resumes'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' || ext === '.docx') {
      cb(null, true);
    } else {
      cb(new Error('Only .pdf and .docx files are allowed.'));
    }
  },
});

router.use(authenticate);

async function extractTextFromResume(absPath, ext) {
  if (ext !== '.pdf') {
    return '';
  }
  try {
    const buffer = await fs.promises.readFile(absPath);
    const data = await pdfParse(buffer);
    return typeof data.text === 'string' ? data.text : '';
  } catch (err) {
    console.warn('[candidates/upload] PDF parse failed:', err.message);
    return '';
  }
}

async function resolveJobContext(body) {
  const jobId = Number(body?.jobId || body?.job_id || 0);
  if (!jobId) {
    return { jobId: null, jobTitle: null, requiredSkills: '' };
  }
  try {
    const [rows] = await db.query(
      `
      SELECT id, title, skills, description, status
      FROM jobs
      WHERE id = ?
      LIMIT 1
      `,
      [jobId],
    );
    if (rows.length === 0) {
      return { jobId: null, jobTitle: null, requiredSkills: '' };
    }
    if (String(rows[0].status || '').trim().toLowerCase() !== 'open') {
      return { jobId: null, jobTitle: null, requiredSkills: '' };
    }
    const skillsSource = rows[0].skills != null ? String(rows[0].skills) : '';
    return {
      jobId: Number(rows[0].id),
      jobTitle: rows[0].title || null,
      requiredSkills: `${skillsSource} ${rows[0].description || ''}`.trim(),
    };
  } catch (err) {
    console.warn('[candidates/upload] could not load job context:', err.message);
    return { jobId: null, jobTitle: null, requiredSkills: '' };
  }
}

/** PUT /api/candidate/:id — only Applied, Interview, Hired (case-insensitive → DB enum). */
const PUT_ALLOWED_STATUSES = new Set(['applied', 'interview', 'hired']);

function normalizePutStatus(body) {
  const raw = body?.status;
  if (raw == null || typeof raw !== 'string') {
    return { error: 'status is required.' };
  }
  const lower = raw.trim().toLowerCase();
  if (PUT_ALLOWED_STATUSES.has(lower)) {
    return { value: lower };
  }
  return {
    error: 'status must be one of: Applied, Interview, Hired.',
  };
}

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        c.*,
        j.title AS jobTitle,
        j.skills AS jobSkills
      FROM candidates c
      LEFT JOIN jobs j ON c.job_id = j.id
      ORDER BY c.created_at DESC
      `,
    );
    return res.json(rows.map((r) => mapCandidateRow(r)));
  } catch (error) {
    return next(error);
  }
});

router.delete('/cleanup', authorize('hr'), async (req, res, next) => {
  try {
    const execute = String(req.query.execute || '').toLowerCase() === 'true';
    const olderThanDays = Math.max(1, Math.min(3650, Number(req.query.olderThanDays || 21)));
    const cutoffExpr = `DATE_SUB(NOW(), INTERVAL ${olderThanDays} DAY)`;

    const whereClause = `
      c.created_at < ${cutoffExpr}
      AND (
        (
          c.job_id IS NULL
          AND COALESCE(c.ai_score, 0) = 0
          AND COALESCE(c.ai_match_percentage, 0) = 0
        )
        OR (
          LOWER(TRIM(c.name)) IN ('alex morgan', 'jordan lee')
          AND c.job_id IS NULL
          AND COALESCE(c.ai_score, 0) = 0
          AND COALESCE(c.ai_match_percentage, 0) = 0
        )
      )
    `;

    const [previewRows] = await db.query(
      `
      SELECT c.id, c.name, c.email, c.job_id, c.ai_score, c.ai_match_percentage, c.created_at
      FROM candidates c
      WHERE ${whereClause}
      ORDER BY c.created_at ASC
      LIMIT 200
      `,
    );

    if (!execute) {
      return res.json({
        dryRun: true,
        olderThanDays,
        wouldDeleteCount: previewRows.length,
        sample: previewRows,
        message:
          'Dry run only. Re-run with ?execute=true to delete these legacy candidates.',
      });
    }

    const [result] = await db.query(
      `
      DELETE c
      FROM candidates c
      WHERE ${whereClause}
      `,
    );

    return res.json({
      dryRun: false,
      olderThanDays,
      deletedCount: result.affectedRows || 0,
      previewCountBeforeDelete: previewRows.length,
      message: 'Legacy candidates cleanup completed.',
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', authorize('hr'), async (req, res, next) => {
  try {
    const candidateId = Number(req.params.id);
    if (!candidateId) {
      return res.status(400).json({ message: 'Invalid candidate id.' });
    }

    const [result] = await db.query(
      `
      DELETE FROM candidates
      WHERE id = ?
      `,
      [candidateId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Candidate not found.' });
    }

    return res.json({ message: 'Candidate deleted successfully.' });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/upload',
  authorize('hr'),
  (req, res, next) => {
    upload.single('resume')(req, res, (err) => {
      if (!err) return next();
      if (err.message === 'Only .pdf and .docx files are allowed.') {
        return res.status(400).json({ message: err.message });
      }
      return next(err);
    });
  },
  async (req, res, next) => {
    try {
      const { name, email = null, phone = null } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: 'Resume file is required.' });
      }

      const displayName = String(name || '').trim() || 'Unknown Candidate';
      const resumePath = `/uploads/resumes/${req.file.filename}`;
      const absPath = path.join(__dirname, '..', 'uploads', 'resumes', req.file.filename);
      const ext = path.extname(req.file.originalname).toLowerCase();
      const rawText = await extractTextFromResume(absPath, ext);
      let parsed = { name: displayName, email: email || '', skills: [] };
      try {
        parsed = parseResumeText(rawText);
      } catch (err) {
        console.warn('[candidates/upload] parseResumeText failed:', err.message);
      }
      const candidateName = displayName || parsed.name || 'Unknown Candidate';
      const candidateEmail = String(email || '').trim() || parsed.email || '';
      const candidateSkills = normalizeSkills(parsed.skills);
      const parsedSkillsJson = JSON.stringify(candidateSkills);
      const jobContext = await resolveJobContext(req.body);
      console.log('SELECTED JOB ID:', jobContext.jobId);
      console.log('SELECTED JOB:', jobContext);
      if (!jobContext.jobId) {
        return res.status(400).json({
          message: 'Job selection is required',
        });
      }
      const jobSkills = normalizeSkills(
        String(jobContext.requiredSkills || '')
          .split(',')
          .map((s) => s.trim().toLowerCase()),
      );
      const resumeSkills = normalizeSkills(candidateSkills);
      const matchedSkills = resumeSkills.filter((skill) => jobSkills.includes(skill));
      const matchScore =
        jobSkills.length === 0
          ? 0
          : Math.round((matchedSkills.length / jobSkills.length) * 100);
      console.log('SELECTED JOB:', jobContext);
      console.log('JOB SKILLS:', jobSkills);
      console.log('RESUME SKILLS:', resumeSkills);
      console.log('MATCHED:', matchedSkills);
      console.log('MATCH %:', matchScore);
      const status = matchScore >= 60 ? 'shortlisted' : 'applied';

      let insertResult;
      try {
        insertResult = await insertCandidateRow(db, {
          name: candidateName,
          email: candidateEmail,
          phone,
          jobId: jobContext.jobId,
          resumePath,
          parsedSkillsJson,
          aiScore: matchScore,
          aiMatchPercentage: matchScore,
          status,
        });
      } catch (dbErr) {
        console.error('[candidates/upload] insert failed:', {
          errno: dbErr.errno,
          code: dbErr.code,
          message: dbErr.message,
        });
        return res.status(500).json({
          message: 'Could not save candidate due to a database insert error.',
        });
      }

      const [rows] = await db.query(
        `
        SELECT
          c.*,
          j.title AS jobTitle,
          j.skills AS jobSkills
        FROM candidates c
        LEFT JOIN jobs j ON c.job_id = j.id
        WHERE c.id = ?
        LIMIT 1
        `,
        [insertResult.insertId],
      );

      const mapped = mapCandidateRow(rows[0]);
      return res.status(201).json({
        message: 'Candidate created successfully',
        candidate: {
          name: mapped?.name || candidateName,
          email: mapped?.email || candidateEmail,
          skills: mapped?.skills || candidateSkills,
          parsed_skills: JSON.stringify(mapped?.skills || candidateSkills),
          ai_match_percentage: Number(mapped?.aiMatchPercentage ?? matchScore ?? 0),
          status: mapped?.status || status,
          jobTitle: mapped?.jobTitle || jobContext.jobTitle,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.get('/:id', async (req, res, next) => {
  try {
    const candidateId = Number(req.params.id);
    if (!candidateId) {
      return res.status(400).json({ message: 'Invalid candidate id.' });
    }

    const [rows] = await db.query(
      `
      SELECT
        c.*,
        j.title AS jobTitle,
        j.skills AS jobSkills
      FROM candidates c
      LEFT JOIN jobs j ON c.job_id = j.id
      WHERE c.id = ?
      LIMIT 1
      `,
      [candidateId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Candidate not found.' });
    }

    return res.json(mapCandidateRow(rows[0]));
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const candidateId = Number(req.params.id);
    if (!candidateId) {
      return res.status(400).json({ message: 'Invalid candidate id.' });
    }

    const parsed = normalizePutStatus(req.body);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const [result] = await db.query(
      `
      UPDATE candidates
      SET status = ?
      WHERE id = ?
      `,
      [parsed.value, candidateId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Candidate not found.' });
    }

    const [rows] = await db.query(
      `
      SELECT
        c.*,
        j.title AS jobTitle,
        j.skills AS jobSkills
      FROM candidates c
      LEFT JOIN jobs j ON c.job_id = j.id
      WHERE c.id = ?
      LIMIT 1
      `,
      [candidateId],
    );

    return res.json(mapCandidateRow(rows[0]));
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const candidateId = Number(req.params.id);
    const { status } = req.body;
    const allowedStatuses = [
      'new',
      'applied',
      'shortlisted',
      'interview',
      'rejected',
      'hired',
    ];

    if (!candidateId) {
      return res.status(400).json({ message: 'Invalid candidate id.' });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message:
          'status must be one of: new, applied, shortlisted, interview, rejected, hired.',
      });
    }

    const [result] = await db.query(
      `
      UPDATE candidates
      SET status = ?
      WHERE id = ?
      `,
      [status, candidateId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Candidate not found.' });
    }

    return res.json({ message: 'Candidate status updated successfully.' });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/notes', async (req, res, next) => {
  try {
    const candidateId = Number(req.params.id);
    if (!candidateId) {
      return res.status(400).json({ message: 'Invalid candidate id.' });
    }

    const [rows] = await db.query(
      `
      SELECT
        n.*,
        u.name AS author_name
      FROM candidate_notes n
      LEFT JOIN users u ON u.id = n.author_id
      WHERE n.candidate_id = ?
      ORDER BY n.created_at DESC
      `,
      [candidateId],
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/notes', async (req, res, next) => {
  try {
    const candidateId = Number(req.params.id);
    const note = String(req.body.note || '').trim();

    if (!candidateId) {
      return res.status(400).json({ message: 'Invalid candidate id.' });
    }

    if (!note) {
      return res.status(400).json({ message: 'note is required.' });
    }

    const [result] = await db.query(
      `
      INSERT INTO candidate_notes (candidate_id, author_id, note)
      VALUES (?, ?, ?)
      `,
      [candidateId, req.user.id, note],
    );

    return res.status(201).json({ noteId: result.insertId });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
