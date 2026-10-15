import { HttpErrorResponse } from '@angular/common/http';

import {
  NETWORK_ERROR_CODE,
  type ApiErrorBody,
  type ApiFieldIssue,
} from '../models/api.model';

export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  issues?: ApiFieldIssue[];
  requestId?: string;
  details?: unknown;
}

/**
 * A normalized failure.
 *
 * Everything that can go wrong in a request (HTTP error, validation failure, network
 * outage) is turned into this single type so components never have to inspect an
 * `HttpErrorResponse` and the same error mapping is reused everywhere.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: ApiFieldIssue[];
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.issues = init.issues ?? [];
    this.requestId = init.requestId;
    this.details = init.details;
  }

  /** The request never reached the API (offline, DNS failure, connection refused). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** Session is gone or the token expired. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** Message for the API's `error.code`, as a translation key. */
  get messageKey(): string {
    return `errors.codes.${this.code}`;
  }

  /**
   * Translation key for a specific field reported by Zod, or `null` when the backend
   * did not report that field.
   */
  issueKeyFor(path: string): string | null {
    return this.issues.some((issue) => issue.path === path) ? `errors.fields.${path}` : null;
  }

  /** Every issue reported for one field, ready to render under an input. */
  issuesFor(path: string): string[] {
    return this.issues.filter((issue) => issue.path === path).map((issue) => issue.message);
  }

  static fromHttpError(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error instanceof HttpErrorResponse) {
      const body = error.error as ApiErrorBody | null;
      const envelope = body && typeof body === 'object' && 'error' in body ? body : null;
      const details = envelope?.error?.details;
      const issues = Array.isArray(details)
        ? details.filter(
            (issue): issue is ApiFieldIssue =>
              Boolean(issue) && typeof (issue as ApiFieldIssue).path === 'string',
          )
        : [];

      const code =
        envelope?.error?.code ??
        (error.status === 0 ? NETWORK_ERROR_CODE : 'INTERNAL_ERROR');

      return new ApiError({
        status: error.status,
        code,
        message: envelope?.error?.message ?? error.message ?? 'The request failed',
        issues,
        requestId: envelope?.requestId,
        details,
      });
    }

    return new ApiError({
      status: 0,
      code: NETWORK_ERROR_CODE,
      message: error instanceof Error ? error.message : 'The request failed',
    });
  }
}
