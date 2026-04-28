const { normalizeSkills } = require('./resumeParse');

/**
 * Compare parsed resume skills to a job's required skills (CSV string).
 * Returns matched/missing using original job labels when possible, plus score 0–100.
 */
function scoreResumeAgainstJob(resumeSkillLabels, jobSkillsCsv) {
  const raw = typeof jobSkillsCsv === 'string' ? jobSkillsCsv : '';
  const requiredLabels = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (requiredLabels.length === 0) {
    return {
      matchedSkills: [],
      missingSkills: [],
      score: 0,
      requiredSkills: [],
    };
  }

  const resumeNorm = new Set(normalizeSkills(resumeSkillLabels));
  const matchedSkills = [];
  const missingSkills = [];

  for (const label of requiredLabels) {
    const n = String(label).trim().toLowerCase();
    if (!n) continue;
    if (resumeNorm.has(n)) {
      matchedSkills.push(label);
    } else {
      missingSkills.push(label);
    }
  }

  const score = Math.round((matchedSkills.length / requiredLabels.length) * 100);

  return {
    matchedSkills,
    missingSkills,
    score: Math.max(0, Math.min(100, score)),
    requiredSkills: requiredLabels,
  };
}

module.exports = {
  scoreResumeAgainstJob,
};
