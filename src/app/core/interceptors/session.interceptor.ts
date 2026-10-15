import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ApiService } from '../api/api.service';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../ui/notification.service';

/** Endpoints where a 401 means "wrong credentials", not "session expired". */
const CREDENTIAL_ENDPOINTS = ['/auth/login', '/auth/register'];

/**
 * Drops a stored session as soon as the API rejects it.
 *
 * A 401 on a request that carried a Bearer token means the token is no longer valid
 * (expired, rotated, or the account is gone). The session is cleared so guards send the
 * user to the login screen instead of the UI repeatedly failing. 401s coming from the
 * login/registration endpoints are left untouched — those are normal validation
 * failures and must stay inline in the form.
 */
export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const api = inject(ApiService);
  const notifications = inject(NotificationService);

  const sentToken = Boolean(auth.token()) && request.url.startsWith(api.baseUrl);
  const isCredentialCall = CREDENTIAL_ENDPOINTS.some((endpoint) => request.url.includes(endpoint));

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        sentToken &&
        !isCredentialCall
      ) {
        auth.clearSession();
        notifications.error('auth.sessionExpired');
      }
      return throwError(() => error);
    }),
  );
};
