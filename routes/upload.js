const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const pdfParse = require('pdf-parse');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const {
  parseResumeText,
  normalizeSkills,
} = require('../utils/resumeParse');
const { insertCandidateRow } = require('../utils/candidateDb');

const router = express.Router();

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 120);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE_TYPE'));
    }
  },
});

function handleUpload(req, res, next) {
  upload.single('resume')(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: `File is too large. Maximum size is ${MAX_FILE_BYTES / (1024 * 1024)} MB.`,
      });
    }

    if (err.message === 'INVALID_FILE_TYPE') {
      return res.status(400).json({
        message: 'Invalid file type. Only PDF and DOCX files are allowed.',
      });
    }

    return next(err);
  });
}

/** Same shape as GET /api/candidates list items. */
function formatCandidate(row) {
  if (!row) return null;
  let skills = [];
  if (row.parsed_skills) {
    try {
      const parsed = JSON.parse(row.parsed_skills);
      skills = Array.isArray(parsed) ? parsed : [];
    } catch {
      skills = [];
    }
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? '',
    resume: row.resume_path ?? row.resume ?? null,
    status: row.status,
    createdAt: row.created_at,
    jobId: row.job_id ?? null,
    jobTitle: row.jobTitle ?? row.job_title ?? null,
    jobSkills: row.jobSkills ?? row.job_skills ?? null,
    aiScore: row.ai_score,
    aiMatchPercentage: Number(row.ai_match_percentage ?? 0),
    parsedSkills: skills,
    skills,
  };
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
    console.warn('[upload] could not load job context for match:', err.message);
    return { jobId: null, jobTitle: null, requiredSkills: '' };
  }
}

async function extractTextFromResume(absPath, ext) {
  if (ext !== '.pdf') {
    return '';
  }
  try {
    const buffer = await fs.promises.readFile(absPath);
    const data = await pdfParse(buffer);
    return typeof data.text === 'string' ? data.text : '';
  } catch (err) {
    console.warn('[upload] PDF text extraction failed:', err.message);
    return '';
  }
}

router.post('/', authenticate, handleUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No file uploaded. Please choose a PDF or DOCX resume.',
      });
    }

    const filePath = `/uploads/${req.file.filename}`;
    const absPath = path.join(__dirname, '..', 'uploads', req.file.filename);
    const ext = path.extname(req.file.originalname).toLowerCase();

    let rawText = '';
    try {
      rawText = await extractTextFromResume(absPath, ext);
    } catch {
      rawText = '';
    }

    let parsed = { name: 'Unknown Candidate', email: '', skills: [] };
    try {
      parsed = parseResumeText(rawText);
    } catch (err) {
      console.warn('[upload] Rule-based parse failed:', err.message);
    }

    const bodyName = String(req.body.name || '').trim();
    const bodyEmail = String(req.body.email || '').trim();
    const name = bodyName || parsed.name || 'Unknown Candidate';
    const email = bodyEmail || parsed.email || '';
    const candidateSkills = normalizeSkills(parsed.skills);
    const skillsJson = JSON.stringify(candidateSkills);
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
    const aiMatchPercentage =
      jobSkills.length === 0
        ? 0
        : Math.round((matchedSkills.length / jobSkills.length) * 100);
    console.log('SELECTED JOB:', jobContext);
    console.log('JOB SKILLS:', jobSkills);
    console.log('RESUME SKILLS:', resumeSkills);
    console.log('MATCHED:', matchedSkills);
    console.log('MATCH %:', aiMatchPercentage);

    let insertResult;
    try {
      insertResult = await insertCandidateRow(db, {
        name,
        email: email === '' ? '' : email,
        phone: null,
        jobId: jobContext.jobId,
        resumePath: filePath,
        parsedSkillsJson: skillsJson,
        aiScore: aiMatchPercentage,
        aiMatchPercentage,
        status: 'applied',
      });
    } catch (dbErr) {
      console.error('[upload] candidate insert failed:', {
        errno: dbErr.errno,
        code: dbErr.code,
        message: dbErr.message,
      });
      return res.status(500).json({
        message: 'Could not save candidate due to a database insert error.',
      });
    }

    const candidateId = insertResult.insertId;
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

    const candidate = formatCandidate(rows[0]);

    return res.status(201).json({
      message: 'Candidate created successfully',
      candidate: {
        name: candidate?.name || name,
        email: candidate?.email || email,
        skills: candidate?.skills || candidateSkills,
        parsed_skills: JSON.stringify(candidate?.skills || candidateSkills),
        ai_match_percentage: Number(candidate?.aiMatchPercentage ?? aiMatchPercentage ?? 0),
        status: candidate?.status || 'applied',
        jobTitle: candidate?.jobTitle || jobContext.jobTitle,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
