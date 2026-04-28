import { Briefcase, CalendarDays, CheckCircle2, Download, FileText, Mail, MessageSquareText, Phone, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'

const mockCandidate = {
  id: 1,
  name: 'Sarah Johnson',
  email: 'sarah@email.com',
  phone: '+1 555-0123',
  ai_score: 91,
  status: 'shortlisted',
  job_title: 'Frontend Developer',
  uploaded_at: '2025-03-02',
  ai_details: {
    matched_skills: ['React', 'JavaScript', 'Tailwind CSS', 'Git'],
    missing_skills: ['TypeScript'],
    detected_experience_years: 3,
    required_experience_years: 2,
    match_percentage: 80,
  },
}

const mockNotes = [
  {
    id: 1,
    author_name: 'Alice HR',
    note: 'Strong portfolio, great React projects on GitHub.',
    created_at: '2025-03-03 10:30',
  },
  {
    id: 2,
    author_name: 'Bob Manager',
    note: 'Phone screen went well. Schedule technical interview.',
    created_at: '2025-03-04 14:15',
  },
]

const tabs = ['resume', 'notes', 'activity']

const getScoreTone = (score) => {
  if (score >= 70) return 'text-success-700'
  if (score >= 50) return 'text-primary-600'
  return 'text-danger-600'
}

const statusBadgeVariant = (status) => {
  if (status === 'shortlisted' || status === 'hired') return 'shortlisted'
  if (status === 'rejected') return 'rejected'
  return 'review'
}

export default function CandidateDetailPage() {
  const { id } = useParams()
  const [status, setStatus] = useState(mockCandidate.status)
  const [notes, setNotes] = useState(mockNotes)
  const [newNote, setNewNote] = useState('')
  const [activeTab, setActiveTab] = useState('resume')
  const [noteError, setNoteError] = useState('')

  const scoreTone = getScoreTone(mockCandidate.ai_score)

  const scoreCircle = useMemo(() => {
    const radius = 52
    const circumference = 2 * Math.PI * radius
    const percentage = Math.max(0, Math.min(mockCandidate.ai_score, 100))
    const offset = circumference - (percentage / 100) * circumference
    return { radius, circumference, offset }
  }, [])

  const experienceProgress = Math.min(
    100,
    Math.round(
      (mockCandidate.ai_details.detected_experience_years /
        Math.max(mockCandidate.ai_details.required_experience_years, 1)) *
        100,
    ),
  )

  const handleAddNote = (event) => {
    event.preventDefault()
    if (!newNote.trim()) {
      setNoteError('Please write a note before saving.')
      return
    }

    // TODO: call addNote(candidateId, note) from api.js
    const nextNote = {
      id: Date.now(),
      author_name: 'You',
      note: newNote.trim(),
      created_at: new Date().toLocaleString(),
    }
    setNotes((prev) => [nextNote, ...prev])
    setNewNote('')
    setNoteError('')
  }

  return (
    <Layout title="Candidate Detail">
      <div className="page-shell grid grid-cols-1 gap-6 xl:grid-cols-12">
        <aside className="space-y-6 xl:col-span-4">
          <Card
            title={mockCandidate.name}
            subtitle={`Candidate #${id}`}
            actions={
              <Badge variant={statusBadgeVariant(status)} className="capitalize">
                {status}
              </Badge>
            }
          >
            <div className="space-y-4">
              <div className="flex items-center justify-center rounded-2xl bg-secondary-50 py-5">
                <div className="flex flex-col items-center">
                  <svg className="h-40 w-40" viewBox="0 0 140 140" aria-label="AI score">
                    <circle cx="70" cy="70" r={scoreCircle.radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
                    <circle
                      cx="70"
                      cy="70"
                      r={scoreCircle.radius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={scoreCircle.circumference}
                      strokeDashoffset={scoreCircle.offset}
                      className={scoreTone}
                      transform="rotate(-90 70 70)"
                    />
                    <text x="70" y="68" textAnchor="middle" className="fill-secondary-900 text-2xl font-semibold">
                      {mockCandidate.ai_score}
                    </text>
                    <text x="70" y="87" textAnchor="middle" className="fill-secondary-500 text-xs">
                      AI Score
                    </text>
                  </svg>
                  <p className="text-small">Top candidate fit for this role</p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-secondary-700">
                <p className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-secondary-500" />
                  {mockCandidate.email}
                </p>
                <p className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-secondary-500" />
                  {mockCandidate.phone}
                </p>
                <p className="inline-flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-secondary-500" />
                  <Link to="/jobs/1" className="font-medium text-primary-600 hover:text-primary-700">
                    {mockCandidate.job_title}
                  </Link>
                </p>
                <p className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-secondary-500" />
                  Uploaded on {mockCandidate.uploaded_at}
                </p>
              </div>

              <Input
                as="select"
                id="status"
                label="Update status"
                value={status}
                onChange={(event) => {
                  const nextStatus = event.target.value
                  setStatus(nextStatus)
                  toast.success(`Candidate status updated to ${nextStatus}.`)
                }}
                className="capitalize"
                options={[
                  { value: 'applied', label: 'Applied' },
                  { value: 'shortlisted', label: 'Shortlisted' },
                  { value: 'interview', label: 'Interview' },
                  { value: 'hired', label: 'Hired' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
              />

              <Button type="button" variant="secondary" className="w-full" disabled>
                <Download className="h-4 w-4" />
                Download Resume
              </Button>
            </div>
          </Card>
        </aside>

        <section className="space-y-5 xl:col-span-8">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-secondary-200 bg-white p-2 shadow-soft">
            {tabs.map((tab) => (
              <Button
                key={tab}
                type="button"
                variant={activeTab === tab ? 'primary' : 'secondary'}
                size="sm"
                className="capitalize"
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </Button>
            ))}
          </div>

          {activeTab === 'resume' && (
            <div className="space-y-5">
              <Card title="Resume Snapshot" subtitle="AI-generated highlights from the uploaded resume">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-secondary-700">Matched Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {mockCandidate.ai_details.matched_skills.map((skill) => (
                        <Badge key={skill} variant="shortlisted">
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {skill}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-secondary-700">Missing Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {mockCandidate.ai_details.missing_skills.map((skill) => (
                        <Badge key={skill} variant="rejected">
                          <span className="inline-flex items-center gap-1">
                            <X className="h-3.5 w-3.5" />
                            {skill}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Match Insights" subtitle="Role fit based on experience and keyword relevance">
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm text-secondary-700">
                      <span>Overall Match</span>
                      <span className="font-semibold text-secondary-900">
                        {mockCandidate.ai_details.match_percentage}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-secondary-200">
                      <div
                        className="h-2.5 rounded-full bg-primary-600"
                        style={{ width: `${mockCandidate.ai_details.match_percentage}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm text-secondary-700">
                      <span>Experience Coverage</span>
                      <span className="font-semibold text-secondary-900">{experienceProgress}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-secondary-200">
                      <div className="h-2.5 rounded-full bg-success-700" style={{ width: `${experienceProgress}%` }} />
                    </div>
                    <p className="mt-2 text-small">
                      Detected {mockCandidate.ai_details.detected_experience_years} years vs required{' '}
                      {mockCandidate.ai_details.required_experience_years} years.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'notes' && (
            <Card title="Interview Notes" subtitle="Team feedback and recruiter observations">
              {notes.length === 0 ? (
                <EmptyState
                  icon={MessageSquareText}
                  title="No notes"
                  description="Add recruiter notes to keep feedback visible for the whole hiring team."
                />
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <article key={note.id} className="rounded-xl border border-secondary-200 bg-secondary-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-secondary-900">{note.author_name}</p>
                        <p className="text-small">{note.created_at}</p>
                      </div>
                      <p className="mt-2 text-sm text-secondary-700">{note.note}</p>
                    </article>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddNote} className="mt-5 space-y-3 border-t border-secondary-200 pt-5">
                <Input
                  as="textarea"
                  id="newNote"
                  label="Add note"
                  rows={4}
                  placeholder="Add interview feedback, concerns, or next steps..."
                  value={newNote}
                  onChange={(event) => {
                    setNewNote(event.target.value)
                    setNoteError('')
                  }}
                  error={noteError}
                />
                <Button type="submit">Add Note</Button>
              </form>
            </Card>
          )}

          {activeTab === 'activity' && (
            <Card title="Activity Timeline" subtitle="Recent candidate progression and touchpoints">
              <div className="space-y-4">
                {[
                  { title: 'Application received', time: '2025-03-02 09:10', tone: 'review' },
                  { title: 'AI screening completed', time: '2025-03-02 10:00', tone: 'shortlisted' },
                  { title: 'Shortlisted by recruiter', time: '2025-03-03 11:24', tone: 'shortlisted' },
                  { title: 'Phone interview scheduled', time: '2025-03-04 14:15', tone: 'review' },
                ].map((event) => (
                  <div
                    key={event.title}
                    className="flex items-start justify-between gap-4 rounded-xl border border-secondary-200 p-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-secondary-900">{event.title}</p>
                      <p className="text-small">{event.time}</p>
                    </div>
                    <Badge variant={event.tone}>Logged</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>
      </div>
    </Layout>
  )
}
