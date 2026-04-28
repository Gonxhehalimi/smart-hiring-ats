/**
 * Align `candidates` with resume upload at startup.
 * Logs clearly; surfaces failures that block inserts (missing columns / NOT NULL job_id).
 */

async function fetchCandidateColumnMap(db) {
  const [rows] = await db.query(
    `
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'candidates'
    ORDER BY ORDINAL_POSITION
    `,
  );
  const map = new Map();
  for (const r of rows) {
    map.set(r.COLUMN_NAME, r);
  }
  return map;
}

async function fetchCandidateForeignKeys(db) {
  const [rows] = await db.query(
    `
    SELECT
      k.CONSTRAINT_NAME,
      k.COLUMN_NAME,
      k.REFERENCED_TABLE_NAME,
      k.REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE k
    WHERE k.TABLE_SCHEMA = DATABASE()
      AND k.TABLE_NAME = 'candidates'
      AND k.REFERENCED_TABLE_NAME IS NOT NULL
    `,
  );
  return rows;
}

function logSnapshot(label, colMap, fks) {
  const names = [...colMap.keys()].join(', ') || '(none)';
  console.log(`[schema] ${label} — columns (${colMap.size}): ${names}`);
  if (fks.length) {
    const fkStr = fks
      .map(
        (f) =>
          `${f.CONSTRAINT_NAME}: ${f.COLUMN_NAME} → ${f.REFERENCED_TABLE_NAME}.${f.REFERENCED_COLUMN_NAME}`,
      )
      .join('; ');
    console.log(`[schema] ${label} — foreign keys: ${fkStr}`);
  } else {
    console.log(`[schema] ${label} — foreign keys: (none)`);
  }

  const parsed = colMap.get('parsed_skills');
  if (parsed) {
    console.log(
      `[schema] ${label} — parsed_skills: OK (${parsed.DATA_TYPE}, nullable=${parsed.IS_NULLABLE})`,
    );
  } else {
    console.error(`[schema] ${label} — parsed_skills: MISSING`);
  }
  const match = colMap.get('ai_match_percentage');
  if (match) {
    console.log(
      `[schema] ${label} — ai_match_percentage: OK (${match.DATA_TYPE}, nullable=${match.IS_NULLABLE})`,
    );
  } else {
    console.error(`[schema] ${label} — ai_match_percentage: MISSING`);
  }
  const status = colMap.get('status');
  if (status) {
    console.log(
      `[schema] ${label} — status: OK (${status.DATA_TYPE}, nullable=${status.IS_NULLABLE})`,
    );
  } else {
    console.error(`[schema] ${label} — status: MISSING`);
  }

  const job = colMap.get('job_id');
  if (!job) {
    console.log(`[schema] ${label} — job_id: column absent (inserts omit job_id — OK)`);
  } else {
    console.log(
      `[schema] ${label} — job_id: nullable=${job.IS_NULLABLE} type=${job.DATA_TYPE}`,
    );
    if (job.IS_NULLABLE !== 'YES') {
      console.error(
        `[schema] ${label} — job_id: NOT NULL — standalone uploads may fail until ALTER succeeds`,
      );
    }
  }

  const resumePath = colMap.get('resume_path');
  const resume = colMap.get('resume');
  if (resumePath) {
    console.log(`[schema] ${label} — resume_path: OK`);
  } else if (resume) {
    console.log(`[schema] ${label} — resume column: legacy "resume" only (insert fallbacks will use it)`);
  } else {
    console.error(`[schema] ${label} — neither resume_path nor resume column found`);
  }
}

async function ensureParsedSkills(db) {
  try {
    await db.query(
      'ALTER TABLE candidates ADD COLUMN parsed_skills TEXT NULL',
    );
    console.log('[schema] ALTER OK: added candidates.parsed_skills');
  } catch (err) {
    if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
      console.log('[schema] parsed_skills: already present (skip ADD)');
      return;
    }
    if (err.errno === 1146 || err.code === 'ER_NO_SUCH_TABLE') {
      console.error('[schema] parsed_skills: candidates table missing —', err.message);
      return;
    }
    console.error(
      '[schema] parsed_skills: ADD COLUMN failed —',
      err.errno,
      err.code,
      err.message,
    );
  }
}

