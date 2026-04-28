import { useState } from 'react'
import { putCandidate } from '../services/api'

const OPTIONS = [
  { value: 'applied', apiLabel: 'Applied' },
  { value: 'interview', apiLabel: 'Interview' },
  { value: 'hired', apiLabel: 'Hired' },
]

function selectValueFromStatus(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'applied' || s === 'interview' || s === 'hired') return s
  return 'applied'
}

/**
 * Dropdown to set candidate status via PUT /api/candidate/:id (Applied, Interview, Hired).
 */
export default function CandidateStatusSelect({ candidate, onUpdated, onError }) {
  const [saving, setSaving] = useState(false)
  const value = selectValueFromStatus(candidate.status)

  const handleChange = async (event) => {
    const next = event.target.value
    const opt = OPTIONS.find((o) => o.value === next)
    if (!opt) return

    setSaving(true)
    onError?.(null)
    try {
      const { data } = await putCandidate(candidate.id, { status: opt.apiLabel })
      onUpdated(data)
    } catch (err) {
      onError?.(err.response?.data?.message || err.message || 'Failed to update status.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <select
      className="w-full min-w-[140px] rounded-lg border border-secondary-200 bg-white px-2 py-1.5 text-sm text-secondary-900 shadow-sm disabled:opacity-60"
      value={value}
      onChange={handleChange}
      disabled={saving}
      aria-label={`Update status for ${candidate.name}`}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.apiLabel}
        </option>
      ))}
    </select>
  )
}
