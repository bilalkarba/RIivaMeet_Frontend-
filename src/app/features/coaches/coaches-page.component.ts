import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatestWith, map, of, switchMap, take, tap } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { PaginationMeta } from '../../core/models/api.model';
import {
  COACH_SORTS,
  DISTANCE_SORTS,
  type CoachSearchFilters,
  type CoachSort,
  type CoachSummary,
  type Sport,
} from '../../core/models/domain.model';
import { CoachesService } from '../../core/services/coaches.service';
import { SportsService } from '../../core/services/sports.service';
import {
  filtersFromQuery,
  filtersToQuery,
  queryToSubmission,
  submissionToQuery,
} from '../../core/utils/search-params';
import { CoachCardComponent } from '../../shared/coach-card/coach-card.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { SearchFormComponent, type SearchSubmission } from '../../shared/search-form/search-form.component';
import { StatePanelComponent } from '../../shared/state-panel/state-panel.component';

interface SearchResult {
  page: { data: CoachSummary[]; meta: PaginationMeta } | null;
  error: ApiError | null;
}

const RATING_OPTIONS = [5, 4, 3, 2] as const;
const PAGE_WINDOW = 2;

/**
 * Coach search.
 *
 * The query string is the single source of truth for the filters: every control writes
 * back to the URL and the results are derived from it. That makes a search shareable,
 * makes the back button work, and removes any chance of the UI and the request
 * disagreeing. Requests are switched (never queued), so typing quickly cannot render a
 * stale result set.
 */
@Component({
  selector: 'app-coaches-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    TranslatePipe,
    IconComponent,
    CoachCardComponent,
    SearchFormComponent,
    StatePanelComponent,
  ],
  templateUrl: './coaches-page.component.html',
  styleUrl: './coaches-page.component.scss',
})
export class CoachesPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly coaches = inject(CoachesService);
  private readonly sportsService = inject(SportsService);
  protected readonly locale = inject(LocaleService);

  protected readonly filtersOpen = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly result = signal<SearchResult['page']>(null);

  /** Bumped by the retry action to re-run the current search without touching the URL. */
  private readonly reloadToken = signal(0);

  protected readonly sports = signal<Sport[]>([]);
  protected readonly ratingOptions = RATING_OPTIONS;
  protected readonly sortOptions = COACH_SORTS;

  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** Filters exactly as they appear in the URL. */
  protected readonly filters = computed<CoachSearchFilters>(() => filtersFromQuery(this.queryParamMap()));
  protected readonly searchInitial = computed(() => queryToSubmission(this.filters()));
  protected readonly results = computed(() => this.result()?.data ?? []);
  protected readonly meta = computed(() => this.result()?.meta ?? null);
  protected readonly total = computed(() => this.meta()?.total ?? 0);

  protected readonly activeSort = computed<CoachSort>(() => this.filters().sort ?? 'newest');
  protected readonly hasLocation = computed(
    () => typeof this.filters().latitude === 'number' && typeof this.filters().longitude === 'number',
  );

  /** Sort choices; distance options need coordinates, so they are only offered with them. */
  protected readonly availableSorts = computed<CoachSort[]>(() =>
    this.hasLocation()
      ? [...COACH_SORTS]
      : COACH_SORTS.filter((sort) => !DISTANCE_SORTS.includes(sort)),
  );

  protected readonly hasActiveFilters = computed(() => {
    const current = this.filters();
    return Object.values(current).some((value) => value !== undefined);
  });

  protected readonly pageNumbers = computed(() => {
    const current = this.meta();
    if (!current || current.totalPages <= 1) {
      return [] as number[];
    }
    const start = Math.max(1, current.page - PAGE_WINDOW);
    const end = Math.min(current.totalPages, current.page + PAGE_WINDOW);
    const pages: number[] = [];
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    return pages;
  });

  protected readonly advanced = new FormGroup({
    minPrice: new FormControl<number | null>(null),
    maxPrice: new FormControl<number | null>(null),
    minRating: new FormControl<number | null>(null),
    sort: new FormControl<CoachSort>('newest', { nonNullable: true }),
  });

  constructor() {
    this.sportsService
      .list()
      .pipe(take(1))
      .subscribe({
        next: (list) => this.sports.set(list),
        error: () => this.sports.set([]),
      });

    // Keep the "advanced" controls in sync with the URL (back/forward, deep links).
    effect(() => {
      const current = this.filters();
      untracked(() => {
        this.advanced.setValue(
          {
            minPrice: current.minPrice ?? null,
            maxPrice: current.maxPrice ?? null,
            minRating: current.minRating ?? null,
            sort: current.sort ?? 'newest',
          },
          { emitEvent: false },
        );
      });
    });

    toObservable(this.filters)
      .pipe(
        combineLatestWith(toObservable(this.reloadToken)),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(([filters]) =>
          this.coaches.search(filters).pipe(
            map((page): SearchResult => ({ page, error: null })),
            catchError((error: unknown) =>
              of<SearchResult>({ page: null, error: ApiError.fromHttpError(error) }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((outcome) => {
        this.loading.set(false);
        this.error.set(outcome.error);
        this.result.set(outcome.page);
      });
  }

  /** Re-runs the search as-is (used by the error state's retry action). */
  protected retry(): void {
    this.reloadToken.update((token) => token + 1);
  }

  protected setRating(rating: number | null): void {
    this.advanced.controls.minRating.setValue(rating);
    this.onAdvancedChange();
  }

  protected onSearch(submission: SearchSubmission): void {
    this.navigate({ ...this.filters(), page: undefined, ...submissionToQuery(submission) });
  }

  protected onAdvancedChange(): void {
    const value = this.advanced.getRawValue();
    this.navigate({
      ...this.filters(),
      page: undefined,
      minPrice: value.minPrice ?? undefined,
      maxPrice: value.maxPrice ?? undefined,
      minRating: value.minRating ?? undefined,
      sort: value.sort,
    });
  }

  protected onSortChange(event: Event): void {
    const sort = (event.target as HTMLSelectElement).value as CoachSort;
    this.advanced.controls.sort.setValue(sort);
    this.navigate({ ...this.filters(), page: undefined, sort });
  }

  protected clearFilters(): void {
    void this.router.navigate(['/coaches']);
  }

  protected goToPage(page: number): void {
    const meta = this.meta();
    if (!meta || page < 1 || page > meta.totalPages || page === meta.page) {
      return;
    }
    this.navigate({ ...this.filters(), page });
    if (globalThis.scrollY > 240) {
      globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
    }
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  protected sortLabelKey(sort: CoachSort): string {
    return `enums.sort.${sort}`;
  }

  /** Writes filters to the URL; the results derive from it. */
  private navigate(filters: CoachSearchFilters): void {
    void this.router.navigate(['/coaches'], { queryParams: filtersToQuery(filters) });
  }
}
