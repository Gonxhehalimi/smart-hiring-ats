/**
 * Insert (or update duplicate) candidate row with schema-aware fallbacks.
 * Dedupe key: email + job_id when both are available.
 */

const candidateColumnsCache = new Map();

function shouldRetryInsert(err) {
  return (
    err.code === 'ER_BAD_FIELD_ERROR' ||
    err.errno === 1054 ||
    err.code === 'ER_BAD_NULL_ERROR' ||
    err.errno === 1048 ||
    err.code === 'ER_NO_DEFAULT_FOR_FIELD' ||
    err.errno === 1364 ||
    err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' ||
    err.errno === 1265
  );
}

async function getCandidateColumns(db) {
  const [[{ dbName }]] = await db.query('SELECT DATABASE() AS dbName');
  if (candidateColumnsCache.has(dbName)) {
    return candidateColumnsCache.get(dbName);
  }
  const [rows] = await db.query(
    `
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'candidates'
    `,
  );
  const set = new Set(rows.map((r) => r.COLUMN_NAME));
  candidateColumnsCache.set(dbName, set);
  return set;
}

function buildInsertSql(columns) {
  const placeholders = columns.map(() => '?').join(', ');
  return `INSERT INTO candidates (${columns.join(', ')}) VALUES (${placeholders})`;
}

function buildUpdateSql(columns) {
  const sets = columns.map((c) => `${c} = ?`).join(', ');
  return `UPDATE candidates SET ${sets} WHERE id = ?`;
}

function logAttempt(stage, info) {
  console.log(`[insertCandidateRow] ${stage}`, info);
}

async function upsertByEmailAndJob(db, columns, candidate) {
  if (!columns.has('email') || !columns.has('job_id')) return null;
  if (!candidate.email || candidate.job_id == null) return null;

  const [rows] = await db.query(
    `
    SELECT id
    FROM candidates
    WHERE email = ?
      AND job_id <=> ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [candidate.email, candidate.job_id],
  );

  if (!rows.length) return null;
  const existingId = rows[0].id;

  const updateCols = [
    'name',
    'email',
    'phone',
    'status',
    'parsed_skills',
    'ai_match_percentage',
    'ai_score',
    'job_id',
    'resume_path',
    'resume',
  ].filter((c) => columns.has(c));

  if (!updateCols.length) return { insertId: existingId, updated: true };

  const sql = buildUpdateSql(updateCols);
  const values = [...updateCols.map((c) => candidate[c]), existingId];
  logAttempt('upsert_update_existing', { existingId, sql, values });
  await db.query(sql, values);
  return { insertId: existingId, updated: true };
}

/**
 * @param {import('mysql2/promise').Pool} db
 * @param {object} fields
 */
async function insertCandidateRow(db, fields) {
  const {
    name,
    email = '',
    phone = null,
    jobId = null,
    resumePath = '',
    parsedSkillsJson = '[]',
    aiScore = 0,
    aiMatchPercentage = 0,
    status = 'new',
  } = fields;

  const columns = await getCandidateColumns(db);
  const resumeColumn = columns.has('resume_path')
    ? 'resume_path'
    : columns.has('resume')
      ? 'resume'
      : null;

  const fullCandidate = {
    name: String(name || 'Unknown Candidate'),
    email: String(email || ''),
    status: String(status || 'new').toLowerCase(),
    parsed_skills: parsedSkillsJson,
    ai_match_percentage: Number(aiMatchPercentage || 0),
    ai_score: Number(aiScore || 0),
    job_id: jobId == null ? null : Number(jobId),
    phone,
    resume_path: String(resumePath || ''),
    resume: String(resumePath || ''),
  };

  const upserted = await upsertByEmailAndJob(db, columns, fullCandidate);
  if (upserted) return upserted;

  const attemptColumnSets = [
    ['name', 'email', 'job_id', resumeColumn, 'status', 'parsed_skills', 'ai_match_percentage', 'ai_score', 'phone'],
    ['name', 'email', 'job_id', resumeColumn, 'status', 'parsed_skills', 'ai_match_percentage', 'ai_score'],
    ['name', 'email', 'job_id', resumeColumn, 'status', 'parsed_skills', 'ai_match_percentage'],
    ['name', 'email', 'job_id', resumeColumn, 'status', 'parsed_skills'],
    ['name', 'email', 'job_id', resumeColumn, 'status'],
    ['name', 'email', 'job_id', 'status'],
    ['name', 'email', resumeColumn, 'status'],
    ['name', 'email', 'status'],
  ]
    .map((cols) => cols.filter((c) => c && columns.has(c)))
    .filter((cols, idx, arr) => cols.length > 0 && arr.findIndex((a) => a.join('|') === cols.join('|')) === idx);

  let lastErr;
  for (let i = 0; i < attemptColumnSets.length; i += 1) {
    const cols = attemptColumnSets[i];
    const sql = buildInsertSql(cols);
    const values = cols.map((c) => fullCandidate[c]);

    logAttempt('executing', { attempt: i + 1, total: attemptColumnSets.length, sql, values });
    try {
      const [result] = await db.query(sql, values);
      if (i > 0) {
        logAttempt('success_after_retry', { attempt: i + 1 });
      }
      return result;
    } catch (err) {
      lastErr = err;
      logAttempt('failed', {
        attempt: i + 1,
        errno: err.errno,
        code: err.code,
        message: err.message,
        sql,
        values,
      });
      if (!shouldRetryInsert(err)) {
        throw err;
      }
    }
  }

  throw lastErr || new Error('INSERT candidate failed');
}

module.exports = {
  insertCandidateRow,
};
