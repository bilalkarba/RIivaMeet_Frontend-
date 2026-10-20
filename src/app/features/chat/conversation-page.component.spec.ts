import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import type {
  ChatConversation,
  ChatMessage,
  ChatMessageDelivery,
} from '../../core/models/domain.model';
import { BookingRealtimeService } from '../../core/services/booking-realtime.service';
import { CallService } from '../../core/services/call.service';
import { ConversationsService } from '../../core/services/conversations.service';
import { NotificationService } from '../../core/ui/notification.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { ConversationPageComponent } from './conversation-page.component';

const currentUser = {
  id: 'user-1',
  email: 'client@example.test',
  name: 'Client',
  phone: null,
  role: 'CLIENT' as const,
  hasCoachProfile: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const conversation: ChatConversation = {
  id: 'conversation-1',
  participant: { id: 'coach-1', displayName: 'Coach', avatarUrl: null },
  lastMessage: null,
  unreadCount: 0,
  lastMessageAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ConversationPageComponent message sending', () => {
  let fixture: ComponentFixture<ConversationPageComponent>;
  let conversations: {
    getModerationPolicy: ReturnType<typeof vi.fn>;
    getAttachmentConfig: ReturnType<typeof vi.fn>;
    openForBooking: ReturnType<typeof vi.fn>;
    listMessages: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    updateMessage: ReturnType<typeof vi.fn>;
    deleteMessage: ReturnType<typeof vi.fn>;
    uploadAttachment: ReturnType<typeof vi.fn>;
  };
  let notifications: { info: ReturnType<typeof vi.fn> };
  let locale: LocaleService;

  function sendOwnMessage(body: string): ChatMessageDelivery {
    const message: ChatMessageDelivery = {
      id: 'message-1',
      conversationId: conversation.id,
      senderId: currentUser.id,
      body,
      createdAt: '2026-01-01T00:00:00.000Z',
      editedAt: null,
      revision: 0,
      moderation: { action: 'ALLOW', policy: 'block', matches: [] },
    };
    conversations.sendMessage.mockReturnValue(of(message));
    const textarea = fixture.nativeElement.querySelector('#chat-message') as HTMLTextAreaElement;
    textarea.value = body;
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    return message;
  }

  beforeEach(() => {
    conversations = {
      getModerationPolicy: vi.fn().mockReturnValue(of({ enabled: true, policy: 'block' })),
      getAttachmentConfig: vi.fn().mockReturnValue(
        of({
          configured: true,
          maxBytes: 5 * 1024 * 1024,
          contentTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        }),
      ),
      openForBooking: vi.fn().mockReturnValue(of(conversation)),
      listMessages: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            page: 1,
            limit: 50,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        }),
      ),
      markRead: vi
        .fn()
        .mockReturnValue(
          of({ conversationId: conversation.id, lastReadAt: '2026-01-01T00:00:00.000Z' }),
        ),
      sendMessage: vi.fn(),
      updateMessage: vi.fn(),
      deleteMessage: vi.fn(),
      uploadAttachment: vi.fn(),
    };

    const realtimeMessages = new Subject<ChatMessage>();
    notifications = { info: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ConversationPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'booking-1' } } },
        },
        {
          provide: AuthService,
          useValue: {
            user: () => currentUser,
            token: () => 'access-token',
            isCoach: () => false,
          },
        },
        {
          provide: BookingRealtimeService,
          useValue: {
            messages: realtimeMessages.asObservable(),
            messageUpdates: new Subject<ChatMessage>().asObservable(),
            messageDeletions: new Subject<{
              conversationId: string;
              messageId: string;
            }>().asObservable(),
            connectionErrors: new Subject<void>().asObservable(),
            connect: vi.fn(),
            joinConversation: vi.fn(),
          },
        },
        {
          provide: CallService,
          useValue: { busy: () => false, startVideoCall: vi.fn(), startAudioCall: vi.fn() },
        },
        { provide: ConversationsService, useValue: conversations },
        { provide: NotificationService, useValue: notifications },
      ],
    });

    fixture = TestBed.createComponent(ConversationPageComponent);
    locale = TestBed.inject(LocaleService);
    fixture.detectChanges();
  });

  it('warns and stops before sending a prohibited phone number, preserving the draft and history', () => {
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    const body = 'Call me on +49 176 1234567';
    textarea.value = body;
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(conversations.sendMessage).not.toHaveBeenCalled();
    expect(textarea.value).toBe(body);
    expect(fixture.nativeElement.querySelectorAll('.chat__message')).toHaveLength(0);
    expect(
      (fixture.nativeElement.querySelector('.chat__error') as HTMLElement).textContent?.trim(),
    ).toBeTruthy();
    expect(notifications.info).toHaveBeenCalledWith('chat.moderation.detected');
  });

  it('warns and preserves a disguised Facebook account in the composer', () => {
    const textarea = fixture.nativeElement.querySelector('#chat-message') as HTMLTextAreaElement;
    const body = 'Hada Hsabi Facebook Bilal Karbach';
    textarea.value = body;
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    expect(conversations.sendMessage).not.toHaveBeenCalled();
    expect(conversations.uploadAttachment).not.toHaveBeenCalled();
    expect(textarea.value).toBe(body);
    expect(fixture.nativeElement.querySelectorAll('.chat__message')).toHaveLength(0);
    expect(notifications.info).toHaveBeenCalledWith('chat.moderation.detected');
  });

  it('sends valid messages normally and clears the draft after success', () => {
    const message = sendOwnMessage('See you at the gym tomorrow.');
    const textarea = fixture.nativeElement.querySelector('#chat-message') as HTMLTextAreaElement;

    expect(conversations.sendMessage).toHaveBeenCalledWith(conversation.id, message.body);
    expect(textarea.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain(message.body);
  });

  it('saves edits inline and marks the same message as edited', () => {
    const message = sendOwnMessage('The original message');
    const updated: ChatMessageDelivery = {
      ...message,
      body: 'The revised message',
      editedAt: '2026-01-02T00:00:00.000Z',
    };
    conversations.updateMessage.mockReturnValue(of(updated));

    const editButton = fixture.nativeElement.querySelector(
      `[aria-label="${locale.t('chat.editMessage')}"]`,
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();

    const editor = fixture.nativeElement.querySelector('.chat__edit-input') as HTMLTextAreaElement;
    editor.value = updated.body;
    editor.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('.chat__message-actions button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(conversations.updateMessage).toHaveBeenCalledWith(
      conversation.id,
      message.id,
      updated.body,
      message.revision,
    );
    expect(fixture.nativeElement.textContent).toContain(updated.body);
    expect(fixture.nativeElement.textContent).toContain(locale.t('chat.edited'));
  });

  it('uploads a PDF with a caption and renders an authorized file card', () => {
    const file = new File(['%PDF-1.7 test'], 'training-plan.pdf', {
      type: 'application/pdf',
    });
    const input = fixture.nativeElement.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('#chat-message') as HTMLTextAreaElement;
    textarea.value = 'Your training plan';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const message: ChatMessageDelivery = {
      id: 'attachment-message',
      conversationId: conversation.id,
      senderId: currentUser.id,
      body: 'Your training plan',
      createdAt: '2026-01-01T00:00:00.000Z',
      editedAt: null,
      revision: 0,
      attachment: {
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        downloadUrl: `/api/v1/conversations/${conversation.id}/messages/attachment-message/attachment`,
      },
      moderation: { action: 'ALLOW', policy: 'block', matches: [] },
    };
    conversations.uploadAttachment.mockReturnValue(
      of(new HttpResponse({ body: { data: message } })),
    );

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    expect(conversations.uploadAttachment).toHaveBeenCalledWith(
      conversation.id,
      file,
      'Your training plan',
      expect.any(String),
    );
    expect(fixture.nativeElement.textContent).toContain(file.name);
    expect(fixture.nativeElement.textContent).toContain(locale.t('chat.downloadAttachment'));
    expect(textarea.value).toBe('');
  });

  it('canceling an edit or delete leaves the original message unchanged', () => {
    const message = sendOwnMessage('Keep this message');
    const editButton = fixture.nativeElement.querySelector(
      `[aria-label="${locale.t('chat.editMessage')}"]`,
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();

    const editor = fixture.nativeElement.querySelector('.chat__edit-input') as HTMLTextAreaElement;
    editor.value = 'Discard this draft';
    editor.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const editActions = fixture.nativeElement.querySelectorAll(
      '.chat__message-actions button',
    ) as NodeListOf<HTMLButtonElement>;
    editActions[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(message.body);
    expect(fixture.nativeElement.textContent).not.toContain('Discard this draft');
    expect(conversations.updateMessage).not.toHaveBeenCalled();

    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    const deleteButton = fixture.nativeElement.querySelector(
      `[aria-label="${locale.t('chat.deleteMessage')}"]`,
    ) as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledWith(locale.t('chat.deleteConfirm'));
    expect(conversations.deleteMessage).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(message.body);
    confirm.mockRestore();
  });
});
