import { createContext } from 'react'
import type { SignInInput, SignUpInput, SignUpResult, User } from './authApi'

export type AuthState =
  | { status: 'checking' }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' }
  | { status: 'unavailable' }

export interface AuthContextValue {
  state: AuthState
  /** Re-runs the session check (used by the "unavailable" retry screen). */
  retry: () => void
  signIn: (input: SignInInput) => Promise<User>
  signUp: (input: SignUpInput) => Promise<SignUpResult>
  /** Resolves only once the server confirmed the session is gone. */
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
