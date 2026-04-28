import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ats_token')

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ''
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register')

    if (error.response?.status === 401 && !isAuthAttempt) {
      localStorage.removeItem('ats_token')
      localStorage.removeItem('ats_user')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }

    return Promise.reject(error)
  },
)

// Auth
export const loginUser = (data) => api.post('/auth/login', data)
export const registerUser = (data) => api.post('/auth/register', data)

// Jobs
export const getJobs = (openOnly = true) =>
  api.get('/jobs', {
    params: { openOnly },
  })
export const getJobById = (id) => api.get(`/jobs/${id}`)
export const createJob = (data) => api.post('/jobs', data)

// Candidates
export const uploadResume = (formData) =>
  api.post('/candidates/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

// Standalone resume file upload (stores file under /uploads, returns path).
// Do not set Content-Type: axios sets multipart boundary automatically for FormData.
export const postResumeUpload = (formData) => api.post('/upload', formData)

/** Python parser + job scoring: field "resume" + jobId in FormData (do not set Content-Type manually). */
export const analyzeResume = (formData) => api.post('/analyze', formData)
export const getCandidates = (jobId) => api.get('/candidates', { params: { jobId } })
export const getCandidateById = (id) => api.get(`/candidates/${id}`)
export const updateStatus = (id, status) =>
  api.patch(`/candidates/${id}/status`, { status })
export const deleteCandidate = (id) => api.delete(`/candidates/${id}`)
export const cleanupLegacyCandidates = (params) => api.delete('/candidates/cleanup', { params })

/** PUT /api/candidate/:id — body { status: 'Applied' | 'Interview' | 'Hired' } */
export const putCandidate = (id, body) => api.put(`/candidate/${id}`, body)
export const getNotes = (id) => api.get(`/candidates/${id}/notes`)
export const addNote = (id, note) => api.post(`/candidates/${id}/notes`, { note })

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats')
