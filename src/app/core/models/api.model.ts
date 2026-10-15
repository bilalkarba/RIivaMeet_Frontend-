/**
 * Transport-level models for the RivaMeet API envelopes.
 *
 * Success:    { "data": ... }                  or { "data": [...], "meta": {...} }
 * Failure:    { "error": { "code", "message", "details?" }, "requestId": "..." }
 */

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Client-side pseudo-code used when the request never reached the API. */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';
export type ClientErrorCode = typeof NETWORK_ERROR_CODE;

export interface ApiEnvelope<T> {
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** `meta` may carry endpoint-specific extras (e.g. a review rating summary). */
export interface Paginated<T, M extends object = object> {
  data: T[];
  meta: PaginationMeta & M;
}

/** A single Zod issue as serialised by the backend error handler. */
export interface ApiFieldIssue {
  path: string;
  message: string;
  code: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}
