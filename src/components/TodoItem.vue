<template>
  <div class="border rounded-lg mb-2 overflow-hidden">
    <div class="flex items-center justify-between p-4 cursor-pointer" @click="toggleExpanded">
      <div class="flex items-center">
        <input
          type="checkbox"
          :checked="todo.completed"
          @change="toggleCompleted"
          @click.stop
          class="mr-2"
        />
        <span :class="{ 'line-through': todo.completed }">{{ todo.title }}</span>
      </div>
      <span class="text-sm text-gray-500">{{ formatDate(todo.createdAt) }}</span>
    </div>
    <div v-if="expanded" class="p-4 bg-gray-100">
      <div v-if="userRole === 'paid'" class="mb-2">
        <label for="notes" class="block text-sm font-medium text-gray-700">Notes:</label>
        <textarea
          id="notes"
          v-model="localNotes"
          @blur="updateNotes"
          rows="3"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          placeholder="Add notes here..."
        ></textarea>
      </div>
      <button @click="deleteTodo" class="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">
        Delete
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
import type { TodoItem as TodoItemType } from '../types/todo'

export default defineComponent({
  name: 'TodoItem',
  props: {
    todo: {
      type: Object as () => TodoItemType,
      required: true,
    },
    userRole: {
      type: String,
      required: true,
    },
  },
  emits: ['update-todo', 'delete-todo'],
  setup(props, { emit }) {
    const expanded = ref(false)
    const localNotes = ref(props.todo.notes || '')

    watch(
      () => props.todo.notes,
      (newNotes) => {
        localNotes.value = newNotes || ''
      },
    )

    const toggleExpanded = () => {
      expanded.value = !expanded.value
    }

    const toggleCompleted = () => {
      emit('update-todo', { ...props.todo, completed: !props.todo.completed })
    }

    const updateNotes = () => {
      if (props.todo.notes !== localNotes.value) {
        emit('update-todo', { ...props.todo, notes: localNotes.value })
      }
    }

    const deleteTodo = () => {
      emit('delete-todo', props.todo.id)
    }

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString()
    }

    return {
      expanded,
      localNotes,
      toggleExpanded,
      toggleCompleted,
      updateNotes,
      deleteTodo,
      formatDate,
    }
  },
})
</script>