async function ensureMatchPercentage(db) {
  try {
    await db.query(
      'ALTER TABLE candidates ADD COLUMN ai_match_percentage INT NOT NULL DEFAULT 0',
    );
    console.log('[schema] ALTER OK: added candidates.ai_match_percentage');
  } catch (err) {
    if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
      console.log('[schema] ai_match_percentage: already present (skip ADD)');
      return;
    }
    if (err.errno === 1146 || err.code === 'ER_NO_SUCH_TABLE') {
      console.error('[schema] ai_match_percentage: candidates table missing —', err.message);
      return;
    }
    console.error(
      '[schema] ai_match_percentage: ADD COLUMN failed —',
      err.errno,
      err.code,
      err.message,
    );
  }
}

async function ensureStatusColumn(db) {
  try {
    await db.query(
      "ALTER TABLE candidates ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'new'",
    );
    console.log('[schema] ALTER OK: added candidates.status');
  } catch (err) {
    if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
      console.log('[schema] status: already present (skip ADD)');
      return;
    }
    if (err.errno === 1146 || err.code === 'ER_NO_SUCH_TABLE') {
      console.error('[schema] status: candidates table missing —', err.message);
      return;
    }
    console.error(
      '[schema] status: ADD COLUMN failed —',
      err.errno,
      err.code,
      err.message,
    );
  }
}

async function ensureResumePathColumn(db, colMap) {
  if (colMap.has('resume_path') || colMap.has('resume')) {
    return;
  }
  try {
    await db.query(
      'ALTER TABLE candidates ADD COLUMN resume_path VARCHAR(500) NULL',
    );
    console.log('[schema] ALTER OK: added candidates.resume_path');
  } catch (err) {
    console.error(
      '[schema] resume_path: ADD COLUMN failed —',
      err.errno,
      err.code,
      err.message,
    );
  }
}

async function ensureJobIdColumn(db, colMap) {
  if (colMap.has('job_id')) return;
  try {
    await db.query(
      'ALTER TABLE candidates ADD COLUMN job_id INT UNSIGNED NULL',
    );
    console.log('[schema] ALTER OK: added candidates.job_id');
  } catch (err) {
    console.error(
      '[schema] job_id: ADD COLUMN failed —',
      err.errno,
      err.code,
      err.message,
    );
    return;
  }

  try {
    await db.query('ALTER TABLE candidates ADD KEY idx_candidates_job_id (job_id)');
  } catch {}

  try {
    await db.query(
      `
      ALTER TABLE candidates
      ADD CONSTRAINT fk_candidates_job
      FOREIGN KEY (job_id) REFERENCES jobs (id)
      ON DELETE SET NULL
      ON UPDATE CASCADE
      `,
    );
    console.log('[schema] ALTER OK: added fk_candidates_job');
  } catch (err) {
    const dup =
      err.errno === 1826 ||
      err.code === 'ER_FK_DUP_NAME' ||
      /Duplicate foreign key/i.test(String(err.message));
    if (!dup) {
      console.warn('[schema] job_id FK add skipped:', err.message);
    }
  }
}

async function getJobIdFkName(db) {
  const [rows] = await db.query(
    `
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'candidates'
      AND COLUMN_NAME = 'job_id'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
    `,
  );
  return rows[0]?.CONSTRAINT_NAME || null;
}

