import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  apiError,
  json,
  mockApi,
  renderApp,
  unauthenticated,
  USER,
} from '../test/renderApp'

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openSignUp() {
  const rendered = renderApp('/signup')
  await screen.findByRole('heading', { name: 'Create your account' })
  return rendered
}

const email = () => screen.getByLabelText('Email')
const name = () => screen.getByLabelText('Name')
const password = () => screen.getByLabelText('Password')
const submit = () => screen.getByRole('button', { name: 'Create account' })

describe('SignUpPage', () => {
  it('shows per-field errors when fields are touched with invalid input', async () => {
    mockApi({ 'GET /api/users/me': unauthenticated })
    const { user } = await openSignUp()

    await user.type(email(), 'user@mail')
    await user.type(name(), 'Al')
    await user.click(password())
    await user.tab()

    expect(await screen.findByText('Enter a valid email address')).toBeVisible()
    expect(screen.getByText('Name must be 3–50 characters')).toBeVisible()
    expect(email()).toHaveAttribute('aria-invalid', 'true')
    expect(email()).toHaveAccessibleDescription('Enter a valid email address')
  })

  it('does not submit invalid input and focuses the first invalid field', async () => {
    const fetchMock = mockApi({ 'GET /api/users/me': unauthenticated })
    const { user } = await openSignUp()

    await user.click(submit())

    expect(await screen.findByText('Enter a valid email address')).toBeVisible()
    expect(email()).toHaveFocus()
    expect(fetchMock).toHaveBeenCalledTimes(1) // only the session check
  })

  it('ticks the password checklist live as the user types', async () => {
    mockApi({ 'GET /api/users/me': unauthenticated })
    const { user } = await openSignUp()
    const checklist = screen.getByRole('list', {
      name: 'Password requirements',
    })
    const rule = (id: string) =>
      checklist.querySelector(`[data-rule="${id}"]`) as HTMLElement

    expect(rule('letter')).toHaveAttribute('data-met', 'false')

    await user.type(password(), 'a')
    expect(rule('letter')).toHaveAttribute('data-met', 'true')
    expect(rule('number')).toHaveAttribute('data-met', 'false')

    await user.type(password(), '1!')
    expect(rule('number')).toHaveAttribute('data-met', 'true')
    expect(rule('special')).toHaveAttribute('data-met', 'true')
    expect(rule('length')).toHaveAttribute('data-met', 'false')
    expect(within(rule('length')).getByText('(not met yet)')).toBeTruthy()

    await user.type(password(), 'xxxxx')
    expect(rule('length')).toHaveAttribute('data-met', 'true')
  })

  it('lets the password be shown and hidden with a labelled toggle', async () => {
    mockApi({ 'GET /api/users/me': unauthenticated })
    const { user } = await openSignUp()

    expect(password()).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password()).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password()).toHaveAttribute('type', 'password')
  })

  it('signs up with normalized values and lands on /app', async () => {
    const fetchMock = mockApi({
      'GET /api/users/me': unauthenticated,
      'POST /api/auth/signup': () =>
        json({ user: USER, authenticated: true }, 201),
    })
    const { user } = await openSignUp()

    await user.type(email(), '  Ada@Example.COM ')
    await user.type(name(), '  Ada Lovelace ')
    await user.type(password(), ' abc12345! ')
    await user.click(submit())

    expect(
      await screen.findByText('Welcome to the application.'),
    ).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls[1]
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      password: ' abc12345! ',
    })
  })

  it('shows the duplicate-email message from a 409 on the email field', async () => {
    mockApi({
      'GET /api/users/me': unauthenticated,
      'POST /api/auth/signup': () =>
        apiError(
          409,
          'EMAIL_TAKEN',
          'An account with this email already exists',
        ),
    })
    const { user } = await openSignUp()

    await user.type(email(), 'ada@example.com')
    await user.type(name(), 'Ada')
    await user.type(password(), 'abc12345!')
    await user.click(submit())

    expect(
      await screen.findByText('An account with this email already exists'),
    ).toBeVisible()
    expect(email()).toHaveAttribute('aria-invalid', 'true')
    expect(email()).toHaveFocus()
    // Input is kept so the user can correct it.
    expect(name()).toHaveValue('Ada')
  })

  it('maps server validation details onto the matching fields', async () => {
    mockApi({
      'GET /api/users/me': unauthenticated,
      'POST /api/auth/signup': () =>
        json(
          {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Check the highlighted fields.',
            details: [
              { field: 'name', messages: ['Name must be 3–50 characters'] },
              { field: 'isAdmin', messages: ['property should not exist'] },
            ],
          },
          400,
        ),
    })
    const { user } = await openSignUp()

    await user.type(email(), 'ada@example.com')
    await user.type(name(), 'Ada')
    await user.type(password(), 'abc12345!')
    await user.click(submit())

    expect(
      await screen.findByText('Name must be 3–50 characters'),
    ).toBeVisible()
    expect(screen.queryByText('property should not exist')).toBeNull()
  })

  it('sends the user to sign in when the account was created without a session', async () => {
    mockApi({
      'GET /api/users/me': unauthenticated,
      'POST /api/auth/signup': () =>
        json({ user: USER, authenticated: false }, 201),
    })
    const { user } = await openSignUp()

    await user.type(email(), 'ada@example.com')
    await user.type(name(), 'Ada Lovelace')
    await user.type(password(), 'abc12345!')
    await user.click(submit())

    expect(
      await screen.findByText('Account created. Please sign in.'),
    ).toBeVisible()
    expect(screen.getByTestId('location')).toHaveTextContent('/signin')
    expect(screen.getByLabelText('Email')).toHaveValue(USER.email)
  })

  it('shows a retryable message when the network fails, keeping the input', async () => {
    mockApi({
      'GET /api/users/me': unauthenticated,
      'POST /api/auth/signup': () =>
        Promise.reject(new TypeError('Failed to fetch')),
    })
    const { user } = await openSignUp()

    await user.type(email(), 'ada@example.com')
    await user.type(name(), 'Ada')
    await user.type(password(), 'abc12345!')
    await user.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not reach the server',
    )
    expect(email()).toHaveValue('ada@example.com')
    expect(submit()).toBeEnabled()
  })
})
