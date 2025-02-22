import { mount } from "@vue/test-utils"
import { describe, it, expect, vi } from "vitest"
import TodoList from "../TodoList.vue"
import { getTodos } from "../../services/todoService"

vi.mock("../../services/todoService")

describe("TodoList", () => {
  it("renders todo items", async () => {
    const mockTodos = [
      { id: "1", title: "Test Todo 1", completed: false, createdAt: new Date() },
      { id: "2", title: "Test Todo 2", completed: true, createdAt: new Date() },
    ]

    vi.mocked(getTodos).mockResolvedValue(mockTodos)

    const wrapper = mount(TodoList, {
      props: {
        userRole: "free",
      },
    })

    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-test="todo-item"]')).toHaveLength(2)
    expect(wrapper.text()).toContain("Test Todo 1")
    expect(wrapper.text()).toContain("Test Todo 2")
  })
})

