import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { Sport } from '../../core/models/domain.model';
import { IconComponent } from '../icon/icon.component';

export interface SearchSubmission {
  sport?: string;
  city?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

/** Radii offered once coordinates are known (km). */
const RADIUS_OPTIONS = [5, 10, 25, 50, 100, 200] as const;
const DEFAULT_RADIUS = 25;

/**
 * Search form shared by the home hero and the results page.
 *
 * Location is strictly opt-in: the browser prompt only appears after the user presses
 * the location button, and manual city/neighbourhood search keeps working if the
 * permission is denied or unsupported (a translated notice explains what happened).
 * Latitude and longitude are only ever emitted together, as the API requires.
 */
@Component({
  selector: 'app-search-form',
  imports: [ReactiveFormsModule, TranslatePipe, IconComponent],
  template: `
    <form class="search" [attr.data-variant]="variant()" [formGroup]="form" (ngSubmit)="submit()">
      <div class="search__fields">
        <div class="field search__field">
          <label class="label" for="search-sport">{{ 'search.sportLabel' | t }}</label>
          <div class="search__control">
            <app-icon name="medal" [size]="17" class="search__icon" />
            <select id="search-sport" class="select" formControlName="sport">
              <option value="">{{ 'search.sportAny' | t }}</option>
              @for (sport of sports(); track sport.id) {
                <option [value]="sport.slug">{{ locale.sportName(sport.slug, sport.name) }}</option>
              }
            </select>
          </div>
        </div>

        <div class="field search__field">
          <label class="label" for="search-city">{{ 'search.cityLabel' | t }}</label>
          <div class="search__control">
            <app-icon name="map-pin" [size]="17" class="search__icon" />
            <input
              id="search-city"
              class="input"
              type="text"
              autocomplete="address-level2"
              formControlName="city"
              [placeholder]="'search.cityPlaceholder' | t"
            />
          </div>
        </div>

        @if (showNeighborhood()) {
          <div class="field search__field">
            <label class="label" for="search-neighborhood">{{ 'search.neighborhoodLabel' | t }}</label>
            <div class="search__control">
              <app-icon name="compass" [size]="17" class="search__icon" />
              <input
                id="search-neighborhood"
                class="input"
                type="text"
                autocomplete="address-level3"
                formControlName="neighborhood"
                [placeholder]="'search.neighborhoodPlaceholder' | t"
              />
            </div>
          </div>
        }

        @if (coordinates(); as coords) {
          <div class="field search__field">
            <label class="label" for="search-radius">{{ 'search.distanceLabel' | t }}</label>
            <select
              id="search-radius"
              class="select"
              [value]="radius()"
              (change)="onRadiusChange($event)"
            >
              @for (option of radiusOptions; track option) {
                <option [value]="option">{{ locale.formatNumber(option) }} {{ 'common.km' | t }}</option>
              }
            </select>
          </div>
        }
      </div>

      <div class="search__actions">
        @if (coordinates()) {
          <button type="button" class="btn btn--ghost btn--sm" (click)="clearLocation()">
            <app-icon name="close" [size]="15" />
            {{ 'search.locationClear' | t }}
          </button>
        } @else {
          <button type="button" class="btn btn--outline btn--sm" [disabled]="locating()" (click)="requestLocation()">
            <app-icon name="locate" [size]="15" />
            {{ (locating() ? 'search.locationLocating' : 'search.locationButton') | t }}
          </button>
        }

        @if (showClear()) {
          <button type="button" class="btn btn--ghost btn--sm" (click)="clearAll()">
            {{ 'common.clearAll' | t }}
          </button>
        }

        <button type="submit" class="btn btn--primary search__submit" [disabled]="busy()">
          @if (busy()) {
            <span class="search__spinner" aria-hidden="true"></span>
          } @else {
            <app-icon name="search" [size]="17" />
          }
          {{ 'common.search' | t }}
        </button>
      </div>

      @if (locationMessage(); as message) {
        <p class="search__notice" role="status">
          <app-icon [name]="coordinates() ? 'check-circle' : 'info'" [size]="15" />
          {{ message | t }}
        </p>
      }
    </form>
  `,
  styles: `
    :host {
      display: block;
    }

    .search {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      padding: clamp(0.9rem, 0.6rem + 1vw, 1.25rem);
      background: #fff;
      border: 1px solid var(--line);
      border-radius: var(--r-lg);
      box-shadow: var(--shadow-md);
    }

    .search[data-variant='page'] {
      box-shadow: var(--shadow-sm);
    }

    .search__fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.75rem;
      align-items: end;
    }

    .search__control {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search__icon {
      position: absolute;
      inset-inline-start: 0.7rem;
      color: var(--ink-400);
      pointer-events: none;
    }

    .search__control .input,
    .search__control .select {
      padding-inline-start: 2.3rem;
    }

    .search__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .search__submit {
      margin-inline-start: auto;
      min-width: 9rem;
    }

    .search__notice {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--ink-500);
    }

    .search__spinner {
      width: 1rem;
      height: 1rem;
      border-radius: 50%;
      border: 2px solid rgba(6, 20, 14, 0.25);
      border-top-color: var(--forest-950);
      animation: spin 700ms linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 560px) {
      .search__submit {
        margin-inline-start: 0;
        width: 100%;
      }
    }
  `,
})
export class SearchFormComponent {
  protected readonly locale = inject(LocaleService);

