/**
 * Minimal, dependency-free JWT payload reader.
 *
 * The frontend never trusts this for authorisation — the backend verifies the
 * signature on every request. It is used only to know when the token has expired so
 * the UI can drop a stale session instead of spamming 401s.
 */

export interface AccessTokenPayload {
  sub: string;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
  iss?: string;
}

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeAccessToken(token: string): AccessTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as AccessTokenPayload;
    return typeof payload?.sub === 'string' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Considers a token expired 10 seconds early to avoid racing the server clock.
 */
export function isTokenExpired(token: string, skewSeconds = 10): boolean {
  const payload = decodeAccessToken(token);
  if (!payload) {
    return true;
  }
  if (typeof payload.exp !== 'number') {
    return false;
  }
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}
