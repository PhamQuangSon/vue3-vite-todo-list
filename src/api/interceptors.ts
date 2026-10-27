import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import type { Pinia } from 'pinia'
import { isAuthRoute } from '@/api/authApi'
import { toApiError } from '@/api/errors'
import { notifyUnauthenticated } from '@/api/unauthenticated'
import { isExpiring } from '@/lib/jwt'
import { hasSessionHint } from '@/lib/sessionHint'
import { useAuthStore } from '@/stores/auth'

/** Marks a config that has already been replayed once after a refresh. */
type Retryable = InternalAxiosRequestConfig & { _retried?: boolean }

/**
 * Attaches the bearer token and recovers from an expired one.
 *
 * `pinia` is passed in rather than relying on the active instance. Resolving
 * the store lazily inside each handler does work in the app — by then
 * `app.use(pinia)` has run — but in a unit test there is no app, and the
 * failure surfaces as "getActivePinia() was called but there was no active
 * Pinia" from inside an interceptor, which is a poor place to debug from.
 */
export function setupInterceptors(instance: AxiosInstance, pinia: Pinia): void {
  instance.interceptors.request.use(async (config) => {
    if (isAuthRoute(config.url)) return config

    const auth = useAuthStore(pinia)

    // Access tokens live 15 minutes. Refreshing just before expiry costs the
    // same request as reacting to a 401 but avoids the failed round-trip, and
    // it joins the same single-flight call. Note there is deliberately no
    // background timer: a refresh on a backgrounded tab would spend the API's
    // per-IP anonymous budget for nobody.
    if (auth.accessToken && isExpiring(auth.claims)) {
      try {
        await auth.refresh()
      } catch {
        // Fall through with whatever token we have; the 401 path below is the
        // backstop. Swallowing here keeps a cooldown from failing the request
        // before the server has had a chance to accept the old token.
      }
    }

    if (auth.accessToken) {
      config.headers.set('Authorization', `Bearer ${auth.accessToken}`)
    }

    return config
  })

  instance.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error) || !error.config) throw error

      const config = error.config as Retryable

      // A 401 from /auth/* is never "my access token expired":
      //   /auth/login   → INVALID_CREDENTIALS, the password was wrong
      //   /auth/refresh → there is no usable session to refresh with
      // Refreshing in response to either is meaningless and recursive.
      if (isAuthRoute(config.url)) throw error

      if (error.response?.status !== 401) throw error
      if (config._retried) throw error

      const auth = useAuthStore(pinia)

      // Nothing to recover from for a caller that was never signed in: no
      // token in memory and no hint that a cookie exists. Attempting a refresh
      // here would spend one of the API's 20 anonymous requests per minute per
      // IP to be told what we already know. Routing anonymous users is the
      // guard's job, not this interceptor's.
      if (!auth.accessToken && !hasSessionHint()) throw error

      try {
        await auth.refresh()
      } catch (refreshError: unknown) {
        // The store has already decided whether this ends the session; it only
        // clears on a 401. Mirror that here so a rate-limited or offline client
        // is not navigated away from its work.
        if (!auth.isAuthenticated) {
          const code = toApiError(refreshError).code
          notifyUnauthenticated(code === 'REFRESH_TOKEN_REUSED' ? 'reused' : 'expired')
        }
        // Surface the original failure: the caller asked for /todos and should
        // see what happened to /todos.
        throw error
      }

      config._retried = true
      // Handing the original config back runs the whole chain again, so the
      // request interceptor attaches the NEW token and the method, body and any
      // If-Match header survive untouched. Rebuilding the request by hand here
      // is the classic way to replay it with the stale token still attached.
      return instance(config)
    },
  )
}
