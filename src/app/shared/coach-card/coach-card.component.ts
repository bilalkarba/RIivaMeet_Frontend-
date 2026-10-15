import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { CoachSummary } from '../../core/models/domain.model';
import { AvatarComponent } from '../avatar/avatar.component';
import { IconComponent } from '../icon/icon.component';
import { sportIcon, sportImage } from '../media';
import { RatingStarsComponent } from '../rating-stars/rating-stars.component';
import { SmartImageComponent } from '../smart-image/smart-image.component';

const MAX_SPORTS = 3;

/**
 * Coach result card.
 *
 * The backend exposes no coach photo, so identity comes from a monogram avatar over a
 * decorative sport-image band. Everything the API actually returns is surfaced: sports,
 * city/neighbourhood, optional distance, hourly price, experience level and rating.
 */
@Component({
  selector: 'app-coach-card',
  imports: [RouterLink, TranslatePipe, IconComponent, AvatarComponent, RatingStarsComponent, SmartImageComponent],
  template: `
    <article class="coach card card--interactive">
      <div class="coach__banner">
        <app-smart-image [src]="banner()" [alt]="''" ratio="16 / 7" tone="forest" />
        <span class="coach__scrim" aria-hidden="true"></span>
        @if (distanceLabel(); as distance) {
          <span class="chip chip--on-dark coach__distance">
            <app-icon name="map-pin" [size]="13" />
            {{ distance }}
          </span>
        }
      </div>

      <span class="coach__avatar">
        <app-avatar [name]="coach().name" size="lg" [decorative]="true" />
      </span>

      <div class="coach__body">
        <header class="coach__head">
          <h3 class="coach__name">{{ coach().name }}</h3>
          <app-rating-stars [value]="coach().averageRating" [count]="coach().reviewCount" />
        </header>

        <p class="coach__location">
          <app-icon name="map-pin" [size]="14" />
          <span>{{ coach().neighborhood }}, {{ coach().city }}</span>
        </p>

        <ul class="coach__sports">
          @for (sport of visibleSports(); track sport.id) {
            <li class="chip">
              <app-icon [name]="icon(sport.slug)" [size]="14" />
              {{ locale.sportName(sport.slug, sport.name) }}
            </li>
          }
          @if (extraSports() > 0) {
            <li class="chip chip--neutral">+{{ extraSports() }}</li>
          }
        </ul>

        <footer class="coach__foot">
          <p class="coach__price">
            <span class="coach__price-label">{{ 'coach.hourlyPrice' | t }}</span>
            <span class="coach__amount">
              {{ locale.formatMoney(coach().hourlyPrice) }}
              <span class="coach__unit">{{ 'common.perHour' | t }}</span>
            </span>
          </p>
          <span class="chip chip--neutral coach__level">
            {{ locale.enumLabel('level', coach().experienceLevel) }}
          </span>
        </footer>

        <a class="btn btn--primary btn--block" [routerLink]="['/coaches', coach().id]">
          {{ 'common.viewProfile' | t }}
          <app-icon name="arrow-right" [size]="16" class="dir-icon" />
        </a>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .coach {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .coach__banner {
      position: relative;
      background: var(--forest-900);
    }

    .coach__scrim {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(6, 20, 14, 0.15), rgba(6, 20, 14, 0.72));
    }

    .coach__distance {
      position: absolute;
      inset-block-start: 0.7rem;
      inset-inline-end: 0.7rem;
      backdrop-filter: blur(6px);
    }

    .coach__avatar {
      position: relative;
      display: inline-flex;
      margin-block-start: -0.75rem;
      margin-inline-start: 1.25rem;
      padding: 3px;
      border-radius: 50%;
      background: #fff;
      align-self: flex-start;
      z-index: 2;
    }

    .coach__body {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      padding: 0.85rem 1.25rem 1.35rem;
      flex: 1 1 auto;
    }

    .coach__head {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .coach__name {
      font-size: 1.16rem;
      line-height: 1.25;
    }

    .coach__location {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.85rem;
      color: var(--ink-500);
    }

    .coach__sports {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .coach__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-block-start: auto;
      padding-block-start: 0.35rem;
    }

    .coach__price {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }

    .coach__price-label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-400);
    }

    .coach__amount {
      font-size: 1.14rem;
      font-weight: 800;
      color: var(--forest-800);
    }

    .coach__unit {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--ink-500);
    }

    .coach__level {
      font-size: 0.72rem;
    }
  `,
})
export class CoachCardComponent {
  protected readonly locale = inject(LocaleService);

  readonly coach = input.required<CoachSummary>();

  protected readonly visibleSports = computed(() => this.coach().sports.slice(0, MAX_SPORTS));
  protected readonly extraSports = computed(() => Math.max(0, this.coach().sports.length - MAX_SPORTS));

  protected readonly banner = computed(() => {
    const first = this.coach().sports[0];
    return first ? sportImage(first.slug) : null;
  });

  protected readonly distanceLabel = computed(() => {
    const distance = this.coach().distanceKm;
    if (distance === null || distance === undefined) {
      return null;
    }
    return this.locale.formatDistance(distance);
  });

  protected icon(slug: string): string {
    return sportIcon(slug);
  }
}
