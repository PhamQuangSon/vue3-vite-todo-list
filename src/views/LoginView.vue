<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSubmitError } from '@/composables/useSubmitError'
import { safeRedirect } from '@/lib/redirect'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const submitError = useSubmitError()

const email = ref('')
const password = ref('')
const submitting = ref(false)

/** Why the interceptor sent them here, if it did. */
const signedOutReason = computed(() => {
  switch (route.query.reason) {
    case 'reused':
      return 'You were signed out because this session was used from somewhere else.'
    case 'expired':
      return 'Your session expired. Please sign in again.'
    default:
      return null
  }
})

// Mirrors LoginDto, which validates the email but puts NO length rule on the
// password — a short one is a 401, not a 400, so blocking it here would tell
// the user something the API does not actually say.
const emailLooksValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const canSubmit = computed(
  () =>
    emailLooksValid.value &&
    password.value.length > 0 &&
    !submitting.value &&
    !submitError.waiting.value,
)

async function onSubmit() {
  if (!canSubmit.value) return

  submitting.value = true
  submitError.clear()

  try {
    await auth.login({ email: email.value.trim(), password: password.value })
    await router.replace(safeRedirect(route.query.redirect) ?? { name: 'todos' })
  } catch (e) {
    submitError.set(e)
    password.value = ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center p-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Your todos are private to your account.</CardDescription>
      </CardHeader>

      <CardContent>
        <Alert v-if="signedOutReason && !submitError.message" class="mb-4">
          <AlertDescription>{{ signedOutReason }}</AlertDescription>
        </Alert>

        <Alert
          v-if="submitError.message"
          variant="destructive"
          class="mb-4"
          data-test="login-error"
        >
          <AlertDescription>{{ submitError.message }}</AlertDescription>
        </Alert>

        <form class="grid gap-4" novalidate @submit.prevent="onSubmit">
          <div class="grid gap-1.5">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              data-test="email"
            />
          </div>

          <div class="grid gap-1.5">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              data-test="password"
            />
          </div>

          <Button type="submit" :disabled="!canSubmit" data-test="submit">
            {{ submitting ? 'Signing in…' : 'Sign in' }}
          </Button>
        </form>

        <p class="text-muted-foreground mt-4 text-sm">
          No account yet?
          <RouterLink :to="{ name: 'register' }" class="text-foreground underline">
            Create one
          </RouterLink>
        </p>
      </CardContent>
    </Card>
  </main>
</template>
