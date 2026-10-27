export type Plan = 'FREE' | 'PAID'

/**
 * Payload of the API's access token.
 *
 * The API has no /me endpoint, by design: embedding `plan` in the token is what
 * lets it authorize a request without touching the database. So the only way
 * for this app to know who is signed in is to read these claims.
 */
export interface AccessTokenClaims {
  /** User id (uuid v7). */
  sub: string
  plan: Plan
  /** Token version, bumped server-side to revoke every token for a user. */
  tv: number
  /** Session id of the refresh-token lineage this access token came from. */
  sid: string
  /** Issued at, in SECONDS since the epoch. */
  iat: number
  /** Expiry, in SECONDS since the epoch. Access tokens live 15 minutes. */
  exp: number
}

export interface AuthTokenResponse {
  accessToken: string
}
