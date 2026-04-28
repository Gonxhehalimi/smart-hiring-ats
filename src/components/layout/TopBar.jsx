import { LogOut } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import Button from '../ui/Button'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/jobs': 'Jobs',
  '/jobs/create': 'Create Job',
  '/candidates': 'Candidates',
}

const getInitials = (name) => {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U'
}

export default function TopBar({ title }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const fallbackTitle = pageTitles[location.pathname] || 'Workspace'
  const displayTitle = title || fallbackTitle
  const initials = getInitials(user?.name)

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-secondary-200 bg-white/90 px-5 py-4 backdrop-blur md:px-8">
      <div>
        <h1 className="text-subheading text-secondary-900">{displayTitle}</h1>
        <p className="mt-0.5 text-small">Good morning, {user?.name || 'User'}</p>
      </div>

      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleLogout}
          className="hidden gap-1 sm:inline-flex"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary-900 text-sm font-semibold text-white">
          {initials}
        </div>
      </div>
    </header>
  )
}
