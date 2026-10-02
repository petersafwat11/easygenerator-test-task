const CONNECTIVITY_ERROR_NAMES = new Set([
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoServerSelectionError',
  'MongooseServerSelectionError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
  'MongoPoolClearedError',
  'MongoServerClosedError',
]);

/** True when the database is unreachable, as opposed to rejecting one operation. */
export function isDbConnectivityError(error: unknown): boolean {
  return error instanceof Error && CONNECTIVITY_ERROR_NAMES.has(error.name);
}

/** True only for a duplicate-key error (E11000) on the given indexed field. */
export function isDuplicateKeyError(error: unknown, field: string): boolean {
  if (!(error instanceof Error)) return false;
  const { code, keyPattern } = error as Error & {
    code?: unknown;
    keyPattern?: Record<string, unknown>;
  };
  return code === 11000 && keyPattern !== undefined && field in keyPattern;
}
