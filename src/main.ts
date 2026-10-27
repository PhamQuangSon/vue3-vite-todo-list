import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import api from './config/axios'
import { setupInterceptors } from './api/interceptors'
import { setUnauthenticatedHandler } from './api/unauthenticated'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

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
