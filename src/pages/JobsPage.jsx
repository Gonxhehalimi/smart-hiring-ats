import { Briefcase, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import { getJobs } from '../services/api'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import useAuth from '../hooks/useAuth'

const filters = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
]

export default function JobsPage() {
  const navigate = useNavigate()
  const { isHR } = useAuth()
  const [jobs, setJobs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    let cancelled = false

    async function loadJobs() {
      setIsLoading(true)
      try {
        // Fetch all jobs here so status filters can work on both open and closed.
        const { data } = await getJobs(false)
        if (cancelled) return
        setJobs(Array.isArray(data) ? data : [])
      } catch (err) {
        if (!cancelled) {
          setJobs([])
          toast.error(err?.response?.data?.message || 'Failed to load jobs.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadJobs()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return jobs.filter((job) => {
      const normalizedStatus = String(job.status || '').trim().toLowerCase()
      const matchesQuery = job.title.toLowerCase().includes(normalizedQuery)
      const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [jobs, query, statusFilter])

  return (
    <Layout title="Job Postings">
      <div className="page-shell space-y-6">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-heading">Job Postings</h1>
            <p className="text-body">Manage open roles, review talent demand, and track hiring velocity.</p>
          </div>
          {isHR && (
            <Button type="button" onClick={() => navigate('/jobs/create')}>
              Create New Job
            </Button>
          )}
        </section>

        <Card className="p-6">
          <h2 className="text-subheading">Search & Filters</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-[42px] h-4 w-4 text-secondary-400" />
            <Input
              id="jobSearch"
              label="Search jobs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search jobs by title..."
              className="pl-9"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filters.map((filter) => {
              const isActive = statusFilter === filter.id
              return (
                <Button
                  key={filter.id}
                  type="button"
                  size="sm"
                  variant={isActive ? 'primary' : 'secondary'}
                  onClick={() => setStatusFilter(filter.id)}
                >
                  {filter.label}
                </Button>
              )
            })}
          </div>
        </Card>

        {isLoading ? (
          <Card className="p-8 text-center">
            <p className="text-body">Loading jobs...</p>
          </Card>
        ) : filteredJobs.length === 0 ? (
          <Card className="p-8 text-center">
            <EmptyState
              icon={Briefcase}
              title="No jobs posted"
              description="Try a different search term or switch the status filter."
            />
          </Card>
        ) : (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredJobs.map((job) => {
              const skills = String(job.required_skills || job.skills || '')
                .split(',')
                .map((skill) => skill.trim())
                .filter(Boolean)
              const normalizedStatus = String(job.status || '').trim().toLowerCase()
              const statusVariant = normalizedStatus === 'open' ? 'shortlisted' : 'review'

              return (
                <Card key={job.id} className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-subheading text-secondary-900">{job.title}</h3>
                    <Badge variant={statusVariant} className="capitalize">
                      {normalizedStatus || 'unknown'}
                    </Badge>
                  </div>

                  <p className="mt-2 text-body">{job.description}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        key={`${job.id}-${skill}`}
                        className="rounded-full bg-secondary-100 px-2.5 py-1 text-xs font-medium text-secondary-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  <p className="mt-4 text-sm font-medium text-secondary-700">
                    {Number(job.experience_required ?? job.min_experience ?? 0)}+ years experience
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-sm text-secondary-700">
                    <Users className="h-4 w-4 text-secondary-500" />
                    <span>{job.candidate_count} candidates</span>
                  </div>

                  <p className="mt-3 text-xs text-secondary-500">
                    Created by <span className="font-medium text-secondary-700">{job.created_by_name}</span> on{' '}
                    {job.created_at}
                  </p>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="mt-5 w-full"
                  >
                    View Details
                  </Button>
                </Card>
              )
            })}
          </section>
        )}
      </div>
    </Layout>
  )
}
