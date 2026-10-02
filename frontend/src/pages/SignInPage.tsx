import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router'
import { Alert } from '../components/Alert'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { PasswordField } from '../components/PasswordField'
import { TextField } from '../components/TextField'
import {
  applyServerFieldErrors,
  describeError,
} from '../features/auth/formErrors'
import { signInSchema } from '../features/auth/schemas'
import type { SignInValues } from '../features/auth/schemas'
import { useAuth } from '../features/auth/useAuth'

const FIELDS = ['email', 'password'] as const

interface SignInLocationState {
  notice?: string
  email?: string
}

export function SignInPage() {
  const { signIn } = useAuth()
  const location = useLocation()
  const navState = (location.state ?? {}) as SignInLocationState
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    mode: 'onTouched',
    defaultValues: { email: navState.email ?? '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      // On success the public-only guard moves us to /app.
      await signIn(values)
    } catch (error) {
      if (!applyServerFieldErrors(error, FIELDS, setError)) {
        setFormError(describeError(error))
      }
    }
  })

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back."
      footer={
        <>
          New here?{' '}
          <Link
            to="/signup"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        {navState.notice && !formError && (
          <Alert tone="success">{navState.notice}</Alert>
        )}
        {formError && <Alert>{formError}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" pending={isSubmitting} className="w-full">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
