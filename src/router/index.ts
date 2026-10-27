import { createRouter, createWebHistory } from 'vue-router'
import { safeRedirect } from '@/lib/redirect'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable without a session. Everything else requires one. */
    public?: boolean
    /** Only for signed-out visitors; a signed-in one is sent to the app. */
    guestOnly?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { public: true, guestOnly: true },
    },
    {
      path: '/',
      name: 'todos',
      component: () => import('@/views/TodosView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { public: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Memoized, so this is at most one network call per page load, and the guard
  // is never asked to decide against a half-known auth state.
  await auth.bootstrap()

  // Default deny. `meta.requiresAuth` would make protection opt-in, which means
  // the next route someone adds is public by accident.
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return safeRedirect(to.query.redirect) ?? { name: 'todos' }
  }

  return true
})

export default router
