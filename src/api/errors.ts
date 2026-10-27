import axios from 'axios'
import type { ApiError, ApiErrorBody } from '@/types/api'

/**
 * Turns anything thrown by axios into the shape the UI renders from.
 * Network failures and timeouts become NETWORK_ERROR so callers never have to
 * ask whether `response` exists.
 */
export function toApiError(e: unknown): ApiError {
  if (!axios.isAxiosError(e) || !e.response) {
    return {
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.',
    }
  }

  const body = e.response.data as Partial<ApiErrorBody> | undefined
  const status = e.response.status

  // Prefer the Retry-After header over the body field: the API exposes it via
  // CORS exposedHeaders, and the throttler sets it where the body has nothing.
  const header = Number(e.response.headers?.['retry-after'])
  const retryAfter = Number.isFinite(header) && header > 0 ? header : body?.retryAfter

  return {
    status,
    code: body?.code ?? 'INTERNAL_ERROR',
    message: Array.isArray(body?.message)
      ? body.message.join('. ')
      : (body?.message ?? 'Something went wrong.'),
    retryAfter,
    current: body?.current,
    limit: body?.limit,
  }
}

/** A 401 means "there is no session", and only that justifies signing out. */
export function isUnauthenticated(e: unknown): boolean {
  return axios.isAxiosError(e) && e.response?.status === 401
}

/** A 429 means "come back later" — never a reason to clear the session. */
export function isRateLimited(e: unknown): boolean {
  return axios.isAxiosError(e) && e.response?.status === 429
}
