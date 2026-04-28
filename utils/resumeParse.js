/**
 * Lightweight, rule-based "AI" resume parsing: plain text + regex + keyword scan.
 * No external APIs — suitable for a student ATS project.
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/** Skills we look for in the raw text (case-insensitive). */
const SKILL_PATTERNS = [
  { re: /javascript/gi, label: 'JavaScript' },
  { re: /python/gi, label: 'Python' },
  { re: /\bjava\b/gi, label: 'Java' },
  { re: /react/gi, label: 'React' },
  { re: /node\.?js?/gi, label: 'Node' },
  { re: /express/gi, label: 'Express' },
  { re: /\bsql\b/gi, label: 'SQL' },
  { re: /\bhtml\b/gi, label: 'HTML' },
  { re: /\bcss\b/gi, label: 'CSS' },
  { re: /\baws\b/gi, label: 'AWS' },
];

const SKIP_NAME_LINE = /^(resume|cv|curriculum|vitae|phone|email|objective|summary|experience|education|skills|projects|www\.|http)/i;

function extractEmail(text) {
  const m = text.match(EMAIL_REGEX);
  return m ? m[0].trim() : '';
}

function extractNameFromLines(lines) {
  for (const line of lines) {
    const t = line.trim().replace(/\s+/g, ' ');
    if (t.length < 2 || t.length > 120) continue;
    if (SKIP_NAME_LINE.test(t)) continue;
    if (EMAIL_REGEX.test(t)) continue;
    if (/^[\d\s\-+().]{8,}$/.test(t)) continue;
    if (/^[•\-*]\s/.test(t)) continue;
    return t.slice(0, 120);
  }
  return null;
}

function extractSkills(text) {
  const seen = new Set();
  const skills = [];
  for (const { re, label } of SKILL_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text) && !seen.has(label)) {
      seen.add(label);
      skills.push(label);
    }
  }
  return skills;
}

function normalizeSkills(skillsInput) {
  if (!skillsInput) return [];

  let values = [];
  if (Array.isArray(skillsInput)) {
    values = skillsInput;
  } else if (typeof skillsInput === 'string') {
    const raw = skillsInput.trim();
    if (!raw) return [];
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        values = Array.isArray(parsed) ? parsed : [];
      } catch {
        values = raw.split(',');
      }
    } else {
      values = raw.split(',');
    }
  } else {
    return [];
  }

  const normalized = values
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(normalized)];
}

function extractJobSkills(jobText) {
  const normalizedFromText = normalizeSkills(jobText);
  if (normalizedFromText.length > 0) {
    return normalizedFromText;
  }
  const text = typeof jobText === 'string' ? jobText : '';
  return normalizeSkills(extractSkills(text));
}

function calculateMatchPercentage(candidateSkills, jobSkills) {
  const resumeSkills = normalizeSkills(candidateSkills);
  const requiredSkills = normalizeSkills(jobSkills);
  if (requiredSkills.length === 0) return 0;
  const matchedSkills = resumeSkills.filter((skill) => requiredSkills.includes(skill));
  return Math.max(0, Math.min(100, Math.round((matchedSkills.length / requiredSkills.length) * 100)));
}

/**
 * @param {string} rawText - full PDF text (may be messy)
 * @returns {{ name: string, email: string, skills: string[] }}
 */
function parseResumeText(rawText) {
  const text = typeof rawText === 'string' ? rawText : '';
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  const email = extractEmail(text);
  let name = extractNameFromLines(lines);

  if (!name) {
    const upperLine = lines.find((l) => {
      const t = l.trim();
      if (t.length < 3 || t.length > 120) return false;
      const letters = t.replace(/[^a-zA-Z]/g, '');
      if (letters.length < 3) return false;
      const upperRatio = letters.replace(/[^A-Z]/g, '').length / letters.length;
      return upperRatio > 0.55;
    });
    if (upperLine) name = upperLine.trim().slice(0, 120);
  }

  const skills = extractSkills(text);

  return {
    name: name || 'Unknown Candidate',
    email: email || '',
    skills,
  };
}

module.exports = {
  parseResumeText,
  normalizeSkills,
  extractJobSkills,
  calculateMatchPercentage,
  EMAIL_REGEX,
};
