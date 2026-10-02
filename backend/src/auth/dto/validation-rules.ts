import { Transform } from 'class-transformer';

/*
 * The same regexes live in frontend/src/features/auth/schemas.ts. Length is
 * enforced inside the `u`-flag patterns so both sides count Unicode code points.
 */

/** 3–50 code points, any script, no control characters or lone surrogates. */
export const NAME_PATTERN = /^[^\p{Cc}\p{Cs}]{3,50}$/u;

/**
 * 8–128 code points with a letter (any script), an ASCII digit and a special
 * character (Unicode punctuation or symbol). Spaces are allowed but not special.
 */
export const PASSWORD_PATTERN =
  /^(?=.*\p{L})(?=.*\d)(?=.*[\p{P}\p{S}])[^\p{Cc}\p{Cs}]{8,128}$/u;

/** Sign-in only checks bounds, so a future policy change can't lock anyone out. */
export const SIGNIN_PASSWORD_PATTERN = /^[\s\S]{1,128}$/u;

export const EMAIL_MAX_LENGTH = 254;

/**
 * One explicit email shape on both sides, so an address the API accepts is always
 * accepted by the forms: an ASCII dot-atom local part, then domain labels (no
 * leading or trailing hyphen) ending in a letters-only TLD. Internationalized
 * addresses are not accepted. Overall length is checked separately (254).
 */
export const EMAIL_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

export const MESSAGES = {
  email: 'Enter a valid email address',
  name: 'Name must be 3–50 characters',
  password:
    'Password must be 8–128 characters and include a letter, a number and a special character',
  signinPassword: 'Enter your password',
} as const;

/** Trims (and optionally lowercases) strings; leaves other types for the validators to reject. */
export function Normalize(options: { lowercase?: boolean } = {}) {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return options.lowercase ? trimmed.toLowerCase() : trimmed;
  });
}
