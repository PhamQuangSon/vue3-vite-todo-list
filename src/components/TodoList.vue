<template>
  <div class="bg-white rounded-3xl shadow-lg p-6">
    <!-- Query error -->
    <div v-if="queryError" data-test="error-message" class="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">
      {{ queryError }}
    </div>
    <!-- Mutation error -->
    <div v-else-if="mutationError" data-test="error-message" class="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">
      {{ mutationError }}
    </div>

    <!-- 412 conflict banner ───────────────────────────────────────────────── -->
    <div
      v-if="conflictState"
      data-test="conflict-banner"
      class="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg"
    >
      <p class="text-sm font-medium text-amber-800">
        This todo was updated somewhere else (now at version {{ conflictState.serverVersion }}).
      </p>
      <div class="mt-2 flex gap-2">
        <button
          @click="resolveConflict(true)"
          class="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          data-test="conflict-overwrite"
        >
          Overwrite
        </button>
        <button
          @click="resolveConflict(false)"
          class="px-3 py-1.5 text-sm border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors"
          data-test="conflict-accept"
        >
          Use server version
        </button>
      </div>
    </div>

    <div class="flex justify-between items-center mb-2">
      <h2 class="text-2xl font-medium text-gray-800">Tasks List</h2>
      <button
        @click="showForm = true"
        class="w-8 h-8 flex items-center justify-center rounded-full bg-[#ffd700] hover:bg-[#e6c300] transition-colors"
        data-test="add-todo-button"
      >
        <span class="text-white text-xl">+</span>
      </button>
    </div>
    <p class="text-lg text-gray-800 mb-4">
      You have {{ todos.length }} {{ todos.length === 1 ? 'task' : 'tasks' }}
      <span v-if="hasNextPage" class="text-sm text-gray-400">(showing first {{ todos.length }})</span>
    </p>

    <!-- Todo Form -->
    <TodoForm
      v-if="showForm"
      :plan="plan"
      :todoToEdit="selectedTodo"
      @submit="handleTodoSubmit"
      @cancel="handleFormCancel"
      data-test="todo-form"
    />

    <div v-if="isLoading" class="text-center py-8 text-gray-400">Loading…</div>

    <div v-else class="space-y-4">
      <div
        v-for="todo in todos"
        :key="todo.id"
        data-test="todo-item"
        class="border border-gray-100 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow animate animate-fade-right"
      >
        <!-- Todo Header -->
        <div
          class="flex items-start space-x-3 p-4 bg-white cursor-pointer"
          @click="toggleAccordion(todo)"
          data-test="accordion-toggle"
        >
          <div
            class="w-5 h-5 rounded-full border-2 border-[#ffd700] flex-shrink-0 mt-1 cursor-pointer"
            :class="{ 'bg-[#ffd700]': todo.completed }"
            @click.stop="handleToggle(todo)"
            data-test="todo-checkbox"
          >
            <svg
              v-if="todo.completed"
              viewBox="0 0 24 24"
              class="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div class="flex-1">
            <div class="flex items-baseline justify-between">
              <span
                :class="{
                  'text-lg': true,
                  'line-through text-gray-400': todo.completed,
                  'text-gray-800': !todo.completed,
                }"
                data-test="todo-title"
                >{{ todo.title }}</span
              >
              <div class="flex items-center space-x-2">
                <span class="text-sm text-gray-500" data-test="todo-created-at">{{
                  formatTime(todo.createdAt)
                }}</span>
                <div class="flex space-x-1">
                  <button
                    @click.stop="editTodo(todo)"
                    class="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-[#ffd700] transition-colors"
                    data-test="edit-todo-button"
                  >
                    <Pencil :size="16" />
                  </button>
                  <button
                    @click.stop="handleDelete(todo.id)"
                    class="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                    data-test="delete-todo-button"
                  >
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Accordion content -->
        <div
          v-show="expandedItems.includes(todo.id)"
          data-test="accordion-content"
          class="bg-gray-50 overflow-hidden transition-all duration-200 ease-in-out"
          :class="[expandedItems.includes(todo.id) ? 'opacity-100' : 'opacity-0', 'bg-gray-50']"
        >
          <div
            v-if="expandedItems.includes(todo.id)"
            class="pt-4 px-4 pb-4 border-t border-gray-100 animate animate-fade-up"
          >
            <div v-if="todo.time" class="mb-3">
              <span class="text-sm font-medium text-gray-600">Time:</span>
              <span class="ml-2 text-sm text-gray-500" data-test="todo-time">{{ todo.time }}</span>
            </div>

            <!-- Notes section (PAID only) -->
            <div v-if="plan === 'PAID'" class="space-y-2">
              <p v-if="loadingNoteIds.includes(todo.id)" class="text-sm text-gray-500">
                Loading note…
              </p>
              <div v-else-if="editingNoteId === todo.id">
                <textarea
                  v-model="editingNoteText"
                  rows="3"
                  class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:border-transparent"
                  placeholder="Add a note..."
                  data-test="note-textarea"
                ></textarea>
                <div class="mt-2 flex space-x-2">
                  <button
                    @click="saveNote(todo)"
                    class="px-3 py-1.5 bg-[#ffd700] text-white rounded-lg hover:bg-[#e6c300] transition-colors inline-flex items-center space-x-2"
                    data-test="save-note-button"
                  >
                    <Check :size="16" />
                    <span>Save</span>
                  </button>
                  <button
                    @click="cancelEditNote"
                    class="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center space-x-2"
                    data-test="cancel-note-button"
                  >
                    <X :size="16" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
              <div v-else>
                <div class="flex justify-between items-start">
                  <span class="text-sm font-medium text-gray-600">Notes:</span>
                  <div class="flex space-x-1">
                    <button
                      v-if="todo.notes"
                      @click="editNote(todo)"
                      class="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-[#ffd700] transition-colors"
                      data-test="edit-note-button"
                    >
                      <Pencil :size="14" />
                    </button>
                    <button
                      v-if="todo.notes"
                      @click="handleDeleteNote(todo)"
                      class="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                      data-test="delete-note-button"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>
                <p v-if="todo.notes" class="mt-1 text-sm text-gray-600" data-test="todo-notes">
                  {{ todo.notes }}
                </p>
                <button
                  v-else
                  @click="editNote(todo)"
                  class="mt-1 text-sm text-[#ffd700] hover:text-[#e6c300] transition-colors inline-flex items-center space-x-1"
                  data-test="add-note-button"
                >
                  <Plus :size="14" />
                  <span>Add note</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Load more -->
    <div v-if="hasNextPage" class="mt-6 text-center">
      <button
        @click="fetchNextPage()"
        :disabled="isFetchingNextPage"
        class="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-600 disabled:opacity-50"
        data-test="load-more"
      >
        {{ isFetchingNextPage ? 'Loading…' : 'Load more' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Pencil, Trash2, Plus, Check, X } from '@lucide/vue'
import type { TodoItem } from '../types/todo'
import type { Plan } from '../types/auth'
import type { UpdateTodoPayload } from '../types/todo'
import { useTodos } from '../composables/useTodos'
import TodoForm from './TodoForm.vue'

const props = defineProps<{ plan: Plan }>()

const {
  todos,
  isLoading,
  queryError,
  mutationError,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  loadingNoteIds,
  loadNotes,
  createTodo,
  updateTodo,
  deleteTodo,
  conflictState,
  resolveConflict,
} = useTodos(() => props.plan)

const showForm = ref(false)
const selectedTodo = ref<TodoItem | null>(null)
const expandedItems = ref<string[]>([])
const editingNoteId = ref<string | null>(null)
const editingNoteText = ref('')

function toggleAccordion(todo: TodoItem) {
  const index = expandedItems.value.indexOf(todo.id)
  if (index === -1) {
    expandedItems.value.push(todo.id)
    void loadNotes(todo)
  } else {
    expandedItems.value.splice(index, 1)
  }
}

function handleFormCancel() {
  showForm.value = false
  selectedTodo.value = null
}

function handleTodoSubmit(todoData: UpdateTodoPayload) {
  if (selectedTodo.value) {
    // Pass current version for optimistic concurrency.
    updateTodo(selectedTodo.value.id, todoData, selectedTodo.value.version)
  } else {
    if (!todoData.title) return
    createTodo({ ...todoData, title: todoData.title })
  }
  handleFormCancel()
}

function editTodo(todo: TodoItem) {
  selectedTodo.value = todo
  showForm.value = true
}

function handleToggle(todo: TodoItem) {
  updateTodo(todo.id, { completed: !todo.completed }, todo.version)
}

function handleDelete(id: string) {
  deleteTodo(id)
  expandedItems.value = expandedItems.value.filter((itemId) => itemId !== id)
}

function editNote(todo: TodoItem) {
  editingNoteId.value = todo.id
  editingNoteText.value = todo.notes ?? ''
}

function cancelEditNote() {
  editingNoteId.value = null
  editingNoteText.value = ''
}

function saveNote(todo: TodoItem) {
  updateTodo(todo.id, { notes: editingNoteText.value }, todo.version)
  cancelEditNote()
}

function handleDeleteNote(todo: TodoItem) {
  // Empty string, not undefined: JSON.stringify drops undefined values.
  // null is rejected by the DTO's @IsString() validator.
  updateTodo(todo.id, { notes: '' }, todo.version)
}

function formatTime(date: string) {
  return new Date(date)
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    })
    .toLowerCase()
}
</script>
