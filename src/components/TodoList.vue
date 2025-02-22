<template>
  <div class="bg-white rounded-3xl shadow-lg p-6">
    <div class="flex justify-between items-center mb-2">
      <h2 class="text-2xl font-medium text-gray-800">Tasks List</h2>
      <button
        @click="showForm = true"
        class="w-8 h-8 flex items-center justify-center rounded-full bg-[#ffd700] hover:bg-[#e6c300] transition-colors"
      >
        <span class="text-white text-xl">+</span>
      </button>
    </div>
    <p class="text-lg text-gray-800 mb-4">You have {{ todos.length }} task for today</p>
    <!-- Todo Form -->
    <TodoForm
      v-if="showForm"
      :userRole="userRole"
      :todoToEdit="selectedTodo"
      @submit="handleTodoSubmit"
      @cancel="handleFormCancel"
    />

    <div class="space-y-4">
      <div
        v-for="todo in todos"
        :key="todo.id"
        class="border border-gray-100 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow animate animate-fade-right"
      >
        <!-- Todo Header - Always visible -->
        <div 
          class="flex items-start space-x-3 p-4 bg-white cursor-pointer"
          @click="toggleAccordion(todo.id)"
        >
          <div 
            class="w-5 h-5 rounded-full border-2 border-[#ffd700] flex-shrink-0 mt-1 cursor-pointer"
            :class="{ 'bg-[#ffd700]': todo.completed }"
            @click.stop="toggleTodo(todo)"
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
                  'text-gray-800': !todo.completed
                }"
              >{{ todo.title }}</span>
              <div class="flex items-center space-x-2">
                <span class="text-sm text-gray-500">{{ formatTime(todo.createdAt) }}</span>
                <div class="flex space-x-1">
                  <button
                    @click.stop="editTodo(todo)"
                    class="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-[#ffd700] transition-colors"
                  >
                    <Edit2 :size="16" />
                  </button>
                  <button
                    @click.stop="deleteTodo(todo.id)"
                    class="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 :size="16" />
                  </button>
                  <!-- <button
                    @click.stop="toggleAccordion(todo.id)"
                    class="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-[#ffd700] transition-colors"
                  >
                    <ChevronDown
                      :size="16"
                      :class="{ 'transform rotate-180 transition-transform': expandedItems.includes(todo.id) }"
                    />
                  </button> -->
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Todo Details - Expandable Content -->
        <div 

          class="bg-gray-50 overflow-hidden transition-all duration-200 ease-in-out"
          :class="[
            expandedItems.includes(todo.id) ? 'opacity-100' : 'opacity-0',
            'bg-gray-50'
          ]"
        >
          <div v-if="expandedItems.includes(todo.id)" class="pt-4 px-4 pb-4 border-t border-gray-100 animate animate-fade-up">
            <!-- Time if available -->
            <div v-if="todo.time" class="mb-3">
              <span class="text-sm font-medium text-gray-600">Time:</span>
              <span class="ml-2 text-sm text-gray-500">{{ todo.time }}</span>
            </div>

            <!-- Notes section -->
            <div v-if="userRole === 'paid'" class="space-y-2">
              <div v-if="editingNoteId === todo.id">
                <textarea
                  v-model="editingNoteText"
                  rows="3"
                  class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:border-transparent"
                  placeholder="Add a note..."
                ></textarea>
                <div class="mt-2 flex space-x-2">
                  <button
                    @click="saveNote(todo)"
                    class="px-3 py-1.5 bg-[#ffd700] text-white rounded-lg hover:bg-[#e6c300] transition-colors inline-flex items-center space-x-2"
                  >
                    <Check :size="16" />
                    <span>Save</span>
                  </button>
                  <button
                    @click="cancelEditNote"
                    class="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center space-x-2"
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
                    >
                      <Edit2 :size="14" />
                    </button>
                    <button
                      v-if="todo.notes"
                      @click="deleteNote(todo)"
                      class="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>
                <p v-if="todo.notes" class="mt-1 text-sm text-gray-600">
                  {{ todo.notes }}
                </p>
                <button
                  v-else
                  @click="editNote(todo)"
                  class="mt-1 text-sm text-[#ffd700] hover:text-[#e6c300] transition-colors inline-flex items-center space-x-1"
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
import { defineComponent, ref, onMounted } from 'vue';
import type { TodoItem } from "../types/todo"
import { getTodos, createTodo, updateTodo as updateTodoApi, deleteTodo as deleteTodoApi } from '../services/todoService';
import { Edit2, Trash2, ChevronDown, Plus, Check, X } from 'lucide-vue-next';
import TodoForm from './TodoForm.vue';

