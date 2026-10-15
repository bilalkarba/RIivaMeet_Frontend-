import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { Booking } from '../../core/models/domain.model';
import { BookingsService } from '../../core/services/bookings.service';
import { ReviewsService } from '../../core/services/reviews.service';
import { NotificationService } from '../../core/ui/notification.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { BookingStatusBadgeComponent } from '../../shared/booking-status/booking-status-badge.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { RatingStarsComponent } from '../../shared/rating-stars/rating-stars.component';

type BookingView = 'client' | 'coach';

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * One booking, with only the actions the backend state machine permits:
 *
 *   PENDING                -> coach may accept or reject, client may cancel
 *   ACCEPTED               -> coach may complete or cancel, client may cancel
 *   COMPLETED              -> client may review (once)
 *   REJECTED / CANCELLED   -> terminal, no actions
 *
 * Every action hits the API and re-emits `changed` so the list refetches; a failure is
 * shown inline and never reported as success.
 */
@Component({
  selector: 'app-booking-card',
  imports: [
    RouterLink,
    FormsModule,
    TranslatePipe,
    IconComponent,
    AvatarComponent,
    BookingStatusBadgeComponent,
    RatingStarsComponent,
  ],
  template: `
    <article class="booking-row card">
      <div class="booking-row__main">
        <header class="booking-row__head">
          <div class="booking-row__who">
            <app-avatar [name]="counterpartName()" size="md" [decorative]="true" />
            <div class="booking-row__who-text">
              <span class="booking-row__role">
                {{ (view() === 'client' ? 'booking.with' : 'booking.client') | t }}
              </span>
              <a
                class="booking-row__name"
                [routerLink]="view() === 'client' ? ['/coaches', booking().coach.coachProfileId] : null"
              >
                {{ counterpartName() }}
              </a>
            </div>
          </div>

          <app-booking-status-badge [status]="booking().status" />
        </header>

        <dl class="booking-row__facts">
          <div>
            <dt>{{ 'booking.when' | t }}</dt>
            <dd>{{ locale.formatRange(booking().startAt, booking().endAt) }}</dd>
          </div>
          <div>
            <dt>{{ 'booking.duration' | t }}</dt>
            <dd>{{ 'coach.durationOption' | t: { count: booking().durationMinutes } }}</dd>
          </div>
          <div>
            <dt>{{ 'booking.where' | t }}</dt>
            <dd>{{ booking().coach.neighborhood }}, {{ booking().coach.city }}</dd>
          </div>
          <div>
            <dt>{{ 'booking.total' | t }}</dt>
            <dd class="booking-row__price">{{ locale.formatMoney(booking().priceAtBooking) }}</dd>
          </div>
        </dl>

        @if (booking().review; as review) {
          <div class="booking-row__review">
            <span class="booking-row__review-label">{{ 'booking.yourReview' | t }}</span>
            <app-rating-stars [value]="review.rating" [showValue]="false" [count]="null" />
            @if (review.comment) {
              <p class="booking-row__review-comment">{{ review.comment }}</p>
            }
          </div>
        }
      </div>

      <div class="booking-row__actions">
        @if (actionError(); as failure) {
          <p class="alert alert--error booking-row__error" role="alert">
            <app-icon name="alert" [size]="15" />
            <span>{{ (failure.isNetworkError ? 'errors.network' : failure.messageKey) | t }}</span>
          </p>
        }

        @if (canAccept()) {
          <button type="button" class="btn btn--primary btn--sm" [disabled]="busy()" (click)="accept()">
            {{ (busy() ? 'booking.accepting' : 'booking.accept') | t }}
          </button>
        }
        @if (canReject()) {
          <button type="button" class="btn btn--danger btn--sm" [disabled]="busy()" (click)="reject()">
            {{ (busy() ? 'booking.rejecting' : 'booking.reject') | t }}
          </button>
        }
        @if (canComplete()) {
          <button type="button" class="btn btn--primary btn--sm" [disabled]="busy()" (click)="complete()">
            {{ (busy() ? 'booking.completing' : 'booking.complete') | t }}
          </button>
        }

        @if (canMessage()) {
          <a class="btn btn--outline btn--sm" [routerLink]="['/bookings', booking().id, 'conversation']">
            <app-icon name="mail" [size]="15" />
            {{ 'booking.conversation' | t }}
          </a>
        }

        @if (canCancel()) {
          @if (confirmingCancel()) {
            <div class="booking-row__confirm">
              <p class="booking-row__confirm-title">{{ 'booking.confirmCancelTitle' | t }}</p>
              <p class="booking-row__confirm-text">{{ 'booking.confirmCancelMessage' | t }}</p>
              <div class="row">
                <button type="button" class="btn btn--danger btn--sm" [disabled]="busy()" (click)="cancel()">
                  {{ 'booking.yesCancel' | t }}
                </button>
                <button type="button" class="btn btn--ghost btn--sm" (click)="confirmingCancel.set(false)">
                  {{ 'booking.keep' | t }}
                </button>
              </div>
            </div>
          } @else {
            <button type="button" class="btn btn--outline btn--sm" [disabled]="busy()" (click)="confirmingCancel.set(true)">
              {{ (busy() ? 'booking.cancelling' : 'booking.cancel') | t }}
            </button>
          }
        }

        @if (canReview()) {
          @if (reviewOpen()) {
            <form class="booking-row__review-form" (ngSubmit)="submitReview()">
              <p class="booking-row__review-title">{{ 'booking.reviewTitle' | t }}</p>

              <div class="booking-row__stars" role="radiogroup" [attr.aria-label]="'booking.reviewRating' | t">
                @for (rating of ratings; track rating) {
                  <button
                    type="button"
                    class="booking-row__star"
                    role="radio"
                    [attr.aria-checked]="myRating === rating"
                    [class.is-active]="myRating >= rating"
                    [attr.aria-label]="rating"
                    (click)="myRating = rating"
                  >
                    <app-icon [name]="myRating >= rating ? 'star' : 'star-outline'" [size]="22" />
                  </button>
                }
              </div>

              <label class="sr-only" for="review-comment-{{ booking().id }}">{{ 'booking.reviewComment' | t }}</label>
              <textarea
                id="review-comment-{{ booking().id }}"
                class="textarea"
                name="comment"
                [(ngModel)]="myComment"
                [placeholder]="'booking.reviewCommentHint' | t"
                maxlength="1000"
              ></textarea>

              @if (reviewError(); as key) {
                <p class="field-error">{{ key | t }}</p>
              }

              <div class="row">
                <button type="submit" class="btn btn--primary btn--sm" [disabled]="reviewBusy() || myRating === 0">
                  {{ (reviewBusy() ? 'booking.submittingReview' : 'booking.submitReview') | t }}
                </button>
                <button type="button" class="btn btn--ghost btn--sm" (click)="reviewOpen.set(false)">
                  {{ 'common.cancel' | t }}
                </button>
              </div>
              <p class="field-hint">{{ 'booking.reviewCommentHint' | t }}</p>
            </form>
          } @else {
            <button type="button" class="btn btn--dark btn--sm" (click)="openReview()">
              <app-icon name="star" [size]="15" />
              {{ 'booking.leaveReview' | t }}
            </button>
          }
        }

        <p class="booking-row__requested">
          {{ 'booking.requestedOn' | t }} {{ locale.formatDate(booking().createdAt) }}
        </p>
      </div>
    </article>
  `,
  styleUrl: './booking-card.component.scss',
})
export class BookingCardComponent {
  private readonly bookings = inject(BookingsService);
  private readonly reviewsService = inject(ReviewsService);
  private readonly notifications = inject(NotificationService);
  protected readonly locale = inject(LocaleService);

