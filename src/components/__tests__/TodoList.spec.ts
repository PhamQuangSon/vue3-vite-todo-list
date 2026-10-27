import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TodoList from '../TodoList.vue'
import { getTodos, updateTodo, deleteTodo } from '../../services/todoService'
import type { TodoItem } from '../../types/todo'
import TodoForm from '../TodoForm.vue'
import { Trash2, Plus, Check, X } from 'lucide-vue-next'

vi.mock('../../services/todoService', () => ({
  getTodos: vi.fn(),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  deleteTodo: vi.fn(),
}))

vi.mock('lucide-vue-next', () => ({
  Edit2: { render: () => null },
  Trash2: { render: () => null },
  Plus: { render: () => null },
  Check: { render: () => null },
  X: { render: () => null },
}))

describe('TodoList', () => {
  const mockTodos: TodoItem[] = [
    {
      id: '1',
      title: 'Test Todo 1',
      completed: false,
      createdAt: '2025-02-15T10:00:00.000Z',
      notes: 'Test notes 1',
      time: '10:00',
    },
    {
      id: '2',
      title: 'Test Todo 2',
      completed: true,
      createdAt: '2025-02-16T14:30:00.000Z',
      notes: 'Test notes 2',
      time: '14:30',
    },
  ]

  const mountComponent = async (userRole = 'free') => {
    const wrapper = mount(TodoList, {
      props: { userRole },
      global: {
        components: { TodoForm, Trash2, Plus, Check, X },
        stubs: { 'lucide-vue-next': true },
      },
    })
    await flushPromises()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTodos).mockResolvedValue(mockTodos)
  })

  it('displays correct number of todos', async () => {
    const wrapper = await mountComponent()

    expect(getTodos).toHaveBeenCalledWith()

    const todoItems = wrapper.findAll('[data-test="todo-item"]')
    expect(todoItems).toHaveLength(2)
    expect(todoItems[0].text()).toContain('Test Todo 1')
    expect(todoItems[0].find('[data-test="todo-checkbox"]').exists()).toBe(true)
  })

  it('toggles todo completion status', async () => {
    const wrapper = await mountComponent()

    const updatedTodo = { ...mockTodos[0], completed: true }
    vi.mocked(updateTodo).mockResolvedValueOnce(updatedTodo)

    await wrapper.find('[data-test="todo-checkbox"]').trigger('click')

    expect(updateTodo).toHaveBeenCalledWith('1', { completed: true })

    await flushPromises()

    const checkbox = wrapper.find('[data-test="todo-checkbox"]')
    expect(checkbox.classes()).toContain('bg-[#ffd700]')
  })

  it('expands accordion when clicked', async () => {
    const wrapper = await mountComponent('paid')

    await wrapper.find('[data-test="accordion-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()

    const accordionContent = wrapper.find('[data-test="accordion-content"]')
    expect(accordionContent.isVisible()).toBe(true)

    if (wrapper.props('userRole') === 'paid') {
      const notes = wrapper.find('[data-test="todo-notes"]')
      expect(notes.exists()).toBe(true)
      expect(notes.text()).toBe('Test notes 1')
    }
  })

  it('handles todo deletion', async () => {
    const wrapper = await mountComponent()

    expect(wrapper.findAll('[data-test="todo-item"]')).toHaveLength(2)

    vi.mocked(deleteTodo).mockResolvedValueOnce(undefined)

    await wrapper.find('[data-test="delete-todo-button"]').trigger('click')

    expect(deleteTodo).toHaveBeenCalledWith('1')

    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-test="todo-item"]')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Test Todo 1')
  })

  it('displays error message when API call fails', async () => {
    vi.mocked(getTodos).mockRejectedValueOnce(new Error('network error'))

    const wrapper = await mountComponent()
    await flushPromises()

    const errorElement = wrapper.find('[data-test="error-message"]')
    expect(errorElement.exists()).toBe(true)
    expect(errorElement.text()).toBe('Failed to fetch todos. Please try again.')
  })

  it('formats time correctly', async () => {
    const wrapper = await mountComponent()

    const timeElement = wrapper.find('[data-test="todo-created-at"]')
    expect(timeElement.exists()).toBe(true)
    expect(timeElement.text().toLowerCase()).toMatch(/^(1[0-2]|0?[1-9]):[0-5][0-9] [ap]m$/)
  })
})
