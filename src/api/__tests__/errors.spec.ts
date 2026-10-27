import { describe, expect, it } from 'vitest'
import { isRateLimited, isUnauthenticated, toApiError } from '../errors'
import { messageFor } from '../messages'
import { axiosErrorWith, networkError } from '../../../test/helpers/axios'

describe('toApiError', () => {
  it('reads code, message and the extra fields off the envelope', () => {
    const e = toApiError(
      axiosErrorWith(403, {
        statusCode: 403,
        code: 'QUOTA_EXCEEDED',
        message: 'Forbidden Exception',
        limit: 50,
      }),
    )

    expect(e).toMatchObject({ status: 403, code: 'QUOTA_EXCEEDED', limit: 50 })
  })

  it('joins a validation message array into one string', () => {
    const e = toApiError(
      axiosErrorWith(400, {
        code: 'VALIDATION_FAILED',
        message: ['title should not be empty', 'notes must be shorter than 10000 characters'],
      }),
    )

    expect(e.message).toBe('title should not be empty. notes must be shorter than 10000 characters')
  })

  it('prefers the Retry-After header over the body field', () => {
    const e = toApiError(
      axiosErrorWith(
        429,
        { code: 'TOO_MANY_LOGIN_ATTEMPTS', retryAfter: 3400 },
        {
          'retry-after': '120',
        },
      ),
    )

    expect(e.retryAfter).toBe(120)
  })

  it('falls back to the body field when there is no header', () => {
    const e = toApiError(axiosErrorWith(429, { code: 'TOO_MANY_LOGIN_ATTEMPTS', retryAfter: 90 }))

    expect(e.retryAfter).toBe(90)
  })

  it('reports a request that never got a response as NETWORK_ERROR', () => {
    const e = toApiError(networkError())

    expect(e).toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('handles something that is not an axios error at all', () => {
    expect(toApiError(new Error('boom')).code).toBe('NETWORK_ERROR')
  })
})

describe('isUnauthenticated / isRateLimited', () => {
  it('separates 401 from 429, which is the distinction that keeps users signed in', () => {
    const unauth = axiosErrorWith(401, { code: 'UNAUTHENTICATED' })
    const limited = axiosErrorWith(429, { code: 'RATE_LIMITED' })

    expect(isUnauthenticated(unauth)).toBe(true)
    expect(isUnauthenticated(limited)).toBe(false)
    expect(isRateLimited(limited)).toBe(true)
    expect(isRateLimited(unauth)).toBe(false)
  })
})

describe('messageFor', () => {
  it('never shows the API message for codes where Nest derives it from a class name', () => {
    const copy = messageFor(
      toApiError(
        axiosErrorWith(401, { code: 'INVALID_CREDENTIALS', message: 'Unauthorized Exception' }),
      ),
    )

    expect(copy).toBe('Email or password is incorrect.')
    expect(copy).not.toContain('Exception')
  })

  it('renders a lockout countdown in minutes when it is long', () => {
    const copy = messageFor(
      toApiError(axiosErrorWith(429, { code: 'TOO_MANY_LOGIN_ATTEMPTS', retryAfter: 600 })),
    )

    expect(copy).toContain('10 minutes')
  })

  it('gives a token replay its own explanation rather than "expired"', () => {
    const copy = messageFor(toApiError(axiosErrorWith(401, { code: 'REFRESH_TOKEN_REUSED' })))

    expect(copy).toContain('somewhere else')
  })
})
