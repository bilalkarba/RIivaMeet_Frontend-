import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { PaginationMeta } from '../../core/models/api.model';
import {
  VERIFICATION_STATUSES,
  type AdminVerification,
  type AdminVerificationDetail,
  type VerificationStatus,
} from '../../core/models/domain.model';
import { AdminVerificationService } from '../../core/services/admin-verification.service';
import { NotificationService } from '../../core/ui/notification.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { StatePanelComponent } from '../../shared/state-panel/state-panel.component';

type QueueView = 'applications' | 'unverified';
type DecisionKind = 'approve' | 'reject' | 'request-info' | 'grandfather';

const PAGE_SIZE = 20;

/**
 * Administrator verification queue.
 *
 * Two views: the review queue (coach-submitted applications) and the coaches that are
 * published but not verified, which is where coaches that predate verification appear.
 * Both require an explicit, note-backed decision, and a private document is only ever
 * opened through an authenticated, `no-store` API stream.
 */
@Component({
  selector: 'app-admin-verifications-page',
  imports: [TranslatePipe, IconComponent, StatePanelComponent],
  styles: `
    :host {
      display: block;
    }

    .studio__panel-title {
      font-size: 1.05rem;
      font-weight: 700;
    }

    .admin__layout {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.35fr);
      gap: 1.25rem;
      align-items: start;
    }

    @media (max-width: 900px) {
      .admin__layout {
        grid-template-columns: 1fr;
      }
    }

    .admin__tabs {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .admin__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.55rem;
      max-height: 34rem;
      overflow-y: auto;
    }

    .admin__item {
      width: 100%;
      text-align: start;
      border: 1px solid var(--line);
      border-radius: var(--r-md, 0.7rem);
      background: #fff;
      padding: 0.7rem 0.85rem;
      display: grid;
      gap: 0.3rem;
      cursor: pointer;
    }

    .admin__item.is-active {
      border-color: var(--forest-600, #2f6b45);
      box-shadow: 0 0 0 2px rgba(47, 107, 69, 0.16);
    }

    .admin__item-top {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .admin__item-name {
      font-weight: 650;
      font-size: 0.9rem;
      overflow-wrap: anywhere;
    }

    .admin__meta {
      font-size: 0.76rem;
      color: var(--ink-500);
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .admin__status {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--forest-50, #eef5ef);
    }

    .admin__status[data-state='APPROVED'] {
      background: var(--lime-100, #e8f7c8);
    }

    .admin__status[data-state='REJECTED'] {
      background: var(--rose-50, #fdecec);
    }

    .admin__status[data-state='NEEDS_INFO'] {
      background: var(--amber-50, #fdf6e3);
    }

    .admin__flags {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .admin__actions {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
    }

    .admin__history {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.4rem;
    }

    .admin__history li {
      font-size: 0.79rem;
      display: flex;
      justify-content: space-between;
      gap: 0.6rem;
      border-left: 2px solid var(--line-strong);
      padding-left: 0.55rem;
      flex-wrap: wrap;
    }

    .admin__pager {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
      justify-content: space-between;
    }
  `,
  template: `
    <section class="section section--tight">
      <div class="shell shell--wide stack stack-5">
        <header class="stack stack-2">
          <h1 class="display-2">{{ 'adminVerify.title' | t }}</h1>
          <p class="lead">{{ 'adminVerify.subtitle' | t }}</p>
        </header>

        <div class="admin__tabs" role="tablist" [attr.aria-label]="'adminVerify.title' | t">
          @for (view of views; track view) {
            <button
              type="button"
              role="tab"
              class="btn btn--sm"
              [class.btn--dark]="activeView() === view"
              [class.btn--outline]="activeView() !== view"
              [attr.aria-selected]="activeView() === view"
              (click)="setView(view)"
            >
              {{ 'adminVerify.views.' + view | t }}
            </button>
          }
        </div>

        <!-- Filters ------------------------------------------------------- -->
        <div class="card card--pad">
          <div class="grid grid--3">
            <div class="field">
              <label class="label" for="admin-status">{{ 'adminVerify.filters.status' | t }}</label>
              <select
                id="admin-status"
                class="select"
                [value]="statusFilter()"
                (change)="setStatusFilter($any($event.target).value)"
              >
                <option value="">{{ 'common.all' | t }}</option>
                @for (status of statuses; track status) {
                  <option [value]="status">{{ 'verification.status.' + status | t }}</option>
                }
              </select>
            </div>

            <div class="field">
              <label class="label" for="admin-search">{{ 'adminVerify.filters.search' | t }}</label>
              <input
                id="admin-search"
                class="input"
                type="search"
                [value]="searchTerm()"
                (input)="searchTerm.set($any($event.target).value)"
                (keyup.enter)="applyFilters()"
              />
            </div>
          </div>

          <div class="admin__actions" style="margin-top: 0.75rem">
            <button type="button" class="btn btn--primary btn--sm" (click)="applyFilters()">
              {{ 'common.apply' | t }}
            </button>
            <button type="button" class="btn btn--ghost btn--sm" (click)="resetFilters()">
              {{ 'common.clearAll' | t }}
            </button>
          </div>
        </div>

        <div class="admin__layout">
          <!-- Queue ------------------------------------------------------ -->
          <div class="card card--pad stack stack-3">
            @if (loading()) {
              <app-state-panel kind="loading" titleKey="common.loading" />
            } @else if (error(); as failure) {
              <app-state-panel
                kind="error"
                titleKey="errors.title"
                [messageKey]="failure.isNetworkError ? 'errors.network' : failure.messageKey"
                [detail]="failure.message"
                actionKey="common.retry"
                (action)="reload()"
              />
            } @else if (items().length === 0) {
              <app-state-panel kind="empty" [titleKey]="emptyKey()" />
            } @else {
              <ul class="admin__list">
                @for (item of items(); track item.id ?? item.coachProfileId) {
                  <li>
                    <button
                      type="button"
                      class="admin__item"
                      [class.is-active]="item.id !== null && item.id === selectedId()"
                      (click)="select(item)"
                    >
                      <span class="admin__item-top">
                        <span class="admin__item-name">{{ item.coach?.displayName ?? item.coachProfileId }}</span>
                        <span class="admin__status" [attr.data-state]="item.status">
                          {{ 'verification.status.' + item.status | t }}
                        </span>
                      </span>

                      <span class="admin__meta">
                        @if (item.submittedAt) {
                          <span>{{ 'adminVerify.submitted' | t }}: {{ locale.formatDate(item.submittedAt) }}</span>
                        } @else {
                          <span>{{ 'adminVerify.notSubmitted' | t }}</span>
                        }
                        <span>{{ 'adminVerify.documents' | t: { count: item.documentCount } }}</span>
                        @if (!item.isPublished) {
                          <span>· {{ 'adminVerify.unpublished' | t }}</span>
                        }
                      </span>
                    </button>
                  </li>
                }
              </ul>

              <div class="admin__pager">
                <span class="muted">
                  {{ 'common.page' | t }} {{ meta().page }} {{ 'common.of' | t }} {{ meta().totalPages || 1 }}
                </span>
                <span class="admin__actions">
                  <button
                    type="button"
                    class="btn btn--outline btn--sm"
                    [disabled]="!meta().hasPreviousPage"
                    (click)="goToPage(meta().page - 1)"
                  >
                    {{ 'common.previous' | t }}
                  </button>
                  <button
                    type="button"
                    class="btn btn--outline btn--sm"
                    [disabled]="!meta().hasNextPage"
                    (click)="goToPage(meta().page + 1)"
                  >
                    {{ 'common.next' | t }}
                  </button>
                </span>
              </div>
            }
          </div>

          <!-- Detail ----------------------------------------------------- -->
          <div class="card card--pad stack stack-4">
            @if (activeView() === 'unverified' && !detail() && pending() === null) {
              <app-state-panel kind="info" titleKey="adminVerify.pickCoach" messageKey="adminVerify.grandfatherHint" />
            } @else if (loadingDetail()) {
              <app-state-panel kind="loading" titleKey="common.loading" />
            } @else if (detailError(); as failure) {
              <app-state-panel
                kind="error"
                titleKey="errors.title"
                [messageKey]="failure.messageKey"
                [detail]="failure.message"
              />
            } @else if (detail(); as application) {
              <div class="stack stack-3">
                <div class="stack stack-1">
                  <h2 class="studio__panel-title">{{ application.coach?.displayName ?? application.coachProfileId }}</h2>
                  <p class="muted">
                    {{ application.coach?.email ?? '—' }} ·
                    {{ (application.isPublished ? 'common.published' : 'common.unpublished') | t }}
                  </p>
                </div>

                <span class="admin__status" [attr.data-state]="application.status">
                  {{ 'verification.status.' + application.status | t }}
                </span>

                @if (application.reviewNote) {
                  <div class="alert alert--info">
                    <strong>{{ 'adminVerify.reviewNote' | t }}</strong>
                    <p>{{ application.reviewNote }}</p>
                  </div>
                }

                <!-- Documents ------------------------------------------------- -->
                <section class="stack stack-2">
                  <h3 class="studio__panel-title">{{ 'verification.documents.title' | t }}</h3>
                  @if (application.documents.length === 0) {
                    <p class="muted">{{ 'verification.documents.empty' | t }}</p>
                  } @else {
                    <ul class="admin__flags" style="flex-direction: column; align-items: stretch">
                      @for (document of application.documents; track document.id) {
                        <li class="admin__meta">
                          <span>{{ 'verification.type.' + document.type | t }} · {{ document.fileName ?? document.contentType }}</span>
                          <button
                            type="button"
                            class="btn btn--outline btn--sm"
                            (click)="openDocument(document.id)"
                          >
                            <app-icon name="eye" [size]="14" />
                            {{ 'adminVerify.openDocument' | t }}
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </section>

                <!-- Decisions ------------------------------------------------- -->
                <section class="stack stack-2">
                  <h3 class="studio__panel-title">{{ 'adminVerify.decision' | t }}</h3>

                  <div class="admin__actions">
                    @if (application.status === 'PENDING') {
                      <button type="button" class="btn btn--outline btn--sm" [disabled]="deciding()" (click)="markInReview(application.id)">
                        {{ 'adminVerify.markInReview' | t }}
                      </button>
                    }
                    @if (application.status === 'PENDING' || application.status === 'IN_REVIEW') {
                      <button type="button" class="btn btn--primary btn--sm" (click)="startDecision('approve')">
                        {{ 'adminVerify.approve' | t }}
                      </button>
                      <button type="button" class="btn btn--danger btn--sm" (click)="startDecision('reject')">
                        {{ 'adminVerify.reject' | t }}
                      </button>
                      <button type="button" class="btn btn--outline btn--sm" (click)="startDecision('request-info')">
                        {{ 'adminVerify.requestInfo' | t }}
                      </button>
                    }
                    @if (application.status !== 'PENDING' && application.status !== 'IN_REVIEW') {
                      <p class="muted">{{ 'adminVerify.noActions' | t }}</p>
                    }
                  </div>
                </section>

                <!-- History --------------------------------------------------- -->
                @if (application.history.length > 0) {
                  <section class="stack stack-2">
                    <h3 class="studio__panel-title">{{ 'verification.history.title' | t }}</h3>
                    <ul class="admin__history">
                      @for (entry of application.history; track entry.createdAt + entry.type) {
                        <li>
                          <span>
                            {{ 'verification.events.' + entry.type | t }}
                            @if (entry.actor) {
                              · {{ entry.actor.displayName }}
                            }
                          </span>
                          <span class="muted">{{ locale.formatDateTime(entry.createdAt) }}</span>
                        </li>
                      }
                    </ul>
                  </section>
                }
              </div>
            } @else {
              <app-state-panel kind="info" titleKey="adminVerify.pickApplication" />
            }
          </div>
        </div>

        <!-- Confirmation: an important decision is never a single click ------- -->
        @if (pending(); as action) {
          <div class="card card--pad stack stack-2">
            <h2 class="studio__panel-title">{{ 'adminVerify.decision' | t }}</h2>
            <div
              class="alert"
              [class.alert--error]="action === 'reject'"
              [class.alert--warning]="action !== 'reject'"
              role="alertdialog"
            >
              <strong>{{ 'adminVerify.confirm.' + action | t }}</strong>
              <textarea
                class="textarea"
                rows="3"
                [attr.aria-label]="'adminVerify.note' | t"
                [value]="note()"
                (input)="note.set($any($event.target).value)"
              ></textarea>
              <p class="field-hint">{{ 'adminVerify.noteHint' | t }}</p>
              <span class="admin__actions" style="margin-top: 0.5rem">
                <button
                  type="button"
                  class="btn btn--primary btn--sm"
                  [disabled]="note().trim().length < 3 || deciding()"
                  (click)="confirmDecision()"
                >
                  {{ (deciding() ? 'common.saving' : 'common.confirm') | t }}
                </button>
                <button type="button" class="btn btn--ghost btn--sm" (click)="cancelDecision()">
                  {{ 'common.cancel' | t }}
                </button>
              </span>
            </div>
          </div>
        }
      </div>
    </section>
  `,
})
export class AdminVerificationsPageComponent {
  protected readonly locale = inject(LocaleService);
  private readonly adminVerification = inject(AdminVerificationService);
  private readonly notifications = inject(NotificationService);

