import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError } from '../../lib/api'
import { authApi } from './authApi'
import type { SignInInput, SignUpInput } from './authApi'
import { AuthContext } from './authContext'
import type { AuthContextValue, AuthState } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'checking' })
  // Bumped by every sign-in, sign-up, logout and check. A /me response that
  // started under an older generation is stale and must not overwrite state.
  const generation = useRef(0)

  /** Asks the server for the session and applies the answer unless it went stale. */
  const check = useCallback(() => {
    const started = ++generation.current
    void resolveSession().then((next) => {
      if (started === generation.current) setState(next)
    })
  }, [])

  // The initial state is already 'checking'.
  useEffect(check, [check])

  const signIn = useCallback(async (input: SignInInput) => {
    const { user } = await authApi.signIn(input)
    generation.current++
    setState({ status: 'authenticated', user })
    return user
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    const result = await authApi.signUp(input)
    generation.current++
    setState(
      result.authenticated
        ? { status: 'authenticated', user: result.user }
        : { status: 'unauthenticated' },
    )
    return result
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    generation.current++
    setState({ status: 'unauthenticated' })
  }, [])

  const retry = useCallback(() => {
    setState({ status: 'checking' })
    check()
  }, [check])

  const value = useMemo<AuthContextValue>(
    () => ({ state, retry, signIn, signUp, logout }),
    [state, retry, signIn, signUp, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * 401 is the only answer that means "signed out". Network errors and 5xx mean
 * we don't know, so they become 'unavailable' and never trigger a redirect.
 */
async function resolveSession(): Promise<AuthState> {
  try {
    const { user } = await authApi.me()
    return { status: 'authenticated', user }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { status: 'unauthenticated' }
    }
    return { status: 'unavailable' }
  }
}
