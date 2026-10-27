import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi, type Credentials } from '@/api/authApi'
import { isRateLimited, isUnauthenticated, toApiError } from '@/api/errors'
import { decodeJwt } from '@/lib/jwt'
import { withLock } from '@/lib/webLock'
import {
  clearSessionHint,
  hasSessionHint,
  readSessionEmail,
  setSessionHint,
} from '@/lib/sessionHint'
import type { Plan } from '@/types/auth'

/** Refresh is on cooldown after a 429 or a network failure. */
export class RefreshCooldownError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Refresh is on cooldown')
    this.name = 'RefreshCooldownError'
  }
}

/** A refresh resolved after logout cleared the session; its result is discarded. */
export class StaleSessionError extends Error {
  constructor() {
    super('Session was cleared while refreshing')
    this.name = 'StaleSessionError'
  }
}

const COOLDOWN_AFTER_NETWORK_ERROR_MS = 5_000
const DEFAULT_COOLDOWN_SECONDS = 30

export const useAuthStore = defineStore('auth', () => {
  /** In memory only, never persisted. A reload drops it and bootstrap() re-earns it. */
  const accessToken = ref<string | null>(null)
  /** Display only, and untrusted — see lib/sessionHint. */
  const email = ref<string | null>(null)

  // Deliberately plain variables, not refs: nothing renders from them, and the
  // in-flight promise must not be unwrapped by reactivity.
  let refreshPromise: Promise<string> | null = null
  let readyPromise: Promise<void> | null = null
  let refreshBlockedUntil = 0
  /**
   * Bumped whenever the session is deliberately ended. A refresh that was
   * already in flight compares the epoch it started with before writing its
   * result, so clicking Log Out mid-refresh cannot silently sign the user back
   * in with the token that arrives a moment later.
   */
  let sessionEpoch = 0

  const claims = computed(() => (accessToken.value ? decodeJwt(accessToken.value) : null))
  const userId = computed(() => claims.value?.sub ?? null)
  const plan = computed<Plan>(() => claims.value?.plan ?? 'FREE')
  const isAuthenticated = computed(() => claims.value !== null)
  const displayName = computed(() => email.value ?? userId.value?.slice(0, 8) ?? 'account')

  function setSession(token: string, knownEmail?: string) {
    accessToken.value = token
    if (knownEmail) email.value = knownEmail
    setSessionHint(email.value)
    refreshBlockedUntil = 0
  }

  function clearSession() {
    accessToken.value = null
    email.value = null
    clearSessionHint()
    // Nothing to refresh with until someone signs in again, so fail fast
    // instead of spending the API's per-IP anonymous budget finding out.
    refreshBlockedUntil = Number.POSITIVE_INFINITY
  }

  function noteRefreshFailure(e: unknown) {
    if (isUnauthenticated(e)) {
      clearSession()
      return
    }
    if (isRateLimited(e)) {
      const seconds = toApiError(e).retryAfter ?? DEFAULT_COOLDOWN_SECONDS
      refreshBlockedUntil = Date.now() + seconds * 1000
      return
    }
    // Network or timeout: back off briefly rather than retrying in a loop.
    refreshBlockedUntil = Date.now() + COOLDOWN_AFTER_NETWORK_ERROR_MS
  }

  /**
   * Exchanges the refresh cookie for a new access token.
   *
   * Single-flight, and the promise lives here rather than in the interceptor
   * for a correctness reason: bootstrap() and the 401 handler must share one
   * in-flight call. If they could run concurrently, both would read the cookie
   * before either Set-Cookie landed, both would present the same token, and the
   * API would treat the second as a replay and revoke the whole family.
   *
   * Across tabs the same collision is prevented by a Web Lock.
   */
  function refresh(): Promise<string> {
    if (refreshPromise) return refreshPromise

    const blockedFor = refreshBlockedUntil - Date.now()
    if (blockedFor > 0) {
      return Promise.reject(new RefreshCooldownError(Math.ceil(blockedFor / 1000)))
    }

    const epoch = sessionEpoch
    refreshPromise = withLock('auth-refresh', () => authApi.refresh())
      .then((token) => {
        if (epoch !== sessionEpoch) throw new StaleSessionError()
        setSession(token)
        return token
      })
      .catch((e: unknown) => {
        if (!(e instanceof StaleSessionError)) noteRefreshFailure(e)
        throw e
      })
      .finally(() => {
        refreshPromise = null
      })

    return refreshPromise
  }

  async function login(credentials: Credentials): Promise<void> {
    const token = await authApi.login(credentials)
    setSession(token, credentials.email)
  }

  async function register(credentials: Credentials): Promise<void> {
    const token = await authApi.register(credentials)
    setSession(token, credentials.email)
  }

  /** Never throws: a sign-out must not fail because the network did. */
  async function logout(): Promise<void> {
    // Synchronously, before any await, so a refresh already in flight cannot
    // write its token back into a session the user just ended.
    sessionEpoch++
    refreshPromise = null

    try {
      await authApi.logout()
    } catch {
      // The cookie is cleared server-side on a best-effort basis; locally we
      // are signed out either way.
    } finally {
      clearSession()
    }
  }

  /**
   * Restores the session once per page load.
   *
   * Memoized, and awaited by the router guard, so navigation never decides
   * against a half-known auth state. Skipped entirely without a session hint,
   * which is what keeps a never-signed-in visitor from spending one of the
   * API's 20 anonymous requests per minute per IP on a doomed refresh.
   */
  function bootstrap(): Promise<void> {
    readyPromise ??= (() => {
      if (!hasSessionHint()) return Promise.resolve()

      email.value = readSessionEmail()
      return refresh().then(
        () => {},
        () => {
          // Failure just means "anonymous". The guard routes from there, and
          // noteRefreshFailure has already cleared the hint on a 401.
        },
      )
    })()

    return readyPromise
  }

  return {
    accessToken,
    email,
    claims,
    userId,
    plan,
    isAuthenticated,
    displayName,
    login,
    register,
    logout,
    refresh,
    bootstrap,
    clearSession,
  }
})