  readonly booking = input.required<Booking>();
  readonly view = input<BookingView>('client');

  /** Emitted after a successful mutation so the parent reloads the list. */
  readonly changed = output<void>();

  protected readonly ratings = RATINGS;
  protected readonly busy = signal(false);
  protected readonly actionError = signal<ApiError | null>(null);
  protected readonly confirmingCancel = signal(false);
  protected readonly reviewOpen = signal(false);
  protected readonly reviewBusy = signal(false);
  protected readonly reviewError = signal<string | null>(null);

  protected myRating = 0;
  protected myComment = '';

  protected readonly canAccept = computed(
    () => this.view() === 'coach' && this.booking().status === 'PENDING',
  );
  protected readonly canReject = computed(
    () => this.view() === 'coach' && this.booking().status === 'PENDING',
  );
  protected readonly canComplete = computed(
    () => this.view() === 'coach' && this.booking().status === 'ACCEPTED',
  );
  protected readonly canMessage = computed(
    () => this.booking().status === 'ACCEPTED' || this.booking().status === 'COMPLETED',
  );
  protected readonly canCancel = computed(() => {
    const status = this.booking().status;
    return status === 'PENDING' || status === 'ACCEPTED';
  });
  protected readonly canReview = computed(
    () =>
      this.view() === 'client' && this.booking().status === 'COMPLETED' && !this.booking().review,
  );

  protected readonly counterpartName = computed(() =>
    this.view() === 'client' ? this.booking().coach.name : this.booking().client.name,
  );

  protected accept(): void {
    this.run(this.bookings.accept(this.booking().id));
  }

  protected reject(): void {
    this.run(this.bookings.reject(this.booking().id));
  }

  protected complete(): void {
    this.run(this.bookings.complete(this.booking().id));
  }

  protected cancel(): void {
    this.run(this.bookings.cancel(this.booking().id));
  }

  protected openReview(): void {
    this.myRating = this.booking().review?.rating ?? 5;
    this.myComment = this.booking().review?.comment ?? '';
    this.reviewError.set(null);
    this.reviewOpen.set(true);
  }

  protected submitReview(): void {
    if (this.myRating < 1) {
      this.reviewError.set('errors.fields.rating');
      return;
    }
    const comment = this.myComment.trim();
    if (comment.length > 0 && comment.length < 3) {
      this.reviewError.set('errors.fields.comment');
      return;
    }

    this.reviewBusy.set(true);
    this.reviewError.set(null);

    this.reviewsService
      .create(this.booking().id, {
        rating: this.myRating,
        ...(comment ? { comment } : {}),
      })
      .pipe(take(1), finalize(() => this.reviewBusy.set(false)))
      .subscribe({
        next: () => {
          this.reviewOpen.set(false);
          this.notifications.success('booking.reviewSuccess');
          this.changed.emit();
        },
        error: (error: unknown) => {
          const failure = ApiError.fromHttpError(error);
          this.reviewError.set(failure.isNetworkError ? 'errors.network' : failure.messageKey);
        },
      });
  }

  private run(request: ReturnType<BookingsService['accept']>): void {
    this.busy.set(true);
    this.actionError.set(null);

    request.pipe(take(1), finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.confirmingCancel.set(false);
        this.notifications.success('booking.actionDone');
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.confirmingCancel.set(false);
        this.actionError.set(ApiError.fromHttpError(error));
      },
    });
  }
}
