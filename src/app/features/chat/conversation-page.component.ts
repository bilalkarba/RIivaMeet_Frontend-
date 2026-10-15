import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { BookingRealtimeService } from '../../core/services/booking-realtime.service';
import { CallService } from '../../core/services/call.service';
import { ConversationsService } from '../../core/services/conversations.service';
import type { ChatConversation, ChatMessage } from '../../core/models/domain.model';
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

            <div class="chat__history" role="log" [attr.aria-label]="'chat.history' | t" aria-live="polite">
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
                    <p dir="auto">{{ message.body }}</p>
                    <time [attr.datetime]="message.createdAt">{{ locale.formatDateTime(message.createdAt) }}</time>
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

            <form class="chat__composer" (submit)="send($event)">
              <label class="sr-only" for="chat-message">{{ 'chat.messageLabel' | t }}</label>
              <textarea
                id="chat-message"
                class="textarea"
                name="message"
                rows="2"
                maxlength="4000"
                [value]="draft()"
                [placeholder]="'chat.messagePlaceholder' | t"
                [disabled]="sending()"
                (input)="updateDraft($event)"
              ></textarea>
              <button
                type="submit"
                class="btn btn--primary"
                [disabled]="sending() || !draft().trim()"
                [attr.aria-label]="(sending() ? 'chat.sending' : 'chat.send') | t"
              >
                <app-icon name="arrow-right" [size]="17" />
                {{ (sending() ? 'chat.sending' : 'chat.send') | t }}
              </button>
            </form>
            <p class="chat__limit">{{ draft().length }}/4000</p>
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .chat-shell { max-width: 54rem; }
    .chat-back {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      margin-block-end: 1rem;
      color: var(--forest-700);
      font-weight: 700;
    }
    .chat { overflow: hidden; padding: 0; }
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
    .chat__header h1 { margin: 0; color: var(--forest-900); font-size: 1.2rem; }
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
    .chat__empty p { margin: 0; }
    .chat__message {
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
    .chat__message p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .chat__message time {
      display: block;
      margin-block-start: 0.3rem;
      color: var(--ink-400);
      font-size: 0.68rem;
      text-align: end;
    }
    .chat__message--mine time { color: rgb(255 255 255 / 75%); }
    .chat__composer {
      display: flex;
      align-items: end;
      gap: 0.7rem;
      padding: 1rem clamp(1rem, 3vw, 1.5rem) 0.25rem;
    }
    .chat__composer textarea { flex: 1; resize: vertical; min-height: 3.1rem; }
    .chat__limit { margin: 0; padding: 0 1.5rem 0.8rem; color: var(--ink-400); font-size: 0.72rem; text-align: end; }
    .chat__error { margin: 0.5rem 1.5rem; color: var(--rose-700); font-size: 0.85rem; }
    .chat-state { display: grid; justify-items: start; gap: 0.8rem; padding: 1.5rem; }
    @media (max-width: 520px) {
      .chat__header { align-items: flex-start; flex-direction: column; }
      .chat__actions { width: 100%; }
      .chat__history { height: 58vh; min-height: 15rem; }
      .chat__message { max-width: 90%; }
      .chat__composer { align-items: stretch; flex-direction: column; }
      .chat__composer .btn { align-self: flex-end; }
    }
  `,
})
export class ConversationPageComponent {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly conversations = inject(ConversationsService);
  private readonly realtime = inject(BookingRealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly calls = inject(CallService);
  protected readonly locale = inject(LocaleService);
  private readonly messagesEnd = viewChild<ElementRef<HTMLElement>>('messagesEnd');

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

  private readonly bookingId = this.route.snapshot.paramMap.get('bookingId');

  constructor() {
    this.realtime.messages.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message) => {
      const current = this.conversation();
      if (!current || message.conversationId !== current.id) {
        return;
      }
      this.appendMessage(message);
      if (message.senderId !== this.currentUserId()) {
        this.markRead(current.id);
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
    this.open();
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

  protected send(event: Event): void {
    event.preventDefault();
    const conversation = this.conversation();
    const body = this.draft().trim();
    if (!conversation || !body || this.sending()) {
      return;
    }

    this.sending.set(true);
    this.sendError.set(null);
    this.conversations
      .sendMessage(conversation.id, body)
      .pipe(take(1), finalize(() => this.sending.set(false)))
      .subscribe({
        next: (message) => {
          this.appendMessage(message);
          this.draft.set('');
          this.scrollToLatest();
        },
        error: (error: unknown) => this.sendError.set(errorKey(error)),
      });
  }

  private loadMessages(conversationId: string): void {
    this.conversations
      .listMessages(conversationId)
      .pipe(take(1), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.messages.set(page.data);
          this.scrollToLatest();
          this.markRead(conversationId);
        },
        error: (error: unknown) => this.loadError.set(errorKey(error)),
      });
  }

  private markRead(conversationId: string): void {
    this.conversations.markRead(conversationId).pipe(take(1)).subscribe({
      error: (error: unknown) => this.readError.set(errorKey(error)),
    });
  }

  private appendMessage(message: ChatMessage): void {
    if (this.messages().some((existing) => existing.id === message.id)) {
      return;
    }
    this.messages.update((messages) => [...messages, message]);
    this.scrollToLatest();
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
