import axios from "axios"
import type { TodoItem } from "../types/todo"
import axiosInstance from "@/config/axios";

export const getTodos = async (userRole: string): Promise<TodoItem[]> => {
  const response = await axiosInstance.get(`/todos?userRole=${userRole}`)
  return response.data
}

export const createTodo = async (todo: Omit<TodoItem, "id">, userRole: string): Promise<TodoItem> => {
  const response = await axiosInstance.post(`/todos?userRole=${userRole}`, todo)
  return response.data
}

export const updateTodo = async (todo: TodoItem, userRole: string): Promise<TodoItem> => {
  const response = await axiosInstance.put(`/todos/${todo.id}?userRole=${userRole}`, todo)
  return response.data
}

export const deleteTodo = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/${id}`)
}

