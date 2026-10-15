/**
 * Production environment.
 *
 * Mock/offline-preview behaviour and developer hints are hard-disabled here so a
 * production bundle can never present sample data as if it came from the API.
 */
export const environment = {
  production: true,
  apiUrl: 'http://localhost:4000/api/v1',
  enableMockFallback: false,
  defaultLanguage: 'ar',
  showDevHints: false,
};
