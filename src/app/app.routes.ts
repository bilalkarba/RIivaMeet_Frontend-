import { Routes } from '@angular/router';

import { authGuard, guestOnlyGuard, roleGuard } from './core/guards/auth.guard';
import { SiteLayoutComponent } from './layouts/site-layout/site-layout.component';

/**
 * Application routes.
 *
 * Every page lives under `SiteLayoutComponent` so the header, footer, toasts and the
 * offline banner are shared. Pages are lazily loaded, and `title` values are translation
 * keys resolved by `I18nTitleStrategy` (so the browser tab follows the language).
 *
 * Route guards shape the experience only — the API re-checks the JWT and the caller's
 * role on every protected endpoint.
 */
export const routes: Routes = [
  {
    path: '',
    component: SiteLayoutComponent,
    children: [
      {
        path: '',
        title: 'nav.home',
        loadComponent: () => import('./features/home/home-page.component').then((m) => m.HomePageComponent),
      },
      {
        path: 'coaches',
        title: 'nav.coaches',
        loadComponent: () =>
          import('./features/coaches/coaches-page.component').then((m) => m.CoachesPageComponent),
      },
      {
        path: 'coaches/:id',
        title: 'search.title',
        loadComponent: () =>
          import('./features/coach-detail/coach-detail-page.component').then(
            (m) => m.CoachDetailPageComponent,
          ),
      },
      {
        path: 'login',
        title: 'nav.login',
        canActivate: [guestOnlyGuard],
        loadComponent: () =>
          import('./features/auth/login-page.component').then((m) => m.LoginPageComponent),
      },
      {
        path: 'register',
        title: 'nav.register',
        canActivate: [guestOnlyGuard],
        loadComponent: () =>
          import('./features/auth/register-page.component').then((m) => m.RegisterPageComponent),
      },
      {
        path: 'dashboard',
        title: 'nav.dashboard',
        // A coach is redirected to their own area by the role guard.
        canActivate: [authGuard, roleGuard('CLIENT')],
        loadComponent: () =>
          import('./features/dashboard/client-dashboard-page.component').then(
            (m) => m.ClientDashboardPageComponent,
          ),
      },
      {
        path: 'bookings/:bookingId/conversation',
        title: 'chat.title',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/chat/conversation-page.component').then((m) => m.ConversationPageComponent),
      },
      {
        path: 'coach/dashboard',
        title: 'nav.coachDashboard',
        // Clients may visit: the page explains how to create a coach account instead of
        // bouncing them away in a redirect loop.
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/coach-studio/coach-dashboard-page.component').then(
            (m) => m.CoachDashboardPageComponent,
          ),
      },
      {
        path: '**',
        title: 'notFound.title',
        loadComponent: () =>
          import('./features/not-found/not-found-page.component').then((m) => m.NotFoundPageComponent),
      },
    ],
  },
];
