import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore, RefreshCooldownError } from '../auth'
import { authApi } from '@/api/authApi'
import { signFake } from '../../../test/helpers/token'
import { axiosErrorWith, networkError } from '../../../test/helpers/axios'

vi.mock('@/api/authApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/authApi')>()
  return {
    ...actual,
    authApi: {
      login: vi.fn(),
      register: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
    },
  }
})

const mockedApi = vi.mocked(authApi)

/** A promise plus the handles to settle it, so a test controls the timing. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('session state', () => {
    it('derives the user, plan and sign-in state from the token claims', async () => {
      mockedApi.login.mockResolvedValue(signFake({ plan: 'PAID', sub: 'user-1' }))
      const auth = useAuthStore()

      expect(auth.isAuthenticated).toBe(false)
      expect(auth.plan).toBe('FREE')

      await auth.login({ email: 'a@b.test', password: 'TestPass123!' })

      expect(auth.isAuthenticated).toBe(true)
      expect(auth.userId).toBe('user-1')
      expect(auth.plan).toBe('PAID')
      expect(auth.displayName).toBe('a@b.test')
    })

    it('records a session hint on sign-in and drops it on sign-out', async () => {
      mockedApi.login.mockResolvedValue(signFake())
      mockedApi.logout.mockResolvedValue(undefined)
      const auth = useAuthStore()

      await auth.login({ email: 'a@b.test', password: 'TestPass123!' })
      expect(localStorage.getItem('auth.hint')).toContain('a@b.test')

      await auth.logout()
      expect(localStorage.getItem('auth.hint')).toBeNull()
    })

    it('falls back to a short user id when no email is known', async () => {
      mockedApi.refresh.mockResolvedValue(signFake({ sub: 'abcdef12-3456-7000-8000-00000000ffff' }))
      const auth = useAuthStore()

      await auth.refresh()

      // A silent refresh returns only a token — the API carries no email.
      expect(auth.email).toBeNull()
      expect(auth.displayName).toBe('abcdef12')
    })
  })

  describe('refresh is single-flight', () => {
    it('shares one network call between concurrent callers', async () => {
      const gate = deferred<string>()
      mockedApi.refresh.mockReturnValue(gate.promise)
      const auth = useAuthStore()

      const callers = [auth.refresh(), auth.refresh(), auth.refresh()]
      gate.resolve(signFake({ sub: 'user-1' }))
      const tokens = await Promise.all(callers)

      expect(mockedApi.refresh).toHaveBeenCalledTimes(1)
      expect(new Set(tokens).size).toBe(1)
      expect(auth.userId).toBe('user-1')
    })

    it('starts a new call once the previous one has settled', async () => {
      mockedApi.refresh.mockResolvedValue(signFake())
      const auth = useAuthStore()

      await auth.refresh()
      await auth.refresh()

      expect(mockedApi.refresh).toHaveBeenCalledTimes(2)
    })
  })

  describe('a refresh that loses a race to logout', () => {
    it('does not sign the user back in', async () => {
      const gate = deferred<string>()
      mockedApi.refresh.mockReturnValue(gate.promise)
      mockedApi.logout.mockResolvedValue(undefined)
      const auth = useAuthStore()

      const refreshing = auth.refresh()
      await auth.logout()
      // The token arrives after the session was deliberately ended.
      gate.resolve(signFake())

      await expect(refreshing).rejects.toThrow('Session was cleared while refreshing')
      expect(auth.accessToken).toBeNull()
      expect(auth.isAuthenticated).toBe(false)
    })
  })

  describe('failure handling', () => {
    it('clears the session on 401, because that means there is no session', async () => {
      mockedApi.login.mockResolvedValue(signFake())
      mockedApi.refresh.mockRejectedValue(axiosErrorWith(401, { code: 'REFRESH_TOKEN_INVALID' }))
      const auth = useAuthStore()
      await auth.login({ email: 'a@b.test', password: 'TestPass123!' })

      await expect(auth.refresh()).rejects.toBeDefined()

      expect(auth.isAuthenticated).toBe(false)
      expect(localStorage.getItem('auth.hint')).toBeNull()
    })

    it('keeps the session on 429 and then fails fast without another request', async () => {
      mockedApi.login.mockResolvedValue(signFake())
      mockedApi.refresh.mockRejectedValue(
        axiosErrorWith(429, { code: 'RATE_LIMITED' }, { 'retry-after': '45' }),
      )
      const auth = useAuthStore()
      await auth.login({ email: 'a@b.test', password: 'TestPass123!' })

      await expect(auth.refresh()).rejects.toBeDefined()

      // Being rate-limited is "come back later", not "you are signed out".
      expect(auth.isAuthenticated).toBe(true)

      await expect(auth.refresh()).rejects.toBeInstanceOf(RefreshCooldownError)
      expect(mockedApi.refresh).toHaveBeenCalledTimes(1)
    })

    it('keeps the session on a network error and backs off', async () => {
      mockedApi.login.mockResolvedValue(signFake())
      mockedApi.refresh.mockRejectedValue(networkError())
      const auth = useAuthStore()
      await auth.login({ email: 'a@b.test', password: 'TestPass123!' })

      await expect(auth.refresh()).rejects.toBeDefined()

      expect(auth.isAuthenticated).toBe(true)
      await expect(auth.refresh()).rejects.toBeInstanceOf(RefreshCooldownError)
      expect(mockedApi.refresh).toHaveBeenCalledTimes(1)
    })

    it('lets a fresh sign-in clear the cooldown', async () => {
      mockedApi.refresh.mockRejectedValue(axiosErrorWith(401, { code: 'NO_REFRESH_TOKEN' }))
      mockedApi.login.mockResolvedValue(signFake())
      mockedApi.logout.mockResolvedValue(undefined)
      const auth = useAuthStore()

      await expect(auth.refresh()).rejects.toBeDefined()
      await expect(auth.refresh()).rejects.toBeInstanceOf(RefreshCooldownError)

      await auth.login({ email: 'a@b.test', password: 'TestPass123!' })
      mockedApi.refresh.mockResolvedValue(signFake({ sub: 'after-login' }))

      await expect(auth.refresh()).resolves.toBeDefined()
      expect(auth.userId).toBe('after-login')
    })

    it('signs out locally even when the logout request fails', async () => {
      mockedApi.login.mockResolvedValue(signFake())
      mockedApi.logout.mockRejectedValue(networkError())
      const auth = useAuthStore()
      await auth.login({ email: 'a@b.test', password: 'TestPass123!' })

      await expect(auth.logout()).resolves.toBeUndefined()
      expect(auth.isAuthenticated).toBe(false)
    })
  })

  describe('bootstrap', () => {
    it('makes no request at all without a session hint', async () => {
      const auth = useAuthStore()

      await auth.bootstrap()

      expect(mockedApi.refresh).not.toHaveBeenCalled()
      expect(auth.isAuthenticated).toBe(false)
    })

    it('restores the session when a hint says a cookie probably exists', async () => {
      localStorage.setItem('auth.hint', JSON.stringify({ email: 'a@b.test' }))
      mockedApi.refresh.mockResolvedValue(signFake({ sub: 'restored' }))
      const auth = useAuthStore()

      await auth.bootstrap()

      expect(auth.userId).toBe('restored')
      expect(auth.email).toBe('a@b.test')
    })

    it('resolves to anonymous, not a rejection, when the cookie is gone', async () => {
      localStorage.setItem('auth.hint', JSON.stringify({ email: 'a@b.test' }))
      mockedApi.refresh.mockRejectedValue(axiosErrorWith(401, { code: 'NO_REFRESH_TOKEN' }))
      const auth = useAuthStore()

      await expect(auth.bootstrap()).resolves.toBeUndefined()
      expect(auth.isAuthenticated).toBe(false)
    })

    it('runs once per page load however many times it is awaited', async () => {
      localStorage.setItem('auth.hint', JSON.stringify({ email: 'a@b.test' }))
      mockedApi.refresh.mockResolvedValue(signFake())
      const auth = useAuthStore()

      await Promise.all([auth.bootstrap(), auth.bootstrap()])
      await auth.bootstrap()

      expect(mockedApi.refresh).toHaveBeenCalledTimes(1)
    })
  })
})
