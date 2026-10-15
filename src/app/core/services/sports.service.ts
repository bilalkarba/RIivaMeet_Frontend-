import { Injectable, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';

import { ApiService } from '../api/api.service';
import type { Sport } from '../models/domain.model';
import { OfflinePreviewService } from '../offline/offline-preview.service';

/** `GET /sports` — the public catalogue, seeded with Fitness, Boxing, Swimming, Football, Tennis. */
@Injectable({ providedIn: 'root' })
export class SportsService {
  private readonly api = inject(ApiService);
  private readonly offline = inject(OfflinePreviewService);

  list(): Observable<Sport[]> {
    return this.api
      .getData<Sport[]>('/sports')
      .pipe(catchError((error) => this.offline.use(error, (catalog) => catalog.sports())));
  }
}
