import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope, Paginated } from '../models/api.model';
import { ApiError } from './api-error';

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

/**
 * Parameter serialisation.
 * `null`, `undefined` and empty strings mean "filter not used" for this API and are
 * dropped, so components can bind optional filters directly without null-checking.
 */
export function toHttpParams(params?: QueryParams | HttpParams): HttpParams {
  if (params instanceof HttpParams) {
    return params;
  }
  let httpParams = new HttpParams();
  if (!params) {
    return httpParams;
  }
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    httpParams = httpParams.set(key, String(value));
  }
  return httpParams;
}

/**
 * Thin, typed wrapper around `HttpClient`.
 *
 * Responsibilities:
 *  - unwrap the `{ data }` / `{ data, meta }` envelopes so services return domain
 *    objects instead of transport objects;
 *  - convert every failure into an `ApiError`;
 *  - never invent a response. If the API does not answer, the caller sees an error.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  /** Public base URL of the API (useful for the footer's docs link and diagnostics). */
  readonly baseUrl = environment.apiUrl.replace(/\/+$/, '');

  url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /** GET an endpoint that answers `{ data: T }`. */
  getData<T>(path: string, params?: QueryParams | HttpParams): Observable<T> {
    return this.http
      .get<ApiEnvelope<T>>(this.url(path), { params: toHttpParams(params) })
      .pipe(map((response) => response.data), catchError(this.fail));
  }

  /** GET an endpoint that answers `{ data: T[], meta: M }`. */
  getPage<T, M extends object = object>(
    path: string,
    params?: QueryParams | HttpParams,
  ): Observable<Paginated<T, M>> {
    return this.http
      .get<Paginated<T, M>>(this.url(path), { params: toHttpParams(params) })
      .pipe(
        map((response) => ({ data: response.data ?? [], meta: response.meta })),
        catchError(this.fail),
      );
  }

  postData<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiEnvelope<T>>(this.url(path), body)
      .pipe(map((response) => response.data), catchError(this.fail));
  }

  patchData<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http
      .patch<ApiEnvelope<T>>(this.url(path), body)
      .pipe(map((response) => response.data), catchError(this.fail));
  }

  putData<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .put<ApiEnvelope<T>>(this.url(path), body)
      .pipe(map((response) => response.data), catchError(this.fail));
  }

  deleteData<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiEnvelope<T>>(this.url(path))
      .pipe(map((response) => response.data), catchError(this.fail));
  }

  private readonly fail = (error: unknown): Observable<never> =>
    throwError(() => ApiError.fromHttpError(error));
}
