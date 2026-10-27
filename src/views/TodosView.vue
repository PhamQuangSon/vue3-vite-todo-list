<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { CircleUserRound } from 'lucide-vue-next'
import TodoList from '@/components/TodoList.vue'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 18) return 'Good Afternoon'
  return 'Good Evening'
})

// The plan comes from the JWT claim now, not from a ?userRole query parameter
// anyone could edit. The prop still speaks the old vocabulary; renaming it is
// part of bringing TodoList itself onto the real API.
const userRole = computed(() => (auth.plan === 'PAID' ? 'paid' : 'free'))

async function onLogout() {
  await auth.logout()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <main class="mx-auto min-w-md max-w-2xl p-4">
    <header class="mb-8 text-center">
      <div class="relative inline-block">
        <div class="mx-auto h-24 w-24 overflow-hidden rounded-full border-4 border-[#e88d8d]">
          <CircleUserRound class="h-full w-full text-gray-400" />
        </div>
      </div>

      <h1 class="mt-4 text-2xl font-bold text-gray-800" data-test="display-name">
        {{ auth.displayName }}
      </h1>
      <p class="text-[#e88d8d] uppercase" data-test="plan">{{ auth.plan }} plan</p>

      <Button
        variant="outline"
        class="mt-3 rounded-full bg-[#e6c795] px-6 py-2 text-gray-800 hover:bg-[#d4b684]"
        data-test="logout"
        @click="onLogout"
      >
        Log Out
      </Button>
    </header>

    <div class="mb-12 text-center">
      <h2 class="text-2xl font-medium text-gray-800">{{ greeting }}</h2>
    </div>

    <TodoList :user-role="userRole" />
  </main>
</template>
