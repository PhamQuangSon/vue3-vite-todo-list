import { mount, flushPromises } from "@vue/test-utils"
import { describe, it, expect, vi, beforeEach } from "vitest"
import TodoList from "../TodoList.vue"
import { getTodos, updateTodo, deleteTodo } from "../../services/todoService"
import type { TodoItem } from "../../types/todo"
import TodoForm from "../TodoForm.vue"
import { Trash2, Plus, Check, X } from "lucide-vue-next"

// Mock the todoService
vi.mock("../../services/todoService", () => ({
  getTodos: vi.fn(),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  deleteTodo: vi.fn(),
}))

// Mock Lucide icons
vi.mock("lucide-vue-next", () => ({
  Edit2: { render: () => null },
  Trash2: { render: () => null },
  ChevronDown: { render: () => null },
  Plus: { render: () => null },
  Check: { render: () => null },
  X: { render: () => null },
}))

describe("TodoList", () => {
  const mockTodos: TodoItem[] = [
    {
      id: "1",
      title: "Test Todo 1",
      completed: false,
      createdAt: new Date("2025-02-15T10:00:00Z"),
      notes: "Test notes 1",
      time: "10:00",
    },
    {
      id: "2",
      title: "Test Todo 2",
      completed: true,
      createdAt: new Date("2025-02-16T14:30:00Z"),
      notes: "Test notes 1",
      time: "14:30",
    },
  ]

  const mountComponent = async (userRole = "free") => {
    const wrapper = mount(TodoList, {
      props: {
        userRole,
      },
      global: {
        components: {
          TodoForm,
          Trash2,
          Plus,
          Check,
          X,
        },
        stubs: {
          "lucide-vue-next": true,
        },
      },
    })

    // Wait for the component to mount and fetch data
    await flushPromises()
    await wrapper.vm.$nextTick()

    return wrapper
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Set up the mock to return our test data
    vi.mocked(getTodos).mockResolvedValue(mockTodos)
  })

  it("displays correct number of todos", async () => {
    const wrapper = await mountComponent()

    // Verify the API was called
    expect(getTodos).toHaveBeenCalledWith("free")

    // Check if todos are rendered
    const todoItems = wrapper.findAll('[data-test="todo-item"]')
    expect(todoItems).toHaveLength(2)

    // Verify todo content
    const firstTodo = todoItems[0]
    expect(firstTodo.text()).toContain("Test Todo 1")
    expect(firstTodo.find('[data-test="todo-checkbox"]').exists()).toBe(true)
  })

  it("toggles todo completion status", async () => {
    const wrapper = await mountComponent()

    // Get the first uncompleted todo
    const firstTodoCheckbox = wrapper.find('[data-test="todo-checkbox"]')

    // Mock the API response for the update
    const updatedTodo = { ...mockTodos[0], completed: true }
    vi.mocked(updateTodo).mockResolvedValueOnce(updatedTodo)

    // Toggle completion
    await firstTodoCheckbox.trigger("click")

    // Verify API call
    expect(updateTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "1",
        completed: true,
      }),
      "free",
    )

    await flushPromises()

    // Verify checkbox state updated
    const checkbox = wrapper.find('[data-test="todo-checkbox"]')
    expect(checkbox.classes()).toContain("bg-[#ffd700]")
  })

  it("expands accordion when clicked", async () => {
    const wrapper = await mountComponent("paid")

    // Get first todo accordion
    const accordionToggle = wrapper.find('[data-test="accordion-toggle"]')

    // Click to expand
    await accordionToggle.trigger("click")
    await wrapper.vm.$nextTick()

    // Verify expanded state
    const accordionContent = wrapper.find('[data-test="accordion-content"]')
    expect(accordionContent.isVisible()).toBe(true)

    // Verify notes are visible for paid user
    if (wrapper.props("userRole") === "paid") {
      const notes = wrapper.find('[data-test="todo-notes"]')
      expect(notes.exists()).toBe(true)
      expect(notes.text()).toBe("Test notes 1")
    }
  })

  it("handles todo deletion", async () => {
    const wrapper = await mountComponent()

    // Initial count
    expect(wrapper.findAll('[data-test="todo-item"]')).toHaveLength(2)

    // Mock successful deletion
    vi.mocked(deleteTodo).mockResolvedValueOnce(undefined)

    // Delete first todo
    const deleteButton = wrapper.find('[data-test="delete-todo-button"]')
    await deleteButton.trigger("click")

    // Verify API call
    expect(deleteTodo).toHaveBeenCalledWith("1")

    await flushPromises()

    // Mock the getTodos call that happens after deletion
    vi.mocked(getTodos).mockResolvedValueOnce([mockTodos[1]])

    await wrapper.vm.$nextTick()

    // Verify todo is removed from UI
    const remainingTodos = wrapper.findAll('[data-test="todo-item"]')
    expect(remainingTodos).toHaveLength(1)
    expect(wrapper.text()).not.toContain("Test Todo 1")
  })

  it("displays error message when API call fails", async () => {
    // Mock API error
    const errorMessage = "Failed to fetch todos. Please try again."
    vi.mocked(getTodos).mockRejectedValueOnce(new Error(errorMessage))

    const wrapper = await mountComponent()
    await flushPromises()

    // Verify error message
    const errorElement = wrapper.find('[data-test="error-message"]')
    expect(errorElement.exists()).toBe(true)
    expect(errorElement.text()).toBe(errorMessage)
  })

  it("formats time correctly", async () => {
    const wrapper = await mountComponent()

    const timeElement = wrapper.find('[data-test="todo-created-at"]')
    expect(timeElement.exists()).toBe(true)

    const timeText = timeElement.text().toLowerCase()
    expect(timeText).toMatch(/^(1[0-2]|0?[1-9]):[0-5][0-9] [ap]m$/)

    // Test specific time format
    const firstTodoTime = wrapper.find('[data-test="todo-created-at"]')
    expect(firstTodoTime.text().toLowerCase()).toBe("10:00 am")
  })
  
})

