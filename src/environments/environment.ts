/**
 * Development environment.
 *
 * `apiUrl` points at the running RivaMeet Express API. Change it here (or in
 * `environment.production.ts`) to point at another backend — no secrets belong in
 * frontend code, the only thing the browser needs is this public base URL.
 */
export const environment = {
  production: false,
  /** Base URL of the RivaMeet API, including the `/api/v1` prefix. */
  apiUrl: 'https://riivameetbackend-production.up.railway.app/api/v1',
  /**
   * Development-only safety net: when the API cannot be reached at all (connection
   * refused / offline), read-only screens fall back to clearly labelled sample data
   * and the UI shows an "offline preview" banner. Writes are never faked.
   */
  enableMockFallback: true,
  /** Default UI language. Arabic is the product default. */
  defaultLanguage: 'fr',
  /** Show development helpers (demo-account shortcuts) in the UI. */
  showDevHints: true,
};
