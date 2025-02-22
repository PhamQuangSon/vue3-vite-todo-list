<template>
  <form @submit.prevent="handleSubmit" class="animate animate-fade-down mb-6">
    <input
      v-model="title"
      type="text"
      :placeholder="isEditing ? 'Edit task title' : 'Enter task title'"
      class="w-full px-4 py-2 text-lg border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:border-transparent"
    />
    <div v-if="userRole === 'paid'" class="mt-3">
      <input
        type="time"
        v-model="time"
        class="w-full px-4 py-2 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:border-transparent"
      />
      <textarea
        v-model="notes"
        placeholder="Add notes (optional)"
        rows="3"
        class="mt-3 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:border-transparent"
      ></textarea>
    </div>
    <div class="mt-3 flex space-x-2">
      <button
        type="submit"
        class="px-4 py-2 bg-[#ffd700] text-white rounded-lg hover:bg-[#e6c300] transition-colors inline-flex items-center space-x-2"
      >
        <Plus v-if="!isEditing" :size="18" />
        <Check v-else :size="18" />
        <span>{{ isEditing ? 'Update Task' : 'Add Task' }}</span>
      </button>
      <button
        type="button"
        @click="handleCancel"
        class="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center space-x-2"
      >
        <X :size="18" />
        <span>Cancel</span>
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue';
import { Plus, Check, X } from 'lucide-vue-next';
import type { TodoItem } from '../types/todo';

export default defineComponent({
  name: 'TodoForm',
  components: {
    Plus,
    Check,
    X
  },
  props: {
    userRole: {
      type: String,
      required: true,
    },
    todoToEdit: {
      type: Object as () => TodoItem | null,
      default: null
    }
  },
  emits: ['submit', 'cancel'],
  setup(props, { emit }) {
    const title = ref('');
    const time = ref('');
    const notes = ref('');
    const isEditing = ref(false);

    const resetForm = () => {
      title.value = '';
      time.value = '';
      notes.value = '';
      isEditing.value = false;
    };

    const updateFormWithTodo = (todo: TodoItem | null) => {
      if (todo) {
        title.value = todo.title;
        time.value = todo.time || '';
        notes.value = todo.notes || '';
        isEditing.value = true;
      } else {
        resetForm();
      }
    };

    // Watch for changes in todoToEdit and update form fields
    watch(() => props.todoToEdit, updateFormWithTodo, { immediate: true });

    const handleSubmit = () => {
      if (!title.value.trim()) return;

      const todoData = {
        title: title.value,
        completed: props.todoToEdit?.completed || false,
        createdAt: props.todoToEdit?.createdAt || new Date(),
        ...(props.userRole === 'paid' && {
          time: time.value || undefined,
          notes: notes.value.trim() || undefined
        })
      };

      if (props.todoToEdit) {
        emit('submit', { ...todoData, id: props.todoToEdit.id });
      } else {
        emit('submit', todoData);
      }

      resetForm();
    };

    const handleCancel = () => {
      resetForm();
      emit('cancel');
    };

    return {
      title,
      time,
      notes,
      isEditing,
      handleSubmit,
      handleCancel
    };
  },
});
</script>

