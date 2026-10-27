import axiosInstance from '@/config/axios'
import type { CreateTodoPayload, TodoItem, TodoListResponse, UpdateTodoPayload } from '@/types/todo'

/**
 * One page covers a whole free account.
 *
 * The API defaults `limit` to 20 while the FREE plan allows 50 todos, so taking
 * the default would silently hide 30 of them. Real cursor pagination — following
 * `nextCursor` — is the next step; this keeps the list honest until then.
 */
const PAGE_SIZE = 50

export const getTodos = async (
  params: { limit?: number; cursor?: string } = {},
): Promise<TodoListResponse> => {
  const response = await axiosInstance.get<TodoListResponse>('/todos', {
    params: { limit: params.limit ?? PAGE_SIZE, cursor: params.cursor },
  })
  return response.data
}

/**
 * Fetches one todo, which is the only way to read its `notes`: the list
 * endpoint leaves that column out on purpose.
 */
export const getTodo = async (id: string): Promise<TodoItem> => {
  const response = await axiosInstance.get<TodoItem>(`/todos/${id}`)
  return response.data
}

/**
 * Builds the request body field by field.
 *
 * Not defensiveness for its own sake: the API validates with
 * forbidNonWhitelisted, so a single unexpected property is a 400. Spreading
 * whatever the caller passed is exactly how `id` and `createdAt` used to leak
 * into the body from the edit form.
 */
function createBody(input: CreateTodoPayload): CreateTodoPayload {
  const body: CreateTodoPayload = {
    title: input.title,
    // Makes a retried POST return the original row with 200 instead of
    // creating a duplicate.
    clientRequestId: input.clientRequestId ?? crypto.randomUUID(),
  }
  if (input.completed !== undefined) body.completed = input.completed
  if (input.time !== undefined) body.time = input.time
  if (input.notes !== undefined) body.notes = input.notes
  return body
}

function updateBody(input: UpdateTodoPayload): UpdateTodoPayload {
  const body: UpdateTodoPayload = {}
  if (input.title !== undefined) body.title = input.title
  if (input.completed !== undefined) body.completed = input.completed
  if (input.time !== undefined) body.time = input.time
  if (input.notes !== undefined) body.notes = input.notes
  return body
}

export const createTodo = async (payload: CreateTodoPayload): Promise<TodoItem> => {
  const response = await axiosInstance.post<TodoItem>('/todos', createBody(payload))
  return response.data
}

export const updateTodo = async (id: string, patch: UpdateTodoPayload): Promise<TodoItem> => {
  const response = await axiosInstance.patch<TodoItem>(`/todos/${id}`, updateBody(patch))
  return response.data
}

export const deleteTodo = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/todos/${id}`)
}
