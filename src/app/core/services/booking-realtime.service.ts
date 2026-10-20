import { Injectable, signal } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import { Subject } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { BookingNotification, ChatMessage, DeletedChatMessage } from '../models/domain.model';

@Injectable({ providedIn: 'root' })
export class BookingRealtimeService {
  private socket: Socket | null = null;
  private readonly incoming = new Subject<BookingNotification>();
  private readonly incomingMessages = new Subject<ChatMessage>();
  private readonly updatedMessages = new Subject<ChatMessage>();
  private readonly deletedMessages = new Subject<DeletedChatMessage>();
  private readonly connectionFailures = new Subject<void>();

  readonly notifications = this.incoming.asObservable();
  readonly messages = this.incomingMessages.asObservable();
  readonly messageUpdates = this.updatedMessages.asObservable();
  readonly messageDeletions = this.deletedMessages.asObservable();
  readonly connectionErrors = this.connectionFailures.asObservable();
  readonly connected = signal(false);

  connect(token: string): void {
    this.disconnect();
    const apiOrigin = environment.apiUrl.replace(/\/api\/v1\/?$/, '');
    this.socket = io(apiOrigin, { auth: { token }, path: '/socket.io' });
    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));
    this.socket.on('connect_error', () => {
      this.connected.set(false);
      this.connectionFailures.next();
    });
    this.socket.on('notification:new', (notification: BookingNotification) => {
      this.incoming.next(notification);
    });
    this.socket.on('message:new', (message: ChatMessage) => {
      this.incomingMessages.next(message);
    });
    this.socket.on('message:updated', (message: ChatMessage) => {
      this.updatedMessages.next(message);
    });
    this.socket.on('message:deleted', (message: DeletedChatMessage) => {
      this.deletedMessages.next(message);
    });
  }

  joinConversation(conversationId: string): void {
    this.socket?.emit('conversation:join', { conversationId }, (response: { ok: boolean }) => {
      if (!response.ok) {
        this.connectionFailures.next();
      }
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }
}
