import { useEffect, useRef, useState } from 'react'
import { FileSearch, Sparkles } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { analyzeResume, getJobs } from '../services/api'
import Button from './ui/Button'
import Card from './ui/Card'
import Badge from './ui/Badge'

/**
 * AI pipeline demo: POST /api/analyze → Python parser → score vs selected job.
 */
export default function ResumeAnalyze() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobs, setJobs] = useState([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadJobs() {
      setJobsLoading(true)
      try {
        const { data } = await getJobs()
        if (cancelled) return
        setJobs(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setJobs([])
      } finally {
        if (!cancelled) setJobsLoading(false)
      }
    }

    loadJobs()
    const onWindowFocus = () => {
      loadJobs()
    }
    window.addEventListener('focus', onWindowFocus)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onWindowFocus)
    }
  }, [])

  const resetMessages = () => {
    setResult(null)
    setError(null)
  }

  const handleAnalyze = async (event) => {
    event.preventDefault()
    resetMessages()

    if (!file) {
      setError('Choose a resume file (PDF, DOCX, or TXT).')
      return
    }
    if (!selectedJobId) {
      setError('Select an open job to score against.')
      return
    }

    const formData = new FormData()
    formData.append('resume', file)
    formData.append('jobId', selectedJobId)

    setLoading(true)
    try {
      const { data } = await analyzeResume(formData)
      setResult(data)
      toast.success('Analysis complete.')
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.message ||
        'Analysis failed.'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const score = result?.score ?? 0

  return (
    <Card
      title="AI resume analysis"
      subtitle="Parse with Python, then score skills against the selected job (demo-ready)."
      actions={<Sparkles className="h-4 w-4 text-secondary-400" />}
    >
      <form onSubmit={handleAnalyze} className="space-y-4">
        <div>
          <label htmlFor="analyze-job" className="mb-1 block text-sm font-medium text-secondary-700">
            Job (open only)
          </label>
          <select
            id="analyze-job"
            value={selectedJobId}
            onChange={(e) => {
              setSelectedJobId(e.target.value)
              resetMessages()
            }}
            disabled={loading || jobsLoading}
            className="block w-full rounded-xl border border-secondary-200 bg-white px-3 py-2 text-sm text-secondary-800"
          >
            <option value="">Select a job</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
          {jobsLoading && (
            <p className="mt-2 text-sm text-secondary-600">Loading open jobs...</p>
          )}
          {!jobsLoading && jobs.length === 0 && (
            <p className="mt-2 text-sm text-secondary-600">No open jobs available. Create a job first.</p>
          )}
        </div>

        <div>
          <label htmlFor="analyze-file" className="mb-1 block text-sm font-medium text-secondary-700">
            Resume file
          </label>
          <input
            ref={inputRef}
            id="analyze-file"
            name="resume"
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null)
              resetMessages()
            }}
            disabled={loading}
            className="block w-full cursor-pointer rounded-xl border border-secondary-200 bg-white px-3 py-2 text-sm text-secondary-800 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
          />
          {file && (
            <p className="mt-2 text-sm text-secondary-600">
              Selected: <span className="font-medium text-secondary-900">{file.name}</span>
            </p>
          )}
        </div>

        <Button type="submit" isLoading={loading} disabled={loading} variant="secondary">
          <FileSearch className="mr-2 h-4 w-4" />
          Analyze resume
        </Button>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-danger-100 bg-danger-100 px-4 py-3 text-sm text-danger-700"
          >
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4 rounded-xl border border-secondary-200 bg-secondary-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-secondary-500">Match score</p>
                <p className="text-lg font-semibold text-secondary-900">
                  {result.jobTitle ? `${result.jobTitle}` : 'Job'}{' '}
                  <span className="text-secondary-500">·</span>{' '}
                  <span className="text-primary-700">{score}%</span>
                </p>
              </div>
              <div className="h-3 w-full max-w-xs overflow-hidden rounded-full bg-secondary-200">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary-500">
                Parsed skills
              </p>
              <div className="flex flex-wrap gap-2">
                {(result.skills || []).length ? (
                  result.skills.map((s) => (
                    <Badge key={s} variant="review">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-secondary-600">None detected</span>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-success-100 bg-white p-3">
                <p className="mb-2 text-xs font-medium uppercase text-success-800">Matched</p>
                <div className="flex flex-wrap gap-2">
                  {(result.matchedSkills || []).map((s) => (
                    <Badge key={s} variant="shortlisted">
                      {s}
                    </Badge>
                  ))}
                  {!(result.matchedSkills || []).length && (
                    <span className="text-sm text-secondary-600">—</span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-danger-100 bg-white p-3">
                <p className="mb-2 text-xs font-medium uppercase text-danger-800">Missing</p>
                <div className="flex flex-wrap gap-2">
                  {(result.missingSkills || []).map((s) => (
                    <Badge key={s} variant="rejected">
                      {s}
                    </Badge>
                  ))}
                  {!(result.missingSkills || []).length && (
                    <span className="text-sm text-secondary-600">—</span>
                  )}
                </div>
              </div>
            </div>

            {result.preview && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-secondary-500">
                  Text preview
                </p>
                <p className="rounded-lg border border-secondary-200 bg-white p-3 text-sm leading-relaxed text-secondary-800">
                  {result.preview}
                  {result.preview.length >= 300 ? '…' : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </form>
    </Card>
  )
}
