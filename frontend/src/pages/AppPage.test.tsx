import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiError, json, mockApi, renderApp, USER } from '../test/renderApp'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AppPage', () => {
  it('greets the user with the exact text and their name as plain text', async () => {
    mockApi({
      'GET /api/users/me': () =>
        json({ user: { ...USER, name: '<img src=x onerror=alert(1)>' } }),
    })

    const { container } = renderApp('/app')

    expect(
      await screen.findByRole('heading', {
        name: 'Welcome to the application.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('logs out and returns to sign-in', async () => {
    const fetchMock = mockApi({
      'GET /api/users/me': () => json({ user: USER }),
      'POST /api/auth/logout': () => new Response(null, { status: 204 }),
    })
    const { user } = renderApp('/app')

    await user.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
    const logoutCall = fetchMock.mock.calls.find(
      ([url]) => String(url) === '/api/auth/logout',
    )
    expect(logoutCall?.[1]).toMatchObject({
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('keeps protected content hidden and says so when logout fails', async () => {
    let attempts = 0
    mockApi({
      'GET /api/users/me': () => json({ user: USER }),
      'POST /api/auth/logout': () =>
        ++attempts === 1
          ? apiError(503, 'SERVICE_UNAVAILABLE', 'Down')
          : new Response(null, { status: 204 }),
    })
    const { user } = renderApp('/app')

    await user.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Logout not confirmed',
    )
    expect(screen.queryByText('Welcome to the application.')).toBeNull()
    expect(screen.queryByText(USER.name)).toBeNull()
    expect(screen.getByTestId('location')).toHaveTextContent('/app')

    // Retrying works once the service is back.
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
  })
})
