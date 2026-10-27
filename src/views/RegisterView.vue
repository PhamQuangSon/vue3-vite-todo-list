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

// Mirrors RegisterDto: @IsEmail, and @MinLength(8) @MaxLength(72) on the
// password. Checking here saves a round-trip; the API checks it regardless.
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

const emailLooksValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const passwordLengthOk = computed(
  () => password.value.length >= PASSWORD_MIN && password.value.length <= PASSWORD_MAX,
)
const canSubmit = computed(
  () =>
    emailLooksValid.value &&
    passwordLengthOk.value &&
    !submitting.value &&
    !submitError.waiting.value,
)

async function onSubmit() {
  if (!canSubmit.value) return

  submitting.value = true
  submitError.clear()

  try {
    await auth.register({ email: email.value.trim(), password: password.value })
    await router.replace(safeRedirect(route.query.redirect) ?? { name: 'todos' })
  } catch (e) {
    submitError.set(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center p-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>The free plan includes 50 todos.</CardDescription>
      </CardHeader>

      <CardContent>
        <Alert
          v-if="submitError.message"
          variant="destructive"
          class="mb-4"
          data-test="register-error"
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
              autocomplete="new-password"
              required
              data-test="password"
            />
            <p class="text-muted-foreground text-xs">At least {{ PASSWORD_MIN }} characters.</p>
          </div>

          <Button type="submit" :disabled="!canSubmit" data-test="submit">
            {{ submitting ? 'Creating account…' : 'Create account' }}
          </Button>
        </form>

        <p class="text-muted-foreground mt-4 text-sm">
          Already registered?
          <RouterLink :to="{ name: 'login' }" class="text-foreground underline">Sign in</RouterLink>
        </p>
      </CardContent>
    </Card>
  </main>
</template>
