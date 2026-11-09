import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/vue-query'
import {
  getTodos,
  getTodo,
  createTodo,
  updateTodo as updateTodoApi,
  deleteTodo as deleteTodoApi,
} from '@/services/todoService'
import type { TodoItem, TodoListResponse, CreateTodoPayload, UpdateTodoPayload } from '@/types/todo'
import type { Plan } from '@/types/auth'
import { toApiError } from '@/api/errors'
import { messageFor } from '@/api/messages'

// The page size covers a whole FREE account quota in one request.
// Real pagination follows nextCursor; this is just the first page size.
const PAGE_SIZE = 50

// When a PATCH returns 412 VERSION_CONFLICT, we store what was attempted so
// the user can decide to overwrite or accept the server version.
export interface ConflictState {
  id: string
  attempted: UpdateTodoPayload
  attemptedVersion: number | undefined
  serverVersion: number
}

type PagesData = InfiniteData<TodoListResponse>

function mapPages(data: PagesData | undefined, fn: (item: TodoItem) => TodoItem): PagesData | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map(fn),
    })),
  }
}

function filterPages(data: PagesData | undefined, predicate: (item: TodoItem) => boolean): PagesData | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter(predicate),
    })),
  }
}

function prependToFirst(data: PagesData | undefined, item: TodoItem): PagesData | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page, i) =>
      i === 0 ? { ...page, items: [item, ...page.items] } : page,
    ),
  }
}

export function useTodos(plan: MaybeRefOrGetter<Plan>) {
  const queryClient = useQueryClient()
  const queryKey = ['todos'] as const

  const conflictState = ref<ConflictState | null>(null)
  const mutationError = ref<string | null>(null)

  // ── Infinite query ──────────────────────────────────────────────────────────

  const query = useInfiniteQuery<
    TodoListResponse,
    Error,
    InfiniteData<TodoListResponse>,
    typeof queryKey,
    string | undefined
  >({
    queryKey,
    queryFn: ({ pageParam }) => getTodos({ limit: PAGE_SIZE, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  })

  const todos = computed<TodoItem[]>(
    () => query.data.value?.pages.flatMap((p: TodoListResponse) => p.items) ?? [],
  )

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function report(e: unknown) {
    mutationError.value = messageFor(toApiError(e))
  }

  function clearError() {
    mutationError.value = null
    conflictState.value = null
  }

  function patchCache(id: string, patch: Partial<TodoItem>) {
    queryClient.setQueryData<PagesData>(queryKey, (old) =>
      mapPages(old, (t) => (t.id === id ? { ...t, ...patch } : t)),
    )
  }

  // ── Load notes on accordion expand ─────────────────────────────────────────

  const loadingNoteIds = ref<string[]>([])

  async function loadNotes(todo: TodoItem) {
    if (toValue(plan) !== 'PAID' || todo.notes !== undefined) return
    loadingNoteIds.value.push(todo.id)
    try {
      const detail = await getTodo(todo.id)
      patchCache(todo.id, { notes: detail.notes, version: detail.version })
    } catch (e) {
      report(e)
    } finally {
      loadingNoteIds.value = loadingNoteIds.value.filter((id) => id !== todo.id)
    }
  }

  // ── Create mutation ─────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: CreateTodoPayload) => createTodo(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<PagesData>(queryKey)
      // Optimistic placeholder; server will replace with the real todo.
      const optimistic: TodoItem = {
        id: `optimistic-${payload.clientRequestId ?? Date.now()}`,
        title: payload.title,
        completed: payload.completed ?? false,
        createdAt: new Date().toISOString(),
        version: 0,
        time: payload.time ?? null,
      }
      queryClient.setQueryData<PagesData>(queryKey, (old) =>
        prependToFirst(old, optimistic),
      )
      return { previous, optimisticId: optimistic.id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
      report(_err)
    },
    onSuccess: (created, _vars, ctx) => {
      // Replace the optimistic placeholder with the real item.
      queryClient.setQueryData<PagesData>(queryKey, (old) =>
        mapPages(old, (t) =>
          t.id === ctx?.optimisticId ? created : t,
        ),
      )
      mutationError.value = null
    },
  })

  // ── Update mutation ─────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: ({ id, patch, ifMatch }: { id: string; patch: UpdateTodoPayload; ifMatch?: number }) =>
      updateTodoApi(id, patch, ifMatch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<PagesData>(queryKey)
      queryClient.setQueryData<PagesData>(queryKey, (old) =>
        mapPages(old, (t) => (t.id === id ? { ...t, ...patch } : t)),
      )
      return { previous }
    },
    onError: (err, vars, ctx) => {
      const apiErr = toApiError(err)
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)

      if (apiErr.code === 'VERSION_CONFLICT' && apiErr.current !== undefined) {
        // Surface the conflict instead of a generic error so the UI can let
        // the user decide: overwrite the server state or accept it.
        conflictState.value = {
          id: vars.id,
          attempted: vars.patch,
          attemptedVersion: vars.ifMatch,
          serverVersion: apiErr.current as number,
        }
      } else {
        report(err)
      }
    },
    onSuccess: (updated) => {
      patchCache(updated.id, updated)
      mutationError.value = null
      conflictState.value = null
    },
  })

  // ── Delete mutation ─────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTodoApi(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<PagesData>(queryKey)
      queryClient.setQueryData<PagesData>(queryKey, (old) =>
        filterPages(old, (t) => t.id !== id),
      )
      return { previous }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
      report(_err)
    },
    onSuccess: () => {
      mutationError.value = null
    },
  })

  // ── Conflict resolution ─────────────────────────────────────────────────────

  function resolveConflict(overwrite: boolean) {
    const c = conflictState.value
    if (!c) return
    if (overwrite) {
      updateMutation.mutate({ id: c.id, patch: c.attempted, ifMatch: c.serverVersion })
    } else {
      // Accept server version: refetch to sync the cache with the latest state.
      queryClient.invalidateQueries({ queryKey })
      conflictState.value = null
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    todos,
    isLoading: query.isLoading,
    isError: query.isError,
    queryError: computed(() =>
      query.error.value ? messageFor(toApiError(query.error.value)) : null,
    ),
    fetchNextPage: () => query.fetchNextPage(),
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,

    loadingNoteIds,
    loadNotes,

    createTodo: (payload: CreateTodoPayload) => createMutation.mutate(payload),
    updateTodo: (id: string, patch: UpdateTodoPayload, ifMatch?: number) =>
      updateMutation.mutate({ id, patch, ifMatch }),
    deleteTodo: (id: string) => deleteMutation.mutate(id),

    isPending: computed(
      () =>
        createMutation.isPending.value ||
        updateMutation.isPending.value ||
        deleteMutation.isPending.value,
    ),
    mutationError,
    conflictState,
    resolveConflict,
    clearError,
  }
}
