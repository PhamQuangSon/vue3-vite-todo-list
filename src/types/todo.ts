export interface TodoItem {
  id: string
  title: string
  completed: boolean
  /** ISO 8601 string from JSON; convert to Date only when displaying. */
  createdAt: string
  /** Bumped by every write. Sent back as If-Match to detect a lost update. */
  version: number
  /** A free-form "HH:mm" label, max 32 chars — not a timestamp. Prisma's String? serializes to null. */
  time?: string | null
  /**
   * Three distinct states, and the difference matters:
   *   undefined — not loaded. GET /todos omits notes entirely (it is a large
   *               TEXT column, so the API only sends it per-todo).
   *   null | '' — loaded, and there is no note.
   *   string    — the note.
   * It is also absent for a FREE user, whose plan does not include notes.
   */
  notes?: string | null
}

export interface TodoListResponse {
  items: TodoItem[]
  nextCursor: string | null
}

/**
 * Exactly the fields CreateTodoDto accepts. The API runs its ValidationPipe
 * with forbidNonWhitelisted, so one extra property is a 400 — which is what
 * used to happen when the form sent `id` and `createdAt` back.
 *
 * `notes` and `time` are strings, never null: the DTO validates them with
 * @IsString(), so null is rejected. Clearing a note means sending ''.
 */
export interface CreateTodoPayload {
  title: string
  completed?: boolean
  time?: string
  notes?: string
  /** A uuid. Replaying it returns the existing row with 200 instead of 201. */
  clientRequestId?: string
}

export type UpdateTodoPayload = Partial<Omit<CreateTodoPayload, 'clientRequestId'>>
