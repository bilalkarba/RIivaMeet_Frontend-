import { HttpClient, type HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../api/api.service';
import type {
  CoachVerification,
  VerificationDocumentType,
  VerificationStatusSummary,
  VerificationUploadTarget,
} from '../models/domain.model';

/**
 * Coach verification (COACH role).
 *
 * The document bytes never travel through the JSON API: the backend issues a short-lived
 * presigned target and the browser uploads straight to private object storage, then
 * confirms the document. Nothing here can change the official status — only an
 * administrator can approve or reject an application.
 */
@Injectable({ providedIn: 'root' })
export class VerificationService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  /** `GET /coaches/me/verification` — always answers; `NOT_SUBMITTED` before the first upload. */
  getMine(): Observable<CoachVerification> {
    return this.api.getData<CoachVerification>('/coaches/me/verification');
  }

  /** `GET /coaches/me/verification/status` — whether the coach is publicly visible yet. */
  getMyStatus(): Observable<VerificationStatusSummary> {
    return this.api.getData<VerificationStatusSummary>('/coaches/me/verification/status');
  }

  /** Step 1: request a private upload target (the storage key is server-generated). */
  startUpload(payload: {
    type: VerificationDocumentType;
    contentType: string;
    fileName?: string;
  }): Observable<VerificationUploadTarget> {
    return this.api.postData<VerificationUploadTarget>('/coaches/me/verification/documents', payload);
  }

  /** Step 2: push the bytes to the presigned URL. Progress events drive the upload bar. */
  uploadBytes(
    target: VerificationUploadTarget,
    file: File,
  ): Observable<HttpEvent<unknown>> {
    return this.http.request(target.upload.method, target.upload.uploadUrl, {
      body: file,
      headers: target.upload.headers,
      reportProgress: true,
      observe: 'events',
    });
  }

  /** Step 3: the backend verifies the object exists, its size and its real file type. */
  confirmUpload(documentId: string): Observable<CoachVerification> {
    return this.api.postData<CoachVerification>(
      `/coaches/me/verification/documents/${documentId}/confirm`,
      {},
    );
  }

  removeDocument(documentId: string): Observable<CoachVerification> {
    return this.api.deleteData<CoachVerification>(`/coaches/me/verification/documents/${documentId}`);
  }

  submit(): Observable<CoachVerification> {
    return this.api.postData<CoachVerification>('/coaches/me/verification/submit', {});
  }
}
