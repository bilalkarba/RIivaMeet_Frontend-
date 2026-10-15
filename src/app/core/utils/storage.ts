/**
 * Safe localStorage access.
 *
 * Storage can throw (private browsing, disabled cookies, quota) so every access is
 * wrapped. Nothing security-critical is stored here: the JWT access token is the only
 * sensitive value and the API is the real gatekeeper for every permission.
 */

export function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* ignore — the app still works, it just will not remember the value */
  }
}

export function removeStorage(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}
