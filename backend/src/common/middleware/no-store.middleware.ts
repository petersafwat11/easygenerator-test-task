import type { NextFunction, Request, Response } from 'express';

/** Route prefixes whose responses carry identity and must never be cached. */
export const NO_STORE_PATHS = ['/api/auth', '/api/users'];

/**
 * Applied at the Express level before the body parser and every check, so the
 * header is present on every answer from these routes, including early
 * failures (malformed JSON, oversized body, 415, 403) and 401s from the guard.
 */
export function noStore(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
