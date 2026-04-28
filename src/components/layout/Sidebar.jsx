import { useMemo, useState } from 'react'
import {
  Briefcase,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Users,
  X,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import Button from '../ui/Button'

const baseLinks = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Jobs', to: '/jobs', icon: Briefcase },
  { label: 'Candidates', to: '/candidates', icon: Users },
]

const createJobLink = { label: 'Create Job', to: '/jobs/create', icon: Plus }

const getInitials = (name) => {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U'
}

export default function Sidebar() {
  const navigate = useNavigate()
  const { user, isHR, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const links = useMemo(
    () => (isHR ? [...baseLinks, createJobLink] : baseLinks),
    [isHR],
  )

  const initials = getInitials(user?.name)
  const role = user?.role || 'member'
  const normalizedRole = String(role).toLowerCase()
  const roleBadgeClass = normalizedRole.includes('hr')
    ? 'bg-primary-500/20 text-primary-100 border-primary-400/30'
    : 'bg-secondary-500/20 text-secondary-100 border-secondary-400/30'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed left-4 top-4 z-50 border-slate-500/40 bg-slate-800/80 p-2 text-slate-100 shadow-lg backdrop-blur hover:bg-slate-700/80 lg:hidden"
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isOpen && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="fixed inset-0 z-30 rounded-none border-0 bg-slate-950/45 p-0 hover:bg-slate-950/50 focus-visible:ring-0 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col bg-[#1e293b] px-4 py-5 shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-500/30 bg-slate-800/45 px-3 py-3">
          <svg viewBox="0 0 48 48" className="h-9 w-9" role="img" aria-label="ATS Pro logo">
            <defs>
              <linearGradient id="logoGradient" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <rect width="48" height="48" rx="12" fill="#0f172a" />
            <path d="M8 35 L24 8 L40 35 Z" fill="url(#logoGradient)" opacity="0.95" />
            <circle cx="24" cy="25" r="5" fill="#1e293b" />
          </svg>
          <div>
            <p className="text-lg font-semibold text-white">ATS Pro</p>
            <p className="text-xs text-slate-300">Smart Hiring Workspace</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {links.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-r-lg border-l-4 px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'border-l-[#3b82f6] bg-slate-700/70 text-white'
                      : 'border-l-transparent text-slate-200 hover:border-l-slate-400 hover:bg-slate-700/40 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-6 rounded-xl border border-slate-500/35 bg-slate-800/40 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/20 text-sm font-semibold text-primary-100">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user?.name || 'User'}</p>
              <span
                className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${roleBadgeClass}`}
              >
                {String(role).replaceAll('_', ' ')}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="danger"
            onClick={handleLogout}
            className="mt-4 w-full border-slate-500/40 bg-slate-900/50 text-slate-100 hover:bg-slate-700/60"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
    </>
  )
}
