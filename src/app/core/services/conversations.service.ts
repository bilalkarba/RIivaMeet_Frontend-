import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../api/api.service';
import type { Paginated } from '../models/api.model';
import type { ChatConversation, ChatMessage } from '../models/domain.model';

@Injectable({ providedIn: 'root' })
export class ConversationsService {
  private readonly api = inject(ApiService);

  openForBooking(bookingId: string): Observable<ChatConversation> {
    return this.api.postData<ChatConversation>(`/conversations/booking/${bookingId}`, {});
  }

  listMessages(conversationId: string): Observable<Paginated<ChatMessage>> {
    return this.api.getPage<ChatMessage>(`/conversations/${conversationId}/messages`, {
      page: 1,
      limit: 50,
    });
  }

  sendMessage(conversationId: string, body: string): Observable<ChatMessage> {
    return this.api.postData<ChatMessage>(`/conversations/${conversationId}/messages`, { body });
  }

  markRead(conversationId: string): Observable<{ conversationId: string; lastReadAt: string }> {
    return this.api.patchData(`/conversations/${conversationId}/read`);
  }
}
