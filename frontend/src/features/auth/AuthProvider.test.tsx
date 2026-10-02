import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  deferred,
  json,
  mockApi,
  unauthenticated,
  USER,
} from '../../test/renderApp'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Exposes the provider's state and actions without any route guards in the way. */
function Probe() {
  const { state, signIn, logout } = useAuth()
  return (
    <>
      <output data-testid="status">{state.status}</output>
      <button
        onClick={() =>
          void signIn({ email: USER.email, password: 'abc12345!' })
        }
      >
        sign in
      </button>
      <button onClick={() => void logout().catch(() => undefined)}>
        log out
      </button>
    </>
  )
}

function renderProvider() {
  const user = userEvent.setup()
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
  return { user, status: () => screen.getByTestId('status') }
}

describe('AuthProvider', () => {
  it('ignores a slow /me that resolves after a sign-in (stale response)', async () => {
    const slowMe = deferred<Response>()
    mockApi({
      'GET /api/users/me': () => slowMe.promise,
      'POST /api/auth/signin': () => json({ user: USER }),
    })
    const { user, status } = renderProvider()
    expect(status()).toHaveTextContent(/^checking$/)

    await user.click(screen.getByRole('button', { name: 'sign in' }))
    expect(status()).toHaveTextContent(/^authenticated$/)

    // The bootstrap request started before the sign-in and now says 401.
    slowMe.resolve(unauthenticated())
    await slowMe.promise
    await new Promise((r) => setTimeout(r, 0))

    expect(status()).toHaveTextContent(/^authenticated$/)
  })

  it('ignores a slow /me that resolves after a logout', async () => {
    const slowMe = deferred<Response>()
    mockApi({
      'GET /api/users/me': () => slowMe.promise,
      'POST /api/auth/logout': () => new Response(null, { status: 204 }),
    })
    const { user, status } = renderProvider()

    await user.click(screen.getByRole('button', { name: 'log out' }))
    expect(status()).toHaveTextContent(/^unauthenticated$/)

    slowMe.resolve(json({ user: USER }))
    await slowMe.promise
    await new Promise((r) => setTimeout(r, 0))

    expect(status()).toHaveTextContent(/^unauthenticated$/)
  })

  it('treats a 401 as signed out', async () => {
    mockApi({ 'GET /api/users/me': unauthenticated })
    const { status } = renderProvider()
    expect(await screen.findByText('unauthenticated')).toBe(status())
  })

  it('never retries a failed mutation on its own', async () => {
    const fetchMock = mockApi({
      'GET /api/users/me': unauthenticated,
      'POST /api/auth/logout': () =>
        json({ statusCode: 503, code: 'SERVICE_UNAVAILABLE' }, 503),
    })
    const { user } = renderProvider()
    await screen.findByText('unauthenticated')

    await user.click(screen.getByRole('button', { name: 'log out' }))
    await new Promise((r) => setTimeout(r, 50))

    const logoutCalls = fetchMock.mock.calls.filter(
      ([url]) => String(url) === '/api/auth/logout',
    )
    expect(logoutCalls).toHaveLength(1)
  })
})
