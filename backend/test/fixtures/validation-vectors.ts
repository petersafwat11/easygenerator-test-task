/*
 * Shared validation vectors from PLAN-FINAL §4. The frontend suite uses the same
 * list verbatim (frontend/src/features/auth/validation-vectors.ts).
 */

export interface Vector {
  input: string;
  valid: boolean;
  note: string;
}

const codePoints = (count: number, char = 'a'): string => char.repeat(count);

/** "abc1!" + filler letters, to an exact code-point length. */
const passwordOfLength = (count: number): string =>
  'abc1!' + codePoints(count - 5, 'x');

export const PASSWORD_VECTORS: Vector[] = [
  { input: 'abc12345!', valid: true, note: 'letters, digits, special' },
  { input: 'كلمة123!x', valid: true, note: 'Arabic letters count' },
  { input: 'abc 123!', valid: true, note: 'space allowed, ! is the special' },
  { input: 'abcdefgh', valid: false, note: 'no digit, no special' },
  { input: '12345678!', valid: false, note: 'no letter' },
  { input: 'abcd1234', valid: false, note: 'no special' },
  { input: 'abc 1234', valid: false, note: "space isn't special" },
  { input: 'a1!', valid: false, note: 'too short' },
  {
    input: 'abcd123́',
    valid: false,
    note: 'a combining accent is not special',
  },
  { input: 'abcd123!\uD800', valid: false, note: 'unpaired surrogate' },
  {
    input: 'abc1234😀',
    valid: true,
    note: '8 code points (9 UTF-16 units); emoji is the special',
  },
  {
    input: 'abc123😀',
    valid: false,
    note: '7 code points, even though 8 UTF-16 units',
  },
  { input: passwordOfLength(128), valid: true, note: '128 code points' },
  { input: passwordOfLength(129), valid: false, note: '129 code points' },
];

export const NAME_VECTORS: Vector[] = [
  { input: '  Al  ', valid: false, note: '2 code points after trim' },
  { input: 'Ali', valid: true, note: 'ASCII' },
  { input: 'علي', valid: true, note: 'Arabic' },
  { input: 'Ali\u0000', valid: false, note: 'control character' },
  { input: 'Al\uD800', valid: false, note: 'lone surrogate' },
  { input: codePoints(50), valid: true, note: '50 code points' },
  { input: codePoints(51), valid: false, note: '51 code points' },
];

/** 64 + 1 + 63 + 1 + 63 + 1 + 58 + 4 = 255 characters, otherwise well-formed. */
const EMAIL_255 = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(58)}.com`;

export const EMAIL_VECTORS: (Vector & { normalized?: string })[] = [
  {
    input: '  User@Mail.com ',
    valid: true,
    normalized: 'user@mail.com',
    note: 'trimmed and lowercased',
  },
  { input: 'a@b.co', valid: true, note: 'short' },
  { input: 'user@mail', valid: false, note: 'no TLD' },
  { input: 'no-at-sign', valid: false, note: 'no @' },
  { input: 'user@@mail.com', valid: false, note: 'double @' },
  { input: EMAIL_255, valid: false, note: '255 characters' },
];
