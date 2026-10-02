import { readCookie, sessionCookieSettings } from './session-cookie';

describe('sessionCookieSettings', () => {
  it('uses a Secure __Host- cookie in production', () => {
    expect(sessionCookieSettings('production', 28800)).toEqual({
      name: '__Host-session',
      options: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 28_800_000,
      },
    });
  });

  it.each(['development', 'test'] as const)(
    'uses a plain, non-Secure cookie in %s',
    (env) => {
      const { name, options } = sessionCookieSettings(env, 60);
      expect(name).toBe('session');
      expect(options).toMatchObject({
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
      });
    },
  );

  it('never sets a Domain', () => {
    expect(sessionCookieSettings('production', 60).options).not.toHaveProperty(
      'domain',
    );
  });
});

describe('readCookie', () => {
  it('finds a cookie among others', () => {
    expect(readCookie('a=1; session=abc; b=2', 'session')).toBe('abc');
  });

  it('matches the exact name only', () => {
    expect(readCookie('xsession=abc; session2=def', 'session')).toBeUndefined();
  });

  it('keeps "=" inside values', () => {
    expect(readCookie('session=a=b', 'session')).toBe('a=b');
  });

  it('handles a missing header', () => {
    expect(readCookie(undefined, 'session')).toBeUndefined();
  });

  it('takes the first value when the name repeats', () => {
    expect(readCookie('session=first; session=second', 'session')).toBe(
      'first',
    );
  });
});
