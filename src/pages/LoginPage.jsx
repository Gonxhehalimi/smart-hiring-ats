import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { Navigate, useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { loginUser, registerUser } from '../services/api'
import useAuth from '../hooks/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()

  const [isRegister, setIsRegister] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  })

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const getErrorMessage = (err, fallback) => {
    const data = err?.response?.data
    if (typeof data === 'string' && data.trim()) return data
    if (data?.message) return data.message
    if (typeof data?.error === 'string' && data.error.trim()) return data.error

    if (!err?.response) {
      const msg = err?.message || ''
      if (msg === 'Network Error' || err?.code === 'ERR_NETWORK') {
        return 'Cannot reach the server. Start the backend (port 5050) and ensure the dev proxy in vite.config.js matches.'
      }
      if (msg) return msg
    }

    return fallback
  }

  const validateForm = () => {
    const nextErrors = {}
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (isRegister && !formData.fullName.trim()) {
      nextErrors.fullName = 'Full name is required.'
    }

    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!emailPattern.test(formData.email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (!formData.password) {
      nextErrors.password = 'Password is required.'
    } else if (formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.'
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      if (isRegister) {
        await registerUser({
          name: formData.fullName,
          email: formData.email,
          password: formData.password,
          role: 'hr',
        })

        toast.success('Registration successful. Please sign in.')
        setIsRegister(false)
        setFormData((prev) => ({ ...prev, password: '' }))
      } else {
        const response = await loginUser({
          email: formData.email,
          password: formData.password,
        })

        const data = response?.data ?? {}
        const token = data.token ?? data.accessToken ?? data?.data?.token
        const user = data.user ?? data?.data?.user

        if (!token) {
          throw new Error('Missing token in login response')
        }

        login({ token, user })
        toast.success('Welcome back!')
        navigate('/dashboard')
      }
    } catch (err) {
      const status = err?.response?.status
      let message = getErrorMessage(
        err,
        isRegister ? 'Unable to register. Please try again.' : 'Invalid email or password',
      )
      if (!err?.response?.data?.message && !isRegister && status === 401) {
        message = 'Invalid email or password'
      }

      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary-50 px-4 py-10 sm:px-6">
      <div className="page-shell w-full max-w-md space-y-4">
        <section className="space-y-1 text-center">
          <h1 className="text-heading">{isRegister ? 'Create account' : 'Sign in'}</h1>
          <p className="text-body">Applicant Tracking System</p>
        </section>

        <Card
          className="p-6 sm:p-8"
          title={isRegister ? 'Create your account' : 'Welcome back'}
          subtitle={
            isRegister
              ? 'Register to start managing your hiring workflows.'
              : 'Sign in to continue to your dashboard.'
          }
        >
          <form className="mt-7 space-y-4" onSubmit={handleSubmit} noValidate>
            {isRegister && (
              <Input
                id="fullName"
                label="Full name"
                type="text"
                autoComplete="name"
                placeholder="Jane Doe"
                value={formData.fullName}
                onChange={(event) => updateField('fullName', event.target.value)}
                error={fieldErrors.fullName}
              />
            )}

            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={(event) => updateField('email', event.target.value)}
              error={fieldErrors.email}
            />

            <Input
              id="password"
              label="Password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder="Enter your password"
              value={formData.password}
              onChange={(event) => updateField('password', event.target.value)}
              error={fieldErrors.password}
              helperText={isRegister ? 'Use at least 8 characters.' : undefined}
            />

            {error && <p className="text-sm text-danger-600">{error}</p>}

            <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
              {isRegister ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-body">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setError('')
                setFieldErrors({})
                setIsRegister((prev) => !prev)
              }}
              className="border-0 bg-transparent p-0 font-medium text-primary-600 hover:bg-transparent hover:text-primary-700"
            >
              {isRegister ? 'Sign in' : 'Register'}
            </Button>
          </p>
        </Card>
      </div>
    </main>
  )
}
