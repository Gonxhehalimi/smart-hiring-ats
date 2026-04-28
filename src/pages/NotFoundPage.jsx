import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-secondary-50">
      <div className="page-shell flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-lg p-8 text-center">
          <h1 className="text-heading">Page not found</h1>
          <p className="mt-2 text-body">
            The page you are looking for does not exist or may have been moved.
          </p>
          <div className="mt-6 flex justify-center">
            <Link to="/dashboard">
              <Button>Go to dashboard</Button>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  )
}
