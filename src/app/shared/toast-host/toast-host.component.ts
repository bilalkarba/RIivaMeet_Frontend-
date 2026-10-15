import { Component, inject } from '@angular/core';

import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { NotificationService } from '../../core/ui/notification.service';
import { IconComponent } from '../icon/icon.component';

const ICONS: Record<string, string> = {
  success: 'check-circle',
  error: 'alert',
  info: 'info',
};

/** Fixed-position toast stack; errors are announced assertively for screen readers. */
@Component({
  selector: 'app-toast-host',
  imports: [TranslatePipe, IconComponent],
  template: `
    <div class="toasts" aria-live="polite" aria-atomic="false">
      @for (toast of notifications.toasts(); track toast.id) {
        <div
          class="toast"
          [attr.data-kind]="toast.kind"
          [attr.role]="toast.kind === 'error' ? 'alert' : 'status'"
        >
          <span class="toast__icon" aria-hidden="true">
            <app-icon [name]="iconFor(toast.kind)" [size]="18" />
          </span>
          <div class="toast__body">
            <p class="toast__message">{{ toast.key | t: toast.params }}</p>
            @if (toast.detail) {
              <p class="toast__detail">{{ toast.detail }}</p>
            }
          </div>
          <button
            type="button"
            class="toast__close"
            [attr.aria-label]="'common.close' | t"
            (click)="notifications.dismiss(toast.id)"
          >
            <app-icon name="close" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      z-index: 90;
      inset-block-start: calc(var(--header-h) + 0.75rem);
      inset-inline-end: clamp(0.75rem, 0.2rem + 1.5vw, 1.5rem);
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      width: min(23rem, calc(100vw - 1.5rem));
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      padding: 0.8rem 0.85rem;
      border-radius: var(--r-md);
      background: #fff;
      border: 1px solid var(--line);
      box-shadow: var(--shadow-lg);
      pointer-events: auto;
      animation: toast-in 220ms var(--ease);
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
    }

    .toast[data-kind='success'] {
      border-color: rgba(47, 138, 85, 0.3);
    }

    .toast[data-kind='error'] {
      border-color: rgba(192, 69, 63, 0.3);
    }

    .toast__icon {
      display: grid;
      place-items: center;
      width: 1.9rem;
      height: 1.9rem;
      border-radius: 50%;
      background: var(--forest-50);
      color: var(--forest-700);
      flex: none;
    }

    .toast[data-kind='success'] .toast__icon {
      background: var(--green-50);
      color: var(--green-600);
    }

    .toast[data-kind='error'] .toast__icon {
      background: var(--rose-50);
      color: var(--rose-500);
    }

    .toast__body {
      flex: 1 1 auto;
      min-width: 0;
    }

    .toast__message {
      font-size: 0.89rem;
      font-weight: 600;
      color: var(--ink-800);
    }

    .toast__detail {
      margin-block-start: 0.2rem;
      font-size: 0.76rem;
      color: var(--ink-400);
      word-break: break-word;
    }

    .toast__close {
      display: grid;
      place-items: center;
      width: 1.7rem;
      height: 1.7rem;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--ink-400);
      cursor: pointer;
      flex: none;
    }

    .toast__close:hover {
      background: var(--cream-200);
      color: var(--ink-800);
    }
  `,
})
export class ToastHostComponent {
  protected readonly notifications = inject(NotificationService);
  protected readonly locale = inject(LocaleService);

  protected iconFor(kind: string): string {
    return ICONS[kind] ?? 'info';
  }
}
