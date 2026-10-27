import api from '@/config/axios'
import type { AuthTokenResponse } from '@/types/auth'

/**
 * All four calls send credentials, not just refresh and logout.
 *
 * A browser discards Set-Cookie from a CORS response that was not credentialed,
 * so without this on login and register the refresh cookie is never stored and
 * every later refresh fails with NO_REFRESH_TOKEN — while login itself looks
 * perfectly successful.
 */
const withCookie = { withCredentials: true } as const

export interface Credentials {
  email: string
  password: string
}

export const authApi = {
  async register(body: Credentials): Promise<string> {
    const { data } = await api.post<AuthTokenResponse>('/auth/register', body, withCookie)
    return data.accessToken
  },

  async login(body: Credentials): Promise<string> {
    const { data } = await api.post<AuthTokenResponse>('/auth/login', body, withCookie)
    return data.accessToken
  },

  /** Rotates the refresh cookie and returns a fresh access token. */
  async refresh(): Promise<string> {
    const { data } = await api.post<AuthTokenResponse>('/auth/refresh', null, withCookie)
    return data.accessToken
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout', null, withCookie)
  },
}

/** True for any request to the auth routes, which the interceptors must skip. */
export function isAuthRoute(url: string | undefined): boolean {
  if (!url) return false
  return url.startsWith('/auth/') || url.includes('/api/v1/auth/')
}
