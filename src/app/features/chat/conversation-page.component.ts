import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { BookingRealtimeService } from '../../core/services/booking-realtime.service';
import { CallService } from '../../core/services/call.service';
import { ConversationsService } from '../../core/services/conversations.service';
import { NotificationService } from '../../core/ui/notification.service';
import { findContactSharing } from '../../core/utils/contact-moderation';
import type {
  ChatAttachmentConfig,
  ChatConversation,
  ChatMessage,
  ChatMessageDelivery,
  MessageModerationConfig,
} from '../../core/models/domain.model';
import type { CallType } from '../../core/models/call.model';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LocaleService } from '../../core/i18n/locale.service';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-conversation-page',
  imports: [RouterLink, TranslatePipe, IconComponent],
  template: `
    <section class="section chat-page">
      <div class="shell chat-shell">
        <a class="chat-back" [routerLink]="auth.isCoach() ? '/coach/dashboard' : '/dashboard'">
          <app-icon name="arrow-left" [size]="16" />
          {{ 'chat.back' | t }}
        </a>

        @if (loading()) {
          <div class="chat-state card" role="status">{{ 'chat.loading' | t }}</div>
        } @else if (loadError()) {
          <div class="chat-state card" role="alert">
            <p>{{ loadError()! | t }}</p>
            <button type="button" class="btn btn--outline btn--sm" (click)="open()">
              {{ 'common.retry' | t }}
            </button>
          </div>
        } @else if (conversation(); as activeConversation) {
          <article class="chat card">
            <header class="chat__header">
              <div>
                <p class="chat__eyebrow">{{ 'chat.privateConversation' | t }}</p>
                <h1>{{ activeConversation.participant.displayName }}</h1>
              </div>
              <div class="chat__actions">
                <button
                  type="button"
                  class="btn btn--outline btn--sm"
                  [disabled]="calls.busy()"
                  [attr.aria-label]="'call.videoCall' | t"
                  (click)="startCall('VIDEO')"
                >
                  <app-icon name="video" [size]="16" />
                  {{ 'call.videoCall' | t }}
                </button>
                <button
                  type="button"
                  class="btn btn--outline btn--sm"
                  [disabled]="calls.busy()"
                  [attr.aria-label]="'call.audioCall' | t"
                  (click)="startCall('AUDIO')"
                >
                  <app-icon name="phone" [size]="16" />
                  {{ 'call.audioCall' | t }}
                </button>
                <span class="chat__secure">
                  <app-icon name="lock" [size]="15" />
                  {{ 'chat.bookingConversation' | t }}
                </span>
              </div>
            </header>

            @if (realtimeUnavailable()) {
              <p class="chat__notice" role="status">{{ 'chat.realtimeUnavailable' | t }}</p>
            }

            <div
              class="chat__history"
              role="log"
              [attr.aria-label]="'chat.history' | t"
              aria-live="polite"
            >
              @if (messages().length === 0) {
                <div class="chat__empty">
                  <app-icon name="mail" [size]="25" />
                  <p>{{ 'chat.empty' | t }}</p>
                </div>
              } @else {
                @for (message of messages(); track message.id) {
                  <div
                    class="chat__message"
                    [class.chat__message--mine]="message.senderId === currentUserId()"
                  >
                    @if (editingMessageId() === message.id) {
                      <textarea
                        class="textarea chat__edit-input"
                        rows="2"
                        maxlength="4000"
                        [value]="editDraft()"
                        [disabled]="messageActionBusy() !== null"
                        (input)="updateEditDraft($event)"
                        [attr.aria-label]="'chat.editMessage' | t"
                      ></textarea>
                    } @else {
                    @if (message.body) {
                      <p dir="auto">{{ message.body }}</p>
                    }
                    @if (message.attachment; as attachment) {
                      @if (attachment.contentType.startsWith('image/')) {
                        @if (attachmentPreviewUrl(message.id); as previewUrl) {
                          <button
                            type="button"
                            class="chat__image-button"
                            (click)="openAttachment(message, false)"
                            [attr.aria-label]="'chat.openAttachment' | t"
                          >
                            <img
                              class="chat__image"
                              [src]="previewUrl"
                              [alt]="attachment.fileName"
                            />
                          </button>
                        } @else {
                          <p class="chat__attachment-loading" role="status">
                            {{ 'chat.attachmentLoading' | t }}
                          </p>
                        }
                      } @else {
                        <div class="chat__file-card">
                          <app-icon name="file" [size]="22" />
                          <div class="chat__file-details">
                            <span class="chat__file-name">{{ attachment.fileName }}</span>
                            <span class="chat__file-size">{{
                              formatFileSize(attachment.sizeBytes)
                            }}</span>
                          </div>
                          <button
                            type="button"
                            class="chat__file-action"
                            (click)="openAttachment(message, false)"
                            [attr.aria-label]="'chat.openAttachment' | t"
                          >
                            {{ 'chat.openAttachment' | t }}
                          </button>
                          <button
                            type="button"
                            class="chat__file-action"
                            (click)="openAttachment(message, true)"
                            [attr.aria-label]="'chat.downloadAttachment' | t"
                          >
                            {{ 'chat.downloadAttachment' | t }}
                          </button>
                        </div>
                      }
                    }
                    }

                    @if (message.senderId === currentUserId()) {
                      <div class="chat__message-actions">
                        @if (editingMessageId() === message.id) {
                          <button
                            type="button"
                            class="chat__message-action"
                            [disabled]="messageActionBusy() !== null || !editDraft().trim()"
                            (click)="saveEdit(message)"
                          >
                            <app-icon name="check" [size]="14" />
                            {{ 'chat.saveEdit' | t }}
                          </button>
                          <button
                            type="button"
                            class="chat__message-action"
                            [disabled]="messageActionBusy() !== null"
                            (click)="cancelEdit()"
                          >
                            <app-icon name="close" [size]="14" />
                            {{ 'chat.cancelEdit' | t }}
                          </button>
                        } @else {
                          <button
                            type="button"
                            class="chat__message-action"
                            [disabled]="messageActionBusy() !== null"
                            [attr.aria-label]="'chat.editMessage' | t"
                            [title]="'chat.editMessage' | t"
                            (click)="beginEdit(message)"
                          >
                            <app-icon name="edit" [size]="14" />
                            <span>{{ 'chat.editMessage' | t }}</span>
                          </button>
                          <button
                            type="button"
                            class="chat__message-action chat__message-action--delete"
                            [disabled]="messageActionBusy() !== null"
                            [attr.aria-label]="'chat.deleteMessage' | t"
                            [title]="'chat.deleteMessage' | t"
                            (click)="delete(message)"
                          >
                            <app-icon name="trash" [size]="14" />
                            <span>{{ 'chat.deleteMessage' | t }}</span>
                          </button>
                        }
                      </div>
                    }
                    <div class="chat__message-meta">
                      @if (message.editedAt) {
                        <span class="chat__edited">{{ 'chat.edited' | t }}</span>
                      }
                      <time [attr.datetime]="message.createdAt">{{
                        locale.formatDateTime(message.createdAt)
                      }}</time>
                    </div>
                  </div>
                }
              }
              <span #messagesEnd></span>
            </div>

            @if (readError()) {
              <p class="chat__error" role="alert">{{ readError()! | t }}</p>
            }
            @if (sendError()) {
              <p class="chat__error" role="alert">{{ sendError()! | t }}</p>
            }

            @if (attachmentConfigLoaded() && !attachmentConfig().configured) {
              <p class="chat__notice" role="status">{{ 'chat.attachmentUnavailable' | t }}</p>
            }
            <form class="chat__composer" (submit)="send($event)">
              <label class="sr-only" for="chat-message">{{ 'chat.messageLabel' | t }}</label>
              <textarea
                id="chat-message"
                #messageInput
                class="textarea"
                name="message"
                rows="2"
                maxlength="4000"
                [value]="draft()"
                [placeholder]="'chat.messagePlaceholder' | t"
                [disabled]="sending()"
                (input)="updateDraft($event)"
              ></textarea>
              @if (selectedAttachment(); as file) {
                <div class="chat__attachment-preview">
                  @if (selectedAttachmentPreview()) {
                    <img [src]="selectedAttachmentPreview()!" [alt]="file.name" />
                  } @else {
                    <app-icon name="file" [size]="24" />
                  }
                  <span class="chat__file-details">
                    <span class="chat__file-name">{{ file.name }}</span>
                    <span class="chat__file-size">{{ formatFileSize(file.size) }}</span>
                  </span>
                  <button
                    type="button"
                    class="chat__file-action"
                    [disabled]="sending()"
                    [attr.aria-label]="'chat.removeAttachment' | t"
                    (click)="clearSelectedAttachment()"
                  >
                    <app-icon name="close" [size]="16" />
                    {{ 'chat.removeAttachment' | t }}
                  </button>
                </div>
              }
              @if (uploadProgress() !== null) {
                <div class="chat__upload-progress" role="status">
                  <progress max="100" [value]="uploadProgress()!"></progress>
                  <span>{{ uploadProgress() }}%</span>
                </div>
              }
              <div class="chat__composer-actions">
                <input
                  #attachmentPicker
                  class="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                  [attr.aria-label]="'chat.attachFile' | t"
                  (change)="selectAttachment($event)"
                />
                <button
                  type="button"
                  class="btn btn--outline btn--sm"
                  [disabled]="
                    sending() ||
                    (attachmentConfigLoaded() && !attachmentConfig().configured)
                  "
                  [attr.aria-label]="'chat.attachFile' | t"
                  (click)="attachmentPicker.click()"
                >
                  <app-icon name="paperclip" [size]="17" />
                  {{ 'chat.attachFile' | t }}
                </button>
                <button
                  type="submit"
                  class="btn btn--primary"
                  [disabled]="sending() || (!draft().trim() && !selectedAttachment())"
                  [attr.aria-label]="(sending() ? 'chat.sending' : 'chat.send') | t"
                >
                  <app-icon name="arrow-right" [size]="17" />
                  {{ (sending() ? 'chat.sending' : 'chat.send') | t }}
                </button>
              </div>
            </form>
            <p class="chat__limit">{{ draft().length }}/4000</p>
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .chat-shell {
      max-width: 54rem;
    }
    .chat-back {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      margin-block-end: 1rem;
      color: var(--forest-700);
      font-weight: 700;
    }
    .chat {
      overflow: hidden;
      padding: 0;
    }
    .chat__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.2rem clamp(1rem, 3vw, 1.6rem);
      border-block-end: 1px solid var(--line);
      background: var(--cream-100);
    }
    .chat__eyebrow {
      margin: 0 0 0.2rem;
      color: var(--ink-500);
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .chat__header h1 {
      margin: 0;
      color: var(--forest-900);
      font-size: 1.2rem;
    }
    .chat__secure {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--forest-700);
      font-size: 0.78rem;
      font-weight: 700;
    }
    .chat__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .chat__notice {
      margin: 0;
      padding: 0.6rem 1rem;
      color: var(--ink-700);
      background: var(--lime-50, var(--green-50));
      font-size: 0.82rem;
    }
    .chat__history {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      height: min(58vh, 38rem);
      min-height: 18rem;
      overflow-y: auto;
      padding: clamp(1rem, 3vw, 1.5rem);
      background: var(--cream-50, var(--cream-100));
    }
    .chat__empty {
      display: grid;
      place-content: center;
      justify-items: center;
      flex: 1;
      gap: 0.6rem;
      color: var(--ink-500);
      text-align: center;
    }
    .chat__empty p {
      margin: 0;
    }
    .chat__message {
      position: relative;
      align-self: flex-start;
      max-width: min(82%, 38rem);
      padding: 0.7rem 0.9rem 0.45rem;
      border: 1px solid var(--line);
      border-radius: 1rem 1rem 1rem 0.25rem;
      background: white;
      box-shadow: var(--shadow-xs, 0 1px 2px rgb(20 40 28 / 5%));
    }
    .chat__message--mine {
      align-self: flex-end;
      border-color: transparent;
      border-radius: 1rem 1rem 0.25rem 1rem;
      background: var(--forest-700);
      color: white;
    }
    .chat__message p {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .chat__image-button {
      display: block;
      max-width: min(100%, 24rem);
      margin-block-start: 0.35rem;
      padding: 0;
      border: 0;
      border-radius: 0.65rem;
      background: transparent;
      cursor: zoom-in;
    }
    .chat__image {
      display: block;
      max-width: 100%;
      max-height: 20rem;
      border-radius: inherit;
      object-fit: contain;
    }
    .chat__file-card,
    .chat__attachment-preview {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      max-width: min(100%, 31rem);
      margin-block-start: 0.4rem;
      padding: 0.55rem;
      border: 1px solid var(--line);
      border-radius: 0.65rem;
      background: rgb(255 255 255 / 88%);
      color: var(--ink-800);
    }
    .chat__file-details {
      display: grid;
      min-width: 0;
      flex: 1;
      gap: 0.1rem;
    }
    .chat__file-name {
      overflow: hidden;
      font-size: 0.78rem;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chat__file-size {
      color: var(--ink-500);
      font-size: 0.68rem;
    }
    .chat__file-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 2rem;
      padding: 0.3rem 0.45rem;
      border: 1px solid var(--line);
      border-radius: var(--r-sm);
      background: white;
      color: var(--forest-700);
      font: inherit;
      font-size: 0.7rem;
      cursor: pointer;
    }
    .chat__file-action:disabled {
      opacity: 0.55;
      cursor: wait;
    }
    .chat__attachment-preview {
      align-self: stretch;
      margin: 0 1.5rem;
    }
    .chat__attachment-preview img {
      width: 3.2rem;
      height: 3.2rem;
      border-radius: 0.4rem;
      object-fit: cover;
    }
    .chat__upload-progress {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 1.5rem;
      color: var(--ink-500);
      font-size: 0.75rem;
    }
    .chat__upload-progress progress {
      flex: 1;
      height: 0.45rem;
      accent-color: var(--forest-700);
    }
    .chat__composer-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.65rem;
    }
    .chat__message-meta {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.45rem;
      margin-block-start: 0.3rem;
    }
    .chat__message time,
    .chat__edited {
      color: var(--ink-400);
      font-size: 0.68rem;
    }
    .chat__message--mine time {
      color: rgb(255 255 255 / 75%);
    }
    .chat__message--mine .chat__edited {
      color: rgb(255 255 255 / 82%);
    }
    .chat__message-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.25rem;
      margin-block-start: 0.35rem;
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--dur-fast) var(--ease);
    }
    .chat__message:hover .chat__message-actions,
    .chat__message:focus-within .chat__message-actions {
      opacity: 1;
      pointer-events: auto;
    }
    .chat__message-action {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0.25rem 0.4rem;
      border: 0;
      border-radius: var(--r-sm);
      background: rgb(255 255 255 / 14%);
      color: inherit;
      font: inherit;
      font-size: 0.72rem;
      cursor: pointer;
    }
    .chat__message-action:hover:not(:disabled) {
      background: rgb(255 255 255 / 25%);
    }
    .chat__message-action--delete {
      color: #ffd5d5;
    }
    .chat__message-action:disabled {
      opacity: 0.55;
      cursor: wait;
    }
    .chat__edit-input {
      display: block;
      width: min(100%, 30rem);
      min-width: min(15rem, 100%);
      color: var(--ink-900);
      background: white;
      resize: vertical;
    }
    .chat__composer {
      display: flex;
      align-items: end;
      gap: 0.7rem;
      padding: 1rem clamp(1rem, 3vw, 1.5rem) 0.25rem;
    }
    .chat__composer textarea {
      flex: 1;
      resize: vertical;
      min-height: 3.1rem;
    }
    .chat__limit {
      margin: 0;
      padding: 0 1.5rem 0.8rem;
      color: var(--ink-400);
      font-size: 0.72rem;
      text-align: end;
    }
    .chat__error {
      margin: 0.5rem 1.5rem;
      color: var(--rose-700);
      font-size: 0.85rem;
    }
    .chat-state {
      display: grid;
      justify-items: start;
      gap: 0.8rem;
      padding: 1.5rem;
    }
    @media (max-width: 520px) {
      .chat__header {
        align-items: flex-start;
        flex-direction: column;
      }
      .chat__actions {
        width: 100%;
      }
      .chat__history {
        height: 58vh;
        min-height: 15rem;
      }
      .chat__message {
        max-width: 90%;
      }
      .chat__message-actions {
        opacity: 1;
        pointer-events: auto;
      }
      .chat__message-action {
        min-height: 2rem;
      }
      .chat__composer {
        align-items: stretch;
        flex-direction: column;
      }
      .chat__composer-actions {
        justify-content: space-between;
      }
      .chat__file-card {
        flex-wrap: wrap;
      }
      .chat__attachment-preview {
        margin-inline: 1rem;
      }
    }
  `,
})
export class ConversationPageComponent {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly conversations = inject(ConversationsService);
  private readonly realtime = inject(BookingRealtimeService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly calls = inject(CallService);
  protected readonly locale = inject(LocaleService);
  private readonly messagesEnd = viewChild<ElementRef<HTMLElement>>('messagesEnd');
  private readonly messageInput = viewChild<ElementRef<HTMLTextAreaElement>>('messageInput');

  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly conversation = signal<ChatConversation | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly sendError = signal<string | null>(null);
  protected readonly readError = signal<string | null>(null);
  protected readonly realtimeUnavailable = signal(false);
  protected readonly currentUserId = signal(this.auth.user()?.id ?? '');
  protected readonly draft = signal('');
  protected readonly selectedAttachment = signal<File | null>(null);
  protected readonly selectedAttachmentPreview = signal<string | null>(null);
  protected readonly uploadProgress = signal<number | null>(null);
  protected readonly attachmentConfig = signal<ChatAttachmentConfig>({
    configured: false,
    maxBytes: 5 * 1024 * 1024,
    contentTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  });
  protected readonly attachmentConfigLoaded = signal(false);
  private readonly selectedUploadId = signal<string | null>(null);
  private readonly attachmentUrls = signal<Record<string, string>>({});
  private readonly attachmentLoads = new Set<string>();
  protected readonly editingMessageId = signal<string | null>(null);
  protected readonly editDraft = signal('');
  protected readonly messageActionBusy = signal<string | null>(null);
  /** Mirrors the server policy so `block` is enforced before the request is made. */
  private readonly moderationPolicy = signal<MessageModerationConfig | null>(null);

  private readonly bookingId = this.route.snapshot.paramMap.get('bookingId');

  constructor() {
    this.realtime.messages.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message) => {
      const current = this.conversation();
      if (!current || message.conversationId !== current.id) {
        return;
      }
      this.appendMessage(message);
      this.loadAttachmentPreview(message);
      if (message.senderId !== this.currentUserId()) {
        this.markRead(current.id);
      }
    });
    this.realtime.messageUpdates.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message) => {
      if (message.conversationId === this.conversation()?.id) {
        this.replaceMessage(message);
      }
    });
    this.realtime.messageDeletions
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ conversationId, messageId }) => {
        if (conversationId === this.conversation()?.id) {
          this.removeMessage(messageId);
        }
      });
    this.realtime.connectionErrors
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.realtimeUnavailable.set(true));

    const token = this.auth.token();
    if (token) {
      this.realtime.connect(token);
    } else {
      this.loadError.set('errors.codes.UNAUTHORIZED');
      this.loading.set(false);
      return;
    }
    this.loadModerationPolicy();
    this.loadAttachmentConfig();
    this.open();
    this.destroyRef.onDestroy(() => {
      const urls = Object.values(this.attachmentUrls());
      if (this.selectedAttachmentPreview()) {
        urls.push(this.selectedAttachmentPreview()!);
      }
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    });
  }

  private loadModerationPolicy(): void {
    this.conversations
      .getModerationPolicy()
      .pipe(take(1))
      .subscribe({
        next: (config) => this.moderationPolicy.set(config),
        // The server still moderates every message, so a failed config read is not fatal.
        error: () => this.moderationPolicy.set(null),
      });
  }

  private loadAttachmentConfig(): void {
    this.conversations
      .getAttachmentConfig()
      .pipe(
        take(1),
        finalize(() => this.attachmentConfigLoaded.set(true)),
      )
      .subscribe({
        next: (config) => this.attachmentConfig.set(config),
        error: () => this.sendError.set('chat.attachmentConfigError'),
      });
  }

  /** Put the caret back in the composer after a blocked message so it can be edited. */
  private focusComposer(): void {
    globalThis.setTimeout(() => this.messageInput()?.nativeElement.focus(), 0);
  }

  protected open(): void {
    if (!this.bookingId) {
      this.loadError.set('errors.codes.NOT_FOUND');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);
    this.conversations
      .openForBooking(this.bookingId)
      .pipe(take(1))
      .subscribe({
        next: (conversation) => {
          this.conversation.set(conversation);
          this.realtime.joinConversation(conversation.id);
          this.loadMessages(conversation.id);
        },
        error: (error: unknown) => {
          this.loadError.set(errorKey(error));
          this.loading.set(false);
        },
      });
  }

  /** Start an audio/video call in this booking conversation (see `../../shared/call-overlay`). */
  protected startCall(type: CallType): void {
    const conversation = this.conversation();
    if (!conversation) {
      return;
    }
    if (type === 'VIDEO') {
      void this.calls.startVideoCall(conversation.id);
      return;
    }
    void this.calls.startAudioCall(conversation.id);
  }

  protected updateDraft(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  private clearDraft(): void {
    this.draft.set('');
    const input = this.messageInput()?.nativeElement;
    if (input) {
      input.value = '';
    }
  }

  protected selectAttachment(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!this.attachmentConfig().contentTypes.includes(file.type)) {
      this.sendError.set('chat.attachmentTypeUnsupported');
      return;
    }
    if (file.size === 0 || file.size > this.attachmentConfig().maxBytes) {
      this.sendError.set('chat.attachmentTooLarge');
      return;
    }

    this.clearSelectedAttachment();
    this.sendError.set(null);
    this.selectedAttachment.set(file);
    this.selectedUploadId.set(globalThis.crypto.randomUUID());
    if (file.type.startsWith('image/')) {
      this.selectedAttachmentPreview.set(URL.createObjectURL(file));
    }
  }

  protected clearSelectedAttachment(): void {
    const preview = this.selectedAttachmentPreview();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    this.selectedAttachment.set(null);
    this.selectedAttachmentPreview.set(null);
    this.selectedUploadId.set(null);
  }

  protected attachmentPreviewUrl(messageId: string): string | null {
    return this.attachmentUrls()[messageId] ?? null;
  }

  protected formatFileSize(sizeBytes: number): string {
    if (sizeBytes < 1024) {
      return `${sizeBytes} B`;
    }
    const unit = sizeBytes < 1024 * 1024 ? 'KB' : 'MB';
    const size = sizeBytes < 1024 * 1024 ? sizeBytes / 1024 : sizeBytes / (1024 * 1024);
    return `${new Intl.NumberFormat(this.locale.language(), {
      maximumFractionDigits: 1,
    }).format(size)} ${unit}`;
  }

  protected openAttachment(message: ChatMessage, download: boolean): void {
    const attachment = message.attachment;
    const conversation = this.conversation();
    if (!attachment || !conversation) {
      return;
    }
    const cachedUrl = this.attachmentPreviewUrl(message.id);
    if (cachedUrl) {
      this.triggerAttachmentAction(cachedUrl, attachment.fileName, download);
      return;
    }
    this.conversations
      .downloadAttachment(conversation.id, message.id)
      .pipe(take(1))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.attachmentUrls.update((urls) => ({ ...urls, [message.id]: url }));
          this.triggerAttachmentAction(url, attachment.fileName, download);
        },
        error: (error: unknown) => this.sendError.set(errorKey(error)),
      });
  }

  private triggerAttachmentAction(url: string, fileName: string, download: boolean): void {
    if (download) {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      return;
    }
    globalThis.open(url, '_blank', 'noopener,noreferrer');
  }

  private loadAttachmentPreview(message: ChatMessage): void {
    if (
      !message.attachment?.contentType.startsWith('image/') ||
      this.attachmentUrls()[message.id] ||
      this.attachmentLoads.has(message.id)
    ) {
      return;
    }
    const conversation = this.conversation();
    if (!conversation) {
      return;
    }
    this.attachmentLoads.add(message.id);
    this.conversations
      .downloadAttachment(conversation.id, message.id)
      .pipe(
        take(1),
        finalize(() => this.attachmentLoads.delete(message.id)),
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.attachmentUrls.update((urls) => ({ ...urls, [message.id]: url }));
        },
        error: (error: unknown) => this.sendError.set(errorKey(error)),
      });
  }

  protected updateEditDraft(event: Event): void {
    this.editDraft.set((event.target as HTMLTextAreaElement).value);
  }

  protected beginEdit(message: ChatMessage): void {
    this.sendError.set(null);
    this.editingMessageId.set(message.id);
    this.editDraft.set(message.body);
  }

  protected cancelEdit(): void {
    this.editingMessageId.set(null);
    this.editDraft.set('');
    this.sendError.set(null);
  }

  protected saveEdit(message: ChatMessage): void {
    const conversation = this.conversation();
    const body = this.editDraft().trim();
    if (!conversation || !body || this.messageActionBusy()) {
      return;
    }

    const policy = this.moderationPolicy();
    if (
      policy?.enabled === true &&
      policy.policy === 'block' &&
      findContactSharing(body).length > 0
    ) {
      this.sendError.set('chat.moderation.blocked');
      this.notifications.info('chat.moderation.detected');
      this.focusComposer();
      return;
    }

    this.sendError.set(null);
    this.messageActionBusy.set(message.id);
    this.conversations
      .updateMessage(conversation.id, message.id, body, message.revision ?? 0)
      .pipe(
        take(1),
        finalize(() => this.messageActionBusy.set(null)),
      )
      .subscribe({
        next: (delivery) => {
          const { moderation, ...updated } = delivery;
          this.replaceMessage(updated);
          this.cancelEdit();
          if (moderation?.action === 'WARN') {
            this.notifications.info('chat.moderation.warn');
          } else if (moderation?.action === 'FLAG') {
            this.notifications.info('chat.moderation.flagged');
          }
        },
        error: (error: unknown) => {
          const failure = ApiError.fromHttpError(error);
          const details = failure.details as { moderation?: unknown } | undefined;
          if (details?.moderation) {
            this.sendError.set('chat.moderation.blocked');
            this.notifications.info('chat.moderation.detected');
            this.focusComposer();
            return;
          }
          this.sendError.set(errorKey(error));
        },
      });
  }

  protected delete(message: ChatMessage): void {
    const conversation = this.conversation();
    if (
      !conversation ||
      this.messageActionBusy() ||
      !globalThis.confirm(this.locale.t('chat.deleteConfirm'))
    ) {
      return;
    }

    this.sendError.set(null);
    this.messageActionBusy.set(message.id);
    this.conversations
      .deleteMessage(conversation.id, message.id)
      .pipe(
        take(1),
        finalize(() => this.messageActionBusy.set(null)),
      )
      .subscribe({
        next: () => this.removeMessage(message.id),
        error: (error: unknown) => this.sendError.set(errorKey(error)),
      });
  }

  protected send(event: Event): void {
    event.preventDefault();
    const conversation = this.conversation();
    const body = this.draft().trim();
    const file = this.selectedAttachment();
    if (!conversation || (!body && !file) || this.sending()) {
      return;
    }

    // Immediate, translated validation for the `block` policy. `warn` and `flag` let the
    // message through and the server returns the matching outcome. The server re-checks
    // every message, so this is convenience, never the security boundary.
    const policy = this.moderationPolicy();
    const blockedByPolicy = policy?.enabled === true && policy.policy === 'block';
    if (blockedByPolicy && findContactSharing(body).length > 0) {
      this.sendError.set('chat.moderation.blocked');
      this.notifications.info('chat.moderation.detected');
      this.focusComposer();
      return;
    }

    this.sending.set(true);
    this.sendError.set(null);
    if (file) {
      this.uploadAttachment(conversation.id, body, file);
      return;
    }
    this.conversations
      .sendMessage(conversation.id, body)
      .pipe(
        take(1),
        finalize(() => this.sending.set(false)),
      )
      .subscribe({
        next: (delivery) => {
          this.acceptDelivery(delivery);
          this.clearDraft();
        },
        error: (error: unknown) => {
          const failure = ApiError.fromHttpError(error);
          const details = failure.details as { moderation?: unknown } | undefined;
          if (details?.moderation) {
            this.sendError.set('chat.moderation.blocked');
            this.notifications.info('chat.moderation.detected');
            this.focusComposer();
            return;
          }
          this.sendError.set(errorKey(error));
        },
      });
  }

  private uploadAttachment(conversationId: string, body: string, file: File): void {
    const uploadId = this.selectedUploadId();
    if (!uploadId) {
      this.sending.set(false);
      this.sendError.set('chat.attachmentUploadError');
      return;
    }
    this.uploadProgress.set(0);
    this.conversations
      .uploadAttachment(conversationId, file, body, uploadId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.sending.set(false);
          this.uploadProgress.set(null);
        }),
      )
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            this.uploadProgress.set(
              event.total ? Math.round((event.loaded / event.total) * 100) : null,
            );
          } else if (event instanceof HttpResponse && event.body) {
            this.acceptDelivery(event.body.data);
            this.clearDraft();
            this.clearSelectedAttachment();
          }
        },
        error: (error: unknown) => {
          const failure = ApiError.fromHttpError(error);
          const details = failure.details as { moderation?: unknown } | undefined;
          if (details?.moderation) {
            this.sendError.set('chat.moderation.blocked');
            this.notifications.info('chat.moderation.detected');
            this.focusComposer();
          } else if (failure.code === 'SERVICE_UNAVAILABLE') {
            this.sendError.set('chat.attachmentUnavailable');
          } else if (failure.code === 'PAYLOAD_TOO_LARGE') {
            this.sendError.set('chat.attachmentTooLarge');
          } else {
            this.sendError.set(errorKey(error));
          }
        },
      });
  }

  private acceptDelivery(delivery: ChatMessageDelivery): void {
    const { moderation, ...message } = delivery;
    this.appendMessage(message);
    this.scrollToLatest();

    if (moderation?.action === 'WARN') {
      this.notifications.info('chat.moderation.warn');
    } else if (moderation?.action === 'FLAG') {
      this.notifications.info('chat.moderation.flagged');
    }
  }

  private loadMessages(conversationId: string): void {
    this.conversations
      .listMessages(conversationId)
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (page) => {
          this.messages.set(page.data);
          for (const message of page.data) {
            this.loadAttachmentPreview(message);
          }
          this.scrollToLatest();
          this.markRead(conversationId);
        },
        error: (error: unknown) => this.loadError.set(errorKey(error)),
      });
  }

  private markRead(conversationId: string): void {
    this.conversations
      .markRead(conversationId)
      .pipe(take(1))
      .subscribe({
        error: (error: unknown) => this.readError.set(errorKey(error)),
      });
  }

  private appendMessage(message: ChatMessage): void {
    if (this.messages().some((existing) => existing.id === message.id)) {
      return;
    }
    this.messages.update((messages) => [...messages, message]);
    this.loadAttachmentPreview(message);
    this.scrollToLatest();
  }

  private replaceMessage(message: ChatMessage): void {
    this.messages.update((messages) =>
      messages.map((current) => (current.id === message.id ? message : current)),
    );
  }

  private removeMessage(messageId: string): void {
    const url = this.attachmentUrls()[messageId];
    if (url) {
      URL.revokeObjectURL(url);
      this.attachmentUrls.update(({ [messageId]: _removed, ...urls }) => urls);
    }
    this.messages.update((messages) => messages.filter((message) => message.id !== messageId));
  }

  private scrollToLatest(): void {
    globalThis.setTimeout(() => {
      this.messagesEnd()?.nativeElement.scrollIntoView?.({ block: 'end' });
    }, 0);
  }
}

function errorKey(error: unknown): string {
  const apiError = ApiError.fromHttpError(error);
  return apiError.isNetworkError ? 'errors.network' : apiError.messageKey;
}
