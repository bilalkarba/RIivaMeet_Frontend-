import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { LocaleService } from '../../core/i18n/locale.service';
import type { AdminVerification, AdminVerificationDetail } from '../../core/models/domain.model';
import { AdminVerificationService } from '../../core/services/admin-verification.service';
import { NotificationService } from '../../core/ui/notification.service';
import { AdminVerificationsPageComponent } from './admin-verifications-page.component';

const verificationId = 'verification-1';

function makeDetail(overrides: Partial<AdminVerificationDetail> = {}): AdminVerificationDetail {
  return {
    id: verificationId,
    coachProfileId: 'coach-profile-1',
    status: 'PENDING',
    submittedAt: '2026-01-19T12:00:00.000Z',
    lastSubmittedAt: '2026-01-19T12:00:00.000Z',
    coach: { id: 'user-1', displayName: 'Amina Coach', email: 'amina@example.test' },
    isPublished: false,
    documentCount: 1,
    reviewNote: null,
    reviewedAt: null,
    updatedAt: '2026-01-20T12:00:00.000Z',
    documents: [
      {
        id: 'document-1',
        type: 'DIPLOMA',
        fileName: 'coaching-diploma.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        isCurrent: true,
        uploadedAt: '2026-01-19T12:00:00.000Z',
        confirmed: true,
      },
    ],
    reviewedBy: null,
    history: [],
    ...overrides,
  };
}

function makeSummary(): AdminVerification {
  const detail = makeDetail();
  return {
    id: detail.id,
    coachProfileId: detail.coachProfileId,
    status: detail.status,
    submittedAt: detail.submittedAt,
    lastSubmittedAt: detail.lastSubmittedAt,
    coach: detail.coach,
    isPublished: detail.isPublished,
    documentCount: detail.documentCount,
    reviewNote: detail.reviewNote,
    reviewedAt: detail.reviewedAt,
    updatedAt: detail.updatedAt,
  };
}

describe('AdminVerificationsPageComponent manual verification', () => {
  let fixture: ComponentFixture<AdminVerificationsPageComponent>;
  let adminVerification: {
    list: ReturnType<typeof vi.fn>;
    listUnverified: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    documentBlob: ReturnType<typeof vi.fn>;
    markInReview: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
    requestInfo: ReturnType<typeof vi.fn>;
    grandfather: ReturnType<typeof vi.fn>;
  };
  let notifications: {
    success: ReturnType<typeof vi.fn>;
    apiError: ReturnType<typeof vi.fn>;
  };
  let locale: LocaleService;

  function findButton(label: string): HTMLButtonElement {
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const button = Array.from(buttons).find((candidate) => candidate.textContent?.includes(label) ?? false);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Button "${label}" is not rendered`);
    }
    return button;
  }

  beforeEach(() => {
    const page = {
      data: [makeSummary()],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
    adminVerification = {
      list: vi.fn().mockReturnValue(of(page)),
      listUnverified: vi.fn().mockReturnValue(of({ ...page, data: [] })),
      get: vi.fn().mockReturnValue(of(makeDetail())),
      documentBlob: vi.fn().mockReturnValue(new Subject<Blob>()),
      markInReview: vi.fn().mockReturnValue(of(makeDetail({ status: 'IN_REVIEW' }))),
      approve: vi.fn().mockReturnValue(of(makeDetail({ status: 'APPROVED' }))),
      reject: vi.fn().mockReturnValue(of(makeDetail({ status: 'REJECTED' }))),
      requestInfo: vi.fn().mockReturnValue(of(makeDetail({ status: 'NEEDS_INFO' }))),
      grandfather: vi.fn().mockReturnValue(of(makeDetail({ status: 'APPROVED' }))),
    };
    notifications = { success: vi.fn(), apiError: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AdminVerificationsPageComponent],
      providers: [
        { provide: AdminVerificationService, useValue: adminVerification },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    fixture = TestBed.createComponent(AdminVerificationsPageComponent);
    locale = TestBed.inject(LocaleService);
    fixture.detectChanges();
    findButton('Amina Coach').click();
    fixture.detectChanges();
  });

  it('opens verification details and displays the uploaded document', () => {
    expect(adminVerification.get).toHaveBeenCalledWith(verificationId);
    expect(fixture.nativeElement.textContent).toContain('coaching-diploma.pdf');
    expect(fixture.nativeElement.textContent).toContain(locale.t('adminVerify.decision'));

    findButton(locale.t('adminVerify.openDocument')).click();
    expect(adminVerification.documentBlob).toHaveBeenCalledWith('document-1');
  });

  it('allows explicit admin decisions without an AI request or service method', () => {
    expect('analyze' in adminVerification).toBe(false);

    findButton(locale.t('adminVerify.markInReview')).click();
    fixture.detectChanges();
    expect(adminVerification.markInReview).toHaveBeenCalledWith(verificationId);

    findButton(locale.t('adminVerify.approve')).click();
    fixture.detectChanges();
    const note = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    note.value = 'Documents reviewed manually.';
    note.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    findButton(locale.t('common.confirm')).click();
    fixture.detectChanges();

    expect(adminVerification.approve).toHaveBeenCalledWith(verificationId, 'Documents reviewed manually.');
    expect(notifications.success).toHaveBeenCalledWith('adminVerify.done.approve');
    expect(adminVerification.get).toHaveBeenCalledTimes(1);
  });
});
