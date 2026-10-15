import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { NotificationService } from '../../core/ui/notification.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { BookingListComponent } from './booking-list.component';

/**
 * Client dashboard: the signed-in client's booking requests plus account actions.
 * All list behaviour (filters, pagination, actions, states) lives in `BookingListComponent`.
 */
@Component({
  selector: 'app-client-dashboard-page',
  imports: [RouterLink, TranslatePipe, IconComponent, AvatarComponent, BookingListComponent],
  templateUrl: './client-dashboard-page.component.html',
  styleUrl: './client-dashboard-page.component.scss',
})
export class ClientDashboardPageComponent {
  protected readonly auth = inject(AuthService);
  protected readonly locale = inject(LocaleService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected logout(): void {
    this.auth.logout();
    this.notifications.success('auth.logoutSuccess');
    void this.router.navigate(['/']);
  }
}
