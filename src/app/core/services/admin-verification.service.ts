import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService, type QueryParams } from '../api/api.service';
import type { Paginated } from '../models/api.model';
import type {
  AdminVerification,
  AdminVerificationDetail,
  AdminVerificationFilters,
} from '../models/domain.model';

/**
 * Coach verification back-office (ADMIN only).
 *
 * The API re-checks the ADMIN role on every request; this service is only a thin typed
 * wrapper. Private documents are fetched as a Blob with the bearer token, so a document
 * preview never needs a public URL (there is none).
 */
@Injectable({ providedIn: 'root' })
export class AdminVerificationService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  /** `GET /admin/verifications` — paginated queue with filters. */
  list(filters: AdminVerificationFilters): Observable<Paginated<AdminVerification>> {
    return this.api.getPage<AdminVerification>('/admin/verifications', toQuery(filters));
  }

  /** Published coaches without an approval (the deliberate rollout queue). */
  listUnverified(filters: { city?: string; search?: string; page?: number; limit?: number }): Observable<
    Paginated<AdminVerification>
  > {
    return this.api.getPage<AdminVerification>('/admin/verifications/unverified-coaches', {
      ...filters,
    });
  }

  get(id: string): Observable<AdminVerificationDetail> {
    return this.api.getData<AdminVerificationDetail>(`/admin/verifications/${id}`);
  }

  markInReview(id: string): Observable<AdminVerificationDetail> {
    return this.api.patchData<AdminVerificationDetail>(`/admin/verifications/${id}/in-review`, {});
  }

  approve(id: string, note?: string): Observable<AdminVerificationDetail> {
    return this.api.patchData<AdminVerificationDetail>(`/admin/verifications/${id}/approve`, {
      ...(note ? { note } : {}),
    });
  }

  reject(id: string, note: string): Observable<AdminVerificationDetail> {
    return this.api.patchData<AdminVerificationDetail>(`/admin/verifications/${id}/reject`, { note });
  }

  requestInfo(id: string, note: string): Observable<AdminVerificationDetail> {
    return this.api.patchData<AdminVerificationDetail>(`/admin/verifications/${id}/request-info`, { note });
  }

  /** Explicit, auditable approval for a coach that predates verification. */
  grandfather(coachProfileId: string, note: string): Observable<AdminVerificationDetail> {
    return this.api.postData<AdminVerificationDetail>('/admin/verifications/grandfather', {
      coachProfileId,
      note,
    });
  }

  /** Fetches a private document with the bearer token; the caller revokes the object URL. */
  documentBlob(documentId: string): Observable<Blob> {
    return this.http.get(this.api.url(`/admin/verifications/documents/${documentId}/file`), {
      responseType: 'blob',
    });
  }
}

function toQuery(filters: AdminVerificationFilters): QueryParams {
  return {
    status: filters.status ?? '',
    submittedFrom: filters.submittedFrom ?? '',
    submittedTo: filters.submittedTo ?? '',
    page: filters.page,
    limit: filters.limit,
  };
}
