import type { AccessTokenClaims } from '@/types/auth'

/**
 * Reads a JWT's payload.
 *
 * This DOES NOT VERIFY the signature, and a browser cannot: the HS256 secret
 * exists only on the server. Use the result for UI decisions — which plan badge
 * to render, whether to refresh early — and nothing else. Every authorization
 * decision belongs to the API, which does verify.
 *
 * Returns null for anything malformed rather than throwing, because callers
 * read it from a computed() during render.
 */
export function decodeJwt<T = AccessTokenClaims>(token: string): T | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null

    // base64url → base64, then pad to a multiple of 4.
    let b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4)

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null
  }
}

/**
 * Whether a token is within `skewSeconds` of expiring (or already has).
 * Used to refresh ahead of a request instead of paying a 401 round-trip.
 */
export function isExpiring(claims: Pick<AccessTokenClaims, 'exp'> | null, skewSeconds = 30) {
  if (!claims || typeof claims.exp !== 'number') return true
  // `exp` is in seconds; Date.now() is in milliseconds.
  return claims.exp * 1000 - Date.now() <= skewSeconds * 1000
}
