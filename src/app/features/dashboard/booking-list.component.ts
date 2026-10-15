import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, combineLatestWith, filter, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { PaginationMeta } from '../../core/models/api.model';
import { BOOKING_STATUSES, type Booking, type BookingStatus } from '../../core/models/domain.model';
import { BookingRealtimeService } from '../../core/services/booking-realtime.service';
import { BookingsService } from '../../core/services/bookings.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { StatePanelComponent } from '../../shared/state-panel/state-panel.component';
import { BookingCardComponent } from './booking-card.component';

type StatusFilter = BookingStatus | 'ALL';
type BookingView = 'client' | 'coach';

const PAGE_SIZE = 10;

/**
 * Booking list with status filters and pagination.
 *
 * `GET /bookings/mine` is role-aware on the server: a client token returns the requests
 * they made, a coach token returns the requests made to their profile. The list is
 * re-fetched after every mutation, so the statuses shown are always the server's.
 */
@Component({
  selector: 'app-booking-list',
  imports: [RouterLink, TranslatePipe, IconComponent, BookingCardComponent, StatePanelComponent],
  template: `
    <div class="stack stack-4">
      <div class="filters-row" role="group" [attr.aria-label]="'booking.statusFilter' | t">
        <button
          type="button"
          class="chip filters-row__chip"
          [class.chip--lime]="status() === 'ALL'"
          [attr.aria-pressed]="status() === 'ALL'"
          (click)="setStatus('ALL')"
        >
          {{ 'common.all' | t }}
        </button>
        @for (option of statuses; track option) {
          <button
            type="button"
            class="chip filters-row__chip"
            [class.chip--lime]="status() === option"
            [attr.aria-pressed]="status() === option"
            (click)="setStatus(option)"
          >
            {{ 'enums.status.' + option | t }}
          </button>
        }
      </div>

      @if (loading()) {
        <div class="stack stack-3" aria-hidden="true">
          @for (placeholder of [1, 2, 3]; track placeholder) {
            <div class="skeleton booking-skeleton"></div>
          }
        </div>
      } @else if (error(); as failure) {
        <app-state-panel
          kind="error"
          titleKey="errors.title"
          [messageKey]="failure.isNetworkError ? 'errors.network' : failure.messageKey"
          [detail]="failure.message"
          actionKey="common.retry"
          (action)="reload()"
        />
      } @else if (items().length === 0) {
        @if (view() === 'client') {
          <app-state-panel
            kind="empty"
            titleKey="booking.emptyTitle"
            messageKey="booking.emptyMessage"
          >
            <a class="btn btn--dark btn--sm" routerLink="/coaches">{{ 'booking.findCoach' | t }}</a>
          </app-state-panel>
        } @else {
          <app-state-panel
            kind="empty"
            titleKey="booking.emptyCoachTitle"
            messageKey="booking.emptyCoachMessage"
          />
        }
      } @else {
        <p class="results-count" role="status">
          {{ 'booking.count' | t: { count: meta()?.total ?? items().length } }}
        </p>

        <div class="stack stack-3">
          @for (booking of items(); track booking.id) {
            <app-booking-card [booking]="booking" [view]="view()" (changed)="reload()" />
          }
        </div>

        @if (meta(); as page) {
          @if (page.totalPages > 1) {
            <nav class="pagination" [attr.aria-label]="'common.page' | t">
              <button
                type="button"
                class="pagination__step"
                [attr.aria-label]="'search.prevPage' | t"
                [disabled]="!page.hasPreviousPage"
                (click)="goToPage(page.page - 1)"
              >
                <app-icon name="chevron-left" [size]="16" class="dir-icon" />
              </button>
              <span class="pagination__status">
                {{ 'common.page' | t }} {{ locale.formatNumber(page.page) }} {{ 'common.of' | t }}
                {{ locale.formatNumber(page.totalPages) }}
              </span>
              <button
                type="button"
                class="pagination__step"
                [attr.aria-label]="'search.nextPage' | t"
                [disabled]="!page.hasNextPage"
                (click)="goToPage(page.page + 1)"
              >
                <app-icon name="chevron-right" [size]="16" class="dir-icon" />
              </button>
            </nav>
          }
        }
      }
    </div>
  `,
  styleUrl: './booking-list.component.scss',
})
export class BookingListComponent {
  private readonly bookings = inject(BookingsService);
  private readonly realtime = inject(BookingRealtimeService);
  protected readonly locale = inject(LocaleService);

  readonly view = input<BookingView>('client');

  protected readonly statuses = BOOKING_STATUSES;
  protected readonly status = signal<StatusFilter>('ALL');
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly items = signal<Booking[]>([]);
  protected readonly meta = signal<PaginationMeta | null>(null);

  private readonly reloadToken = signal(0);

  constructor() {
    const request = computed(() => ({ status: this.status(), page: this.page() }));

    toObservable(request)
      .pipe(
        combineLatestWith(toObservable(this.reloadToken)),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(([{ status, page }]) =>
          this.bookings
            .listMine({ status: status === 'ALL' ? undefined : status, page, limit: PAGE_SIZE })
            .pipe(
              map((result) => ({ result, error: null as ApiError | null })),
              catchError((error: unknown) =>
                of({ result: null, error: ApiError.fromHttpError(error) }),
              ),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ result, error }) => {
        this.loading.set(false);
        this.error.set(error);
        this.items.set(result?.data ?? []);
        this.meta.set(result?.meta ?? null);
      });

    this.realtime.notifications
      .pipe(
        filter(() => this.view() === 'coach'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.reload());

    // Coaches land on actionable pending requests; clients keep the full history.
    effect(() => {
      const view = this.view();
      untracked(() => {
        this.status.set(view === 'coach' ? 'PENDING' : 'ALL');
        this.page.set(1);
      });
    });

    // Changing the status filter always returns to the first page.
    effect(() => {
      this.status();
      untracked(() => this.page.set(1));
    });
  }

  protected setStatus(next: StatusFilter): void {
    this.status.set(next);
  }

  protected reload(): void {
    this.reloadToken.update((token) => token + 1);
  }

  protected goToPage(page: number): void {
    const meta = this.meta();
    if (!meta || page < 1 || page > meta.totalPages || page === meta.page) {
      return;
    }
    this.page.set(page);
  }
}
