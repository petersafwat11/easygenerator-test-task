import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../config/env.validation';

export interface SessionCookieSettings {
  name: string;
  options: CookieOptions;
}

/**
 * Cookie name and flags are derived from NODE_ENV, not toggled separately, so
 * production cannot be misconfigured into an insecure cookie. `__Host-` requires
 * Secure, Path=/ and no Domain, which blocks cookie injection from subdomains.
 */
export function sessionCookieSettings(
  nodeEnv: Env['NODE_ENV'],
  ttlSeconds: number,
): SessionCookieSettings {
  const production = nodeEnv === 'production';
  return {
    name: production ? '__Host-session' : 'session',
    options: {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      path: '/',
      maxAge: ttlSeconds * 1000, // Express takes milliseconds.
    },
  };
}

/** Reads one cookie from the raw header (no cookie-parser needed for a single value). */
export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

@Injectable()
export class SessionCookie {
  private readonly settings: SessionCookieSettings;

  constructor(config: ConfigService<Env, true>) {
    this.settings = sessionCookieSettings(
      config.get('NODE_ENV', { infer: true }),
      config.get('SESSION_TTL_SECONDS', { infer: true }),
    );
  }

  get name(): string {
    return this.settings.name;
  }

  read(req: Request): string | undefined {
    return readCookie(req.headers.cookie, this.settings.name);
  }

  set(res: Response, token: string): void {
    res.cookie(this.settings.name, token, this.settings.options);
  }

  clear(res: Response): void {
    // Same name and attributes as when set, or browsers keep the original cookie.
    const { httpOnly, secure, sameSite, path } = this.settings.options;
    res.clearCookie(this.settings.name, { httpOnly, secure, sameSite, path });
  }
}
