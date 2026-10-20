import { HttpEventType } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  ALLOWED_VERIFICATION_CONTENT_TYPES,
  VERIFICATION_DOCUMENT_TYPES,
  type CoachVerification,
  type VerificationDocument,
  type VerificationDocumentType,
  type VerificationStatusView,
  type VerificationUploadTarget,
} from '../../core/models/domain.model';
import { VerificationService } from '../../core/services/verification.service';
import { NotificationService } from '../../core/ui/notification.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { StatePanelComponent } from '../../shared/state-panel/state-panel.component';

/**
 * Coach verification panel.
 *
 * Coaches can upload, replace, remove and submit their documents. The official status is
 * only ever changed by an administrator.
 */
@Component({
  selector: 'app-coach-verification-panel',
  imports: [TranslatePipe, IconComponent, StatePanelComponent],
  styles: `
    :host {
      display: block;
    }

    /* The studio layout classes live in the coach-dashboard component styles; this panel
       is its own component, so it declares the few it relies on. */
    .studio__panel {
      display: block;
    }

    .studio__panel-title {
      font-size: 1.05rem;
      font-weight: 700;
    }

    .studio__panel-sub {
      font-size: 0.88rem;
    }

    .verif__status {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .verif__pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.3rem 0.7rem;
      border-radius: 999px;
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      background: var(--forest-50, #eef5ef);
      color: var(--ink-700);
      border: 1px solid var(--line);
    }

    .verif__pill[data-state='APPROVED'] {
      background: var(--lime-100, #e8f7c8);
      border-color: var(--lime-300, #c3e07a);
      color: var(--ink-900);
    }

    .verif__pill[data-state='REJECTED'] {
      background: var(--rose-50, #fdecec);
      border-color: rgba(192, 69, 63, 0.3);
      color: var(--rose-500, #8f322d);
    }

    .verif__pill[data-state='NEEDS_INFO'] {
      background: var(--amber-50, #fdf6e3);
      border-color: rgba(180, 140, 40, 0.35);
    }

    .verif__docs {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.6rem;
    }

    .verif__doc {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.7rem 0.85rem;
      border: 1px solid var(--line);
      border-radius: var(--r-md, 0.7rem);
      background: #fff;
      flex-wrap: wrap;
    }

    .verif__doc-main {
      display: grid;
      gap: 0.15rem;
      min-width: 0;
    }

    .verif__doc-name {
      font-weight: 650;
      font-size: 0.9rem;
      overflow-wrap: anywhere;
    }

    .verif__doc-meta {
      font-size: 0.76rem;
      color: var(--ink-500);
    }

    .verif__history {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.45rem;
    }

    .verif__history-item {
      display: flex;
      gap: 0.6rem;
      align-items: baseline;
      justify-content: space-between;
      font-size: 0.8rem;
      border-left: 2px solid var(--line-strong);
      padding-left: 0.6rem;
    }

    .verif__progress {
      height: 0.5rem;
      border-radius: 999px;
      background: var(--forest-100, #e6efe7);
      overflow: hidden;
    }

    .verif__progress-bar {
      height: 100%;
      background: var(--forest-600, #2f6b45);
      transition: width 160ms linear;
    }
  `,
  template: `
    <div class="studio__panel" role="tabpanel" id="panel-verification" aria-labelledby="tab-verification">
      @if (loading()) {
        <app-state-panel kind="loading" titleKey="common.loading" />
      } @else if (error(); as failure) {
        <app-state-panel
          kind="error"
          titleKey="errors.title"
          [messageKey]="failure.isNetworkError ? 'errors.network' : failure.messageKey"
          [detail]="failure.message"
          actionKey="common.retry"
          (action)="load()"
        />
      } @else if (verification(); as application) {
        <div class="stack stack-5">
          <!-- Status ------------------------------------------------------- -->
          <section class="card card--pad stack stack-3">
            <div class="verif__status">
              <span class="verif__pill" [attr.data-state]="application.status">
                <app-icon [name]="statusIcon(application.status)" [size]="14" />
                {{ 'verification.status.' + application.status | t }}
              </span>
            </div>

            <p class="muted">{{ 'verification.statusHelp.' + application.status | t }}</p>

            @if (application.adminFeedback.note) {
              <div class="alert alert--warning" role="status">
                <strong>{{ 'verification.feedback.title' | t }}</strong>
                <p>{{ application.adminFeedback.note }}</p>
                @if (application.adminFeedback.decidedAt) {
                  <p class="field-hint">
                    {{ locale.formatDateTime(application.adminFeedback.decidedAt) }}
                  </p>
                }
              </div>
            }

            @if (application.missingRequirements.length > 0) {
              <div class="stack stack-2">
                <strong>{{ 'verification.required.title' | t }}</strong>
                <ul>
                  @for (requirement of application.missingRequirements; track requirement) {
                    <li class="muted">{{ requirement }}</li>
                  }
                </ul>
                <p class="field-hint">
                  {{ 'verification.required.types' | t: { types: application.requiredDocumentTypes.join(' / ') } }}
                </p>
              </div>
            }
          </section>

          <!-- Upload ------------------------------------------------------- -->
          @if (application.canEditDocuments) {
            <section class="card card--pad stack stack-3">
              <div class="stack stack-1">
                <h2 class="studio__panel-title">{{ 'verification.upload.title' | t }}</h2>
                <p class="muted studio__panel-sub">{{ 'verification.upload.subtitle' | t }}</p>
              </div>

              <div class="grid grid--2">
                <div class="field">
                  <label class="label" for="verif-type">{{ 'verification.upload.type' | t }}</label>
                  <select
                    id="verif-type"
                    class="select"
                    [value]="uploadType()"
                    (change)="uploadType.set($any($event.target).value)"
                  >
                    @for (type of documentTypes; track type) {
                      <option [value]="type">{{ 'verification.type.' + type | t }}</option>
                    }
                  </select>
                </div>

                <div class="field">
                  <label class="label" for="verif-file">{{ 'verification.upload.file' | t }}</label>
                  <input
                    id="verif-file"
                    class="input"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    [attr.aria-describedby]="'verif-file-hint'"
                    (change)="onFileSelected($event)"
                  />
                  <p class="field-hint" id="verif-file-hint">{{ 'verification.upload.hint' | t }}</p>
                </div>
              </div>

              @if (selectedFile(); as file) {
                <p class="muted">
                  {{ 'verification.upload.selected' | t: { name: file.name, size: fileSize(file.size) } }}
                </p>
              }

              @if (uploading()) {
                <div class="stack stack-1">
                  <div
                    class="verif__progress"
                    role="progressbar"
                    [attr.aria-valuenow]="progress()"
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    <div class="verif__progress-bar" [style.width.%]="progress()"></div>
                  </div>
                  <p class="field-hint">{{ 'verification.upload.progress' | t: { percent: progress() } }}</p>
                </div>
              }

              <button
                type="button"
                class="btn btn--primary"
                [disabled]="uploading() || selectedFile() === null"
                (click)="upload()"
              >
                <app-icon name="plus" [size]="16" />
                {{ (uploading() ? 'verification.upload.uploading' : 'verification.upload.action') | t }}
              </button>
            </section>
          }

          <!-- Documents ---------------------------------------------------- -->
          <section class="card card--pad stack stack-3">
            <h2 class="studio__panel-title">{{ 'verification.documents.title' | t }}</h2>

            @if (application.documents.length === 0) {
              <app-state-panel kind="empty" titleKey="verification.documents.empty" />
            } @else {
              <ul class="verif__docs">
                @for (document of application.documents; track document.id) {
                  <li class="verif__doc">
                    <span class="verif__doc-main">
                      <span class="verif__doc-name">
                        {{ 'verification.type.' + document.type | t }} · {{ document.fileName ?? document.contentType }}
                      </span>
                      <span class="verif__doc-meta">
                        {{ document.contentType }} · {{ fileSize(document.sizeBytes ?? 0) }} ·
                        {{ locale.formatDate(document.uploadedAt) }}
                      </span>
                    </span>

                    @if (application.canEditDocuments) {
                      <button
                        type="button"
                        class="btn btn--ghost btn--sm"
                        [disabled]="busyDocumentId() === document.id"
                        (click)="remove(document)"
                      >
                        <app-icon name="trash" [size]="15" />
                        {{ 'common.remove' | t }}
                      </button>
                    }
                  </li>
                }
              </ul>
            }

            @if (application.canSubmit) {
              <div class="stack stack-2">
                <button type="button" class="btn btn--dark" [disabled]="submitting()" (click)="submit()">
                  <app-icon name="shield" [size]="16" />
                  {{ (submitting() ? 'verification.submit.submitting' : 'verification.submit.action') | t }}
                </button>
                <p class="field-hint">{{ 'verification.submit.confirm' | t }}</p>
              </div>
            }
          </section>

          <!-- History ----------------------------------------------------- -->
          @if (application.history.length > 0) {
            <section class="card card--pad stack stack-3">
              <h2 class="studio__panel-title">{{ 'verification.history.title' | t }}</h2>
              <ul class="verif__history">
                @for (entry of application.history; track entry.createdAt + entry.type) {
                  <li class="verif__history-item">
                    <span>{{ 'verification.events.' + entry.type | t }}</span>
                    <span class="muted">{{ locale.formatDateTime(entry.createdAt) }}</span>
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      }
    </div>
  `,
})
export class CoachVerificationPanelComponent {
  protected readonly locale = inject(LocaleService);
  private readonly verificationService = inject(VerificationService);
  private readonly notifications = inject(NotificationService);

