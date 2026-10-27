/**
 * Accepts only a same-origin path.
 *
 * `?redirect=//evil.com` is a protocol-relative URL, and router.push() would
 * happily navigate off-origin with it. Requiring exactly one leading slash
 * rules that out along with absolute URLs.
 */
export function safeRedirect(value: unknown): string | null {
  return typeof value === 'string' && /^\/(?!\/)/.test(value) ? value : null
}
