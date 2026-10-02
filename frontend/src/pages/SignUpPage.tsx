import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { Alert } from '../components/Alert'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { PasswordField } from '../components/PasswordField'
import { PasswordRequirements } from '../components/PasswordRequirements'
import { TextField } from '../components/TextField'
import {
  applyServerFieldErrors,
  describeError,
} from '../features/auth/formErrors'
import { signUpSchema } from '../features/auth/schemas'
import type { SignUpValues } from '../features/auth/schemas'
import { useAuth } from '../features/auth/useAuth'
import { ApiError } from '../lib/api'

const FIELDS = ['email', 'name', 'password'] as const

export function SignUpPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onTouched',
    defaultValues: { email: '', name: '', password: '' },
  })
  const password = useWatch({ control, name: 'password' })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const result = await signUp(values)
      if (!result.authenticated) {
        // The account exists but no session was created: sign in next.
        await navigate('/signin', {
          replace: true,
          state: {
            notice: 'Account created. Please sign in.',
            email: result.user.email,
          },
        })
      }
      // When authenticated, the public-only guard moves us to /app.
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setError(
          'email',
          { type: 'server', message: error.message },
          { shouldFocus: true },
        )
        return
      }
      if (!applyServerFieldErrors(error, FIELDS, setError)) {
        setFormError(describeError(error))
      }
    }
  })

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It takes less than a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/signin"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        {formError && <Alert>{formError}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Name"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          error={errors.password?.message}
          description={<PasswordRequirements password={password} />}
          {...register('password')}
        />
        <Button type="submit" pending={isSubmitting} className="w-full">
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
