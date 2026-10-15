import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, map, of, switchMap, take, tap } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  MAX_SESSION_MINUTES,
  MIN_SESSION_MINUTES,
  type AvailabilitySlot,
  type CoachDetail,
} from '../../core/models/domain.model';
import { BookingsService } from '../../core/services/bookings.service';
import { CoachesService } from '../../core/services/coaches.service';
import { ReviewsService, type CoachReviewsPage } from '../../core/services/reviews.service';
import { NotificationService } from '../../core/ui/notification.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { sportIcon } from '../../shared/media';
import { RatingStarsComponent } from '../../shared/rating-stars/rating-stars.component';
import { StatePanelComponent } from '../../shared/state-panel/state-panel.component';

const REVIEWS_PER_PAGE = 5;
/** Candidate session lengths; the ones that fit the chosen window are offered. */
const DURATION_STEPS = [15, 30, 45, 60, 75, 90, 120, 150, 180] as const;
/** Start times are offered on a 30-minute grid. */
const START_STEP_MS = 30 * 60 * 1000;
/** A request needs a little breathing room, so the earliest start is 15 minutes out. */
const LEAD_TIME_MS = 15 * 60 * 1000;

@Component({
  selector: 'app-coach-detail-page',
  imports: [
    RouterLink,
    TranslatePipe,
    IconComponent,
    AvatarComponent,
    RatingStarsComponent,
    StatePanelComponent,
  ],
  templateUrl: './coach-detail-page.component.html',
  styleUrl: './coach-detail-page.component.scss',
})
export class CoachDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly coaches = inject(CoachesService);
  private readonly reviewsService = inject(ReviewsService);
  private readonly bookings = inject(BookingsService);
  private readonly notifications = inject(NotificationService);
  protected readonly auth = inject(AuthService);
  protected readonly locale = inject(LocaleService);

  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly coachId = computed(() => this.paramMap().get('id') ?? '');
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly coach = signal<CoachDetail | null>(null);

  protected readonly reviewsPage = signal(1);
  protected readonly reviewsLoading = signal(false);
  protected readonly reviewPage = signal<CoachReviewsPage | null>(null);

  // --- Booking form state --------------------------------------------------
  protected readonly selectedWindowId = signal<string | null>(null);
  protected readonly selectedStart = signal<string | null>(null);
  protected readonly duration = signal(60);
  protected readonly sending = signal(false);
  protected readonly bookingError = signal<ApiError | null>(null);
  protected readonly bookingSent = signal(false);

  protected readonly windows = computed<AvailabilitySlot[]>(() => {
    const all = this.coach()?.availability ?? [];
    const cutoff = Date.now() + LEAD_TIME_MS;
    return all.filter((slot) => new Date(slot.endAt).getTime() > cutoff);
  });

  protected readonly selectedWindow = computed<AvailabilitySlot | null>(() => {
    const id = this.selectedWindowId();
    return this.windows().find((slot) => slot.id === id) ?? null;
  });

  protected readonly startOptions = computed(() => {
    const window = this.selectedWindow();
    if (!window) {
      return [];
    }
    const windowEnd = new Date(window.endAt).getTime();
    const earliest = Math.max(new Date(window.startAt).getTime(), Date.now() + LEAD_TIME_MS);
    // Snap up to the next half hour so clients pick tidy times.
    const first = Math.ceil(earliest / START_STEP_MS) * START_STEP_MS;

    const options: string[] = [];
    for (
      let timestamp = first;
      timestamp + MIN_SESSION_MINUTES * 60_000 <= windowEnd;
      timestamp += START_STEP_MS
    ) {
      options.push(new Date(timestamp).toISOString());
      if (options.length >= 24) {
        break;
      }
    }
    return options;
  });

  protected readonly durationOptions = computed(() => {
    const window = this.selectedWindow();
    const start = this.selectedStart();
    if (!window || !start) {
      return [] as number[];
    }
    const available =
      (new Date(window.endAt).getTime() - new Date(start).getTime()) / 60_000;
    const limit = Math.min(MAX_SESSION_MINUTES, Math.floor(available));
    return DURATION_STEPS.filter((minutes) => minutes >= MIN_SESSION_MINUTES && minutes <= limit);
  });

  protected readonly estimatedTotal = computed(() => {
    const coach = this.coach();
    if (!coach) {
      return null;
    }
    const hourly = Number(coach.hourlyPrice);
    if (!Number.isFinite(hourly)) {
      return null;
    }
    return this.locale.formatMoney((hourly * this.duration()) / 60);
  });

  protected readonly canBook = computed(
    () => Boolean(this.selectedWindow()) && Boolean(this.selectedStart()) && this.duration() > 0,
  );

  protected readonly reviewMeta = computed(() => this.reviewPage()?.meta ?? null);
  protected readonly reviewItems = computed(() => this.reviewPage()?.data ?? []);
  protected readonly reviewPages = computed(() => this.reviewMeta()?.totalPages ?? 0);

  constructor() {
    toObservable(this.coachId)
      .pipe(
        tap(() => this.reset()),
        switchMap((id) =>
          this.coaches.getById(id).pipe(
            map((coach) => ({ coach, error: null as ApiError | null })),
            catchError((error: unknown) =>
              of({ coach: null, error: ApiError.fromHttpError(error) }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ coach, error }) => {
        this.loading.set(false);
        this.error.set(error);
        this.coach.set(coach);
      });

    toObservable(computed(() => ({ id: this.coachId(), page: this.reviewsPage() })))
      .pipe(
        tap(() => this.reviewsLoading.set(true)),
        switchMap(({ id, page }) =>
          this.reviewsService.forCoach(id, page, REVIEWS_PER_PAGE).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.reviewsLoading.set(false);
        this.reviewPage.set(page);
      });

    // Pick a sensible default window/start/duration whenever availability changes.
    effect(() => {
      const windows = this.windows();
      untracked(() => {
        const currentId = this.selectedWindowId();
        if (windows.length === 0) {
          this.selectedWindowId.set(null);
          this.selectedStart.set(null);
          return;
        }
        if (!currentId || !windows.some((slot) => slot.id === currentId)) {
          this.selectWindow(windows[0].id);
        }
      });
    });

    // Keep the chosen duration valid for the selected start time.
    effect(() => {
      const options = this.durationOptions();
      untracked(() => {
        if (options.length === 0) {
          return;
        }
        if (!options.includes(this.duration())) {
          this.duration.set(options[options.length - 1]);
        }
      });
    });
  }

  protected selectWindow(windowId: string): void {
    this.selectedWindowId.set(windowId);
    const window = this.windows().find((slot) => slot.id === windowId);
    if (!window) {
      return;
    }
    const options = this.startOptionsFor(window);
    this.selectedStart.set(options[0] ?? null);
    this.duration.set(60);
  }

  protected selectStart(value: string): void {
    this.selectedStart.set(value);
  }

  protected selectDuration(minutes: number): void {
    this.duration.set(minutes);
  }

  protected submit(): void {
    const coach = this.coach();
    const start = this.selectedStart();
    if (!coach || !start) {
      return;
    }

    const startAt = new Date(start);
    const endAt = new Date(startAt.getTime() + this.duration() * 60_000);

    this.sending.set(true);
    this.bookingError.set(null);
    this.bookingSent.set(false);

    this.bookings
      .create({
        coachProfileId: coach.id,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      })
      .pipe(take(1), finalize(() => this.sending.set(false)))
      .subscribe({
        next: () => {
          this.bookingSent.set(true);
          this.notifications.success('coach.requestSentMessage');
        },
        error: (error: unknown) => {
          // Never claim success: the real API error is surfaced verbatim.
          const failure = ApiError.fromHttpError(error);
          this.bookingError.set(failure);
        },
      });
  }

  protected loadReviews(page: number): void {
    if (page < 1 || (this.reviewPages() > 0 && page > this.reviewPages())) {
      return;
    }
    this.reviewsPage.set(page);
  }

  protected sportIconName(slug: string): string {
    return sportIcon(slug);
  }

  protected retry(): void {
    // Re-mount the request by toggling through the same param map.
    const id = this.coachId();
    this.reset();
    this.loading.set(true);
    this.coaches
      .getById(id)
      .pipe(take(1))
      .subscribe({
        next: (coach) => {
          this.loading.set(false);
          this.coach.set(coach);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(ApiError.fromHttpError(error));
        },
      });
  }

  private startOptionsFor(window: AvailabilitySlot): string[] {
    const windowEnd = new Date(window.endAt).getTime();
    const earliest = Math.max(new Date(window.startAt).getTime(), Date.now() + LEAD_TIME_MS);
    const first = Math.ceil(earliest / START_STEP_MS) * START_STEP_MS;
    const options: string[] = [];
    for (
      let timestamp = first;
      timestamp + MIN_SESSION_MINUTES * 60_000 <= windowEnd;
      timestamp += START_STEP_MS
    ) {
      options.push(new Date(timestamp).toISOString());
    }
    return options;
  }

  private reset(): void {
    this.reviewsPage.set(1);
    this.reviewPage.set(null);
    this.selectedWindowId.set(null);
    this.selectedStart.set(null);
    this.duration.set(60);
    this.bookingError.set(null);
    this.bookingSent.set(false);
  }
}
