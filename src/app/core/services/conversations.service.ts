import { HttpClient, type HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api/api.service';
import type { ApiEnvelope, Paginated } from '../models/api.model';
import type {
  ChatAttachmentConfig,
  ChatConversation,
  ChatMessage,
  ChatMessageDelivery,
  MessageModerationConfig,
} from '../models/domain.model';

@Injectable({ providedIn: 'root' })
export class ConversationsService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  openForBooking(bookingId: string): Observable<ChatConversation> {
    return this.api.postData<ChatConversation>(`/conversations/booking/${bookingId}`, {});
  }

  listMessages(conversationId: string): Observable<Paginated<ChatMessage>> {
    return this.api.getPage<ChatMessage>(`/conversations/${conversationId}/messages`, {
      page: 1,
      limit: 50,
    });
  }

  /** Server policy for the pre-send contact-sharing check (never the security boundary). */
  getModerationPolicy(): Observable<MessageModerationConfig> {
    return this.api.getData<MessageModerationConfig>('/conversations/moderation-policy');
  }

  getAttachmentConfig(): Observable<ChatAttachmentConfig> {
    return this.api.getData<ChatAttachmentConfig>('/conversations/attachment-config');
  }

  uploadAttachment(
    conversationId: string,
    file: File,
    body: string,
    clientUploadId: string,
  ): Observable<HttpEvent<ApiEnvelope<ChatMessageDelivery>>> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('body', body);
    form.append('clientUploadId', clientUploadId);
    return this.http.post<ApiEnvelope<ChatMessageDelivery>>(
      this.api.url(`/conversations/${conversationId}/attachments`),
      form,
      { reportProgress: true, observe: 'events' },
    );
  }

  downloadAttachment(conversationId: string, messageId: string): Observable<Blob> {
    return this.http.get(
      this.api.url(`/conversations/${conversationId}/messages/${messageId}/attachment`),
      { responseType: 'blob' },
    );
  }

  sendMessage(conversationId: string, body: string): Observable<ChatMessageDelivery> {
    return this.api.postData<ChatMessageDelivery>(`/conversations/${conversationId}/messages`, {
      body,
    });
  }

  markRead(conversationId: string): Observable<{ conversationId: string; lastReadAt: string }> {
    return this.api.patchData(`/conversations/${conversationId}/read`);
  }

  updateMessage(
    conversationId: string,
    messageId: string,
    body: string,
    revision: number,
  ): Observable<ChatMessageDelivery> {
    return this.api.patchData<ChatMessageDelivery>(
      `/conversations/${conversationId}/messages/${messageId}`,
      { body, revision },
    );
  }

  deleteMessage(
    conversationId: string,
    messageId: string,
  ): Observable<{ messageId: string; conversationId: string }> {
    return this.api.deleteData<{ messageId: string; conversationId: string }>(
      `/conversations/${conversationId}/messages/${messageId}`,
    );
  }
}
