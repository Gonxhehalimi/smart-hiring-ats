const { normalizeSkills } = require('./resumeParse');
const { scoreResumeAgainstJob } = require('./skillScore');

function mapCandidateRow(row) {
  if (!row) return null;

  let skills = [];
  if (row.parsed_skills) {
    try {
      const parsed = JSON.parse(row.parsed_skills);
      skills = Array.isArray(parsed) ? parsed : [];
    } catch {
      skills = String(row.parsed_skills)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const normalizedStatus = String(row.status || '').trim().toLowerCase();
  const hasLinkedJob = row.job_id != null && String(row.jobTitle || '').trim() !== '';
  const fallbackJobTitle = hasLinkedJob ? String(row.jobTitle || '').trim() : 'Not linked';
  const parsedSkills = normalizeSkills(skills);
  const rawScore = row.ai_score != null ? Number(row.ai_score) : null;
  const rawMatch = row.ai_match_percentage != null ? Number(row.ai_match_percentage) : null;

  let normalizedMatch = Number.isFinite(rawMatch) && rawMatch >= 0 ? rawMatch : null;
  let normalizedScore = Number.isFinite(rawScore) && rawScore >= 0 ? rawScore : null;

  if (hasLinkedJob && parsedSkills.length > 0 && row.jobSkills) {
    const rescored = scoreResumeAgainstJob(parsedSkills, String(row.jobSkills || ''));
    if (rescored.requiredSkills.length > 0) {
      normalizedMatch = rescored.score;
      normalizedScore = rescored.score;
    }
  }

  if ((normalizedScore == null || normalizedScore === 0) && normalizedMatch != null) {
    normalizedScore = normalizedMatch;
  }
  if ((normalizedMatch == null || normalizedMatch === 0) && normalizedScore != null) {
    normalizedMatch = normalizedScore;
  }

  const boundedScore =
    normalizedScore == null ? null : Math.max(0, Math.min(100, Math.round(normalizedScore)));
  const boundedMatch =
    normalizedMatch == null ? null : Math.max(0, Math.min(100, Math.round(normalizedMatch)));

  return {
    id: row.id,
    name: row.name,
    email: row.email ?? '',
    resume: row.resume_path ?? row.resume ?? null,
    status: normalizedStatus || row.status,
    createdAt: row.created_at,
    jobId: row.job_id ?? null,
    jobTitle: fallbackJobTitle,
    jobSkills: row.jobSkills ?? row.job_skills ?? null,
    aiScore: boundedScore,
    aiMatchPercentage: boundedMatch,
    parsedSkills,
    skills: parsedSkills,
    hasScore: boundedScore != null,
    hasMatch: boundedMatch != null,
  };
}

module.exports = { mapCandidateRow };
