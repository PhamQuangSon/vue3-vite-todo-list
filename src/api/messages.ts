import type { ApiError } from '@/types/api'

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

function waitFor(seconds: number | undefined) {
  if (!seconds) return 'a moment'
  return seconds >= 120 ? plural(Math.ceil(seconds / 60), 'minute') : plural(seconds, 'second')
}

/**
 * Copy for an API error, keyed on `code`.
 *
 * The API's `message` is usually Nest's class name ("Unauthorized Exception"),
 * so it is only rendered for validation errors, where it carries the real
 * detail.
 */
export function messageFor(error: ApiError): string {
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'Email or password is incorrect.'
    case 'EMAIL_TAKEN':
      return 'That email is already registered. Try signing in instead.'
    case 'VALIDATION_FAILED':
      return error.message
    case 'TOO_MANY_LOGIN_ATTEMPTS':
      return `Too many failed attempts for this account. Try again in ${waitFor(error.retryAfter)}.`
    case 'RATE_LIMITED':
      return `Too many requests. Try again in ${waitFor(error.retryAfter)}.`
    case 'QUOTA_EXCEEDED':
      return `You have reached the free plan limit of ${error.limit ?? 50} todos. Delete one to add another.`
    case 'VERSION_CONFLICT':
      return 'This todo changed somewhere else. Reloading the latest version.'
    case 'NOT_FOUND':
      return 'That todo no longer exists.'
    case 'NO_REFRESH_TOKEN':
    case 'REFRESH_TOKEN_INVALID':
      return 'Your session expired. Please sign in again.'
    case 'REFRESH_TOKEN_REUSED':
      // Worth its own copy: the generic "expired" wording makes this look like
      // a bug. It happens when two tabs refresh at the same instant, and the
      // API revokes the whole token family when a refresh token is replayed.
      return 'You were signed out because this session was used from somewhere else. Please sign in again.'
    case 'NETWORK_ERROR':
      return error.message
    default:
      return 'Something went wrong. Please try again.'
  }
}
