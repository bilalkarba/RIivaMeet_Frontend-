import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService, type QueryParams } from '../api/api.service';
import type { Paginated } from '../models/api.model';
import type { Booking, BookingStatus, CreateBookingPayload } from '../models/domain.model';

export interface BookingListFilters {
  status?: BookingStatus;
  page?: number;
  limit?: number;
}

/**
 * Booking endpoints.
 *
 * No offline fallback here on purpose: creating or changing a booking must reach the
 * real API or fail loudly. The backend owns the whole state machine
 * (PENDING → ACCEPTED/REJECTED, PENDING|ACCEPTED → CANCELLED, ACCEPTED → COMPLETED)
 * and every transition re-checks the caller's role and ownership.
 */
@Injectable({ providedIn: 'root' })
export class BookingsService {
  private readonly api = inject(ApiService);

  /** `POST /bookings` — CLIENT only; requires a published coach and a fitting window. */
  create(payload: CreateBookingPayload): Observable<Booking> {
    return this.api.postData<Booking>('/bookings', payload);
  }

  /**
   * `GET /bookings/mine` — the backend scopes it by role:
   * clients see their own requests, coaches see requests on their profile.
   */
  listMine(filters: BookingListFilters = {}): Observable<Paginated<Booking>> {
    const params: QueryParams = { status: filters.status, page: filters.page, limit: filters.limit };
    return this.api.getPage<Booking>('/bookings/mine', params);
  }

  getById(bookingId: string): Observable<Booking> {
    return this.api.getData<Booking>(`/bookings/${bookingId}`);
  }

  /** PENDING → ACCEPTED (owning coach). */
  accept(bookingId: string): Observable<Booking> {
    return this.api.patchData<Booking>(`/bookings/${bookingId}/accept`);
  }

  /** PENDING → REJECTED (owning coach, terminal). */
  reject(bookingId: string): Observable<Booking> {
    return this.api.patchData<Booking>(`/bookings/${bookingId}/reject`);
  }

  /** PENDING|ACCEPTED → CANCELLED (client owner, owning coach or admin). */
  cancel(bookingId: string): Observable<Booking> {
    return this.api.patchData<Booking>(`/bookings/${bookingId}/cancel`);
  }

  /** ACCEPTED → COMPLETED (owning coach); the only status that can be reviewed. */
  complete(bookingId: string): Observable<Booking> {
    return this.api.patchData<Booking>(`/bookings/${bookingId}/complete`);
  }
}
