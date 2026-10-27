import type { AccessTokenClaims } from '@/types/auth'

/**
 * base64url, the way a JWT library does it: UTF-8 bytes first, then base64,
 * then the URL-safe alphabet with padding stripped. Encoding the string
 * straight through btoa() would throw on any character above U+00FF.
 */
export function b64url(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * A structurally valid access token with a bogus signature. Enough for code
 * that only reads claims — which is all the client ever does, since verifying
 * needs the server's secret.
 */
export function signFake(claims: Partial<AccessTokenClaims> = {}): string {
  const payload: AccessTokenClaims = {
    sub: '0199aaaa-0000-7000-8000-000000000001',
    plan: 'FREE',
    tv: 0,
    sid: '0199bbbb-0000-7000-8000-000000000002',
    iat: 1_700_000_000,
    // Far future, so nothing refreshes pre-emptively unless a test asks for it.
    exp: 4_000_000_000,
    ...claims,
  }
  return [
    b64url('{"alg":"HS256","typ":"JWT"}'),
    b64url(JSON.stringify(payload)),
    'not-a-real-signature',
  ].join('.')
}
