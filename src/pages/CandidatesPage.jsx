import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import CandidateStatusSelect from '../components/CandidateStatusSelect'
import ResumeUpload from '../components/ResumeUpload'
import ResumeAnalyze from '../components/ResumeAnalyze'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import { cleanupLegacyCandidates, deleteCandidate, getCandidates } from '../services/api'

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'applied', label: 'Applied' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview', label: 'Interview' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'hired', label: 'Hired' },
]

const scoreBarColor = (score) => {
  if (score == null) return 'bg-secondary-300'
  if (score >= 85) return 'bg-success-700'
  if (score >= 65) return 'bg-primary-600'
  return 'bg-danger-600'
}

const scoreTextColor = (score) => {
  if (score == null) return 'text-secondary-500'
  if (score >= 85) return 'text-success-700'
  if (score >= 65) return 'text-secondary-700'
  return 'text-danger-600'
}

export default function CandidatesPage() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadCandidates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await getCandidates()
      setCandidates(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load candidates.')
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCandidates()
  }, [loadCandidates])

  const handleDeleteCandidate = async (candidate) => {
    const confirmed = window.confirm(`Delete candidate "${candidate.name}"? This cannot be undone.`)
    if (!confirmed) return
    setDeletingId(candidate.id)
    setError(null)
    try {
      await deleteCandidate(candidate.id)
      await loadCandidates()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete candidate.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCleanupLegacy = async () => {
    const confirmed = window.confirm(
      'Clean up legacy candidates with no linked job and no scores older than 21 days?',
    )
    if (!confirmed) return

    setCleanupLoading(true)
    setError(null)
    try {
      const { data: dryRun } = await cleanupLegacyCandidates({ olderThanDays: 21 })
      const count = Number(dryRun?.wouldDeleteCount || 0)
      if (count <= 0) {
        setError('No legacy candidates found for cleanup.')
        return
      }

      const executeConfirmed = window.confirm(
        `Found ${count} legacy candidate(s). Delete them now?`,
      )
      if (!executeConfirmed) return

      await cleanupLegacyCandidates({ olderThanDays: 21, execute: true })
      await loadCandidates()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Legacy cleanup failed.')
    } finally {
      setCleanupLoading(false)
    }
  }

  const filteredCandidates = useMemo(
    () =>
      candidates.filter((candidate) => {
        const role = candidate.jobTitle || ''
        const matchesSearch =
          candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          role.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === 'all' || candidate.status === statusFilter

        return matchesSearch && matchesStatus
      }),
    [candidates, searchTerm, statusFilter],
  )

  return (
    <div className="page-shell space-y-6">
      <section className="space-y-2">
        <h1 className="text-heading">Candidates</h1>
        <p className="text-body">Review applicant performance, status, and fit at a glance.</p>
      </section>

      {error && (
        <div className="rounded-xl border border-danger-100 bg-danger-100 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ResumeUpload onUploadSuccess={loadCandidates} />
        <ResumeAnalyze />
      </div>

      <Card
        className="p-0"
        title="Candidate Pipeline"
        subtitle={
          loading
            ? 'Loading…'
            : `${filteredCandidates.length} candidate${filteredCandidates.length === 1 ? '' : 's'} shown`
        }
        actions={<UserRound className="h-4 w-4 text-secondary-400" />}
      >
        <div className="border-b border-secondary-200 px-6 py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-10 h-4 w-4 text-secondary-400" />
              <Input
                id="candidateSearch"
                label="Search"
                placeholder="Search by name or role"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>

            <Input
              as="select"
              id="statusFilter"
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              options={statusOptions}
            />

            <Button
              type="button"
              variant="secondary"
              className="h-[42px] w-full md:w-auto md:self-end"
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('all')
              }}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Reset
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-[42px] w-full md:w-auto md:self-end"
              isLoading={cleanupLoading}
              disabled={cleanupLoading}
              onClick={handleCleanupLegacy}
            >
              Cleanup legacy
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-sm text-secondary-600">Loading candidates…</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-secondary-200 text-xs uppercase tracking-wide text-secondary-500">
                    <th className="px-6 py-4 font-medium">Candidate</th>
                    <th className="px-6 py-4 font-medium">Role</th>
                    <th className="px-6 py-4 font-medium">Skills</th>
                    <th className="px-6 py-4 font-medium">Score</th>
                    <th className="px-6 py-4 font-medium">Match</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCandidates.map((candidate) => {
                    const score = candidate.aiScore == null ? null : Number(candidate.aiScore)
                    const match = candidate.aiMatchPercentage == null ? null : Number(candidate.aiMatchPercentage)
                    const scorePercent = score == null ? 0 : Math.max(0, Math.min(100, score))
                    return (
                      <tr
                        key={candidate.id}
                        className="border-b border-secondary-100 transition-colors hover:bg-secondary-50/70"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-secondary-900">{candidate.name}</td>
                        <td className="px-6 py-4 text-sm text-secondary-700">
                          {candidate.jobTitle || 'Not linked'}
                        </td>
                        <td className="max-w-[200px] px-6 py-4 text-sm text-secondary-700">
                          {Array.isArray(candidate.skills) && candidate.skills.length > 0
                            ? candidate.skills.join(', ')
                            : 'No skills parsed'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-24 rounded-full bg-secondary-200">
                              <div
                                className={`h-2 rounded-full ${scoreBarColor(score)}`}
                                style={{ width: `${scorePercent}%` }}
                              />
                            </div>
                            <span className={`text-sm font-semibold ${scoreTextColor(score)}`}>
                              {score == null ? 'Not scored' : score}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-secondary-800">
                          {match == null ? 'Not scored' : `Match: ${Math.max(0, Math.min(100, match))}%`}
                        </td>
                        <td className="px-6 py-4">
                          <CandidateStatusSelect
                            candidate={candidate}
                            onUpdated={(updated) => {
                              setCandidates((prev) =>
                                prev.map((c) => (c.id === updated.id ? updated : c)),
                              )
                            }}
                            onError={(msg) => setError(msg)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-3">
                            {candidate.resume ? (
                              <a
                                href={candidate.resume}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-primary-600 hover:text-primary-700"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View resume
                              </a>
                            ) : null}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => navigate(`/candidates/${candidate.id}`)}
                            >
                              View profile
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              isLoading={deletingId === candidate.id}
                              disabled={deletingId === candidate.id}
                              onClick={() => handleDeleteCandidate(candidate)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filteredCandidates.length === 0 && (
              <div className="px-6 py-6">
                <EmptyState
                  icon={UserRound}
                  title="No candidates yet"
                  description={
                    candidates.length === 0
                      ? 'Upload a resume above to create your first candidate.'
                      : 'No candidates match your current search and filters.'
                  }
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
