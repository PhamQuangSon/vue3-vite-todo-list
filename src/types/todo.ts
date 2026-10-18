export interface TodoItem {
  id: string
  title: string
  completed: boolean
  createdAt: string   // ISO 8601 string from JSON; convert to Date only when displaying
  time?: string
  notes?: string
}
