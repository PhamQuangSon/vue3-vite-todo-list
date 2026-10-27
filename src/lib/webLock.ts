/**
 * Runs `fn` while holding a named lock shared across this origin's tabs.
 *
 * This is what keeps two tabs from refreshing at the same instant. Refresh
 * tokens are single-use: the API rotates the cookie and revokes the old token,
 * and replaying a revoked one is treated as theft — it revokes the entire token
 * family, signing the user out everywhere. Sequential refreshes are safe,
 * because the second tab's request carries the cookie the first one set. Only
 * simultaneous ones collide, and serializing them removes that window.
 *
 * Falls back to running unlocked where the Web Locks API is unavailable, which
 * is also what happens under jsdom in tests.
 */
export async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks

  if (!locks?.request) return fn()

  return locks.request(name, fn) as Promise<T>
}
