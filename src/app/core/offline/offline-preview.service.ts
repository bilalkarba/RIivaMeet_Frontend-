import { Injectable, inject, signal } from '@angular/core';
import { Observable, delay, from, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../api/api-error';
import { LocaleService, type LanguageCode } from '../i18n/locale.service';
import type { MockCatalog } from './mock-catalog';

/** Only a genuine "could not connect" counts as offline. */
function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

/**
 * Development-only fallback for read-only screens.
 *
 * When the backend is not running, the API throws a status-0 error. Rather than showing
 * a dead page, the app can render clearly labelled sample data so the UI can be worked
 * on. Two rules keep this honest:
 *
 *  1. it is disabled in production builds (`environment.enableMockFallback`);
 *  2. it only ever answers *reads*. Login, registration, bookings and profile updates
 *     always go to the real API, so no action can appear to succeed when it did not.
 *
 * The fixtures live in `mock-catalog.ts`, which is pulled in through a dynamic import —
 * a production bundle never loads it.
 */
@Injectable({ providedIn: 'root' })
export class OfflinePreviewService {
  private readonly locale = inject(LocaleService);

  private readonly activeSignal = signal(false);
  private readonly enabledSignal = signal(false);

  /** True while sample data is being shown somewhere in the app. */
  readonly active = this.activeSignal.asReadonly();
  /** True when the fallback is available at all (development builds). */
  readonly enabled = this.enabledSignal.asReadonly();

  private cached: { language: LanguageCode; promise: Promise<MockCatalog> } | null = null;

  constructor() {
    this.enabledSignal.set(environment.enableMockFallback);
  }

  /**
   * Re-throws the original error unless the app is in a development build and the API
   * was unreachable, in which case it resolves with what `factory` derives from the
   * sample catalogue.
   */
  use<T>(error: unknown, factory: (catalog: MockCatalog) => T, delayMs = 220): Observable<T> {
    if (!environment.enableMockFallback || !isOffline(error)) {
      return throwError(() => error);
    }

    this.activeSignal.set(true);

    return from(this.loadCatalog()).pipe(
      map((catalog) => factory(catalog)),
      delay(delayMs),
    );
  }

  private loadCatalog(): Promise<MockCatalog> {
    const language = this.locale.language();
    if (!this.cached || this.cached.language !== language) {
      this.cached = {
        language,
        // Dynamic import keeps the fixtures (and their several KB of copy) out of the
        // production bundle entirely.
        promise: import('./mock-catalog').then((module) => module.createMockCatalog(language)),
      };
    }
    return this.cached.promise;
  }
}