async function ensureJobIdNullable(db, colMap) {
  if (!colMap.has('job_id')) {
    return;
  }
  const job = colMap.get('job_id');
  if (job.IS_NULLABLE === 'YES') {
    console.log('[schema] job_id: already nullable (OK)');
    return;
  }

  const fkName = await getJobIdFkName(db);
  if (fkName) {
    console.log(`[schema] job_id: foreign key present — ${fkName}`);
  } else {
    console.log('[schema] job_id: no FK on job_id (or introspection empty)');
  }

  try {
    await db.query(
      'ALTER TABLE candidates MODIFY COLUMN job_id INT UNSIGNED NULL',
    );
    console.log('[schema] ALTER OK: job_id is now NULLable');
    return;
  } catch (err) {
    console.warn(
      '[schema] job_id: MODIFY in-place failed, trying DROP FK + MODIFY —',
      err.errno,
      err.message,
    );
  }

  try {
    if (fkName) {
      const safe = String(fkName).replace(/`/g, '');
      await db.query(
        `ALTER TABLE candidates DROP FOREIGN KEY \`${safe}\``,
      );
      console.log(`[schema] ALTER OK: dropped FK ${safe}`);
    }
    await db.query(
      'ALTER TABLE candidates MODIFY COLUMN job_id INT UNSIGNED NULL',
    );
    try {
      await db.query(
        `
        ALTER TABLE candidates
        ADD CONSTRAINT fk_candidates_job
        FOREIGN KEY (job_id) REFERENCES jobs (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
        `,
      );
      console.log('[schema] ALTER OK: recreated fk_candidates_job (ON DELETE SET NULL)');
    } catch (addErr) {
      const dup =
        addErr.errno === 1826 ||
        addErr.code === 'ER_FK_DUP_NAME' ||
        /Duplicate foreign key/i.test(String(addErr.message));
      if (!dup) {
        console.error(
          '[schema] job_id: recreate FK failed —',
          addErr.errno,
          addErr.message,
        );
      } else {
        console.log('[schema] job_id: FK already exists (skip recreate)');
      }
    }
    console.log('[schema] ALTER OK: job_id NULLable after FK path');
  } catch (err) {
    if (err.errno === 1146 || err.code === 'ER_NO_SUCH_TABLE') {
      return;
    }
    console.error(
      '[schema] job_id: could not make nullable —',
      err.errno,
      err.code,
      err.message,
    );
  }
}

function finalValidation(colMap) {
  const issues = [];
  if (!colMap.has('parsed_skills')) {
    issues.push('parsed_skills still missing (grant ALTER or run migrations/006)');
  }
  if (!colMap.has('ai_match_percentage')) {
    issues.push('ai_match_percentage still missing (grant ALTER)');
  }
  if (!colMap.has('status')) {
    issues.push('status still missing (grant ALTER)');
  }
  if (colMap.has('job_id') && colMap.get('job_id').IS_NULLABLE !== 'YES') {
    issues.push('job_id still NOT NULL (grant ALTER or run migrations/003)');
  }
  if (!colMap.has('resume_path') && !colMap.has('resume')) {
    issues.push('no resume_path or resume column');
  }
  if (issues.length) {
    console.error('[schema] Post-check FAILED:', issues.join(' | '));
  } else {
    console.log('[schema] Post-check OK: candidates table compatible with upload inserts');
  }
}

async function ensureCandidateSchema(db) {
  let colMap;
  let fks;
  try {
    colMap = await fetchCandidateColumnMap(db);
    fks = await fetchCandidateForeignKeys(db);
  } catch (e) {
    console.error('[schema] Introspection failed:', e.message);
    return;
  }

  if (colMap.size === 0) {
    console.error(
      '[schema] No `candidates` table in current database — create schema (migrations/001) first.',
    );
    return;
  }

  logSnapshot('before fixes', colMap, fks);

  await ensureResumePathColumn(db, colMap);
  colMap = await fetchCandidateColumnMap(db);

  await ensureJobIdColumn(db, colMap);
  colMap = await fetchCandidateColumnMap(db);

  await ensureParsedSkills(db);
  colMap = await fetchCandidateColumnMap(db);

  await ensureMatchPercentage(db);
  colMap = await fetchCandidateColumnMap(db);

  await ensureStatusColumn(db);
  colMap = await fetchCandidateColumnMap(db);

  await ensureJobIdNullable(db, colMap);
  colMap = await fetchCandidateColumnMap(db);
  fks = await fetchCandidateForeignKeys(db);

  logSnapshot('after fixes', colMap, fks);
  finalValidation(colMap);
}

module.exports = {
  ensureCandidateSchema,
};
