import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../features/auth/AuthProvider'
import type { User } from '../features/auth/authApi'

export const USER: User = {
  id: '665f1c2e9b1e8a3d4c5b6a79',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  createdAt: '2026-10-02T12:00:00.000Z',
}

export function json(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function apiError(status: number, code: string, message: string) {
  return json({ statusCode: status, code, message, requestId: 'test' }, status)
}

export const unauthenticated = () =>
  apiError(401, 'UNAUTHENTICATED', 'You need to sign in.')

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>

/**
 * Stubs fetch with a table of "METHOD /api/path" handlers. Each call returns a
 * fresh Response; unknown routes fail the test loudly.
 */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${String(input)}`
      const handler = routes[key]
      if (!handler) throw new Error(`Unexpected request: ${key}`)
      return handler(init)
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** A promise you resolve from the test, to control response timing. */
export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

export function renderApp(path: string) {
  const user = userEvent.setup()
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
        <LocationProbe />
      </AuthProvider>
    </MemoryRouter>,
  )
  return { user, ...result }
}
