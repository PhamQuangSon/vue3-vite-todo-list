<template>
  <div class="bg-white rounded-3xl shadow-lg p-6">
    <!-- Error message -->
    <div v-if="error" data-test="error-message" class="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">
      {{ error }}
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

    <div class="space-y-4">
      <div
        v-for="todo in todos"
        :key="todo.id"
        data-test="todo-item"
        class="border border-gray-100 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow animate animate-fade-right"
      >
        <!-- Todo Header - Always visible -->
        <div
          class="flex items-start space-x-3 p-4 bg-white cursor-pointer"
          @click="toggleAccordion(todo)"
          data-test="accordion-toggle"
        >
          <div
            class="w-5 h-5 rounded-full border-2 border-[#ffd700] flex-shrink-0 mt-1 cursor-pointer"
            :class="{ 'bg-[#ffd700]': todo.completed }"
            @click.stop="toggleTodo(todo)"
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
                    <Edit2 :size="16" />
                  </button>
                  <button
                    @click.stop="deleteTodo(todo.id)"
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

        <!-- Todo Details - Expandable Content -->
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
            <!-- Time if available -->
            <div v-if="todo.time" class="mb-3">
              <span class="text-sm font-medium text-gray-600">Time:</span>
              <span class="ml-2 text-sm text-gray-500" data-test="todo-time">{{ todo.time }}</span>
            </div>

            <!-- Notes section -->
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
                      <Edit2 :size="14" />
                    </button>
                    <button
                      v-if="todo.notes"
                      @click="deleteNote(todo)"
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
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, type PropType } from 'vue'
import type { TodoItem, UpdateTodoPayload } from '../types/todo'
import type { Plan } from '../types/auth'
import {
  getTodos,
  getTodo,
  createTodo,
  updateTodo as updateTodoApi,
  deleteTodo as deleteTodoApi,
} from '../services/todoService'
import { toApiError } from '../api/errors'
import { messageFor } from '../api/messages'
import { Edit2, Trash2, Plus, Check, X } from 'lucide-vue-next'
import TodoForm from './TodoForm.vue'

export default defineComponent({
  name: 'TodoList',
  components: {
    TodoForm,
    Edit2,
    Trash2,
    Plus,
    Check,
    X,
  },
  props: {
    /** From the JWT claim, not a query parameter the user can edit. */
    plan: {
      type: String as PropType<Plan>,
      required: true,
    },
  },
  setup(props) {
    const todos = ref<TodoItem[]>([])
    const error = ref<string | null>(null)
    const showForm = ref(false)
    const selectedTodo = ref<TodoItem | null>(null)
    const expandedItems = ref<string[]>([])
    const editingNoteId = ref<string | null>(null)
    const editingNoteText = ref('')
    const loadingNoteIds = ref<string[]>([])

    /**
     * Every failure path used to invent its own sentence ("Failed to save note.
     * Please try again."), which hid what the API actually said — a 403
     * QUOTA_EXCEEDED and a 429 RATE_LIMITED both read as "please try again".
     * Now the API's stable `code` chooses the wording.
     */
    const report = (e: unknown) => {
      error.value = messageFor(toApiError(e))
      console.error(e)
    }

    const replaceTodo = (updated: TodoItem) => {
      const index = todos.value.findIndex((t) => t.id === updated.id)
      if (index !== -1) todos.value[index] = updated
    }

    /**
     * Loads `notes` for one todo.
     *
     * GET /todos deliberately omits that column, so a paid user's existing note
     * is simply absent from the list. Without this the UI shows "Add note" on
     * every todo and the edit and delete buttons — gated on `todo.notes` — never
     * appear, so the paid feature looks broken.
     */
    const loadNotes = async (todo: TodoItem) => {
      if (props.plan !== 'PAID' || todo.notes !== undefined) return

      loadingNoteIds.value.push(todo.id)
      try {
        replaceTodo(await getTodo(todo.id))
        error.value = null
      } catch (e) {
        report(e)
      } finally {
        loadingNoteIds.value = loadingNoteIds.value.filter((id) => id !== todo.id)
      }
    }

    const toggleAccordion = (todo: TodoItem) => {
      const index = expandedItems.value.indexOf(todo.id)
      if (index === -1) {
        expandedItems.value.push(todo.id)
        void loadNotes(todo)
      } else {
        expandedItems.value.splice(index, 1)
      }
    }

    const fetchTodos = async () => {
      try {
        // The API answers with { items, nextCursor }, not a bare array.
        const { items } = await getTodos()
        todos.value = items
        error.value = null
      } catch (e) {
        report(e)
      }
    }

    onMounted(fetchTodos)

    const handleFormCancel = () => {
      showForm.value = false
      selectedTodo.value = null
    }

    const handleTodoSubmit = async (todoData: UpdateTodoPayload) => {
      const editing = selectedTodo.value
      try {
        if (editing) {
          replaceTodo(await updateTodoApi(editing.id, todoData))
        } else {
          if (!todoData.title) return
          todos.value.push(await createTodo({ ...todoData, title: todoData.title }))
        }
        handleFormCancel()
        error.value = null
      } catch (e) {
        report(e)
      }
    }

    const editTodo = (todo: TodoItem) => {
      selectedTodo.value = todo
      showForm.value = true
    }

    const toggleTodo = async (todo: TodoItem) => {
      try {
        replaceTodo(await updateTodoApi(todo.id, { completed: !todo.completed }))
        error.value = null
      } catch (e) {
        report(e)
      }
    }

    const editNote = (todo: TodoItem) => {
      editingNoteId.value = todo.id
      editingNoteText.value = todo.notes ?? ''
    }

    const cancelEditNote = () => {
      editingNoteId.value = null
      editingNoteText.value = ''
    }

    const saveNote = async (todo: TodoItem) => {
      try {
        replaceTodo(await updateTodoApi(todo.id, { notes: editingNoteText.value }))
        cancelEditNote()
        error.value = null
      } catch (e) {
        report(e)
      }
    }

    const deleteNote = async (todo: TodoItem) => {
      try {
        // An empty string, not undefined: JSON.stringify drops an undefined
        // value, so the request body was `{}` and the note was never cleared.
        // null is not an option either — the DTO validates notes with
        // @IsString(), so it would be a 400.
        replaceTodo(await updateTodoApi(todo.id, { notes: '' }))
        error.value = null
      } catch (e) {
        report(e)
      }
    }

    const deleteTodo = async (id: string) => {
      try {
        await deleteTodoApi(id)
        todos.value = todos.value.filter((t) => t.id !== id)
        expandedItems.value = expandedItems.value.filter((itemId) => itemId !== id)
        error.value = null
      } catch (e) {
        report(e)
      }
    }

    const formatTime = (date: string) => {
      return new Date(date)
        .toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: 'numeric',
          hour12: true,
        })
        .toLowerCase()
    }

    return {
      todos,
      error,
      showForm,
      selectedTodo,
      expandedItems,
      editingNoteId,
      editingNoteText,
      loadingNoteIds,
      handleTodoSubmit,
      handleFormCancel,
      editTodo,
      toggleTodo,
      toggleAccordion,
      editNote,
      cancelEditNote,
      saveNote,
      deleteNote,
      deleteTodo,
      formatTime,
    }
  },
})
</script>
