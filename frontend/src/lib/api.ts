export interface FieldErrorDetail {
  field: string
  messages: string[]
}

/** The backend's single error shape. */
export interface ApiErrorBody {
  statusCode: number
  code: string
  message: string
  details?: FieldErrorDetail[]
  requestId?: string
}

/** The server answered with an error status. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: FieldErrorDetail[]
  readonly requestId?: string

  constructor(status: number, body: Partial<ApiErrorBody> | null) {
    super(body?.message ?? 'Something went wrong. Try again later.')
    this.name = 'ApiError'
    this.status = status
    this.code = body?.code ?? 'UNKNOWN_ERROR'
    this.details = body?.details ?? []
    this.requestId = body?.requestId
  }

  /** 5xx: the service is unhealthy, which is never the same as "signed out". */
  get isServerError(): boolean {
    return this.status >= 500
  }
}

/** The request never got an HTTP answer (offline, DNS, server down behind the proxy...). */
export class NetworkError extends Error {
  constructor() {
    super('Could not reach the server. Check your connection and try again.')
    this.name = 'NetworkError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
}

/**
 * Thin fetch wrapper for our own same-origin API. Mutations always send JSON,
 * which the backend requires (it rejects anything else with 415).
 */
export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new NetworkError()
  }

  if (response.status === 204) return undefined as T

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, data as Partial<ApiErrorBody> | null)
  }
  return data as T
}