  readonly sports = input<Sport[]>([]);
  readonly variant = input<'hero' | 'page'>('hero');
  readonly showNeighborhood = input(false);
  readonly showClear = input(false);
  readonly busy = input(false);
  /** Current filters, e.g. restored from the URL on the results page. */
  readonly initial = input<SearchSubmission | null>(null);

  readonly submitted = output<SearchSubmission>();
  readonly cleared = output<void>();

  protected readonly radiusOptions = RADIUS_OPTIONS;
  protected readonly coordinates = signal<{ latitude: number; longitude: number } | null>(null);
  protected readonly radius = signal<number>(DEFAULT_RADIUS);
  protected readonly locating = signal(false);
  protected readonly locationMessage = signal<string | null>(null);

  protected readonly form = new FormGroup({
    sport: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
    neighborhood: new FormControl('', { nonNullable: true }),
  });

  private readonly appliedSignature = signal<string | null>(null);

  constructor() {
    effect(() => {
      const incoming = this.initial();
      const signature = JSON.stringify(incoming ?? null);
      if (signature === this.appliedSignature()) {
        return;
      }
      this.appliedSignature.set(signature);
      untracked(() => this.applyInitial(incoming));
    });
  }

  protected get hasFilters(): boolean {
    const value = this.form.getRawValue();
    return Boolean(value.sport || value.city.trim() || value.neighborhood.trim() || this.coordinates());
  }

  protected submit(): void {
    this.submitted.emit(this.currentSubmission());
  }

  protected clearAll(): void {
    this.form.reset({ sport: '', city: '', neighborhood: '' });
    this.coordinates.set(null);
    this.locationMessage.set(null);
    this.cleared.emit();
    this.submitted.emit({});
  }

  protected clearLocation(): void {
    this.coordinates.set(null);
    this.locationMessage.set(null);
    this.submitted.emit(this.currentSubmission());
  }

  protected onRadiusChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (Number.isFinite(value) && value > 0) {
      this.radius.set(value);
      this.submitted.emit(this.currentSubmission());
    }
  }

  /** The browser location prompt is only ever triggered by this explicit action. */
  protected requestLocation(): void {
    const geolocation = globalThis.navigator?.geolocation;
    if (!geolocation) {
      this.locationMessage.set('search.locationUnsupported');
      return;
    }

    this.locating.set(true);
    this.locationMessage.set(null);

    geolocation.getCurrentPosition(
      (position) => {
        this.locating.set(false);
        this.coordinates.set({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        this.locationMessage.set('search.locationActive');
        this.submitted.emit(this.currentSubmission());
      },
      () => {
        this.locating.set(false);
        // Manual search is unaffected — we only explain what happened.
        this.locationMessage.set('search.locationDenied');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }

  private currentSubmission(): SearchSubmission {
    const value = this.form.getRawValue();
    const coords = this.coordinates();
    return {
      sport: value.sport || undefined,
      city: value.city.trim() || undefined,
      neighborhood: this.showNeighborhood() ? value.neighborhood.trim() || undefined : undefined,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      radiusKm: coords ? this.radius() : undefined,
    };
  }

  private applyInitial(initial: SearchSubmission | null): void {
    if (!initial) {
      return;
    }
    this.form.patchValue(
      {
        sport: initial.sport ?? '',
        city: initial.city ?? '',
        neighborhood: initial.neighborhood ?? '',
      },
      { emitEvent: false },
    );
    if (typeof initial.latitude === 'number' && typeof initial.longitude === 'number') {
      this.coordinates.set({ latitude: initial.latitude, longitude: initial.longitude });
      this.locationMessage.set('search.locationActive');
      this.radius.set(initial.radiusKm ?? DEFAULT_RADIUS);
    } else {
      this.coordinates.set(null);
    }
  }
}
