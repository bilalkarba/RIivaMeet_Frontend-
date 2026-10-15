import { Component, input, output } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationParams } from '../../core/i18n/locale.service';
import { IconComponent } from '../icon/icon.component';

export type StateKind = 'loading' | 'error' | 'empty' | 'info';

const ICONS: Record<StateKind, string> = {
  loading: 'refresh',
  error: 'alert',
  empty: 'search',
  info: 'info',
};

/**
 * One consistent presentation for loading, error, empty and informational states, so
 * every page handles them the same way and no state is ever left silent.
 * Keys are passed in (not prose) so all copy stays translatable.
 */
@Component({
  selector: 'app-state-panel',
  imports: [TranslatePipe, IconComponent],
  template: `
    <div
      class="state"
      [attr.data-kind]="kind()"
      [attr.role]="kind() === 'error' ? 'alert' : 'status'"
      [attr.aria-live]="kind() === 'error' ? 'assertive' : 'polite'"
      [attr.aria-busy]="kind() === 'loading'"
    >
      @if (kind() === 'loading') {
        <span class="state__spinner" aria-hidden="true"></span>
      } @else {
        <span class="state__icon" aria-hidden="true">
          <app-icon [name]="icon()" [size]="24" />
        </span>
      }

      <h3 class="state__title">{{ titleKey() | t }}</h3>

      @if (messageKey()) {
        <p class="state__text">{{ messageKey()! | t: messageParams() }}</p>
      }

      @if (detail()) {
        <p class="state__detail">{{ detail() }}</p>
      }

      @if (actionKey()) {
        <button type="button" class="btn btn--dark btn--sm" (click)="action.emit()">
          {{ actionKey()! | t }}
        </button>
      }

      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.65rem;
      padding: clamp(1.75rem, 1rem + 4vw, 3.25rem) 1.25rem;
      text-align: center;
      background: #fff;
      border: 1px dashed var(--line-strong);
      border-radius: var(--r-lg);
      color: var(--ink-700);
    }

    .state[data-kind='error'] {
      border-style: solid;
      border-color: rgba(192, 69, 63, 0.28);
      background: var(--rose-50);
    }

    .state[data-kind='loading'] {
      border-style: solid;
      border-color: var(--line);
    }

    .state__icon {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      background: var(--forest-50);
      color: var(--forest-700);
    }

    .state[data-kind='error'] .state__icon {
      background: #fff;
      color: var(--rose-500);
    }

    .state__title {
      font-size: 1.12rem;
    }

    .state__text {
      max-width: 46ch;
      font-size: 0.92rem;
      color: var(--ink-500);
    }

    .state__detail {
      max-width: 60ch;
      font-size: 0.78rem;
      color: var(--ink-400);
      font-family: ui-monospace, 'SFMono-Regular', 'Cascadia Code', monospace;
      word-break: break-word;
    }

    .state__spinner {
      width: 2.4rem;
      height: 2.4rem;
      border-radius: 50%;
      border: 3px solid var(--forest-100);
      border-top-color: var(--forest-600);
      animation: spin 780ms linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class StatePanelComponent {
  readonly kind = input<StateKind>('loading');
  readonly titleKey = input('common.loading');
  readonly messageKey = input<string | null>(null);
  readonly messageParams = input<TranslationParams | undefined>(undefined);
  /** Raw technical text (e.g. the server message) shown small and untranslated. */
  readonly detail = input<string | null>(null);
  readonly actionKey = input<string | null>(null);
  readonly iconOverride = input<string | null>(null);

  readonly action = output<void>();

  protected icon(): string {
    return this.iconOverride() ?? ICONS[this.kind()];
  }
}
