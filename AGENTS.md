# AGENTS.md — vue3-vite-todo-list

## Dự án này là gì

Frontend Vue 3 của một app todo list. Nhưng mục tiêu thật không phải "làm UI đẹp" mà là **nửa client của một giáo trình học concurrency** — những bài học race condition ở backend được nhìn lại từ phía ngược lại: single-flight refresh, optimistic update + rollback, xử lý conflict 412.

Nửa còn lại là API: `../nest-todo-list-api` (NestJS 11). Repo này gọi API đó qua nginx tại `http://localhost:3000/api/v1`.

## Node — đọc trước khi chạy bất cứ lệnh nào

**Cần Node 22.12+ hoặc 24.** Ghim trong `.nvmrc` (24). Vite 7, Vitest 5 và jsdom 30 đều từ chối Node 20, mà Node mặc định của máy dev là 20.18. jsdom 30 vỡ rất rõ: một dependency CJS `require()` một dependency ESM.

```bash
nvm use        # BẮT BUỘC, trước mọi lệnh
```

## Stack

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| Vue | 3.5 | `<script setup>` toàn bộ |
| Vite | 7.3 | `"type": "module"` bắt buộc |
| Pinia | **3**, không phải 4 | xem [Cạm bẫy](#cạm-bẫy) |
| vue-router | 4.6 | v5 đã ra nhưng cố ý không lên |
| TanStack Query | 5.107 | server state, thay state thủ công |
| Tailwind | 4.3 | CSS-first, `@tailwindcss/vite` |
| shadcn-vue | 2.8 | + reka-ui, `cn` |
| Vitest | 5.0 | jsdom 30 |
| Package manager | pnpm | lockfile là `pnpm-lock.yaml` |

## Lệnh

```bash
nvm use
pnpm dev            # cần docker stack của repo API đang chạy
pnpm test:run       # 88 test
pnpm type-check     # vue-tsc --build
pnpm lint           # eslint --fix
pnpm build          # vue-tsc --build && vite build
```

Để `pnpm dev` dùng được, repo API phải chạy: `cd ../nest-todo-list-api && docker compose up -d`.

**Dev bằng Chrome hoặc Firefox, không Safari.** Cookie refresh có cờ `Secure` còn nginx listen `http`. Chrome/Firefox coi `http://localhost` là potentially-trustworthy nên vẫn lưu; Safari từ chối thẳng.

## Bản đồ

```
src/
  api/
    authApi.ts        register/login/refresh/logout/me — cả 5 dùng withCredentials
    interceptors.ts   setupInterceptors(instance, pinia) — refresh chủ động + retry 401
    errors.ts         toApiError() chuẩn hoá AxiosError
    messages.ts       messageFor(error) — map code → câu hiển thị
    unauthenticated.ts  callback indirection, cắt vòng import router→views→store→api→router
  stores/auth.ts      Pinia setup store — token chỉ trong memory, single-flight refresh
  composables/
    useTodos.ts       TanStack Query: infinite query + 3 mutation + conflict 412
    useSubmitError.ts đếm ngược retryAfter
  services/todoService.ts   gọi API, whitelist payload theo DTO
  lib/
    jwt.ts            decodeJwt — ĐỌC claim, không xác thực (chỉ server kiểm chữ ký)
    sessionHint.ts    cờ "chắc là có cookie" + email hiển thị — KHÔNG phải credential
    webLock.ts        navigator.locks, tuần tự hoá refresh giữa các tab
    redirect.ts       safeRedirect — chặn open redirect
  router/index.ts     default-deny guard
  views/              Login · Register · Todos · NotFound
  components/ui/      shadcn-vue sinh ra, đừng sửa tay
  types/              todo.ts · auth.ts · api.ts
test/helpers/         token.ts (signFake) · axios.ts (axiosErrorWith, networkError)
```

## Các phase đã làm

| Phase | Trạng thái | Commit | Giao được gì |
|---|---|---|---|
| 0 | xong | `d451c0c` | Sửa URL `deleteTodo` (thiếu `/todos`, chưa bao giờ chạy thật), sửa `baseURL`, thêm config ESLint/Prettier, xoá scaffold chết |
| 1–3 | không áp dụng | — | Backend-only (Prisma, auth, load test, Redis) |
| 4a | xong | `0cd9c86` → `23c8541` | 7 bước: nâng toolchain · shadcn-vue + design token · hợp đồng lỗi API + đọc JWT claim · auth store single-flight · axios interceptor · router guard + trang auth · tương thích API thật |
| 4b | xong | `bdf9b18` | TanStack Query · `useTodos()` composable · optimistic update + rollback · `If-Match` + UI conflict 412 · cursor pagination (Load More) · `GET /auth/me` · gộp icon về `@lucide/vue` |
| **5** | **tiếp theo** | — | Socket.IO client, merge push vào cache TanStack Query |
| 6 | kế hoạch | — | — |

### 4a đã sửa những gì (đáng nhớ)

Trước 4a, toàn bộ công sức backend của Phase 1–3 **chưa có đường nào chạm tới từ browser**: mọi route `/todos` đòi bearer token mà FE không có khái niệm đăng nhập. 4a cũng lộ ra bốn lỗi im lặng:

- `GET /todos` không trả `notes`, nhưng UI đọc `todo.notes` thẳng từ item của list → user PAID thấy "Add note" trên mọi todo dù đã có note, và nút sửa/xoá (gate theo `todo.notes`) không bao giờ hiện. **Một feature trả tiền chết âm thầm.**
- Form sửa gửi kèm `id` và `createdAt` → BE trả 400 vì `forbidNonWhitelisted`.
- Xoá note gửi `{notes: undefined}` → `JSON.stringify` bỏ key → body `{}` → **chưa bao giờ có tác dụng**.
- `limit` mặc định 20 trong khi quota FREE là 50 → mất 30 todo không một lời nào.

## Cạm bẫy

**Pinia 3, không phải 4.** Pinia 4 khai peer `@vue/devtools-api ^8` còn vue-router 4 ghim `^6` → cài 4 vào là peer lỗi. Setup store giống nhau hoàn toàn nên không được gì.

**Promise single-flight của refresh nằm TRONG Pinia store, không phải trong module interceptor.** Đây là yêu cầu đúng/sai, không phải sở thích: `bootstrap()` và handler 401 **phải dùng chung một promise**. Nếu chạy song song, cả hai đọc cookie trước khi `Set-Cookie` nào kịp về, cả hai nộp cùng một raw token → API coi cái thứ hai là replay → **revoke cả token family**. Để promise ở module interceptor thì `bootstrap()` không join được.

**`logout()` tăng `sessionEpoch` đồng bộ, TRƯỚC mọi `await`.** Không có bước này thì user bấm Log Out trong lúc một refresh đang bay sẽ bị **đăng nhập lại âm thầm** bằng token vừa về.

**Router guard là default-deny.** `meta.public` để opt out. Đảo lại dùng `meta.requiresAuth` thì route thêm sau sẽ thành public do quên — đó là lý do chọn chiều này.

**`notes` có ba trạng thái, và nhầm là feature trả tiền chết:**
- `undefined` — chưa nạp (`GET /todos` bỏ hẳn key)
- `null` hoặc `''` — đã nạp, không có note
- `string` — có note

Prisma `select: { notes: plan === PAID }` **bỏ hẳn key** chứ không trả `null`.

**Xoá note gửi `{ notes: '' }`.** `undefined` bị `JSON.stringify` bỏ; `null` bị DTO `@IsString()` trả 400.

**UI bắt lỗi theo `code`, không bao giờ theo `message`** — `message` của API thường chỉ là tên class của Nest ("Unauthorized Exception"), vô dụng để hiển thị. Ngoại lệ duy nhất là `VALIDATION_FAILED`, nơi message mang chi tiết thật.

**Access token chỉ trong memory, không bao giờ localStorage.** `auth.hint` trong localStorage là cờ + email hiển thị — **không phải credential**. Không có nó thì mỗi lần load trang của khách chưa đăng nhập đều tiêu một suất quota `auth-ip` cho một refresh chắc chắn thất bại.

**`safeRedirect` chỉ nhận chuỗi khớp `/^\/(?!\/)/`** — `?redirect=//evil.com` là URL protocol-relative và `router.push` sẽ điều hướng ra khỏi origin.

**CLI shadcn-vue chèn lại `@import` Google Fonts mỗi lần `add`** — nó tải family "Geist" rồi khai `'Geist Variable'` (family khác, nên luôn rơi fallback mà vẫn tốn request). Key `font` đã bị gỡ khỏi `components.json`; đừng thêm lại.

**`eslint.config.ts` cố ý không được type-check** — `Linter.Config` của eslint và `FlatConfig` của typescript-eslint bất đồng ở `languageOptions`; annotate thì sai kiểu, để suy luận thì không đặt tên được dưới pnpm (TS2742). ESLint validate nó bằng cách thực thi, không phải type-check.

## Test

**Mỗi test một `QueryClient` mới**, nếu không cache rò giữa các case:

```ts
new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
```

**`await flushPromises()` TRƯỚC khi assert service được gọi.** `onMutate` của TanStack Query await `cancelQueries()` trước khi gọi `mutationFn`, nên service chưa chạy ngay sau `trigger('click')`. Đây là nguyên nhân 3 test đỏ khi chuyển sang TanStack Query ở 4b.

**Fixture phải copy mới mỗi test** (`mockTodos.map(t => ({...t}))`) — component thay entry tại chỗ, chia sẻ một object fixture khiến test nạp note để lại dấu vết cho test sau.

Ba tsconfig project: `app` (build), `node` (vite config), `vitest` (spec). Spec được type-check nhưng lỗi nằm tách riêng, không chặn `pnpm build`.

Helper có sẵn: `signFake(claims?)` sinh JWT giả, `axiosErrorWith(status, data, headers)` sinh `AxiosError` **thật** (cả interceptor lẫn error helper đều gate trên `axios.isAxiosError`).

## Nợ kỹ thuật đã biết

- **`clientRequestId` sinh bên trong `todoService.createTodo` và không bao giờ trả ngược cho `useTodos`** → optimistic id rơi vào nhánh `Date.now()`. Hệ quả: **echo suppression theo request id chưa chạy được**. Phải sửa trước khi làm realtime ở Phase 5.
- **Query key `['todos']` và ba helper `mapPages`/`filterPages`/`prependToFirst` đang là module-private** trong `useTodos.ts` → lớp realtime cần chúng thì phải tách ra (ví dụ `src/composables/todoCache.ts`), nếu không sẽ nhân bản logic.
- **`queryClient` trong `main.ts` là const local, không export** → lớp ngoài component tree phải nhận qua tham số, giống `setupInterceptors(api, pinia)` đang làm.
- `getTodos` lấy `limit: 50` cho đủ quota FREE; Load More đã theo `nextCursor` nhưng trang đầu vẫn cố tình to.
- `prependToFirst` **không dedupe** — merge một row "created" từ push cần check tồn tại trước.
- Mutation không có `onSettled`/`invalidateQueries` (trừ nhánh resolve conflict), nên cache không tự re-sync sau khi ghi.
- `staleTime: 30_000` + `refetchOnWindowFocus` mặc định bật: cache tự lành khi focus tab. Khi push realtime thành nguồn chân lý thì nên xét lại.
- `env.d.ts` chỉ khai `VITE_API_URL`; thêm biến mới phải sửa file đó, nếu không mọi lần đọc là `any`.
- `@vueuse/core` đã cài nhưng chỉ dùng ở 2 component shadcn sinh ra.

## Liên quan

- `../nest-todo-list-api/AGENTS.md` — nửa backend, kèm bảng phase và cạm bẫy riêng.
- Lộ trình đầy đủ 10 tuần nằm ngoài repo, ở plan file của Claude Code.
