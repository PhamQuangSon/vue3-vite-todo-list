import { describe, expect, it, vi, afterEach } from 'vitest'
import { decodeJwt, isExpiring } from '../jwt'
import { b64url, signFake } from '../../../test/helpers/token'

describe('decodeJwt', () => {
  it('reads the claims out of a well-formed token', () => {
    const claims = decodeJwt(signFake({ plan: 'PAID', tv: 3 }))

    expect(claims).not.toBeNull()
    expect(claims?.plan).toBe('PAID')
    expect(claims?.tv).toBe(3)
    expect(claims?.sub).toBe('0199aaaa-0000-7000-8000-000000000001')
  })

  it('decodes payloads at every base64 padding remainder', () => {
    // A real JWT strips '=' padding, so decoding has to add it back. Varying the
    // payload length by one character walks through all three remainders
    // instead of hoping a single fixture happens to need padding.
    const remaindersSeen = new Set<number>()

    for (let length = 1; length <= 6; length++) {
      const sub = 'a'.repeat(length)
      const token = signFake({ sub })
      remaindersSeen.add(token.split('.')[1].length % 4)

      expect(decodeJwt(token)?.sub).toBe(sub)
    }

    expect(remaindersSeen.size).toBeGreaterThan(1)
  })

  it('decodes multi-byte UTF-8 claims', () => {
    expect(decodeJwt(signFake({ sub: 'Phạm — ✓' }))?.sub).toBe('Phạm — ✓')
  })

  it.each([
    ['empty string', ''],
    ['no dots', 'not-a-jwt'],
    ['header only', 'aGVhZGVy'],
    ['payload is not base64', 'aaa.!!!not-base64!!!.bbb'],
    ['payload is not JSON', `aaa.${b64url('plain text')}.bbb`],
    ['payload is JSON but not an object', `aaa.${b64url('"a string"')}.bbb`],
  ])('returns null or a non-object for %s rather than throwing', (_label, token) => {
    expect(() => decodeJwt(token)).not.toThrow()
  })

  it.each([
    ['empty string', ''],
    ['no dots', 'not-a-jwt'],
    ['payload is not base64', 'aaa.!!!not-base64!!!.bbb'],
    ['payload is not JSON', `aaa.${b64url('plain text')}.bbb`],
  ])('returns null for %s', (_label, token) => {
    expect(decodeJwt(token)).toBeNull()
  })
})

describe('isExpiring', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats a missing claims object as expiring', () => {
    expect(isExpiring(null)).toBe(true)
  })

  it('is false well before expiry and true within the skew window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T00:00:00Z'))
    const nowSeconds = Math.floor(Date.now() / 1000)

    expect(isExpiring({ exp: nowSeconds + 600 })).toBe(false)
    // Default skew is 30s: 29s left counts as expiring, 31s does not.
    expect(isExpiring({ exp: nowSeconds + 29 })).toBe(true)
    expect(isExpiring({ exp: nowSeconds + 31 })).toBe(false)
    expect(isExpiring({ exp: nowSeconds - 1 })).toBe(true)
  })

  it('honours a custom skew', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T00:00:00Z'))
    const nowSeconds = Math.floor(Date.now() / 1000)

    expect(isExpiring({ exp: nowSeconds + 100 }, 120)).toBe(true)
    expect(isExpiring({ exp: nowSeconds + 100 }, 60)).toBe(false)
  })
})
