import type { ParamMap } from '@angular/router';

import { COACH_SORTS, DISTANCE_SORTS, type CoachSearchFilters, type CoachSort } from '../models/domain.model';
import type { SearchSubmission } from '../../shared/search-form/search-form.component';

export type CoachQueryParams = Record<string, string | number>;

function numberOrUndefined(value: string | null): number | undefined {
  if (value === null || value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringOrUndefined(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Reads search filters from the URL.
 *
 * Filters live in the query string so a result page is shareable and bookmarkable, and
 * the back button restores the previous search. Distance parameters are only accepted
 * as a pair, mirroring the API's own rule.
 */
export function filtersFromQuery(params: ParamMap): CoachSearchFilters {
  const latitude = numberOrUndefined(params.get('latitude'));
  const longitude = numberOrUndefined(params.get('longitude'));
  const hasLocation = latitude !== undefined && longitude !== undefined;

  const sortParam = params.get('sort');
  const sort = (COACH_SORTS as readonly string[]).includes(sortParam ?? '')
    ? (sortParam as CoachSort)
    : undefined;

  const page = numberOrUndefined(params.get('page'));
  const limit = numberOrUndefined(params.get('limit'));

  return {
    sport: stringOrUndefined(params.get('sport')),
    city: stringOrUndefined(params.get('city')),
    neighborhood: stringOrUndefined(params.get('neighborhood')),
    minPrice: numberOrUndefined(params.get('minPrice')),
    maxPrice: numberOrUndefined(params.get('maxPrice')),
    minRating: numberOrUndefined(params.get('minRating')),
    latitude: hasLocation ? latitude : undefined,
    longitude: hasLocation ? longitude : undefined,
    radiusKm: hasLocation ? numberOrUndefined(params.get('radiusKm')) : undefined,
    // A distance sort without coordinates would be rejected by the API.
    sort: sort && DISTANCE_SORTS.includes(sort) && !hasLocation ? undefined : sort,
    page: page && page >= 1 ? page : undefined,
    limit: limit && limit >= 1 && limit <= 100 ? limit : undefined,
  };
}

/** Serialises filters back into query parameters, dropping anything unset. */
export function filtersToQuery(filters: CoachSearchFilters): CoachQueryParams {
  const entries: [string, string | number | undefined][] = [
    ['sport', filters.sport],
    ['city', filters.city],
    ['neighborhood', filters.neighborhood],
    ['minPrice', filters.minPrice],
    ['maxPrice', filters.maxPrice],
    ['minRating', filters.minRating],
    ['latitude', filters.latitude],
    ['longitude', filters.longitude],
    ['radiusKm', filters.radiusKm],
    ['sort', filters.sort],
    ['page', filters.page && filters.page > 1 ? filters.page : undefined],
    ['limit', filters.limit],
  ];

  const params: CoachQueryParams = {};
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value;
    }
  }
  return params;
}

/** Converts what the search form emitted into query parameters. */
export function submissionToQuery(submission: SearchSubmission): CoachQueryParams {
  const trimmed: CoachSearchFilters = {
    sport: submission.sport,
    city: submission.city,
    neighborhood: submission.neighborhood,
    latitude: submission.latitude,
    longitude: submission.longitude,
    radiusKm: submission.radiusKm,
  };
  return filtersToQuery(trimmed);
}

/** Restores the search form from the URL. */
export function queryToSubmission(filters: CoachSearchFilters): SearchSubmission {
  return {
    sport: filters.sport,
    city: filters.city,
    neighborhood: filters.neighborhood,
    latitude: filters.latitude,
    longitude: filters.longitude,
    radiusKm: filters.radiusKm,
  };
}
