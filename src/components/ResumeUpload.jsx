import { useEffect, useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { getJobs, postResumeUpload } from '../services/api'
import Button from './ui/Button'
import Card from './ui/Card'

/**
 * Simple resume uploader: picks a PDF/DOCX, sends it as multipart/form-data
 * to POST /api/upload (field name: "resume"), shows loading and feedback.
 */
export default function ResumeUpload({ onUploadSuccess }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobs, setJobs] = useState([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [success, setSuccess] = useState(null)
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
    setSuccess(null)
    setError(null)
  }

  const handleFileChange = (event) => {
    const next = event.target.files?.[0] || null
    setFile(next)
    resetMessages()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    resetMessages()

    if (!file) {
      setError('Please select a PDF or DOCX file first.')
      return
    }
    if (!selectedJobId) {
      setError('Please select an open job for this candidate.')
      return
    }

    const formData = new FormData()
    // Must match multer's upload.single('resume') on the server.
    formData.append('resume', file)
    formData.append('jobId', selectedJobId)

    setLoading(true)
    try {
      const { data } = await postResumeUpload(formData)
      setSuccess(data)
      toast.success('Resume uploaded successfully.')
      onUploadSuccess?.()
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        'Upload failed. Please try again.'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      title="Upload resume"
      subtitle="PDF or DOCX only. Files are stored on the server under /uploads."
      actions={<FileUp className="h-4 w-4 text-secondary-400" />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="job-select" className="mb-1 block text-sm font-medium text-secondary-700">
            Job role
          </label>
          <select
            id="job-select"
            value={selectedJobId}
            onChange={(event) => {
              setSelectedJobId(event.target.value)
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
            <p className="mt-2 text-sm text-secondary-600">No open jobs available.</p>
          )}
        </div>

        <div>
          <label htmlFor="resume-file" className="mb-1 block text-sm font-medium text-secondary-700">
            Choose file
          </label>
          <input
            ref={inputRef}
            id="resume-file"
            name="resume"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            disabled={loading}
            className="block w-full cursor-pointer rounded-xl border border-secondary-200 bg-white px-3 py-2 text-sm text-secondary-800 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
          />
          {file && (
            <p className="mt-2 text-small text-secondary-600">
              Selected: <span className="font-medium text-secondary-900">{file.name}</span>
            </p>
          )}
        </div>

        <Button type="submit" isLoading={loading} disabled={loading}>
          Upload resume
        </Button>

        {success && (
          <div
            role="status"
            className="rounded-xl border border-success-100 bg-success-100 px-4 py-3 text-sm text-success-700"
          >
            <p className="font-medium">Upload complete</p>
            <p className="mt-1 text-secondary-700">{success.message || 'Candidate created successfully.'}</p>
            {success.candidate?.name && (
              <p className="mt-1 text-secondary-700">
                Candidate: <span className="font-medium text-secondary-900">{success.candidate.name}</span>
                {' · '}
                Match: <span className="font-medium text-secondary-900">{success.candidate.ai_match_percentage ?? 0}%</span>
              </p>
            )}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-danger-100 bg-danger-100 px-4 py-3 text-sm text-danger-700"
          >
            {error}
          </div>
        )}
      </form>
    </Card>
  )
}