  protected readonly views: readonly QueueView[] = ['applications', 'unverified'];
  protected readonly statuses = VERIFICATION_STATUSES;

  protected readonly activeView = signal<QueueView>('applications');
  protected readonly statusFilter = signal<VerificationStatus | ''>('');
  protected readonly searchTerm = signal('');
  protected readonly page = signal(1);

  protected readonly items = signal<AdminVerification[]>([]);
  protected readonly meta = signal<PaginationMeta>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly detail = signal<AdminVerificationDetail | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loadingDetail = signal(false);
  protected readonly detailError = signal<ApiError | null>(null);

  protected readonly pending = signal<DecisionKind | null>(null);
  protected readonly note = signal('');
  protected readonly deciding = signal(false);
  protected readonly emptyKey = computed(() =>
    this.activeView() === 'applications' ? 'adminVerify.emptyQueue' : 'adminVerify.emptyUnverified',
  );

  constructor() {
    this.load();
  }

  protected setView(view: QueueView): void {
    if (this.activeView() === view) {
      return;
    }
    this.activeView.set(view);
    this.page.set(1);
    this.selectedId.set(null);
    this.detail.set(null);
    this.pending.set(null);
    this.load();
  }

  protected setStatusFilter(value: string): void {
    this.statusFilter.set(value as VerificationStatus | '');
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected resetFilters(): void {
    this.statusFilter.set('');
    this.searchTerm.set('');
    this.page.set(1);
    this.load();
  }

  protected goToPage(page: number): void {
    if (page < 1) {
      return;
    }
    this.page.set(page);
    this.load();
  }

  protected reload(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    const request =
      this.activeView() === 'applications'
        ? this.adminVerification.list({
            status: this.statusFilter(),
            page: this.page(),
            limit: PAGE_SIZE,
          })
        : this.adminVerification.listUnverified({
            search: this.searchTerm().trim() || undefined,
            page: this.page(),
            limit: PAGE_SIZE,
          });

    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (result) => {
        this.items.set(result.data);
        this.meta.set({
          page: result.meta.page,
          limit: result.meta.limit,
          total: result.meta.total,
          totalPages: result.meta.totalPages,
          hasNextPage: result.meta.hasNextPage,
          hasPreviousPage: result.meta.hasPreviousPage,
        });
      },
      error: (error: unknown) => this.error.set(ApiError.fromHttpError(error)),
    });
  }

  protected select(item: AdminVerification): void {
    this.pending.set(null);
    this.note.set('');

    if (item.id === null) {
      // A coach without an application: offer the explicit (grandfathered) approval.
      this.selectedId.set(item.coachProfileId);
      this.detail.set(null);
      this.detailError.set(null);
      this.startDecision('grandfather', item.coachProfileId);
      return;
    }

    this.selectedId.set(item.id);
    this.loadDetail(item.id);
  }

  protected loadDetail(id: string): void {
    this.loadingDetail.set(true);
    this.detailError.set(null);
    this.adminVerification
      .get(id)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (detail) => this.detail.set(detail),
        error: (error: unknown) => this.detailError.set(ApiError.fromHttpError(error)),
      });
  }

  /** Opens a private document through the authenticated API stream (no public URL). */
  protected openDocument(documentId: string): void {
    this.adminVerification.documentBlob(documentId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        globalThis.open?.(url, '_blank', 'noopener');
        globalThis.setTimeout?.(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (error: unknown) => this.notifications.apiError(ApiError.fromHttpError(error)),
    });
  }

  protected markInReview(id: string | null): void {
    if (!id) {
      return;
    }
    this.deciding.set(true);
    this.adminVerification
      .markInReview(id)
      .pipe(finalize(() => this.deciding.set(false)))
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.notifications.success('adminVerify.markedInReview');
          this.load();
        },
        error: (error: unknown) => this.notifications.apiError(ApiError.fromHttpError(error)),
      });
  }

  protected startDecision(kind: DecisionKind, coachProfileId?: string): void {
    this.pending.set(kind);
    this.note.set('');
    if (kind === 'grandfather' && coachProfileId) {
      this.selectedId.set(coachProfileId);
    }
  }

  protected cancelDecision(): void {
    this.pending.set(null);
    this.note.set('');
  }

  protected confirmDecision(): void {
    const action = this.pending();
    const note = this.note().trim();
    if (!action || note.length < 3) {
      return;
    }

    const id = action === 'grandfather' ? (this.detail()?.coachProfileId ?? this.selectedId()) : this.detail()?.id;
    if (!id) {
      return;
    }

    this.deciding.set(true);
    const request =
      action === 'approve'
        ? this.adminVerification.approve(id, note)
        : action === 'reject'
          ? this.adminVerification.reject(id, note)
          : action === 'request-info'
            ? this.adminVerification.requestInfo(id, note)
            : this.adminVerification.grandfather(id, note);

    request.pipe(finalize(() => this.deciding.set(false))).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.selectedId.set(detail.id);
        this.pending.set(null);
        this.note.set('');
        this.notifications.success(`adminVerify.done.${action}`);
        this.load();
      },
      error: (error: unknown) => this.notifications.apiError(ApiError.fromHttpError(error)),
    });
  }
}
