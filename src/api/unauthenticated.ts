/**
 * Lets the axios interceptor say "the session is gone" without importing the
 * router.
 *
 * Importing it there would close a cycle — router → views → store → api →
 * router — and it also makes the behaviour trivial to assert in a unit test.
 * main.ts installs the real handler once the router exists.
 */
export type UnauthenticatedReason = 'expired' | 'reused'

let handler: (reason: UnauthenticatedReason) => void = () => {}

export function setUnauthenticatedHandler(fn: (reason: UnauthenticatedReason) => void): void {
  handler = fn
}

export function notifyUnauthenticated(reason: UnauthenticatedReason): void {
  handler(reason)
}
