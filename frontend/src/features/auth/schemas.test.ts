import { describe, expect, it } from 'vitest'
import { PASSWORD_RULES, signInSchema, signUpSchema } from './schemas'
import {
  EMAIL_VECTORS,
  NAME_VECTORS,
  PASSWORD_VECTORS,
} from './validation-vectors'

const base = { email: 'ada@example.com', name: 'Ada', password: 'abc12345!' }

describe('signUpSchema agrees with the shared vectors', () => {
  it.each(PASSWORD_VECTORS)(
    'password $note → valid: $valid',
    ({ input, valid }) => {
      const result = signUpSchema.safeParse({ ...base, password: input })
      expect(result.success).toBe(valid)
    },
  )

  it.each(NAME_VECTORS)('name $note → valid: $valid', ({ input, valid }) => {
    const result = signUpSchema.safeParse({ ...base, name: input })
    expect(result.success).toBe(valid)
  })

  it.each(EMAIL_VECTORS)(
    'email $note → valid: $valid',
    ({ input, valid, normalized }) => {
      const result = signUpSchema.safeParse({ ...base, email: input })
      expect(result.success).toBe(valid)
      if (normalized && result.success) {
        expect(result.data.email).toBe(normalized)
      }
    },
  )

  it('trims the name but never the password', () => {
    const result = signUpSchema.parse({
      ...base,
      name: '  Grace  ',
      password: ' abc12345! ',
    })
    expect(result.name).toBe('Grace')
    expect(result.password).toBe(' abc12345! ')
  })
})

describe('signInSchema', () => {
  it('accepts any 1–128 character password, unlike signup', () => {
    expect(
      signInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success,
    ).toBe(true)
  })

  it.each([
    ['empty', ''],
    ['129 characters', 'a'.repeat(129)],
  ])('rejects a %s password', (_label, password) => {
    expect(signInSchema.safeParse({ email: 'a@b.co', password }).success).toBe(
      false,
    )
  })
})

describe('PASSWORD_RULES (live checklist)', () => {
  const met = (value: string) =>
    PASSWORD_RULES.filter((rule) => rule.test(value)).map((rule) => rule.id)

  it('tracks each requirement independently', () => {
    expect(met('')).toEqual([])
    expect(met('a')).toEqual(['letter'])
    expect(met('a1')).toEqual(['letter', 'number'])
    expect(met('a1!')).toEqual(['letter', 'number', 'special'])
    expect(met('abc12345!')).toEqual(['length', 'letter', 'number', 'special'])
  })

  it('counts length in code points, like the backend', () => {
    // 7 code points, 8 UTF-16 units.
    expect(met('abc123😀')).not.toContain('length')
    expect(met('abc1234😀')).toContain('length')
  })

  it('does not count a space as special', () => {
    expect(met('abc 1234')).not.toContain('special')
  })
})
