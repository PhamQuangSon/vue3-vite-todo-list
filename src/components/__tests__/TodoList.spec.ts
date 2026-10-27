import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TodoList from '../TodoList.vue'
import { getTodo, getTodos, updateTodo, deleteTodo } from '../../services/todoService'
import type { TodoItem } from '../../types/todo'
import type { Plan } from '../../types/auth'
import TodoForm from '../TodoForm.vue'
import { Trash2, Plus, Check, X } from 'lucide-vue-next'
import { axiosErrorWith } from '../../../test/helpers/axios'

vi.mock('../../services/todoService', () => ({
  getTodos: vi.fn(),
  getTodo: vi.fn(),
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
  // Shaped like a real list response: `notes` is absent, because GET /todos
  // leaves that column out. Tests that need a note fetch the detail.
  const mockTodos: TodoItem[] = [
    {
      id: '1',
      title: 'Test Todo 1',
      completed: false,
      createdAt: '2025-02-15T10:00:00.000Z',
      version: 0,
      time: '10:00',
    },
    {
      id: '2',
      title: 'Test Todo 2',
      completed: true,
      createdAt: '2025-02-16T14:30:00.000Z',
      version: 2,
      time: '14:30',
    },
  ]

  const mountComponent = async (plan: Plan = 'FREE') => {
    const wrapper = mount(TodoList, {
      props: { plan },
      global: {
        components: { TodoForm, Trash2, Plus, Check, X },
      },
    })
    await flushPromises()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // A fresh copy per test. The component replaces entries in the array it was
    // handed, so sharing one fixture lets a test that loads a note leave it
    // behind for the next one — which is how the "no note yet" case came to
    // pass for the wrong reason.
    vi.mocked(getTodos).mockResolvedValue({
      items: mockTodos.map((todo) => ({ ...todo })),
      nextCursor: null,
    })
  })

  it('reads the todos out of the { items, nextCursor } envelope', async () => {
    const wrapper = await mountComponent()

    const todoItems = wrapper.findAll('[data-test="todo-item"]')
    expect(todoItems).toHaveLength(2)
    expect(todoItems[0].text()).toContain('Test Todo 1')
    expect(todoItems[0].find('[data-test="todo-checkbox"]').exists()).toBe(true)
  })

  it('asks for a page big enough to hold a whole free account', async () => {
    await mountComponent()

    // The API defaults limit to 20 while the FREE quota is 50, so the default
    // would hide 30 todos.
    expect(getTodos).toHaveBeenCalledWith()
    expect(vi.mocked(getTodos).mock.calls[0]).toEqual([])
  })

  it('toggles todo completion status', async () => {
    const wrapper = await mountComponent()

    vi.mocked(updateTodo).mockResolvedValueOnce({ ...mockTodos[0], completed: true, version: 1 })

    await wrapper.find('[data-test="todo-checkbox"]').trigger('click')

    expect(updateTodo).toHaveBeenCalledWith('1', { completed: true })

    await flushPromises()

    expect(wrapper.find('[data-test="todo-checkbox"]').classes()).toContain('bg-[#ffd700]')
  })

  it('expands the accordion when clicked', async () => {
    const wrapper = await mountComponent()

    await wrapper.find('[data-test="accordion-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-test="accordion-content"]').isVisible()).toBe(true)
  })

  describe('notes, which the list endpoint does not return', () => {
    it('fetches the detail on expand so an existing note is shown', async () => {
      vi.mocked(getTodo).mockResolvedValue({ ...mockTodos[0], notes: 'Test notes 1' })
      const wrapper = await mountComponent('PAID')

      await wrapper.find('[data-test="accordion-toggle"]').trigger('click')
      await flushPromises()
      await wrapper.vm.$nextTick()

      expect(getTodo).toHaveBeenCalledWith('1')
      const notes = wrapper.find('[data-test="todo-notes"]')
      expect(notes.exists()).toBe(true)
      expect(notes.text()).toBe('Test notes 1')
      // Edit and delete are gated on the note existing, so without the detail
      // fetch they would never appear.
      expect(wrapper.find('[data-test="edit-note-button"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="delete-note-button"]').exists()).toBe(true)
    })

    it('offers to add one when the detail shows there is no note', async () => {
      vi.mocked(getTodo).mockResolvedValue({ ...mockTodos[0], notes: null })
      const wrapper = await mountComponent('PAID')

      await wrapper.find('[data-test="accordion-toggle"]').trigger('click')
      await flushPromises()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-test="add-note-button"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="todo-notes"]').exists()).toBe(false)
    })

    it('clears a note with an empty string, not undefined', async () => {
      vi.mocked(getTodo).mockResolvedValue({ ...mockTodos[0], notes: 'Test notes 1' })
      vi.mocked(updateTodo).mockResolvedValue({ ...mockTodos[0], notes: '' })
      const wrapper = await mountComponent('PAID')

      await wrapper.find('[data-test="accordion-toggle"]').trigger('click')
      await flushPromises()
      await wrapper.find('[data-test="delete-note-button"]').trigger('click')

      // `{ notes: undefined }` serializes to `{}`, so the old code sent an
      // empty body and the note survived. null would be a 400: the DTO
      // validates notes with @IsString().
      expect(updateTodo).toHaveBeenCalledWith('1', { notes: '' })
    })

    it('does not fetch the detail for a free account', async () => {
      const wrapper = await mountComponent('FREE')

      await wrapper.find('[data-test="accordion-toggle"]').trigger('click')
      await flushPromises()

      expect(getTodo).not.toHaveBeenCalled()
      expect(wrapper.find('[data-test="add-note-button"]').exists()).toBe(false)
    })

    it('fetches the detail once, not on every expand', async () => {
      vi.mocked(getTodo).mockResolvedValue({ ...mockTodos[0], notes: 'Test notes 1' })
      const wrapper = await mountComponent('PAID')
      const toggle = wrapper.find('[data-test="accordion-toggle"]')

      await toggle.trigger('click')
      await flushPromises()
      await toggle.trigger('click')
      await toggle.trigger('click')
      await flushPromises()

      expect(getTodo).toHaveBeenCalledTimes(1)
    })
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

  describe('error messages come from the API code', () => {
    it('explains a quota rejection with the real limit', async () => {
      vi.mocked(getTodos).mockRejectedValueOnce(
        axiosErrorWith(403, { code: 'QUOTA_EXCEEDED', limit: 50 }),
      )

      const wrapper = await mountComponent()
      await flushPromises()

      // The old code said "Failed to fetch todos. Please try again." for every
      // failure, which hid what the server actually objected to.
      expect(wrapper.find('[data-test="error-message"]').text()).toContain('50 todos')
    })

    it('tells the user how long to wait when rate limited', async () => {
      vi.mocked(getTodos).mockRejectedValueOnce(
        axiosErrorWith(429, { code: 'RATE_LIMITED' }, { 'retry-after': '20' }),
      )

      const wrapper = await mountComponent()
      await flushPromises()

      expect(wrapper.find('[data-test="error-message"]').text()).toContain('20 seconds')
    })

    it('falls back to a generic message when the request never reached the API', async () => {
      vi.mocked(getTodos).mockRejectedValueOnce(new Error('network error'))

      const wrapper = await mountComponent()
      await flushPromises()

      expect(wrapper.find('[data-test="error-message"]').text()).toContain('Could not reach')
    })
  })

  it('formats the created time in the pinned UTC timezone', async () => {
    const wrapper = await mountComponent()

    const timeElement = wrapper.find('[data-test="todo-created-at"]')
    expect(timeElement.exists()).toBe(true)
    // test/setup.ts pins TZ=UTC, so this is exact rather than a loose pattern.
    expect(timeElement.text().toLowerCase()).toBe('10:00 am')
  })
})