export default defineComponent({
  name: 'TodoList',
  components: {
    TodoForm,
    Edit2,
    Trash2,
    ChevronDown,
    Plus,
    Check,
    X
  },
  props: {
    userRole: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const todos = ref<TodoItem[]>([]);
    const error = ref<string | null>(null);
    const showForm = ref(false);
    const selectedTodo = ref<TodoItem | null>(null);
    const expandedItems = ref<string[]>([]);
    const editingNoteId = ref<string | null>(null);
    const editingNoteText = ref('');

    const toggleAccordion = (todoId: string) => {
      const index = expandedItems.value.indexOf(todoId);
      if (index === -1) {
        // Expand with animation
        expandedItems.value.push(todoId);
      } else {
        // Collapse with animation
        expandedItems.value.splice(index, 1);
      }
    };

    const fetchTodos = async () => {
      try {
        todos.value = await getTodos(props.userRole);
        error.value = null;
      } catch (err) {
        error.value = 'Failed to fetch todos. Please try again.';
        console.error(err);
      }
    };

    onMounted(fetchTodos);

    const handleTodoSubmit = async (todoData: Partial<TodoItem>) => {
      try {
        if (selectedTodo.value) {
          const updatedTodo = await updateTodoApi(todoData as TodoItem, props.userRole);
          const index = todos.value.findIndex(t => t.id === selectedTodo.value?.id);
          if (index !== -1) {
            todos.value[index] = updatedTodo;
          }
        } else {
          const newTodo = await createTodo(todoData as Omit<TodoItem, 'id'>, props.userRole);
          todos.value.push(newTodo);
        }
        handleFormCancel();
        error.value = null;
      } catch (err) {
        error.value = `Failed to ${selectedTodo.value ? 'update' : 'create'} todo. Please try again.`;
        console.error(err);
      }
    };

    const handleFormCancel = () => {
      showForm.value = false;
      selectedTodo.value = null;
    };

    const editTodo = (todo: TodoItem) => {
      selectedTodo.value = todo;
      showForm.value = true;
    };

    const toggleTodo = async (todo: TodoItem) => {
      try {
        const updatedTodo = { ...todo, completed: !todo.completed };
        await updateTodoApi(updatedTodo, props.userRole);
        const index = todos.value.findIndex((t) => t.id === todo.id);
        if (index !== -1) {
          todos.value[index] = updatedTodo;
        }
        error.value = null;
      } catch (err) {
        error.value = 'Failed to update todo. Please try again.';
        console.error(err);
      }
    };

    const editNote = (todo: TodoItem) => {
      editingNoteId.value = todo.id;
      editingNoteText.value = todo.notes || '';
    };

    const cancelEditNote = () => {
      editingNoteId.value = null;
      editingNoteText.value = '';
    };

    const saveNote = async (todo: TodoItem) => {
      try {
        const updatedTodo = { ...todo, notes: editingNoteText.value };
        await updateTodoApi(updatedTodo, props.userRole);
        const index = todos.value.findIndex((t) => t.id === todo.id);
        if (index !== -1) {
          todos.value[index] = updatedTodo;
        }
        editingNoteId.value = null;
        editingNoteText.value = '';
        error.value = null;
      } catch (err) {
        error.value = 'Failed to save note. Please try again.';
        console.error(err);
      }
    };

    const deleteNote = async (todo: TodoItem) => {
      try {
        const updatedTodo = { ...todo, notes: undefined };
        await updateTodoApi(updatedTodo, props.userRole);
        const index = todos.value.findIndex((t) => t.id === todo.id);
        if (index !== -1) {
          todos.value[index] = updatedTodo;
        }
        error.value = null;
      } catch (err) {
        error.value = 'Failed to delete note. Please try again.';
        console.error(err);
      }
    };

    const deleteTodo = async (id: string) => {
      try {
        await deleteTodoApi(id);
        todos.value = todos.value.filter(t => t.id !== id);
        expandedItems.value = expandedItems.value.filter(itemId => itemId !== id);
        error.value = null;
      } catch (err) {
        error.value = 'Failed to delete todo. Please try again.';
        console.error(err);
      }
    };

    const formatTime = (date: Date) => {
      return new Date(date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).toLowerCase();
    };

    return {
      todos,
      error,
      showForm,
      selectedTodo,
      expandedItems,
      editingNoteId,
      editingNoteText,
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
    };
  },
});
</script>

