import { Toaster } from 'react-hot-toast'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import AuthProvider from './context/AuthProvider'
import useAuth from './hooks/useAuth'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import CandidateDetailPage from './pages/CandidateDetailPage'
import CandidatesPage from './pages/CandidatesPage'
import CreateJobPage from './pages/CreateJobPage'
import DashboardPage from './pages/DashboardPage'
import JobDetailPage from './pages/JobDetailPage'
import JobsPage from './pages/JobsPage'
import NotFoundPage from './pages/NotFoundPage'

function ProtectedRoute({ children, role }) {
  const { isAuthenticated, isHR } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (role === 'hr' && !isHR) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            className: 'rounded-xl border border-secondary-200 bg-white text-secondary-900 shadow-soft',
            style: {
              padding: '12px 14px',
            },
            success: {
              iconTheme: {
                primary: '#15803d',
                secondary: '#ecfdf3',
              },
            },
            error: {
              iconTheme: {
                primary: '#dc2626',
                secondary: '#fef2f2',
              },
            },
          }}
        />

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute>
                <JobsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/create"
            element={
              <ProtectedRoute role="hr">
                <CreateJobPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <ProtectedRoute>
                <JobDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidates"
            element={
              <ProtectedRoute>
                <Layout title="Candidates">
                  <CandidatesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidates/:id"
            element={
              <ProtectedRoute>
                <CandidateDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}