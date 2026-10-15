import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api/api.service';
import type { BookingNotificationInbox } from '../models/domain.model';

@Injectable({ providedIn: 'root' })
export class BookingNotificationsService {
  private readonly api = inject(ApiService);

  listMine(): Observable<BookingNotificationInbox> {
    return this.api.getData<BookingNotificationInbox>('/notifications/mine');
  }

  markAllRead(): Observable<{ updatedCount: number }> {
    return this.api.patchData<{ updatedCount: number }>('/notifications/mine/read');
  }
}
