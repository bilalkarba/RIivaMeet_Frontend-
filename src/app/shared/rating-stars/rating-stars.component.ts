import { Component, computed, inject, input } from '@angular/core';

import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../icon/icon.component';

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Star rating with partial fill.
 *
 * The filled layer is clipped from the logical `inline-start` edge, so in Arabic RTL
 * the rating fills from the right exactly as it should — no mirrored markup, no
 * transform hacks. `onDark` switches to the lime accent used on forest panels (a host
 * class rather than a descendant selector, which view encapsulation would not match).
 */
@Component({
  selector: 'app-rating-stars',
  imports: [IconComponent, TranslatePipe],
  host: { '[class.is-dark]': 'onDark()' },
  template: `
    <span class="rating" [attr.aria-label]="ariaLabel()" role="img">
      <span class="rating__track">
        <span class="rating__row" aria-hidden="true">
          @for (star of stars; track star) {
            <app-icon name="star-outline" [size]="size()" />
          }
        </span>
        <span class="rating__clipped" [style.width.%]="percent()" aria-hidden="true">
          <span class="rating__row rating__row--fill">
            @for (star of stars; track star) {
              <app-icon name="star" [size]="size()" />
            }
          </span>
        </span>
      </span>
      @if (showValue()) {
        <span class="rating__value">{{ display() }}</span>
      }
      @if (count() !== null && count()! > 0) {
        <span class="rating__count">({{ count() }})</span>
      }
      @if (value() === null) {
        <span class="rating__empty">{{ 'common.noReviews' | t }}</span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .rating {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--amber-500);
      font-size: 0.83rem;
      font-weight: 700;
    }

    .rating__track {
      position: relative;
      display: inline-block;
      line-height: 0;
    }

    .rating__row {
      display: inline-flex;
      gap: 2px;
      color: var(--cream-300);
    }

    .rating__row--fill {
      color: var(--amber-500);
      width: max-content;
    }

    .rating__clipped {
      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 0;
      overflow: hidden;
      line-height: 0;
    }

    .rating__value {
      color: var(--ink-900);
      font-variant-numeric: tabular-nums;
    }

    .rating__count,
    .rating__empty {
      color: var(--ink-500);
      font-weight: 600;
    }

    .rating__empty {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 14ch;
    }

    :host(.is-dark) .rating__row {
      color: rgba(255, 255, 255, 0.22);
    }

    :host(.is-dark) .rating__row--fill {
      color: var(--lime-400);
    }

    :host(.is-dark) .rating__value {
      color: var(--cream-50);
    }

    :host(.is-dark) .rating__count,
    :host(.is-dark) .rating__empty {
      color: rgba(238, 245, 240, 0.7);
    }
  `,
})
export class RatingStarsComponent {
  private readonly locale = inject(LocaleService);

  readonly value = input<number | null>(null);
  readonly count = input<number | null>(null);
  readonly size = input(15);
  readonly showValue = input(true);
  /** Renders the lime/cream variant for use on forest-green panels. */
  readonly onDark = input(false);

  protected readonly stars = STARS;

  protected readonly percent = computed(() => {
    const rating = this.value();
    return rating ? Math.max(0, Math.min(100, (rating / 5) * 100)) : 0;
  });

  protected readonly display = computed(() => {
    const rating = this.value();
    return rating === null
      ? '–'
      : this.locale.formatNumber(rating, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  });

  protected readonly ariaLabel = computed(() => {
    const base = `${this.locale.t('common.rating')}: ${this.display()} / 5`;
    const count = this.count();
    return typeof count === 'number' && count > 0
      ? `${base} — ${this.locale.t('common.reviews')}: ${count}`
      : base;
  });
}
