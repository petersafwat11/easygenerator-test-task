import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-indigo-600">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Page not found
        </h1>
        <p className="mt-2 text-slate-600">
          The page you were looking for doesn't exist.
        </p>
        <Link
          to="/app"
          className="mt-6 inline-block rounded-lg font-semibold text-indigo-600 hover:text-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Go to the app
        </Link>
      </div>
    </main>
  )
}
