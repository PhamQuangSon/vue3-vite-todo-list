import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'

import App from './App.vue'
import router from './router'
import api from './config/axios'
import { setupInterceptors } from './api/interceptors'
import { setUnauthenticatedHandler } from './api/unauthenticated'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale after 30s; background refetch when user re-focuses the tab.
      staleTime: 30_000,
      // Don't retry on 4xx — the error is deterministic, not transient.
      retry: (count, err) => {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status && status >= 400 && status < 500) return false
        return count < 2
      },
    },
  },
})
app.use(VueQueryPlugin, { queryClient })

// Before the router, so the first navigation already has a working bearer.
setupInterceptors(api, pinia)

// Installed here, rather than imported inside the interceptor, to avoid the
// cycle router → views → store → api → router.
setUnauthenticatedHandler((reason) => {
  router.replace({ name: 'login', query: { reason } })
})

app.use(router)

// Deliberately no await before mount. Restoring the session is one network call
// and it is awaited inside the router guard instead, which gives the same
// guarantee — navigation never sees a half-known auth state — without blocking
// the first paint on a request that might time out.
app.mount('#app')
