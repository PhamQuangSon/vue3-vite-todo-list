<template>
  <div class="min-h-screen bg-[#f5e6d3]">
    <div class="max-w-2xl min-w-md mx-auto p-4">
      <!-- Profile Section -->
      <div class="text-center mb-8">
        <div class="relative inline-block">
          <div class="w-24 h-24 rounded-full border-4 border-[#e88d8d] overflow-hidden mx-auto">
            <CircleUserRound class="w-full h-full text-gray-400" />
          </div>
        </div>
        <h1 class="text-2xl font-bold mt-4 text-gray-800">Monica Gamage</h1>
        <p class="text-[#e88d8d]">@monicagamage</p>
        <button
          class="mt-3 px-6 py-2 bg-[#e6c795] text-gray-800 rounded-full hover:bg-[#d4b684] transition-colors"
        >
          Log Out
        </button>
      </div>

      <!-- Clock Section -->
      <div class="text-center mb-12">
        <h2 class="text-2xl font-medium text-gray-800">{{ greeting }}</h2>
      </div>

      <!-- Todo List -->
      <TodoList :userRole="userRole" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from 'vue'
import TodoList from './components/TodoList.vue'
import { CircleUserRound } from 'lucide-vue-next'

export default defineComponent({
  name: 'App',
  components: {
    TodoList,
    CircleUserRound,
  },
  setup() {
    const userRole = ref(new URLSearchParams(window.location.search).get('userRole') || 'free')
    const profileImage = ref('')

    const greeting = computed(() => {
      const hour = new Date().getHours()
      if (hour < 12) return 'Good Morning'
      if (hour < 18) return 'Good Afternoon'
      return 'Good Evening'
    })

    return {
      userRole,
      profileImage,
      greeting,
    }
  },
})
</script>
