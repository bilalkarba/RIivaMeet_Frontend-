import { Component, computed, inject, input, signal } from '@angular/core';

import { LocaleService, type LanguageCode } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../icon/icon.component';

/**
 * Visible language switch: العربية / Français / English.
 *
 * Implemented as a disclosure button plus a listbox, with click-outside and Escape
 * handling, `aria-expanded`/`aria-selected` state and a visible focus ring. The
 * selected language is persisted by `LocaleService`, so it survives navigation and
 * reloads.
 */
@Component({
  selector: 'app-language-selector',
  imports: [TranslatePipe, IconComponent],
  host: {
    '[class.is-dark]': 'onDark()',
    '(document:click)': 'close()',
    '(keydown.escape)': 'close()',
  },
  template: `
    <div class="lang">
      <button
        type="button"
        class="lang__trigger"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="'languages.change' | t"
        aria-haspopup="listbox"
        (click)="toggle($event)"
      >
        <app-icon name="globe" [size]="18" />
        <span class="lang__current">{{ active().label }}</span>
        <app-icon name="chevron-down" [size]="15" class="lang__caret" [class.is-open]="open()" />
      </button>

      @if (open()) {
        <ul class="lang__menu" role="listbox" [attr.aria-label]="'languages.label' | t">
          @for (option of options; track option.code) {
            <li role="none">
              <button
                type="button"
                role="option"
                class="lang__option"
                [attr.aria-selected]="option.code === language()"
                [class.is-active]="option.code === language()"
                (click)="select(option.code, $event)"
              >
                <span class="lang__label">{{ option.label }}</span>
                <span class="lang__code">{{ option.direction === 'rtl' ? 'RTL' : 'LTR' }}</span>
                @if (option.code === language()) {
                  <app-icon name="check" [size]="16" class="lang__check" />
                }
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
      position: relative;
    }

    .lang {
      position: relative;
    }

    .lang__trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.42rem 0.7rem;
      border-radius: var(--r-pill);
      border: 1px solid var(--line-strong);
      background: #fff;
      color: var(--ink-800);
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      transition:
        border-color var(--dur-fast) var(--ease),
        background-color var(--dur-fast) var(--ease);
    }

    .lang__trigger:hover {
      border-color: var(--forest-600);
    }

    .lang__caret {
      transition: transform var(--dur-fast) var(--ease);
    }

    .lang__caret.is-open {
      transform: rotate(180deg);
    }

    .lang__menu {
      position: absolute;
      z-index: 60;
      inset-block-start: calc(100% + 0.4rem);
      inset-inline-end: 0;
      min-width: 12.5rem;
      padding: 0.35rem;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: var(--r-md);
      box-shadow: var(--shadow-lg);
      animation: lang-in 160ms var(--ease);
    }

    @keyframes lang-in {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }

    .lang__option {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      width: 100%;
      padding: 0.5rem 0.6rem;
      border: 0;
      border-radius: var(--r-xs);
      background: transparent;
      color: var(--ink-800);
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      text-align: start;
    }

    .lang__option:hover {
      background: var(--cream-100);
    }

    .lang__option.is-active {
      background: var(--forest-50);
      color: var(--forest-800);
    }

    .lang__label {
      flex: 1 1 auto;
    }

    .lang__code {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--ink-400);
    }

    .lang__check {
      color: var(--forest-600);
    }

    /* On a dark hero the trigger borrows the frosted treatment. */
    :host(.is-dark) .lang__trigger {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.28);
      color: var(--cream-50);
    }

    :host(.is-dark) .lang__trigger:hover {
      background: rgba(255, 255, 255, 0.18);
    }
  `,
})
export class LanguageSelectorComponent {
  private readonly locale = inject(LocaleService);

  /** Frosted variant for the transparent header over a dark hero. */
  readonly onDark = input(false);

  protected readonly options = this.locale.languages;
  protected readonly language = this.locale.language;
  protected readonly active = computed(() => this.locale.activeOption());
  protected readonly open = signal(false);

  protected toggle(event: Event): void {
    // Stop the document-level listener from closing the menu on the same click.
    event.stopPropagation();
    this.open.update((value) => !value);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected select(code: LanguageCode, event: Event): void {
    event.stopPropagation();
    this.locale.setLanguage(code);
    this.open.set(false);
  }
}
