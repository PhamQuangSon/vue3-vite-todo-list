import { computed, onUnmounted, ref } from 'vue'
import { toApiError } from '@/api/errors'
import { messageFor } from '@/api/messages'
import type { ApiError } from '@/types/api'

/**
 * Holds the error from a form submission, and counts down when the API says to
 * wait.
 *
 * Both rate-limit answers carry a delay: the per-account login lockout
 * (TOO_MANY_LOGIN_ATTEMPTS, up to an hour) and the per-IP throttle
 * (RATE_LIMITED). A static "try again in 600 seconds" is worse than useless —
 * the number is stale the moment it renders — so the message recomputes from a
 * live counter and the form stays disabled until it reaches zero.
 */
export function useSubmitError() {
  const error = ref<ApiError | null>(null)
  const secondsLeft = ref(0)

  let timer: ReturnType<typeof setInterval> | undefined

  function stopTimer() {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  function set(e: unknown) {
    const apiError = toApiError(e)
    error.value = apiError
    stopTimer()

    if (apiError.retryAfter && apiError.retryAfter > 0) {
      secondsLeft.value = apiError.retryAfter
      timer = setInterval(() => {
        secondsLeft.value -= 1
        if (secondsLeft.value <= 0) stopTimer()
      }, 1000)
    } else {
      secondsLeft.value = 0
    }
  }

  function clear() {
    error.value = null
    secondsLeft.value = 0
    stopTimer()
  }

  const message = computed(() => {
    if (!error.value) return null
    return secondsLeft.value > 0
      ? messageFor({ ...error.value, retryAfter: secondsLeft.value })
      : messageFor(error.value)
  })

  /** True while the API has told us to wait. */
  const waiting = computed(() => secondsLeft.value > 0)

  onUnmounted(stopTimer)

  return { error, message, waiting, secondsLeft, set, clear }
}
