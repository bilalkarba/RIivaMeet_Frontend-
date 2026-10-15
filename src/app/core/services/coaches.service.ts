import { Injectable, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';

import { ApiError } from '../api/api-error';
import { ApiService, type QueryParams } from '../api/api.service';
import type { Paginated } from '../models/api.model';
import type {
  AvailabilityPayload,
  AvailabilitySlot,
  CoachDetail,
  CoachSearchFilters,
  CoachSummary,
  CreateCoachProfilePayload,
  SportSummary,
  UpdateCoachProfilePayload,
} from '../models/domain.model';
import { OfflinePreviewService } from '../offline/offline-preview.service';

/** Removes `undefined`/`''` entries so optional filters can be passed as-is. */
function toQuery(filters: CoachSearchFilters): QueryParams {
  return { ...filters };
}

@Injectable({ providedIn: 'root' })
export class CoachesService {
  private readonly api = inject(ApiService);
  private readonly offline = inject(OfflinePreviewService);

  // --- Public --------------------------------------------------------------

  /**
   * `GET /coaches` — published profiles only.
   * Distance filtering/sorting requires `latitude` + `longitude`; the backend rejects
   * those filters without them, so the search UI never sends a partial pair.
   */
  search(filters: CoachSearchFilters): Observable<Paginated<CoachSummary>> {
    return this.api
      .getPage<CoachSummary>('/coaches', toQuery(filters))
      .pipe(catchError((error) => this.offline.use(error, (catalog) => catalog.searchCoaches(filters))));
  }

  /** `GET /coaches/:id` — unpublished or unknown profiles answer 404. */
  getById(coachProfileId: string): Observable<CoachDetail> {
    return this.api.getData<CoachDetail>(`/coaches/${coachProfileId}`).pipe(
      catchError((error) =>
        this.offline.use(error, (catalog) => {
          const coach = catalog.getCoach(coachProfileId);
          if (!coach) {
            throw new ApiError({
              status: 404,
              code: 'NOT_FOUND',
              message: 'Coach profile not found',
            });
          }
          return coach;
        }),
      ),
    );
  }

  // --- Coach studio (COACH role, authenticated) ----------------------------

  /** `GET /coaches/me/profile` — 404 means the coach has not created a profile yet. */
  getMyProfile(): Observable<CoachDetail> {
    return this.api.getData<CoachDetail>('/coaches/me/profile');
  }

  createMyProfile(payload: CreateCoachProfilePayload): Observable<CoachDetail> {
    return this.api.postData<CoachDetail>('/coaches/me/profile', payload);
  }

  updateMyProfile(payload: UpdateCoachProfilePayload): Observable<CoachDetail> {
    return this.api.patchData<CoachDetail>('/coaches/me/profile', payload);
  }

  listMySports(): Observable<SportSummary[]> {
    return this.api.getData<SportSummary[]>('/coaches/me/sports');
  }

  /** `PUT /coaches/me/sports` replaces the whole set (idempotent). */
  replaceMySports(sportIds: string[]): Observable<SportSummary[]> {
    return this.api.putData<SportSummary[]>('/coaches/me/sports', { sportIds });
  }

  listMyAvailability(): Observable<AvailabilitySlot[]> {
    return this.api.getData<AvailabilitySlot[]>('/coaches/me/availability');
  }

  createMyAvailability(payload: AvailabilityPayload): Observable<AvailabilitySlot[]> {
    return this.api.postData<AvailabilitySlot[]>('/coaches/me/availability', payload);
  }

  deleteMyAvailability(availabilityId: string): Observable<AvailabilitySlot[]> {
    return this.api.deleteData<AvailabilitySlot[]>(`/coaches/me/availability/${availabilityId}`);
  }
}
