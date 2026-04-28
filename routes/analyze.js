const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { normalizeSkills } = require('../utils/resumeParse');
const { scoreResumeAgainstJob } = require('../utils/skillScore');

const router = express.Router();

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'analyze');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
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
      cb(new Error('UNSUPPORTED_FILE_TYPE'));
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
    if (err.message === 'UNSUPPORTED_FILE_TYPE') {
      return res.status(400).json({
        message: 'Unsupported file type. Use PDF, DOCX, or TXT.',
      });
    }
    return next(err);
  });
}

function getPythonCommand() {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
  return process.platform === 'win32' ? 'python' : 'python3';
}

function runParser(absolutePath) {
  const scriptPath = path.join(__dirname, '..', '..', 'ai', 'parser.py');
  return new Promise((resolve, reject) => {
    const cmd = getPythonCommand();
    const child = spawn(cmd, [scriptPath, absolutePath], {
      cwd: path.join(__dirname, '..', '..'),
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python exited with code ${code}`));
        return;
      }
      try {
        const trimmed = stdout.trim();
        const parsed = JSON.parse(trimmed);
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Invalid JSON from parser: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

router.post('/', authenticate, handleUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No resume file uploaded. Field name must be "resume".' });
    }

    const jobId = Number(req.body.jobId || req.body.job_id || 0);
    console.log('SELECTED JOB ID:', jobId || '(none)');

    if (!jobId) {
      return res.status(400).json({ message: 'Job selection is required' });
    }

    const [jobs] = await db.query(
      `
      SELECT id, title, skills, description, status
      FROM jobs
      WHERE id = ?
      LIMIT 1
      `,
      [jobId],
    );

    if (jobs.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const job = jobs[0];
    console.log('SELECTED JOB:', { id: job.id, title: job.title, status: job.status });

    if (String(job.status || '').trim().toLowerCase() !== 'open') {
      return res.status(400).json({ message: 'This job is not open for applications.' });
    }

    const jobSkillsForScore = job.skills != null ? String(job.skills).trim() : '';

    const absPath = path.resolve(req.file.path);

    let parsed;
    try {
      parsed = await runParser(absPath);
    } catch (err) {
      console.error('[analyze] Python parser failed:', err.message);
      return res.status(500).json({
        message: 'Resume parsing failed. Ensure Python 3 is installed and run: pip install -r ai/requirements.txt',
        detail: err.message,
      });
    }

    if (parsed.error) {
      return res.status(400).json({ message: parsed.error || 'Parser error', skills: [], preview: '' });
    }

    const resumeSkills = Array.isArray(parsed.skills) ? parsed.skills : [];
    const preview = typeof parsed.preview === 'string' ? parsed.preview : '';

    const resumeNorm = normalizeSkills(resumeSkills);
    const scoring = scoreResumeAgainstJob(resumeNorm, jobSkillsForScore);

    console.log('JOB SKILLS (raw):', jobSkillsForScore);
    console.log('RESUME SKILLS:', resumeSkills);
    console.log('MATCHED:', scoring.matchedSkills);
    console.log('MISSING:', scoring.missingSkills);
    console.log('MATCH %:', scoring.score);

    return res.json({
      skills: resumeSkills,
      preview,
      matchedSkills: scoring.matchedSkills,
      missingSkills: scoring.missingSkills,
      score: scoring.score,
      jobTitle: job.title,
      jobId: job.id,
    });
  } catch (err) {
    console.error('[analyze]', err);
    return res.status(500).json({ message: err.message || 'Analyze failed.' });
  }
});

module.exports = router;
