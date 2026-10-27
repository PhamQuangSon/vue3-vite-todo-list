/**
 * A hint that a refresh cookie probably exists, plus the email to display.
 *
 * NOT a credential. The access token stays in memory only and the refresh token
 * is httpOnly, so neither is readable here or stored here. This exists for two
 * reasons:
 *
 *  1. Without it, every page load by a visitor who has never signed in spends
 *     one of the API's 20-per-minute-per-IP anonymous requests on a refresh
 *     that is certain to 401.
 *  2. The API has no /me endpoint and the access token carries no email, so
 *     after a silent refresh there would be nothing to show but a raw uuid.
 *
 * Treat the email as display-only and untrusted: it is whatever was typed into
 * a form on this device, and it can be stale if another account signed in
 * elsewhere. Never branch authorization on it.
 */
const KEY = 'auth.hint'

interface SessionHint {
  email?: string
}

// localStorage throws in private mode and can be blocked outright, so every
// access is guarded and failure degrades to "no hint".
function read(): SessionHint | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SessionHint) : null
  } catch {
    return null
  }
}

export function hasSessionHint(): boolean {
  return read() !== null
}

export function readSessionEmail(): string | null {
  return read()?.email ?? null
}

export function setSessionHint(email: string | null): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(email ? { email } : {}))
  } catch {
    // Storage unavailable: the app still works, it just re-checks the cookie on
    // every load and shows a uuid instead of an email.
  }
}

export function clearSessionHint(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do; see setSessionHint.
  }
}
