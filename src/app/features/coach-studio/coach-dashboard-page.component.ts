import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, map, take } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  EXPERIENCE_LEVELS,
  type AvailabilitySlot,
  type BookingNotification,
  type CoachDetail,
  type ExperienceLevel,
  type Sport,
  type SportSummary,
} from '../../core/models/domain.model';
import { BookingNotificationsService } from '../../core/services/booking-notifications.service';
import { BookingRealtimeService } from '../../core/services/booking-realtime.service';
import { CoachesService } from '../../core/services/coaches.service';
import { SportsService } from '../../core/services/sports.service';
import { NotificationService } from '../../core/ui/notification.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { BookingListComponent } from '../dashboard/booking-list.component';
import { CoachVerificationPanelComponent } from './coach-verification-panel.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { sportIcon } from '../../shared/media';
import { StatePanelComponent } from '../../shared/state-panel/state-panel.component';

type StudioTab = 'profile' | 'sports' | 'availability' | 'verification' | 'requests';

/** Optional text field: only validated when the user actually typed something. */
const optionalMinLength =
  (min: number): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value as string | null)?.trim() ?? '';
    if (!value) {
      return null;
    }
    return value.length >= min ? null : { minlength: true };
  };

/** Latitude and longitude must always be supplied together, as the API requires. */
const coordinatesPairValidator: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const latitude = group.get('latitude');
  const longitude = group.get('longitude');
  if (!latitude || !longitude) {
    return null;
  }
  const hasLat = latitude.value !== null && latitude.value !== '';
  const hasLng = longitude.value !== null && longitude.value !== '';
  if (hasLat === hasLng) {
    latitude.setErrors(withoutKey(latitude.errors, 'asymmetric'));
    return null;
  }
  latitude.setErrors({ ...(latitude.errors ?? {}), asymmetric: true });
  return { asymmetric: true };
};

function withoutKey(errors: ValidationErrors | null, key: string): ValidationErrors | null {
  if (!errors) {
    return null;
  }
  const { [key]: _removed, ...rest } = errors;
  return Object.keys(rest).length > 0 ? rest : null;
}

/** `Date` -> value accepted by `<input type="datetime-local">` (local time, no zone). */
function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function defaultWindow(): { startAt: string; endAt: string } {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(12, 0, 0, 0);
  return { startAt: toLocalInputValue(start), endAt: toLocalInputValue(end) };
}

/**
 * Coach studio.
 *
 * Covers the whole coach lifecycle the API exposes, in the order the backend requires:
 * create profile → add at least one sport → set coordinates → publish. Every save is a
 * real request; a rejected publish shows the backend's own error rather than pretending
 * to have worked.
 */
