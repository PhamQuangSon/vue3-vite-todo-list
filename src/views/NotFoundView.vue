<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
    <h1 class="text-2xl font-bold text-gray-800">Page not found</h1>
    <Button as-child variant="outline">
      <RouterLink :to="{ name: 'todos' }">Back to your todos</RouterLink>
    </Button>
  </main>
</template>
