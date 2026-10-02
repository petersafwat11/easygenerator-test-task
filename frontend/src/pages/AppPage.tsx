import { useState } from 'react'
import { Alert } from '../components/Alert'
import { Button } from '../components/Button'
import { useAuth } from '../features/auth/useAuth'

type LogoutStatus = 'idle' | 'pending' | 'failed'

export function AppPage() {
  const { state, logout } = useAuth()
  const [logoutStatus, setLogoutStatus] = useState<LogoutStatus>('idle')

  if (state.status !== 'authenticated') return null

  const onLogout = async () => {
    setLogoutStatus('pending')
    try {
      // On success the provider becomes 'unauthenticated' and the guard redirects.
      await logout()
    } catch {
      setLogoutStatus('failed')
    }
  }

  // Once logout has started, protected content stays hidden until it resolves.
  const contentHidden = logoutStatus !== 'idle'

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm font-semibold tracking-wide text-indigo-600">
            Easygenerator
          </span>
          <Button
            variant="secondary"
            pending={logoutStatus === 'pending'}
            onClick={onLogout}
          >
            {logoutStatus === 'pending' ? 'Logging out…' : 'Log out'}
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        {logoutStatus === 'failed' && (
          <Alert className="mb-6">
            Logout not confirmed. Your session may still be active, so try
            again.
          </Alert>
        )}
        {contentHidden ? (
          logoutStatus === 'pending' && (
            <p className="text-slate-600" role="status">
              Logging out…
            </p>
          )
        ) : (
          <>
            <h1 className="text-3xl font-semibold text-slate-900">
              Welcome to the application.
            </h1>
            <p className="mt-3 text-slate-600">
              Signed in as{' '}
              <span className="font-medium text-slate-900">
                {state.user.name}
              </span>
            </p>
          </>
        )}
      </main>
    </div>
  )
}
