import { Injectable, signal } from '@angular/core';

import { ApiError } from '../api/api-error';
import type { TranslationParams } from '../i18n/locale.service';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  /** Translation key — resolved at render time so toasts follow language switches. */
  key: string;
  params?: TranslationParams;
  /** Raw, untranslated server text kept for diagnostics. */
  detail?: string;
}

const DURATIONS: Record<ToastKind, number> = {
  success: 4200,
  info: 5200,
  error: 8000,
};

/**
 * Small toast queue.
 *
 * Messages are stored as translation keys rather than rendered strings so switching
 * language re-translates anything still on screen.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messages = signal<ToastMessage[]>([]);
  private sequence = 0;

  readonly toasts = this.messages.asReadonly();

  success(key: string, params?: TranslationParams): void {
    this.push('success', key, params);
  }

  info(key: string, params?: TranslationParams): void {
    this.push('info', key, params);
  }

  error(key: string, params?: TranslationParams, detail?: string): void {
    this.push('error', key, params, detail);
  }

  /**
   * Presents a failed API call using the backend's stable `error.code`
   * (`errors.codes.NOT_FOUND`, …) and keeps the raw message as a detail line.
   */
  apiError(error: ApiError, fallbackKey = 'errors.generic'): void {
    const key = error.code ? `errors.codes.${error.code}` : fallbackKey;
    this.error(key, undefined, error.message);
  }

  dismiss(id: number): void {
    this.messages.update((current) => current.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this.messages.set([]);
  }

  private push(kind: ToastKind, key: string, params?: TranslationParams, detail?: string): void {
    const id = ++this.sequence;
    this.messages.update((current) => [...current, { id, kind, key, params, detail }]);
    globalThis.setTimeout?.(() => this.dismiss(id), DURATIONS[kind]);
  }
}
