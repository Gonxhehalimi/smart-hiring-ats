import { ArrowUpRight, Briefcase, Calendar, CheckCircle, Clock3, FileText, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CandidateStatusSelect from '../components/CandidateStatusSelect'
import Layout from '../components/layout/Layout'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { getCandidates } from '../services/api'

const mockStats = {
  totalJobs: 12,
  openJobs: 8,
  shortlisted: 34,
  interviews: 12,
  hired: 5,
}

const recentJobs = [
  { id: 1, title: 'Frontend Developer', candidates: 24, status: 'open', created: '2 days ago' },
  { id: 2, title: 'Data Analyst', candidates: 18, status: 'open', created: '5 days ago' },
  { id: 3, title: 'Backend Engineer', candidates: 31, status: 'open', created: '1 week ago' },
]

const statusVariantMap = {
  shortlisted: 'shortlisted',
  rejected: 'rejected',
  interview: 'review',
  applied: 'review',
  new: 'review',
  hired: 'shortlisted',
  open: 'review',
}

function formatStatusLabel(status) {
  if (!status) return '—'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function StatusBadge({ status }) {
  const key = typeof status === 'string' ? status.toLowerCase() : ''
  const variant = statusVariantMap[key] || 'review'

  return (
    <Badge variant={variant} className="capitalize">
      {formatStatusLabel(status)}
    </Badge>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data } = await getCandidates()
        if (!cancelled) {
          setCandidates(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message || 'Failed to load candidates.')
          setCandidates([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const statCards = useMemo(
    () => [
      {
        label: 'Total Jobs',
        value: mockStats.totalJobs,
        icon: Briefcase,
        iconClass: 'bg-primary-100 text-primary-700',
        change: '+12% this month',
      },
      {
        label: 'Total Candidates',
        value: loading ? '…' : candidates.length,
        icon: Users,
        iconClass: 'bg-secondary-100 text-secondary-700',
        change: loading ? 'Loading…' : 'From database',
      },
      {
        label: 'Shortlisted',
        value: mockStats.shortlisted,
        icon: CheckCircle,
        iconClass: 'bg-success-100 text-success-700',
        change: '+9% this month',
      },
      {
        label: 'Interviews Scheduled',
        value: mockStats.interviews,
        icon: Calendar,
        iconClass: 'bg-primary-100 text-primary-700',
        change: '+6% this month',
      },
    ],
    [candidates.length, loading],
  )

  return (
    <Layout title="Dashboard">
      <div className="page-shell space-y-8">
        <section className="space-y-2">
          <h1 className="text-heading">Hiring Overview</h1>
          <p className="text-body">
            Track pipeline performance, candidate quality, and active roles in one place.
          </p>
        </section>

        {error && (
          <div className="rounded-xl border border-danger-100 bg-danger-100 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon

            return (
              <Card key={card.label} className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-small">{card.label}</p>
                    <p className="text-3xl font-semibold text-secondary-900">{card.value}</p>
                  </div>
                  <div className={`rounded-xl p-2.5 ${card.iconClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-success-700">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  {card.change}
                </p>
              </Card>
            )
          })}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card
            className="p-0 xl:col-span-2"
            title="Candidates"
            subtitle={loading ? 'Loading…' : `${candidates.length} total from database`}
            actions={<Clock3 className="h-4 w-4 text-secondary-400" />}
          >
            {loading ? (
              <div className="px-6 pb-6 text-sm text-secondary-600">Loading candidates…</div>
            ) : candidates.length === 0 ? (
              <div className="px-6 pb-6">
                <EmptyState
                  icon={Users}
                  title="No candidates yet"
                  description="Upload a resume or add applicants to see them listed here."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="border-b border-secondary-200 text-xs uppercase tracking-wide text-secondary-500">
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-6 py-4 font-medium">Email</th>
                      <th className="px-6 py-4 font-medium">Skills</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Resume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((candidate) => (
                      <tr
                        key={candidate.id}
                        className="border-b border-secondary-100 transition-colors hover:bg-secondary-50/70"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-secondary-900">{candidate.name}</td>
                        <td className="px-6 py-4 text-sm text-secondary-700">
                          {candidate.email || '—'}
                        </td>
                        <td className="max-w-[160px] truncate px-6 py-4 text-xs text-secondary-600">
                          {Array.isArray(candidate.skills) && candidate.skills.length > 0
                            ? candidate.skills.join(', ')
                            : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <CandidateStatusSelect
                            candidate={candidate}
                            onUpdated={(updated) => {
                              setCandidates((prev) =>
                                prev.map((c) => (c.id === updated.id ? updated : c)),
                              )
                            }}
                            onError={setError}
                          />
                        </td>
                        <td className="px-6 py-4">
                          {candidate.resume ? (
                            <a
                              href={candidate.resume}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-primary-600 hover:text-primary-700"
                            >
                              View resume
                            </a>
                          ) : (
                            <span className="text-sm text-secondary-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Active Job Postings"
            subtitle={`${mockStats.openJobs} open roles`}
            actions={<FileText className="h-4 w-4 text-secondary-400" />}
            className="p-6"
          >
            {recentJobs.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No jobs posted"
                description="Create your first job to start building the pipeline."
              />
            ) : (
              <div className="space-y-4">
                {recentJobs.map((job) => (
                  <div key={job.id} className="rounded-xl border border-secondary-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-secondary-900">{job.title}</p>
                        <p className="mt-1 text-xs text-secondary-500">{job.created}</p>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-sm text-secondary-700">
                        <span className="font-medium text-secondary-900">{job.candidates}</span> candidates
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        className="border-0 bg-transparent p-0 text-primary-600 hover:bg-transparent hover:text-primary-700"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
    </Layout>
  )
}
