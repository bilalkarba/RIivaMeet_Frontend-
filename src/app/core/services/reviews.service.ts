import { Injectable, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';

import { ApiService } from '../api/api.service';
import type { Paginated } from '../models/api.model';
import type { CreateReviewPayload, RatingSummary, Review } from '../models/domain.model';
import { OfflinePreviewService } from '../offline/offline-preview.service';

/** The review list carries the rating summary in `meta`, so no second request is needed. */
export type CoachReviewsPage = Paginated<Review, { summary: RatingSummary }>;

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly api = inject(ApiService);
  private readonly offline = inject(OfflinePreviewService);

  /** `GET /coaches/:id/reviews` — public. */
  forCoach(coachProfileId: string, page = 1, limit = 5): Observable<CoachReviewsPage> {
    return this.api.getPage<Review, { summary: RatingSummary }>(`/coaches/${coachProfileId}/reviews`, {
      page,
      limit,
    }).pipe(
      catchError((error) =>
        this.offline.use(error, (catalog) => {
          const page_ = catalog.listReviews(coachProfileId, page, limit);
          if (!page_) {
            throw error;
          }
          return page_;
        }),
      ),
    );
  }

  /** `POST /bookings/:id/review` — CLIENT owner, one review per completed booking. */
  create(bookingId: string, payload: CreateReviewPayload): Observable<Review> {
    return this.api.postData<Review>(`/bookings/${bookingId}/review`, payload);
  }
}
