import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of, take } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { CoachSummary, Sport } from '../../core/models/domain.model';
import { CoachesService } from '../../core/services/coaches.service';
import { SportsService } from '../../core/services/sports.service';
import { submissionToQuery } from '../../core/utils/search-params';
import { CoachCardComponent } from '../../shared/coach-card/coach-card.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { MEDIA, sportIcon, sportImage } from '../../shared/media';
import { SearchFormComponent, type SearchSubmission } from '../../shared/search-form/search-form.component';
import { SmartImageComponent } from '../../shared/smart-image/smart-image.component';
import { StatePanelComponent } from '../../shared/state-panel/state-panel.component';

type Audience = 'clients' | 'coaches';

const FEATURED_LIMIT = 6;

@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    TranslatePipe,
    IconComponent,
    SmartImageComponent,
    CoachCardComponent,
    SearchFormComponent,
    StatePanelComponent,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent {
  protected readonly locale = inject(LocaleService);
  private readonly sportsService = inject(SportsService);
  private readonly coachesService = inject(CoachesService);
  private readonly router = inject(Router);

  protected readonly media = MEDIA;

  protected readonly sports = signal<Sport[]>([]);
  protected readonly featured = signal<CoachSummary[]>([]);
  protected readonly totalCoaches = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly audience = signal<Audience>('clients');
  protected readonly clientSteps = ['c1', 'c2', 'c3'] as const;
  protected readonly coachSteps = ['k1', 'k2', 'k3'] as const;
  protected readonly steps = computed(() =>
    this.audience() === 'clients' ? this.clientSteps : this.coachSteps,
  );

  protected readonly trustItems = [
    { icon: 'star', titleKey: 'home.trust.item1Title', textKey: 'home.trust.item1Text' },
    { icon: 'calendar', titleKey: 'home.trust.item2Title', textKey: 'home.trust.item2Text' },
    { icon: 'wallet', titleKey: 'home.trust.item3Title', textKey: 'home.trust.item3Text' },
  ] as const;

  /** Count of the plain "feature" claims shown next to the two live numbers. */
  private failures = 0;
  private readonly firstError = signal<ApiError | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.failures = 0;
    this.firstError.set(null);

    const sports$ = this.sportsService.list().pipe(
      catchError((error: unknown) => {
        this.recordFailure(error);
        return of<Sport[]>([]);
      }),
    );

    const featured$ = this.coachesService
      .search({ sort: 'rating_desc', limit: FEATURED_LIMIT })
      .pipe(
        catchError((error: unknown) => {
          this.recordFailure(error);
          return of(null);
        }),
      );

    forkJoin([sports$, featured$])
      .pipe(take(1), finalize(() => this.loading.set(false)))
      .subscribe(([sports, page]) => {
        this.sports.set(sports);
        this.featured.set(page?.data ?? []);
        this.totalCoaches.set(page?.meta.total ?? null);
        // Only surface a blocking error when *nothing* could be loaded.
        this.error.set(this.failures === 2 ? this.firstError() : null);
      });
  }

  protected onSearch(submission: SearchSubmission): void {
    void this.router.navigate(['/coaches'], { queryParams: submissionToQuery(submission) });
  }

  protected selectAudience(next: Audience): void {
    this.audience.set(next);
  }

  protected sportIconName(slug: string): string {
    return sportIcon(slug);
  }

  protected sportImageUrl(slug: string): string | null {
    return sportImage(slug);
  }

  private recordFailure(error: unknown): void {
    this.failures += 1;
    if (!this.firstError()) {
      this.firstError.set(ApiError.fromHttpError(error));
    }
  }
}
