<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, useRouter } from 'vue-router'

// The guard awaits a session restore, so the very first navigation can take a
// round-trip. Showing a placeholder beats an empty shell, and it belongs here
// rather than as an await in main.ts, which would block the first paint.
const routerReady = ref(false)
useRouter()
  .isReady()
  .finally(() => {
    routerReady.value = true
  })
</script>

<template>
  <div class="min-h-screen bg-[#f5e6d3]">
    <RouterView v-if="routerReady" />
    <div v-else class="flex min-h-screen items-center justify-center">
      <p class="text-sm text-gray-500">Loading…</p>
    </div>
  </div>
</template>
