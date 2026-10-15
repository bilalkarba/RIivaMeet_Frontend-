import { Component, computed, input } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { BookingStatus } from '../../core/models/domain.model';

/** Colocated status chip; colours mirror the booking state machine. */
@Component({
  selector: 'app-booking-status-badge',
  imports: [TranslatePipe],
  template: `
    <span [class]="'badge badge--dot badge--' + modifier()">
      {{ 'enums.status.' + status() | t }}
    </span>
  `,
})
export class BookingStatusBadgeComponent {
  readonly status = input.required<BookingStatus>();

  protected readonly modifier = computed(() => this.status().toLowerCase());
}
