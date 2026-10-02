import { z } from 'zod'

/*
 * The same regexes live in backend/src/auth/dto/validation-rules.ts. Length is
 * enforced inside the `u`-flag patterns so both sides count Unicode code points
 * (Zod's .min()/.max() would count UTF-16 units).
 */

/** 3–50 code points, any script, no control characters or lone surrogates. */
export const NAME_PATTERN = /^[^\p{Cc}\p{Cs}]{3,50}$/u

/** 8–128 code points with a letter, an ASCII digit and a punctuation/symbol. */
export const PASSWORD_PATTERN =
  /^(?=.*\p{L})(?=.*\d)(?=.*[\p{P}\p{S}])[^\p{Cc}\p{Cs}]{8,128}$/u

const SIGNIN_PASSWORD_PATTERN = /^[\s\S]{1,128}$/u

export const EMAIL_MAX_LENGTH = 254

/**
 * The same explicit shape as the backend, so an address the API accepts is
 * always accepted here: ASCII dot-atom local part, domain labels, letters-only
 * TLD. No internationalized addresses. Overall length is checked separately.
 */
export const EMAIL_PATTERN =
  /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/

export const MESSAGES = {
  email: 'Enter a valid email address',
  name: 'Name must be 3–50 characters',
  password: "Password doesn't meet the requirements below",
  signinPassword: 'Enter your password',
} as const

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH, MESSAGES.email)
  .regex(EMAIL_PATTERN, MESSAGES.email)

export const signUpSchema = z.object({
  email,
  name: z.string().trim().regex(NAME_PATTERN, MESSAGES.name),
  // Never trimmed or case-changed.
  password: z.string().regex(PASSWORD_PATTERN, MESSAGES.password),
})

/** Looser on purpose: a future policy change must not lock existing users out. */
export const signInSchema = z.object({
  email,
  password: z.string().regex(SIGNIN_PASSWORD_PATTERN, MESSAGES.signinPassword),
})

export type SignUpValues = z.input<typeof signUpSchema>
export type SignInValues = z.input<typeof signInSchema>

const codePointLength = (value: string) => [...value].length

/** The live checklist shown under the signup password field. */
export const PASSWORD_RULES = [
  {
    id: 'length',
    label: '8–128 characters',
    test: (v: string) => codePointLength(v) >= 8 && codePointLength(v) <= 128,
  },
  { id: 'letter', label: 'A letter', test: (v: string) => /\p{L}/u.test(v) },
  { id: 'number', label: 'A number (0–9)', test: (v: string) => /\d/.test(v) },
  {
    id: 'special',
    label: 'A special character, like ! @ # or €',
    test: (v: string) => /[\p{P}\p{S}]/u.test(v),
  },
] as const
