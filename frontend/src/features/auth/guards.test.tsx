import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  apiError,
  deferred,
  json,
  mockApi,
  renderApp,
  unauthenticated,
  USER,
} from '../../test/renderApp'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('route guards', () => {
  it('shows a neutral loader while the session check runs, without redirecting', async () => {
    const me = deferred<Response>()
    mockApi({ 'GET /api/users/me': () => me.promise })

    renderApp('/app')

    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(screen.getByTestId('location')).toHaveTextContent('/app')
    expect(screen.queryByText('Welcome to the application.')).toBeNull()

    me.resolve(json({ user: USER }))
    expect(
      await screen.findByText('Welcome to the application.'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/app')
  })

  it('redirects to /signin when there is no session', async () => {
    mockApi({ 'GET /api/users/me': unauthenticated })

    renderApp('/app')

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/signin')
  })

  it.each([
    ['a 503', () => apiError(503, 'SERVICE_UNAVAILABLE', 'Down')],
    ['a 500', () => apiError(500, 'INTERNAL_ERROR', 'Oops')],
    [
      'a network failure',
      () => Promise.reject(new TypeError('Failed to fetch')),
    ],
  ])(
    'shows a retry screen, not the sign-in page, on %s',
    async (_label, failure) => {
      mockApi({ 'GET /api/users/me': failure })

      renderApp('/app')

      expect(
        await screen.findByRole('heading', {
          name: "We can't reach the server",
        }),
      ).toBeInTheDocument()
      expect(screen.getByTestId('location')).toHaveTextContent('/app')
    },
  )

  it('retries the session check from the retry screen', async () => {
    let calls = 0
    mockApi({
      'GET /api/users/me': () =>
        ++calls === 1
          ? apiError(503, 'SERVICE_UNAVAILABLE', 'Down')
          : json({ user: USER }),
    })

    const { user } = renderApp('/app')
    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByText('Welcome to the application.'),
    ).toBeInTheDocument()
  })

  it.each(['/signin', '/signup'])(
    'sends a signed-in user from %s to /app',
    async (path) => {
      mockApi({ 'GET /api/users/me': () => json({ user: USER }) })

      renderApp(path)

      expect(
        await screen.findByText('Welcome to the application.'),
      ).toBeInTheDocument()
      expect(screen.getByTestId('location')).toHaveTextContent('/app')
    },
  )

  it('shows the 404 page for unknown routes', async () => {
    mockApi({ 'GET /api/users/me': unauthenticated })
    renderApp('/nowhere')
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })
})
