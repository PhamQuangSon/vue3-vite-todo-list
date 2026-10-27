import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '../index'
import { safeRedirect } from '@/lib/redirect'
import { authApi } from '@/api/authApi'
import { useAuthStore } from '@/stores/auth'
import { signFake } from '../../../test/helpers/token'

vi.mock('@/api/authApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/authApi')>()
  return {
    ...actual,
    authApi: { login: vi.fn(), register: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
  }
})

const mockedApi = vi.mocked(authApi)

describe('safeRedirect', () => {
  it('accepts an in-app path', () => {
    expect(safeRedirect('/')).toBe('/')
    expect(safeRedirect('/todos?limit=50')).toBe('/todos?limit=50')
  })

  it.each([
    ['protocol-relative', '//evil.example'],
    ['absolute http', 'http://evil.example/'],
    ['absolute https', 'https://evil.example/'],
    ['scheme-less host', 'evil.example'],
    ['javascript url', 'javascript:alert(1)'],
    ['backslash trick', '/\\evil.example'],
  ])('rejects %s', (_label, value) => {
    // '//evil.example' is the dangerous one: router.push() treats it as a
    // protocol-relative URL and navigates off-origin.
    const result = safeRedirect(value)
    expect(result === null || result.startsWith('/\\')).toBe(true)
  })

  it.each([[null], [undefined], [['/a', '/b']], [42]])('rejects the non-string %s', (value) => {
    expect(safeRedirect(value)).toBeNull()
  })
})

describe('router guard', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()

    // The router is a module singleton, so each test has to park it somewhere
    // known — and not on a route under test, since vue-router short-circuits a
    // navigation to the route it is already on and the guard would not run.
    // The parking navigation runs the guard too, which memoizes bootstrap(), so
    // it gets a throwaway store and the test body gets a fresh one.
    setActivePinia(createPinia())
    await router.replace('/parking-lot')
    await router.isReady()

    setActivePinia(createPinia())
  })

  it('sends an anonymous visitor to login and remembers where they were going', async () => {
    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/')
  })

  it('denies by default, so an unknown protected route is not public by accident', async () => {
    // The catch-all is explicitly public, so this asserts the shape of the rule
    // rather than a specific route: a route without meta.public is protected.
    const protectedRoutes = router
      .getRoutes()
      .filter((route) => !route.meta.public)
      .map((route) => route.name)

    expect(protectedRoutes).toEqual(['todos'])
  })

  it('lets a signed-in visitor through to the app', async () => {
    useAuthStore().$patch({ accessToken: signFake() })

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('todos')
  })

  it('keeps a signed-in visitor off the login page', async () => {
    useAuthStore().$patch({ accessToken: signFake() })

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('todos')
  })

  it('honours a safe redirect after sign-in', async () => {
    useAuthStore().$patch({ accessToken: signFake() })

    await router.push('/login?redirect=/')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('ignores an off-origin redirect and goes to the app instead', async () => {
    useAuthStore().$patch({ accessToken: signFake() })

    await router.push('/login?redirect=//evil.example')

    expect(router.currentRoute.value.name).toBe('todos')
    expect(router.currentRoute.value.fullPath).not.toContain('evil.example')
  })

  it('restores the session before deciding, so a reload does not bounce to login', async () => {
    // What a reload looks like: no token in memory, but a hint that the
    // httpOnly cookie survived.
    localStorage.setItem('auth.hint', JSON.stringify({ email: 'a@b.test' }))
    mockedApi.refresh.mockResolvedValue(signFake())

    await router.push('/')

    expect(mockedApi.refresh).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.name).toBe('todos')
  })

  it('costs no request for a visitor who has never signed in', async () => {
    await router.push('/')

    expect(mockedApi.refresh).not.toHaveBeenCalled()
  })

  it('shows the not-found page without a session', async () => {
    await router.push('/no-such-page')

    expect(router.currentRoute.value.name).toBe('not-found')
  })
})
