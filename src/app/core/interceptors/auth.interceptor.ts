import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { ApiService } from '../api/api.service';
import { AuthService } from '../auth/auth.service';

/**
 * Attaches the JWT access token to API requests.
 *
 * Only requests aimed at the configured API base URL are touched, so the token can
 * never leak to a third-party origin. The backend expects
 * `Authorization: Bearer <token>`.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const api = inject(ApiService);

  const token = auth.token();
  const targetsApi = request.url.startsWith(api.baseUrl);

  if (!token || !targetsApi) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
