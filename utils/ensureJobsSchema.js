async function getJobsColumns(db) {
  const [cols] = await db.query(
    `
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'jobs'
    `,
  );
  return new Set(cols.map((r) => r.COLUMN_NAME));
}

async function addColumnIfMissing(db, names, columnName, ddlFragment) {
  if (names.has(columnName)) {
    console.log(`[schema] jobs.${columnName}: already present`);
    return;
  }
  await db.query(`ALTER TABLE jobs ADD COLUMN ${ddlFragment}`);
  names.add(columnName);
  console.log(`[schema] ALTER OK: added jobs.${columnName}`);
}

/**
 * Align jobs table with fields used by current API code.
 * Safe for existing data: only additive columns + non-destructive backfill.
 */
async function ensureJobsSchema(db) {
  try {
    const names = await getJobsColumns(db);

    await addColumnIfMissing(db, names, 'skills', 'skills TEXT NULL');
    await addColumnIfMissing(
      db,
      names,
      'min_experience',
      'min_experience INT UNSIGNED NOT NULL DEFAULT 0',
    );
    await addColumnIfMissing(
      db,
      names,
      'status',
      "status ENUM('open','closed') NOT NULL DEFAULT 'open'",
    );
    await addColumnIfMissing(db, names, 'location', 'location VARCHAR(255) NULL');
    await addColumnIfMissing(db, names, 'salary', 'salary VARCHAR(120) NULL');
    await addColumnIfMissing(db, names, 'created_by', 'created_by INT UNSIGNED NULL');

    if (names.has('required_skills')) {
      await db.query(
        `
        UPDATE jobs
        SET skills = required_skills
        WHERE (skills IS NULL OR skills = '')
          AND required_skills IS NOT NULL
          AND required_skills <> ''
        `,
      );
      console.log('[schema] jobs.skills: backfilled from legacy required_skills');
    }
  } catch (err) {
    if (err.errno === 1146 || err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[schema] jobs table missing; skip jobs schema ensure.');
      return;
    }
    console.error('[schema] ensureJobsSchema failed:', err.errno, err.code, err.message);
  }
}

module.exports = { ensureJobsSchema };
