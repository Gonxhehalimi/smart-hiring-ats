import { FileText, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import { getJobById, postResumeUpload } from '../services/api'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import useAuth from '../hooks/useAuth'

const sortOptions = {
  score: 'Sort by Score',
  date: 'Sort by Date',
  status: 'Sort by Status',
}

const statusFilters = ['all', 'shortlisted', 'interview', 'rejected']
const editableStatuses = ['applied', 'shortlisted', 'interview', 'rejected']

const getScoreBadge = (score) => {
  if (score >= 70) return 'bg-success-100 text-success-700'
  if (score >= 50) return 'bg-primary-100 text-primary-700'
  return 'bg-danger-100 text-danger-700'
}

const getDisplayScore = (candidate) => {
  const aiScore = candidate?.aiScore
  if (aiScore != null && Number.isFinite(Number(aiScore))) return Number(aiScore)

  const match = candidate?.aiMatchPercentage
  if (match != null && Number.isFinite(Number(match))) return Number(match)

  return null
}

const toTimestamp = (date) => new Date(date).getTime()

const sortSelectOptions = Object.entries(sortOptions).map(([value, label]) => ({
  value,
  label,
}))

export default function JobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isHR } = useAuth()
  const [job, setJob] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('score')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    name: '',
    email: '',
    phone: '',
    file: null,
  })

  const loadJob = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const { data } = await getJobById(id)
      setJob(data?.job || null)
      setCandidates(Array.isArray(data?.candidates) ? data.candidates : [])
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load job details.')
      setJob(null)
      setCandidates([])
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadJob()
  }, [id])

  const filteredCandidates = useMemo(() => {
    const filtered = candidates.filter((candidate) =>
      statusFilter === 'all' ? true : candidate.status === statusFilter,
    )

    const sorted = [...filtered]

    if (sortBy === 'score') {
      sorted.sort((a, b) => Number(getDisplayScore(b) ?? 0) - Number(getDisplayScore(a) ?? 0))
    } else if (sortBy === 'date') {
      sorted.sort(
        (a, b) =>
          toTimestamp(b.createdAt || b.created_at || b.uploaded_at) -
          toTimestamp(a.createdAt || a.created_at || a.uploaded_at),
      )
    } else if (sortBy === 'status') {
      sorted.sort((a, b) => a.status.localeCompare(b.status))
    }

    return sorted
  }, [candidates, sortBy, statusFilter])

  const handleStatusChange = (candidateId, nextStatus) => {
    const candidate = candidates.find((item) => item.id === candidateId)

    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.id === candidateId ? { ...candidate, status: nextStatus } : candidate,
      ),
    )

    if (candidate) {
      toast.success(`${candidate.name} moved to ${nextStatus}.`)
    }
  }

  const handleFileSelection = (file) => {
    if (!file) return
    const isAllowed = /\.(pdf|docx)$/i.test(file.name)
    if (!isAllowed) {
      toast.error('Please upload a PDF or DOCX file.')
      return
    }
    setUploadForm((prev) => ({ ...prev, file }))
  }

  const resetModal = () => {
    setUploadForm({
      name: '',
      email: '',
      phone: '',
      file: null,
    })
    setIsModalOpen(false)
    setIsUploading(false)
  }

  const handleUploadSubmit = async (event) => {
    event.preventDefault()

    if (!uploadForm.file) {
      toast.error('Please select a resume file first.')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('resume', uploadForm.file)
      formData.append('jobId', id)
      if (uploadForm.name.trim()) formData.append('name', uploadForm.name.trim())
      if (uploadForm.email.trim()) formData.append('email', uploadForm.email.trim())
      if (uploadForm.phone.trim()) formData.append('phone', uploadForm.phone.trim())

      const { data } = await postResumeUpload(formData)
      const match = data?.candidate?.ai_match_percentage
      toast.success(
        match != null ? `Resume uploaded! Match ${match}%` : 'Resume uploaded successfully.',
      )
      await loadJob({ silent: true })
      resetModal()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Upload failed. Please try again.')
      setIsUploading(false)
    }
  }

  const skills = String(job?.skills || '')
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean)

  return (
    <Layout title="Job Detail">
      <div className="page-shell space-y-6">
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-small uppercase tracking-wide">
                Job ID: #{id}
              </p>
              <h1 className="mt-1 text-heading">{job?.title || (loading ? 'Loading job...' : 'Job')}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={job?.status === 'open' ? 'shortlisted' : 'review'} className="capitalize">
                {job?.status || 'unknown'}
              </Badge>
              {isHR && (
                <Button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  size="sm"
                >
                  <Upload className="h-4 w-4" />
                  Upload Resume
                </Button>
              )}
            </div>
          </div>

          <p className="mt-4 text-body leading-relaxed">{job?.description || 'No description provided.'}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-secondary-100 px-2.5 py-1 text-xs font-medium text-secondary-700"
              >
                {skill}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-secondary-700">
            <p>
              <span className="font-medium text-secondary-900">{Number(job?.min_experience || 0)}+ years</span>{' '}
              experience required
            </p>
            <p>
              Created by <span className="font-medium text-secondary-900">{job?.created_by_name || '—'}</span>{' '}
              on {job?.created_at ? String(job.created_at).slice(0, 10) : '—'}
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-subheading">
              Candidates ({candidates.length})
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <Input
                as="select"
                id="sortBy"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                options={sortSelectOptions}
                className="min-w-[180px]"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {statusFilters.map((filter) => {
              const isActive = statusFilter === filter
              return (
                <Button
                  key={filter}
                  type="button"
                  size="sm"
                  variant={isActive ? 'primary' : 'secondary'}
                  onClick={() => setStatusFilter(filter)}
                  className="capitalize"
                >
                  {filter}
                </Button>
              )
            })}
          </div>

          {filteredCandidates.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={FileText}
                title="No candidates yet"
                description="Upload resumes to start screening and ranking candidates for this role."
              />
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-secondary-200 text-xs uppercase tracking-wide text-secondary-500">
                    <th className="px-3 py-3 font-medium">Rank (#)</th>
                    <th className="px-3 py-3 font-medium">Name</th>
                    <th className="px-3 py-3 font-medium">Email</th>
                    <th className="px-3 py-3 font-medium">AI Score</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate, index) => (
                    (() => {
                      const displayScore = getDisplayScore(candidate)
                      const badgeScore = Number(displayScore ?? 0)
                      return (
                    <tr key={candidate.id} className="border-b border-secondary-100">
                      <td className="px-3 py-3 text-sm font-medium text-secondary-700">{index + 1}</td>
                      <td className="px-3 py-3 text-sm font-medium text-secondary-900">{candidate.name}</td>
                      <td className="px-3 py-3 text-sm text-secondary-700">{candidate.email}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getScoreBadge(badgeScore)}`}
                        >
                          {displayScore == null ? 'Not scored' : displayScore}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={candidate.status}
                          onChange={(event) =>
                            handleStatusChange(candidate.id, event.target.value)
                          }
                          className="rounded-md border border-secondary-300 px-2 py-1 text-sm capitalize text-secondary-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                        >
                          {editableStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary-700">
                        {String(candidate.createdAt || candidate.created_at || candidate.uploaded_at || '').slice(0, 10)}
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/candidates/${candidate.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                      )
                    })()
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <Card className="w-full max-w-lg p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-subheading text-secondary-900">Upload Resume</h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={resetModal}
                className="h-8 w-8 border-0 bg-transparent p-0 text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700"
                aria-label="Close upload modal"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form className="space-y-4" onSubmit={handleUploadSubmit}>
              <Input
                id="candidateName"
                label="Candidate Name"
                type="text"
                value={uploadForm.name}
                onChange={(event) =>
                  setUploadForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />

              <Input
                id="candidateEmail"
                label="Candidate Email"
                type="email"
                value={uploadForm.email}
                onChange={(event) =>
                  setUploadForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />

              <Input
                id="candidatePhone"
                label="Phone"
                type="text"
                value={uploadForm.phone}
                onChange={(event) =>
                  setUploadForm((prev) => ({ ...prev, phone: event.target.value }))
                }
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-secondary-700">Resume File</label>
                <label
                  htmlFor="resume-file"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    const droppedFile = event.dataTransfer.files?.[0]
                    handleFileSelection(droppedFile)
                  }}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-secondary-300 p-6 text-center transition hover:border-primary-400 hover:bg-primary-50/40"
                >
                  <FileText className="h-8 w-8 text-secondary-400" />
                  <p className="mt-2 text-body">
                    Drag PDF or DOCX here, or click to browse
                  </p>
                  {uploadForm.file && (
                    <p className="mt-2 text-xs font-medium text-primary-700">
                      Selected: {uploadForm.file.name}
                    </p>
                  )}
                </label>
                <input
                  id="resume-file"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(event) => handleFileSelection(event.target.files?.[0])}
                  className="hidden"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                isLoading={isUploading}
              >
                Upload & Analyze
              </Button>
            </form>
          </Card>
        </div>
      )}
    </Layout>
  )
}
