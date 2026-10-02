import { apiRequest } from '../../lib/api'

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface SignUpInput {
  email: string
  name: string
  password: string
}

export interface SignInInput {
  email: string
  password: string
}

export interface SignUpResult {
  user: User
  /** false: the account exists but no session was created; sign in next. */
  authenticated: boolean
}

export const authApi = {
  me: (signal?: AbortSignal) =>
    apiRequest<{ user: User }>('/users/me', { signal }),

  signUp: (input: SignUpInput) =>
    apiRequest<SignUpResult>('/auth/signup', { method: 'POST', body: input }),

  signIn: (input: SignInInput) =>
    apiRequest<{ user: User }>('/auth/signin', { method: 'POST', body: input }),

  logout: () => apiRequest<void>('/auth/logout', { method: 'POST', body: {} }),
}
