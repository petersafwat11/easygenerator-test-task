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
} from '../test/renderApp'

afterEach(() => {
  vi.unstubAllGlobals()
})

async function fillAndSubmit(
  user: ReturnType<typeof renderApp>['user'],
  password = 'abc12345!',
) {
  await screen.findByRole('heading', { name: 'Sign in' })
  await user.type(screen.getByLabelText('Email'), 'ada@example.com')
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('SignInPage', () => {
  it('signs in and lands on /app', async () => {
    mockApi({
      'GET /api/users/me': unauthenticated,
      'POST /api/auth/signin': () => json({ user: USER }),
    })
    const { user } = renderApp('/signin')

    await fillAndSubmit(user)

    expect(
      await screen.findByText('Welcome to the application.'),
    ).toBeInTheDocument()
    expect(screen.getByText(USER.name)).toBeInTheDocument()
  })

  it('shows the generic message on 401 and keeps the input', async () => {
    mockApi({
      'GET /api/users/me': unauthenticated,
      'POST /api/auth/signin': () =>
        apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'),
    })
    const { user } = renderApp('/signin')

    await fillAndSubmit(user, 'wrong123!')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password',
    )
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com')
    expect(screen.getByTestId('location')).toHaveTextContent('/signin')
  })

  it('disables the button with a pending state while signing in', async () => {
    const response = deferred<Response>()
    mockApi({
      'GET /api/users/me': unauthenticated,
      'POST /api/auth/signin': () => response.promise,
    })
    const { user } = renderApp('/signin')

    await fillAndSubmit(user)

    const button = await screen.findByRole('button', { name: 'Signing in…' })
    expect(button).toBeDisabled()
    response.resolve(json({ user: USER }))
    expect(
      await screen.findByText('Welcome to the application.'),
    ).toBeInTheDocument()
  })

  it('says the service is unavailable on 503 instead of blaming the credentials', async () => {
    mockApi({
      'GET /api/users/me': unauthenticated,
      'POST /api/auth/signin': () =>
        apiError(503, 'SERVICE_UNAVAILABLE', 'Down'),
    })
    const { user } = renderApp('/signin')

    await fillAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'temporarily unavailable',
    )
  })

  it('uses the right autocomplete hints for password managers', async () => {
    mockApi({ 'GET /api/users/me': unauthenticated })
    renderApp('/signin')
    await screen.findByRole('heading', { name: 'Sign in' })

    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'autocomplete',
      'email',
    )
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
  })
})