  protected readonly documentTypes = VERIFICATION_DOCUMENT_TYPES;

  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly verification = signal<CoachVerification | null>(null);

  protected readonly uploadType = signal<VerificationDocumentType>('DIPLOMA');
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly uploading = signal(false);
  protected readonly progress = signal(0);
  protected readonly submitting = signal(false);
  protected readonly busyDocumentId = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.verificationService
      .getMine()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (verification) => this.verification.set(verification),
        error: (error: unknown) => this.error.set(ApiError.fromHttpError(error)),
      });
  }

  protected statusIcon(status: VerificationStatusView): string {
    switch (status) {
      case 'APPROVED':
        return 'shield';
      case 'REJECTED':
        return 'alert';
      case 'NEEDS_INFO':
        return 'info';
      case 'PENDING':
      case 'IN_REVIEW':
        return 'clock';
      default:
        return 'plus';
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
    input.value = '';
  }

  protected fileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '—';
    }
    const mb = bytes / (1024 * 1024);
    return mb >= 1
      ? `${this.locale.formatNumber(mb, { maximumFractionDigits: 1 })} MB`
      : `${this.locale.formatNumber(Math.round(bytes / 1024))} KB`;
  }

  protected upload(): void {
    const file = this.selectedFile();
    if (!file) {
      return;
    }

    if (!(ALLOWED_VERIFICATION_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      this.notifications.error('verification.upload.unsupported');
      return;
    }

    this.uploading.set(true);
    this.progress.set(0);

    this.verificationService
      .startUpload({ type: this.uploadType(), contentType: file.type, fileName: file.name })
      .subscribe({
        next: (target) => this.pushBytes(target.documentId, file, target),
        error: (error: unknown) => {
          this.uploading.set(false);
          this.notifications.apiError(ApiError.fromHttpError(error));
        },
      });
  }

  private pushBytes(documentId: string, file: File, target: VerificationUploadTarget): void {
    // The bytes go straight to storage; the API only ever sees the confirm call.
    this.verificationService.uploadBytes(target, file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress.set(Math.round((event.loaded / event.total) * 100));
        }
      },
      error: (error: unknown) => {
        this.uploading.set(false);
        this.notifications.apiError(ApiError.fromHttpError(error));
      },
      complete: () => {
        this.verificationService
          .confirmUpload(documentId)
          .pipe(finalize(() => this.uploading.set(false)))
          .subscribe({
            next: (verification) => {
              this.verification.set(verification);
              this.selectedFile.set(null);
              this.notifications.success('verification.upload.done');
            },
            error: (error: unknown) => {
              this.notifications.apiError(ApiError.fromHttpError(error));
              this.load();
            },
          });
      },
    });
  }

  protected remove(document: VerificationDocument): void {
    this.busyDocumentId.set(document.id);
    this.verificationService
      .removeDocument(document.id)
      .pipe(finalize(() => this.busyDocumentId.set(null)))
      .subscribe({
        next: (verification) => {
          this.verification.set(verification);
          this.notifications.success('verification.documents.removed');
        },
        error: (error: unknown) => this.notifications.apiError(ApiError.fromHttpError(error)),
      });
  }

  protected submit(): void {
    this.submitting.set(true);
    this.verificationService
      .submit()
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (verification) => {
          this.verification.set(verification);
          this.notifications.success('verification.submit.done');
        },
        error: (error: unknown) => this.notifications.apiError(ApiError.fromHttpError(error)),
      });
  }
}
