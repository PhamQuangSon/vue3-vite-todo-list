import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { setupInterceptors } from '../interceptors'
import { authApi } from '../authApi'
import { setUnauthenticatedHandler, type UnauthenticatedReason } from '../unauthenticated'
import { useAuthStore } from '@/stores/auth'
import { signFake } from '../../../test/helpers/token'
import { axiosErrorWith } from '../../../test/helpers/axios'

vi.mock('@/api/authApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../authApi')>()
  return {
    ...actual,
    authApi: { login: vi.fn(), register: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
  }
})

const mockedApi = vi.mocked(authApi)

function ok<T>(config: InternalAxiosRequestConfig, data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}

function unauthorized(config: InternalAxiosRequestConfig) {
  return axiosErrorWith(
    401,
    { code: 'UNAUTHENTICATED', message: 'Unauthorized Exception' },
    {},
    config,
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/** Far-future expiry, so nothing refreshes pre-emptively unless asked. */
const VALID = signFake({ sub: 'user-1' })
const ROTATED = signFake({ sub: 'user-1', sid: 'session-2' })
const EXPIRED = signFake({ sub: 'user-1', exp: 1_000 })

describe('axios interceptors', () => {
  let api: AxiosInstance
  let pinia: Pinia
  let calls: string[]
  let onUnauthenticated: Mock<(reason: UnauthenticatedReason) => void>

  /**
   * Builds an instance whose adapter stands in for the API: anything but the
   * rotated bearer is rejected with a 401, and /auth/refresh hands back the
   * rotated token once `gate` is released.
   */
  function mountApi(options: { gate?: Promise<void> } = {}) {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      calls.push(`${(config.method ?? 'get').toUpperCase()} ${config.url}`)

      if (config.url === '/auth/refresh') {
        if (options.gate) await options.gate
        return ok(config, { accessToken: ROTATED })
      }

      if (config.headers.get('Authorization') !== `Bearer ${ROTATED}`) throw unauthorized(config)
      return ok(config, { items: [], nextCursor: null })
    })

    api = axios.create({ baseURL: 'http://api.test/api/v1', adapter })
    setupInterceptors(api, pinia)

    // Route the store's refresh through this same instance, so the test also
    // exercises the interceptors' /auth/* skip rules.
    mockedApi.refresh.mockImplementation(async () => {
      const { data } = await api.post<{ accessToken: string }>('/auth/refresh', null, {
        withCredentials: true,
      })
      return data.accessToken
    })

    return adapter
  }

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    localStorage.clear()
    calls = []
    onUnauthenticated = vi.fn<(reason: UnauthenticatedReason) => void>()
    setUnauthenticatedHandler(onUnauthenticated)
  })

  it('shares one refresh across several concurrent 401s', async () => {
    const gate = deferred<void>()
    mountApi({ gate: gate.promise })
    useAuthStore(pinia).$patch({ accessToken: VALID })

    const inflight = Promise.all(Array.from({ length: 5 }, () => api.get('/todos')))
    // Let all five reach the adapter, 401, and queue behind the refresh.
    await flushPromises()
    gate.resolve()
    const results = await inflight

    expect(calls.filter((c) => c.includes('/auth/refresh'))).toHaveLength(1)
    expect(results).toHaveLength(5)
    // Five original attempts plus five replays.
    expect(calls.filter((c) => c.includes('/todos'))).toHaveLength(10)
    expect(useAuthStore(pinia).accessToken).toBe(ROTATED)
  })

  it('replays the request with the new token, not the stale one', async () => {
    const adapter = mountApi()
    useAuthStore(pinia).$patch({ accessToken: VALID })

    await api.get('/todos')

    const todoCalls = adapter.mock.calls
      .map(([config]) => config)
      .filter((config) => config.url === '/todos')

    expect(todoCalls).toHaveLength(2)
    expect(todoCalls[0].headers.get('Authorization')).toBe(`Bearer ${VALID}`)
    expect(todoCalls[1].headers.get('Authorization')).toBe(`Bearer ${ROTATED}`)
  })

  it('preserves the method, body and If-Match header on the replay', async () => {
    const adapter = mountApi()
    useAuthStore(pinia).$patch({ accessToken: VALID })

    await api.patch('/todos/abc', { title: 'renamed' }, { headers: { 'If-Match': '"7"' } })

    const replay = adapter.mock.calls.map(([c]) => c).at(-1)!

    expect(replay.method?.toLowerCase()).toBe('patch')
    expect(replay.data).toContain('renamed')
    expect(replay.headers.get('If-Match')).toBe('"7"')
  })

  it('retries exactly once, then gives up', async () => {
    // The refresh succeeds but hands back a token the adapter still rejects.
    mountApi()
    mockedApi.refresh.mockResolvedValue(signFake({ sub: 'still-wrong' }))
    useAuthStore(pinia).$patch({ accessToken: VALID })

    await expect(api.get('/todos')).rejects.toBeDefined()

    expect(mockedApi.refresh).toHaveBeenCalledTimes(1)
    expect(calls.filter((c) => c.includes('/todos'))).toHaveLength(2)
  })

  it('does not try to refresh a 401 from /auth/login — that is a wrong password', async () => {
    api = axios.create({
      baseURL: 'http://api.test/api/v1',
      adapter: vi.fn(async (config: InternalAxiosRequestConfig) => {
        throw axiosErrorWith(401, { code: 'INVALID_CREDENTIALS' }, {}, config)
      }),
    })
    setupInterceptors(api, pinia)

    await expect(
      api.post('/auth/login', { email: 'a@b.test', password: 'nope' }),
    ).rejects.toBeDefined()

    expect(mockedApi.refresh).not.toHaveBeenCalled()
    expect(onUnauthenticated).not.toHaveBeenCalled()
  })

  it('does not recurse when /auth/refresh itself returns 401', async () => {
    api = axios.create({
      baseURL: 'http://api.test/api/v1',
      adapter: vi.fn(async (config: InternalAxiosRequestConfig) => {
        calls.push(config.url ?? '')
        if (config.url === '/auth/refresh') {
          throw axiosErrorWith(401, { code: 'REFRESH_TOKEN_INVALID' }, {}, config)
        }
        throw unauthorized(config)
      }),
    })
    setupInterceptors(api, pinia)
    mockedApi.refresh.mockImplementation(async () => {
      const { data } = await api.post<{ accessToken: string }>('/auth/refresh', null, {
        withCredentials: true,
      })
      return data.accessToken
    })
    useAuthStore(pinia).$patch({ accessToken: VALID })

    await expect(api.get('/todos')).rejects.toBeDefined()

    expect(calls.filter((c) => c === '/auth/refresh')).toHaveLength(1)
    expect(useAuthStore(pinia).isAuthenticated).toBe(false)
    expect(onUnauthenticated).toHaveBeenCalledTimes(1)
    expect(onUnauthenticated).toHaveBeenCalledWith('expired')
  })

  it('reports a replayed refresh token with its own reason', async () => {
    mountApi()
    mockedApi.refresh.mockRejectedValue(axiosErrorWith(401, { code: 'REFRESH_TOKEN_REUSED' }))
    useAuthStore(pinia).$patch({ accessToken: VALID })

    await expect(api.get('/todos')).rejects.toBeDefined()

    expect(onUnauthenticated).toHaveBeenCalledWith('reused')
  })

  it('does NOT sign out when the refresh is rate limited', async () => {
    mountApi()
    mockedApi.refresh.mockRejectedValue(
      axiosErrorWith(429, { code: 'RATE_LIMITED' }, { 'retry-after': '30' }),
    )
    useAuthStore(pinia).$patch({ accessToken: VALID })

    await expect(api.get('/todos')).rejects.toBeDefined()

    // The anonymous limit covers login, register, refresh and logout together
    // at 20/min per IP, so treating a 429 as "signed out" would log people out
    // for reloading too often.
    expect(useAuthStore(pinia).isAuthenticated).toBe(true)
    expect(onUnauthenticated).not.toHaveBeenCalled()
  })

  it('surfaces the original failure, not the refresh failure', async () => {
    mountApi()
    mockedApi.refresh.mockRejectedValue(axiosErrorWith(429, { code: 'RATE_LIMITED' }))
    useAuthStore(pinia).$patch({ accessToken: VALID })

    await expect(api.get('/todos')).rejects.toMatchObject({
      response: { data: { code: 'UNAUTHENTICATED' } },
    })
  })

  it('refreshes before sending when the token is about to expire', async () => {
    mountApi()
    useAuthStore(pinia).$patch({ accessToken: EXPIRED })

    await api.get('/todos')

    // One refresh, and /todos is called once — no 401 round-trip was needed.
    expect(mockedApi.refresh).toHaveBeenCalledTimes(1)
    expect(calls.filter((c) => c.includes('/todos'))).toHaveLength(1)
  })

  it('leaves errors other than 401 alone', async () => {
    api = axios.create({
      baseURL: 'http://api.test/api/v1',
      adapter: vi.fn(async (config: InternalAxiosRequestConfig) => {
        throw axiosErrorWith(403, { code: 'QUOTA_EXCEEDED', limit: 50 }, {}, config)
      }),
    })
    setupInterceptors(api, pinia)
    useAuthStore(pinia).$patch({ accessToken: VALID })

    await expect(api.post('/todos', { title: 'one too many' })).rejects.toMatchObject({
      response: { data: { code: 'QUOTA_EXCEEDED' } },
    })

    expect(mockedApi.refresh).not.toHaveBeenCalled()
  })

  it('sends no Authorization header, and does not refresh, for a caller that was never signed in', async () => {
    const adapter = mountApi()

    await expect(api.get('/todos')).rejects.toBeDefined()

    const [config] = adapter.mock.calls[0]
    expect(config.headers.get('Authorization')).toBeFalsy()
    // No token and no session hint: refreshing would spend one of the API's 20
    // anonymous requests per minute per IP to be told what we already know.
    expect(mockedApi.refresh).not.toHaveBeenCalled()
    expect(calls.filter((c) => c.includes('/todos'))).toHaveLength(1)
  })

  it('still recovers when the token was lost but a cookie plausibly exists', async () => {
    mountApi()
    // A reload drops the in-memory token; the hint says a cookie survived.
    localStorage.setItem('auth.hint', JSON.stringify({ email: 'a@b.test' }))

    await expect(api.get('/todos')).resolves.toBeDefined()

    expect(mockedApi.refresh).toHaveBeenCalledTimes(1)
    expect(useAuthStore(pinia).accessToken).toBe(ROTATED)
  })
})
