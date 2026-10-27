/**
 * Every error the API returns has this shape, from its global exception filter.
 *
 * Branch on `code`, never on `message`: for an exception thrown as
 * `new UnauthorizedException({ code: 'INVALID_CREDENTIALS' })`, Nest derives the
 * message from the class name, so `message` is literally "Unauthorized
 * Exception". The one case worth rendering is VALIDATION_FAILED, where it is an
 * array of class-validator messages.
 */
export interface ApiErrorBody {
  statusCode: number
  code: string
  message: string | string[]
  /** Request path including the query string. */
  path: string
  timestamp: string
  /** 412 VERSION_CONFLICT: the server's current version of the row. */
  current?: number
  /** 403 QUOTA_EXCEEDED: the plan's limit. */
  limit?: number
  /** 429 TOO_MANY_LOGIN_ATTEMPTS: seconds until the lock clears. */
  retryAfter?: number
}

/** Normalized form the UI works with. */
export interface ApiError {
  status: number
  code: ApiErrorCode
  /** Already flattened: a VALIDATION_FAILED array is joined. */
  message: string
  retryAfter?: number
  current?: number
  limit?: number
}

export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'NO_REFRESH_TOKEN',
  'INVALID_CREDENTIALS',
  'REFRESH_TOKEN_INVALID',
  'REFRESH_TOKEN_REUSED',
  'QUOTA_EXCEEDED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'CONFLICT',
  'VERSION_CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNPROCESSABLE',
  'TOO_MANY_LOGIN_ATTEMPTS',
  'RATE_LIMITED',
  'TIMEOUT',
  'UNAVAILABLE',
  'INTERNAL_ERROR',
  // Client-side only: the request never reached the API.
  'NETWORK_ERROR',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number] | (string & {})
