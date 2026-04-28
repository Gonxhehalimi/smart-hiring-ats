import { useCallback, useMemo, useState } from 'react'
import { AuthContext } from './auth-context'

const USER_KEYS = ['ats_user', 'user']

const readStoredUser = () => {
  for (const key of USER_KEYS) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    try {
      return JSON.parse(raw)
    } catch {
      localStorage.removeItem(key)
    }
  }
  return null
}

const persistUser = (userObj) => {
  if (!userObj) {
    USER_KEYS.forEach((k) => localStorage.removeItem(k))
    return
  }
  const serialized = JSON.stringify(userObj)
  localStorage.setItem('ats_user', serialized)
  localStorage.setItem('user', serialized)
}

/** Align token + user in localStorage before first React render. */
function readInitialAuth() {
  const t = localStorage.getItem('ats_token')
  const u = readStoredUser()
  if (t && !u) {
    localStorage.removeItem('ats_token')
    return { token: null, user: null }
  }
  if (!t && u) {
    persistUser(null)
    return { token: null, user: null }
  }
  return { token: t, user: u }
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readInitialAuth())
  const { token, user } = session

  const login = useCallback((authData) => {
    const nextToken =
      authData?.token ?? authData?.accessToken ?? authData?.data?.token ?? null
    const nextUser = authData?.user ?? authData?.data?.user ?? null

    if (nextToken) {
      localStorage.setItem('ats_token', nextToken)
    }
    if (nextUser) {
      persistUser(nextUser)
    }

    setSession((prev) => ({
      token: nextToken ?? prev.token,
      user: nextUser ?? prev.user,
    }))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('ats_token')
    persistUser(null)
    setSession({ token: null, user: null })
  }, [])

  const value = useMemo(() => {
    const role = user?.role ? String(user.role).toLowerCase() : ''
    const isHR = role.includes('hr')
    const isAuthenticated = Boolean(token && user)

    return {
      token,
      user,
      isHR,
      isAuthenticated,
      login,
      logout,
    }
  }, [token, user, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