@Component({
  selector: 'app-coach-dashboard-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    IconComponent,
    AvatarComponent,
    BookingListComponent,
    CoachVerificationPanelComponent,
    StatePanelComponent,
  ],
  templateUrl: './coach-dashboard-page.component.html',
  styleUrl: './coach-dashboard-page.component.scss',
})
export class CoachDashboardPageComponent {
  protected readonly auth = inject(AuthService);
  protected readonly locale = inject(LocaleService);
  private readonly coaches = inject(CoachesService);
  private readonly sportsService = inject(SportsService);
  private readonly bookingNotifications = inject(BookingNotificationsService);
  private readonly bookingRealtime = inject(BookingRealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(NotificationService);

  protected readonly tabs: readonly StudioTab[] = [
    'profile',
    'sports',
    'availability',
    'verification',
    'requests',
  ];
  protected readonly levels = EXPERIENCE_LEVELS;
  protected readonly tab = signal<StudioTab>('profile');
  protected readonly bookingAlerts = signal<BookingNotification[]>([]);
  protected readonly unreadBookingAlertCount = signal(0);
  protected readonly alertsLoading = signal(false);
  protected readonly alertsError = signal<ApiError | null>(null);
  protected readonly realtimeUnavailable = signal(false);
  protected readonly markingAlertsRead = signal(false);

  // --- Profile -------------------------------------------------------------
  protected readonly hasProfile = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<ApiError | null>(null);
  protected readonly profile = signal<CoachDetail | null>(null);
  protected readonly saving = signal(false);
  protected readonly publishing = signal(false);
  protected readonly isPublished = signal(false);
  protected readonly locating = signal(false);
  protected readonly locationMessage = signal<string | null>(null);

  protected readonly profileForm = new FormGroup(
    {
      bio: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(20), Validators.maxLength(2000)],
      }),
      hourlyPrice: new FormControl<number | null>(null, {
        validators: [Validators.required, Validators.min(0), Validators.max(100_000)],
      }),
      experienceLevel: new FormControl<ExperienceLevel>('BEGINNER', { nonNullable: true }),
      city: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
      }),
      neighborhood: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
      }),
      address: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(200), optionalMinLength(3)],
      }),
      latitude: new FormControl<number | null>(null, {
        validators: [Validators.min(-90), Validators.max(90)],
      }),
      longitude: new FormControl<number | null>(null, {
        validators: [Validators.min(-180), Validators.max(180)],
      }),
    },
    { validators: coordinatesPairValidator },
  );

  private readonly profileFormValue = toSignal(
    this.profileForm.valueChanges.pipe(map(() => this.profileForm.getRawValue())),
    { initialValue: this.profileForm.getRawValue() },
  );

  protected readonly coordinates = computed(() => {
    const { latitude, longitude } = this.profileFormValue();
    if (latitude === null || longitude === null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return null;
    }
    return { latitude: Number(latitude), longitude: Number(longitude) };
  });

  protected readonly completion = computed(() => {
    const value = this.profileForm.getRawValue();
    return [
      { key: 'checkBio', done: value.bio.trim().length >= 20 },
      { key: 'checkPrice', done: value.hourlyPrice !== null && Number(value.hourlyPrice) >= 0 },
      { key: 'checkLocation', done: this.coordinates() !== null },
      { key: 'checkSports', done: this.mySportIds().size > 0 },
      { key: 'checkPublished', done: this.isPublished() },
    ];
  });

  // --- Sports -------------------------------------------------------------
  protected readonly sports = signal<Sport[]>([]);
  protected readonly mySports = signal<SportSummary[]>([]);
  protected readonly mySportIds = signal<Set<string>>(new Set());
  protected readonly sportsSaving = signal(false);

  // --- Availability --------------------------------------------------------
  protected readonly availability = signal<AvailabilitySlot[]>([]);
  protected readonly availabilitySaving = signal(false);
  protected readonly availabilityError = signal<string | null>(null);

  protected readonly availabilityForm = new FormGroup(
    {
      startAt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      endAt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    {
      validators: (group: AbstractControl): ValidationErrors | null => {
        const start = group.get('startAt')?.value as string;
        const end = group.get('endAt')?.value as string;
        if (!start || !end) {
          return null;
        }
        return new Date(start).getTime() < new Date(end).getTime() ? null : { range: true };
      },
    },
  );

  constructor() {
    if (!this.auth.isCoach()) {
      // The panel explaining how to become a coach is rendered instead of any form.
      this.loading.set(false);
      return;
    }
    this.load();
    this.loadBookingAlerts();

    const token = this.auth.token();
    if (token) {
      this.bookingRealtime.connect(token);
      this.bookingRealtime.notifications
        .pipe(takeUntilDestroyed())
        .subscribe((notification) => this.addBookingAlert(notification));
      this.bookingRealtime.connectionErrors
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.realtimeUnavailable.set(true));
      effect(() => {
        if (this.bookingRealtime.connected()) {
          this.realtimeUnavailable.set(false);
        }
      });
      this.destroyRef.onDestroy(() => this.bookingRealtime.disconnect());
    } else {
      this.realtimeUnavailable.set(true);
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.availabilityForm.patchValue(defaultWindow(), { emitEvent: false });

    forkJoin({
      profile: this.coaches.getMyProfile(),
      sports: this.sportsService.list(),
      mySports: this.coaches.listMySports(),
      availability: this.coaches.listMyAvailability(),
    })
      .pipe(take(1))
      .subscribe({
        next: (result) => this.applyLoaded(result),
        error: (error: unknown) => {
          const failure = ApiError.fromHttpError(error);
          // 404 simply means "no coach profile yet", which is a valid state to create from.
          if (failure.status === 404 || failure.code === 'NOT_FOUND') {
            this.hasProfile.set(false);
            this.profile.set(null);
            this.loading.set(false);
            this.loadSportsOnly();
            return;
          }
          this.loading.set(false);
          this.loadError.set(failure);
        },
      });
  }

  protected retry(): void {
    if (this.auth.isCoach()) {
      this.load();
    }
  }

  protected setTab(tab: StudioTab): void {
    this.tab.set(tab);
    if (tab === 'requests') {
      this.loadBookingAlerts();
    }
  }

  protected loadBookingAlerts(): void {
    this.alertsLoading.set(true);
    this.alertsError.set(null);
    this.bookingNotifications
      .listMine()
      .pipe(take(1), finalize(() => this.alertsLoading.set(false)))
      .subscribe({
        next: (inbox) => {
          const current = this.bookingAlerts();
          const liveAlerts = current.filter(
            (alert) => !inbox.notifications.some((stored) => stored.id === alert.id),
          );
          this.bookingAlerts.set([...liveAlerts, ...inbox.notifications].slice(0, 20));
          this.unreadBookingAlertCount.set(
            inbox.unreadCount + liveAlerts.filter((alert) => alert.readAt === null).length,
          );
        },
        error: (error: unknown) => this.alertsError.set(ApiError.fromHttpError(error)),
      });
  }

  protected markBookingAlertsRead(): void {
    if (this.unreadBookingAlertCount() === 0 || this.markingAlertsRead()) {
      return;
    }
    this.markingAlertsRead.set(true);
    this.bookingNotifications
      .markAllRead()
      .pipe(take(1), finalize(() => this.markingAlertsRead.set(false)))
      .subscribe({
        next: () => this.loadBookingAlerts(),
        error: (error: unknown) => this.notifications.apiError(ApiError.fromHttpError(error)),
      });
  }

  protected reconnectRealtime(): void {
    const token = this.auth.token();
    if (!token) {
      this.realtimeUnavailable.set(true);
      return;
    }
    this.bookingRealtime.connect(token);
    this.loadBookingAlerts();
  }

  private addBookingAlert(notification: BookingNotification): void {
    const alerts = this.bookingAlerts();
    if (alerts.some((alert) => alert.id === notification.id)) {
      return;
    }
    if (notification.readAt === null) {
      this.unreadBookingAlertCount.update((count) => count + 1);
    }
    this.bookingAlerts.set([notification, ...alerts].slice(0, 20));
  }

  // --- Profile actions -----------------------------------------------------

  protected saveProfile(): void {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid) {
      return;
    }

    const value = this.profileForm.getRawValue();
    const address = value.address.trim();
    const coordinates = this.coordinates();
    const base = {
      bio: value.bio.trim(),
      hourlyPrice: Number(value.hourlyPrice),
      experienceLevel: value.experienceLevel,
      city: value.city.trim(),
      neighborhood: value.neighborhood.trim(),
    };

    this.saving.set(true);

    const request = this.hasProfile()
      ? this.coaches.updateMyProfile({
          ...base,
          address: address ? address : null,
          latitude: coordinates?.latitude ?? null,
          longitude: coordinates?.longitude ?? null,
        })
      : this.coaches.createMyProfile({
          ...base,
          ...(address ? { address } : {}),
          ...(coordinates ? coordinates : {}),
        });

    request.pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.isPublished.set(profile.isPublished);
        const wasNew = !this.hasProfile();
        this.hasProfile.set(true);
        this.auth.patchUser({ hasCoachProfile: true });
        this.notifications.success(
          wasNew ? 'coachDash.profile.created' : 'coachDash.profile.saved',
        );
      },
      error: (error: unknown) => {
        const failure = ApiError.fromHttpError(error);
        this.notifications.apiError(failure);
      },
    });
  }

  protected togglePublish(): void {
    if (!this.hasProfile()) {
      return;
    }
    const next = !this.isPublished();

    if (next && (this.coordinates() === null || this.mySportIds().size === 0)) {
      this.notifications.error('coachDash.profile.publishBlocked');
      return;
    }

    this.publishing.set(true);
    this.coaches
      .updateMyProfile({ isPublished: next })
      .pipe(take(1), finalize(() => this.publishing.set(false)))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.isPublished.set(profile.isPublished);
          this.notifications.success('coachDash.profile.saved');
        },
        error: (error: unknown) => this.notifications.apiError(ApiError.fromHttpError(error)),
      });
  }

  /** Location is only requested after this explicit user action. */
  protected useMyLocation(): void {
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
        this.profileForm.patchValue({
          latitude: Math.round(position.coords.latitude * 1_000_000) / 1_000_000,
          longitude: Math.round(position.coords.longitude * 1_000_000) / 1_000_000,
        });
        this.profileForm.controls.latitude.markAsTouched();
        this.locationMessage.set('coachDash.profile.coordinatesSet');
      },
      () => {
        this.locating.set(false);
        this.locationMessage.set('coachDash.profile.locationDenied');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }

  protected clearCoordinates(): void {
    this.profileForm.patchValue({ latitude: null, longitude: null });
    this.locationMessage.set(null);
  }

  // --- Sports actions ------------------------------------------------------

  protected toggleSport(sportId: string): void {
    this.mySportIds.update((current) => {
      const next = new Set(current);
      if (next.has(sportId)) {
        next.delete(sportId);
      } else {
        next.add(sportId);
      }
      return next;
    });
  }

  protected isSportSelected(sportId: string): boolean {
    return this.mySportIds().has(sportId);
  }

  protected saveSports(): void {
    const ids = [...this.mySportIds()];
    if (ids.length === 0) {
      this.notifications.error('coachDash.sports.empty');
      return;
    }

    this.sportsSaving.set(true);
    this.coaches
      .replaceMySports(ids)
      .pipe(take(1), finalize(() => this.sportsSaving.set(false)))
      .subscribe({
        next: (sports) => {
          this.mySports.set(sports);
          this.notifications.success('coachDash.sports.saved');
        },
        error: (error: unknown) => this.notifications.apiError(ApiError.fromHttpError(error)),
      });
  }

  protected sportIconName(slug: string): string {
    return sportIcon(slug);
  }

  // --- Availability actions ------------------------------------------------

  protected addAvailability(): void {
    this.availabilityForm.markAllAsTouched();
    this.availabilityError.set(null);

    if (this.availabilityForm.invalid) {
      this.availabilityError.set(
        this.availabilityForm.hasError('range') ? 'errors.fields.endAt' : null,
      );
      return;
    }

    const value = this.availabilityForm.getRawValue();
    const start = new Date(value.startAt);
    const end = new Date(value.endAt);

    this.availabilitySaving.set(true);
    this.coaches
      .createMyAvailability({ startAt: start.toISOString(), endAt: end.toISOString() })
      .pipe(take(1), finalize(() => this.availabilitySaving.set(false)))
      .subscribe({
        next: (slots) => {
          this.availability.set(slots);
          this.availabilityForm.patchValue(defaultWindow());
          this.notifications.success('coachDash.availability.added');
        },
        error: (error: unknown) => {
          const failure = ApiError.fromHttpError(error);
          this.availabilityError.set(
            failure.status === 409 ? 'coachDash.availability.overlap' : failure.messageKey,
          );
        },
      });
  }

  protected deleteAvailability(slot: AvailabilitySlot): void {
    this.availabilitySaving.set(true);
    this.coaches
      .deleteMyAvailability(slot.id)
      .pipe(take(1), finalize(() => this.availabilitySaving.set(false)))
      .subscribe({
        next: (slots) => {
          this.availability.set(slots);
          this.notifications.success('coachDash.availability.deleted');
        },
        error: (error: unknown) => this.notifications.apiError(ApiError.fromHttpError(error)),
      });
  }

  // --- Field errors --------------------------------------------------------

  protected bioError(): string | null {
    const control = this.profileForm.controls.bio;
    if (!control.invalid || !control.touched) {
      return null;
    }
    return 'errors.fields.bio';
  }

  protected priceError(): string | null {
    const control = this.profileForm.controls.hourlyPrice;
    if (!control.invalid || !control.touched) {
      return null;
    }
    return 'errors.fields.hourlyPrice';
  }

  protected cityError(): string | null {
    const control = this.profileForm.controls.city;
    if (!control.invalid || !control.touched) {
      return null;
    }
    return 'errors.fields.city';
  }

  protected neighborhoodError(): string | null {
    const control = this.profileForm.controls.neighborhood;
    if (!control.invalid || !control.touched) {
      return null;
    }
    return 'errors.fields.neighborhood';
  }

  protected addressError(): string | null {
    const control = this.profileForm.controls.address;
    if (!control.invalid || !control.touched) {
      return null;
    }
    return 'errors.fields.address';
  }

  protected coordinatesError(): string | null {
    const control = this.profileForm.controls.latitude;
    if (!control.invalid || !control.touched) {
      return null;
    }
    return control.hasError('asymmetric') ? 'errors.fields.latitudeLongitude' : 'errors.fields.latitude';
  }

  // --- Internals -----------------------------------------------------------

  private applyLoaded(result: {
    profile: CoachDetail;
    sports: Sport[];
    mySports: SportSummary[];
    availability: AvailabilitySlot[];
  }): void {
    this.profile.set(result.profile);
    this.hasProfile.set(true);
    this.isPublished.set(result.profile.isPublished);
    this.sports.set(result.sports);
    this.mySports.set(result.mySports);
    this.mySportIds.set(new Set(result.mySports.map((sport) => sport.id)));
    this.availability.set(result.availability);
    this.loading.set(false);

    this.setProfileFormValues(result.profile);
  }

  /** When the coach has no profile yet the catalogue still needs to load. */
  private loadSportsOnly(): void {
    forkJoin({
      sports: this.sportsService.list(),
      mySports: this.coaches.listMySports(),
      availability: this.coaches.listMyAvailability(),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ sports, mySports, availability }) => {
          this.sports.set(sports);
          this.mySports.set(mySports);
          this.mySportIds.set(new Set(mySports.map((sport) => sport.id)));
          this.availability.set(availability);
        },
        error: (error: unknown) => this.loadError.set(ApiError.fromHttpError(error)),
      });
  }

  private setProfileFormValues(profile: CoachDetail): void {
    this.profileForm.patchValue(
      {
        bio: profile.bio,
        hourlyPrice: Number(profile.hourlyPrice),
        experienceLevel: profile.experienceLevel,
        city: profile.city,
        neighborhood: profile.neighborhood,
        address: profile.address ?? '',
        latitude: profile.latitude,
        longitude: profile.longitude,
      },
    );
  }
}
