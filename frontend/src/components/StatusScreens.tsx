import { Button } from './Button'

/** Neutral placeholder while the session check runs: no content, no redirect. */
export function LoadingScreen() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="size-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"
      />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

/** The service could not be reached. Explicitly not "signed out". */
export function UnavailableScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">
          We can't reach the server
        </h1>
        <p className="mt-2 text-sm text-slate-600" role="alert">
          This is usually temporary. Check your connection and try again.
        </p>
        <Button className="mt-6 w-full" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </main>
  )
}
