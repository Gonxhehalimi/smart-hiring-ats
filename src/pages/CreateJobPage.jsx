import { Briefcase, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import { createJob } from '../services/api'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'

const initialForm = {
  title: '',
  description: '',
  skills: '',
  min_experience: 0,
  status: 'open',
}

export default function CreateJobPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(initialForm)
  const [skills, setSkills] = useState([])
  const [skillInput, setSkillInput] = useState('')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const syncSkills = (nextSkills) => {
    setSkills(nextSkills)
    setFormData((prev) => ({
      ...prev,
      skills: nextSkills.join(', '),
    }))
  }

  const addSkill = (rawSkill) => {
    const nextSkill = rawSkill.trim()
    if (!nextSkill) return

    const isDuplicate = skills.some(
      (skill) => skill.toLowerCase() === nextSkill.toLowerCase(),
    )
    if (isDuplicate) return

    syncSkills([...skills, nextSkill])
    setSkillInput('')
    setErrors((prev) => ({ ...prev, skills: '' }))
  }

  const removeSkill = (skillToRemove) => {
    syncSkills(skills.filter((skill) => skill !== skillToRemove))
  }

  const handleSkillKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addSkill(skillInput.replace(',', ''))
    }
  }

  const validate = () => {
    const nextErrors = {}

    if (!formData.title.trim()) {
      nextErrors.title = 'Job title is required.'
    }

    if (!formData.description.trim()) {
      nextErrors.description = 'Job description is required.'
    }

    if (skills.length === 0) {
      nextErrors.skills = 'Please add at least one skill.'
    }

    if (Number(formData.min_experience) < 0 || Number(formData.min_experience) > 20) {
      nextErrors.min_experience = 'Minimum experience must be between 0 and 20.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    const payload = {
      ...formData,
      min_experience: Number(formData.min_experience),
      skills: skills.join(', '),
    }

    try {
      await createJob(payload)
      toast.success('Job posting created successfully.')
      navigate('/jobs')
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || 'Failed to create job posting. Please try again.'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Layout title="Create Job">
      <div className="page-shell grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <Card className="mx-auto w-full max-w-[700px] p-6 md:p-8">
            <h1 className="text-heading">Create New Job Posting</h1>
            <p className="mt-1 text-body">
              Fill out the details below to publish a new position.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <Input
                id="title"
                label="Job Title"
                type="text"
                value={formData.title}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, title: event.target.value }))
                  setErrors((prev) => ({ ...prev, title: '' }))
                }}
                placeholder="e.g. Senior Frontend Developer"
                error={errors.title}
              />

              <Input
                as="textarea"
                id="description"
                rows={5}
                label="Job Description"
                value={formData.description}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, description: event.target.value }))
                  setErrors((prev) => ({ ...prev, description: '' }))
                }}
                placeholder="Describe role responsibilities and impact..."
                error={errors.description}
              />

              <div>
                <label htmlFor="skills" className="block text-sm font-medium text-secondary-700">
                  Required Skills
                </label>
                <div className="mt-1 rounded-xl border border-secondary-300 px-3 py-2.5 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700"
                      >
                        {skill}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => removeSkill(skill)}
                          className="h-5 w-5 rounded-full border-0 bg-transparent p-0 text-primary-700 hover:bg-primary-200"
                          aria-label={`Remove ${skill}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </span>
                    ))}

                    <input
                      id="skills"
                      type="text"
                      value={skillInput}
                      onChange={(event) => setSkillInput(event.target.value)}
                      onKeyDown={handleSkillKeyDown}
                      onBlur={() => {
                        if (skillInput.trim()) addSkill(skillInput)
                      }}
                      className="min-w-[220px] flex-1 border-none bg-transparent p-0 text-sm outline-none"
                      placeholder="Type a skill and press Enter or comma"
                    />
                  </div>
                </div>
                {errors.skills && <p className="mt-1 text-sm text-danger-600">{errors.skills}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  id="experience"
                  label="Minimum Experience (years)"
                  type="number"
                  min={0}
                  max={20}
                  value={formData.min_experience}
                  onChange={(event) => {
                    setFormData((prev) => ({
                      ...prev,
                      min_experience: event.target.value,
                    }))
                    setErrors((prev) => ({ ...prev, min_experience: '' }))
                  }}
                  error={errors.min_experience}
                />

                <div>
                  <p className="block text-sm font-medium text-secondary-700">Job Status</p>
                  <div className="mt-2 flex gap-2">
                    {['open', 'closed'].map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant={formData.status === status ? 'primary' : 'secondary'}
                        onClick={() => setFormData((prev) => ({ ...prev, status }))}
                        className="capitalize"
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button type="submit" isLoading={isSubmitting}>
                  Create Job Posting
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate('/jobs')}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </section>

        <aside className="hidden lg:block">
          <Card className="sticky top-24 p-6">
            <h2 className="text-subheading">Live Preview</h2>

            <article className="mt-4 rounded-xl border border-secondary-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-subheading text-secondary-900">
                  {formData.title || 'Job title preview'}
                </h3>
                <Badge variant={formData.status === 'open' ? 'shortlisted' : 'review'} className="capitalize">
                  {formData.status}
                </Badge>
              </div>

              <p className="mt-2 text-body">
                {formData.description || 'Your job description preview will appear here.'}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {(skills.length > 0 ? skills : ['No skills yet']).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-secondary-100 px-2.5 py-1 text-xs font-medium text-secondary-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-secondary-700">
                <Briefcase className="h-4 w-4 text-secondary-500" />
                <span>{Number(formData.min_experience) || 0}+ years experience</span>
              </div>

              <Button type="button" variant="secondary" className="mt-4 w-full">
                <Plus className="h-4 w-4" />
                View Details
              </Button>
            </article>
          </Card>
        </aside>
      </div>
    </Layout>
  )
}
