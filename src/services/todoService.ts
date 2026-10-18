import type { TodoItem } from "../types/todo"
import axiosInstance from "@/config/axios";

export const getTodos = async (): Promise<TodoItem[]> => {
  const response = await axiosInstance.get('/todos')
  return response.data
}

export const createTodo = async (todo: Omit<TodoItem, "id" | "createdAt">): Promise<TodoItem> => {
  const response = await axiosInstance.post('/todos', todo)
  return response.data
}

export const updateTodo = async (id: string, patch: Partial<Omit<TodoItem, "id" | "createdAt">>): Promise<TodoItem> => {
  const response = await axiosInstance.patch(`/todos/${id}`, patch)
  return response.data
}

export const deleteTodo = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/todos/${id}`)
}

